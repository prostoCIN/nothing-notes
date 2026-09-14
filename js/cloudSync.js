// js/cloudSync.js - Модуль двосторонньої синхронізації між клієнтом та Supabase
window.App = window.App || {};

(function() {
    let currentUser = null;
    let syncDebounceTimer = null;
    let reorderDebounceTimer = null;
    let _pendingReorderNotesMap = new Map();
    let isPullingFromCloud = false;
    let _rePullNeeded = false;
    let _pendingPullAfterDrag = false;
    let _deferredPulledNotes = null;
    let pullDebounceTimer = null;
    let lastLocalEditTimestamps = new Map(); // id -> timestamp

    // Персистентний кеш локально видалених ID для надійного захисту від воскресіння нотаток
    let locallyDeletedNoteIds = new Set();
    try {
        const savedDeleted = JSON.parse(localStorage.getItem('minimal_locally_deleted_ids'));
        if (Array.isArray(savedDeleted)) {
            locallyDeletedNoteIds = new Set(savedDeleted);
        }
    } catch (e) {}

    function persistDeletedId(id) {
        if (!id) return;
        locallyDeletedNoteIds.add(id);
        try {
            localStorage.setItem('minimal_locally_deleted_ids', JSON.stringify(Array.from(locallyDeletedNoteIds)));
        } catch (e) {}
    }

    // Персистентна черга офлайн-змін (localStorage)
    function getOfflineQueue() {
        try {
            return JSON.parse(localStorage.getItem('minimal_offline_sync_queue')) || [];
        } catch (e) {
            return [];
        }
    }

    function saveOfflineQueue(queue) {
        try {
            localStorage.setItem('minimal_offline_sync_queue', JSON.stringify(queue));
        } catch (e) {}
    }

    function queueOfflineAction(action) {
        if (!action || !action.id) return;
        const queue = getOfflineQueue();
        const filtered = queue.filter(item => !(item.id === action.id && item.type === action.type));
        filtered.push({ ...action, timestamp: Date.now() });
        saveOfflineQueue(filtered);
    }

    function removeOfflineAction(id, type = null) {
        if (!id) return;
        const queue = getOfflineQueue();
        const filtered = queue.filter(item => {
            if (type) return !(item.id === id && item.type === type);
            return item.id !== id;
        });
        saveOfflineQueue(filtered);
    }

    window.App.cloudSync = {
        init() {
            if (!window.App.supabase) {
                if (window.App.supabaseConfig && window.App.supabaseConfig.initClient) {
                    window.App.supabaseConfig.initClient();
                }
            }

            // Відстежуємо повернення пристрою онлайн для миттєвого скидання черги
            window.addEventListener('online', () => {
                console.log('[CloudSync] 🌐 Device is back online. Flushing offline queue & pulling latest changes...');
                this.flushOfflineQueue();
                this.pullFromCloud();
            });

            const supabase = window.App.supabase;
            if (!supabase) return;

            // Відстежуємо стан сесії користувача
            supabase.auth.getSession().then(({ data: { session } }) => {
                this.handleAuthChange(session ? session.user : null);
            });

            supabase.auth.onAuthStateChange((event, session) => {
                if (event === 'USER_UPDATED') {
                    if (session && session.user) {
                        currentUser = session.user;
                        this.updateAuthUI(session.user);
                    }
                    return;
                }
                this.handleAuthChange(session ? session.user : null);
            });

            // ⚡ Realtime-синхронізація: миттєве оновлення при змінах або видаленнях на іншому девайсі на льоту!
            try {
                if (this._realtimeChannel) {
                    supabase.removeChannel(this._realtimeChannel);
                }

                this._realtimeChannel = supabase
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
                        console.log('[CloudSync] ⚡ Realtime change detected from cloud:', payload.eventType, payload);

                        // Якщо це подія ВИДАЛЕННЯ (DELETE)
                        if (payload.eventType === 'DELETE' && payload.old && payload.old.id) {
                            const deletedId = payload.old.id;
                            locallyDeletedNoteIds.add(deletedId);
                            
                            // Якщо прямо зараз користувач перетягує цю нотатку — відкладаємо до кінця драгу
                            if (window.App.state && window.App.state.isDraggingNote && window.App.state.draggedNoteId === deletedId) {
                                _pendingPullAfterDrag = true;
                                return;
                            }

                            // Якщо нотатка все ще є у локальному стані (прийшло з іншого пристрою) — видаляємо її
                            const state = window.App.state;
                            if (state.notes.some(n => n.id === deletedId)) {
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
                            const lastEdit = lastLocalEditTimestamps.get(payload.new.id);
                            if (lastEdit && (Date.now() - lastEdit < 3500)) {
                                return;
                            }
                        }

                        // Якщо користувач прямо зараз перетягує нотатку - відкладаємо pull до завершення драгу
                        if (window.App.state && window.App.state.isDraggingNote) {
                            _pendingPullAfterDrag = true;
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
                            this.pullFromCloud();
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

            // Автоматичне відновлення зв'язку при поверненні інтернету
            window.addEventListener('online', () => {
                console.log('[CloudSync] Network reconnected, syncing with cloud...');
                this.pullFromCloud();
            });

            // Гарантуємо відправку незбережених змін перед закриттям вкладки або згортанням браузера
            const flushOnExit = () => {
                this.flushPendingNotes();
                this.flushPendingReorders();
            };

            window.addEventListener('beforeunload', flushOnExit);
            window.addEventListener('pagehide', flushOnExit);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    flushOnExit();
                }
            });
        },

        getCurrentUser() {
            return currentUser;
        },

        isLoggedIn() {
            return !!currentUser;
        },

        async handleAuthChange(user) {
            const wasLoggedIn = !!currentUser;
            const isSameUser = currentUser && user && currentUser.id === user.id;
            currentUser = user;
            this.updateAuthUI(user);

            if (user) {
                if (isSameUser) {
                    return;
                }
                console.log('[CloudSync] Logged in as:', user.email);
                // Завантажуємо та об'єднуємо нотатки з хмари
                await this.pullFromCloud();
                // Запускаємо фоновий збирач сміття для звільнення пам'яті в Storage
                setTimeout(() => this.cleanupOrphanedImages(), 2000);
            } else {
                console.log('[CloudSync] Logged out / Guest mode');
                // Якщо користувач щойно вийшов з акаунта — повністю очищаємо локальний стан, кеш та медіа
                if (wasLoggedIn) {
                    const state = window.App.state;
                    state.boards = [];
                    state.notes = [];
                    state.readOnlyBoards = [];
                    state.readOnlyNotes = [];
                    state.activeBoardId = null;
                    state.activeChain = [null];
                    state.expandedSidebarNoteIds.clear();
                    state.selectedSidebarNoteIds.clear();
                    state.selectedWorkspaceNoteIds.clear();
                    state.isWorkspaceSelectMode = false;

                    if (window.App.storage) {
                        window.App.storage.clearAll();
                    }
                    if (window.App.imageDb) {
                        await window.App.imageDb.clearAll();
                    }
                    if (window.App.historyManager) {
                        window.App.historyManager.reset(true);
                    }

                    if (window.App.sidebarView) {
                        window.App.sidebarView.render();
                    }
                    if (window.App.workspaceView) {
                        window.App.workspaceView.render();
                    }
                }
            }
        },

        // 1. Завантаження нотаток та блокнотів з Supabase у локальний стан
        async pullFromCloud() {
            if (!currentUser || !window.App.supabase) return;
            const supabase = window.App.supabase;
            const state = window.App.state;

            // Якщо прямо зараз триває перетягування нотатки — відкладаємо pull до завершення
            if (state && state.isDraggingNote) {
                _pendingPullAfterDrag = true;
                return;
            }

            // Якщо інший запит pullFromCloud вже в процесі — плануємо перезапуск після завершення
            if (isPullingFromCloud) {
                _rePullNeeded = true;
                return;
            }

            isPullingFromCloud = true;

            try {
                // Отримуємо найсвіжіші дані користувача з сервера
                const { data: freshUserResp } = await supabase.auth.getUser();
                if (freshUserResp && freshUserResp.user) {
                    currentUser = freshUserResp.user;
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
                        await this.syncBoards();
                    }
                }

                // 2. Синхронізація спільних блокнотів читача з таблиці `user_shared_tokens` (з fallback до user_metadata)
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
                        await this.syncSharedTokens(legacyTokens);
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

                    if (loadedSharedBoards.length > 0) {
                        state.readOnlyBoards = loadedSharedBoards;
                        state.readOnlyNotes = loadedSharedNotes;
                        window.App.storage.saveReadOnlyBoards(state.readOnlyBoards);
                        window.App.storage.saveReadOnlyNotes(state.readOnlyNotes);
                    }
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
                    const offlineQueue = getOfflineQueue();
                    const pendingUpsertIds = new Set(offlineQueue.filter(i => i.type === 'upsert_note').map(i => i.id));
                    const pendingDeleteIds = new Set(offlineQueue.filter(i => i.type === 'delete_note').map(i => i.id));

                    // Відкидаємо нотатки, які були видалені локально
                    const validCloudNotes = cloudNotes.filter(n => !locallyDeletedNoteIds.has(n.id) && !pendingDeleteIds.has(n.id));

                    const formattedNotes = validCloudNotes.map(n => {
                        const localNote = localMap.get(n.id);
                        const resolvedBoardId = n.board_id || (localNote ? localNote.boardId : null) || firstBoardId;

                        if (!n.board_id && resolvedBoardId) {
                            supabase.from('notes').update({ board_id: resolvedBoardId }).eq('id', n.id);
                        }

                        const cloudUpdatedAt = n.updated_at ? new Date(n.updated_at).getTime() : 0;
                        const hasPendingSync = (this._pendingSyncNotesMap && this._pendingSyncNotesMap.has(n.id)) || pendingUpsertIds.has(n.id);
                        const isLocalNewer = localNote && localNote.updatedAt && (localNote.updatedAt > cloudUpdatedAt);

                        if (localNote && (hasPendingSync || isLocalNewer)) {
                            // Локальна версія новіша або містить несинхронізовані зміни — зберігаємо її
                            queueOfflineAction({ type: 'upsert_note', id: localNote.id });
                            return { ...localNote, boardId: resolvedBoardId };
                        }

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
                            orderIndex: typeof n.order_index === 'number' ? n.order_index : 0,
                            gridCol: localNote && localNote.gridCol ? localNote.gridCol : undefined,
                            createdAt: new Date(n.created_at).getTime() || Date.now(),
                            updatedAt: cloudUpdatedAt || Date.now()
                        };
                    });

                    // Зберігаємо локальні нотатки, яких ще немає в хмарі (офлайн створення)
                    const cloudIds = new Set(cloudNotes.map(n => n.id));
                    state.notes.forEach(localNote => {
                        if (!cloudIds.has(localNote.id) && !locallyDeletedNoteIds.has(localNote.id) && !pendingDeleteIds.has(localNote.id)) {
                            console.log('[CloudSync] 💾 Preserving offline-created note:', localNote.id);
                            formattedNotes.push(localNote);
                            queueOfflineAction({ type: 'upsert_note', id: localNote.id });
                        }
                    });

                    // Якщо під час запиту користувач почав перетягувати нотатку — відкладаємо застосування
                    if (state && state.isDraggingNote) {
                        console.log('[CloudSync] Notes pulled during drag, deferring update...');
                        _deferredPulledNotes = formattedNotes;
                        return;
                    }

                    // Зберігаємо актуальний стан
                    state.notes = formattedNotes;
                    window.App.storage.saveNotes(state.notes, true);

                    if (window.App.welcomeView) window.App.welcomeView.hide();
                    if (window.App.sidebarView) window.App.sidebarView.render();
                    if (window.App.workspaceView) window.App.workspaceView.render();

                    // Вивантажуємо фото з IndexedDB, якщо є локальні
                    await this.uploadMissingLocalImages();

                    // Миттєво синхронізуємо накопичені офлайн-зміни з хмарою
                    this.flushOfflineQueue();
                } else {
                    // Якщо в хмарі пусто, але локально є нотатки (офлайн створення) — вивантажуємо їх у хмару
                    if (state.notes.length > 0) {
                        console.log('[CloudSync] Pushing local notes to empty cloud...');
                        await this.pushAllToCloud();
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
                isPullingFromCloud = false;
                if (_rePullNeeded) {
                    _rePullNeeded = false;
                    clearTimeout(pullDebounceTimer);
                    pullDebounceTimer = setTimeout(() => {
                        this.pullFromCloud();
                    }, 200);
                }
            }
        },

        // 2.1 Синхронізація списку блокнотів у таблицю `boards` (замість user_metadata)
        async syncBoards() {
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

        // 2.2 Видалення блокнота з хмарної таблиці `boards`
        async deleteBoardFromCloud(boardId) {
            if (!boardId) return;
            queueOfflineAction({ type: 'delete_board', id: boardId });
            if (!currentUser || !window.App.supabase) return;
            try {
                const { error } = await window.App.supabase
                    .from('boards')
                    .delete()
                    .eq('id', boardId);

                if (error) {
                    console.warn('[CloudSync] deleteBoardFromCloud error:', error.message);
                } else {
                    removeOfflineAction(boardId, 'delete_board');
                    console.log(`[CloudSync] ⚡ Board "${boardId}" deleted from cloud database.`);
                }
            } catch (e) {
                console.warn('[CloudSync] deleteBoardFromCloud exception:', e);
            }
        },

        // 2.3 Синхронізація списку створених користувачем тегів для конкретного блокнота в таблицю `boards`
        async syncTagOptions(boardId = null) {
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

        // 2.4 Синхронізація підключених спільних блокнотів у таблицю `user_shared_tokens`
        async syncSharedTokens(tokensToSync = null) {
            if (!currentUser || !window.App.supabase) return;
            const state = window.App.state;
            try {
                const tokens = tokensToSync || (state.readOnlyBoards || [])
                    .map(b => b.shareToken)
                    .filter(Boolean);

                // Очищаємо старі токени користувача та вставляємо актуальні
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
            } catch (e) {
                console.warn('[CloudSync] syncSharedTokens error:', e);
            }
        },

        // Вивантаження фото з IndexedDB у Supabase Storage для всіх нотаток, де ще немає url
        async uploadMissingLocalImages() {
            if (!currentUser || !window.App.supabase || !window.App.imageDb) return;
            const state = window.App.state;
            let uploadedCount = 0;

            for (const note of state.notes) {
                if (Array.isArray(note.images) && note.images.length > 0) {
                    let noteUpdated = false;
                    for (const img of note.images) {
                        if (!img.url) {
                            try {
                                const base64 = await window.App.imageDb.getImage(img.id);
                                if (base64) {
                                    console.log('[CloudSync] Uploading local image to cloud:', img.id);
                                    const cloudUrl = await this.uploadBase64Image(base64, img.id);
                                    if (cloudUrl) {
                                        img.url = cloudUrl;
                                        noteUpdated = true;
                                        uploadedCount++;
                                    }
                                }
                            } catch (err) {
                                console.warn('[CloudSync] Error uploading local image:', img.id, err);
                            }
                        }
                    }
                    if (noteUpdated) {
                        await this._pushNoteToCloud(note);
                    }
                }
            }

            if (uploadedCount > 0) {
                console.log(`[CloudSync] Successfully uploaded ${uploadedCount} images to Supabase Storage!`);
                window.App.storage.saveNotes(state.notes, true);
                if (window.App.workspaceView) window.App.workspaceView.render();
            }
        },

        // 2. Відправка нотатки в хмару (пакетна черга Map для кількох нотаток одночасно)
        syncNote(note) {
            if (!note) return;

            // Завжди фіксуємо в персистентній офлайн-черзі
            queueOfflineAction({ type: 'upsert_note', id: note.id });

            if (!currentUser || !window.App.supabase) return;

            lastLocalEditTimestamps.set(note.id, Date.now());
            
            if (!this._pendingSyncNotesMap) {
                this._pendingSyncNotesMap = new Map();
            }
            this._pendingSyncNotesMap.set(note.id, note);

            clearTimeout(syncDebounceTimer);
            syncDebounceTimer = setTimeout(async () => {
                await this.flushPendingNotes();
            }, 300);
        },

        // 2.2 Дебаунс синхронізації зміни порядку карток при Drag & Drop
        syncReorderNotes(notes) {
            if (!notes || notes.length === 0) return;

            notes.forEach(note => {
                queueOfflineAction({ type: 'upsert_note', id: note.id });
            });

            if (!currentUser || !window.App.supabase) return;

            const now = Date.now();
            notes.forEach(note => {
                lastLocalEditTimestamps.set(note.id, now);
                _pendingReorderNotesMap.set(note.id, note);
            });

            clearTimeout(reorderDebounceTimer);
            reorderDebounceTimer = setTimeout(async () => {
                await this.flushPendingReorders();
            }, 400);
        },

        async flushPendingReorders() {
            if (!_pendingReorderNotesMap || _pendingReorderNotesMap.size === 0) return;

            const notesToPush = Array.from(_pendingReorderNotesMap.values());
            _pendingReorderNotesMap.clear();
            clearTimeout(reorderDebounceTimer);
            reorderDebounceTimer = null;

            const now = Date.now();
            notesToPush.forEach(n => lastLocalEditTimestamps.set(n.id, now));

            await this._pushMultipleNotesToCloud(notesToPush);
        },

        async flushPendingNotes() {
            if (!this._pendingSyncNotesMap || this._pendingSyncNotesMap.size === 0) return;

            const notesToPush = Array.from(this._pendingSyncNotesMap.values());
            this._pendingSyncNotesMap.clear();
            clearTimeout(syncDebounceTimer);
            syncDebounceTimer = null;

            const now = Date.now();
            notesToPush.forEach(n => lastLocalEditTimestamps.set(n.id, now));

            if (notesToPush.length === 1) {
                await this._pushNoteToCloud(notesToPush[0]);
            } else {
                await this._pushMultipleNotesToCloud(notesToPush);
            }
        },

        async _pushMultipleNotesToCloud(notes) {
            const supabase = window.App.supabase;
            if (!supabase || !currentUser || !notes || notes.length === 0) return;
            const state = window.App.state;

            // Захист від ехо: штампуємо актуальний час для всіх нотаток у пакеті
            const now = Date.now();
            notes.forEach(n => lastLocalEditTimestamps.set(n.id, now));

            const payloads = notes.map(note => {
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
                    console.log(`[CloudSync] ⚡ Successfully batch synced ${notes.length} notes to cloud.`);
                    notes.forEach(n => removeOfflineAction(n.id, 'upsert_note'));
                }
            } catch (err) {
                console.warn('[CloudSync] Bulk upsert exception:', err);
            }
        },

        async _pushNoteToCloud(note) {
            const supabase = window.App.supabase;
            if (!supabase || !currentUser || !note) return;
            const state = window.App.state;

            lastLocalEditTimestamps.set(note.id, Date.now());

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
                    removeOfflineAction(note.id, 'upsert_note');
                }
            } catch (err) {
                console.warn('[CloudSync] Upsert exception:', err);
            }
        },

        // 3. Видалення нотаток з хмари (пакетне або поодиноке)
        async deleteNoteFromCloud(noteId) {
            if (!noteId) return;
            persistDeletedId(noteId);
            removeOfflineAction(noteId, 'upsert_note');
            queueOfflineAction({ type: 'delete_note', id: noteId });

            if (this._pendingSyncNotesMap) this._pendingSyncNotesMap.delete(noteId);

            if (!currentUser || !window.App.supabase) return;
            const supabase = window.App.supabase;

            try {
                const { error } = await supabase.from('notes').delete().eq('id', noteId);
                if (!error) {
                    removeOfflineAction(noteId, 'delete_note');
                }
            } catch (err) {
                console.warn('[CloudSync] Delete exception:', err);
            }
        },

        async deleteNotesFromCloud(noteIds) {
            if (!noteIds || noteIds.length === 0) return;
            noteIds.forEach(id => {
                persistDeletedId(id);
                removeOfflineAction(id, 'upsert_note');
                queueOfflineAction({ type: 'delete_note', id });
                if (this._pendingSyncNotesMap) this._pendingSyncNotesMap.delete(id);
            });

            if (!currentUser || !window.App.supabase) return;
            const supabase = window.App.supabase;

            try {
                const { error } = await supabase.from('notes').delete().in('id', noteIds);
                if (!error) {
                    noteIds.forEach(id => removeOfflineAction(id, 'delete_note'));
                }
                console.log(`[CloudSync] 🗑️ Batch deleted ${noteIds.length} notes from cloud.`);
            } catch (err) {
                console.warn('[CloudSync] Batch delete exception:', err);
            }
        },

        // Обробка накопиченої черги дій при відновленні зв'язку
        async flushOfflineQueue() {
            if (!currentUser || !window.App.supabase || !navigator.onLine) return;
            const queue = getOfflineQueue();
            if (!queue || queue.length === 0) return;

            console.log(`[CloudSync] 🔄 Flushing offline queue (${queue.length} items)...`);
            const state = window.App.state;

            const deleteNoteIds = queue.filter(i => i.type === 'delete_note').map(i => i.id);
            const deleteBoardIds = queue.filter(i => i.type === 'delete_board').map(i => i.id);
            const upsertNoteIds = new Set(queue.filter(i => i.type === 'upsert_note').map(i => i.id));

            // 1. Видалення накопичених нотаток
            if (deleteNoteIds.length > 0) {
                try {
                    const { error } = await window.App.supabase.from('notes').delete().in('id', deleteNoteIds);
                    if (!error) {
                        deleteNoteIds.forEach(id => removeOfflineAction(id, 'delete_note'));
                        console.log(`[CloudSync] ⚡ Successfully flushed ${deleteNoteIds.length} offline note deletes.`);
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
                            removeOfflineAction(bId, 'delete_board');
                            console.log(`[CloudSync] ⚡ Successfully flushed offline delete for board "${bId}".`);
                        }
                    }
                } catch (e) {
                    console.warn('[CloudSync] Error flushing delete boards queue:', e);
                }
            }

            // 3. Відправка накопичених оновлень/створень нотаток
            if (upsertNoteIds.size > 0 && state && state.notes) {
                const notesToPush = state.notes.filter(n => upsertNoteIds.has(n.id));
                if (notesToPush.length > 0) {
                    await this._pushMultipleNotesToCloud(notesToPush);
                }
            }
        },

        // 4. Вивантаження всіх локальних нотаток (первинна міграція з фотографіями)
        async pushAllToCloud() {
            if (!currentUser || !window.App.supabase) return;
            const state = window.App.state;
            const supabase = window.App.supabase;

            // Якщо є фото, що живуть локально в IndexedDB — вивантажуємо їх у Supabase Storage
            for (const note of state.notes) {
                if (Array.isArray(note.images) && note.images.length > 0) {
                    for (const img of note.images) {
                        if (!img.url && window.App.imageDb) {
                            try {
                                const base64 = await window.App.imageDb.getImage(img.id);
                                if (base64) {
                                    const cloudUrl = await this.uploadBase64Image(base64, img.id);
                                    if (cloudUrl) {
                                        img.url = cloudUrl;
                                    }
                                }
                            } catch (e) {
                                console.warn('[CloudSync] Image migration failed for:', img.id, e);
                            }
                        }
                    }
                }
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
            payloads.forEach(p => lastLocalEditTimestamps.set(p.id, now));

            try {
                const { error } = await supabase.from('notes').upsert(payloads, { onConflict: 'id' });
                if (error) console.warn('[CloudSync] Bulk push error:', error.message);
                else {
                    console.log('[CloudSync] Synced all local notes & images to cloud');
                    window.App.storage.saveNotes(state.notes, true);
                }
            } catch (err) {
                console.warn('[CloudSync] Bulk push exception:', err);
            }
        },

        // 4.5 Конвертація та завантаження Base64 у Supabase Storage
        async uploadBase64Image(base64Data, imgId) {
            const supabase = window.App.supabase;
            if (!supabase || !currentUser || !base64Data) return null;

            try {
                const res = await fetch(base64Data);
                const blob = await res.blob();
                const filePath = `${currentUser.id}/${imgId}.jpg`;

                const { error } = await supabase.storage
                    .from('note-images')
                    .upload(filePath, blob, {
                        contentType: 'image/jpeg',
                        upsert: true
                    });

                if (error) {
                    console.warn('[CloudSync] Base64 upload error:', error.message);
                    return null;
                }

                const { data: publicUrlData } = supabase.storage
                    .from('note-images')
                    .getPublicUrl(filePath);

                return publicUrlData ? publicUrlData.publicUrl : null;
            } catch (err) {
                console.warn('[CloudSync] Base64 upload exception:', err);
                return null;
            }
        },

        // 5. Завантаження фотографії в Supabase Storage Bucket
        async uploadImageFile(file, imgId) {
            const supabase = window.App.supabase;
            if (!supabase || !currentUser) return null;

            try {
                const fileExt = file.name ? file.name.split('.').pop() : 'jpg';
                const filePath = `${currentUser.id}/${imgId}.${fileExt}`;

                const { data, error } = await supabase.storage
                    .from('note-images')
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (error) {
                    console.warn('[CloudSync] Storage upload error:', error.message);
                    return null;
                }

                // Отримуємо публічне посилання
                const { data: publicUrlData } = supabase.storage
                    .from('note-images')
                    .getPublicUrl(filePath);

                return publicUrlData ? publicUrlData.publicUrl : null;
            } catch (err) {
                console.warn('[CloudSync] Storage upload exception:', err);
                return null;
            }
        },

        // 6. Миттєве видалення одного фото зі сховища Supabase Storage
        async deleteImageFile(imgId) {
            const supabase = window.App.supabase;
            if (!supabase || !currentUser || !imgId) return;

            try {
                const filePathJpg = `${currentUser.id}/${imgId}.jpg`;
                const filePathPng = `${currentUser.id}/${imgId}.png`;
                await supabase.storage.from('note-images').remove([filePathJpg, filePathPng]);
                console.log('[CloudSync] Deleted image file from Storage:', imgId);
            } catch (err) {
                console.warn('[CloudSync] Storage delete error:', err);
            }
        },

        // 7. Збирач сміття (Garbage Collector): видаляє з Storage всі фото, яких немає в жодній нотатці
        async cleanupOrphanedImages() {
            const supabase = window.App.supabase;
            if (!supabase || !currentUser) return;
            const state = window.App.state;

            try {
                // 1. Отримуємо список усіх файлів користувача в Storage
                const { data: files, error } = await supabase.storage
                    .from('note-images')
                    .list(currentUser.id, { limit: 500 });

                if (error || !files || files.length === 0) return;

                // 2. Збираємо список усіх актуальних ID картинок з активних нотаток
                const activeImageIds = new Set();
                state.notes.forEach(note => {
                    if (Array.isArray(note.images)) {
                        note.images.forEach(im => {
                            if (im && im.id) activeImageIds.add(im.id);
                        });
                    }
                });

                // 3. Знаходимо файли-сироти
                const orphanedPaths = [];
                files.forEach(file => {
                    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                    if (!activeImageIds.has(nameWithoutExt) && nameWithoutExt !== '.emptyFolderPlaceholder') {
                        orphanedPaths.push(`${currentUser.id}/${file.name}`);
                    }
                });

                // 4. Перманентно видаляємо застарілі файли
                if (orphanedPaths.length > 0) {
                    console.log(`[CloudSync Garbage Collector] Cleaning up ${orphanedPaths.length} orphaned images from storage...`);
                    await supabase.storage.from('note-images').remove(orphanedPaths);
                }
            } catch (err) {
                console.warn('[CloudSync] Cleanup orphaned images exception:', err);
            }
        },

        // Оновлення інтерфейсу профілю в бічній панелі
        updateAuthUI(user) {
            let profileCard = document.getElementById('sidebar-user-profile');
            const sidebar = document.querySelector('.sidebar');
            if (!sidebar) return;

            if (!profileCard) {
                profileCard = document.createElement('div');
                profileCard.id = 'sidebar-user-profile';
                profileCard.className = 'sidebar-user-profile';
                sidebar.appendChild(profileCard);
            }

            if (user) {
                const nickname = (user.user_metadata && (user.user_metadata.username || user.user_metadata.nickname || user.user_metadata.display_name)) || user.email.split('@')[0];
                const initial = nickname.charAt(0).toUpperCase();

                profileCard.innerHTML = `
                    <div class="user-profile-clickable" id="user-profile-info-click" title="Налаштування сайту">
                        <div class="user-avatar">${initial}</div>
                        <div class="user-info">
                            <div class="user-email" title="${user.email}">${nickname}</div>
                            <div class="user-status-badge">Зберігається в хмарі</div>
                        </div>
                    </div>
                    <div class="user-profile-actions">
                        <button class="user-action-btn user-settings-btn" id="sidebar-settings-btn" title="Налаштування сайту">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                        <button class="user-action-btn user-logout-btn" id="user-logout-btn" title="Вийти з акаунта (${user.email})">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                        </button>
                    </div>
                `;

                const clickWrap = profileCard.querySelector('#user-profile-info-click');
                if (clickWrap) {
                    clickWrap.addEventListener('click', () => {
                        if (window.App.settingsModal) window.App.settingsModal.open();
                    });
                }

                const settingsBtn = profileCard.querySelector('#sidebar-settings-btn');
                if (settingsBtn) {
                    settingsBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (window.App.settingsModal) window.App.settingsModal.open();
                    });
                }

                profileCard.querySelector('#user-logout-btn').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await window.App.supabase.auth.signOut();
                });
            } else {
                profileCard.innerHTML = `
                    <button class="sidebar-login-btn" id="sidebar-login-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                            <polyline points="10 17 15 12 10 7"></polyline>
                            <line x1="15" y1="12" x2="3" y2="12"></line>
                        </svg>
                        <span>Увійти / Реєстрація</span>
                    </button>
                    <button class="sidebar-settings-guest-btn" id="sidebar-settings-btn" title="Налаштування сайту">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                `;

                profileCard.querySelector('#sidebar-login-btn').addEventListener('click', () => {
                    if (window.App.authModal) {
                        window.App.authModal.open();
                    }
                });

                const settingsBtn = profileCard.querySelector('#sidebar-settings-btn');
                if (settingsBtn) {
                    settingsBtn.addEventListener('click', () => {
                        if (window.App.settingsModal) {
                            window.App.settingsModal.open();
                        }
                    });
                }
            }
        },

        // Викликається після завершення перетягування картки (pointerup) для безпечного застосування відкладених оновлень
        onDragEnd() {
            const state = window.App.state;
            if (_deferredPulledNotes) {
                const notesToApply = _deferredPulledNotes;
                _deferredPulledNotes = null;
                _pendingPullAfterDrag = false;
                if (state) {
                    state.notes = notesToApply;
                    window.App.storage.saveNotes(state.notes, true);
                }
                if (window.App.sidebarView) window.App.sidebarView.render();
                if (window.App.workspaceView) window.App.workspaceView.render();
            } else if (_pendingPullAfterDrag) {
                _pendingPullAfterDrag = false;
                clearTimeout(pullDebounceTimer);
                pullDebounceTimer = setTimeout(() => {
                    this.pullFromCloud();
                }, 150);
            }
        }
    };
})();
