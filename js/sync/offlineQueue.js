// js/sync/offlineQueue.js - Персистентна черга офлайн-змін та захист від воскресіння видалених нотаток
window.App = window.App || {};

(function() {
    // Персистентний кеш локально створених офлайн нотаток (до першого успішного синку)
    let offlineCreatedNoteIds = new Set();
    try {
        const savedCreated = JSON.parse(localStorage.getItem('minimal_offline_created_ids'));
        if (Array.isArray(savedCreated)) {
            offlineCreatedNoteIds = new Set(savedCreated);
        }
    } catch (e) {}

    // Персистентний кеш локально видалених ID для надійного захисту від воскресіння нотаток
    let locallyDeletedNoteIds = new Set();
    try {
        const savedDeleted = JSON.parse(localStorage.getItem('minimal_locally_deleted_ids'));
        if (Array.isArray(savedDeleted)) {
            locallyDeletedNoteIds = new Set(savedDeleted);
        }
    } catch (e) {}

    window.App.offlineQueue = {
        markOfflineCreated(id) {
            if (!id) return;
            offlineCreatedNoteIds.add(id);
            try {
                localStorage.setItem('minimal_offline_created_ids', JSON.stringify(Array.from(offlineCreatedNoteIds)));
            } catch (e) {}
        },

        unmarkOfflineCreated(id) {
            if (!id) return;
            if (offlineCreatedNoteIds.delete(id)) {
                try {
                    localStorage.setItem('minimal_offline_created_ids', JSON.stringify(Array.from(offlineCreatedNoteIds)));
                } catch (e) {}
            }
        },

        isOfflineCreated(id) {
            return offlineCreatedNoteIds.has(id);
        },

        persistDeletedId(id) {
            if (!id) return;
            locallyDeletedNoteIds.add(id);
            if (locallyDeletedNoteIds.size > 500) {
                const arr = Array.from(locallyDeletedNoteIds);
                locallyDeletedNoteIds = new Set(arr.slice(arr.length - 500));
            }
            try {
                localStorage.setItem('minimal_locally_deleted_ids', JSON.stringify(Array.from(locallyDeletedNoteIds)));
            } catch (e) {}
        },

        isLocallyDeleted(id) {
            return locallyDeletedNoteIds.has(id);
        },

        getLocallyDeletedSet() {
            return locallyDeletedNoteIds;
        },

        getOfflineCreatedSet() {
            return offlineCreatedNoteIds;
        },

        getOfflineQueue() {
            try {
                return JSON.parse(localStorage.getItem('minimal_offline_sync_queue')) || [];
            } catch (e) {
                return [];
            }
        },

        saveOfflineQueue(queue) {
            try {
                localStorage.setItem('minimal_offline_sync_queue', JSON.stringify(queue));
            } catch (e) {}
        },

        queueOfflineAction(action) {
            if (!action || !action.id) return;
            const queue = this.getOfflineQueue();
            const filtered = queue.filter(item => !(item.id === action.id && item.type === action.type));
            filtered.push({ ...action, timestamp: Date.now() });
            this.saveOfflineQueue(filtered);
        },

        removeOfflineAction(id, type = null) {
            if (!id) return;
            const queue = this.getOfflineQueue();
            const filtered = queue.filter(item => {
                if (type) return !(item.id === id && item.type === type);
                return item.id !== id;
            });
            this.saveOfflineQueue(filtered);
        },

        // Обробка накопиченої черги дій при відновленні зв'язку
        async flushOfflineQueue(cloudSync) {
            const cs = cloudSync || window.App.cloudSync;
            const currentUser = cs && cs.getCurrentUser ? cs.getCurrentUser() : null;
            if (!currentUser || !window.App.supabase || !navigator.onLine) return;
            const queue = this.getOfflineQueue();
            if (!queue || queue.length === 0) return;

            console.log(`[CloudSync] 🔄 Flushing offline queue (${queue.length} items)...`);
            const state = window.App.state;

            const deleteNoteIds = queue.filter(i => i.type === 'delete_note').map(i => i.id);
            const deleteBoardIds = queue.filter(i => i.type === 'delete_board').map(i => i.id);
            const upsertNoteIds = new Set(queue.filter(i => i.type === 'upsert_note').map(i => i.id));

            // 1. Видалення накопичених нотаток
            if (deleteNoteIds.length > 0) {
                try {
                    try {
                        await window.App.supabase.from('notes').update({ parent_id: null }).in('id', deleteNoteIds);
                    } catch (e) {}

                    const { error } = await window.App.supabase.from('notes').delete().in('id', deleteNoteIds);
                    if (!error) {
                        deleteNoteIds.forEach(id => this.removeOfflineAction(id, 'delete_note'));
                        console.log(`[CloudSync] ⚡ Successfully flushed ${deleteNoteIds.length} offline note deletes.`);
                    } else {
                        console.error('[CloudSync] ❌ Error flushing delete notes queue:', error);
                        // Fallback поодинокого видалення
                        for (const sId of deleteNoteIds) {
                            try {
                                const { error: sErr } = await window.App.supabase.from('notes').delete().eq('id', sId);
                                if (!sErr) this.removeOfflineAction(sId, 'delete_note');
                            } catch (e) {}
                        }
                    }
                } catch (e) {
                    console.warn('[CloudSync] Error flushing delete notes queue:', e);
                }
            }

            // 2. Видалення накопичених блокнотів
            if (deleteBoardIds.length > 0) {
                try {
                    for (const bId of deleteBoardIds) {
                        const { error } = await window.App.supabase.from('boards').delete().eq('id', bId);
                        if (!error) {
                            this.removeOfflineAction(bId, 'delete_board');
                            console.log(`[CloudSync] ⚡ Successfully flushed offline delete for board "${bId}".`);
                        }
                    }
                } catch (e) {
                    console.warn('[CloudSync] Error flushing delete boards queue:', e);
                }
            }

            // 3. Відправка накопичених оновлень/створень нотаток
            if (upsertNoteIds.size > 0 && state && state.notes) {
                const currentNoteIds = new Set(state.notes.map(n => n.id));
                // Прибираємо з черги нотатки, які вже були видалені або яких немає в локальному стані
                upsertNoteIds.forEach(id => {
                    if (!currentNoteIds.has(id) || locallyDeletedNoteIds.has(id) || deleteNoteIds.includes(id)) {
                        this.removeOfflineAction(id, 'upsert_note');
                        upsertNoteIds.delete(id);
                    }
                });

                const notesToPush = state.notes.filter(n => upsertNoteIds.has(n.id) && !locallyDeletedNoteIds.has(n.id));
                if (notesToPush.length > 0 && window.App.syncNotes) {
                    await window.App.syncNotes._pushMultipleNotesToCloud(notesToPush, cs);
                }
            }
        }
    };
})();
