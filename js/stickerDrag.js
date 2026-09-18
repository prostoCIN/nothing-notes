// js/stickerDrag.js - Логіка Drag & Drop: переміщення піднотаток в інші піднотатки, в інші колонки та в корінь
window.App = window.App || {};

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

window.App.initStickerDrag = function(card, handles, originalParentId) {
    const handleList = Array.isArray(handles) ? handles : [handles];

    // Забороняємо браузерний нативний drag&drop для самої картки (крім вкладених polaroid-зображень)
    card.addEventListener('dragstart', (e) => {
        if (e.target.closest('.sticker-image-wrapper')) return;
        e.preventDefault();
    });

    handleList.forEach(dragHandle => {
        if (!dragHandle) return;

        dragHandle.addEventListener('dragstart', (e) => e.preventDefault());

        dragHandle.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();

            const pointerId = e.pointerId;
            try {
                dragHandle.setPointerCapture(pointerId);
            } catch (err) {}

            const onTouchMove = (touchEv) => {
                if (isDragging && touchEv.cancelable) {
                    touchEv.preventDefault();
                }
            };
            window.addEventListener('touchmove', onTouchMove, { passive: false });

            const noteManager = window.App.noteManager;
            const confirmModal = window.App.confirmModal;
            const boardManager = window.App.boardManager;
            const state = window.App.state;
            const draggedNoteId = card.dataset.noteId;

            // Перевіряємо чи нотатка перетягується в рамках мульти-вибору
            const isMultiSelectDrag = Boolean(
                state &&
                state.selectedWorkspaceNoteIds &&
                state.selectedWorkspaceNoteIds.has(draggedNoteId) &&
                state.selectedWorkspaceNoteIds.size > 1
            );

            const notesToMoveIds = isMultiSelectDrag
                ? Array.from(state.selectedWorkspaceNoteIds)
                : [draggedNoteId];

            const startColumnList = card.closest('.column-notes-list');
            if (!startColumnList) return;

            const startX = e.clientX;
            const startY = e.clientY;
            let isDragging = false;
            let placeholder = null;
            let originalParent = card.parentNode;
            let initialRect = null;
            let shiftX = 0;
            let shiftY = 0;
            let dragHeight = 160;
            const BASE_NOTE_HEIGHT = 160;

            let lastClientX = e.clientX;
            let lastClientY = e.clientY;
            let activeColumnList = startColumnList;
            const columnsContainer = (window.App.getElements && window.App.getElements().columnsContainer) || document.getElementById('columns-container');
            const verticalScroller = window.App.dragUtils.createAutoScroller(() => activeColumnList, {
                vertical: true,
                horizontal: false,
                edgeThreshold: 80,
                maxSpeed: 22
            });
            const horizontalScroller = window.App.dragUtils.createAutoScroller(columnsContainer, {
                vertical: false,
                horizontal: true,
                edgeThreshold: 80,
                maxSpeed: 24
            });

            let currentNestTarget = null;
            let currentColumnDropTarget = null;

            // Заборонені цілі для вкладення (усі вибрані нотатки та їхні нащадки, щоб уникнути циклів)
            const invalidTargetIds = new Set();
            notesToMoveIds.forEach(id => {
                invalidTargetIds.add(id);
                if (noteManager && noteManager.getDescendantIds) {
                    const desc = noteManager.getDescendantIds(id);
                    if (desc) desc.forEach(dId => invalidTargetIds.add(dId));
                }
            });

            function startDrag(clientX, clientY) {
                isDragging = true;
                if (state) {
                    state.isDraggingNote = true;
                    state.draggedNoteId = draggedNoteId;
                }
                document.body.classList.add('is-sticker-dragging');

                // Візуальна індикація групового перетягування
                if (isMultiSelectDrag) {
                    const badge = document.createElement('div');
                    badge.className = 'sticker-drag-count-badge';
                    badge.textContent = `${notesToMoveIds.length}`;
                    card.appendChild(badge);

                    notesToMoveIds.forEach(id => {
                        if (id !== draggedNoteId) {
                            const partnerCard = document.querySelector(`.note-sticker[data-note-id="${id}"]`);
                            if (partnerCard) partnerCard.classList.add('is-group-drag-partner');
                        }
                    });
                }

                // Очищаємо можливі застарілі дублікати цієї картки в DOM перед початком перетягування
                document.querySelectorAll(`.note-sticker[data-note-id="${draggedNoteId}"]`).forEach(dup => {
                    if (dup !== card) dup.remove();
                });

                initialRect = card.getBoundingClientRect();
                dragHeight = Math.min(initialRect.height, BASE_NOTE_HEIGHT);

                shiftX = startX - initialRect.left;
                shiftY = Math.min(startY - initialRect.top, dragHeight - 20);

                // Плейсхолдер (область передперегляду в списку з чіткою фіксованою висотою)
                placeholder = document.createElement('div');
                placeholder.className = 'sticker-drag-placeholder';
                placeholder.style.height = `${dragHeight}px`;
                placeholder.style.minHeight = `${dragHeight}px`;

                originalParent = card.parentNode;
                if (originalParent) {
                    originalParent.insertBefore(placeholder, card);
                }

                // Переміщуємо картку безпосередньо в body, щоб уникнути зсувів координат від батьківських backdrop-filter/transform
                document.body.appendChild(card);

                card.classList.add('is-dragging');
                card.style.transition = 'none';
                card.style.transform = 'none';
                card.style.width = `${initialRect.width}px`;
                card.style.height = `${initialRect.height}px`;
                card.style.left = `${clientX - shiftX}px`;
                card.style.top = `${clientY - shiftY}px`;
                card.style.position = 'fixed';
                card.style.zIndex = '999999';
                card.style.margin = '0';

                // На наступному кадрі плавно анімуємо висоту самої картки в руці до базової
                requestAnimationFrame(() => {
                    card.style.transition = 'height 0.22s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s ease, opacity 0.2s ease';
                    card.style.height = `${dragHeight}px`;
                });

                verticalScroller.update(clientX, clientY);
                horizontalScroller.update(clientX, clientY);
                verticalScroller.start((x, y) => updatePositions(x, y));
                horizontalScroller.start((x, y) => updatePositions(x, y));
            }

            function updatePositions(clientX, clientY) {
                if (!placeholder) return;

                // 1. Шукаємо цільову картку під курсором (серед ВСІХ карток на екрані)
                const allStickers = [...document.querySelectorAll('.note-sticker:not(.is-dragging)')];
                let hoveredCard = null;

                for (const s of allStickers) {
                    const r = s.getBoundingClientRect();
                    if (
                        clientX >= r.left &&
                        clientX <= r.right &&
                        clientY >= r.top &&
                        clientY <= r.bottom
                    ) {
                        hoveredCard = s;
                        break;
                    }
                }

                let isNesting = false;

                if (hoveredCard && !invalidTargetIds.has(hoveredCard.dataset.noteId)) {
                    const r = hoveredCard.getBoundingClientRect();
                    const vMargin = r.height * 0.22; // 22% зверху та знизу - для зміни порядку, центр - вкладення

                    if (clientY >= r.top + vMargin && clientY <= r.bottom - vMargin) {
                        // КУРСОР В ЦЕНТРІ КАРТКИ -> РЕЖИМ ВКЛАДЕННЯ (ПІДНОТАТКА)
                        isNesting = true;
                        if (currentNestTarget !== hoveredCard) {
                            if (currentNestTarget) currentNestTarget.classList.remove('drag-nest-target');
                            currentNestTarget = hoveredCard;
                            currentNestTarget.classList.add('drag-nest-target');
                        }
                    }
                }

                if (isNesting) {
                    if (currentColumnDropTarget) {
                        currentColumnDropTarget.classList.remove('drag-column-target');
                        currentColumnDropTarget = null;
                    }
                    placeholder.style.opacity = '0.2';
                    return;
                }

                // Якщо не в зоні вкладення - знімаємо підсвічування картки
                if (currentNestTarget) {
                    currentNestTarget.classList.remove('drag-nest-target');
                    currentNestTarget = null;
                }
                placeholder.style.opacity = '1';

                // 2. Визначаємо колонку під курсором
                const allColumns = [...document.querySelectorAll('.board-column')];
                let hoveredColumn = null;

                for (const col of allColumns) {
                    const r = col.getBoundingClientRect();
                    if (
                        clientX >= r.left &&
                        clientX <= r.right &&
                        clientY >= r.top &&
                        clientY <= r.bottom
                    ) {
                        hoveredColumn = col;
                        break;
                    }
                }

                const currentColumnList = hoveredColumn ? hoveredColumn.querySelector('.column-notes-list') : startColumnList;
                activeColumnList = currentColumnList || startColumnList;
                const targetColumnParentId = hoveredColumn ? (hoveredColumn.dataset.parentId === 'root' ? null : hoveredColumn.dataset.parentId) : originalParentId;

                // Якщо курсор над іншою колонкою (міжколонковий переніс)
                if (hoveredColumn && targetColumnParentId !== originalParentId && !invalidTargetIds.has(targetColumnParentId)) {
                    if (currentColumnDropTarget !== hoveredColumn) {
                        if (currentColumnDropTarget) currentColumnDropTarget.classList.remove('drag-column-target');
                        currentColumnDropTarget = hoveredColumn;
                        currentColumnDropTarget.classList.add('drag-column-target');
                    }
                } else {
                    if (currentColumnDropTarget) {
                        currentColumnDropTarget.classList.remove('drag-column-target');
                        currentColumnDropTarget = null;
                    }
                }

                // Оновлюємо порядок плейсхолдера всередині колонки
                if (currentColumnList) {
                    const masonryWrapper = currentColumnList.querySelector('.masonry-grid-wrapper');

                    if (masonryWrapper) {
                        // РЕЖИМ 2-КОЛОНКОВОЇ PINTEREST-СІТКИ
                        const colLeft = masonryWrapper.querySelector('.masonry-column-left');
                        const colRight = masonryWrapper.querySelector('.masonry-column-right');

                        if (colLeft && colRight) {
                            const leftRect = colLeft.getBoundingClientRect();
                            const rightRect = colRight.getBoundingClientRect();

                            // Якщо курсор ближче до правої підколонки — обираємо праву, інакше ліву
                            const splitX = (leftRect.right + rightRect.left) / 2;
                            const targetSubColumn = (clientX > splitX) ? colRight : colLeft;

                            const subSiblings = [...targetSubColumn.querySelectorAll('.note-sticker:not(.is-dragging)')];
                            let targetSibling = null;

                            for (const sibling of subSiblings) {
                                const rect = sibling.getBoundingClientRect();
                                const middleY = rect.top + rect.height / 2;
                                if (clientY < middleY) {
                                    targetSibling = sibling;
                                    break;
                                }
                            }

                            if (targetSibling) {
                                if (placeholder.nextElementSibling !== targetSibling || placeholder.parentNode !== targetSubColumn) {
                                    targetSubColumn.insertBefore(placeholder, targetSibling);
                                }
                            } else {
                                if (placeholder !== targetSubColumn.lastElementChild || placeholder.parentNode !== targetSubColumn) {
                                    targetSubColumn.appendChild(placeholder);
                                }
                            }
                        }
                    } else {
                        // ЗВИЧАЙНИЙ РЕЖИМ СПИСКУ (1 КОЛОНКА)
                        const siblings = [...currentColumnList.querySelectorAll('.note-sticker:not(.is-dragging)')];
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
                            if (placeholder.nextElementSibling !== targetSibling || placeholder.parentNode !== currentColumnList) {
                                currentColumnList.insertBefore(placeholder, targetSibling);
                                positionChanged = true;
                            }
                        } else {
                            const bottomContainer = currentColumnList.querySelector('.add-note-bottom-container');
                            if (bottomContainer) {
                                if (placeholder.nextElementSibling !== bottomContainer || placeholder.parentNode !== currentColumnList) {
                                    currentColumnList.insertBefore(placeholder, bottomContainer);
                                    positionChanged = true;
                                }
                            } else if (placeholder !== currentColumnList.lastElementChild || placeholder.parentNode !== currentColumnList) {
                                currentColumnList.appendChild(placeholder);
                                positionChanged = true;
                            }
                        }

                        if (positionChanged) {
                            window.App.dragUtils.animateFLIP(siblings, oldPositions, 200);
                        }
                    }
                }
            }

            function onPointerMove(moveEvent) {
                lastClientX = moveEvent.clientX;
                lastClientY = moveEvent.clientY;
                verticalScroller.update(lastClientX, lastClientY);
                horizontalScroller.update(lastClientX, lastClientY);

                if (!isDragging) {
                    if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 3) {
                        startDrag(moveEvent.clientX, moveEvent.clientY);
                    } else {
                        return;
                    }
                }

                const newLeft = moveEvent.clientX - shiftX;
                const newTop = moveEvent.clientY - shiftY;
                card.style.left = `${newLeft}px`;
                card.style.top = `${newTop}px`;

                updatePositions(lastClientX, lastClientY);
            }

            function onPointerUp(upEvent) {
                try {
                    if (dragHandle.hasPointerCapture && dragHandle.hasPointerCapture(pointerId)) {
                        dragHandle.releasePointerCapture(pointerId);
                    }
                } catch (err) {}
                window.removeEventListener('touchmove', onTouchMove, { passive: false });

                window.removeEventListener('pointermove', onPointerMove);
                window.removeEventListener('pointerup', onPointerUp);
                window.removeEventListener('pointercancel', onPointerUp);
                window.removeEventListener('blur', onPointerUp);

                verticalScroller.stop();
                horizontalScroller.stop();

                if (!isDragging) {
                    return;
                }

                if (state) {
                    state.isDraggingNote = false;
                    state.draggedNoteId = null;
                }
                document.body.classList.remove('is-sticker-dragging');

                // Очищаємо візуальні ефекти групового перетягування
                const dragCountBadge = card.querySelector('.sticker-drag-count-badge');
                if (dragCountBadge) dragCountBadge.remove();
                document.querySelectorAll('.note-sticker.is-group-drag-partner').forEach(el => {
                    el.classList.remove('is-group-drag-partner');
                });

                card.dataset.justDragged = 'true';
                setTimeout(() => {
                    delete card.dataset.justDragged;
                }, 200);

                const nestTarget = currentNestTarget;
                if (currentNestTarget) {
                    currentNestTarget.classList.remove('drag-nest-target');
                    currentNestTarget = null;
                }

                const colTarget = currentColumnDropTarget;
                if (currentColumnDropTarget) {
                    currentColumnDropTarget.classList.remove('drag-column-target');
                    currentColumnDropTarget = null;
                }

                // Скидаємо стилі перетягування та безпечно повертаємо картку в дерево DOM
                if (placeholder && placeholder.parentNode) {
                    placeholder.parentNode.insertBefore(card, placeholder);
                    placeholder.remove();
                } else if (originalParent && originalParent.isConnected) {
                    originalParent.appendChild(card);
                } else if (startColumnList && startColumnList.isConnected) {
                    startColumnList.appendChild(card);
                }

                card.classList.remove('is-dragging');
                card.style.position = '';
                card.style.width = '';
                card.style.height = '';
                card.style.left = '';
                card.style.top = '';
                card.style.margin = '';
                card.style.transition = '';
                card.style.zIndex = '';

                // Гарантуємо відсутність дублікатів картки в DOM
                const duplicates = document.querySelectorAll(`.note-sticker[data-note-id="${draggedNoteId}"]`);
                if (duplicates.length > 1) {
                    duplicates.forEach(dup => {
                        if (dup !== card) dup.remove();
                    });
                }

                if (window.App.cloudSync && window.App.cloudSync.onDragEnd) {
                    window.App.cloudSync.onDragEnd();
                }

                // Варіант 1: Відпустили над іншою нотаткою у зоні вкладення (зробити піднотаткою)
                if (nestTarget && nestTarget.dataset.noteId && noteManager) {
                    const targetParentId = nestTarget.dataset.noteId;
                    const parentNote = noteManager.getNoteById(targetParentId);
                    const parentTitle = (parentNote && parentNote.title.trim()) ? parentNote.title.trim() : 'Без назви';

                    if (isMultiSelectDrag && notesToMoveIds.length > 1) {
                        const count = notesToMoveIds.length;
                        let countPhrase = `${count} виділених нотаток`;
                        if (count === 2) {
                            countPhrase = 'цих 2 виділених нотаток';
                        } else if (count === 3 || count === 4) {
                            countPhrase = `цих ${count} виділених нотаток`;
                        } else if (count % 10 === 1 && count % 100 !== 11) {
                            countPhrase = `${count} виділену нотатку`;
                        } else if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
                            countPhrase = `${count} виділені нотатки`;
                        }

                        if (confirmModal) {
                            confirmModal.show({
                                title: 'Зробити піднотатками?',
                                message: `Ви дійсно хочете зробити з ${countPhrase} піднотатки для <span class="confirm-modal-highlight">"${escapeHtml(parentTitle)}"</span>?`,
                                confirmText: 'Затисніть для переміщення',
                                type: 'info',
                                onConfirm: () => {
                                    if (window.App.workspaceSelectionActions && window.App.workspaceSelectionActions.moveNotesToParent) {
                                        window.App.workspaceSelectionActions.moveNotesToParent(notesToMoveIds, targetParentId);
                                    } else {
                                        notesToMoveIds.forEach(id => noteManager.moveNoteToParent(id, targetParentId));
                                    }
                                }
                            });
                        } else {
                            if (window.App.workspaceSelectionActions && window.App.workspaceSelectionActions.moveNotesToParent) {
                                window.App.workspaceSelectionActions.moveNotesToParent(notesToMoveIds, targetParentId);
                            } else {
                                notesToMoveIds.forEach(id => noteManager.moveNoteToParent(id, targetParentId));
                            }
                        }
                        return;
                    }

                    // Звичайне одиночне вкладення (коли перетягується 1 нотатка)
                    const draggedNote = noteManager.getNoteById(draggedNoteId);
                    const draggedTitle = (draggedNote && draggedNote.title.trim()) ? draggedNote.title.trim() : 'Без назви';

                    if (confirmModal) {
                        confirmModal.show({
                            title: 'Зробити піднотаткою?',
                            message: `Ви дійсно хочете зробити нотатку <span class="confirm-modal-highlight">"${escapeHtml(draggedTitle)}"</span> піднотаткою для <span class="confirm-modal-highlight">"${escapeHtml(parentTitle)}"</span>?`,
                            confirmText: 'Затисніть для переміщення',
                            type: 'info',
                            onConfirm: () => {
                                if (state && state.selectedWorkspaceNoteIds && state.selectedWorkspaceNoteIds.has(draggedNoteId)) {
                                    if (window.App.workspaceSelectionActions && window.App.workspaceSelectionActions.moveNotesToParent) {
                                        window.App.workspaceSelectionActions.moveNotesToParent([draggedNoteId], targetParentId);
                                        return;
                                    }
                                }
                                noteManager.moveNoteToParent(draggedNoteId, targetParentId);
                            }
                        });
                    } else {
                        if (state && state.selectedWorkspaceNoteIds && state.selectedWorkspaceNoteIds.has(draggedNoteId)) {
                            if (window.App.workspaceSelectionActions && window.App.workspaceSelectionActions.moveNotesToParent) {
                                window.App.workspaceSelectionActions.moveNotesToParent([draggedNoteId], targetParentId);
                                return;
                            }
                        }
                        noteManager.moveNoteToParent(draggedNoteId, targetParentId);
                    }
                    return;
                }

                // Варіант 2: Відпустили над іншою колонкою
                if (colTarget && noteManager) {
                    const newParentId = colTarget.dataset.parentId === 'root' ? null : colTarget.dataset.parentId;
                    if (newParentId !== originalParentId) {
                        const currentActiveBoard = boardManager ? boardManager.getActiveBoard() : null;
                        const boardName = currentActiveBoard ? currentActiveBoard.name : 'блокнот';

                        let targetName = `колонку блокнота "${boardName}"`;
                        if (newParentId) {
                            const pNote = noteManager.getNoteById(newParentId);
                            targetName = `колонку піднотаток для "${pNote ? (pNote.title.trim() || 'Без назви') : ''}"`;
                        }

                        if (isMultiSelectDrag && notesToMoveIds.length > 1) {
                            const count = notesToMoveIds.length;
                            let countPhrase = `${count} виділених нотаток`;
                            if (count === 2) {
                                countPhrase = 'цих 2 виділених нотаток';
                            } else if (count === 3 || count === 4) {
                                countPhrase = `цих ${count} виділених нотаток`;
                            } else if (count % 10 === 1 && count % 100 !== 11) {
                                countPhrase = `${count} виділену нотатку`;
                            } else if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
                                countPhrase = `${count} виділені нотатки`;
                            }

                            if (confirmModal) {
                                confirmModal.show({
                                    title: newParentId === null ? 'Перемістити в головні нотатки?' : 'Перемістити в іншу колонку?',
                                    message: `Ви дійсно хочете перемістити ${countPhrase} в ${targetName}?`,
                                    confirmText: 'Затисніть для переміщення',
                                    type: 'info',
                                    onConfirm: () => {
                                        if (window.App.workspaceSelectionActions && window.App.workspaceSelectionActions.moveNotesToParent) {
                                            window.App.workspaceSelectionActions.moveNotesToParent(notesToMoveIds, newParentId);
                                        } else {
                                            notesToMoveIds.forEach(id => noteManager.moveNoteToParent(id, newParentId));
                                        }
                                    }
                                });
                            } else {
                                if (window.App.workspaceSelectionActions && window.App.workspaceSelectionActions.moveNotesToParent) {
                                    window.App.workspaceSelectionActions.moveNotesToParent(notesToMoveIds, newParentId);
                                } else {
                                    notesToMoveIds.forEach(id => noteManager.moveNoteToParent(id, newParentId));
                                }
                            }
                            return;
                        }

                        const draggedNote = noteManager.getNoteById(draggedNoteId);
                        const draggedTitle = (draggedNote && draggedNote.title.trim()) ? draggedNote.title.trim() : 'Без назви';

                        if (confirmModal) {
                            confirmModal.show({
                                title: newParentId === null ? 'Перемістити в головні нотатки?' : 'Перемістити в іншу колонку?',
                                message: `Ви дійсно хочете перемістити <span class="confirm-modal-highlight">"${escapeHtml(draggedTitle)}"</span> в ${targetName}?`,
                                confirmText: 'Затисніть для переміщення',
                                type: 'info',
                                onConfirm: () => {
                                    if (state && state.selectedWorkspaceNoteIds && state.selectedWorkspaceNoteIds.has(draggedNoteId)) {
                                        if (window.App.workspaceSelectionActions && window.App.workspaceSelectionActions.moveNotesToParent) {
                                            window.App.workspaceSelectionActions.moveNotesToParent([draggedNoteId], newParentId);
                                            return;
                                        }
                                    }
                                    noteManager.moveNoteToParent(draggedNoteId, newParentId);
                                }
                            });
                        } else {
                            if (state && state.selectedWorkspaceNoteIds && state.selectedWorkspaceNoteIds.has(draggedNoteId)) {
                                if (window.App.workspaceSelectionActions && window.App.workspaceSelectionActions.moveNotesToParent) {
                                    window.App.workspaceSelectionActions.moveNotesToParent([draggedNoteId], newParentId);
                                    return;
                                }
                            }
                            noteManager.moveNoteToParent(draggedNoteId, newParentId);
                        }
                        return;
                    }
                }

                // Варіант 3: Звичайне перевпорядкування всередині тієї ж колонки
                if (noteManager) {
                    const newOrderIds = extractNoteIdsFromColumn(startColumnList);
                    noteManager.reorderNotesByIds(newOrderIds, originalParentId);
                }
            }

            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
            window.addEventListener('pointercancel', onPointerUp);
            window.addEventListener('blur', onPointerUp);
        });
    });
};

function extractNoteIdsFromColumn(columnNotesList) {
    if (!columnNotesList) return [];
    const masonryWrapper = columnNotesList.querySelector('.masonry-grid-wrapper');
    if (masonryWrapper) {
        const colLeft = masonryWrapper.querySelector('.masonry-column-left');
        const colRight = masonryWrapper.querySelector('.masonry-column-right');

        const leftStickers = colLeft ? [...colLeft.querySelectorAll('.note-sticker')] : [];
        const rightStickers = colRight ? [...colRight.querySelectorAll('.note-sticker')] : [];

        const newOrderIds = [];
        const maxLen = Math.max(leftStickers.length, rightStickers.length);
        for (let i = 0; i < maxLen; i++) {
            if (i < leftStickers.length && leftStickers[i].dataset.noteId) {
                newOrderIds.push(leftStickers[i].dataset.noteId);
            }
            if (i < rightStickers.length && rightStickers[i].dataset.noteId) {
                newOrderIds.push(rightStickers[i].dataset.noteId);
            }
        }
        return newOrderIds;
    } else {
        const stickerElements = [...columnNotesList.querySelectorAll('.note-sticker')];
        return stickerElements.map(el => el.dataset.noteId).filter(Boolean);
    }
}
