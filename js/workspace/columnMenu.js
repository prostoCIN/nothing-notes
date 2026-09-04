// js/workspace/columnMenu.js - Модуль випадаючого тулбар-меню "три крапки" для шапки колонки
window.App = window.App || {};

(function() {
    window.App.columnMenu = {
        /**
         * Створює кнопку "три крапки" та випадаюче меню дій для шапки колонки
         * @param {Object} options
         * @param {number} options.colIndex - Індекс колонки (0 - корінь блокнота, >0 - піднотатка)
         * @param {string|null} options.parentNoteId - ID батьківської нотатки або null для кореня
         * @param {Object} options.currentBoard - Об'єкт активного блокнота
         * @param {HTMLElement} options.titleElement - DOM елемент заголовка колонки (h2)
         * @param {Set} options.currentColumnFilter - Активні фільтри тегів
         * @param {Function} options.onFilterChange - Коллбек для оновлення колонок
         * @returns {HTMLElement} - DOM елемент menuWrap
         */
        createMenu(options) {
            const {
                colIndex,
                parentNoteId,
                currentBoard,
                titleElement,
                currentColumnFilter,
                onFilterChange
            } = options;

            const state = window.App.state;
            const noteManager = window.App.noteManager;
            const boardManager = window.App.boardManager;
            const storage = window.App.storage;

            const parentKey = parentNoteId || 'root';
            const isRoot = colIndex === 0;
            const isReadOnly = !!(currentBoard && currentBoard.isReadOnly) || (state.activeBoardId && state.activeBoardId.startsWith('shared_'));

            const menuWrap = document.createElement('div');
            menuWrap.className = 'column-menu-wrap';

            const moreBtn = document.createElement('button');
            moreBtn.className = `column-more-btn ${currentColumnFilter.size > 0 ? 'has-active-filter' : ''}`;
            moreBtn.title = 'Опції колонки';
            moreBtn.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="5" r="2.2"></circle>
                    <circle cx="12" cy="12" r="2.2"></circle>
                    <circle cx="12" cy="19" r="2.2"></circle>
                </svg>
                ${currentColumnFilter.size > 0 ? '<span class="column-filter-active-dot"></span>' : ''}
            `;

            const dropdown = document.createElement('div');
            dropdown.className = 'column-menu-dropdown';

            const renderDropdownContent = () => {
                dropdown.innerHTML = '';

                // 1. Заголовок меню
                const headerInfo = document.createElement('div');
                headerInfo.className = 'column-menu-header-info';
                const colTitle = isRoot ? (currentBoard?.name || 'Блокнот') : (noteManager.getNoteById(parentNoteId)?.title?.trim() || 'Піднотатки');
                headerInfo.innerHTML = `
                    <div class="column-menu-header-title">
                        <span>${isRoot ? '📁' : '📄'}</span>
                        <span class="column-menu-header-text">${colTitle}</span>
                    </div>
                `;
                dropdown.appendChild(headerInfo);

                const divider1 = document.createElement('div');
                divider1.className = 'column-menu-divider';
                dropdown.appendChild(divider1);

                // 2. Дія: Поділитися (тільки якщо доступно)
                if (window.App.shareManager) {
                    const shareItem = document.createElement('div');
                    shareItem.className = 'column-menu-item';
                    shareItem.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="18" cy="5" r="3"></circle>
                            <circle cx="6" cy="12" r="3"></circle>
                            <circle cx="18" cy="19" r="3"></circle>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                        </svg>
                        <span>${isRoot ? 'Поділитись блокнотом' : 'Поділитись цією гілкою'}</span>
                    `;
                    shareItem.addEventListener('click', (e) => {
                        e.stopPropagation();
                        dropdown.classList.remove('active');
                        moreBtn.classList.remove('active');

                        if (isRoot) {
                            window.App.shareManager.showShareModal(currentBoard.id);
                        } else {
                            // Отримуємо цю батьківську нотатку та всі її дочірні
                            const noteIds = [parentNoteId, ...noteManager.getDescendantIds(parentNoteId)];
                            window.App.shareManager.showShareModal(currentBoard.id, noteIds);
                        }
                    });
                    dropdown.appendChild(shareItem);
                }

                // 3. Дія: Перейменувати назву (якщо не read-only)
                if (!isReadOnly) {
                    const renameItem = document.createElement('div');
                    renameItem.className = 'column-menu-item';
                    renameItem.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                        <span>Перейменувати</span>
                    `;
                    renameItem.addEventListener('click', (e) => {
                        e.stopPropagation();
                        dropdown.classList.remove('active');
                        moreBtn.classList.remove('active');

                        if (!titleElement) return;

                        if (isRoot) {
                            // Редагування назви блокнота інлайн прямо в заголовку колонки
                            titleElement.contentEditable = 'true';
                            titleElement.classList.add('editable-board-title');
                            titleElement.focus();

                            // Виділяємо весь текст для зручної заміни
                            const sel = window.getSelection();
                            const range = document.createRange();
                            range.selectNodeContents(titleElement);
                            sel.removeAllRanges();
                            sel.addRange(range);

                            const finishEditing = () => {
                                titleElement.contentEditable = 'false';
                                titleElement.classList.remove('editable-board-title');
                                const newName = titleElement.textContent.trim();
                                if (newName && newName !== currentBoard.name) {
                                    boardManager.renameBoard(currentBoard.id, newName);
                                } else {
                                    titleElement.textContent = currentBoard.name;
                                }
                            };

                            titleElement.addEventListener('blur', finishEditing, { once: true });
                            titleElement.addEventListener('keydown', (ke) => {
                                if (ke.key === 'Enter') {
                                    ke.preventDefault();
                                    titleElement.blur();
                                } else if (ke.key === 'Escape') {
                                    titleElement.textContent = currentBoard.name;
                                    titleElement.blur();
                                }
                            });
                        } else {
                            // Редагування назви батьківської нотатки інлайн
                            const parentNote = noteManager.getNoteById(parentNoteId);
                            if (!parentNote) return;

                            titleElement.contentEditable = 'true';
                            titleElement.classList.add('editable-board-title');
                            titleElement.focus();

                            const sel = window.getSelection();
                            const range = document.createRange();
                            range.selectNodeContents(titleElement);
                            sel.removeAllRanges();
                            sel.addRange(range);

                            const finishEditingNote = () => {
                                titleElement.contentEditable = 'false';
                                titleElement.classList.remove('editable-board-title');
                                const newTitle = titleElement.textContent.trim();
                                noteManager.updateNote(parentNoteId, { title: newTitle });
                                if (window.App.sidebarView) {
                                    window.App.sidebarView.updateNoteListItem(parentNoteId, newTitle, parentNote.icon);
                                }
                            };

                            titleElement.addEventListener('blur', finishEditingNote, { once: true });
                            titleElement.addEventListener('keydown', (ke) => {
                                if (ke.key === 'Enter') {
                                    ke.preventDefault();
                                    titleElement.blur();
                                } else if (ke.key === 'Escape') {
                                    titleElement.textContent = parentNote.title || 'Без назви';
                                    titleElement.blur();
                                }
                            });
                        }
                    });
                    dropdown.appendChild(renameItem);
                }

                const divider2 = document.createElement('div');
                divider2.className = 'column-menu-divider';
                dropdown.appendChild(divider2);

                // 4. Секція: Фільтр за тегами
                const filterSectionTitle = document.createElement('div');
                filterSectionTitle.className = 'column-menu-section-header';
                filterSectionTitle.innerHTML = `
                    <span>Фільтр за тегами ${currentColumnFilter.size > 0 ? `(${currentColumnFilter.size})` : ''}</span>
                `;

                if (currentColumnFilter.size > 0) {
                    const clearBtn = document.createElement('button');
                    clearBtn.className = 'column-menu-clear-filter-btn';
                    clearBtn.textContent = 'Скинути';
                    clearBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        state.activeTagFilters.delete(parentKey);
                        renderDropdownContent();
                        if (onFilterChange) onFilterChange();
                    });
                    filterSectionTitle.appendChild(clearBtn);
                }
                dropdown.appendChild(filterSectionTitle);

                const availableTags = storage.getTagOptions ? storage.getTagOptions() : [];
                const tagsList = document.createElement('div');
                tagsList.className = 'column-menu-tags-list';

                if (availableTags.length === 0) {
                    const emptyTag = document.createElement('div');
                    emptyTag.className = 'column-menu-tag-empty';
                    emptyTag.textContent = 'Тегів ще немає';
                    tagsList.appendChild(emptyTag);
                } else {
                    availableTags.forEach(tagName => {
                        const isChecked = currentColumnFilter.has(tagName);
                        const tagRow = document.createElement('div');
                        tagRow.className = `column-menu-tag-item ${isChecked ? 'active' : ''}`;
                        tagRow.innerHTML = `
                            <span class="column-menu-tag-name">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="column-tag-svg">
                                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                    <line x1="7" y1="7" x2="7.01" y2="7"></line>
                                </svg>
                                <span>${tagName}</span>
                            </span>
                            <span class="column-menu-tag-check">
                                ${isChecked ? `
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>` : ''}
                            </span>
                        `;

                        tagRow.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (isChecked) {
                                currentColumnFilter.delete(tagName);
                                if (currentColumnFilter.size === 0) {
                                    state.activeTagFilters.delete(parentKey);
                                } else {
                                    state.activeTagFilters.set(parentKey, currentColumnFilter);
                                }
                            } else {
                                currentColumnFilter.add(tagName);
                                state.activeTagFilters.set(parentKey, currentColumnFilter);
                            }
                            renderDropdownContent();
                            if (onFilterChange) onFilterChange();
                        });

                        tagsList.appendChild(tagRow);
                    });
                }
                dropdown.appendChild(tagsList);
            };

            moreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.column-menu-dropdown.active, .column-filter-dropdown.active, .sticker-menu-dropdown.active, .sticker-emoji-picker-dropdown.active, .sticker-tag-dropdown.active').forEach(d => {
                    if (d !== dropdown) d.classList.remove('active', 'open-upward');
                });
                document.querySelectorAll('.column-more-btn.active').forEach(b => {
                    if (b !== moreBtn) b.classList.remove('active');
                });

                const willOpen = !dropdown.classList.contains('active');
                if (willOpen) {
                    renderDropdownContent();
                    dropdown.classList.add('active');
                    moreBtn.classList.add('active');
                } else {
                    dropdown.classList.remove('active');
                    moreBtn.classList.remove('active');
                }
            });

            menuWrap.appendChild(moreBtn);
            menuWrap.appendChild(dropdown);

            return menuWrap;
        }
    };
})();
