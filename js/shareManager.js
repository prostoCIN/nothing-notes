// js/shareManager.js - Модуль генерації посилань спільного доступу (шерингу) та підключення блокнотів/нотаток
window.App = window.App || {};

(function() {
    window.App.shareManager = {
        /**
         * Генерує або повертає активне посилання для блокнота чи виділених нотаток
         * @param {string} boardId - ID блокнота
         * @param {Array<string>|null} noteIds - ID нотаток (null для всього блокнота)
         * @param {boolean} allowClone - чи дозволено копіювати нотатки собі
         * @returns {Promise<Object>} - об'єкт { shareToken, shareUrl }
         */
        async createShareLink(boardId, noteIds = null, allowClone = false) {
            const supabase = window.App.supabase;
            if (!supabase) throw new Error('Supabase не підключено');

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Необхідно увійти в акаунт, щоб ділитися блокнотами');

            const state = window.App.state;
            const targetBoard = state.boards.find(b => b.id === boardId);
            const boardName = targetBoard ? targetBoard.name : 'Спільний блокнот';
            const boardIcon = targetBoard ? (targetBoard.icon || null) : null;

            // Генеруємо криптографічно безпечний або випадковий токен
            const shareToken = 'sh_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);

            const payload = {
                board_id: boardId,
                board_name: boardName,
                board_icon: boardIcon,
                note_ids: Array.isArray(noteIds) && noteIds.length > 0 ? noteIds : null,
                owner_id: user.id,
                owner_email: user.email || 'Користувач NothingNotes',
                share_token: shareToken,
                allow_clone: !!allowClone,
                is_active: true
            };

            const { data, error } = await supabase
                .from('board_shares')
                .insert(payload)
                .select()
                .single();

            if (error) {
                console.error('[ShareManager] Error creating share link:', error);
                throw error;
            }

            const origin = window.location.origin + window.location.pathname;
            const shareUrl = `${origin}?share_board=${shareToken}`;

            return {
                shareToken,
                shareUrl,
                data
            };
        },

        /**
         * Отримує інформацію про спільний блокнот за токеном
         * @param {string} shareToken
         * @returns {Promise<Object|null>}
         */
        async fetchShareInfo(shareToken) {
            const supabase = window.App.supabase;
            if (!supabase || !shareToken) return null;

            try {
                const { data: shareData, error: shareErr } = await supabase
                    .from('board_shares')
                    .select('*')
                    .eq('share_token', shareToken)
                    .eq('is_active', true)
                    .single();

                if (shareErr || !shareData) {
                    console.warn('[ShareManager] Share token not found or inactive:', shareErr);
                    return null;
                }

                // Завантажуємо нотатки для цього розшареного блокнота
                let query = supabase
                    .from('notes')
                    .select('*')
                    .eq('board_id', shareData.board_id);

                const { data: notesData, error: notesErr } = await query;

                if (notesErr) {
                    console.error('[ShareManager] Error fetching shared notes:', notesErr);
                }

                let finalNotes = notesData || [];

                // Якщо розшарено лише конкретні нотатки — фільтруємо їх та їхні піднотатки
                if (Array.isArray(shareData.note_ids) && shareData.note_ids.length > 0) {
                    const allowedSet = new Set(shareData.note_ids);
                    
                    // Рекурсивно додаємо дочірні нотатки
                    let addedMore = true;
                    while (addedMore) {
                        addedMore = false;
                        finalNotes.forEach(n => {
                            if (n.parent_id && allowedSet.has(n.parent_id) && !allowedSet.has(n.id)) {
                                allowedSet.add(n.id);
                                addedMore = true;
                            }
                        });
                    }

                    finalNotes = finalNotes.filter(n => allowedSet.has(n.id));
                }

                // Форматуємо нотатки під структуру нашого додатку
                const formattedNotes = finalNotes.map(n => ({
                    id: n.id,
                    boardId: 'shared_' + shareData.board_id,
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
                    createdAt: new Date(n.created_at).getTime() || Date.now(),
                    updatedAt: n.updated_at ? new Date(n.updated_at).getTime() : Date.now(),
                    isReadOnly: true
                }));

                return {
                    share: shareData,
                    board: {
                        id: 'shared_' + shareData.board_id,
                        originalBoardId: shareData.board_id,
                        name: shareData.board_name,
                        icon: shareData.board_icon,
                        ownerEmail: shareData.owner_email,
                        allowClone: !!shareData.allow_clone,
                        shareToken: shareData.share_token,
                        isReadOnly: true
                    },
                    notes: formattedNotes
                };
            } catch (e) {
                console.error('[ShareManager] Fetch share info exception:', e);
                return null;
            }
        },

        /**
         * Додає отриманий спільний блокнот до списку користувача
         */
        addSharedBoardToState(sharedBoard, notes) {
            const state = window.App.state;
            const storage = window.App.storage;

            // Зберігаємо в окремий масив state.readOnlyBoards
            state.readOnlyBoards = state.readOnlyBoards || storage.getReadOnlyBoards();

            const existingIdx = state.readOnlyBoards.findIndex(b => b.id === sharedBoard.id);
            if (existingIdx !== -1) {
                state.readOnlyBoards[existingIdx] = sharedBoard;
            } else {
                state.readOnlyBoards.push(sharedBoard);
            }

            storage.saveReadOnlyBoards(state.readOnlyBoards);

            // Додаємо / оновлюємо нотатки цього розшареного блокнота в локальний стан state.readOnlyNotes
            state.readOnlyNotes = state.readOnlyNotes || storage.getReadOnlyNotes();
            
            // Видаляємо старі нотатки цього блокнота, якщо були
            state.readOnlyNotes = state.readOnlyNotes.filter(n => n.boardId !== sharedBoard.id);
            state.readOnlyNotes.push(...notes);

            storage.saveReadOnlyNotes(state.readOnlyNotes);

            // Перемикаємося на цей доданий блокнот
            state.activeBoardId = sharedBoard.id;
            storage.saveActiveBoardId(sharedBoard.id);

            // Оновлюємо інтерфейс
            if (window.App.sidebarView) window.App.sidebarView.render();
            if (window.App.workspaceView) window.App.workspaceView.render();
        },

        /**
         * Видаляє спільний блокнот зі списку читача
         */
        removeSharedBoard(sharedBoardId) {
            const state = window.App.state;
            const storage = window.App.storage;

            state.readOnlyBoards = (state.readOnlyBoards || storage.getReadOnlyBoards()).filter(b => b.id !== sharedBoardId);
            storage.saveReadOnlyBoards(state.readOnlyBoards);

            state.readOnlyNotes = (state.readOnlyNotes || storage.getReadOnlyNotes()).filter(n => n.boardId !== sharedBoardId);
            storage.saveReadOnlyNotes(state.readOnlyNotes);

            // Якщо був відкритий цей блокнот — перемикаємо на перший власний блокнот
            if (state.activeBoardId === sharedBoardId) {
                state.activeBoardId = state.boards.length > 0 ? state.boards[0].id : null;
                storage.saveActiveBoardId(state.activeBoardId);
            }

            if (window.App.sidebarView) window.App.sidebarView.render();
            if (window.App.workspaceView) window.App.workspaceView.render();
        },

        /**
         * Копіює (дублює) спільний блокнот у власні редаговані блокноти
         */
        async cloneSharedBoardToMyNotes(sharedBoardId) {
            const state = window.App.state;
            const noteManager = window.App.noteManager;
            const boardManager = window.App.boardManager;

            const readOnlyBoards = state.readOnlyBoards || window.App.storage.getReadOnlyBoards();
            const targetBoard = readOnlyBoards.find(b => b.id === sharedBoardId);
            if (!targetBoard) return;

            const readOnlyNotes = state.readOnlyNotes || window.App.storage.getReadOnlyNotes();
            const boardNotes = readOnlyNotes.filter(n => n.boardId === sharedBoardId);

            // 1. Створюємо новий повноцінний блокнот
            const newBoardId = 'board_' + Date.now().toString() + '_' + Math.random().toString(36).substring(2, 5);
            const newBoard = {
                id: newBoardId,
                name: targetBoard.name + ' (Копія)',
                icon: targetBoard.icon || null
            };

            state.boards.push(newBoard);
            window.App.storage.saveBoards(state.boards);

            // 2. Копіюємо нотатки з новими ID та збереженням зв'язків батько-дитина
            const idMap = new Map();
            const now = Date.now();

            boardNotes.forEach(oldNote => {
                const newNoteId = 'note_' + Date.now().toString() + '_' + Math.random().toString(36).substring(2, 6);
                idMap.set(oldNote.id, newNoteId);
            });

            const clonedNotes = boardNotes.map(oldNote => {
                const newId = idMap.get(oldNote.id);
                const newParentId = oldNote.parentId ? (idMap.get(oldNote.parentId) || null) : null;

                return {
                    id: newId,
                    boardId: newBoardId,
                    parentId: newParentId,
                    title: oldNote.title || '',
                    content: oldNote.content || '',
                    color: oldNote.color || 'yellow',
                    fontSize: oldNote.fontSize || 16,
                    icon: oldNote.icon || '',
                    images: Array.isArray(oldNote.images) ? JSON.parse(JSON.stringify(oldNote.images)) : [],
                    isCollapsed: !!oldNote.isCollapsed,
                    tags: Array.isArray(oldNote.tags) ? [...oldNote.tags] : [],
                    orderIndex: oldNote.orderIndex || 0,
                    createdAt: now,
                    updatedAt: now
                };
            });

            state.notes.push(...clonedNotes);
            window.App.storage.saveNotes(state.notes, true);

            // 3. Синхронізуємо новий блокнот з хмарою
            if (window.App.cloudSync) {
                window.App.cloudSync.syncBoards();
                clonedNotes.forEach(n => window.App.cloudSync.syncNote(n));
                if (window.App.cloudSync.flushPendingNotes) window.App.cloudSync.flushPendingNotes();
            }

            // Перемикаємось на новий створений блокнот
            state.activeBoardId = newBoardId;
            window.App.storage.saveActiveBoardId(newBoardId);

            if (window.App.sidebarView) window.App.sidebarView.render();
            if (window.App.workspaceView) window.App.workspaceView.render();

            return newBoard;
        },

        /**
         * Відображає модальне вікно шерингу блокнота або нотатки
         */
        showShareModal(boardId, noteIds = null) {
            const state = window.App.state;
            const targetBoard = state.boards.find(b => b.id === boardId);
            if (!targetBoard) return;

            const isSpecificNotes = Array.isArray(noteIds) && noteIds.length > 0;
            const titleText = isSpecificNotes 
                ? `Поділитись ${noteIds.length === 1 ? 'нотаткою' : 'виділеними нотатками'}` 
                : `Поділитись блокнотом "${targetBoard.name}"`;

            // Видаляємо старе модальне вікно, якщо було відкрите
            const existing = document.getElementById('share-modal-backdrop');
            if (existing) existing.remove();

            const modalEl = document.createElement('div');
            modalEl.id = 'share-modal-backdrop';
            modalEl.className = 'share-modal-backdrop';

            modalEl.innerHTML = `
                <div class="share-modal-card">
                    <div class="share-modal-header">
                        <div class="share-modal-title-wrap">
                            <span class="share-modal-icon">🔗</span>
                            <h3 class="share-modal-title">${titleText}</h3>
                        </div>
                        <button class="share-modal-close-btn" id="share-modal-close">×</button>
                    </div>

                    <div class="share-modal-body">
                        <p class="share-modal-desc">
                            ${isSpecificNotes 
                                ? 'Створіть захищене посилання для перегляду лише обраних нотаток. Інші нотатки блокнота залишаться приватними.' 
                                : 'Будь-хто з цим посиланням зможе додати ваш блокнот для перегляду без можливості його зміни.'}
                        </p>

                        <div class="share-modal-option-row">
                            <div class="share-option-info">
                                <span class="share-option-title">Дозволити копіювання</span>
                                <span class="share-option-hint">Дозволити іншим зберегти копію до своїх блокнотів</span>
                            </div>
                            <label class="share-toggle-switch">
                                <input type="checkbox" id="share-allow-clone-toggle">
                                <span class="share-toggle-slider"></span>
                            </label>
                        </div>

                        <div class="share-link-box" id="share-link-box">
                            <input type="text" class="share-link-input" id="share-link-input" readonly placeholder="Генерація посилання...">
                            <button class="share-copy-btn" id="share-copy-btn">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                <span>Скопіювати</span>
                            </button>
                        </div>

                        <div class="share-modal-status" id="share-modal-status"></div>
                    </div>
                </div>
            `;

            document.body.appendChild(modalEl);

            const closeBtn = modalEl.querySelector('#share-modal-close');
            const copyBtn = modalEl.querySelector('#share-copy-btn');
            const linkInput = modalEl.querySelector('#share-link-input');
            const cloneToggle = modalEl.querySelector('#share-allow-clone-toggle');
            const statusEl = modalEl.querySelector('#share-modal-status');

            const closeModal = () => modalEl.remove();
            closeBtn.addEventListener('click', closeModal);
            modalEl.addEventListener('click', (e) => {
                if (e.target === modalEl) closeModal();
            });

            // Генеруємо посилання
            let currentShareUrl = '';

            const generateLink = async () => {
                linkInput.value = 'Створення безпечного посилання...';
                copyBtn.disabled = true;
                statusEl.textContent = '';

                try {
                    const allowClone = cloneToggle.checked;
                    const res = await this.createShareLink(boardId, noteIds, allowClone);
                    currentShareUrl = res.shareUrl;
                    linkInput.value = currentShareUrl;
                    copyBtn.disabled = false;
                } catch (err) {
                    linkInput.value = 'Помилка генерації';
                    statusEl.textContent = err.message || 'Не вдалося створити посилання. Перевірте авторизацію.';
                    statusEl.className = 'share-modal-status error';
                }
            };

            cloneToggle.addEventListener('change', generateLink);
            generateLink();

            // Копіювання в буфер обміну
            copyBtn.addEventListener('click', async () => {
                if (!currentShareUrl) return;

                try {
                    await navigator.clipboard.writeText(currentShareUrl);
                    copyBtn.classList.add('copied');
                    copyBtn.innerHTML = `
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <span>Скопійовано!</span>
                    `;
                    statusEl.textContent = '✅ Посилання скопійовано в буфер обміну!';
                    statusEl.className = 'share-modal-status success';

                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        copyBtn.innerHTML = `
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            <span>Скопіювати</span>
                        `;
                    }, 2500);
                } catch (e) {
                    linkInput.select();
                    document.execCommand('copy');
                }
            });
        }
    };
})();
