// js/sync/syncNotes.js - Операції завантаження, вивантаження та видалення нотаток і блокнотів
window.App = window.App || {};

(function() {
    let syncDebounceTimer = null;
    let reorderDebounceTimer = null;
    let pullDebounceTimer = null;

    window.App.syncNotes = {
        // 1. Завантаження нотаток та блокнотів з Supabase у локальний стан
        async pullFromCloud(cloudSync) {
            const cs = cloudSync || window.App.cloudSync;
            if (!cs) return;
            const currentUser = cs.getCurrentUser ? cs.getCurrentUser() : null;
            if (!currentUser || !window.App.supabase) return;
            const supabase = window.App.supabase;
            const state = window.App.state;
            const offlineQueue = window.App.offlineQueue;

            // Якщо прямо зараз триває перетягування нотатки — відкладаємо pull до завершення
            if (state && state.isDraggingNote) {
                cs._pendingPullAfterDrag = true;
                return;
            }

            // Якщо інший запит pullFromCloud вже в процесі — плануємо перезапуск після завершення
            if (cs.isPullingFromCloud) {
                cs._rePullNeeded = true;
                return;
            }

            cs.isPullingFromCloud = true;

            try {
                // Отримуємо найсвіжіші дані користувача з сервера
                const { data: freshUserResp } = await supabase.auth.getUser();
                if (freshUserResp && freshUserResp.user) {
                    cs.currentUser = freshUserResp.user;
                }

                // 1. Завантаження блокнотів із таблиці `boards`
                const { data: dbBoards, error: boardsErr } = await supabase
                    .from('boards')
                    .select('*')
                    .order('order_index', { ascending: true, nullsFirst: false })
                    .order('created_at', { ascending: true });

                if (boardsErr) {
                    console.warn('[CloudSync] Error fetching boards from table:', boardsErr.message);
                }

                if (dbBoards && dbBoards.length > 0) {
                    state.boards = dbBoards.map(b => ({
                        id: b.id,
                        name: b.name,
                        icon: b.icon || null,
                        createdAt: b.created_at ? new Date(b.created_at).getTime() : Date.now(),
                        orderIndex: typeof b.order_index === 'number' ? b.order_index : 0
                    }));
                    window.App.storage.saveBoards(state.boards);

                    // Відновлюємо збережені теги кожного блокнота
                    const allBoardsTags = JSON.parse(localStorage.getItem('minimal_board_tag_options')) || {};
                    dbBoards.forEach(b => {
                        if (b.tag_options && Array.isArray(b.tag_options)) {
                            allBoardsTags[b.id] = b.tag_options;
                        }
                    });
                    localStorage.setItem('minimal_board_tag_options', JSON.stringify(allBoardsTags));

                    if (!state.activeBoardId || !state.boards.find(b => b.id === state.activeBoardId)) {
                        state.activeBoardId = state.boards[0].id;
                        window.App.storage.saveActiveBoardId(state.activeBoardId);
                    }
                } else {
                    // Безшовна міграція: якщо в таблиці ще пусто, але є дані в user_metadata чи state.boards
                    const legacyBoards = currentUser?.user_metadata?.boards;
                    const boardsToMigrate = (Array.isArray(legacyBoards) && legacyBoards.length > 0)
                        ? legacyBoards
                        : state.boards;

                    if (Array.isArray(boardsToMigrate) && boardsToMigrate.length > 0) {
                        state.boards = boardsToMigrate;
                        window.App.storage.saveBoards(state.boards);
                        if (!state.activeBoardId || !state.boards.find(b => b.id === state.activeBoardId)) {
                            state.activeBoardId = state.boards[0].id;
                            window.App.storage.saveActiveBoardId(state.activeBoardId);
                        }
                        await this.syncBoards(cs);
                    }
                }

                // 2. Синхронізація спільних блокнотів читача з таблиці `user_shared_tokens`
                let sharedTokens = [];
                const { data: dbSharedTokens } = await supabase
                    .from('user_shared_tokens')
                    .select('share_token');

                if (dbSharedTokens && dbSharedTokens.length > 0) {
                    sharedTokens = dbSharedTokens.map(t => t.share_token).filter(Boolean);
                } else {
                    const legacyTokens = currentUser?.user_metadata?.shared_board_tokens;
                    if (Array.isArray(legacyTokens) && legacyTokens.length > 0) {
                        sharedTokens = legacyTokens;
                        await this.syncSharedTokens(legacyTokens, cloudSync);
                    }
                }

                if (sharedTokens.length > 0 && window.App.shareManager) {
                    const loadedSharedBoards = [];
                    const loadedSharedNotes = [];

                    for (const token of sharedTokens) {
                        try {
                            const info = await window.App.shareManager.fetchShareInfo(token);
                            if (info && info.board && info.notes) {
                                loadedSharedBoards.push(info.board);
                                loadedSharedNotes.push(...info.notes);
                            }
                        } catch (e) {
                            console.warn('[CloudSync] Failed to fetch shared board for token:', token, e);
                        }
                    }

                    state.readOnlyBoards = loadedSharedBoards;
                    state.readOnlyNotes = loadedSharedNotes;
                    window.App.storage.saveReadOnlyBoards(state.readOnlyBoards);
                    window.App.storage.saveReadOnlyNotes(state.readOnlyNotes);
                } else if (sharedTokens.length === 0) {
                    state.readOnlyBoards = [];
                    state.readOnlyNotes = [];
                    window.App.storage.saveReadOnlyBoards([]);
                    window.App.storage.saveReadOnlyNotes([]);
                }

                const { data: cloudNotes, error } = await supabase
                    .from('notes')
                    .select('*')
                    .order('order_index', { ascending: true, nullsFirst: false })
                    .order('created_at', { ascending: true });

                if (error) {
                    console.error('[CloudSync] Error pulling notes:', error);
                    return;
                }

                if (cloudNotes) {
                    const firstBoardId = (state.boards && state.boards[0]) ? state.boards[0].id : null;
                    const localMap = new Map(state.notes.map(n => [n.id, n]));
                    const currentQueue = offlineQueue ? offlineQueue.getOfflineQueue() : [];
                    const pendingUpsertIds = new Set(currentQueue.filter(i => i.type === 'upsert_note').map(i => i.id));
                    const pendingDeleteIds = new Set(currentQueue.filter(i => i.type === 'delete_note').map(i => i.id));

                    // Відкидаємо нотатки, які були видалені локально
                    const validCloudNotes = cloudNotes.filter(n => (!offlineQueue || !offlineQueue.isLocallyDeleted(n.id)) && !pendingDeleteIds.has(n.id));

                    const formattedNotes = validCloudNotes.map(n => {
                        const localNote = localMap.get(n.id);
                        const resolvedBoardId = n.board_id || (localNote ? localNote.boardId : null) || firstBoardId;

                        if (!n.board_id && resolvedBoardId) {
                            supabase.from('notes').update({ board_id: resolvedBoardId }).eq('id', n.id);
                        }

                        const cloudUpdatedAt = n.updated_at ? new Date(n.updated_at).getTime() : 0;
                        const localUpdatedAt = (localNote && localNote.updatedAt) ? Number(localNote.updatedAt) : 0;
                        const hasPendingSync = (cs._pendingSyncNotesMap && cs._pendingSyncNotesMap.has(n.id)) || pendingUpsertIds.has(n.id);
                        const isLocalStrictlyNewer = localNote && (localUpdatedAt > cloudUpdatedAt);

                        if (localNote && isLocalStrictlyNewer && hasPendingSync) {
                            if (offlineQueue) offlineQueue.queueOfflineAction({ type: 'upsert_note', id: localNote.id });
                            return { ...localNote, boardId: resolvedBoardId };
                        }

                        if (offlineQueue) {
                            offlineQueue.removeOfflineAction(n.id, 'upsert_note');
                            offlineQueue.unmarkOfflineCreated(n.id);
                        }
                        if (cs._pendingSyncNotesMap) cs._pendingSyncNotesMap.delete(n.id);
                        if (cs._pendingReorderNotesMap) cs._pendingReorderNotesMap.delete(n.id);

                        const savedBookmarks = (window.App.stickerBookmarks && window.App.stickerBookmarks.getSavedBookmarks)
                            ? window.App.stickerBookmarks.getSavedBookmarks(n.id)
                            : [];
                        const resolvedLinkedIds = (Array.isArray(n.linked_note_ids) && n.linked_note_ids.length > 0)
                            ? n.linked_note_ids
                            : ((localNote && Array.isArray(localNote.linkedNoteIds) && localNote.linkedNoteIds.length > 0)
                                ? [...localNote.linkedNoteIds]
                                : savedBookmarks);

                        return {
                            id: n.id,
                            boardId: resolvedBoardId,
                            parentId: n.parent_id || null,
                            title: n.title || '',
                            content: n.content || '',
                            color: n.color || 'yellow',
                            fontSize: n.font_size || 16,
                            icon: n.icon || '',
                            images: n.images || [],
                            isCollapsed: !!n.is_collapsed,
                            tags: Array.isArray(n.tags) ? n.tags : [],
                            linkedNoteIds: resolvedLinkedIds,
                            orderIndex: typeof n.order_index === 'number' ? n.order_index : 0,
                            gridCol: localNote && localNote.gridCol ? localNote.gridCol : undefined,
                            createdAt: new Date(n.created_at).getTime() || Date.now(),
                            updatedAt: cloudUpdatedAt || Date.now()
                        };
                    });

                    // Зберігаємо ТІЛЬКИ ті локальні нотатки, які реально були створені офлайн на ЦЬОМУ пристрої
                    const cloudIds = new Set(cloudNotes.map(n => n.id));
                    state.notes.forEach(localNote => {
                        if (!cloudIds.has(localNote.id)) {
                            const isPendingOfflineCreation = pendingUpsertIds.has(localNote.id)
                                && (localNote.isOfflineCreated || (offlineQueue && offlineQueue.isOfflineCreated(localNote.id)))
                                && (!offlineQueue || !offlineQueue.isLocallyDeleted(localNote.id))
                                && !pendingDeleteIds.has(localNote.id);

                            if (isPendingOfflineCreation) {
                                console.log('[CloudSync] 💾 Preserving genuine offline-created note awaiting upload:', localNote.id);
                                formattedNotes.push(localNote);
                            } else {
                                console.log('[CloudSync] 🗑️ Discarding note deleted in cloud from another device:', localNote.id);
                                if (offlineQueue) {
                                    offlineQueue.removeOfflineAction(localNote.id);
                                    offlineQueue.unmarkOfflineCreated(localNote.id);
                                }
                                if (cs._pendingSyncNotesMap) cs._pendingSyncNotesMap.delete(localNote.id);
                                if (cs._pendingReorderNotesMap) cs._pendingReorderNotesMap.delete(localNote.id);
                                if (localNote.isOfflineCreated) delete localNote.isOfflineCreated;
                            }
                        }
                    });

                    if (state && state.isDraggingNote) {
                        console.log('[CloudSync] Notes pulled during drag, deferring update...');
                        cs._deferredPulledNotes = formattedNotes;
                        return;
                    }

                    state.notes = formattedNotes;
                    window.App.storage.saveNotes(state.notes, true);

                    if (window.App.welcomeView) window.App.welcomeView.hide();
                    if (window.App.sidebarView) window.App.sidebarView.render();
                    if (window.App.workspaceView) window.App.workspaceView.render();

                    if (window.App.syncStorage) {
                        await window.App.syncStorage.uploadMissingLocalImages();
                    }

                    if (offlineQueue) {
                        offlineQueue.flushOfflineQueue(cs);
                    }
                } else {
                    if (state.notes.length > 0) {
                        console.log('[CloudSync] Pushing local notes to empty cloud...');
                        await this.pushAllToCloud(cs);
                    } else {
                        state.notes = [];
                        window.App.storage.saveNotes(state.notes, true);
                        if (window.App.sidebarView) window.App.sidebarView.render();
                        if (window.App.workspaceView) window.App.workspaceView.render();
                    }
                }
            } catch (err) {
                console.error('[CloudSync] Pull exception:', err);
            } finally {
                cs.isPullingFromCloud = false;
                if (cs._rePullNeeded) {
                    cs._rePullNeeded = false;
                    clearTimeout(pullDebounceTimer);
                    pullDebounceTimer = setTimeout(() => {
                        this.pullFromCloud(cs);
                    }, 200);
                }
            }
        },

        // 2. Відправка нотатки в хмару
        syncNote(note, isNew = false, cloudSync) {
            const cs = cloudSync || window.App.cloudSync;
            if (!note) return;
            const offlineQueue = window.App.offlineQueue;

            if (offlineQueue) {
                if (offlineQueue.isLocallyDeleted(note.id)) {
                    offlineQueue.getLocallyDeletedSet().delete(note.id);
                    try {
                        localStorage.setItem('minimal_locally_deleted_ids', JSON.stringify(Array.from(offlineQueue.getLocallyDeletedSet())));
                    } catch (e) {}
                }
                offlineQueue.removeOfflineAction(note.id, 'delete_note');

                if (isNew || note.isOfflineCreated) {
                    offlineQueue.markOfflineCreated(note.id);
                }
                offlineQueue.queueOfflineAction({ type: 'upsert_note', id: note.id });
            }

            const currentUser = cs && cs.getCurrentUser ? cs.getCurrentUser() : null;
            if (!currentUser || !window.App.supabase) return;

            if (cs && cs.lastLocalEditTimestamps) cs.lastLocalEditTimestamps.set(note.id, Date.now());
            if (cs && cs._pendingSyncNotesMap) cs._pendingSyncNotesMap.set(note.id, note);

            clearTimeout(syncDebounceTimer);
            syncDebounceTimer = setTimeout(async () => {
                await this.flushPendingNotes(cs);
            }, 300);
        },

        // Дебаунс синхронізації зміни порядку карток
        syncReorderNotes(notes, cloudSync) {
            const cs = cloudSync || window.App.cloudSync;
            if (!notes || notes.length === 0) return;
            const offlineQueue = window.App.offlineQueue;

            const currentQueue = offlineQueue ? offlineQueue.getOfflineQueue() : [];
            const pendingDeleteIds = new Set(currentQueue.filter(i => i.type === 'delete_note').map(i => i.id));
            const validNotes = notes.filter(n => (!offlineQueue || !offlineQueue.isLocallyDeleted(n.id)) && !pendingDeleteIds.has(n.id));
            if (validNotes.length === 0) return;

            if (offlineQueue) {
                validNotes.forEach(note => {
                    offlineQueue.queueOfflineAction({ type: 'upsert_note', id: note.id });
                });
            }

            const currentUser = cs && cs.getCurrentUser ? cs.getCurrentUser() : null;
            if (!currentUser || !window.App.supabase) return;

            const now = Date.now();
            validNotes.forEach(note => {
                if (cs && cs.lastLocalEditTimestamps) cs.lastLocalEditTimestamps.set(note.id, now);
                if (cs && cs._pendingReorderNotesMap) cs._pendingReorderNotesMap.set(note.id, note);
            });

            clearTimeout(reorderDebounceTimer);
            reorderDebounceTimer = setTimeout(async () => {
                await this.flushPendingReorders(cs);
            }, 400);
        },

        async flushPendingReorders(cloudSync) {
            const cs = cloudSync || window.App.cloudSync;
            if (!cs || !cs._pendingReorderNotesMap || cs._pendingReorderNotesMap.size === 0) return;

            const notesToPush = Array.from(cs._pendingReorderNotesMap.values());
            cs._pendingReorderNotesMap.clear();
            clearTimeout(reorderDebounceTimer);
            reorderDebounceTimer = null;

            const now = Date.now();
            if (cs.lastLocalEditTimestamps) {
                notesToPush.forEach(n => cs.lastLocalEditTimestamps.set(n.id, now));
            }

            await this._pushMultipleNotesToCloud(notesToPush, cs);
        },

        async flushPendingNotes(cloudSync) {
            const cs = cloudSync || window.App.cloudSync;
            if (!cs || !cs._pendingSyncNotesMap || cs._pendingSyncNotesMap.size === 0) return;

            const notesToPush = Array.from(cs._pendingSyncNotesMap.values());
            cs._pendingSyncNotesMap.clear();
            clearTimeout(syncDebounceTimer);
            syncDebounceTimer = null;

            const now = Date.now();
            if (cs.lastLocalEditTimestamps) {
                notesToPush.forEach(n => cs.lastLocalEditTimestamps.set(n.id, now));
            }

            if (notesToPush.length === 1) {
                await this._pushNoteToCloud(notesToPush[0], cs);
            } else {
                await this._pushMultipleNotesToCloud(notesToPush, cs);
            }
        },

        async _pushMultipleNotesToCloud(notes, cloudSync) {
            const supabase = window.App.supabase;
            const cs = cloudSync || window.App.cloudSync;
            const currentUser = cs && cs.getCurrentUser ? cs.getCurrentUser() : null;
            if (!supabase || !currentUser || !notes || notes.length === 0) return;
            const state = window.App.state;
            const offlineQueue = window.App.offlineQueue;

            const currentQueue = offlineQueue ? offlineQueue.getOfflineQueue() : [];
            const pendingDeleteIds = new Set(currentQueue.filter(i => i.type === 'delete_note').map(i => i.id));
            const validNotes = notes.filter(n => (!offlineQueue || !offlineQueue.isLocallyDeleted(n.id)) && !pendingDeleteIds.has(n.id));
            if (validNotes.length === 0) return;

            const now = Date.now();
            if (cs && cs.lastLocalEditTimestamps) {
                validNotes.forEach(n => cs.lastLocalEditTimestamps.set(n.id, now));
            }

            const payloads = validNotes.map(note => {
                const noteIndex = typeof note.orderIndex === 'number'
                    ? note.orderIndex
                    : state.notes.findIndex(n => n.id === note.id);

                return {
                    id: note.id,
                    user_id: currentUser.id,
                    board_id: note.boardId || state.activeBoardId || null,
                    parent_id: note.parentId || null,
                    title: note.title || '',
                    content: note.content || '',
                    color: note.color || 'yellow',
                    font_size: typeof note.fontSize === 'number' ? note.fontSize : 16,
                    icon: note.icon || '',
                    images: note.images || [],
                    is_collapsed: !!note.isCollapsed,
                    tags: Array.isArray(note.tags) ? note.tags : [],
                    order_index: noteIndex !== -1 ? noteIndex : state.notes.length,
                    created_at: new Date(note.createdAt || Date.now()).toISOString(),
                    updated_at: new Date(note.updatedAt || Date.now()).toISOString()
                };
            });

            try {
                const { error } = await supabase
                    .from('notes')
                    .upsert(payloads, { onConflict: 'id' });

                if (error) {
                    console.warn('[CloudSync] Bulk note upsert error:', error.message);
                } else {
                    console.log(`[CloudSync] ⚡ Successfully batch synced ${validNotes.length} notes to cloud.`);
                    validNotes.forEach(n => {
                        if (offlineQueue) {
                            offlineQueue.removeOfflineAction(n.id, 'upsert_note');
                            offlineQueue.unmarkOfflineCreated(n.id);
                        }
                        if (n.isOfflineCreated) delete n.isOfflineCreated;
                    });
                    window.App.storage.saveNotes(state.notes, true);
                }
            } catch (err) {
                console.warn('[CloudSync] Bulk upsert exception:', err);
            }
        },

        async _pushNoteToCloud(note, cloudSync) {
            const supabase = window.App.supabase;
            const cs = cloudSync || window.App.cloudSync;
            const currentUser = cs && cs.getCurrentUser ? cs.getCurrentUser() : null;
            if (!supabase || !currentUser || !note) return;
            const state = window.App.state;
            const offlineQueue = window.App.offlineQueue;

            const currentQueue = offlineQueue ? offlineQueue.getOfflineQueue() : [];
            const isPendingDelete = currentQueue.some(i => i.type === 'delete_note' && i.id === note.id);
            if ((offlineQueue && offlineQueue.isLocallyDeleted(note.id)) || isPendingDelete) {
                console.log('[CloudSync] Skipping push for deleted note:', note.id);
                return;
            }

            if (cs && cs.lastLocalEditTimestamps) {
                cs.lastLocalEditTimestamps.set(note.id, Date.now());
            }

            const noteIndex = typeof note.orderIndex === 'number'
                ? note.orderIndex
                : state.notes.findIndex(n => n.id === note.id);

            const payload = {
                id: note.id,
                user_id: currentUser.id,
                board_id: note.boardId || state.activeBoardId || null,
                parent_id: note.parentId || null,
                title: note.title || '',
                content: note.content || '',
                color: note.color || 'yellow',
                font_size: typeof note.fontSize === 'number' ? note.fontSize : 16,
                icon: note.icon || '',
                images: note.images || [],
                is_collapsed: !!note.isCollapsed,
                tags: Array.isArray(note.tags) ? note.tags : [],
                order_index: noteIndex !== -1 ? noteIndex : state.notes.length,
                created_at: new Date(note.createdAt || Date.now()).toISOString(),
                updated_at: new Date(note.updatedAt || Date.now()).toISOString()
            };

            try {
                const { error } = await supabase
                    .from('notes')
                    .upsert(payload, { onConflict: 'id' });

                if (error) {
                    console.warn('[CloudSync] Note upsert error:', error.message);
                } else {
                    if (offlineQueue) {
                        offlineQueue.removeOfflineAction(note.id, 'upsert_note');
                        offlineQueue.unmarkOfflineCreated(note.id);
                    }
                    if (note.isOfflineCreated) delete note.isOfflineCreated;
                    window.App.storage.saveNotes(state.notes, true);
                }
            } catch (err) {
                console.warn('[CloudSync] Upsert exception:', err);
            }
        },

        async deleteNoteFromCloud(noteId, cloudSync) {
            if (!noteId) return;
            const offlineQueue = window.App.offlineQueue;
            const cs = cloudSync || window.App.cloudSync;

            if (offlineQueue) {
                offlineQueue.persistDeletedId(noteId);
                offlineQueue.removeOfflineAction(noteId, 'upsert_note');
                offlineQueue.queueOfflineAction({ type: 'delete_note', id: noteId });
                offlineQueue.unmarkOfflineCreated(noteId);
            }

            if (cs && cs._pendingSyncNotesMap) cs._pendingSyncNotesMap.delete(noteId);
            if (cs && cs._pendingReorderNotesMap) cs._pendingReorderNotesMap.delete(noteId);

            const currentUser = cs && cs.getCurrentUser ? cs.getCurrentUser() : null;
            if (!currentUser || !window.App.supabase) return;
            const supabase = window.App.supabase;

            try {
                try {
                    await supabase.from('notes').update({ parent_id: null }).eq('id', noteId);
                } catch (e) {}

                const { error } = await supabase.from('notes').delete().eq('id', noteId).select('id');
                if (error) {
                    console.error('[CloudSync] ❌ Delete single note error:', error.message, error);
                } else {
                    if (offlineQueue) offlineQueue.removeOfflineAction(noteId, 'delete_note');
                    console.log(`[CloudSync] 🗑️ Note "${noteId}" deleted from cloud database.`);
                }
            } catch (err) {
                console.warn('[CloudSync] Delete exception:', err);
            }
        },

        async deleteNotesFromCloud(noteIds, cloudSync) {
            if (!noteIds || noteIds.length === 0) return;
            const offlineQueue = window.App.offlineQueue;
            const cs = cloudSync || window.App.cloudSync;

            noteIds.forEach(id => {
                if (offlineQueue) {
                    offlineQueue.persistDeletedId(id);
                    offlineQueue.removeOfflineAction(id, 'upsert_note');
                    offlineQueue.queueOfflineAction({ type: 'delete_note', id });
                    offlineQueue.unmarkOfflineCreated(id);
                }
                if (cs && cs._pendingSyncNotesMap) cs._pendingSyncNotesMap.delete(id);
                if (cs && cs._pendingReorderNotesMap) cs._pendingReorderNotesMap.delete(id);
            });

            const currentUser = cs && cs.getCurrentUser ? cs.getCurrentUser() : null;
            if (!currentUser || !window.App.supabase) return;
            const supabase = window.App.supabase;

            try {
                try {
                    await supabase.from('notes').update({ parent_id: null }).in('id', noteIds);
                } catch (e) {}

                const { error } = await supabase.from('notes').delete().in('id', noteIds).select('id');
                if (error) {
                    console.error('[CloudSync] ❌ Batch delete error from Supabase:', error.message, error);
                    for (const singleId of noteIds) {
                        try {
                            const { error: singleErr } = await supabase.from('notes').delete().eq('id', singleId);
                            if (!singleErr && offlineQueue) {
                                offlineQueue.removeOfflineAction(singleId, 'delete_note');
                            }
                        } catch (e) {}
                    }
                } else {
                    if (offlineQueue) noteIds.forEach(id => offlineQueue.removeOfflineAction(id, 'delete_note'));
                    console.log(`[CloudSync] 🗑️ Batch deleted ${noteIds.length} notes from cloud.`);
                }
            } catch (err) {
                console.warn('[CloudSync] Batch delete exception:', err);
            }
        },

        async syncBoards(cloudSync) {
            const cs = cloudSync || window.App.cloudSync;
            const currentUser = cs && cs.getCurrentUser ? cs.getCurrentUser() : null;
            if (!currentUser || !window.App.supabase) return;
            const state = window.App.state;
            if (!state.boards || state.boards.length === 0) return;

            try {
                const allBoardsTags = JSON.parse(localStorage.getItem('minimal_board_tag_options')) || {};
                const payloads = state.boards.map((b, idx) => ({
                    id: b.id,
                    user_id: currentUser.id,
                    name: b.name,
                    icon: b.icon || null,
                    order_index: typeof b.orderIndex === 'number' ? b.orderIndex : idx,
                    tag_options: allBoardsTags[b.id] || ['В процесі', 'Зроблено', 'Виконати пізніше'],
                    created_at: new Date(b.createdAt || Date.now()).toISOString(),
                    updated_at: new Date().toISOString()
                }));

                const { error } = await window.App.supabase
                    .from('boards')
                    .upsert(payloads, { onConflict: 'id' });

                if (error) {
                    console.warn('[CloudSync] boards upsert error:', error.message);
                } else {
                    console.log(`[CloudSync] ⚡ Successfully synced ${payloads.length} boards to database table.`);
                }
            } catch (e) {
                console.warn('[CloudSync] syncBoards exception:', e);
            }
        },

        async deleteBoardFromCloud(boardId, cloudSync) {
            if (!boardId) return;
            const offlineQueue = window.App.offlineQueue;
            if (offlineQueue) offlineQueue.queueOfflineAction({ type: 'delete_board', id: boardId });
            const cs = cloudSync || window.App.cloudSync;
            const currentUser = cs && cs.getCurrentUser ? cs.getCurrentUser() : null;
            if (!currentUser || !window.App.supabase) return;

            try {
                const { error } = await window.App.supabase
                    .from('boards')
                    .delete()
                    .eq('id', boardId);

                if (error) {
                    console.warn('[CloudSync] deleteBoardFromCloud error:', error.message);
                } else {
                    if (offlineQueue) offlineQueue.removeOfflineAction(boardId, 'delete_board');
                    console.log(`[CloudSync] ⚡ Board "${boardId}" deleted from cloud database.`);
                }
            } catch (e) {
                console.warn('[CloudSync] deleteBoardFromCloud exception:', e);
            }
        },

        async syncTagOptions(boardId = null, cloudSync) {
            const cs = cloudSync || window.App.cloudSync;
            const currentUser = cs && cs.getCurrentUser ? cs.getCurrentUser() : null;
            if (!currentUser || !window.App.supabase) return;
            const state = window.App.state;
            const targetBoardId = boardId || state.activeBoardId;
            if (!targetBoardId) return;

            try {
                const allBoardsTags = JSON.parse(localStorage.getItem('minimal_board_tag_options')) || {};
                const currentTags = allBoardsTags[targetBoardId];
                if (currentTags && Array.isArray(currentTags)) {
                    await window.App.supabase
                        .from('boards')
                        .update({
                            tag_options: currentTags,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', targetBoardId);
                }
            } catch (e) {
                console.warn('[CloudSync] syncTagOptions error:', e);
            }
        },

        async syncSharedTokens(tokensToSync = null, cloudSync) {
            const cs = cloudSync || window.App.cloudSync;
            const currentUser = cs && cs.getCurrentUser ? cs.getCurrentUser() : null;
            if (!currentUser || !window.App.supabase) return;
            const state = window.App.state;

            try {
                const tokens = tokensToSync !== null ? tokensToSync : (state.readOnlyBoards || [])
                    .map(b => b.shareToken)
                    .filter(Boolean);

                await window.App.supabase
                    .from('user_shared_tokens')
                    .delete()
                    .eq('user_id', currentUser.id);

                if (tokens.length > 0) {
                    const payloads = tokens.map(token => ({
                        user_id: currentUser.id,
                        share_token: token,
                        created_at: new Date().toISOString()
                    }));

                    await window.App.supabase
                        .from('user_shared_tokens')
                        .upsert(payloads, { onConflict: 'user_id,share_token' });
                }

                try {
                    await window.App.supabase.auth.updateUser({
                        data: { shared_board_tokens: tokens }
                    });
                    if (currentUser.user_metadata) {
                        currentUser.user_metadata.shared_board_tokens = tokens;
                    }
                } catch (metaErr) {}
            } catch (e) {
                console.warn('[CloudSync] syncSharedTokens error:', e);
            }
        },

        async pushAllToCloud(cloudSync) {
            const cs = cloudSync || window.App.cloudSync;
            const currentUser = cs && cs.getCurrentUser ? cs.getCurrentUser() : null;
            if (!currentUser || !window.App.supabase) return;
            const state = window.App.state;
            const supabase = window.App.supabase;
            const offlineQueue = window.App.offlineQueue;

            if (window.App.syncStorage) {
                await window.App.syncStorage.uploadMissingLocalImages();
            }

            const payloads = state.notes.map((note, idx) => ({
                id: note.id,
                user_id: currentUser.id,
                board_id: note.boardId || state.activeBoardId || null,
                parent_id: note.parentId || null,
                title: note.title || '',
                content: note.content || '',
                color: note.color || 'yellow',
                font_size: typeof note.fontSize === 'number' ? note.fontSize : 16,
                icon: note.icon || '',
                images: note.images || [],
                is_collapsed: !!note.isCollapsed,
                tags: Array.isArray(note.tags) ? note.tags : [],
                order_index: idx,
                updated_at: new Date().toISOString()
            }));

            if (payloads.length === 0) return;

            const now = Date.now();
            if (cs && cs.lastLocalEditTimestamps) {
                payloads.forEach(p => cs.lastLocalEditTimestamps.set(p.id, now));
            }

            try {
                const { error } = await supabase.from('notes').upsert(payloads, { onConflict: 'id' });
                if (error) console.warn('[CloudSync] Bulk push error:', error.message);
                else {
                    console.log('[CloudSync] Synced all local notes & images to cloud');
                    state.notes.forEach(n => {
                        if (offlineQueue) offlineQueue.unmarkOfflineCreated(n.id);
                        if (n.isOfflineCreated) delete n.isOfflineCreated;
                    });
                    window.App.storage.saveNotes(state.notes, true);
                }
            } catch (err) {
                console.warn('[CloudSync] Bulk push exception:', err);
            }
        }
    };
})();
