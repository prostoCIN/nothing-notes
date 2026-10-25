// js/sync/syncRealtime.js - Realtime WebSocket підписка на зміни в Supabase
window.App = window.App || {};

(function() {
    let _realtimeChannel = null;
    let pullDebounceTimer = null;

    window.App.syncRealtime = {
        initChannel(supabase, cloudSync) {
            if (!supabase) return;

            try {
                if (_realtimeChannel) {
                    supabase.removeChannel(_realtimeChannel);
                }

                _realtimeChannel = supabase
                    .channel('notes-realtime-channel')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, async (payload) => {
                        console.log('[CloudSync] ⚡ Realtime board change detected:', payload.eventType, payload);
                        const state = window.App.state;
                        if (!state) return;

                        if (payload.eventType === 'DELETE' && payload.old && payload.old.id) {
                            const delBoardId = payload.old.id;
                            if (state.boards.some(b => b.id === delBoardId)) {
                                state.boards = state.boards.filter(b => b.id !== delBoardId);
                                window.App.storage.saveBoards(state.boards);
                                if (state.activeBoardId === delBoardId) {
                                    state.activeBoardId = state.boards.length > 0 ? state.boards[0].id : null;
                                    window.App.storage.saveActiveBoardId(state.activeBoardId);
                                }
                                if (window.App.sidebarView) window.App.sidebarView.render();
                                if (window.App.workspaceView) window.App.workspaceView.render();
                            }
                        } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                            const newB = payload.new;
                            if (newB && newB.id) {
                                const existingIdx = state.boards.findIndex(b => b.id === newB.id);
                                const mapped = {
                                    id: newB.id,
                                    name: newB.name,
                                    icon: newB.icon || null,
                                    createdAt: newB.created_at ? new Date(newB.created_at).getTime() : Date.now(),
                                    orderIndex: typeof newB.order_index === 'number' ? newB.order_index : 0
                                };
                                if (existingIdx !== -1) {
                                    state.boards[existingIdx] = mapped;
                                } else {
                                    state.boards.push(mapped);
                                }
                                if (newB.tag_options && Array.isArray(newB.tag_options)) {
                                    const allBoardsTags = JSON.parse(localStorage.getItem('minimal_board_tag_options')) || {};
                                    allBoardsTags[newB.id] = newB.tag_options;
                                    localStorage.setItem('minimal_board_tag_options', JSON.stringify(allBoardsTags));
                                }
                                window.App.storage.saveBoards(state.boards);
                                if (window.App.sidebarView) window.App.sidebarView.render();
                                if (window.App.workspaceView) window.App.workspaceView.render();
                            }
                        }
                    })
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, (payload) => {
                        const offlineQueue = window.App.offlineQueue;

                        // Якщо це подія ВИДАЛЕННЯ (DELETE)
                        if (payload.eventType === 'DELETE' && payload.old && payload.old.id) {
                            const deletedId = payload.old.id;
                            if (offlineQueue) {
                                offlineQueue.persistDeletedId(deletedId);
                                offlineQueue.removeOfflineAction(deletedId);
                                offlineQueue.unmarkOfflineCreated(deletedId);
                            }
                            if (cloudSync._pendingSyncNotesMap) cloudSync._pendingSyncNotesMap.delete(deletedId);
                            if (cloudSync._pendingReorderNotesMap) cloudSync._pendingReorderNotesMap.delete(deletedId);

                            // Якщо прямо зараз користувач перетягує цю нотатку — відкладаємо до кінця драгу
                            if (window.App.state && window.App.state.isDraggingNote && window.App.state.draggedNoteId === deletedId) {
                                cloudSync._pendingPullAfterDrag = true;
                                return;
                            }

                            // Якщо нотатка все ще є у локальному стані (прийшло з іншого пристрою) — видаляємо її
                            const state = window.App.state;
                            if (state && state.notes && state.notes.some(n => n.id === deletedId)) {
                                state.notes = state.notes.filter(n => n.id !== deletedId);
                                window.App.storage.saveNotes(state.notes, true);
                                if (window.App.sidebarView) window.App.sidebarView.render();
                                if (window.App.workspaceView && (!window.App.state || !window.App.state.isDraggingNote)) {
                                    window.App.workspaceView.render();
                                }
                            }
                            return;
                        }

                        // Якщо зміна стосується нотатки, яку щойно редагували на цьому ж пристрої (менше 3.5 сек тому) - ігноруємо власне "відлуння"
                        if (payload.new && payload.new.id) {
                            const lastEdit = cloudSync.lastLocalEditTimestamps ? cloudSync.lastLocalEditTimestamps.get(payload.new.id) : null;
                            if (lastEdit && (Date.now() - lastEdit < 3500)) {
                                return;
                            }
                        }

                        // Якщо користувач прямо зараз перетягує нотатку - відкладаємо pull до завершення драгу
                        if (window.App.state && window.App.state.isDraggingNote) {
                            cloudSync._pendingPullAfterDrag = true;
                            return;
                        }

                        const activeEl = document.activeElement;
                        const isTyping = activeEl && (activeEl.classList.contains('sticker-content') || activeEl.classList.contains('sticker-title'));
                        if (isTyping && payload.new && activeEl.closest(`[data-note-id="${payload.new.id}"]`)) {
                            return; // Не перебиваємо активний ввід користувача
                        }

                        // Дебаунсимо виклики pullFromCloud (300мс) для об'єднання серії швидких подій
                        clearTimeout(pullDebounceTimer);
                        pullDebounceTimer = setTimeout(() => {
                            cloudSync.pullFromCloud();
                        }, 300);
                    })
                    .subscribe((status, err) => {
                        console.log('[CloudSync] Realtime status:', status);
                        if (err) console.warn('[CloudSync] Realtime subscription warning/error:', err);
                        if (status === 'SUBSCRIBED') {
                            console.log('[CloudSync] ✅ Realtime listening active for notes table');
                        }
                    });
            } catch (e) {
                console.warn('[CloudSync] Realtime subscription error:', e);
            }
        },

        removeChannel(supabase) {
            if (_realtimeChannel && supabase) {
                supabase.removeChannel(_realtimeChannel);
                _realtimeChannel = null;
            }
        }
    };
})();
