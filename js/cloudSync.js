// js/cloudSync.js - Модуль двосторонньої синхронізації між клієнтом та Supabase
window.App = window.App || {};

(function() {
    let currentUser = null;
    let syncDebounceTimer = null;
    let isSyncing = false;
    let lastLocalEditTimestamps = new Map(); // id -> timestamp

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

            // ⚡ Realtime-синхронізація: миттєве оновлення при змінах або видаленнях на іншому девайсі на льоту!
            try {
                if (this._realtimeChannel) {
                    supabase.removeChannel(this._realtimeChannel);
                }

                this._realtimeChannel = supabase
                    .channel('notes-realtime-channel')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, (payload) => {
                        console.log('[CloudSync] ⚡ Realtime change detected from cloud:', payload.eventType, payload);

                        // Якщо зміна стосується нотатки, яку щойно редагували на цьому ж пристрої (менше 2.5 сек тому) - ігноруємо власне "відлуння"
                        if (payload.new && payload.new.id) {
                            const lastEdit = lastLocalEditTimestamps.get(payload.new.id);
                            if (lastEdit && (Date.now() - lastEdit < 2500)) {
                                return;
                            }
                        }

                        // Якщо користувач прямо зараз тримає фокус і друкує в якійсь нотатці - не робимо агресивний повний рендер
                        const activeEl = document.activeElement;
                        const isTyping = activeEl && (activeEl.classList.contains('sticker-content') || activeEl.classList.contains('sticker-title'));
                        if (isTyping && payload.new && activeEl.closest(`[data-note-id="${payload.new.id}"]`)) {
                            return; // Не перебиваємо активний ввід користувача
                        }

                        this.pullFromCloud();
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
                // Запускаємо фоновий збирач сміття для звільнення пам'яті в Storage
                setTimeout(() => this.cleanupOrphanedImages(), 2000);
            } else {
                console.log('[CloudSync] Guest mode (local storage)');
            }
        },

        // 1. Завантаження нотаток та блокнотів з Supabase у локальний стан
        async pullFromCloud() {
            if (!currentUser || !window.App.supabase) return;
            const supabase = window.App.supabase;
            const state = window.App.state;

            try {
                // Отримуємо найсвіжіші дані користувача з сервера (user_metadata)
                const { data: freshUserResp } = await supabase.auth.getUser();
                if (freshUserResp && freshUserResp.user) {
                    currentUser = freshUserResp.user;
                }

                const savedBoards = currentUser?.user_metadata?.boards;
                if (Array.isArray(savedBoards) && savedBoards.length > 0) {
                    state.boards = savedBoards;
                    window.App.storage.saveBoards(state.boards);
                    if (!state.activeBoardId || !state.boards.find(b => b.id === state.activeBoardId)) {
                        state.activeBoardId = state.boards[0].id;
                        window.App.storage.saveActiveBoardId(state.activeBoardId);
                    }
                } else if (state.boards.length > 0) {
                    // Якщо в хмарі ще немає збережених блокнотів — вивантажуємо поточні оригінальні блокноти
                    await this.syncBoards();
                }

                // Синхронізація доступних варіантів тегів
                const savedTagOptions = currentUser?.user_metadata?.board_tag_options;
                if (savedTagOptions && typeof savedTagOptions === 'object') {
                    localStorage.setItem('minimal_board_tag_options', JSON.stringify(savedTagOptions));
                }

                const { data: cloudNotes, error } = await supabase
                    .from('notes')
                    .select('*')
                    .order('order_index', { ascending: true });

                if (error) {
                    console.error('[CloudSync] Error pulling notes:', error);
                    return;
                }

                if (cloudNotes && cloudNotes.length > 0) {
                    const firstBoardId = (state.boards && state.boards[0]) ? state.boards[0].id : null;
                    const localMap = new Map(state.notes.map(n => [n.id, n]));
                    const notesToPushBack = [];

                    const formattedNotes = cloudNotes.map(n => {
                        const localNote = localMap.get(n.id);
                        const resolvedBoardId = n.board_id || (localNote ? localNote.boardId : null) || firstBoardId;

                        if (!n.board_id && resolvedBoardId) {
                            supabase.from('notes').update({ board_id: resolvedBoardId }).eq('id', n.id);
                        }

                        const cloudUpdatedAt = n.updated_at ? new Date(n.updated_at).getTime() : 0;
                        const localUpdatedAt = localNote && localNote.updatedAt ? localNote.updatedAt : 0;

                        // Якщо локальна версія новіша за хмарну (редагували в офлайні) — зберігаємо локальну і ставимо в чергу на вивантаження
                        if (localNote && localUpdatedAt > (cloudUpdatedAt + 500)) {
                            notesToPushBack.push(localNote);
                            return localNote;
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
                            createdAt: new Date(n.created_at).getTime() || Date.now(),
                            updatedAt: cloudUpdatedAt || Date.now()
                        };
                    });

                    // Якщо локально були створені нові нотатки, яких ще взагалі немає в хмарі
                    const cloudIds = new Set(cloudNotes.map(n => n.id));
                    state.notes.forEach(localNote => {
                        if (!cloudIds.has(localNote.id)) {
                            formattedNotes.push(localNote);
                            notesToPushBack.push(localNote);
                        }
                    });

                    // Зберігаємо актуальний об'єднаний стан
                    state.notes = formattedNotes;
                    window.App.storage.saveNotes(state.notes, true);

                    if (window.App.welcomeView) window.App.welcomeView.hide();
                    if (window.App.sidebarView) window.App.sidebarView.render();
                    if (window.App.workspaceView) window.App.workspaceView.render();

                    // Якщо були офлайн-правки — вивантажуємо їх у хмару
                    if (notesToPushBack.length > 0) {
                        console.log(`[CloudSync] 🔄 Syncing ${notesToPushBack.length} newer offline edits back to cloud...`);
                        notesToPushBack.forEach(note => this.syncNote(note));
                    }

                    // Вивантажуємо фото з IndexedDB, якщо є локальні
                    await this.uploadMissingLocalImages();
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
            }
        },

        // Синхронізація списку блокнотів у метадані користувача
        async syncBoards() {
            if (!currentUser || !window.App.supabase) return;
            const state = window.App.state;
            try {
                const { data, error } = await window.App.supabase.auth.updateUser({
                    data: {
                        boards: state.boards
                    }
                });
                if (data && data.user) {
                    currentUser = data.user;
                }
            } catch (e) {
                console.warn('[CloudSync] syncBoards error:', e);
            }
        },

        // Синхронізація списку створених користувачем тегів
        async syncTagOptions() {
            if (!currentUser || !window.App.supabase) return;
            try {
                const allBoardsTags = JSON.parse(localStorage.getItem('minimal_board_tag_options')) || {};
                const { data, error } = await window.App.supabase.auth.updateUser({
                    data: {
                        board_tag_options: allBoardsTags
                    }
                });
                if (data && data.user) {
                    currentUser = data.user;
                }
            } catch (e) {
                console.warn('[CloudSync] syncTagOptions error:', e);
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

        // 2. Відправка однієї нотатки в хмару (з дебаунсом 600мс)
        syncNote(note) {
            if (!currentUser || !window.App.supabase || !note) return;

            lastLocalEditTimestamps.set(note.id, Date.now());
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
            const state = window.App.state;

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
