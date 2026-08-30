// js/stickerDrag.js - Логіка Drag & Drop: переміщення піднотаток в інші піднотатки, в інші колонки та в корінь
window.App = window.App || {};

window.App.initStickerDrag = function(card, handles, originalParentId) {
    const handleList = Array.isArray(handles) ? handles : [handles];

    handleList.forEach(dragHandle => {
        if (!dragHandle) return;

        dragHandle.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();

            const noteManager = window.App.noteManager;
            const confirmModal = window.App.confirmModal;
            const boardManager = window.App.boardManager;
            const draggedNoteId = card.dataset.noteId;

            const startColumnList = card.closest('.column-notes-list');
            if (!startColumnList) return;

            const initialRect = card.getBoundingClientRect();
            const BASE_NOTE_HEIGHT = 160; // Базова висота чистої нотатки
            const dragHeight = Math.min(initialRect.height, BASE_NOTE_HEIGHT);

            const shiftX = e.clientX - initialRect.left;
            const shiftY = Math.min(e.clientY - initialRect.top, dragHeight - 20);

            // Плейсхолдер (область передперегляду в списку з чіткою фіксованою висотою)
            const placeholder = document.createElement('div');
            placeholder.className = 'sticker-drag-placeholder';
            placeholder.style.height = `${dragHeight}px`;
            placeholder.style.minHeight = `${dragHeight}px`;

            card.parentNode.insertBefore(placeholder, card);

            card.classList.add('is-dragging');
            card.style.width = `${initialRect.width}px`;
            card.style.height = `${initialRect.height}px`; // Початкова висота перед плавною анімацією
            card.style.left = `${e.clientX - shiftX}px`;
            card.style.top = `${e.clientY - shiftY}px`;
            card.style.position = 'fixed';
            card.style.margin = '0';

            // На наступному кадрі плавно анімуємо висоту самої картки в руці до базової
            requestAnimationFrame(() => {
                card.style.height = `${dragHeight}px`;
            });

            let lastClientX = e.clientX;
            let lastClientY = e.clientY;
            let autoScrollAnimationId = null;
            let currentNestTarget = null;
            let currentColumnDropTarget = null; // Цільова колонка для переміщення між колонками
            // Заборонені ID для уникнення циклічних залежностей
            const invalidTargetIds = new Set([draggedNoteId, ...noteManager.getDescendantIds(draggedNoteId)]);

            function updatePositions(clientX, clientY) {
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

                        if (positionChanged && currentColumnList === startColumnList) {
                            siblings.forEach(sibling => {
                                const oldPos = oldPositions.get(sibling);
                                if (!oldPos) return;
                                const newPos = sibling.getBoundingClientRect();
                                const dy = oldPos.top - newPos.top;
                                if (dy !== 0) {
                                    sibling.style.transition = 'none';
                                    sibling.style.transform = `translateY(${dy}px)`;
                                    requestAnimationFrame(() => {
                                        sibling.style.transition = 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)';
                                        sibling.style.transform = '';
                                    });
                                }
                            });
                        }
                    }
                }
            }

            function autoScrollLoop() {
                const colRect = startColumnList.getBoundingClientRect();
                const edgeThreshold = 80;
                let scrolled = false;

                if (lastClientY < colRect.top + edgeThreshold) {
                    const dist = (colRect.top + edgeThreshold) - lastClientY;
                    const speed = Math.min(22, Math.max(3, (dist / edgeThreshold) * 20));
                    if (startColumnList.scrollTop > 0) {
                        startColumnList.scrollTop -= speed;
                        scrolled = true;
                    }
                } else if (lastClientY > colRect.bottom - edgeThreshold) {
                    const dist = lastClientY - (colRect.bottom - edgeThreshold);
                    const speed = Math.min(22, Math.max(3, (dist / edgeThreshold) * 20));
                    const maxScroll = startColumnList.scrollHeight - startColumnList.clientHeight;
                    if (startColumnList.scrollTop < maxScroll) {
                        startColumnList.scrollTop += speed;
                        scrolled = true;
                    }
                }

                if (scrolled) {
                    updatePositions(lastClientX, lastClientY);
                }

                autoScrollAnimationId = requestAnimationFrame(autoScrollLoop);
            }

            autoScrollAnimationId = requestAnimationFrame(autoScrollLoop);

            function onPointerMove(moveEvent) {
                lastClientX = moveEvent.clientX;
                lastClientY = moveEvent.clientY;

                const newLeft = moveEvent.clientX - shiftX;
                const newTop = moveEvent.clientY - shiftY;
                card.style.left = `${newLeft}px`;
                card.style.top = `${newTop}px`;

                updatePositions(lastClientX, lastClientY);
            }

            function onPointerUp() {
                if (autoScrollAnimationId) {
                    cancelAnimationFrame(autoScrollAnimationId);
                    autoScrollAnimationId = null;
                }

                window.removeEventListener('pointermove', onPointerMove);
                window.removeEventListener('pointerup', onPointerUp);
                window.removeEventListener('pointercancel', onPointerUp);

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

                // Скидаємо стилі перетягування
                placeholder.parentNode.insertBefore(card, placeholder);
                placeholder.remove();
                card.classList.remove('is-dragging');
                card.style.position = '';
                card.style.width = '';
                card.style.height = '';
                card.style.left = '';
                card.style.top = '';
                card.style.margin = '';
                card.style.transition = '';

                // Варіант 1: Відпустили над іншою нотаткою у зоні вкладення (зробити піднотаткою)
                if (nestTarget && nestTarget.dataset.noteId) {
                    const targetParentId = nestTarget.dataset.noteId;
                    const draggedNote = noteManager.getNoteById(draggedNoteId);
                    const parentNote = noteManager.getNoteById(targetParentId);

                    const draggedTitle = (draggedNote && draggedNote.title.trim()) ? draggedNote.title.trim() : 'Без назви';
                    const parentTitle = (parentNote && parentNote.title.trim()) ? parentNote.title.trim() : 'Без назви';

                    confirmModal.show({
                        title: 'Зробити піднотаткою?',
                        message: `Ви дійсно хочете зробити нотатку <span class="confirm-modal-highlight">"${draggedTitle}"</span> піднотаткою для <span class="confirm-modal-highlight">"${parentTitle}"</span>?`,
                        confirmText: 'Затисніть для переміщення',
                        type: 'info',
                        onConfirm: () => {
                            noteManager.moveNoteToParent(draggedNoteId, targetParentId);
                        }
                    });
                    return;
                }

                // Варіант 2: Відпустили над іншою колонкою (наприклад, перемістити піднотатку в головну колонку або в іншу гілку)
                if (colTarget) {
                    const newParentId = colTarget.dataset.parentId === 'root' ? null : colTarget.dataset.parentId;
                    if (newParentId !== originalParentId) {
                        const draggedNote = noteManager.getNoteById(draggedNoteId);
                        const draggedTitle = (draggedNote && draggedNote.title.trim()) ? draggedNote.title.trim() : 'Без назви';
                        const currentActiveBoard = boardManager.getActiveBoard();
                        const boardName = currentActiveBoard ? currentActiveBoard.name : 'блокнот';

                        let targetName = `колонку блокнота "${boardName}"`;
                        if (newParentId) {
                            const pNote = noteManager.getNoteById(newParentId);
                            targetName = `колонку піднотаток для "${pNote ? (pNote.title.trim() || 'Без назви') : ''}"`;
                        }

                        confirmModal.show({
                            title: newParentId === null ? 'Перемістити в головні нотатки?' : 'Перемістити в іншу колонку?',
                            message: `Ви дійсно хочете перемістити <span class="confirm-modal-highlight">"${draggedTitle}"</span> в ${targetName}?`,
                            confirmText: 'Затисніть для переміщення',
                            type: 'info',
                            onConfirm: () => {
                                noteManager.moveNoteToParent(draggedNoteId, newParentId);
                            }
                        });
                        return;
                    }
                }

                // Варіант 3: Звичайне перевпорядкування всередині тієї ж колонки
                noteManager.reorderNotes(startColumnList, originalParentId);
            }

            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
            window.addEventListener('pointercancel', onPointerUp);
        });
    });
};
