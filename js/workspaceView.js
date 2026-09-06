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

    /**
     * Відображає гарний порожній стан для чистого акаунту з формою створення блокнота
     */
    function renderEmptyWorkspace(container) {
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
            if (name && window.App.boardManager) {
                window.App.boardManager.createBoard(name);
            } else {
                inputEl.focus();
            }
        };

        btnEl.addEventListener('click', submitNewBoard);
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitNewBoard();
        });

        container.appendChild(emptyWorkspace);
        setTimeout(() => inputEl.focus(), 60);

        const boardTitleEl = document.getElementById('workspace-header-board-title');
        const boardIconEl = document.getElementById('workspace-header-board-icon');
        if (boardTitleEl) boardTitleEl.textContent = '';
        if (boardIconEl) boardIconEl.textContent = '';
    }

    /**
     * FLIP-анімація плавного ковзання стікерів на робочій області при зміні порядку
     */
    function applyStickerFlipAnimation(container, prevRects) {
        if (!prevRects || prevRects.size === 0) return;
        container.querySelectorAll('.note-sticker[data-note-id]:not(.is-dragging)').forEach(card => {
            const oldRect = prevRects.get(card.dataset.noteId);
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

    /**
     * Відновлює фокус і курсор введення тексту, якщо користувач друкував під час оновлення
     */
    function restoreFocusAndSelection(container, focusedNoteId, focusedField, selectionStart) {
        if (!focusedNoteId || !focusedField) return;
        const targetCard = container.querySelector(`.note-sticker[data-note-id="${focusedNoteId}"]`);
        if (!targetCard) return;
        const targetEl = targetCard.querySelector(focusedField === 'title' ? '.sticker-title' : '.sticker-content');
        if (!targetEl) return;
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

    window.App.workspaceView = {
        init() {
            this.bindEvents();
        },

        bindEvents() {
            // Глобальне закриття всіх випадних списків та контекстних меню при кліку або pointerdown поза ними
            const handleOutsideClose = (e) => {
                if (e.target.closest('.sticker-menu-dropdown') ||
                    e.target.closest('.sticker-emoji-picker-dropdown') ||
                    e.target.closest('.sticker-tag-dropdown') ||
                    e.target.closest('.column-filter-dropdown') ||
                    e.target.closest('.column-menu-dropdown') ||
                    e.target.closest('.sidebar-context-menu') ||
                    e.target.closest('.sticker-more-btn') ||
                    e.target.closest('.sticker-emoji-btn') ||
                    e.target.closest('.sticker-add-tag-btn') ||
                    e.target.closest('.column-filter-btn') ||
                    e.target.closest('.column-more-btn')) {
                    return;
                }

                document.querySelectorAll('.sticker-menu-dropdown.active, .sticker-emoji-picker-dropdown.active, .sticker-tag-dropdown.active, .column-filter-dropdown.active, .column-menu-dropdown.active, .sidebar-context-menu').forEach(d => {
                    d.classList.remove('active', 'open-upward');
                    if (d.classList.contains('sidebar-context-menu')) d.remove();
                });
                document.querySelectorAll('.sticker-add-tag-btn.active, .column-filter-btn.active, .column-more-btn.active').forEach(b => {
                    b.classList.remove('active');
                });
            };

            document.addEventListener('pointerdown', handleOutsideClose, true);
            document.addEventListener('click', handleOutsideClose, true);

            // Закриття меню при натисканні Escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    document.querySelectorAll('.sticker-menu-dropdown.active, .sticker-emoji-picker-dropdown.active, .sticker-tag-dropdown.active, .column-filter-dropdown.active, .column-menu-dropdown.active, .sidebar-context-menu').forEach(d => {
                        d.classList.remove('active', 'open-upward');
                        if (d.classList.contains('sidebar-context-menu')) d.remove();
                    });
                    document.querySelectorAll('.column-more-btn.active').forEach(b => b.classList.remove('active'));
                }
            });

            // Прив'язка кнопок плаваючого верхнього острівця дій (Workspace Top Island)
            const viewColumnsBtn = document.getElementById('island-view-columns-btn');
            const viewGraphBtn = document.getElementById('island-view-graph-btn');
            const selectToggleBtn = document.getElementById('island-select-toggle-btn');

            if (viewColumnsBtn) {
                viewColumnsBtn.addEventListener('click', () => {
                    const state = window.App.state;
                    if (state && state.isGraphView) {
                        state.isGraphView = false;
                        if (window.App.storage && window.App.storage.saveGraphViewMode) {
                            window.App.storage.saveGraphViewMode(false);
                        }
                        this.render();
                    }
                });
            }

            if (viewGraphBtn) {
                viewGraphBtn.addEventListener('click', () => {
                    const state = window.App.state;
                    if (state && !state.isGraphView) {
                        state.isGraphView = true;
                        if (window.App.storage && window.App.storage.saveGraphViewMode) {
                            window.App.storage.saveGraphViewMode(true);
                        }
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
                    if (e.target.closest('.sticker-menu-dropdown') ||
                        e.target.closest('.sticker-emoji-picker-dropdown') ||
                        e.target.closest('.sticker-tag-dropdown') ||
                        e.target.closest('.column-filter-dropdown') ||
                        e.target.closest('.sidebar-context-menu')) {
                        return;
                    }

                    const notesList = e.target.closest('.column-notes-list');
                    if (notesList) {
                        const canScrollDown = e.deltaY > 0 && notesList.scrollTop + notesList.clientHeight < notesList.scrollHeight - 1;
                        const canScrollUp = e.deltaY < 0 && notesList.scrollTop > 1;

                        if (canScrollDown || canScrollUp) {
                            return;
                        }
                    }

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
            if (!state) return;

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
                const container = els ? els.columnsContainer : document.getElementById('columns-container');
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
            if (!state) return;
            state.activeChain = state.activeChain.slice(0, colIndex);
            this.render();
        },

        render() {
            const els = window.App.getElements();
            const state = window.App.state;

            if (!els || !els.columnsContainer) return;

            // Зберігаємо фокус та позицію курсора введення тексту
            let focusedNoteId = null;
            let focusedField = null;
            let selectionStart = 0;
            const activeEl = document.activeElement;

            if (activeEl && (activeEl.classList.contains('sticker-title') || activeEl.classList.contains('sticker-content'))) {
                const parentSticker = activeEl.closest('.note-sticker[data-note-id]');
                if (parentSticker) {
                    focusedNoteId = parentSticker.dataset.noteId;
                    focusedField = activeEl.classList.contains('sticker-title') ? 'title' : 'content';
                    try {
                        const sel = window.getSelection();
                        if (sel && sel.rangeCount > 0) {
                            selectionStart = sel.getRangeAt(0).startOffset;
                        }
                    } catch (e) {}
                }
            }

            // Зберігаємо позицію горизонтального скролу контейнера колонок
            const prevContainerScrollLeft = els.columnsContainer.scrollLeft;

            // Зберігаємо позиції скролу колонок
            const scrollPositions = new Map();
            els.columnsContainer.querySelectorAll('.board-column').forEach(col => {
                const parentKey = col.dataset.parentId || 'root';
                const scrollList = col.querySelector('.column-notes-list, .board-column-notes-list');
                if (scrollList) {
                    scrollPositions.set(parentKey, scrollList.scrollTop);
                }
            });

            // Зберігаємо позиції стікерів перед оновленням для FLIP-анімації
            const prevStickerRects = new Map();
            els.columnsContainer.querySelectorAll('.note-sticker[data-note-id]').forEach(card => {
                prevStickerRects.set(card.dataset.noteId, card.getBoundingClientRect());
            });

            els.columnsContainer.innerHTML = '';

            const currentBoard = window.App.boardManager ? window.App.boardManager.getActiveBoard() : null;
            if (!currentBoard) {
                renderEmptyWorkspace(els.columnsContainer);
                return;
            }

            // Синхронізуємо стан верхнього хедера
            const boardTitleEl = document.getElementById('workspace-header-board-title');
            const boardIconEl = document.getElementById('workspace-header-board-icon');
            if (boardTitleEl) boardTitleEl.textContent = currentBoard.name || '';
            if (boardIconEl) boardIconEl.textContent = currentBoard.icon || '';

            const viewColumnsBtn = document.getElementById('island-view-columns-btn');
            const viewGraphBtn = document.getElementById('island-view-graph-btn');
            const selectToggleBtn = document.getElementById('island-select-toggle-btn');
            const selectText = document.getElementById('island-select-text');

            if (viewColumnsBtn && viewGraphBtn) {
                if (state && state.isGraphView) {
                    viewColumnsBtn.classList.remove('active');
                    viewGraphBtn.classList.add('active');
                } else {
                    viewColumnsBtn.classList.add('active');
                    viewGraphBtn.classList.remove('active');
                }
            }

            if (selectToggleBtn && selectText) {
                if (state && state.isWorkspaceSelectMode) {
                    selectToggleBtn.classList.add('active');
                    selectText.textContent = 'Готово';
                } else {
                    selectToggleBtn.classList.remove('active');
                    selectText.textContent = 'Вибрати';
                }
            }

            const topHeader = document.getElementById('workspace-top-header');
            const boardWorkspace = document.getElementById('board-workspace');
            const isBoardReadOnly = !!currentBoard.isReadOnly;

            if (boardWorkspace) boardWorkspace.classList.toggle('is-board-readonly', isBoardReadOnly);
            if (topHeader) topHeader.classList.toggle('is-board-readonly', isBoardReadOnly);

            // Якщо увімкнено режим карти нотаток (Obsidian Graph View)
            if (state && state.isGraphView && window.App.graphView) {
                if (topHeader) topHeader.classList.add('graph-mode-active');
                if (window.App.brushTool) window.App.brushTool.disable();
                if (window.App.eraserTool) window.App.eraserTool.disable();
                if (window.App.textSelectionToolbar) window.App.textSelectionToolbar.hide();
                if (window.App.workspaceSearch) {
                    window.App.workspaceSearch.close();
                } else {
                    const searchBar = document.getElementById('workspace-search-bar');
                    if (searchBar) searchBar.style.display = 'none';
                }

                els.columnsContainer.classList.remove('has-many-columns');
                window.App.graphView.render();
                return;
            } else {
                if (topHeader && !isBoardReadOnly) topHeader.classList.remove('graph-mode-active');
                if (window.App.graphView) {
                    window.App.graphView.stopSimulation();
                }
            }

            // Якщо колонок 3 і більше — додаємо спеціальний клас для стилізації ширини
            const totalCols = (state && state.activeChain) ? state.activeChain.length : 1;
            if (totalCols >= 3) {
                els.columnsContainer.classList.add('has-many-columns');
            } else {
                els.columnsContainer.classList.remove('has-many-columns');
            }

            // Рендеримо кожну колонку ланцюжка
            if (state && state.activeChain && window.App.workspaceColumn) {
                state.activeChain.forEach((parentNoteId, colIndex) => {
                    const columnEl = window.App.workspaceColumn.createColumn({
                        colIndex,
                        parentNoteId,
                        currentBoard,
                        isBoardReadOnly,
                        onCloseColumn: (idx) => this.closeColumn(idx),
                        onLayoutChange: () => this.render(),
                        onFilterChange: () => this.render()
                    });

                    els.columnsContainer.appendChild(columnEl);

                    // Відновлюємо точну позицію скролу цієї колонки
                    const parentKey = parentNoteId || 'root';
                    const scrollList = columnEl.querySelector('.column-notes-list, .board-column-notes-list');
                    if (scrollList && scrollPositions.has(parentKey)) {
                        scrollList.scrollTop = scrollPositions.get(parentKey);
                    }
                });
            }

            // Відновлюємо горизонтальну позицію скролу
            if (prevContainerScrollLeft > 0) {
                els.columnsContainer.scrollLeft = prevContainerScrollLeft;
            }

            // FLIP-анімація плавного ковзання стікерів
            applyStickerFlipAnimation(els.columnsContainer, prevStickerRects);

            // Відновлюємо фокус і курсор, якщо користувач друкував
            restoreFocusAndSelection(els.columnsContainer, focusedNoteId, focusedField, selectionStart);

            // Рендеримо мобільний індикатор пагінації (Dots)
            this.renderMobilePagination();
        },

        renderMobilePagination() {
            if (window.App.workspacePagination) {
                window.App.workspacePagination.render();
            }
        },

        updateMobilePagination() {
            if (window.App.workspacePagination) {
                window.App.workspacePagination.update();
            }
        },

        scrollToNote(noteId) {
            const noteManager = window.App.noteManager;
            const state = window.App.state;

            if (!noteManager || !state) return;

            const note = noteManager.getNoteById(noteId);
            if (!note) return;

            // Будуємо ланцюжок батьківських нотаток для відкриття потрібних колонок
            const chain = [null];
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
