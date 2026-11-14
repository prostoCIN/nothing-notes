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
        const t = (k, p) => (window.App && window.App.i18n) ? window.App.i18n.t(k, p) : k;
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
                <h2 class="workspace-empty-title" data-i18n="workspace.emptyTitle">${t('workspace.emptyTitle')}</h2>
                <p class="workspace-empty-desc" data-i18n="workspace.emptyDesc">${t('workspace.emptyDesc')}</p>
                <div class="workspace-create-board-form">
                    <input type="text" class="workspace-create-board-input" placeholder="${t('workspace.emptyInputPlaceholder')}" data-i18n-placeholder="workspace.emptyInputPlaceholder" autocomplete="off">
                    <button class="workspace-create-board-btn">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="btn-plus-icon">
                            <line x1="12" y1="6" x2="12" y2="18"></line>
                            <line x1="6" y1="12" x2="18" y2="12"></line>
                        </svg>
                        <span data-i18n="workspace.createBoardBtn">${t('workspace.createBoardBtn')}</span>
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
                    card.style.transition = 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)';
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
        _boardLoadPromise: null,
        _graphLoadPromise: null,

        getElements() {
            return window.App.getElements ? window.App.getElements() : null;
        },

        showCanvasLoading() {
            const els = window.App.getElements ? window.App.getElements() : null;
            const container = (els && els.columnsContainer) || document.getElementById('columns-container');
            if (!container) return;
            container.classList.add('has-canvas-mode');
            container.innerHTML = `
                <div class="canvas-lazy-loading" style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;min-height:350px;color:var(--text-muted);gap:12px;">
                    <div class="canvas-lazy-spinner" style="width:28px;height:28px;border:2.5px solid rgba(255,255,255,0.1);border-top-color:var(--accent-color, #16b981);border-radius:50%;animation:lazy-spin 0.8s linear infinite;"></div>
                    <span style="font-size:12px;letter-spacing:0.04em;">NothingNotes Engine</span>
                    <style>@keyframes lazy-spin { to { transform: rotate(360deg); } }</style>
                </div>
            `;
        },

        ensureBoardLoaded() {
            if (window.App.boardView) return Promise.resolve(window.App.boardView);
            if (!this._boardLoadPromise) {
                this._boardLoadPromise = import('./board/boardModule.js')
                    .then(() => window.App.boardView)
                    .catch((err) => {
                        this._boardLoadPromise = null;
                        const msg = (err && (err.message || String(err))) || '';
                        if (msg.includes('dynamically imported module') || msg.includes('Expected a JavaScript-or-Wasm module script')) {
                            var reloadKey = 'nothingnotes_chunk_reload';
                            var lastReload = sessionStorage.getItem(reloadKey);
                            var now = Date.now();
                            if (!lastReload || now - parseInt(lastReload, 10) > 8000) {
                                sessionStorage.setItem(reloadKey, now.toString());
                                window.location.reload();
                            }
                        }
                        throw err;
                    });
            }
            return this._boardLoadPromise;
        },

        ensureGraphLoaded() {
            if (window.App.graphView) return Promise.resolve(window.App.graphView);
            if (!this._graphLoadPromise) {
                this._graphLoadPromise = import('./graph/graphModule.js')
                    .then(() => window.App.graphView)
                    .catch((err) => {
                        this._graphLoadPromise = null;
                        const msg = (err && (err.message || String(err))) || '';
                        if (msg.includes('dynamically imported module') || msg.includes('Expected a JavaScript-or-Wasm module script')) {
                            var reloadKey = 'nothingnotes_chunk_reload';
                            var lastReload = sessionStorage.getItem(reloadKey);
                            var now = Date.now();
                            if (!lastReload || now - parseInt(lastReload, 10) > 8000) {
                                sessionStorage.setItem(reloadKey, now.toString());
                                window.location.reload();
                            }
                        }
                        throw err;
                    });
            }
            return this._graphLoadPromise;
        },

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

                if (window.App.closeAllTagDropdowns) {
                    window.App.closeAllTagDropdowns();
                }

                document.querySelectorAll('.sticker-menu-dropdown.active, .sticker-emoji-picker-dropdown.active, .sticker-tag-dropdown.active, .column-filter-dropdown.active, .column-menu-dropdown.active, .sidebar-context-menu').forEach(d => {
                    d.classList.remove('active', 'open-upward');
                    if (d.classList.contains('sidebar-context-menu')) d.remove();
                    if (d.classList.contains('sticker-tag-dropdown')) {
                        const p = d.closest('.sticker-tags-container');
                        if (p && p.querySelectorAll('.sticker-tag-badge').length === 0) {
                            p.style.display = 'none';
                        }
                    }
                });
                document.querySelectorAll('.has-active-emoji-picker').forEach(el => {
                    el.classList.remove('has-active-emoji-picker');
                });
                document.querySelectorAll('.has-active-tag').forEach(el => {
                    el.classList.remove('has-active-tag');
                });
                document.querySelectorAll('.has-active-dropdown').forEach(el => {
                    el.classList.remove('has-active-dropdown');
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
                    if (window.App.closeAllTagDropdowns) {
                        window.App.closeAllTagDropdowns();
                    }
                    document.querySelectorAll('.sticker-menu-dropdown.active, .sticker-emoji-picker-dropdown.active, .sticker-tag-dropdown.active, .column-filter-dropdown.active, .column-menu-dropdown.active, .sidebar-context-menu').forEach(d => {
                        d.classList.remove('active', 'open-upward');
                        if (d.classList.contains('sidebar-context-menu')) d.remove();
                        if (d.classList.contains('sticker-tag-dropdown')) {
                            const p = d.closest('.sticker-tags-container');
                            if (p && p.querySelectorAll('.sticker-tag-badge').length === 0) {
                                p.style.display = 'none';
                            }
                        }
                    });
                    document.querySelectorAll('.has-active-emoji-picker').forEach(el => {
                        el.classList.remove('has-active-emoji-picker');
                    });
                    document.querySelectorAll('.has-active-tag').forEach(el => {
                        el.classList.remove('has-active-tag');
                    });
                    document.querySelectorAll('.has-active-dropdown').forEach(el => {
                        el.classList.remove('has-active-dropdown');
                    });
                    document.querySelectorAll('.column-more-btn.active').forEach(b => b.classList.remove('active'));
                    return;
                }

                // На мобільних телефонах/планшетах повністю вимикаємо будь-які хоткеї створення
                const isMobileDevice = window.innerWidth <= 768 ||
                    (window.matchMedia && (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 768px)').matches)) ||
                    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                if (isMobileDevice) {
                    return;
                }

                // Не перехоплюємо, якщо відкрите будь-яке модальне вікно
                const isModalOpen = document.querySelector('.modal-overlay.active, .confirm-modal-overlay.active, .settings-modal-overlay.active, .share-modal-overlay.active, .auth-modal-overlay.active');
                if (isModalOpen) {
                    return;
                }

                // Не спрацьовуємо, якщо фокус у текстовому полі пошуку, інпуті тощо
                const activeEl = document.activeElement;
                if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                    return;
                }

                // Розумний хоткей Alt + N: створення піднотатки (при хавері/фокусі на нотатці) або нової нотатки в колонці (при хавері на колонці)
                const isAltN = e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.code === 'KeyN' || e.key.toLowerCase() === 'n');
                if (isAltN) {
                    e.preventDefault();

                    // 1. Шукаємо нотатку під курсором або у фокусі -> створюємо піднотатку для неї
                    const hoveredNote = document.querySelector('.note-sticker[data-note-id]:hover');
                    const focusedNote = activeEl ? activeEl.closest('.note-sticker[data-note-id]') : null;
                    const targetNote = hoveredNote || focusedNote;

                    if (targetNote && targetNote.dataset && targetNote.dataset.noteId) {
                        this.createSubnoteForNote(targetNote.dataset.noteId);
                        return;
                    }

                    // 2. Якщо курсор не над нотаткою — шукаємо колонку під курсором або у фокусі -> створюємо нову нотатку в цій колонці
                    const hoveredColumn = document.querySelector('.board-column:hover');
                    const focusedColumn = activeEl ? activeEl.closest('.board-column') : null;
                    const targetColumn = hoveredColumn || focusedColumn || document.querySelector('.board-column[data-col-index="0"]');

                    if (targetColumn && window.App.noteManager) {
                        const rawParentId = targetColumn.dataset.parentId;
                        const parentNoteId = (!rawParentId || rawParentId === 'root') ? null : rawParentId;
                        window.App.noteManager.createNewNote(parentNoteId, true);
                        return;
                    }

                    // 3. Якщо режим дошки або графу без колонок
                    if (window.App.noteManager) {
                        window.App.noteManager.createNewNote(null, true);
                    }
                }
            });

            // Прив'язка кнопок плаваючого верхнього острівця дій (3 режими: Колонки, Дошка, Граф)
            const viewColumnsBtn = document.getElementById('island-view-columns-btn');
            const viewBoardBtn = document.getElementById('island-view-board-btn');
            const viewGraphBtn = document.getElementById('island-view-graph-btn');
            const selectToggleBtn = document.getElementById('island-select-toggle-btn');

            let isSwitchingMode = false;

            const switchView = async (mode) => {
                if (isSwitchingMode) return;
                if (window.App.store) {
                    window.App.store.setViewMode(mode);
                } else if (window.App.state) {
                    window.App.state.viewMode = mode;
                }

                if (mode === 'board' && !window.App.boardView) {
                    isSwitchingMode = true;
                    this.showCanvasLoading();
                    try {
                        await this.ensureBoardLoaded();
                    } finally {
                        isSwitchingMode = false;
                    }
                } else if (mode === 'graph' && !window.App.graphView) {
                    isSwitchingMode = true;
                    this.showCanvasLoading();
                    try {
                        await this.ensureGraphLoaded();
                    } finally {
                        isSwitchingMode = false;
                    }
                }

                this.render();
            };

            if (viewColumnsBtn) {
                viewColumnsBtn.addEventListener('click', () => switchView('columns'));
            }
            if (viewBoardBtn) {
                viewBoardBtn.addEventListener('click', () => switchView('board'));
            }
            if (viewGraphBtn) {
                viewGraphBtn.addEventListener('click', () => switchView('graph'));
            }

            if (selectToggleBtn) {
                selectToggleBtn.addEventListener('click', () => {
                    if (window.App.workspaceSelectionBar) {
                        window.App.workspaceSelectionBar.toggleSelectMode();
                    }
                });
            }

            // Якщо розмір вікна змінився на мобільний під час відкритої дошки — повертаємося до колонок
            window.addEventListener('resize', () => {
                if (window.innerWidth <= 768 && window.App.state && window.App.state.viewMode === 'board') {
                    if (window.App.store) {
                        window.App.store.setViewMode('columns');
                    } else {
                        window.App.state.viewMode = 'columns';
                    }
                    this.render();
                }
            });

            // Горизонтальний скрол колонок робочої області коліщатком миші
            const columnsContainer = document.getElementById('columns-container');
            if (columnsContainer) {
                columnsContainer.addEventListener('wheel', (e) => {
                    if (e.ctrlKey || e.metaKey) return;
                    if (e.target.closest('.sticker-menu-dropdown') ||
                        e.target.closest('.sticker-emoji-picker-dropdown') ||
                        e.target.closest('.sticker-tag-dropdown') ||
                        e.target.closest('.column-filter-dropdown') ||
                        e.target.closest('.sidebar-context-menu')) {
                        return;
                    }

                    // Якщо активовано режим "замочок" — блокуємо будь-який горизонтальний скрол до інших колонок
                    const state = window.App && window.App.state;
                    if (state && state.lockedColumnKey) {
                        const notesList = e.target.closest('.column-notes-list, .board-column-notes-list');
                        if (notesList) {
                            const canScrollDown = e.deltaY > 0 && notesList.scrollTop + notesList.clientHeight < notesList.scrollHeight - 1;
                            const canScrollUp = e.deltaY < 0 && notesList.scrollTop > 1;

                            if (canScrollDown || canScrollUp) {
                                // Дозволяємо виключно вертикальний скрол усередині нотаток залоченої колонки
                                return;
                            }
                        }
                        // Досягнуто межі списку або курсор поза списком — блокуємо скрол, щоб поле не зміщувалось вліво/вправо
                        e.preventDefault();
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

                // Відстежуємо свайп між колонками та блокуємо зсув залоченої колонки
                columnsContainer.addEventListener('scroll', () => {
                    const state = window.App && window.App.state;
                    if (state && state.lockedColumnKey && typeof state.lockedScrollLeft === 'number') {
                        if (Math.abs(columnsContainer.scrollLeft - state.lockedScrollLeft) > 1) {
                            columnsContainer.scrollLeft = state.lockedScrollLeft;
                        }
                    }
                    if (window.innerWidth <= 768) {
                        this.updateMobilePagination();
                    }
                }, { passive: true });

                // Візуальна синхронізація активної нотатки з лівим сайдбаром при кліку або фокусі
                columnsContainer.addEventListener('pointerdown', (e) => {
                    const sticker = e.target.closest('.note-sticker[data-note-id]');
                    if (sticker && sticker.dataset.noteId && window.App.sidebarView) {
                        window.App.sidebarView.setActiveNote(sticker.dataset.noteId, { autoExpand: true, scrollIntoView: false });
                    }
                }, { passive: true });

                columnsContainer.addEventListener('focusin', (e) => {
                    const sticker = e.target.closest('.note-sticker[data-note-id]');
                    if (sticker && sticker.dataset.noteId && window.App.sidebarView) {
                        window.App.sidebarView.setActiveNote(sticker.dataset.noteId, { autoExpand: true, scrollIntoView: true });
                    }
                }, { passive: true });
            }
        },

        toggleChain(noteId, colIndex) {
            const state = window.App.state;
            if (!state) return;

            const els = window.App.getElements();
            const container = els ? els.columnsContainer : document.getElementById('columns-container');

            // Якщо контейнер відсутній або відкритий інший режим (дошка/граф) — безпечний fallback до повного render
            if (!container || container.classList.contains('has-canvas-mode') || !window.App.workspaceColumn) {
                const isAlreadyOpen = Array.isArray(state.activeChain) && state.activeChain[colIndex + 1] === noteId;
                state.activeChain = state.activeChain.slice(0, colIndex + 1);
                if (!isAlreadyOpen) state.activeChain.push(noteId);
                this.render();
                return;
            }

            const existingCols = Array.from(container.querySelectorAll('.board-column'));
            // Якщо в DOM ще немає колонок або структура порушена — fallback
            if (existingCols.length === 0 || existingCols.length <= colIndex) {
                const isAlreadyOpen = Array.isArray(state.activeChain) && state.activeChain[colIndex + 1] === noteId;
                state.activeChain = state.activeChain.slice(0, colIndex + 1);
                if (!isAlreadyOpen) state.activeChain.push(noteId);
                this.render();
                return;
            }

            const isAlreadyOpen = Array.isArray(state.activeChain) && state.activeChain[colIndex + 1] === noteId;

            // 1. ВИПАДОК ЗАКРИТТЯ: якщо колонка для цієї нотатки вже була розгорнута
            if (isAlreadyOpen) {
                state.activeChain = state.activeChain.slice(0, colIndex + 1);

                // Швидко видаляємо дочірні колонки праворуч без перемальовування решти DOM
                existingCols.forEach(col => {
                    const idx = parseInt(col.dataset.colIndex, 10);
                    if (idx > colIndex) {
                        col.remove();
                    }
                });

                // Знімаємо підсвітку активного батька з картки
                const parentCol = container.querySelector(`.board-column[data-col-index="${colIndex}"]`);
                if (parentCol) {
                    const card = parentCol.querySelector(`.note-sticker[data-note-id="${noteId}"]`);
                    if (card) {
                        card.classList.remove('active-parent-note');
                        const subBox = card.querySelector('.sticker-subnotes-container');
                        if (subBox) {
                            subBox.classList.remove('is-expanded');
                            const i18n = window.App.i18n;
                            const navTooltip = i18n ? i18n.t('sticker.openSubnotesCol') : 'Перейти до піднотаток';
                            const mainArea = subBox.querySelector('.subnotes-main-area');
                            if (mainArea) mainArea.title = navTooltip;
                            const navBtn = subBox.querySelector('.subnotes-nav-btn');
                            if (navBtn) navBtn.title = navTooltip;
                        }
                    }
                }

                // Оновлюємо класи адаптивної ширини
                const totalCols = state.activeChain.length;
                container.classList.toggle('has-many-columns', totalCols >= 3);

                // Якщо закрита колонка була розтягнута — скидаємо розтягування
                if (state.stretchedColumnKey) {
                    const chainKeys = state.activeChain.map(id => id || 'root');
                    if (!chainKeys.includes(state.stretchedColumnKey)) {
                        state.stretchedColumnKey = null;
                        state.lockedColumnKey = null;
                        state.lockedScrollLeft = null;
                        container.classList.remove('has-stretched-column', 'has-locked-column');
                    }
                }

                this.renderMobilePagination();

                // Неблокуюча фонова синхронізація сайдбару
                requestAnimationFrame(() => {
                    if (window.App.sidebarView) {
                        window.App.sidebarView.expandChain(state.activeChain);
                        const lastId = state.activeChain[state.activeChain.length - 1];
                        window.App.sidebarView.setActiveNote(lastId, { autoExpand: false, scrollIntoView: true });
                    }
                });
                return;
            }

            // 2. ВИПАДОК ВІДКРИТТЯ НОВОЇ ДОЧІРНЬОЇ КОЛОНКИ
            // Якщо праворуч уже були відкриті колонки від іншої нотатки — закриваємо їх
            existingCols.forEach(col => {
                const idx = parseInt(col.dataset.colIndex, 10);
                if (idx > colIndex) {
                    col.remove();
                }
            });

            // Знімаємо стан активного батька з будь-якої іншої нотатки поточної колонки
            const parentCol = container.querySelector(`.board-column[data-col-index="${colIndex}"]`);
            if (parentCol) {
                parentCol.querySelectorAll('.note-sticker.active-parent-note').forEach(c => {
                    c.classList.remove('active-parent-note');
                    const sBox = c.querySelector('.sticker-subnotes-container');
                    if (sBox) sBox.classList.remove('is-expanded');
                });

                // Підсвічуємо поточну нотатку
                const currentCard = parentCol.querySelector(`.note-sticker[data-note-id="${noteId}"]`);
                if (currentCard) {
                    currentCard.classList.add('active-parent-note');
                    const subBox = currentCard.querySelector('.sticker-subnotes-container');
                    if (subBox) {
                        subBox.classList.add('is-expanded');
                        const i18n = window.App.i18n;
                        const navTooltip = i18n ? i18n.t('sticker.hideSubnotesCol') : 'Приховати колонку піднотаток';
                        const mainArea = subBox.querySelector('.subnotes-main-area');
                        if (mainArea) mainArea.title = navTooltip;
                        const navBtn = subBox.querySelector('.subnotes-nav-btn');
                        if (navBtn) navBtn.title = navTooltip;
                    }
                }
            }

            // Оновлюємо стан ланцюжка
            state.activeChain = state.activeChain.slice(0, colIndex + 1);
            state.activeChain.push(noteId);

            const newColIndex = colIndex + 1;
            const currentBoard = window.App.boardManager ? window.App.boardManager.getActiveBoard() : null;
            const isBoardReadOnly = !!(currentBoard && currentBoard.isReadOnly) || (currentBoard && currentBoard.id && currentBoard.id.startsWith('shared_'));

            // Миттєво монтуємо ТІЛЬКИ нову колонку в DOM
            const newColumnEl = window.App.workspaceColumn.createColumn({
                colIndex: newColIndex,
                parentNoteId: noteId,
                currentBoard,
                isBoardReadOnly,
                onCloseColumn: (idx) => this.closeColumn(idx),
                onLayoutChange: () => this.render(),
                onFilterChange: () => this.render()
            });

            newColumnEl.classList.add('column-entering');
            newColumnEl.addEventListener('animationend', () => {
                newColumnEl.classList.remove('column-entering');
            }, { once: true });

            container.appendChild(newColumnEl);

            // Оновлюємо класи адаптивної ширини колонок
            const totalCols = state.activeChain.length;
            container.classList.toggle('has-many-columns', totalCols >= 3);

            // Плавний скрол контейнера до нової колонки (лише якщо вона виходить за межі видимості екрана)
            requestAnimationFrame(() => {
                if (container.scrollWidth > container.clientWidth + 5) {
                    newColumnEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' });
                }
            });

            this.renderMobilePagination();

            // Асинхронна синхронізація сайдбару без затримки кадру анімації
            requestAnimationFrame(() => {
                if (window.App.sidebarView) {
                    window.App.sidebarView.expandChain(state.activeChain);
                    window.App.sidebarView.setActiveNote(noteId, { autoExpand: true, scrollIntoView: true });
                }
            });
        },

        closeColumn(colIndex) {
            const state = window.App.state;
            if (!state) return;

            const els = window.App.getElements();
            const container = els ? els.columnsContainer : document.getElementById('columns-container');

            if (!container || container.classList.contains('has-canvas-mode') || !window.App.workspaceColumn) {
                state.activeChain = state.activeChain.slice(0, colIndex);
                this.render();
                return;
            }

            state.activeChain = state.activeChain.slice(0, colIndex);

            // Миттєво видаляємо закриту колонку та всі наступні
            container.querySelectorAll('.board-column').forEach(col => {
                const idx = parseInt(col.dataset.colIndex, 10);
                if (idx >= colIndex) {
                    col.remove();
                }
            });

            // Знімаємо стан активного батька з картки в попередній колонці
            const parentCol = container.querySelector(`.board-column[data-col-index="${colIndex - 1}"]`);
            if (parentCol) {
                parentCol.querySelectorAll('.note-sticker.active-parent-note').forEach(c => {
                    c.classList.remove('active-parent-note');
                    const subBox = c.querySelector('.sticker-subnotes-container');
                    if (subBox) {
                        subBox.classList.remove('is-expanded');
                        const i18n = window.App.i18n;
                        const navTooltip = i18n ? i18n.t('sticker.openSubnotesCol') : 'Перейти до піднотаток';
                        const mainArea = subBox.querySelector('.subnotes-main-area');
                        if (mainArea) mainArea.title = navTooltip;
                        const navBtn = subBox.querySelector('.subnotes-nav-btn');
                        if (navBtn) navBtn.title = navTooltip;
                    }
                });
            }

            // Оновлюємо класи адаптивної ширини контейнера
            const totalCols = state.activeChain.length;
            container.classList.toggle('has-many-columns', totalCols >= 3);

            if (state.stretchedColumnKey) {
                const chainKeys = state.activeChain.map(id => id || 'root');
                if (!chainKeys.includes(state.stretchedColumnKey)) {
                    state.stretchedColumnKey = null;
                    state.lockedColumnKey = null;
                    state.lockedScrollLeft = null;
                    container.classList.remove('has-stretched-column', 'has-locked-column');
                }
            }

            this.renderMobilePagination();

            requestAnimationFrame(() => {
                const lastParentId = state.activeChain[state.activeChain.length - 1];
                if (window.App.sidebarView) {
                    window.App.sidebarView.setActiveNote(lastParentId, { autoExpand: false, scrollIntoView: true });
                }
            });
        },

        render() {
            const els = window.App.getElements();
            const state = window.App.state;

            if (!els || !els.columnsContainer) return;

            // Блокуємо повторний рендер робочої області під час активного перетягування нотатки
            if (state && state.isDraggingNote) {
                return;
            }

            // Очищаємо будь-які застарілі відірвані картки перетягування з document.body
            document.querySelectorAll('body > .note-sticker.is-dragging').forEach(staleCard => {
                staleCard.remove();
            });

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

            const currentBoard = window.App.boardManager ? window.App.boardManager.getActiveBoard() : null;
            if (!currentBoard) {
                els.columnsContainer.innerHTML = '';
                renderEmptyWorkspace(els.columnsContainer);
                return;
            }

            // Валідуємо ланцюжок activeChain: він повинен починатися з null,
            // і кожен наступний parentNoteId повинен існувати та належати поточному активному блокноту.
            if (state && Array.isArray(state.activeChain)) {
                const noteManager = window.App.noteManager;
                const validChain = [null];
                for (let i = 1; i < state.activeChain.length; i++) {
                    const pId = state.activeChain[i];
                    const n = noteManager ? noteManager.getNoteById(pId) : null;
                    if (n && n.boardId === currentBoard.id) {
                        validChain.push(pId);
                    } else {
                        break;
                    }
                }
                state.activeChain = validChain;
            }

            // Синхронізуємо стан верхнього хедера
            const boardTitleEl = document.getElementById('workspace-header-board-title');
            const boardIconEl = document.getElementById('workspace-header-board-icon');
            if (boardTitleEl) boardTitleEl.textContent = currentBoard.name || '';
            if (boardIconEl) {
                if (window.App.setEmojiContent) {
                    window.App.setEmojiContent(boardIconEl, currentBoard.icon, '', 16);
                } else {
                    boardIconEl.textContent = currentBoard.icon || '';
                }
            }

            const viewColumnsBtn = document.getElementById('island-view-columns-btn');
            const viewBoardBtn = document.getElementById('island-view-board-btn');
            const viewGraphBtn = document.getElementById('island-view-graph-btn');
            const selectToggleBtn = document.getElementById('island-select-toggle-btn');
            const selectText = document.getElementById('island-select-text');

            const currentMode = (state && state.viewMode) || 'columns';

            // На мобільних пристроях дошка вимкнена — перемикаємо на колонки
            if (window.innerWidth <= 768 && currentMode === 'board') {
                if (window.App.store) {
                    window.App.store.setViewMode('columns');
                } else if (state) {
                    state.viewMode = 'columns';
                }
                return this.render();
            }

            if (viewColumnsBtn) viewColumnsBtn.classList.toggle('active', currentMode === 'columns');
            if (viewBoardBtn) viewBoardBtn.classList.toggle('active', currentMode === 'board');
            if (viewGraphBtn) viewGraphBtn.classList.toggle('active', currentMode === 'graph');

            if (selectToggleBtn && selectText) {
                const t = (k, p) => (window.App && window.App.i18n) ? window.App.i18n.t(k, p) : k;
                if (state && state.isWorkspaceSelectMode) {
                    selectToggleBtn.classList.add('active');
                    selectText.textContent = t('workspace.doneBtn');
                    selectToggleBtn.title = t('workspace.exitSelectTitle');
                } else {
                    selectToggleBtn.classList.remove('active');
                    selectText.textContent = t('workspace.selectBtn');
                    selectToggleBtn.title = t('workspace.selectTitle');
                }
            }

            const topHeader = document.getElementById('workspace-top-header');
            const boardWorkspace = document.getElementById('board-workspace');
            const isBoardReadOnly = !!currentBoard.isReadOnly;

            if (boardWorkspace) boardWorkspace.classList.toggle('is-board-readonly', isBoardReadOnly);
            if (topHeader) topHeader.classList.toggle('is-board-readonly', isBoardReadOnly);

            // 1. Якщо увімкнено режим інтерактивної дошки стікерів (Canvas Sticky Board)
            if (currentMode === 'board') {
                if (!window.App.boardView) {
                    this.showCanvasLoading();
                    this.ensureBoardLoaded().then(() => this.render());
                    return;
                }
                if (topHeader) {
                    topHeader.classList.remove('graph-mode-active');
                    topHeader.classList.add('board-mode-active');
                }
                if (window.App.graphView) window.App.graphView.stopSimulation();

                els.columnsContainer.classList.add('has-canvas-mode');
                els.columnsContainer.classList.remove('has-many-columns');
                window.App.boardView.render({ preserveCamera: true });
                return;
            }

            // 2. Якщо увімкнено режим інтерактивного графа зв'язків (Obsidian Graph View)
            if (currentMode === 'graph') {
                if (!window.App.graphView) {
                    this.showCanvasLoading();
                    this.ensureGraphLoaded().then(() => this.render());
                    return;
                }
                if (topHeader) {
                    topHeader.classList.add('graph-mode-active');
                    topHeader.classList.remove('board-mode-active');
                }
                if (window.App.brushTool) window.App.brushTool.disable();
                if (window.App.eraserTool) window.App.eraserTool.disable();
                if (window.App.textSelectionToolbar) window.App.textSelectionToolbar.hide();
                if (window.App.workspaceSearch) window.App.workspaceSearch.close();
                if (window.App.boardView) window.App.boardView.cleanup();

                els.columnsContainer.classList.add('has-canvas-mode');
                els.columnsContainer.classList.remove('has-many-columns');
                window.App.graphView.render();
                return;
            }

            // 3. Класичний режим колонок (Columns View)
            els.columnsContainer.classList.remove('has-canvas-mode');

            // Зберігаємо позиції стікерів перед оновленням для FLIP-анімації
            const prevStickerRects = new Map();
            els.columnsContainer.querySelectorAll('.note-sticker[data-note-id]').forEach(card => {
                prevStickerRects.set(card.dataset.noteId, card.getBoundingClientRect());
            });

            if (topHeader && !isBoardReadOnly) topHeader.classList.remove('graph-mode-active', 'board-mode-active');
            if (window.App.graphView) window.App.graphView.stopSimulation();
            if (window.App.boardView) window.App.boardView.cleanup();

            // Якщо колонок 3 і більше — додаємо спеціальний клас для стилізації ширини
            const totalCols = (state && state.activeChain) ? state.activeChain.length : 1;
            if (totalCols >= 3) {
                els.columnsContainer.classList.add('has-many-columns');
            } else {
                els.columnsContainer.classList.remove('has-many-columns');
            }

            // Перевіряємо та застосовуємо стан розтягнутої на весь екран / залоченої колонки
            if (state && state.stretchedColumnKey) {
                const chainKeys = (state.activeChain || []).map(id => id || 'root');
                if (!chainKeys.includes(state.stretchedColumnKey)) {
                    state.stretchedColumnKey = null;
                    state.lockedColumnKey = null;
                    state.lockedScrollLeft = null;
                }
            }

            if (state && state.stretchedColumnKey) {
                els.columnsContainer.classList.add('has-stretched-column');
                if (state.lockedColumnKey) {
                    els.columnsContainer.classList.add('has-locked-column');
                } else {
                    els.columnsContainer.classList.remove('has-locked-column');
                }
            } else {
                els.columnsContainer.classList.remove('has-stretched-column', 'has-locked-column');
            }

            // Очищуємо контейнер для гарантії точного розтягування колонок без залишкових DOM-вузлів
            els.columnsContainer.innerHTML = '';

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
            if (state && state.lockedColumnKey && typeof state.lockedScrollLeft === 'number') {
                els.columnsContainer.scrollLeft = state.lockedScrollLeft;
            } else if (prevContainerScrollLeft > 0) {
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

            // Синхронізація розгортання та підсвічування активної нотатки в сайдбарі
            if (window.App.sidebarView) {
                window.App.sidebarView.expandChain(chain);
                window.App.sidebarView.setActiveNote(noteId, { autoExpand: true, scrollIntoView: true });
            }

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
        },

        updateNoteTitle(id, title) {
            const cleanTitle = (title || '').trim();
            const displayTitle = cleanTitle || 'Без назви';

            // 1. Заголовок прив'язаної дочірньої колонки
            const linkedHeader = document.querySelector(`.board-column[data-parent-id="${id}"] .column-title`);
            if (linkedHeader && linkedHeader !== document.activeElement && linkedHeader.textContent !== displayTitle) {
                linkedHeader.textContent = displayTitle;
            }

            // 2. Заголовок самої картки-стікера у робочій області
            const stickerCard = document.querySelector(`.note-sticker[data-note-id="${id}"]`);
            if (stickerCard) {
                const cardTitle = stickerCard.querySelector('.sticker-title');
                if (cardTitle && cardTitle !== document.activeElement && cardTitle.textContent !== (title || '')) {
                    cardTitle.textContent = title || '';
                    if (cleanTitle) {
                        cardTitle.removeAttribute('data-empty');
                    } else {
                        cardTitle.setAttribute('data-empty', 'true');
                    }
                }
            }

            // 3. Список прев'ю піднотаток всередині батьківських карток
            document.querySelectorAll(`.subnote-preview-item[data-subnote-id="${id}"] span:last-child`).forEach(span => {
                span.textContent = displayTitle;
            });
        },

        updateBoardTitle(id, name) {
            const state = window.App.state;
            if (state && state.activeBoardId === id) {
                const rootColTitle = document.querySelector('.board-column.root-column .column-title');
                if (rootColTitle && rootColTitle !== document.activeElement && rootColTitle.innerText !== name) {
                    rootColTitle.innerText = name;
                }

                const boardTitleEl = document.getElementById('workspace-header-board-title');
                if (boardTitleEl && boardTitleEl.textContent !== name) {
                    boardTitleEl.textContent = name;
                }
            }
        },

        focusNote(noteId) {
            if (window.App.sidebarView) {
                window.App.sidebarView.setActiveNote(noteId, { autoExpand: true, scrollIntoView: true });
            }
            setTimeout(() => {
                const noteElement = document.querySelector(`.note-sticker[data-note-id="${noteId}"]`);
                if (noteElement) {
                    noteElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const titleInput = noteElement.querySelector('.sticker-title');
                    if (titleInput) titleInput.focus();
                }
            }, 60);
        },

        createSubnoteForNote(targetNoteId) {
            const noteManager = window.App.noteManager;
            const state = window.App.state;
            if (!noteManager || !targetNoteId) return;

            const targetNote = noteManager.getNoteById(targetNoteId);
            if (!targetNote) return;

            // Перевіряємо чи блокнот або нотатка не в режимі тільки для читання
            const currentBoard = window.App.boardManager ? window.App.boardManager.getActiveBoard() : null;
            const isReadOnly = !!targetNote.isReadOnly || !!(currentBoard && currentBoard.isReadOnly) || (targetNote.boardId && targetNote.boardId.startsWith('shared_'));
            if (isReadOnly) return;

            if (state && (state.viewMode === 'board' || state.isBoardView)) {
                if (window.App.boardView && window.App.boardView.createSubnoteForNode) {
                    window.App.boardView.createSubnoteForNode(targetNoteId);
                    return;
                }
            } else if (state && (state.viewMode === 'graph' || state.isGraphView)) {
                if (window.App.graphView && window.App.graphView.createSubnoteForNode) {
                    window.App.graphView.createSubnoteForNode(targetNoteId);
                    return;
                }
            }

            // Знаходимо колонку, в якій зараз знаходиться цільова нотатка
            const cardEl = document.querySelector(`.note-sticker[data-note-id="${targetNoteId}"]`);
            const colEl = cardEl ? cardEl.closest('.board-column[data-col-index]') : null;
            let colIndex = colEl ? parseInt(colEl.dataset.colIndex, 10) : -1;

            if (colIndex === -1 && state && Array.isArray(state.activeChain)) {
                // Визначаємо індекс через ланцюжок activeChain
                const targetParentId = targetNote.parentId || null;
                colIndex = state.activeChain.indexOf(targetParentId);
            }

            if (colIndex !== -1) {
                const isNextOpen = state && Array.isArray(state.activeChain) && state.activeChain[colIndex + 1] === targetNoteId;
                if (!isNextOpen) {
                    this.toggleChain(targetNoteId, colIndex);
                }
            }

            setTimeout(() => {
                noteManager.createNewNote(targetNoteId, true);
            }, 30);
        },

        highlightNote(noteId) {
            setTimeout(() => {
                const noteElement = document.querySelector(`.note-sticker[data-note-id="${noteId}"]`);
                if (noteElement) {
                    noteElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    noteElement.classList.add('highlight-pulse');
                    setTimeout(() => noteElement.classList.remove('highlight-pulse'), 1200);
                }
            }, 100);
        }
    };
})();
