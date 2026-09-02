// js/workspaceView.js - Головний контролер мультиколонкового робочого простору
window.App = window.App || {};

(function() {
    window.App.smartPositionDropdown = function(triggerEl, dropdownEl, minHeight = 220) {
        if (!triggerEl || !dropdownEl) return;
        dropdownEl.classList.remove('open-upward');
        const triggerRect = triggerEl.getBoundingClientRect();
        const spaceBelow = window.innerHeight - triggerRect.bottom;
        if (spaceBelow < minHeight && triggerRect.top > minHeight) {
            dropdownEl.classList.add('open-upward');
        }
    };

    window.App.workspaceView = {
        init() {
            this.bindEvents();
        },

        bindEvents() {
            // Глобальне закриття всіх випадних списків та контекстних меню при кліку або pointerdown поза ними
            const handleOutsideClose = (e) => {
                // Якщо клікнули всередину самого випадаючого меню або кнопки його відкриття — не чіпаємо
                if (e.target.closest('.sticker-menu-dropdown') ||
                    e.target.closest('.sticker-emoji-picker-dropdown') ||
                    e.target.closest('.sticker-tag-dropdown') ||
                    e.target.closest('.column-filter-dropdown') ||
                    e.target.closest('.sidebar-context-menu') ||
                    e.target.closest('.sticker-more-btn') ||
                    e.target.closest('.sticker-emoji-btn') ||
                    e.target.closest('.sticker-add-tag-btn') ||
                    e.target.closest('.column-filter-btn')) {
                    return;
                }

                document.querySelectorAll('.sticker-menu-dropdown.active, .sticker-emoji-picker-dropdown.active, .sticker-tag-dropdown.active, .column-filter-dropdown.active, .sidebar-context-menu').forEach(d => {
                    d.classList.remove('active', 'open-upward');
                    if (d.classList.contains('sidebar-context-menu')) d.remove();
                });
                document.querySelectorAll('.sticker-add-tag-btn.active, .column-filter-btn.active').forEach(b => {
                    b.classList.remove('active');
                });
            };

            document.addEventListener('pointerdown', handleOutsideClose, true);
            document.addEventListener('click', handleOutsideClose, true);

            // Закриття меню при натисканні Escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    document.querySelectorAll('.sticker-menu-dropdown.active, .sticker-emoji-picker-dropdown.active, .sticker-tag-dropdown.active, .column-filter-dropdown.active, .sidebar-context-menu').forEach(d => {
                        d.classList.remove('active', 'open-upward');
                        if (d.classList.contains('sidebar-context-menu')) d.remove();
                    });
                }
            });

            // Прив'язка кнопок плаваючого верхнього острівця дій (Workspace Top Island)
            const viewColumnsBtn = document.getElementById('island-view-columns-btn');
            const viewGraphBtn = document.getElementById('island-view-graph-btn');
            const selectToggleBtn = document.getElementById('island-select-toggle-btn');

            if (viewColumnsBtn) {
                viewColumnsBtn.addEventListener('click', () => {
                    const state = window.App.state;
                    if (state.isGraphView) {
                        state.isGraphView = false;
                        window.App.storage.saveGraphViewMode(false);
                        this.render();
                    }
                });
            }

            if (viewGraphBtn) {
                viewGraphBtn.addEventListener('click', () => {
                    const state = window.App.state;
                    if (!state.isGraphView) {
                        state.isGraphView = true;
                        window.App.storage.saveGraphViewMode(true);
                        this.render();
                    }
                });
            }

            if (selectToggleBtn) {
                selectToggleBtn.addEventListener('click', () => {
                    if (window.App.workspaceSelectionBar) {
                        window.App.workspaceSelectionBar.toggleSelectMode();
                    }
                });
            }

            // Горизонтальний скрол колонок робочої області коліщатком миші
            const columnsContainer = document.getElementById('columns-container');
            if (columnsContainer) {
                columnsContainer.addEventListener('wheel', (e) => {
                    // Якщо відкриті випадні списки — не перехоплюємо скрол
                    if (e.target.closest('.sticker-menu-dropdown') ||
                        e.target.closest('.sticker-emoji-picker-dropdown') ||
                        e.target.closest('.sticker-tag-dropdown') ||
                        e.target.closest('.column-filter-dropdown') ||
                        e.target.closest('.sidebar-context-menu')) {
                        return;
                    }

                    // Перевіряємо, чи знаходиться курсор над вертикальним списком нотаток всередині колонки
                    const notesList = e.target.closest('.column-notes-list');
                    if (notesList) {
                        const canScrollDown = e.deltaY > 0 && notesList.scrollTop + notesList.clientHeight < notesList.scrollHeight - 1;
                        const canScrollUp = e.deltaY < 0 && notesList.scrollTop > 1;

                        // Якщо всередині списку нотаток ще є куди скролити вертикально — скролимо список
                        if (canScrollDown || canScrollUp) {
                            return;
                        }
                    }

                    // Якщо є куди скролити колонки горизонтально
                    if (columnsContainer.scrollWidth > columnsContainer.clientWidth) {
                        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                            columnsContainer.scrollLeft += e.deltaY;
                            e.preventDefault();
                        }
                    }
                }, { passive: false });

                // Відстежуємо свайп між колонками на мобільних для оновлення індикатора крапок
                columnsContainer.addEventListener('scroll', () => {
                    if (window.innerWidth <= 768) {
                        this.updateMobilePagination();
                    }
                }, { passive: true });
            }
        },

        toggleChain(noteId, colIndex) {
            const state = window.App.state;
            state.activeChain = state.activeChain.slice(0, colIndex + 1);

            const nextNoteId = state.activeChain[colIndex + 1];
            if (nextNoteId === noteId) {
                this.render();
                return;
            }

            state.activeChain.push(noteId);
            this.render();

            // Автоматично скролимо контейнер колонок до останньої щойно відкритої колонки
            setTimeout(() => {
                const els = window.App.getElements();
                const container = els.columnsContainer;
                if (!container) return;

                const lastColIndex = colIndex + 1;
                const newCol = container.querySelector(`.board-column[data-col-index="${lastColIndex}"]`);
                if (newCol) {
                    newCol.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' });
                } else {
                    container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
                }
            }, 50);
        },

        closeColumn(colIndex) {
            const state = window.App.state;
            state.activeChain = state.activeChain.slice(0, colIndex);
            this.render();
        },

        render() {
            const els = window.App.getElements();
            const state = window.App.state;
            const noteManager = window.App.noteManager;

            if (!els.columnsContainer) return;

            // Зберігаємо фокус та позицію курсора введення тексту для уникнення збивання при Realtime-оновленнях
            let focusedNoteId = null;
            let focusedField = null; // 'title' | 'content'
            let selectionStart = 0;
            let selectionEnd = 0;
            const activeEl = document.activeElement;

            if (activeEl && (activeEl.classList.contains('sticker-title') || activeEl.classList.contains('sticker-content'))) {
                const parentSticker = activeEl.closest('.note-sticker[data-note-id]');
                if (parentSticker) {
                    focusedNoteId = parentSticker.dataset.noteId;
                    focusedField = activeEl.classList.contains('sticker-title') ? 'title' : 'content';
                    try {
                        const sel = window.getSelection();
                        if (sel && sel.rangeCount > 0) {
                            const range = sel.getRangeAt(0);
                            selectionStart = range.startOffset;
                            selectionEnd = range.endOffset;
                        }
                    } catch (e) {}
                }
            }

            // Зберігаємо позицію горизонтального скролу контейнера колонок (особливо важливо на мобільних при свайпах)
            const prevContainerScrollLeft = els.columnsContainer.scrollLeft;

            // Зберігаємо позиції скролу колонок, щоб вони не стрибали нагору при Undo/Redo чи оновленні
            const scrollPositions = new Map();
            els.columnsContainer.querySelectorAll('.board-column').forEach(col => {
                const parentKey = col.dataset.parentId || 'root';
                const scrollList = col.querySelector('.column-notes-list, .board-column-notes-list');
                if (scrollList) {
                    scrollPositions.set(parentKey, scrollList.scrollTop);
                }
            });

            // Зберігаємо позиції стікерів перед оновленням для плавної FLIP-анімації
            const prevStickerRects = new Map();
            els.columnsContainer.querySelectorAll('.note-sticker[data-note-id]').forEach(card => {
                prevStickerRects.set(card.dataset.noteId, card.getBoundingClientRect());
            });

            els.columnsContainer.innerHTML = '';

            const currentBoard = window.App.boardManager.getActiveBoard();
            if (!currentBoard) {
                // Відображаємо гарний порожній стан для чистого акаунту з можливістю створити перший блокнот
                const emptyWorkspace = document.createElement('div');
                emptyWorkspace.className = 'workspace-empty-state';
                emptyWorkspace.innerHTML = `
                    <div class="workspace-empty-card">
                        <div class="workspace-empty-icon">
                            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                            </svg>
                        </div>
                        <h2 class="workspace-empty-title">Створіть свій перший блокнот</h2>
                        <p class="workspace-empty-desc">Блокнот допомагає організувати ваші нотатки, ідеї та вкладені піднотатки в зручні мультиколонки.</p>
                        <div class="workspace-create-board-form">
                            <input type="text" class="workspace-create-board-input" placeholder="Назва блокнота (наприклад: Робота, Особисте)..." autocomplete="off">
                            <button class="workspace-create-board-btn">
                                <span class="btn-plus-icon">+</span>
                                <span>Створити блокнот</span>
                            </button>
                        </div>
                    </div>
                `;

                const inputEl = emptyWorkspace.querySelector('.workspace-create-board-input');
                const btnEl = emptyWorkspace.querySelector('.workspace-create-board-btn');

                const submitNewBoard = () => {
                    const name = inputEl.value.trim();
                    if (name) {
                        window.App.boardManager.createBoard(name);
                    } else {
                        inputEl.focus();
                    }
                };

                btnEl.addEventListener('click', submitNewBoard);
                inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') submitNewBoard();
                });

                els.columnsContainer.appendChild(emptyWorkspace);
                setTimeout(() => inputEl.focus(), 60);

                const boardTitleEl = document.getElementById('workspace-header-board-title');
                const boardIconEl = document.getElementById('workspace-header-board-icon');
                if (boardTitleEl) boardTitleEl.textContent = '';
                if (boardIconEl) boardIconEl.textContent = '';
                return;
            }

            // Синхронізуємо стан верхнього хедера
            const boardTitleEl = document.getElementById('workspace-header-board-title');
            const boardIconEl = document.getElementById('workspace-header-board-icon');
            if (boardTitleEl) {
                boardTitleEl.textContent = currentBoard.name || '';
            }
            if (boardIconEl) {
                boardIconEl.textContent = currentBoard.icon || '';
            }

            const viewColumnsBtn = document.getElementById('island-view-columns-btn');
            const viewGraphBtn = document.getElementById('island-view-graph-btn');
            const selectToggleBtn = document.getElementById('island-select-toggle-btn');
            const selectText = document.getElementById('island-select-text');

            if (viewColumnsBtn && viewGraphBtn) {
                if (state.isGraphView) {
                    viewColumnsBtn.classList.remove('active');
                    viewGraphBtn.classList.add('active');
                } else {
                    viewColumnsBtn.classList.add('active');
                    viewGraphBtn.classList.remove('active');
                }
            }

            if (selectToggleBtn && selectText) {
                if (state.isWorkspaceSelectMode) {
                    selectToggleBtn.classList.add('active');
                    selectText.textContent = 'Готово';
                } else {
                    selectToggleBtn.classList.remove('active');
                    selectText.textContent = 'Вибрати';
                }
            }

            const topHeader = document.getElementById('workspace-top-header');

            // Якщо увімкнено режим карти нотаток (Obsidian Graph View)
            if (state.isGraphView && window.App.graphView) {
                if (topHeader) topHeader.classList.add('graph-mode-active');
                if (window.App.textSelectionToolbar) {
                    window.App.textSelectionToolbar.disableBrushMode();
                    window.App.textSelectionToolbar.hide();
                }
                const searchBar = document.getElementById('workspace-search-bar');
                if (searchBar) searchBar.style.display = 'none';

                els.columnsContainer.classList.remove('has-many-columns');
                window.App.graphView.render();
                return;
            } else {
                if (topHeader) topHeader.classList.remove('graph-mode-active');
                if (window.App.graphView) {
                    window.App.graphView.stopSimulation();
                }
            }

            // Якщо колонок 3 і більше — додаємо спеціальний клас (колонки по 50% зі скролом)
            const totalCols = state.activeChain.length;
            if (totalCols >= 3) {
                els.columnsContainer.classList.add('has-many-columns');
            } else {
                els.columnsContainer.classList.remove('has-many-columns');
            }

            state.activeChain.forEach((parentNoteId, colIndex) => {
                const columnEl = document.createElement('div');
                columnEl.className = `board-column ${colIndex > 0 ? 'child-column' : 'root-column'}`;
                columnEl.dataset.colIndex = colIndex;
                columnEl.dataset.parentId = parentNoteId || 'root';

                let allColNotes = noteManager.getNotesForColumn(parentNoteId);

                // Застосовуємо фільтр тегів для цієї колонки
                const parentKey = parentNoteId || 'root';
                const currentColumnFilter = state.activeTagFilters.get(parentKey) || new Set();

                let colNotes = allColNotes;
                if (currentColumnFilter.size > 0) {
                    colNotes = allColNotes.filter(note => {
                        const noteTags = noteManager.getNoteTags(note);
                        return [...currentColumnFilter].every(t => noteTags.includes(t));
                    });
                }

                const totalNoteCount = allColNotes.length;

                // Header
                const header = document.createElement('div');
                header.className = 'column-header';

                const titleWrap = document.createElement('div');
                titleWrap.className = 'column-title-wrap';

                if (colIndex === 0) {
                    const boardIconPicker = window.App.emojiPicker.createEmojiPicker(
                        { icon: currentBoard.icon || null },
                        (newEmoji) => {
                            window.App.boardManager.updateBoardIcon(currentBoard.id, newEmoji);
                        },
                        () => {
                            window.App.boardManager.updateBoardIcon(currentBoard.id, null);
                        }
                    );
                    boardIconPicker.classList.add('column-header-emoji-picker');

                    const titleH2 = document.createElement('h2');
                    titleH2.className = 'column-title';
                    titleH2.textContent = currentBoard.name;

                    const badgeSpan = document.createElement('span');
                    badgeSpan.className = 'column-count-badge';
                    badgeSpan.textContent = totalNoteCount;

                    titleWrap.appendChild(boardIconPicker);
                    titleWrap.appendChild(titleH2);
                    titleWrap.appendChild(badgeSpan);
                } else {
                    const parentNote = noteManager.getNoteById(parentNoteId);
                    const parentTitle = parentNote ? parentNote.title.trim() : 'Без назви';

                    let noteIconPicker;
                    if (parentNote) {
                        noteIconPicker = window.App.emojiPicker.createEmojiPicker(
                            parentNote,
                            (newEmoji) => {
                                this.render();
                            }
                        );
                    } else {
                        noteIconPicker = document.createElement('span');
                        noteIconPicker.className = 'column-header-icon';
                        noteIconPicker.textContent = '📄';
                    }
                    noteIconPicker.classList.add('column-header-emoji-picker');

                    const titleH2 = document.createElement('h2');
                    titleH2.className = 'column-title';
                    titleH2.textContent = parentTitle || 'Без назви';

                    const badgeSpan = document.createElement('span');
                    badgeSpan.className = 'column-count-badge';
                    badgeSpan.textContent = totalNoteCount;

                    titleWrap.appendChild(noteIconPicker);
                    titleWrap.appendChild(titleH2);
                    titleWrap.appendChild(badgeSpan);
                }

                // Кнопка та меню фільтрів тегів
                const filterWrap = window.App.columnFilter.createFilter(parentNoteId, currentColumnFilter, () => this.render());
                titleWrap.appendChild(filterWrap);

                // Кнопка перемикання вигляду: Список (по порядку вниз) / Сітка 2 колонки (Pinterest Masonry)
                const currentLayout = state.columnLayouts[parentKey] || 'list';
                const layoutToggleBtn = document.createElement('button');
                layoutToggleBtn.className = `column-layout-toggle-btn ${currentLayout === 'grid' ? 'active' : ''}`;
                layoutToggleBtn.title = currentLayout === 'grid' ? 'Перемкнути на звичайний список' : 'Перемкнути на сітку в 2 колонки (Pinterest)';
                
                // SVG іконка: список або сітка з 2 колонок
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
                    const newLayout = (state.columnLayouts[parentKey] || 'list') === 'grid' ? 'list' : 'grid';
                    state.columnLayouts[parentKey] = newLayout;
                    window.App.storage.saveColumnLayouts(state.columnLayouts);
                    this.render();
                });

                titleWrap.appendChild(layoutToggleBtn);
                header.appendChild(titleWrap);

                // Кнопка закриття для прив'язаних колонок
                if (colIndex > 0) {
                    const closeBtn = document.createElement('button');
                    closeBtn.className = 'column-close-btn';
                    closeBtn.title = 'Закрити цю колонку';
                    closeBtn.innerHTML = '×';
                    closeBtn.addEventListener('click', () => this.closeColumn(colIndex));
                    header.appendChild(closeBtn);
                }

                columnEl.appendChild(header);

                // Список нотаток у колонці
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

                    const createFirstBtn = document.createElement('button');
                    createFirstBtn.className = 'btn-create-first-note';
                    createFirstBtn.innerHTML = `<span class="btn-plus-icon">+</span> ${colIndex === 0 ? 'Створити першу нотатку' : 'Додати першу піднотатку'}`;
                    createFirstBtn.addEventListener('click', () => noteManager.createNewNote(parentNoteId, true));

                    emptyState.appendChild(createFirstBtn);
                    notesScrollList.appendChild(emptyState);
                } else {
                    if (currentLayout === 'grid') {
                        // Створюємо справжні 2 колонки (ліва та права) з підтримкою вільного розміщення будь-якої кількості карток у кожній
                        const gridWrapper = document.createElement('div');
                        gridWrapper.className = 'masonry-grid-wrapper';

                        const colLeft = document.createElement('div');
                        colLeft.className = 'masonry-column masonry-column-left';

                        const colRight = document.createElement('div');
                        colRight.className = 'masonry-column masonry-column-right';

                        // Відокремлюємо нотатки за збереженою колонкою gridCol або початковим балансом
                        colNotes.forEach((note, idx) => {
                            const sticker = window.App.stickerCard.createCard(note, colIndex);
                            const targetCol = note.gridCol ? note.gridCol : (idx % 2 === 0 ? 'left' : 'right');
                            if (targetCol === 'left') {
                                colLeft.appendChild(sticker);
                            } else {
                                colRight.appendChild(sticker);
                            }
                        });

                        gridWrapper.appendChild(colLeft);
                        gridWrapper.appendChild(colRight);
                        notesScrollList.appendChild(gridWrapper);
                    } else {
                        colNotes.forEach(note => {
                            const sticker = window.App.stickerCard.createCard(note, colIndex);
                            notesScrollList.appendChild(sticker);
                        });
                    }

                    // Кнопка додавання внизу колонки
                    const bottomBtnContainer = document.createElement('div');
                    bottomBtnContainer.className = 'add-note-bottom-container';

                    const addBtn = document.createElement('button');
                    addBtn.className = 'bottom-add-note-btn';
                    addBtn.innerHTML = `<span class="btn-plus-icon">+</span> Додати ${colIndex === 0 ? 'нотатку' : 'піднотатку'}`;
                    addBtn.addEventListener('click', () => noteManager.createNewNote(parentNoteId, true));

                    bottomBtnContainer.appendChild(addBtn);
                    notesScrollList.appendChild(bottomBtnContainer);
                }

                columnEl.appendChild(notesScrollList);
                els.columnsContainer.appendChild(columnEl);

                // Відновлюємо точну позицію скролу цієї колонки
                if (scrollPositions.has(parentKey)) {
                    notesScrollList.scrollTop = scrollPositions.get(parentKey);
                }
            });

            // Відновлюємо горизонтальну позицію скролу (щоб користувача не викидало на початок при зміні порядку)
            if (prevContainerScrollLeft > 0) {
                els.columnsContainer.scrollLeft = prevContainerScrollLeft;
            }

            // FLIP-анімація плавного ковзання стікерів на робочій області при зміні порядку
            if (prevStickerRects.size > 0) {
                els.columnsContainer.querySelectorAll('.note-sticker[data-note-id]:not(.is-dragging)').forEach(card => {
                    const oldRect = prevStickerRects.get(card.dataset.noteId);
                    if (!oldRect) return;
                    const newRect = card.getBoundingClientRect();
                    const dy = oldRect.top - newRect.top;
                    const dx = oldRect.left - newRect.left;

                    if (dy !== 0 || dx !== 0) {
                        card.style.transition = 'none';
                        card.style.transform = `translate(${dx}px, ${dy}px)`;
                        requestAnimationFrame(() => {
                            card.style.transition = 'transform 0.24s cubic-bezier(0.2, 0, 0, 1)';
                            card.style.transform = '';
                        });
                    }
                });
            }

            // Відновлюємо фокус і курсор, якщо користувач у цей момент друкував текст під час Realtime-оновлення
            if (focusedNoteId && focusedField) {
                const targetCard = els.columnsContainer.querySelector(`.note-sticker[data-note-id="${focusedNoteId}"]`);
                if (targetCard) {
                    const targetEl = targetCard.querySelector(focusedField === 'title' ? '.sticker-title' : '.sticker-content');
                    if (targetEl) {
                        targetEl.focus();
                        try {
                            const sel = window.getSelection();
                            if (sel && targetEl.childNodes.length > 0) {
                                const range = document.createRange();
                                const nodeToFocus = targetEl.firstChild || targetEl;
                                const maxOffset = nodeToFocus.textContent ? nodeToFocus.textContent.length : 0;
                                const safeOffset = Math.min(selectionStart, maxOffset);
                                range.setStart(nodeToFocus, safeOffset);
                                range.collapse(true);
                                sel.removeAllRanges();
                                sel.addRange(range);
                            }
                        } catch (e) {}
                    }
                }
            }

            // Рендеримо мобільний індикатор пагінації (Dots)
            this.renderMobilePagination();
        },

        renderMobilePagination() {
            const container = document.getElementById('mobile-columns-pagination');
            if (!container) return;

            const state = window.App.state;
            const columnCount = (state.activeChain && state.activeChain.length) ? state.activeChain.length : 1;

            // Якщо колонка всього одна — ховаємо індикатор
            if (columnCount <= 1 || window.innerWidth > 768) {
                container.classList.remove('visible');
                container.innerHTML = '';
                return;
            }

            container.classList.add('visible');
            container.innerHTML = '';

            for (let i = 0; i < columnCount; i++) {
                const dot = document.createElement('div');
                dot.className = `mobile-pagination-dot ${i === 0 ? 'active' : ''}`;
                dot.dataset.colIndex = i;
                dot.addEventListener('click', () => {
                    const columnsContainer = document.getElementById('columns-container');
                    if (columnsContainer) {
                        const targetLeft = i * window.innerWidth;
                        columnsContainer.scrollTo({ left: targetLeft, behavior: 'smooth' });
                    }
                });
                container.appendChild(dot);
            }

            this.updateMobilePagination();
        },

        updateMobilePagination() {
            const container = document.getElementById('mobile-columns-pagination');
            const columnsContainer = document.getElementById('columns-container');
            if (!container || !columnsContainer || window.innerWidth > 768) return;

            const scrollLeft = columnsContainer.scrollLeft;
            const colWidth = window.innerWidth;
            const activeIndex = Math.round(scrollLeft / colWidth);

            const dots = container.querySelectorAll('.mobile-pagination-dot');
            dots.forEach((dot, idx) => {
                dot.classList.toggle('active', idx === activeIndex);
            });
        },

        scrollToNote(noteId) {
            const noteManager = window.App.noteManager;
            const state = window.App.state;

            const note = noteManager.getNoteById(noteId);
            if (!note) return;

            // Будуємо ланцюжок батьківських нотаток для відкриття потрібних колонок
            const chain = [null]; // Корінь
            const ancestors = [];
            let curr = note;
            while (curr && curr.parentId) {
                ancestors.unshift(curr.parentId);
                curr = noteManager.getNoteById(curr.parentId);
            }
            ancestors.forEach(pId => chain.push(pId));

            state.activeChain = chain;
            this.render();

            // Знаходимо картку на екрані та плавно скролимо до неї
            setTimeout(() => {
                const card = document.querySelector(`.note-sticker[data-note-id="${noteId}"]`);
                if (card) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                    card.classList.remove('sticker-highlight-pulse');
                    void card.offsetWidth; // Тригер перезапуску CSS-анімації
                    card.classList.add('sticker-highlight-pulse');
                    setTimeout(() => card.classList.remove('sticker-highlight-pulse'), 1800);
                }
            }, 60);
        }
    };
})();
