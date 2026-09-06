// js/workspace/workspaceColumn.js - Модуль побудови окремої колонки мультиколонкового простору
window.App = window.App || {};

(function() {
    window.App.workspaceColumn = {
        /**
         * Створює повний DOM-елемент колонки (board-column)
         * @param {Object} options
         * @param {number} options.colIndex - Індекс колонки (0 - коренева)
         * @param {string|null} options.parentNoteId - ID батьківської нотатки або null
         * @param {Object} options.currentBoard - Активний блокнот
         * @param {boolean} options.isBoardReadOnly - Чи відкритий блокнот тільки для читання
         * @param {Function} options.onCloseColumn - Колбек закриття колонки
         * @param {Function} options.onLayoutChange - Колбек зміни розмітки (list / grid)
         * @param {Function} options.onFilterChange - Колбек зміни фільтрації тегів
         * @returns {HTMLElement} - DOM-елемент .board-column
         */
        createColumn(options) {
            const {
                colIndex,
                parentNoteId,
                currentBoard,
                isBoardReadOnly,
                onCloseColumn,
                onLayoutChange,
                onFilterChange
            } = options;

            const state = window.App.state;
            const noteManager = window.App.noteManager;

            const columnEl = document.createElement('div');
            columnEl.className = `board-column ${colIndex > 0 ? 'child-column' : 'root-column'}`;
            columnEl.dataset.colIndex = colIndex;
            columnEl.dataset.parentId = parentNoteId || 'root';

            let allColNotes = noteManager ? noteManager.getNotesForColumn(parentNoteId) : [];

            // Застосовуємо фільтр тегів для цієї колонки
            const parentKey = parentNoteId || 'root';
            const currentColumnFilter = (state && state.activeTagFilters && state.activeTagFilters.get(parentKey)) || new Set();

            let colNotes = allColNotes;
            if (currentColumnFilter.size > 0 && noteManager) {
                colNotes = allColNotes.filter(note => {
                    const noteTags = noteManager.getNoteTags(note);
                    return [...currentColumnFilter].every(t => noteTags.includes(t));
                });
            }

            const totalNoteCount = allColNotes.length;

            // 1. Хедер колонки
            const header = document.createElement('div');
            header.className = 'column-header';

            const titleWrap = document.createElement('div');
            titleWrap.className = 'column-title-wrap';

            const titleH2 = document.createElement('h2');
            titleH2.className = 'column-title';

            if (colIndex === 0) {
                let boardIconPicker;
                if (window.App.emojiPicker) {
                    boardIconPicker = window.App.emojiPicker.createEmojiPicker(
                        { icon: currentBoard.icon || null },
                        (newEmoji) => {
                            if (window.App.boardManager) {
                                window.App.boardManager.updateBoardIcon(currentBoard.id, newEmoji);
                            }
                        },
                        () => {
                            if (window.App.boardManager) {
                                window.App.boardManager.updateBoardIcon(currentBoard.id, null);
                            }
                        }
                    );
                    boardIconPicker.classList.add('column-header-emoji-picker');
                } else {
                    boardIconPicker = document.createElement('span');
                    boardIconPicker.className = 'column-header-icon';
                    boardIconPicker.textContent = currentBoard.icon || '📋';
                }

                titleH2.textContent = currentBoard.name || '';

                if (!isBoardReadOnly) {
                    titleH2.contentEditable = 'true';
                    titleH2.classList.add('editable-board-title');
                    titleH2.title = 'Натисніть для редагування назви блокнота';
                    titleH2.spellcheck = false;
                    titleH2.autocapitalize = 'off';
                    titleH2.autocomplete = 'off';

                    let originalBoardName = currentBoard.name || '';
                    titleH2.addEventListener('focus', () => {
                        originalBoardName = titleH2.textContent.trim();
                    });

                    titleH2.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            titleH2.blur();
                        } else if (e.key === 'Escape') {
                            e.preventDefault();
                            titleH2.textContent = originalBoardName || currentBoard.name || 'Мій блокнот';
                            titleH2.blur();
                        }
                    });

                    titleH2.addEventListener('paste', (e) => {
                        e.preventDefault();
                        const text = (e.clipboardData || window.clipboardData)?.getData('text/plain') || '';
                        const clean = text.replace(/\r?\n|\r/g, ' ').trim();
                        if (clean && document.queryCommandSupported && document.queryCommandSupported('insertText')) {
                            document.execCommand('insertText', false, clean);
                        } else {
                            titleH2.textContent = clean;
                        }
                    });

                    titleH2.addEventListener('blur', () => {
                        const newName = titleH2.textContent.replace(/\r?\n|\r/g, ' ').trim();
                        if (newName && newName !== currentBoard.name) {
                            originalBoardName = newName;
                            if (window.App.boardManager) {
                                window.App.boardManager.renameBoard(currentBoard.id, newName);
                            }
                        } else if (!newName) {
                            titleH2.textContent = originalBoardName || currentBoard.name || 'Мій блокнот';
                        }
                    });
                }

                const badgeSpan = document.createElement('span');
                badgeSpan.className = 'column-count-badge';
                badgeSpan.textContent = totalNoteCount;

                titleWrap.appendChild(boardIconPicker);
                titleWrap.appendChild(titleH2);

                if (!isBoardReadOnly) {
                    const editHint = document.createElement('span');
                    editHint.className = 'column-title-edit-hint';
                    editHint.title = 'Редагувати назву блокнота';
                    editHint.innerHTML = `
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                    `;
                    editHint.addEventListener('click', (e) => {
                        e.stopPropagation();
                        titleH2.focus();
                        const sel = window.getSelection();
                        if (sel) {
                            const range = document.createRange();
                            range.selectNodeContents(titleH2);
                            sel.removeAllRanges();
                            sel.addRange(range);
                        }
                    });
                    titleWrap.appendChild(editHint);
                }

                titleWrap.appendChild(badgeSpan);
            } else {
                const parentNote = noteManager ? noteManager.getNoteById(parentNoteId) : null;
                const parentTitle = parentNote ? parentNote.title.trim() : 'Без назви';

                let noteIconPicker;
                if (parentNote && window.App.emojiPicker) {
                    noteIconPicker = window.App.emojiPicker.createEmojiPicker(
                        parentNote,
                        () => {
                            if (onLayoutChange) onLayoutChange();
                        }
                    );
                } else {
                    noteIconPicker = document.createElement('span');
                    noteIconPicker.className = 'column-header-icon';
                    noteIconPicker.textContent = (parentNote && parentNote.icon) || '📄';
                }
                noteIconPicker.classList.add('column-header-emoji-picker');

                titleH2.textContent = parentTitle || 'Без назви';

                if (!isBoardReadOnly && parentNote) {
                    titleH2.contentEditable = 'true';
                    titleH2.classList.add('editable-board-title');
                    titleH2.title = 'Натисніть для редагування назви нотатки';
                    titleH2.spellcheck = false;
                    titleH2.autocapitalize = 'off';
                    titleH2.autocomplete = 'off';

                    let originalNoteTitle = parentTitle || '';
                    titleH2.addEventListener('focus', () => {
                        originalNoteTitle = titleH2.textContent.trim();
                    });

                    titleH2.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            titleH2.blur();
                        } else if (e.key === 'Escape') {
                            e.preventDefault();
                            titleH2.textContent = originalNoteTitle || parentNote.title || 'Без назви';
                            titleH2.blur();
                        }
                    });

                    titleH2.addEventListener('paste', (e) => {
                        e.preventDefault();
                        const text = (e.clipboardData || window.clipboardData)?.getData('text/plain') || '';
                        const clean = text.replace(/\r?\n|\r/g, ' ').trim();
                        if (clean && document.queryCommandSupported && document.queryCommandSupported('insertText')) {
                            document.execCommand('insertText', false, clean);
                        } else {
                            titleH2.textContent = clean;
                        }
                        titleH2.dispatchEvent(new Event('input', { bubbles: true }));
                    });

                    titleH2.addEventListener('input', () => {
                        const newTitle = titleH2.textContent.replace(/\r?\n|\r/g, ' ');
                        if (noteManager && noteManager.updateNote) {
                            noteManager.updateNote(parentNoteId, { title: newTitle.trim() });
                        }
                    });

                    titleH2.addEventListener('blur', () => {
                        const newTitle = titleH2.textContent.replace(/\r?\n|\r/g, ' ').trim();
                        if (!newTitle) {
                            titleH2.textContent = 'Без назви';
                        }
                        if (noteManager && noteManager.updateNote) {
                            noteManager.updateNote(parentNoteId, { title: newTitle });
                        }
                    });
                }

                const badgeSpan = document.createElement('span');
                badgeSpan.className = 'column-count-badge';
                badgeSpan.textContent = totalNoteCount;

                titleWrap.appendChild(noteIconPicker);
                titleWrap.appendChild(titleH2);

                if (!isBoardReadOnly && parentNote) {
                    const editHint = document.createElement('span');
                    editHint.className = 'column-title-edit-hint';
                    editHint.title = 'Редагувати назву нотатки';
                    editHint.innerHTML = `
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                    `;
                    editHint.addEventListener('click', (e) => {
                        e.stopPropagation();
                        titleH2.focus();
                        const sel = window.getSelection();
                        if (sel) {
                            const range = document.createRange();
                            range.selectNodeContents(titleH2);
                            sel.removeAllRanges();
                            sel.addRange(range);
                        }
                    });
                    titleWrap.appendChild(editHint);
                }

                titleWrap.appendChild(badgeSpan);
            }

            // Кнопка перемикання вигляду: Список (по порядку вниз) / Сітка 2 колонки (Pinterest Masonry)
            const currentLayout = (state && state.columnLayouts && state.columnLayouts[parentKey]) || 'list';
            const layoutToggleBtn = document.createElement('button');
            layoutToggleBtn.className = `column-layout-toggle-btn ${currentLayout === 'grid' ? 'active' : ''}`;
            layoutToggleBtn.title = currentLayout === 'grid' ? 'Перемкнути на звичайний список' : 'Перемкнути на сітку в 2 колонки (Pinterest)';
            
            layoutToggleBtn.innerHTML = currentLayout === 'grid' 
                ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                     <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
                     <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
                     <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
                     <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
                   </svg>`
                : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                     <line x1="8" y1="6" x2="21" y2="6"></line>
                     <line x1="8" y1="12" x2="21" y2="12"></line>
                     <line x1="8" y1="18" x2="21" y2="18"></line>
                     <line x1="3" y1="6" x2="3.01" y2="6"></line>
                     <line x1="3" y1="12" x2="3.01" y2="12"></line>
                     <line x1="3" y1="18" x2="3.01" y2="18"></line>
                   </svg>`;

            layoutToggleBtn.addEventListener('click', () => {
                const newLayout = ((state && state.columnLayouts && state.columnLayouts[parentKey]) || 'list') === 'grid' ? 'list' : 'grid';
                if (state) {
                    state.columnLayouts = state.columnLayouts || {};
                    state.columnLayouts[parentKey] = newLayout;
                    if (window.App.storage && window.App.storage.saveColumnLayouts) {
                        window.App.storage.saveColumnLayouts(state.columnLayouts);
                    }
                }
                if (onLayoutChange) onLayoutChange();
            });

            // Блок дій у шапці колонки праворуч (Actions: перемикач сітки, меню "три крапки", кнопка закриття)
            const actionsWrap = document.createElement('div');
            actionsWrap.className = 'column-header-actions';

            actionsWrap.appendChild(layoutToggleBtn);

            // Тулбар-меню "три крапки" (з фільтрами, перейменуванням та поширенням)
            if (window.App.columnMenu) {
                const columnMenuWrap = window.App.columnMenu.createMenu({
                    colIndex,
                    parentNoteId,
                    currentBoard,
                    titleElement: titleH2,
                    currentColumnFilter,
                    onFilterChange: () => {
                        if (onFilterChange) onFilterChange();
                    }
                });
                actionsWrap.appendChild(columnMenuWrap);
            }

            // Кнопка закриття для прив'язаних колонок
            if (colIndex > 0) {
                const closeBtn = document.createElement('button');
                closeBtn.className = 'column-close-btn';
                closeBtn.title = 'Закрити цю колонку';
                closeBtn.innerHTML = '×';
                closeBtn.addEventListener('click', () => {
                    if (onCloseColumn) onCloseColumn(colIndex);
                });
                actionsWrap.appendChild(closeBtn);
            }

            header.appendChild(titleWrap);
            header.appendChild(actionsWrap);

            columnEl.appendChild(header);

            // 2. Список нотаток у колонці
            const notesScrollList = document.createElement('div');
            notesScrollList.className = `column-notes-list ${currentLayout === 'grid' ? 'layout-grid' : 'layout-list'}`;

            if (colNotes.length === 0) {
                const emptyState = document.createElement('div');
                emptyState.className = 'column-empty-state';
                emptyState.innerHTML = `
                    <div class="column-empty-icon">${colIndex === 0 ? '📝' : '🔗'}</div>
                    <div class="column-empty-text">
                        ${colIndex === 0 ? 'У цьому блокноті ще немає нотаток' : 'До цієї нотатки ще не прив\'язано жодної піднотатки'}
                    </div>
                `;

                if (!isBoardReadOnly && noteManager) {
                    const createFirstBtn = document.createElement('button');
                    createFirstBtn.className = 'btn-create-first-note';
                    createFirstBtn.innerHTML = `<span class="btn-plus-icon">+</span> ${colIndex === 0 ? 'Створити першу нотатку' : 'Додати першу піднотатку'}`;
                    createFirstBtn.addEventListener('click', () => noteManager.createNewNote(parentNoteId, true));
                    emptyState.appendChild(createFirstBtn);
                }

                notesScrollList.appendChild(emptyState);
            } else {
                if (currentLayout === 'grid') {
                    // Створюємо 2 колонки (ліва та права) для Pinterest Masonry сітки
                    const gridWrapper = document.createElement('div');
                    gridWrapper.className = 'masonry-grid-wrapper';

                    const colLeft = document.createElement('div');
                    colLeft.className = 'masonry-column masonry-column-left';

                    const colRight = document.createElement('div');
                    colRight.className = 'masonry-column masonry-column-right';

                    colNotes.forEach((note, idx) => {
                        if (window.App.stickerCard) {
                            const sticker = window.App.stickerCard.createCard(note, colIndex);
                            const targetCol = note.gridCol ? note.gridCol : (idx % 2 === 0 ? 'left' : 'right');
                            if (targetCol === 'left') {
                                colLeft.appendChild(sticker);
                            } else {
                                colRight.appendChild(sticker);
                            }
                        }
                    });

                    gridWrapper.appendChild(colLeft);
                    gridWrapper.appendChild(colRight);
                    notesScrollList.appendChild(gridWrapper);
                } else {
                    colNotes.forEach(note => {
                        if (window.App.stickerCard) {
                            const sticker = window.App.stickerCard.createCard(note, colIndex);
                            notesScrollList.appendChild(sticker);
                        }
                    });
                }

                // Кнопка додавання внизу колонки (тільки для власних блокнотів)
                if (!isBoardReadOnly && noteManager) {
                    const bottomBtnContainer = document.createElement('div');
                    bottomBtnContainer.className = 'add-note-bottom-container';

                    const addBtn = document.createElement('button');
                    addBtn.className = 'bottom-add-note-btn';
                    addBtn.innerHTML = `<span class="btn-plus-icon">+</span> Додати ${colIndex === 0 ? 'нотатку' : 'піднотатку'}`;
                    addBtn.addEventListener('click', () => noteManager.createNewNote(parentNoteId, true));

                    bottomBtnContainer.appendChild(addBtn);
                    notesScrollList.appendChild(bottomBtnContainer);
                }
            }

            columnEl.appendChild(notesScrollList);

            return columnEl;
        }
    };
})();
