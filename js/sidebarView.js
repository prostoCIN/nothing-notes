// js/sidebarView.js - Головний контролер бічної панелі (блокноти та дерево нотаток)
window.App = window.App || {};

(function() {
    let onSelectNoteCallback = null;

    window.App.sidebarView = {
        init(callbacks) {
            onSelectNoteCallback = callbacks.onSelectNote;
            this.bindEvents();
            if (window.App.sidebarSelection) {
                window.App.sidebarSelection.init();
            }
        },

        bindEvents() {
            const els = window.App.getElements();
            if (!els.sidebarAddBoardBtn) return;

            // Показ / приховування інлайн форми додавання блокнота
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
                    if (name) {
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
                if (name) {
                    window.App.boardManager.createBoard(name);
                }
                els.sidebarNewBoardForm.style.display = 'none';
                els.sidebarNewBoardInput.value = '';
            });

            // Відкриття та закриття мобільного сайдбару
            if (els.mobileMenuBtn) {
                els.mobileMenuBtn.addEventListener('click', () => this.openMobileSidebar());
            }
            if (els.sidebarCloseBtn) {
                els.sidebarCloseBtn.addEventListener('click', () => this.closeMobileSidebar());
            }
            if (els.sidebarOverlay) {
                els.sidebarOverlay.addEventListener('click', () => this.closeMobileSidebar());
            }

            // Додавання нотатки з сайдбару
            els.addNoteBtn.addEventListener('click', () => {
                window.App.noteManager.createNewNote(null, true);
                if (window.innerWidth <= 768) {
                    this.closeMobileSidebar();
                }
            });
        },

        openMobileSidebar() {
            const els = window.App.getElements();
            if (els.sidebar) els.sidebar.classList.add('mobile-open');
            if (els.sidebarOverlay) els.sidebarOverlay.classList.add('active');
            document.body.classList.add('mobile-sidebar-active');
        },

        closeMobileSidebar() {
            const els = window.App.getElements();
            if (els.sidebar) els.sidebar.classList.remove('mobile-open');
            if (els.sidebarOverlay) els.sidebarOverlay.classList.remove('active');
            document.body.classList.remove('mobile-sidebar-active');
        },

        render() {
            this.renderBoardsList();
            this.renderNotesList();
        },

        renderBoardsList() {
            const els = window.App.getElements();
            const state = window.App.state;
            if (!els.sidebarBoardsList) return;
            els.sidebarBoardsList.innerHTML = '';

            state.boards.forEach(board => {
                const li = document.createElement('li');
                li.className = `board-item ${board.id === state.activeBoardId ? 'active' : ''}`;
                li.dataset.boardId = board.id;

                const nameSpan = document.createElement('span');
                nameSpan.className = 'board-item-name';

                const iconSpan = document.createElement('span');
                iconSpan.className = 'board-item-icon';
                iconSpan.textContent = '🗒️';

                const textSpan = document.createElement('span');
                textSpan.className = 'board-item-text';
                textSpan.textContent = board.name;
                textSpan.title = 'Подвійний клік для редагування назви';

                const finishEditing = () => {
                    if (textSpan.contentEditable === 'true') {
                        textSpan.contentEditable = 'false';
                        li.classList.remove('is-editing');
                        textSpan.scrollLeft = 0; // Повертаємо текст на самий початок, щоб не було зміщення
                        document.removeEventListener('pointerdown', onOutsidePointerDown, true);
                        const newName = textSpan.innerText.trim();
                        if (newName && newName !== board.name) {
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
                    sel.removeAllRanges();
                    sel.addRange(range);

                    // Додаємо слухач кліку поза елементом для миттєвого збереження
                    setTimeout(() => {
                        document.addEventListener('pointerdown', onOutsidePointerDown, true);
                    }, 10);
                };

                // Інлайн-редагування назви блокнота по подвійному кліку
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

                nameSpan.appendChild(iconSpan);
                nameSpan.appendChild(textSpan);

                // Лічильник загальної кількості нотаток у цій дошці
                let countBadge = null;
                const boardNoteCount = state.notes.filter(n => n.boardId === board.id).length;
                if (boardNoteCount > 0) {
                    countBadge = document.createElement('span');
                    countBadge.className = 'sidebar-child-count';
                    countBadge.textContent = boardNoteCount;
                }

                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'board-actions';

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
                    window.App.boardManager.deleteBoard(board.id);
                });

                actionsDiv.appendChild(editBtn);
                actionsDiv.appendChild(delBtn);

                li.addEventListener('click', (e) => {
                    if (e.target.closest('.board-actions') || textSpan.contentEditable === 'true') return;
                    if (state.activeBoardId !== board.id) {
                        window.App.boardManager.switchBoard(board.id);
                    }
                    if (window.innerWidth <= 768) {
                        this.closeMobileSidebar();
                    }
                });

                li.appendChild(nameSpan);
                if (countBadge) li.appendChild(countBadge);
                li.appendChild(actionsDiv);
                els.sidebarBoardsList.appendChild(li);
            });
        },

        renderNotesList() {
            const els = window.App.getElements();
            if (!els.notesList) return;

            // Зберігаємо позиції елементів перед перерендером для плавної FLIP-анімації
            const prevRects = new Map();
            els.notesList.querySelectorAll('.note-item[data-id]').forEach(item => {
                prevRects.set(item.dataset.id, item.getBoundingClientRect());
            });

            els.notesList.innerHTML = '';

            // Викликаємо рендеринг дерева нотаток з модуля sidebarTree
            if (window.App.sidebarTree) {
                window.App.sidebarTree.renderLevel(null, els.notesList, 0, onSelectNoteCallback);
            }

            // Плавна анімація FLIP ковзання нотаток після перерендеру
            if (prevRects.size > 0) {
                els.notesList.querySelectorAll('.note-item[data-id]').forEach(item => {
                    const oldRect = prevRects.get(item.dataset.id);
                    if (!oldRect) return;
                    const newRect = item.getBoundingClientRect();
                    const dy = oldRect.top - newRect.top;

                    if (dy !== 0) {
                        item.style.transition = 'none';
                        item.style.transform = `translateY(${dy}px)`;
                        requestAnimationFrame(() => {
                            item.style.transition = 'transform 0.22s cubic-bezier(0.2, 0, 0, 1)';
                            item.style.transform = '';
                        });
                    }
                });
            }
        },

        updateNoteListItem(id, title, icon) {
            const row = document.querySelector(`.note-item[data-id="${id}"]`);
            if (row) {
                const titleSpan = row.querySelector('.note-item-title');
                if (titleSpan) titleSpan.textContent = title || 'Без назви';
                const iconSpan = row.querySelector('.note-item-icon');
                if (iconSpan) iconSpan.textContent = icon || '📄';
            }
        }
    };
})();
