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
                li.className = `board-item ${board.id === state.activeBoardId ? 'active' : ''}`;
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

                let actionsDiv = null;
                if (window.App.sidebarActions) {
                    actionsDiv = window.App.sidebarActions.createActionButtons({
                        containerClass: 'board-actions',
                        share: {
                            title: 'Поділитись блокнотом',
                            onClick: () => {
                                if (window.App.shareManager) {
                                    window.App.shareManager.showShareModal(board.id);
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
                            onClick: () => {
                                if (window.App.boardManager) {
                                    window.App.boardManager.deleteBoard(board.id);
                                }
                            }
                        }
                    });
                }

                li.addEventListener('click', (e) => {
                    if (e.target.closest('.board-actions') || textSpan.contentEditable === 'true') return;
                    if (li.dataset.dragged === 'true') return;
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
         * Прикріплює перетягування блокнотів для ручної зміни порядку
         */
        attachBoardDrag(li, board, boardsList) {
            let startX = 0;
            let startY = 0;
            let initialRect = null;
            let shiftX = 0;
            let shiftY = 0;
            let isDragging = false;
            let placeholder = null;
            let longPressTimer = null;
            let touchDragReady = false;
            let autoScroller = null;

            const onPointerDown = (e) => {
                if (e.button !== 0 && e.pointerType === 'mouse') return;
                if (
                    e.target.closest('.board-actions') || 
                    e.target.closest('.sidebar-action-btn') || 
                    li.classList.contains('is-editing') || 
                    li.querySelector('[contenteditable="true"]')
                ) {
                    return;
                }

                if (li.classList.contains('shared-board-item')) return;

                const ownItems = boardsList.querySelectorAll('.board-item:not(.shared-board-item)');
                if (ownItems.length <= 1) return;

                startX = e.clientX;
                startY = e.clientY;
                isDragging = false;
                touchDragReady = false;
                li.dataset.dragged = 'false';

                const isTouch = e.pointerType === 'touch' || (window.innerWidth <= 768 && e.pointerType !== 'mouse');
                const isHandle = !!e.target.closest('.board-drag-handle');

                if (isTouch) {
                    if (isHandle) {
                        touchDragReady = true;
                        if (navigator.vibrate) navigator.vibrate(20);
                        li.classList.add('touch-drag-active');
                    } else {
                        longPressTimer = setTimeout(() => {
                            touchDragReady = true;
                            if (navigator.vibrate) navigator.vibrate(25);
                            li.classList.add('touch-drag-active');
                        }, 220);
                    }
                }

                const onPointerMove = (moveEv) => {
                    const deltaX = Math.abs(moveEv.clientX - startX);
                    const deltaY = Math.abs(moveEv.clientY - startY);

                    if (isTouch && !touchDragReady) {
                        if (deltaX > 6 || deltaY > 6) {
                            clearTimeout(longPressTimer);
                            longPressTimer = null;
                        }
                        return;
                    }

                    if (!isDragging) {
                        if (deltaY >= 4 || deltaX >= 4 || touchDragReady) {
                            isDragging = true;
                            li.dataset.dragged = 'true';
                            clearTimeout(longPressTimer);
                            longPressTimer = null;

                            initialRect = li.getBoundingClientRect();
                            shiftX = moveEv.clientX - initialRect.left;
                            shiftY = moveEv.clientY - initialRect.top;

                            placeholder = document.createElement('li');
                            placeholder.className = 'board-item board-item-placeholder';
                            placeholder.style.height = `${initialRect.height}px`;
                            boardsList.insertBefore(placeholder, li);

                            document.body.classList.add('is-board-reordering');
                            li.classList.add('is-board-dragging');
                            li.style.width = `${initialRect.width}px`;
                            li.style.position = 'fixed';
                            li.style.left = `${initialRect.left}px`;
                            li.style.top = `${initialRect.top}px`;
                            li.style.zIndex = '100000';
                            li.style.pointerEvents = 'none';

                            try {
                                li.setPointerCapture(moveEv.pointerId);
                            } catch {}

                            const sidebarEl = document.getElementById('sidebar');
                            if (window.App.dragUtils && window.App.dragUtils.createAutoScroller && sidebarEl) {
                                autoScroller = window.App.dragUtils.createAutoScroller(sidebarEl, {
                                    edgeThreshold: 50,
                                    maxSpeed: 16,
                                    vertical: true,
                                    horizontal: false
                                });
                                if (autoScroller && typeof autoScroller.start === 'function') {
                                    autoScroller.start();
                                }
                            }
                        } else {
                            return;
                        }
                    }

                    if (isDragging) {
                        if (moveEv.cancelable) {
                            moveEv.preventDefault();
                        }
                    }

                    li.style.top = `${moveEv.clientY - shiftY}px`;

                    if (autoScroller) {
                        autoScroller.update(moveEv.clientX, moveEv.clientY);
                    }

                    const siblings = Array.from(boardsList.querySelectorAll('.board-item:not(.is-board-dragging):not(.board-item-placeholder):not(.shared-board-item)'));
                    let placed = false;
                    for (const sib of siblings) {
                        const rect = sib.getBoundingClientRect();
                        const midY = rect.top + rect.height / 2;
                        if (moveEv.clientY < midY) {
                            boardsList.insertBefore(placeholder, sib);
                            placed = true;
                            break;
                        }
                    }
                    if (!placed && siblings.length > 0) {
                        boardsList.appendChild(placeholder);
                    }
                };

                const onPointerUp = (upEv) => {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;

                    window.removeEventListener('pointermove', onPointerMove);
                    window.removeEventListener('pointerup', onPointerUp);
                    window.removeEventListener('pointercancel', onPointerUp);

                    li.classList.remove('touch-drag-active');

                    if (autoScroller) {
                        try {
                            if (typeof autoScroller.stop === 'function') autoScroller.stop();
                            if (typeof autoScroller.destroy === 'function') autoScroller.destroy();
                        } catch (err) {
                            console.warn('[sidebarBoards] autoScroller cleanup error:', err);
                        }
                        autoScroller = null;
                    }

                    if (isDragging) {
                        try {
                            li.releasePointerCapture(upEv.pointerId);
                        } catch {}

                        document.body.classList.remove('is-board-reordering');

                        if (placeholder && placeholder.parentNode) {
                            placeholder.parentNode.insertBefore(li, placeholder);
                            placeholder.remove();
                        }

                        li.classList.remove('is-board-dragging');
                        li.style.position = '';
                        li.style.left = '';
                        li.style.top = '';
                        li.style.width = '';
                        li.style.zIndex = '';
                        li.style.pointerEvents = '';

                        const newOrderIds = Array.from(boardsList.querySelectorAll('.board-item:not(.shared-board-item)'))
                            .map(item => item.dataset.boardId)
                            .filter(Boolean);

                        if (window.App.boardManager && window.App.boardManager.reorderBoards) {
                            window.App.boardManager.reorderBoards(newOrderIds);
                        }

                        if (navigator.vibrate) navigator.vibrate(15);

                        setTimeout(() => {
                            li.dataset.dragged = 'false';
                        }, 80);
                    }
                };

                window.addEventListener('pointermove', onPointerMove, { passive: false });
                window.addEventListener('pointerup', onPointerUp);
                window.addEventListener('pointercancel', onPointerUp);
            };

            li.addEventListener('pointerdown', onPointerDown);
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
