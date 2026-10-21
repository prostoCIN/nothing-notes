// js/cloudSync.js - Головний фасад та координатор хмарної синхронізації Supabase
window.App = window.App || {};

(function() {
    let currentUser = null;

    window.App.cloudSync = {
        currentUser: null,
        isPullingFromCloud: false,
        _rePullNeeded: false,
        _pendingPullAfterDrag: false,
        _deferredPulledNotes: null,
        _pendingSyncNotesMap: new Map(),
        _pendingReorderNotesMap: new Map(),
        lastLocalEditTimestamps: new Map(),

        init() {
            if (!window.App.supabase) {
                if (window.App.supabaseConfig && window.App.supabaseConfig.initClient) {
                    window.App.supabaseConfig.initClient();
                }
            }

            // Відстежуємо повернення пристрою онлайн
            window.addEventListener('online', () => {
                console.log('[CloudSync] 🌐 Device is back online. Flushing offline queue & pulling latest changes...');
                this.flushOfflineQueue();
                this.pullFromCloud();
            });

            // Ініціалізуємо менеджер мульти-акаунтів
            if (window.App.accountManager) {
                window.App.accountManager.init();
            }

            // Оновлюємо стан профілю в сайдбарі
            this.updateAuthUI(currentUser);

            const supabase = window.App.supabase;
            if (!supabase) return;

            // Відстежуємо стан сесії користувача
            supabase.auth.getSession()
                .then(({ data: { session } }) => {
                    if (session && window.App.accountManager) {
                        window.App.accountManager.saveAccountFromSession(session);
                    }
                    this.handleAuthChange(session ? session.user : null);
                })
                .catch(err => {
                    console.warn('[CloudSync] getSession error:', err);
                    this.updateAuthUI(null);
                });

            supabase.auth.onAuthStateChange((event, session) => {
                if (session && window.App.accountManager) {
                    window.App.accountManager.saveAccountFromSession(session);
                }
                if (event === 'USER_UPDATED') {
                    if (session && session.user) {
                        currentUser = session.user;
                        this.currentUser = currentUser;
                        this.updateAuthUI(session.user);
                    }
                    return;
                }
                this.handleAuthChange(session ? session.user : null);
            });

            // ⚡ Realtime-підписка на таблиці
            if (window.App.syncRealtime) {
                window.App.syncRealtime.initChannel(supabase, this);
            }

            // Гарантуємо відправку незбережених змін перед закриттям вкладки
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
            return currentUser || this.currentUser;
        },

        isLoggedIn() {
            return !!(currentUser || this.currentUser);
        },

        async handleAuthChange(user) {
            const wasLoggedIn = !!currentUser;
            const isSameUser = currentUser && user && currentUser.id === user.id;

            if (wasLoggedIn && user && !isSameUser) {
                const state = window.App.state;
                if (state) {
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
                }
                if (window.App.storage) window.App.storage.clearAll();
                if (window.App.imageDb) await window.App.imageDb.clearAll();
                if (window.App.historyManager) window.App.historyManager.reset(true);
            }

            currentUser = user;
            this.currentUser = user;
            this.updateAuthUI(user);

            if (user) {
                if (isSameUser) return;
                console.log('[CloudSync] Logged in as:', user.email);
                await this.pullFromCloud();
                if (window.App.sidebarView) window.App.sidebarView.render();
                if (window.App.workspaceView) window.App.workspaceView.render();
                setTimeout(() => this.cleanupOrphanedImages(), 2000);
            } else {
                console.log('[CloudSync] Logged out / Guest mode');
                if (wasLoggedIn) {
                    const state = window.App.state;
                    if (state) {
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
                    }
                    if (window.App.storage) window.App.storage.clearAll();
                    if (window.App.imageDb) await window.App.imageDb.clearAll();
                    if (window.App.historyManager) window.App.historyManager.reset(true);
                    if (window.App.sidebarView) window.App.sidebarView.render();
                    if (window.App.workspaceView) window.App.workspaceView.render();
                }
            }
        },

        // Делегати до syncNotes
        async pullFromCloud() {
            if (window.App.syncNotes) return window.App.syncNotes.pullFromCloud(this);
        },

        syncNote(note, isNew = false) {
            if (window.App.syncNotes) return window.App.syncNotes.syncNote(note, isNew, this);
        },

        syncReorderNotes(notes) {
            if (window.App.syncNotes) return window.App.syncNotes.syncReorderNotes(notes, this);
        },

        async flushPendingReorders() {
            if (window.App.syncNotes) return window.App.syncNotes.flushPendingReorders(this);
        },

        async flushPendingNotes() {
            if (window.App.syncNotes) return window.App.syncNotes.flushPendingNotes(this);
        },

        async _pushNoteToCloud(note) {
            if (window.App.syncNotes) return window.App.syncNotes._pushNoteToCloud(note, this);
        },

        async _pushMultipleNotesToCloud(notes) {
            if (window.App.syncNotes) return window.App.syncNotes._pushMultipleNotesToCloud(notes, this);
        },

        async deleteNoteFromCloud(noteId) {
            if (window.App.syncNotes) return window.App.syncNotes.deleteNoteFromCloud(noteId, this);
        },

        async deleteNotesFromCloud(noteIds) {
            if (window.App.syncNotes) return window.App.syncNotes.deleteNotesFromCloud(noteIds, this);
        },

        async syncBoards() {
            if (window.App.syncNotes) return window.App.syncNotes.syncBoards(this);
        },

        async deleteBoardFromCloud(boardId) {
            if (window.App.syncNotes) return window.App.syncNotes.deleteBoardFromCloud(boardId, this);
        },

        async syncTagOptions(boardId = null) {
            if (window.App.syncNotes) return window.App.syncNotes.syncTagOptions(boardId, this);
        },

        async syncSharedTokens(tokensToSync = null) {
            if (window.App.syncNotes) return window.App.syncNotes.syncSharedTokens(tokensToSync, this);
        },

        async pushAllToCloud() {
            if (window.App.syncNotes) return window.App.syncNotes.pushAllToCloud(this);
        },

        // Делегати до offlineQueue
        async flushOfflineQueue() {
            if (window.App.offlineQueue) return window.App.offlineQueue.flushOfflineQueue();
        },

        // Делегати до syncStorage
        async uploadBase64Image(base64Data, imgId) {
            if (window.App.syncStorage) return window.App.syncStorage.uploadBase64Image(base64Data, imgId);
        },

        async uploadImageFile(file, imgId) {
            if (window.App.syncStorage) return window.App.syncStorage.uploadImageFile(file, imgId);
        },

        async deleteImageFile(imgId) {
            if (window.App.syncStorage) return window.App.syncStorage.deleteImageFile(imgId);
        },

        async cleanupOrphanedImages() {
            if (window.App.syncStorage) return window.App.syncStorage.cleanupOrphanedImages();
        },

        async uploadMissingLocalImages() {
            if (window.App.syncStorage) return window.App.syncStorage.uploadMissingLocalImages();
        },

        // Делегати до syncUI
        updateAuthUI(user) {
            if (window.App.syncUI) return window.App.syncUI.updateAuthUI(user);
        },

        onDragEnd() {
            if (window.App.syncUI) return window.App.syncUI.onDragEnd(this);
        }
    };
})();
