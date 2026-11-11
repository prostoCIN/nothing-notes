// js/workspace/workspaceColumn.js - Модуль побудови окремої колонки мультиколонкового простору
window.App = window.App || {};

(function() {
    function updateBreadcrumbsMask(el) {
        if (!el) return;
        const maxScroll = el.scrollWidth - el.clientWidth;
        if (maxScroll <= 2) {
            el.style.setProperty('mask-image', 'none');
            el.style.setProperty('-webkit-mask-image', 'none');
            return;
        }
        const hasLeft = el.scrollLeft > 3;
        const hasRight = el.scrollLeft < maxScroll - 3;
        let mask = 'none';
        if (hasLeft && hasRight) {
            mask = 'linear-gradient(to right, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)';
        } else if (hasLeft) {
            mask = 'linear-gradient(to right, transparent 0, black 16px, black 100%)';
        } else if (hasRight) {
            mask = 'linear-gradient(to right, black 0, black calc(100% - 16px), transparent 100%)';
        }
        el.style.setProperty('mask-image', mask);
        el.style.setProperty('-webkit-mask-image', mask);
    }

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

            const t = (k, p) => (window.App && window.App.i18n) ? window.App.i18n.t(k, p) : k;

            // Кнопка "+" для додавання нотатки в цю колонку
            let addNoteBtn = null;
            if (!isBoardReadOnly && noteManager) {
                addNoteBtn = document.createElement('button');
                addNoteBtn.className = 'column-add-note-btn';
                const addNoteTitle = colIndex === 0 ? t('column.createNote') : (t('column.createSubnote') || 'Додати піднотатку');
                const addBtnLabel = t('column.addBtnText') || 'Додати';
                addNoteBtn.title = addNoteTitle;
                addNoteBtn.setAttribute('aria-label', addNoteTitle);
                addNoteBtn.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span>${addBtnLabel}</span>
                `;
                addNoteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    noteManager.createNewNote(parentNoteId, true);
                });
            }

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
                    titleH2.title = t('column.editBoardTitle');
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
                            titleH2.textContent = originalBoardName || currentBoard.name || t('common.defaultBoard') || 'Мій блокнот';
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
                            titleH2.textContent = originalBoardName || currentBoard.name || t('common.defaultBoard') || 'Мій блокнот';
                        }
                    });
                }

                titleWrap.appendChild(boardIconPicker);
                titleWrap.appendChild(titleH2);
            } else {
                const parentNote = noteManager ? noteManager.getNoteById(parentNoteId) : null;
                const parentTitle = (parentNote && parentNote.title && parentNote.title.trim()) ? parentNote.title.trim() : (t('common.untitled') || 'Без назви');

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

                titleH2.textContent = parentTitle || t('sticker.untitled');

                if (!isBoardReadOnly && parentNote) {
                    titleH2.contentEditable = 'true';
                    titleH2.classList.add('editable-board-title');
                    titleH2.title = t('column.editNoteTitle');
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

                titleWrap.appendChild(noteIconPicker);
                titleWrap.appendChild(titleH2);

                // Додаємо послідовність відкритих рівнів (нотаток та піднотаток) у форматі навігаційних лінків (breadcrumbs)
                if (state && Array.isArray(state.activeChain) && state.activeChain.length > 1) {
                    const breadcrumbs = document.createElement('div');
                    breadcrumbs.className = 'column-title-breadcrumbs';
                    breadcrumbs.setAttribute('aria-label', t('column.breadcrumbsLabel'));

                    // Будуємо ланцюжок усіх відкритих рівнів окрім поточного (блокнот, нотатки, піднотатки)
                    const sequence = [];

                    // 1. Рівень 0 - Головний блокнот (якщо поточна колонка не є кореневою)
                    if (colIndex !== 0) {
                        sequence.push({
                            title: (currentBoard && currentBoard.name) ? currentBoard.name : t('common.defaultBoard'),
                            icon: (currentBoard && currentBoard.icon) ? currentBoard.icon : '📋',
                            colIndex: 0,
                            noteId: null
                        });
                    }

                    // 2. Усі інші відкриті нотатки та піднотатки в активному ланцюжку
                    for (let lvl = 1; lvl < state.activeChain.length; lvl++) {
                        if (lvl === colIndex) continue;
                        const chainNoteId = state.activeChain[lvl];
                        if (chainNoteId && noteManager) {
                            const chainNote = noteManager.getNoteById(chainNoteId);
                            sequence.push({
                                title: (chainNote && chainNote.title && chainNote.title.trim()) ? chainNote.title.trim() : t('sticker.untitled'),
                                icon: (chainNote && chainNote.icon) ? chainNote.icon : '📄',
                                colIndex: lvl,
                                noteId: chainNoteId
                            });
                        }
                    }

                    // Сортуємо послідовність за індексом колонок (0 -> 1 -> 2 ...)
                    sequence.sort((a, b) => a.colIndex - b.colIndex);

                    if (sequence.length > 0) {
                        // Скрол коліщатком миші по горизонталі
                        breadcrumbs.addEventListener('wheel', (e) => {
                            if (e.ctrlKey || e.metaKey) return;
                            if (breadcrumbs.scrollWidth > breadcrumbs.clientWidth) {
                                const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
                                if (delta !== 0) {
                                    breadcrumbs.scrollLeft += delta;
                                    e.preventDefault();
                                    e.stopPropagation();
                                }
                            }
                        }, { passive: false });

                        // Перетягування мишею на десктопі (drag-to-scroll)
                        let isDown = false;
                        let startX = 0;
                        let scrollStart = 0;
                        let hasDragged = false;

                        breadcrumbs.addEventListener('mousedown', (e) => {
                            if (e.button !== 0) return;
                            isDown = true;
                            hasDragged = false;
                            startX = e.pageX - breadcrumbs.offsetLeft;
                            scrollStart = breadcrumbs.scrollLeft;
                        });

                        const onMouseMove = (e) => {
                            if (!isDown) return;
                            const x = e.pageX - breadcrumbs.offsetLeft;
                            const walk = x - startX;
                            if (Math.abs(walk) > 4) {
                                hasDragged = true;
                                breadcrumbs.classList.add('is-dragging-breadcrumbs');
                            }
                            breadcrumbs.scrollLeft = scrollStart - walk;
                        };

                        const onMouseUp = () => {
                            if (isDown) {
                                isDown = false;
                                breadcrumbs.classList.remove('is-dragging-breadcrumbs');
                                setTimeout(() => {
                                    hasDragged = false;
                                }, 50);
                            }
                        };

                        breadcrumbs.addEventListener('mousemove', onMouseMove);
                        breadcrumbs.addEventListener('mouseup', onMouseUp);
                        breadcrumbs.addEventListener('mouseleave', onMouseUp);
                        window.addEventListener('mouseup', onMouseUp);

                        // Сенсорний скрол на мобільних пристроях (touch drag-to-scroll з інерцією та ізоляцією від свайпу колонок)
                        let touchStartX = 0;
                        let touchStartY = 0;
                        let touchScrollStart = 0;
                        let isTouchScrolling = false;
                        let lastTouchX = 0;
                        let lastTouchTime = 0;
                        let touchVelocity = 0;
                        let momentumAnimId = null;

                        breadcrumbs.addEventListener('touchstart', (e) => {
                            if (e.touches.length !== 1) return;
                            if (momentumAnimId) {
                                cancelAnimationFrame(momentumAnimId);
                                momentumAnimId = null;
                            }
                            const touch = e.touches[0];
                            touchStartX = touch.clientX;
                            touchStartY = touch.clientY;
                            lastTouchX = touch.clientX;
                            lastTouchTime = Date.now();
                            touchVelocity = 0;
                            touchScrollStart = breadcrumbs.scrollLeft;
                            isTouchScrolling = false;
                            hasDragged = false;
                        }, { passive: true });

                        breadcrumbs.addEventListener('touchmove', (e) => {
                            if (e.touches.length !== 1) return;
                            const touch = e.touches[0];
                            const currentX = touch.clientX;
                            const currentY = touch.clientY;
                            const deltaX = currentX - touchStartX;
                            const deltaY = currentY - touchStartY;

                            if (!isTouchScrolling) {
                                // Визначаємо чи це горизонтальний свайп по хлібних крихтах
                                if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 4) {
                                    isTouchScrolling = true;
                                    breadcrumbs.classList.add('is-dragging-breadcrumbs');
                                } else if (Math.abs(deltaY) > 6) {
                                    // Вертикальний скрол — не блокуємо
                                    return;
                                }
                            }

                            if (isTouchScrolling) {
                                hasDragged = true;
                                // Блокуємо свайп контейнера колонок (.columns-container)
                                if (e.cancelable) e.preventDefault();
                                e.stopPropagation();

                                const now = Date.now();
                                const dt = now - lastTouchTime;
                                if (dt > 0) {
                                    touchVelocity = (lastTouchX - currentX) / dt;
                                }
                                lastTouchX = currentX;
                                lastTouchTime = now;

                                breadcrumbs.scrollLeft = touchScrollStart - deltaX;
                                updateBreadcrumbsMask(breadcrumbs);
                            }
                        }, { passive: false });

                        const onTouchEnd = () => {
                            if (isTouchScrolling) {
                                isTouchScrolling = false;
                                breadcrumbs.classList.remove('is-dragging-breadcrumbs');
                                setTimeout(() => {
                                    hasDragged = false;
                                }, 120);

                                // Плавна інерція після відриву пальця
                                if (Math.abs(touchVelocity) > 0.15) {
                                    let vel = touchVelocity * 14;
                                    const glide = () => {
                                        breadcrumbs.scrollLeft += vel;
                                        updateBreadcrumbsMask(breadcrumbs);
                                        vel *= 0.88;
                                        if (Math.abs(vel) > 0.5) {
                                            momentumAnimId = requestAnimationFrame(glide);
                                        } else {
                                            momentumAnimId = null;
                                        }
                                    };
                                    momentumAnimId = requestAnimationFrame(glide);
                                }
                            }
                        };

                        breadcrumbs.addEventListener('touchend', onTouchEnd, { passive: true });
                        breadcrumbs.addEventListener('touchcancel', onTouchEnd, { passive: true });

                        // Оновлення динамічної маски країв при скролі
                        breadcrumbs.addEventListener('scroll', () => {
                            updateBreadcrumbsMask(breadcrumbs);
                        });

                        sequence.forEach((item) => {
                            const pipe = document.createElement('span');
                            pipe.className = 'column-title-pipe';
                            pipe.textContent = '|';
                            breadcrumbs.appendChild(pipe);

                            const linkBtn = document.createElement('button');
                            linkBtn.type = 'button';
                            linkBtn.className = 'column-breadcrumb-link';
                            linkBtn.title = t('column.goTo', { title: item.title });
                            linkBtn.dataset.targetColIndex = String(item.colIndex);
                            linkBtn.dataset.targetNoteId = item.noteId || 'root';
                            linkBtn.dataset.targetTitle = item.title || '';

                            const iconSpan = document.createElement('span');
                            iconSpan.className = 'column-breadcrumb-icon';
                            iconSpan.textContent = item.icon;

                            const textSpan = document.createElement('span');
                            textSpan.className = 'column-breadcrumb-text';
                            textSpan.textContent = item.title;

                            linkBtn.appendChild(iconSpan);
                            linkBtn.appendChild(textSpan);

                            linkBtn.addEventListener('dragstart', (e) => e.preventDefault());

                            linkBtn.addEventListener('click', (e) => {
                                if (hasDragged) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    return;
                                }
                                e.stopPropagation();
                                const colsContainer = document.getElementById('columns-container');
                                if (!colsContainer) return;
                                const targetCol = colsContainer.querySelector(`.board-column[data-col-index="${item.colIndex}"]`);
                                if (targetCol) {
                                    const isMobile = window.innerWidth <= 768;
                                    targetCol.scrollIntoView({
                                        behavior: 'smooth',
                                        block: 'nearest',
                                        inline: isMobile ? 'start' : 'center'
                                    });
                                    targetCol.classList.remove('column-nav-highlight');
                                    void targetCol.offsetWidth;
                                    targetCol.classList.add('column-nav-highlight');
                                    setTimeout(() => targetCol.classList.remove('column-nav-highlight'), 1400);

                                    if (item.noteId) {
                                        const card = document.querySelector(`.note-sticker[data-id="${item.noteId}"]`);
                                        if (card) {
                                            card.classList.remove('note-nav-highlight');
                                            void card.offsetWidth;
                                            card.classList.add('note-nav-highlight');
                                            setTimeout(() => card.classList.remove('note-nav-highlight'), 1400);
                                        }
                                    }
                                }
                            });

                            breadcrumbs.appendChild(linkBtn);
                        });

                        titleWrap.appendChild(breadcrumbs);

                        if (typeof ResizeObserver !== 'undefined') {
                            const ro = new ResizeObserver(() => {
                                updateBreadcrumbsMask(breadcrumbs);
                            });
                            ro.observe(breadcrumbs);
                        }
                        requestAnimationFrame(() => updateBreadcrumbsMask(breadcrumbs));
                    }
                }
            }

            // Кнопка перемикання вигляду: Список (по порядку вниз) / Сітка 2 колонки (Pinterest Masonry)
            const currentLayout = (state && state.columnLayouts && state.columnLayouts[parentKey]) || 'list';
            const layoutToggleBtn = document.createElement('button');
            layoutToggleBtn.className = `column-layout-toggle-btn ${currentLayout === 'grid' ? 'active' : ''}`;
            layoutToggleBtn.title = currentLayout === 'grid' ? t('column.layoutGridTitle') : t('column.layoutListTitle');
            
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
                if (window.App.store) {
                    window.App.store.setColumnLayout(parentKey, newLayout);
                } else if (state) {
                    state.columnLayouts = state.columnLayouts || {};
                    state.columnLayouts[parentKey] = newLayout;
                    if (window.App.storage && window.App.storage.saveColumnLayouts) {
                        window.App.storage.saveColumnLayouts(state.columnLayouts);
                    }
                }
                if (onLayoutChange) onLayoutChange();
            });

            // Кнопка розтягування колонки на весь екран та блокування скролу (3 стани: звичайний -> розтягнутий -> замочок)
            const isStretched = !!(state && state.stretchedColumnKey === parentKey);
            const isLocked = isStretched && !!(state && state.lockedColumnKey === parentKey);
            if (isStretched) {
                columnEl.classList.add('column-stretched-full');
            }
            if (isLocked) {
                columnEl.classList.add('column-locked');
            }

            const expandColumnBtn = document.createElement('button');
            expandColumnBtn.className = `column-expand-toggle-btn ${isStretched ? 'active' : ''} ${isLocked ? 'is-locked' : ''}`;
            expandColumnBtn.title = isLocked
                ? t('column.fullscreenUnlock')
                : (isStretched ? t('column.fullscreenLock') : t('column.fullscreenStretch'));

            const updateExpandIcon = (btn, mode) => {
                if (mode === 'locked') {
                    // Іконка замка (блокування скролу на розтягнутій колонці)
                    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>`;
                } else if (mode === 'stretched') {
                    // Іконка активного розтягування (стрілочки всередину)
                    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="4 14 10 14 10 20"></polyline>
                        <polyline points="20 10 14 10 14 4"></polyline>
                        <line x1="14" y1="10" x2="21" y2="3"></line>
                        <line x1="3" y1="21" x2="10" y2="14"></line>
                    </svg>`;
                } else {
                    // Іконка звичайного неактивного стану (стрілочки назовні)
                    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <polyline points="9 21 3 21 3 15"></polyline>
                        <line x1="21" y1="3" x2="14" y2="10"></line>
                        <line x1="3" y1="21" x2="10" y2="14"></line>
                    </svg>`;
                }
            };
            updateExpandIcon(expandColumnBtn, isLocked ? 'locked' : (isStretched ? 'stretched' : 'normal'));

            // Плавне синхронне центрування скролу разом із 250мс CSS-анімацією розширення/звуження
            const animateScrollToCenter = (onComplete) => {
                const container = columnEl.closest('.columns-container');
                if (!container) return;

                if (window._columnStretchScrollRaf) {
                    cancelAnimationFrame(window._columnStretchScrollRaf);
                    window._columnStretchScrollRaf = null;
                }

                const startTime = performance.now();
                const duration = 260; // 260мс — плавно узгоджено з 0.25s CSS transition

                const step = (now) => {
                    const elapsed = now - startTime;
                    const progress = Math.min(1, elapsed / duration);

                    const containerRect = container.getBoundingClientRect();
                    const columnRect = columnEl.getBoundingClientRect();
                    // Точна координата лівого краю колонки всередині скрол-контенту контейнера
                    const absoluteColLeft = (columnRect.left - containerRect.left) + container.scrollLeft;
                    // Зміщення для ідеального центрування колонки
                    const targetScroll = absoluteColLeft - Math.max(0, (container.clientWidth - columnRect.width) / 2);

                    container.scrollLeft = Math.max(0, Math.round(targetScroll));

                    if (progress < 1) {
                        window._columnStretchScrollRaf = requestAnimationFrame(step);
                    } else {
                        window._columnStretchScrollRaf = null;
                        // Фінальна точна фіксація після повного завершення переходу
                        const cRect = container.getBoundingClientRect();
                        const colRect = columnEl.getBoundingClientRect();
                        const finalColLeft = (colRect.left - cRect.left) + container.scrollLeft;
                        const finalTarget = finalColLeft - Math.max(0, (cRect.width - colRect.width) / 2);
                        container.scrollLeft = Math.max(0, Math.round(finalTarget));
                        if (typeof onComplete === 'function') onComplete();
                    }
                };

                window._columnStretchScrollRaf = requestAnimationFrame(step);
            };

            // Ротація кнопки: неактивний стан -> активний стан розтягування -> замочок -> по колу репетативно
            expandColumnBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const container = columnEl.closest('.columns-container');
                const currentlyStretched = !!(state && state.stretchedColumnKey === parentKey);
                const currentlyLocked = currentlyStretched && !!(state && state.lockedColumnKey === parentKey);

                if (!currentlyStretched) {
                    // Стан 0 -> Стан 1: Активний стан розтягування по всій ширині
                    if (state) {
                        state.stretchedColumnKey = parentKey;
                        state.lockedColumnKey = null;
                        state.lockedScrollLeft = null;
                    }
                    if (container) {
                        container.querySelectorAll('.column-stretched-full').forEach(el => {
                            el.classList.remove('column-stretched-full', 'column-locked');
                        });
                        container.querySelectorAll('.column-expand-toggle-btn.active').forEach(btn => {
                            btn.classList.remove('active', 'is-locked');
                            btn.title = t('column.fullscreenStretch');
                            updateExpandIcon(btn, 'normal');
                        });
                        container.classList.add('has-stretched-column');
                        container.classList.remove('has-locked-column');
                    }
                    columnEl.classList.add('column-stretched-full');
                    columnEl.classList.remove('column-locked');
                    expandColumnBtn.classList.add('active');
                    expandColumnBtn.classList.remove('is-locked');
                    expandColumnBtn.title = t('column.fullscreenLock');
                    updateExpandIcon(expandColumnBtn, 'stretched');

                    animateScrollToCenter();
                } else if (!currentlyLocked) {
                    // Стан 1 -> Стан 2: Стан замочок (фіксація скролу тільки по вертикалі в залоченій колонці)
                    if (state) {
                        state.lockedColumnKey = parentKey;
                    }
                    if (container) {
                        container.classList.add('has-stretched-column', 'has-locked-column');
                        state.lockedScrollLeft = container.scrollLeft;
                    }
                    columnEl.classList.add('column-stretched-full', 'column-locked');
                    expandColumnBtn.classList.add('active', 'is-locked');
                    expandColumnBtn.title = t('column.fullscreenUnlock');
                    updateExpandIcon(expandColumnBtn, 'locked');

                    animateScrollToCenter(() => {
                        if (state && state.lockedColumnKey === parentKey && container) {
                            state.lockedScrollLeft = container.scrollLeft;
                        }
                    });
                } else {
                    // Стан 2 -> Стан 0: Повернення до неактивного звичайного стану
                    if (state) {
                        state.stretchedColumnKey = null;
                        state.lockedColumnKey = null;
                        state.lockedScrollLeft = null;
                    }
                    columnEl.classList.remove('column-stretched-full', 'column-locked');
                    expandColumnBtn.classList.remove('active', 'is-locked');
                    expandColumnBtn.title = t('column.fullscreenStretch');
                    updateExpandIcon(expandColumnBtn, 'normal');
                    if (container) {
                        container.classList.remove('has-stretched-column', 'has-locked-column');
                    }
                    animateScrollToCenter();
                }
            });

            // Блок дій у шапці колонки праворуч:
            // 1. Головна дія (Primary CTA): створення нотатки
            // 2. Розділювач
            // 3. Режими відображення: сітка / розтягування
            // 4. Меню опцій
            // 5. Закриття (якщо дочірня колонка)
            const actionsWrap = document.createElement('div');
            actionsWrap.className = 'column-header-actions';

            if (addNoteBtn) {
                actionsWrap.appendChild(addNoteBtn);

                const headerDivider = document.createElement('div');
                headerDivider.className = 'column-header-divider';
                actionsWrap.appendChild(headerDivider);
            }

            actionsWrap.appendChild(layoutToggleBtn);
            actionsWrap.appendChild(expandColumnBtn);

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
                closeBtn.title = t('column.closeColumn');
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
                const emptyTextContent = colIndex === 0 ? t('column.emptyBoard') : t('column.emptySubnotes');
                const createFirstBtnText = colIndex === 0 ? t('column.createFirstNote') : t('column.createFirstSubnote');
                emptyState.innerHTML = `
                    <div class="column-empty-icon">${colIndex === 0 ? '📝' : '🔗'}</div>
                    <div class="column-empty-text">
                        ${emptyTextContent}
                    </div>
                `;

                if (!isBoardReadOnly && noteManager) {
                    const createFirstBtn = document.createElement('button');
                    createFirstBtn.className = 'btn-create-first-note';
                    createFirstBtn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="btn-plus-icon">
                            <line x1="12" y1="6" x2="12" y2="18"></line>
                            <line x1="6" y1="12" x2="18" y2="12"></line>
                        </svg>
                        <span>${createFirstBtnText}</span>
                    `;
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
                    const addBtnText = colIndex === 0 ? t('column.addNote') : t('column.addSubnote');
                    addBtn.innerHTML = `
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="btn-plus-icon">
                            <line x1="12" y1="6" x2="12" y2="18"></line>
                            <line x1="6" y1="12" x2="18" y2="12"></line>
                        </svg>
                        <span>${addBtnText}</span>
                    `;
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
