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

            const rawBoards = state && state.boards ? state.boards : [];
            const boards = [...rawBoards].sort((a, b) => {
                const orderA = typeof a.orderIndex === 'number' ? a.orderIndex : 0;
                const orderB = typeof b.orderIndex === 'number' ? b.orderIndex : 0;
                return orderA - orderB;
            });

            boards.forEach(board => {
                const li = document.createElement('li');
                const isSelected = state.selectedSidebarBoardIds && state.selectedSidebarBoardIds.has(board.id);
                li.className = `board-item ${board.id === state.activeBoardId ? 'active' : ''} ${isSelected ? 'is-selected' : ''}`;
                li.dataset.boardId = board.id;

                // Ручка перетягування (Drag Handle) для зміни порядку блокнотів
                const dragHandle = document.createElement('span');
                dragHandle.className = 'board-drag-handle';
                dragHandle.title = (window.App && window.App.i18n) ? window.App.i18n.t('sidebar.dragToReorder') || 'Перетягніть для зміни порядку' : 'Перетягніть для зміни порядку';
                dragHandle.innerHTML = `
                    <svg width="8" height="12" viewBox="0 0 10 16" fill="currentColor">
                        <circle cx="2" cy="2" r="1.5" />
                        <circle cx="8" cy="2" r="1.5" />
                        <circle cx="2" cy="8" r="1.5" />
                        <circle cx="8" cy="8" r="1.5" />
                        <circle cx="2" cy="14" r="1.5" />
                        <circle cx="8" cy="14" r="1.5" />
                    </svg>
                `;

                const nameSpan = document.createElement('span');
                nameSpan.className = 'board-item-name';

                const textSpan = document.createElement('span');
                textSpan.className = 'board-item-text';
                textSpan.textContent = board.name;
                textSpan.title = (window.App && window.App.i18n) ? window.App.i18n.t('sidebar.dblClickRename') : 'Подвійний клік для редагування назви';

                let editor = null;
                if (window.App.sidebarActions) {
                    editor = window.App.sidebarActions.attachInlineEditor(li, textSpan, {
                        getCurrentText: () => board.name,
                        onSave: (newName) => {
                            if (window.App.boardManager) {
                                window.App.boardManager.renameBoard(board.id, newName);
                            }
                        }
                    });
                }

                if (board.icon) {
                    const iconSpan = document.createElement('span');
                    iconSpan.className = 'board-item-icon';
                    if (window.App.setEmojiContent) {
                        window.App.setEmojiContent(iconSpan, board.icon, null, 16);
                    } else {
                        iconSpan.textContent = board.icon;
                    }
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

                let actionsDiv = null;
                if (window.App.sidebarActions) {
                    actionsDiv = window.App.sidebarActions.createActionButtons({
                        containerClass: 'board-actions',
                        share: {
                            title: 'Поділитись блокнотом',
                            onClick: () => {
                                if (window.App.shareManager) {
                                    const isGroup = state.selectedSidebarBoardIds && state.selectedSidebarBoardIds.has(board.id) && state.selectedSidebarBoardIds.size > 1;
                                    const targetBoardIds = isGroup ? Array.from(state.selectedSidebarBoardIds) : board.id;
                                    window.App.shareManager.showShareModal(targetBoardIds);
                                }
                            }
                        },
                        edit: {
                            title: 'Перейменувати блокнот',
                            onClick: () => {
                                if (editor) editor.startEditing();
                            }
                        },
                        delete: {
                            title: 'Видалити блокнот',
                            onClick: (e) => {
                                if (window.App.boardManager) {
                                    const isGroup = state.selectedSidebarBoardIds && state.selectedSidebarBoardIds.has(board.id) && state.selectedSidebarBoardIds.size > 1;
                                    if (isGroup && window.App.boardManager.deleteBoards) {
                                        window.App.boardManager.deleteBoards(Array.from(state.selectedSidebarBoardIds), e);
                                    } else {
                                        window.App.boardManager.deleteBoard(board.id, e);
                                    }
                                }
                            }
                        }
                    });
                }

                li.addEventListener('click', (e) => {
                    if (e.target.closest('.board-actions') || textSpan.contentEditable === 'true') return;
                    if (li.dataset.dragged === 'true' || document.body.classList.contains('is-board-reordering')) return;

                    const allBoardItems = [...document.querySelectorAll('#sidebar-boards-list .board-item, #sidebar-shared-boards-list .board-item')];

                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        e.stopPropagation();
                        state.selectedSidebarBoardIds = state.selectedSidebarBoardIds || new Set();
                        if (state.selectedSidebarBoardIds.has(board.id)) {
                            state.selectedSidebarBoardIds.delete(board.id);
                            li.classList.remove('is-selected');
                        } else {
                            state.selectedSidebarBoardIds.add(board.id);
                            li.classList.add('is-selected');
                        }
                        return;
                    }

                    if (e.shiftKey) {
                        e.preventDefault();
                        e.stopPropagation();
                        state.selectedSidebarBoardIds = state.selectedSidebarBoardIds || new Set();
                        const lastSelectedId = state.selectedSidebarBoardIds.size > 0
                            ? [...state.selectedSidebarBoardIds].pop()
                            : state.activeBoardId;
                        const lastIdx = allBoardItems.findIndex(r => r.dataset.boardId === lastSelectedId);
                        const currentIdx = allBoardItems.findIndex(r => r.dataset.boardId === board.id);

                        if (lastIdx !== -1 && currentIdx !== -1) {
                            const start = Math.min(lastIdx, currentIdx);
                            const end = Math.max(lastIdx, currentIdx);
                            for (let i = start; i <= end; i++) {
                                const item = allBoardItems[i];
                                if (item.dataset.boardId) {
                                    state.selectedSidebarBoardIds.add(item.dataset.boardId);
                                    item.classList.add('is-selected');
                                }
                            }
                        } else {
                            state.selectedSidebarBoardIds.add(board.id);
                            li.classList.add('is-selected');
                        }
                        return;
                    }

                    // Звичайний клік без клавіш Shift/Ctrl
                    if (state.selectedSidebarBoardIds && state.selectedSidebarBoardIds.size > 0) {
                        state.selectedSidebarBoardIds.clear();
                        allBoardItems.forEach(item => item.classList.remove('is-selected'));
                    }

                    if (state.activeBoardId !== board.id && window.App.boardManager) {
                        window.App.boardManager.switchBoard(board.id);
                    }
                    if (window.innerWidth <= 768 && window.App.sidebarView && window.App.sidebarView.closeMobileSidebar) {
                        window.App.sidebarView.closeMobileSidebar();
                    }
                });

                li.appendChild(dragHandle);
                li.appendChild(nameSpan);
                if (countBadge) li.appendChild(countBadge);
                li.appendChild(actionsDiv);
                if (window.App.sidebarSwipe) window.App.sidebarSwipe.attachSwipe(li);
                this.attachBoardDrag(li, board, els.sidebarBoardsList);
                els.sidebarBoardsList.appendChild(li);
            });

            this.renderSharedBoardsList();
        },

        /**
         * Прикріплює обробник перетягування до рядка блокнота (перенесено з перевіреної логіки нотаток у лівій панелі)
         * @param {HTMLElement} li - DOM елемент .board-item
         * @param {Object} board - Об'єкт блокнота
         * @param {HTMLElement} boardsList - Контейнер #sidebar-boards-list
         */
        attachBoardDrag(li, board, boardsList) {
            li.addEventListener('dragstart', (e) => e.preventDefault());

            li.addEventListener('pointerdown', (e) => {
                // Не перетягуємо при редагуванні, кліку на кнопки дій, модифікаторах виділення або нелівій кнопці миші
                if (
                    li.classList.contains('is-editing') || 
                    e.target.closest('.board-actions') || 
                    e.target.closest('.sidebar-action-btn') || 
                    e.target.closest('.delete-btn') || 
                    li.querySelector('[contenteditable="true"]') || 
                    e.button !== 0 ||
                    e.shiftKey || e.ctrlKey || e.metaKey
                ) {
                    return;
                }

                // Спільні блокноти (read-only) не перетягуються
                if (li.classList.contains('shared-board-item')) return;

                const ownBoards = boardsList.querySelectorAll('.board-item:not(.shared-board-item)');
                if (ownBoards.length <= 1) return;

                const pointerId = e.pointerId;
                const isTouch = e.pointerType === 'touch' || (window.innerWidth <= 768 && e.pointerType !== 'mouse');
                const isHandle = !!e.target.closest('.board-drag-handle');
                let longPressTimer = null;
                let touchDragReady = false;

                // Для мишки захоплюємо вказівник, для тачу НЕ захоплюємо одразу, щоб працював нативний скрол списку
                if (!isTouch) {
                    try {
                        li.setPointerCapture(pointerId);
                    } catch (err) {}
                }

                const startY = e.clientY;
                const startX = e.clientX;
                let isDragging = false;
                let placeholder = null;
                const parentContainer = boardsList;
                if (!parentContainer) return;

                let initialRect = null;
                let shiftX = 0;
                let shiftY = 0;
                let lastClientX = startX;
                let lastClientY = startY;

                const boardsScroller = window.App.dragUtils.createAutoScroller(boardsList, {
                    edgeThreshold: 60,
                    maxSpeed: 18,
                    vertical: true,
                    horizontal: false
                });

                const updatePositions = (clientX, clientY) => {
                    li.style.left = `${clientX - shiftX}px`;
                    li.style.top = `${clientY - shiftY}px`;

                    const siblings = [...parentContainer.children].filter(el => {
                        return el !== li && 
                               el !== placeholder && 
                               el.classList && 
                               el.classList.contains('board-item') && 
                               !el.classList.contains('shared-board-item');
                    });

                    const oldPositions = new Map();
                    siblings.forEach(s => oldPositions.set(s, s.getBoundingClientRect()));

                    let targetSibling = null;
                    for (const sibling of siblings) {
                        const rect = sibling.getBoundingClientRect();
                        const middleY = rect.top + rect.height / 2;
                        if (clientY < middleY) {
                            targetSibling = sibling;
                            break;
                        }
                    }

                    let positionChanged = false;
                    if (targetSibling) {
                        if (placeholder.nextElementSibling !== targetSibling || placeholder.parentNode !== parentContainer) {
                            parentContainer.insertBefore(placeholder, targetSibling);
                            positionChanged = true;
                        }
                    } else {
                        if (placeholder !== parentContainer.lastElementChild || placeholder.parentNode !== parentContainer) {
                            parentContainer.appendChild(placeholder);
                            positionChanged = true;
                        }
                    }

                    // Плавна анімація розсування сусідніх блокнотів через FLIP (як у нотатках)
                    if (positionChanged && window.App.dragUtils && window.App.dragUtils.animateFLIP) {
                        window.App.dragUtils.animateFLIP(siblings, oldPositions, 200);
                    }
                };

                const initDrag = (currentX, currentY) => {
                    if (isDragging) return;
                    isDragging = true;

                    document.body.classList.add('is-board-reordering');
                    if (boardsList) {
                        boardsList.style.touchAction = 'none';
                    }

                    initialRect = li.getBoundingClientRect();
                    shiftX = startX - initialRect.left;
                    shiftY = startY - initialRect.top;

                    try {
                        li.setPointerCapture(pointerId);
                    } catch (err) {}

                    // Створюємо пунктирну область передперегляду на вихідному місці (як у нотатках)
                    placeholder = document.createElement('li');
                    placeholder.className = 'sidebar-drag-placeholder';
                    placeholder.style.height = `${initialRect.height || 36}px`;
                    parentContainer.insertBefore(placeholder, li);

                    li.classList.add('is-dragging');
                    li.style.setProperty('position', 'fixed', 'important');
                    li.style.setProperty('z-index', '10000', 'important');
                    li.style.setProperty('transition', 'none', 'important');
                    li.style.setProperty('margin', '0', 'important');
                    li.style.width = `${initialRect.width}px`;
                    li.style.left = `${currentX - shiftX}px`;
                    li.style.top = `${currentY - shiftY}px`;

                    boardsScroller.update(currentX, currentY);
                    boardsScroller.start((x, y) => updatePositions(x, y));
                };

                // На мобільних пристроях перетягування активується через гріп-ручку або після затискання (Long Press)
                let touchMoveListener = null;
                let touchEndListener = null;

                const removeTouchListeners = () => {
                    if (touchMoveListener) {
                        window.removeEventListener('touchmove', touchMoveListener, { passive: false });
                        touchMoveListener = null;
                    }
                    if (touchEndListener) {
                        window.removeEventListener('touchend', touchEndListener);
                        window.removeEventListener('touchcancel', touchEndListener);
                        touchEndListener = null;
                    }
                };

                if (isTouch) {
                    const LONG_PRESS_DELAY = 380; // мс утримання пальця на місці (як у нотатках)
                    longPressTimer = setTimeout(() => {
                        touchDragReady = true;
                        li.classList.add('touch-drag-active');
                        if (boardsList) boardsList.style.touchAction = 'none';
                        if (navigator.vibrate) {
                            try { navigator.vibrate(40); } catch (_) {}
                        }
                        initDrag(lastClientX, lastClientY);
                    }, LONG_PRESS_DELAY);

                    touchMoveListener = (touchEv) => {
                        const touch = touchEv.touches && touchEv.touches[0];
                        if (!touch) return;

                        lastClientX = touch.clientX;
                        lastClientY = touch.clientY;

                        if (!touchDragReady && !isDragging) {
                            // Якщо палець зсунувся більше ніж на 8px до завершення таймера — користувач скролить ліву панель
                            const moveDist = Math.hypot(touch.clientX - startX, touch.clientY - startY);
                            if (moveDist > 8) {
                                if (longPressTimer) {
                                    clearTimeout(longPressTimer);
                                    longPressTimer = null;
                                }
                                removeTouchListeners();
                                return;
                            }
                            return;
                        }

                        // Блокуємо нативний скрол сайдбару коли триває драг
                        if (touchEv.cancelable) {
                            touchEv.preventDefault();
                        }

                        if (isDragging) {
                            boardsScroller.update(lastClientX, lastClientY);
                            updatePositions(lastClientX, lastClientY);
                        }
                    };

                    touchEndListener = () => {
                        removeTouchListeners();
                        onPointerUp();
                    };

                    window.addEventListener('touchmove', touchMoveListener, { passive: false });
                    window.addEventListener('touchend', touchEndListener, { passive: true });
                    window.addEventListener('touchcancel', touchEndListener, { passive: true });
                }

                const onPointerMove = (moveEvent) => {
                    lastClientX = moveEvent.clientX;
                    lastClientY = moveEvent.clientY;

                    if (isTouch) {
                        if (!touchDragReady && !isDragging) {
                            const moveDist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
                            if (moveDist > 8) {
                                if (longPressTimer) {
                                    clearTimeout(longPressTimer);
                                    longPressTimer = null;
                                }
                                removeTouchListeners();
                                return;
                            }
                            return;
                        }
                    } else {
                        // На десктопі (миша) починаємо перетягування при зміщенні > 5px (як у нотатках)
                        if (!isDragging) {
                            if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 5) {
                                initDrag(moveEvent.clientX, moveEvent.clientY);
                            }
                        }
                    }

                    if (isDragging) {
                        boardsScroller.update(lastClientX, lastClientY);
                        updatePositions(lastClientX, lastClientY);
                    }
                };

                const onPointerUp = () => {
                    if (longPressTimer) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                    li.classList.remove('touch-drag-active');
                    if (boardsList) {
                        boardsList.style.touchAction = '';
                    }
                    removeTouchListeners();

                    try {
                        if (li.hasPointerCapture && li.hasPointerCapture(pointerId)) {
                            li.releasePointerCapture(pointerId);
                        }
                    } catch (err) {}

                    boardsScroller.stop();

                    window.removeEventListener('pointermove', onPointerMove);
                    window.removeEventListener('pointerup', onPointerUp);
                    window.removeEventListener('pointercancel', onPointerUp);
                    window.removeEventListener('blur', onPointerUp);
                    window.removeEventListener('contextmenu', onContextMenu);
                    document.body.classList.remove('is-board-reordering');

                    const wasDragging = isDragging;

                    if (wasDragging) {
                        // Запобігаємо випадковому відкриттю/вибору блокнота після завершення перетягування
                        const blockClick = (clickEv) => {
                            clickEv.stopPropagation();
                            clickEv.preventDefault();
                            window.removeEventListener('click', blockClick, true);
                        };
                        window.addEventListener('click', blockClick, true);
                    }

                    if (isDragging && placeholder) {
                        parentContainer.insertBefore(li, placeholder);
                        placeholder.remove();

                        li.classList.remove('is-dragging');
                        li.style.removeProperty('position');
                        li.style.removeProperty('z-index');
                        li.style.removeProperty('transition');
                        li.style.removeProperty('margin');
                        li.style.position = '';
                        li.style.width = '';
                        li.style.left = '';
                        li.style.top = '';
                        li.style.zIndex = '';

                        const orderedNodes = [...parentContainer.children].filter(el => {
                            return el.classList && 
                                   el.classList.contains('board-item') && 
                                   !el.classList.contains('shared-board-item');
                        });
                        const newOrderIds = orderedNodes.map(node => node.dataset.boardId).filter(Boolean);

                        if (window.App.boardManager && window.App.boardManager.reorderBoards) {
                            window.App.boardManager.reorderBoards(newOrderIds);
                        }

                        if (navigator.vibrate) {
                            try { navigator.vibrate(15); } catch (_) {}
                        }
                    }
                };

                const onContextMenu = (menuEv) => {
                    if (isTouch || touchDragReady || isDragging) {
                        menuEv.preventDefault();
                    }
                    if (!isTouch && longPressTimer) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                };

                window.addEventListener('pointermove', onPointerMove);
                window.addEventListener('pointerup', onPointerUp);
                window.addEventListener('pointercancel', onPointerUp);
                window.addEventListener('blur', onPointerUp);
                window.addEventListener('contextmenu', onContextMenu);
            });
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
                const isSelected = state.selectedSidebarBoardIds && state.selectedSidebarBoardIds.has(board.id);
                li.className = `board-item shared-board-item ${board.id === state.activeBoardId ? 'active' : ''} ${isSelected ? 'is-selected' : ''}`;
                li.dataset.boardId = board.id;

                const nameSpan = document.createElement('span');
                nameSpan.className = 'board-item-name';

                const t = (k, p) => (window.App && window.App.i18n) ? window.App.i18n.t(k, p) : k;
                const lockIcon = document.createElement('span');
                lockIcon.className = 'shared-board-lock-icon';
                lockIcon.title = t('sidebar.actions.readOnlyBadge');
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
                    if (window.App.setEmojiContent) {
                        window.App.setEmojiContent(iconSpan, board.icon, null, 16);
                    } else {
                        iconSpan.textContent = board.icon;
                    }
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

                // Кнопка поділитися спільним блокнотом
                const shareBtn = document.createElement('button');
                shareBtn.className = 'sidebar-action-btn share-btn';
                shareBtn.title = t('sidebar.actions.share') || 'Поділитись блокнотом';
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
                        const isGroup = state.selectedSidebarBoardIds && state.selectedSidebarBoardIds.has(board.id) && state.selectedSidebarBoardIds.size > 1;
                        const targetBoardIds = isGroup ? Array.from(state.selectedSidebarBoardIds) : board.id;
                        window.App.shareManager.showShareModal(targetBoardIds);
                    }
                });
                actionsDiv.appendChild(shareBtn);

                // Якщо автор дозволив копіювання — кнопка зберегти собі
                if (board.allowClone) {
                    const cloneBtn = document.createElement('button');
                    cloneBtn.className = 'board-clone-btn';
                    cloneBtn.title = t('sidebar.actions.cloneBoard');
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
                                title: t('confirm.cloneBoardTitle') || 'Скопіювати блокнот?',
                                message: t('confirm.cloneBoardMsg', { name: board.name }) || `Створити незалежну копію блокнота <span class="confirm-modal-highlight">"${board.name}"</span> у ваших особистих блокнотах?`,
                                confirmText: t('confirm.holdToClone') || 'Затисніть для копіювання',
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
                unlinkBtn.title = t('sidebar.actions.unlinkSharedBoard');
                unlinkBtn.innerHTML = `
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                `;
                unlinkBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isGroup = state.selectedSidebarBoardIds && state.selectedSidebarBoardIds.has(board.id) && state.selectedSidebarBoardIds.size > 1;
                    if (isGroup && window.App.boardManager && window.App.boardManager.deleteBoards) {
                        window.App.boardManager.deleteBoards(Array.from(state.selectedSidebarBoardIds), e);
                        return;
                    }

                    if (window.App.confirmModal) {
                        window.App.confirmModal.show({
                            title: t('confirm.unlinkBoardTitle') || 'Прибрати спільний блокнот?',
                            message: t('confirm.unlinkBoardMsg', { name: board.name }) || `Прибрати <span class="confirm-modal-highlight">"${board.name}"</span> зі списку спільних для читання? (Оригінал автора не постраждає).`,
                            confirmText: t('common.holdToConfirm') || 'Затисніть для видалення',
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

                    const allBoardItems = [...document.querySelectorAll('#sidebar-boards-list .board-item, #sidebar-shared-boards-list .board-item')];

                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        e.stopPropagation();
                        state.selectedSidebarBoardIds = state.selectedSidebarBoardIds || new Set();
                        if (state.selectedSidebarBoardIds.has(board.id)) {
                            state.selectedSidebarBoardIds.delete(board.id);
                            li.classList.remove('is-selected');
                        } else {
                            state.selectedSidebarBoardIds.add(board.id);
                            li.classList.add('is-selected');
                        }
                        return;
                    }

                    if (e.shiftKey) {
                        e.preventDefault();
                        e.stopPropagation();
                        state.selectedSidebarBoardIds = state.selectedSidebarBoardIds || new Set();
                        const lastSelectedId = state.selectedSidebarBoardIds.size > 0
                            ? [...state.selectedSidebarBoardIds].pop()
                            : state.activeBoardId;
                        const lastIdx = allBoardItems.findIndex(r => r.dataset.boardId === lastSelectedId);
                        const currentIdx = allBoardItems.findIndex(r => r.dataset.boardId === board.id);

                        if (lastIdx !== -1 && currentIdx !== -1) {
                            const start = Math.min(lastIdx, currentIdx);
                            const end = Math.max(lastIdx, currentIdx);
                            for (let i = start; i <= end; i++) {
                                const item = allBoardItems[i];
                                if (item.dataset.boardId) {
                                    state.selectedSidebarBoardIds.add(item.dataset.boardId);
                                    item.classList.add('is-selected');
                                }
                            }
                        } else {
                            state.selectedSidebarBoardIds.add(board.id);
                            li.classList.add('is-selected');
                        }
                        return;
                    }

                    // Звичайний клік без клавіш Shift/Ctrl
                    if (state.selectedSidebarBoardIds && state.selectedSidebarBoardIds.size > 0) {
                        state.selectedSidebarBoardIds.clear();
                        allBoardItems.forEach(item => item.classList.remove('is-selected'));
                    }

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
                if (window.App.sidebarSwipe) window.App.sidebarSwipe.attachSwipe(li);
                els.sidebarSharedBoardsList.appendChild(li);
            });
        }
    };
})();
