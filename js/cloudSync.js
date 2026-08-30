// js/cloudSync.js - Модуль двосторонньої синхронізації між клієнтом та Supabase
window.App = window.App || {};

(function() {
    let currentUser = null;
    let syncDebounceTimer = null;
    let isSyncing = false;

    window.App.cloudSync = {
        init() {
            if (!window.App.supabase) {
                if (window.App.supabaseConfig && window.App.supabaseConfig.initClient) {
                    window.App.supabaseConfig.initClient();
                }
            }

            const supabase = window.App.supabase;
            if (!supabase) return;

            // Відстежуємо стан сесії користувача
            supabase.auth.getSession().then(({ data: { session } }) => {
                this.handleAuthChange(session ? session.user : null);
            });

            supabase.auth.onAuthStateChange((_event, session) => {
                this.handleAuthChange(session ? session.user : null);
            });

            // Гарантуємо відправку незбережених змін перед закриттям вкладки або згортанням браузера
            const flushOnExit = () => {
                this.flushPendingNote();
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
            currentUser = user;
            this.updateAuthUI(user);

            if (user) {
                console.log('[CloudSync] Logged in as:', user.email);
                // Завантажуємо та об'єднуємо нотатки з хмари
                await this.pullFromCloud();
            } else {
                console.log('[CloudSync] Guest mode (local storage)');
            }
        },

        // 1. Завантаження нотаток з Supabase у локальний стан
        async pullFromCloud() {
            if (!currentUser || !window.App.supabase) return;
            const supabase = window.App.supabase;
            const state = window.App.state;

            try {
                const { data: cloudNotes, error } = await supabase
                    .from('notes')
                    .select('*')
                    .order('order_index', { ascending: true });

                if (error) {
                    console.error('[CloudSync] Error pulling notes:', error);
                    return;
                }

                if (cloudNotes && cloudNotes.length > 0) {
                    // Якщо в локальному сховищі пусто або користувач щойно увійшов з іншого девайсу — наповнюємо
                    const formattedNotes = cloudNotes.map(n => ({
                        id: n.id,
                        boardId: n.parent_id ? (state.notes.find(x => x.id === n.parent_id)?.boardId || state.activeBoardId) : state.activeBoardId,
                        parentId: n.parent_id || null,
                        title: n.title || '',
                        content: n.content || '',
                        color: n.color || 'yellow',
                        fontSize: n.font_size || 16,
                        icon: n.icon || '',
                        images: n.images || [],
                        isCollapsed: !!n.is_collapsed,
                        createdAt: new Date(n.created_at).getTime() || Date.now()
                    }));

                    // Об'єднуємо: якщо нотатки ще не було локально — додаємо
                    const localIds = new Set(state.notes.map(n => n.id));
                    let hasNew = false;
                    formattedNotes.forEach(fn => {
                        if (!localIds.has(fn.id)) {
                            state.notes.push(fn);
                            hasNew = true;
                        }
                    });

                    if (hasNew) {
                        window.App.storage.saveNotes(state.notes, true);
                        if (window.App.sidebarView) window.App.sidebarView.render();
                        if (window.App.workspaceView) window.App.workspaceView.render();
                    }
                } else if (state.notes.length > 0) {
                    // Якщо в хмарі пусто, а локально є нотатки — вивантажуємо первинні нотатки в хмару!
                    await this.pushAllToCloud();
                }
            } catch (err) {
                console.error('[CloudSync] Pull exception:', err);
            }
        },

        // 2. Відправка однієї нотатки в хмару (з дебаунсом 600мс)
        syncNote(note) {
            if (!currentUser || !window.App.supabase || !note) return;

            this._pendingSyncNote = note;

            clearTimeout(syncDebounceTimer);
            syncDebounceTimer = setTimeout(async () => {
                await this.flushPendingNote();
            }, 600);
        },

        async flushPendingNote() {
            if (this._pendingSyncNote) {
                const noteToPush = this._pendingSyncNote;
                this._pendingSyncNote = null;
                clearTimeout(syncDebounceTimer);
                syncDebounceTimer = null;
                await this._pushNoteToCloud(noteToPush);
            }
        },

        async _pushNoteToCloud(note) {
            const supabase = window.App.supabase;
            if (!supabase || !currentUser) return;

            const payload = {
                id: note.id,
                user_id: currentUser.id,
                parent_id: note.parentId || null,
                title: note.title || '',
                content: note.content || '',
                color: note.color || 'yellow',
                font_size: typeof note.fontSize === 'number' ? note.fontSize : 16,
                icon: note.icon || '',
                images: note.images || [],
                is_collapsed: !!note.isCollapsed,
                updated_at: new Date().toISOString()
            };

            try {
                const { error } = await supabase
                    .from('notes')
                    .upsert(payload, { onConflict: 'id' });

                if (error) {
                    console.warn('[CloudSync] Note upsert error:', error.message);
                }
            } catch (err) {
                console.warn('[CloudSync] Upsert exception:', err);
            }
        },

        // 3. Видалення нотатки з хмари
        async deleteNoteFromCloud(noteId) {
            if (!currentUser || !window.App.supabase || !noteId) return;
            const supabase = window.App.supabase;

            try {
                await supabase.from('notes').delete().eq('id', noteId);
            } catch (err) {
                console.warn('[CloudSync] Delete exception:', err);
            }
        },

        // 4. Вивантаження всіх локальних нотаток (первинна міграція)
        async pushAllToCloud() {
            if (!currentUser || !window.App.supabase) return;
            const state = window.App.state;
            const supabase = window.App.supabase;

            const payloads = state.notes.map((note, idx) => ({
                id: note.id,
                user_id: currentUser.id,
                parent_id: note.parentId || null,
                title: note.title || '',
                content: note.content || '',
                color: note.color || 'yellow',
                font_size: typeof note.fontSize === 'number' ? note.fontSize : 16,
                icon: note.icon || '',
                images: note.images || [],
                is_collapsed: !!note.isCollapsed,
                order_index: idx,
                updated_at: new Date().toISOString()
            }));

            if (payloads.length === 0) return;

            try {
                const { error } = await supabase.from('notes').upsert(payloads, { onConflict: 'id' });
                if (error) console.warn('[CloudSync] Bulk push error:', error.message);
                else console.log('[CloudSync] Synced all local notes to cloud');
            } catch (err) {
                console.warn('[CloudSync] Bulk push exception:', err);
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
                const nickname = (user.user_metadata && (user.user_metadata.nickname || user.user_metadata.display_name)) || user.email.split('@')[0];
                const initial = nickname.charAt(0).toUpperCase();

                profileCard.innerHTML = `
                    <div class="user-avatar">${initial}</div>
                    <div class="user-info">
                        <div class="user-email" title="${user.email}">${nickname}</div>
                        <div class="user-status-badge">Хмара підключена 🟢</div>
                    </div>
                    <button class="user-logout-btn" id="user-logout-btn" title="Вийти з акаунта (${user.email})">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                    </button>
                `;

                profileCard.querySelector('#user-logout-btn').addEventListener('click', async () => {
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
                `;

                profileCard.querySelector('#sidebar-login-btn').addEventListener('click', () => {
                    if (window.App.authModal) {
                        window.App.authModal.open();
                    }
                });
            }
        }
    };
})();
