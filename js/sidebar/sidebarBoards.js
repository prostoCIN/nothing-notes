// js/sidebar/sidebarBoards.js - Модуль відображення та керування блокнотами у сайдбарі
window.App = window.App || {};

(function() {
    window.App.sidebarBoards = {
        /**
         * Прив'язує події інлайн-форми створення нового блокнота
         */
        bindNewBoardForm() {
            const els = window.App.getElements();
            if (!els.sidebarAddBoardBtn || !els.sidebarNewBoardForm || !els.sidebarNewBoardInput) return;

            els.sidebarAddBoardBtn.addEventListener('click', () => {
                if (els.sidebarNewBoardForm.style.display === 'none' || !els.sidebarNewBoardForm.style.display) {
                    els.sidebarNewBoardForm.style.display = 'block';
                    els.sidebarNewBoardInput.value = '';
                    els.sidebarNewBoardInput.focus();
                } else {
                    els.sidebarNewBoardForm.style.display = 'none';
                }
            });

            els.sidebarNewBoardInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const name = els.sidebarNewBoardInput.value.trim();
                    if (name && window.App.boardManager) {
                        window.App.boardManager.createBoard(name);
                        els.sidebarNewBoardForm.style.display = 'none';
                        els.sidebarNewBoardInput.value = '';
                    }
                } else if (e.key === 'Escape') {
                    els.sidebarNewBoardForm.style.display = 'none';
                    els.sidebarNewBoardInput.value = '';
                }
            });

            els.sidebarNewBoardInput.addEventListener('blur', () => {
                const name = els.sidebarNewBoardInput.value.trim();
                if (name && window.App.boardManager) {
                    window.App.boardManager.createBoard(name);
                }
                els.sidebarNewBoardForm.style.display = 'none';
                els.sidebarNewBoardInput.value = '';
            });
        },

        /**
         * Рендерить список власних блокнотів користувача
         */
        renderBoardsList() {
            const els = window.App.getElements();
            const state = window.App.state;
            if (!els.sidebarBoardsList) return;
            els.sidebarBoardsList.innerHTML = '';

            const boards = state && state.boards ? state.boards : [];

            boards.forEach(board => {
                const li = document.createElement('li');
                li.className = `board-item ${board.id === state.activeBoardId ? 'active' : ''}`;
                li.dataset.boardId = board.id;

                const nameSpan = document.createElement('span');
                nameSpan.className = 'board-item-name';

                const textSpan = document.createElement('span');
                textSpan.className = 'board-item-text';
                textSpan.textContent = board.name;
                textSpan.title = 'Подвійний клік для редагування назви';

                const finishEditing = () => {
                    if (textSpan.contentEditable === 'true') {
                        textSpan.contentEditable = 'false';
                        li.classList.remove('is-editing');
                        textSpan.scrollLeft = 0;
                        document.removeEventListener('pointerdown', onOutsidePointerDown, true);
                        const newName = textSpan.innerText.trim();
                        if (newName && newName !== board.name && window.App.boardManager) {
                            window.App.boardManager.renameBoard(board.id, newName);
                        } else {
                            textSpan.innerText = board.name;
                        }
                    }
                };

                const onOutsidePointerDown = (evt) => {
                    if (!textSpan.contains(evt.target)) {
                        finishEditing();
                    }
                };

                const startEditing = () => {
                    li.classList.add('is-editing');
                    textSpan.contentEditable = 'true';
                    textSpan.focus();
                    const range = document.createRange();
                    range.selectNodeContents(textSpan);
                    const sel = window.getSelection();
                    if (sel) {
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }

                    setTimeout(() => {
                        document.addEventListener('pointerdown', onOutsidePointerDown, true);
                    }, 10);
                };

                textSpan.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    startEditing();
                });

                textSpan.addEventListener('blur', finishEditing);
                textSpan.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        textSpan.blur();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        document.removeEventListener('pointerdown', onOutsidePointerDown, true);
                        li.classList.remove('is-editing');
                        textSpan.scrollLeft = 0;
                        textSpan.innerText = board.name;
                        textSpan.contentEditable = 'false';
                    }
                });

                if (board.icon) {
                    const iconSpan = document.createElement('span');
                    iconSpan.className = 'board-item-icon';
                    iconSpan.textContent = board.icon;
                    nameSpan.appendChild(iconSpan);
                }

                nameSpan.appendChild(textSpan);

                // Лічильник загальної кількості нотаток у цьому блокноті
                let countBadge = null;
                const boardNoteCount = (state.notes || []).filter(n => n.boardId === board.id).length;
                if (boardNoteCount > 0) {
                    countBadge = document.createElement('span');
                    countBadge.className = 'sidebar-child-count';
                    countBadge.textContent = boardNoteCount;
                }

                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'board-actions';

                // 1. Поділитись блокнотом
                const shareBtn = document.createElement('button');
                shareBtn.className = 'board-share-btn';
                shareBtn.title = 'Поділитись блокнотом';
                shareBtn.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="18" cy="5" r="3"></circle>
                        <circle cx="6" cy="12" r="3"></circle>
                        <circle cx="18" cy="19" r="3"></circle>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                `;
                shareBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (window.App.shareManager) {
                        window.App.shareManager.showShareModal(board.id);
                    }
                });

                // 2. Перейменувати блокнот
                const editBtn = document.createElement('button');
                editBtn.className = 'board-edit-btn';
                editBtn.title = 'Перейменувати блокнот';
                editBtn.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                `;
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    startEditing();
                });

                // 3. Видалити блокнот
                const delBtn = document.createElement('button');
                delBtn.className = 'board-delete-btn';
                delBtn.title = 'Видалити блокнот';
                delBtn.innerHTML = `
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                `;
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (window.App.boardManager) {
                        window.App.boardManager.deleteBoard(board.id);
                    }
                });

                actionsDiv.appendChild(shareBtn);
                actionsDiv.appendChild(editBtn);
                actionsDiv.appendChild(delBtn);

                li.addEventListener('click', (e) => {
                    if (e.target.closest('.board-actions') || textSpan.contentEditable === 'true') return;
                    if (state.activeBoardId !== board.id && window.App.boardManager) {
                        window.App.boardManager.switchBoard(board.id);
                    }
                    if (window.innerWidth <= 768 && window.App.sidebarView && window.App.sidebarView.closeMobileSidebar) {
                        window.App.sidebarView.closeMobileSidebar();
                    }
                });

                li.appendChild(nameSpan);
                if (countBadge) li.appendChild(countBadge);
                li.appendChild(actionsDiv);
                els.sidebarBoardsList.appendChild(li);
            });

            this.renderSharedBoardsList();
        },

        /**
         * Рендерить список спільних (тільки для читання) блокнотів
         */
        renderSharedBoardsList() {
            const els = window.App.getElements();
            const state = window.App.state;
            if (!els.sharedBoardsSection || !els.sidebarSharedBoardsList) return;

            // Фільтруємо спільні блокноти: відсікаємо власні блокноти автора
            const ownBoardIds = new Set((state.boards || []).map(b => b.id));
            const readOnlyBoards = (state.readOnlyBoards || []).filter(b => {
                const origId = b.originalBoardId || (b.id && b.id.replace('shared_', ''));
                return !ownBoardIds.has(origId) && !ownBoardIds.has(b.id);
            });

            if (readOnlyBoards.length === 0) {
                els.sharedBoardsSection.style.display = 'none';
                els.sidebarSharedBoardsList.innerHTML = '';
                return;
            }

            els.sharedBoardsSection.style.display = 'flex';
            els.sidebarSharedBoardsList.innerHTML = '';

            readOnlyBoards.forEach(board => {
                const li = document.createElement('li');
                li.className = `board-item shared-board-item ${board.id === state.activeBoardId ? 'active' : ''}`;
                li.dataset.boardId = board.id;

                const nameSpan = document.createElement('span');
                nameSpan.className = 'board-item-name';

                const lockIcon = document.createElement('span');
                lockIcon.className = 'shared-board-lock-icon';
                lockIcon.title = 'Тільки для читання';
                lockIcon.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                `;
                nameSpan.appendChild(lockIcon);

                if (board.icon) {
                    const iconSpan = document.createElement('span');
                    iconSpan.className = 'board-item-icon';
                    iconSpan.textContent = board.icon;
                    nameSpan.appendChild(iconSpan);
                }

                const textSpan = document.createElement('span');
                textSpan.className = 'board-item-text';
                textSpan.textContent = board.name;
                nameSpan.appendChild(textSpan);

                // Лічильник нотаток у розшареній дошці
                const readOnlyNotes = state.readOnlyNotes || [];
                const boardNoteCount = readOnlyNotes.filter(n => n.boardId === board.id).length;
                let countBadge = null;
                if (boardNoteCount > 0) {
                    countBadge = document.createElement('span');
                    countBadge.className = 'sidebar-child-count';
                    countBadge.textContent = boardNoteCount;
                }

                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'board-actions';

                // Якщо автор дозволив копіювання — кнопка зберегти собі
                if (board.allowClone) {
                    const cloneBtn = document.createElement('button');
                    cloneBtn.className = 'board-clone-btn';
                    cloneBtn.title = 'Скопіювати до моїх блокнотів';
                    cloneBtn.innerHTML = `
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    `;
                    cloneBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (window.App.confirmModal) {
                            window.App.confirmModal.show({
                                title: 'Скопіювати блокнот?',
                                message: `Створити незалежну копію блокнота <span class="confirm-modal-highlight">"${board.name}"</span> у ваших особистих блокнотах?`,
                                confirmText: 'Затисніть для копіювання',
                                type: 'info',
                                onConfirm: async () => {
                                    if (window.App.shareManager) {
                                        await window.App.shareManager.cloneSharedBoardToMyNotes(board.id);
                                    }
                                }
                            });
                        }
                    });
                    actionsDiv.appendChild(cloneBtn);
                }

                const unlinkBtn = document.createElement('button');
                unlinkBtn.className = 'board-delete-btn';
                unlinkBtn.title = 'Прибрати зі списку';
                unlinkBtn.innerHTML = `
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                `;
                unlinkBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (window.App.confirmModal) {
                        window.App.confirmModal.show({
                            title: 'Прибрати спільний блокнот?',
                            message: `Прибрати <span class="confirm-modal-highlight">"${board.name}"</span> зі списку спільних для читання? (Оригінал автора не постраждає).`,
                            confirmText: 'Затисніть для видалення',
                            type: 'danger',
                            onConfirm: () => {
                                if (window.App.shareManager) {
                                    window.App.shareManager.removeSharedBoard(board.id);
                                }
                            }
                        });
                    }
                });

                actionsDiv.appendChild(unlinkBtn);

                li.addEventListener('click', (e) => {
                    if (e.target.closest('.board-actions')) return;
                    if (state.activeBoardId !== board.id && window.App.boardManager) {
                        window.App.boardManager.switchBoard(board.id);
                    }
                    if (window.innerWidth <= 768 && window.App.sidebarView && window.App.sidebarView.closeMobileSidebar) {
                        window.App.sidebarView.closeMobileSidebar();
                    }
                });

                li.appendChild(nameSpan);
                if (countBadge) li.appendChild(countBadge);
                li.appendChild(actionsDiv);
                els.sidebarSharedBoardsList.appendChild(li);
            });
        }
    };
})();
