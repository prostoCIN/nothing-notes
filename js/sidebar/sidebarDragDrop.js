// js/sidebar/sidebarDragDrop.js - Модуль фізики перетягування нотаток у лівій панелі (груповий драг, плейсхолдер, кишені)
window.App = window.App || {};

(function() {
    window.App.sidebarDragDrop = {
        /**
         * Прикріплює обробник pointerdown перетягування до рядка нотатки
         * @param {HTMLElement} row - DOM елемент .note-item
         * @param {HTMLElement} itemWrap - DOM елемент .sidebar-note-tree-node
         * @param {Object} note - Об'єкт нотатки
         * @param {string|null} parentId - ID батьківського контейнера
         */
        attachDrag(row, itemWrap, note, parentId) {
            const state = window.App.state;
            const noteManager = window.App.noteManager;
            const sidebarView = window.App.sidebarView;
            const els = window.App.getElements();
            const notesList = (els && els.notesList) || document.getElementById('notes-list');
            row.addEventListener('dragstart', (e) => e.preventDefault());

            row.addEventListener('pointerdown', (e) => {
                // Не перетягуємо при редагуванні, кліку на кнопки дій або стрілочку розгортання
                if (row.classList.contains('is-editing') || e.target.closest('.note-actions') || e.target.closest('.sidebar-action-btn') || e.target.closest('.delete-btn') || e.target.closest('.note-toggle-arrow') || e.button !== 0) return;

                const pointerId = e.pointerId;
                const isTouch = e.pointerType === 'touch' || (window.innerWidth <= 768 && e.pointerType !== 'mouse');
                let longPressTimer = null;
                let touchDragReady = false;

                // Для мишки захоплюємо вказівник, для тачу НЕ захоплюємо одразу, щоб працював нативний скрол списку
                if (!isTouch) {
                    try {
                        row.setPointerCapture(pointerId);
                    } catch (err) {}
                }

                const startY = e.clientY;
                const startX = e.clientX;
                let isDragging = false;
                let placeholder = null;
                const parentContainer = itemWrap.parentNode;
                if (!parentContainer) return;

                const draggedNoteId = note.id;
                // Якщо перетягуємо виділену нотатку - тягнемо всю групу виділених нотаток
                const isGroupDrag = state.selectedSidebarNoteIds.has(draggedNoteId) && state.selectedSidebarNoteIds.size > 1;

                // Сортуємо draggedNoteIds строго за їхнім природним порядком у списку нотаток поточного рівня / блокнота
                let draggedNoteIds = [draggedNoteId];
                if (isGroupDrag) {
                    const boardNoteIds = state.notes
                        .filter(n => n.boardId === state.activeBoardId)
                        .map(n => n.id);
                    draggedNoteIds = boardNoteIds.filter(id => state.selectedSidebarNoteIds.has(id));
                    // Якщо якісь виділені ID не знайдені в списку блокнота, додаємо їх у кінець
                    state.selectedSidebarNoteIds.forEach(id => {
                        if (!draggedNoteIds.includes(id)) draggedNoteIds.push(id);
                    });
                }

                // Перевірка циклічних залежностей для всіх перетягуваних нотаток
                const invalidTargetIds = new Set();
                draggedNoteIds.forEach(dId => {
                    invalidTargetIds.add(dId);
                    noteManager.getDescendantIds(dId).forEach(descId => invalidTargetIds.add(descId));
                });

                let initialRect = null;
                let shiftX = 0;
                let shiftY = 0;
                let activeNestDropZone = null;
                let activeOpenPocket = null;
                let lastClientX = startX;
                let lastClientY = startY;

                const notesScroller = window.App.dragUtils.createAutoScroller(notesList, {
                    edgeThreshold: 60,
                    maxSpeed: 18,
                    vertical: true,
                    horizontal: false
                });

                const clearActiveNestZone = () => {
                    if (activeNestDropZone) {
                        activeNestDropZone.classList.remove('active-hover');
                        activeNestDropZone = null;
                    }
                    if (activeOpenPocket) {
                        activeOpenPocket.classList.remove('is-open');
                        activeOpenPocket.classList.remove('active-hover');
                        activeOpenPocket = null;
                    }
                    document.body.classList.remove('is-sidebar-pocket-open');
                };

                const updatePositions = (clientX, clientY) => {
                    itemWrap.style.left = `${clientX - shiftX}px`;
                    itemWrap.style.top = `${clientY - shiftY}px`;

                    // 1. Перевірка наведення на шапку "НОТАТКИ" (винесення піднотатки в корінь)
                    const notesHeader = document.querySelector('.notes-header');
                    if (notesHeader && parentId !== null) {
                        const headerRect = notesHeader.getBoundingClientRect();
                        if (
                            clientY >= headerRect.top &&
                            clientY <= headerRect.bottom &&
                            clientX >= headerRect.left &&
                            clientX <= headerRect.right
                        ) {
                            notesHeader.classList.add('sidebar-root-drop-target');
                            if (placeholder) placeholder.style.display = 'none';
                            clearActiveNestZone();
                            return;
                        } else {
                            notesHeader.classList.remove('sidebar-root-drop-target');
                        }
                    }

                    // 2. Перевірка наведення на іконку стрілочки праворуч (.sidebar-nest-drop-zone) або на саму розкриту кишеню (.sidebar-nest-pocket)
                    let isInsideActivePocketZone = false;

                    if (activeOpenPocket) {
                        const pocketRect = activeOpenPocket.getBoundingClientRect();
                        // Буферна зона навколо відкритої кишені (гістерезис), щоб вона не закривалася від випадкового мікро-руху
                        if (
                            clientX >= pocketRect.left - 25 &&
                            clientX <= pocketRect.right + 25 &&
                            clientY >= pocketRect.top - 12 &&
                            clientY <= pocketRect.bottom + 15
                        ) {
                            isInsideActivePocketZone = true;
                            if (
                                clientX >= pocketRect.left &&
                                clientX <= pocketRect.right &&
                                clientY >= pocketRect.top &&
                                clientY <= pocketRect.bottom
                            ) {
                                activeOpenPocket.classList.add('active-hover');
                            } else {
                                activeOpenPocket.classList.remove('active-hover');
                            }
                        }
                    }

                    const allNestZones = [...notesList.querySelectorAll('.sidebar-nest-drop-zone')];
                    let hoveredNestZone = null;

                    for (const zone of allNestZones) {
                        if (invalidTargetIds.has(zone.dataset.targetId)) continue;
                        const zRect = zone.getBoundingClientRect();
                        const parentRow = zone.closest('.note-item');
                        const rowRect = parentRow ? parentRow.getBoundingClientRect() : zRect;

                        // Спрацьовує або прямо на кнопці зі стрілкою, або у правій половині рядка нотатки
                        const isOverRightZone = parentRow && 
                            (clientX >= rowRect.left + rowRect.width * 0.45 && clientX <= rowRect.right + 25) &&
                            (clientY >= rowRect.top - 4 && clientY <= rowRect.bottom + 4);

                        const isOverNestBtn = (
                            clientX >= zRect.left - 15 &&
                            clientX <= zRect.right + 25 &&
                            clientY >= zRect.top - 12 &&
                            clientY <= zRect.bottom + 12
                        );

                        if (isOverRightZone || isOverNestBtn) {
                            hoveredNestZone = zone;
                            break;
                        }
                    }

                    if (hoveredNestZone) {
                        if (activeNestDropZone !== hoveredNestZone) {
                            if (activeNestDropZone) activeNestDropZone.classList.remove('active-hover');
                            activeNestDropZone = hoveredNestZone;
                            activeNestDropZone.classList.add('active-hover');

                            // Відкриваємо кишеню знизу цієї нотатки
                            const parentNode = hoveredNestZone.closest('.sidebar-note-tree-node');
                            const targetPocket = parentNode ? parentNode.querySelector('.sidebar-nest-pocket') : null;
                            if (activeOpenPocket && activeOpenPocket !== targetPocket) {
                                activeOpenPocket.classList.remove('is-open');
                                activeOpenPocket.classList.remove('active-hover');
                            }
                            if (targetPocket) {
                                activeOpenPocket = targetPocket;
                                activeOpenPocket.classList.add('is-open');
                                document.body.classList.add('is-sidebar-pocket-open');
                            }
                        }
                        isInsideActivePocketZone = true;
                    } else if (!isInsideActivePocketZone) {
                        // Курсор дійсно виведений далеко за межі іконки та буферної зони кишені — закриваємо
                        clearActiveNestZone();
                    }

                    // 3. ПОВНЕ БЛОКУВАННЯ: якщо кишеня відкрита або активна — повністю блокуємо стрибки плейсхолдера
                    if (isInsideActivePocketZone || activeOpenPocket) {
                        if (placeholder) {
                            placeholder.style.display = 'none';
                        }
                        return;
                    } else {
                        if (placeholder) {
                            placeholder.style.display = '';
                        }
                    }

                    // 4. Звичайне переміщення між нотатками за допомогою плейсхолдера
                    let targetContainer = notesList; // За замовчуванням головний рівень (корінь)

                    // Шукаємо найбільш вкладений (глибокий) відкритий підсписок, якщо курсор знаходиться праворуч із відступом
                    const allSubLists = [...notesList.querySelectorAll('.sidebar-subnotes-list')];
                    for (let i = allSubLists.length - 1; i >= 0; i--) {
                        const subList = allSubLists[i];
                        const subRect = subList.getBoundingClientRect();
                        if (
                            clientY >= subRect.top &&
                            clientY <= subRect.bottom &&
                            clientX >= subRect.left - 10
                        ) {
                            targetContainer = subList;
                            break;
                        }
                    }

                    // Виключаємо всі вузли, які зараз перетягуються (всю виділену групу)
                    const siblings = [...targetContainer.children].filter(el => {
                        if (el === itemWrap || el === placeholder || !el.classList.contains('sidebar-note-tree-node')) return false;
                        const r = el.querySelector('.note-item');
                        const id = r ? r.dataset.id : null;
                        return !draggedNoteIds.includes(id);
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
                        if (placeholder.nextElementSibling !== targetSibling || placeholder.parentNode !== targetContainer) {
                            targetContainer.insertBefore(placeholder, targetSibling);
                            positionChanged = true;
                        }
                    } else {
                        if (placeholder !== targetContainer.lastElementChild || placeholder.parentNode !== targetContainer) {
                            targetContainer.appendChild(placeholder);
                            positionChanged = true;
                        }
                    }

                    // Плавна анімація розсування сусідніх нотаток через DragUtils
                    if (positionChanged) {
                        window.App.dragUtils.animateFLIP(siblings, oldPositions, 200);
                    }
                };

                const initDrag = (currentX, currentY) => {
                    if (isDragging) return;
                    isDragging = true;
                    if (state) {
                        state.isDraggingNote = true;
                        state.draggedNoteId = draggedNoteId;
                    }
                    document.body.classList.add('is-sidebar-dragging');
                    if (notesList) {
                        notesList.style.touchAction = 'none';
                    }
                    initialRect = row.getBoundingClientRect();
                    shiftX = startX - initialRect.left;
                    shiftY = startY - initialRect.top;

                    try {
                        row.setPointerCapture(pointerId);
                    } catch (err) {}

                    // Розраховуємо висоту зони передперегляду відповідно до кількості перетягуваних нотаток
                    const singleItemHeight = initialRect.height || 32;
                    const totalGroupHeight = isGroupDrag 
                        ? (singleItemHeight * draggedNoteIds.length + (draggedNoteIds.length - 1) * 3) 
                        : singleItemHeight;

                    // Створюємо пунктирну область передперегляду на вихідному місці
                    placeholder = document.createElement('li');
                    placeholder.className = 'sidebar-drag-placeholder';
                    placeholder.style.height = `${totalGroupHeight}px`;
                    parentContainer.insertBefore(placeholder, itemWrap);

                    // Якщо це групове перетягування — тимчасово приховуємо інші виділені нотатки зі списку
                    if (isGroupDrag) {
                        draggedNoteIds.forEach(dId => {
                            if (dId !== draggedNoteId) {
                                const otherNode = notesList.querySelector(`.note-item[data-id="${dId}"]`)?.closest('.sidebar-note-tree-node');
                                if (otherNode) {
                                    otherNode.style.display = 'none';
                                }
                            }
                        });
                    }

                    // Приховуємо дочірні підсписки та кишеню перетягуваного вузла на час польоту
                    const childSubList = itemWrap.querySelector('.sidebar-subnotes-list');
                    if (childSubList) childSubList.style.display = 'none';
                    const ownPocket = itemWrap.querySelector('.sidebar-nest-pocket');
                    if (ownPocket) ownPocket.style.display = 'none';

                    itemWrap.style.width = `${initialRect.width}px`;
                    itemWrap.style.left = `${currentX - shiftX}px`;
                    itemWrap.style.top = `${currentY - shiftY}px`;
                    itemWrap.style.zIndex = '10000';
                    itemWrap.style.position = 'fixed';
                    itemWrap.classList.add('is-dragging');

                    // Додаємо індикатор кількості перетягуваних елементів прямо на картку в руці
                    if (isGroupDrag) {
                        const badge = document.createElement('div');
                        badge.className = 'sidebar-drag-count-badge';
                        badge.textContent = draggedNoteIds.length;
                        row.appendChild(badge);
                    }

                    notesScroller.update(currentX, currentY);
                    notesScroller.start((x, y) => updatePositions(x, y));
                };

                // На мобільних пристроях перетягування активується тільки після затискання (Long Press)
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
                    const LONG_PRESS_DELAY = 380; // мс утримання пальця на місці
                    longPressTimer = setTimeout(() => {
                        touchDragReady = true;
                        row.classList.add('touch-drag-active');
                        if (notesList) {
                            notesList.style.touchAction = 'none';
                        }
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
                                return; // Дозволяємо браузеру вільно скролити список нотаток
                            }
                            return;
                        }

                        // Таймер спрацював або драг уже активний — повністю блокуємо нативний скрол сайдбару
                        if (touchEv.cancelable) {
                            touchEv.preventDefault();
                        }

                        if (isDragging) {
                            notesScroller.update(lastClientX, lastClientY);
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
                            // Якщо палець зсунувся більше ніж на 8px до завершення таймера — користувач скролить ліву панель
                            const moveDist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
                            if (moveDist > 8) {
                                if (longPressTimer) {
                                    clearTimeout(longPressTimer);
                                    longPressTimer = null;
                                }
                                removeTouchListeners();
                                return; // Дозволяємо браузеру вільно скролити список нотаток
                            }
                            return;
                        }
                    } else {
                        // На десктопі (миша) починаємо перетягування при зміщенні > 5px
                        if (!isDragging) {
                            if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 5) {
                                initDrag(moveEvent.clientX, moveEvent.clientY);
                            }
                        }
                    }

                    if (isDragging) {
                        notesScroller.update(lastClientX, lastClientY);
                        updatePositions(lastClientX, lastClientY);
                    }
                };

                const onPointerUp = () => {
                    if (longPressTimer) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                    row.classList.remove('touch-drag-active');
                    if (notesList) {
                        notesList.style.touchAction = '';
                    }
                    removeTouchListeners();

                    try {
                        if (row.hasPointerCapture && row.hasPointerCapture(pointerId)) {
                            row.releasePointerCapture(pointerId);
                        }
                    } catch (err) {}

                    notesScroller.stop();

                    window.removeEventListener('pointermove', onPointerMove);
                    window.removeEventListener('pointerup', onPointerUp);
                    window.removeEventListener('pointercancel', onPointerUp);
                    window.removeEventListener('blur', onPointerUp);
                    window.removeEventListener('contextmenu', onContextMenu);
                    document.body.classList.remove('is-sidebar-dragging');

                    const wasDragging = isDragging;

                    if (state) {
                        state.isDraggingNote = false;
                        state.draggedNoteId = null;
                    }

                    if (wasDragging) {
                        // Запобігаємо випадковому відкриттю/вибору нотатки після завершення перетягування
                        const blockClick = (clickEv) => {
                            clickEv.stopPropagation();
                            clickEv.preventDefault();
                            window.removeEventListener('click', blockClick, true);
                        };
                        window.addEventListener('click', blockClick, true);
                    }

                    const notesHeader = document.querySelector('.notes-header');
                    const droppedOnRootHeader = notesHeader && notesHeader.classList.contains('sidebar-root-drop-target');
                    if (notesHeader) notesHeader.classList.remove('sidebar-root-drop-target');

                    const nestTargetId = (activeOpenPocket && activeOpenPocket.dataset.targetId) ||
                                          (activeNestDropZone && activeNestDropZone.dataset.targetId) || null;
                    clearActiveNestZone();

                    if (isDragging && placeholder) {
                        itemWrap.classList.remove('is-dragging');
                        itemWrap.style.position = '';
                        itemWrap.style.width = '';
                        itemWrap.style.left = '';
                        itemWrap.style.top = '';
                        itemWrap.style.zIndex = '';
                        const childSubList = itemWrap.querySelector('.sidebar-subnotes-list');
                        if (childSubList) childSubList.style.display = '';
                        const ownPocket = itemWrap.querySelector('.sidebar-nest-pocket');
                        if (ownPocket) ownPocket.style.display = '';

                        const countBadge = itemWrap.querySelector('.sidebar-drag-count-badge') || row.querySelector('.sidebar-drag-count-badge');
                        if (countBadge) countBadge.remove();

                        // Відновлюємо видимість для всіх прихованих вузлів групи
                        if (isGroupDrag) {
                            draggedNoteIds.forEach(dId => {
                                const node = notesList.querySelector(`.note-item[data-id="${dId}"]`)?.closest('.sidebar-note-tree-node');
                                if (node) node.style.display = '';
                            });
                        }

                        const finalContainer = placeholder.parentNode || parentContainer;

                        // Варіант 1: Відпустили над шапкою "НОТАТКИ" (винести піднотатки в головні нотатки)
                        if (droppedOnRootHeader && parentId !== null) {
                            finalContainer.insertBefore(itemWrap, placeholder);
                            placeholder.remove();

                            const currentBoard = window.App.boardManager.getActiveBoard();
                            const boardName = currentBoard ? currentBoard.name : 'блокнот';

                            const confirmTitle = isGroupDrag
                                ? `Перемістити ${draggedNoteIds.length} нотатки в головні?`
                                : 'Перемістити в головні нотатки?';

                            const confirmMsg = isGroupDrag
                                ? `Ви дійсно хочете зробити <span class="confirm-modal-highlight">${draggedNoteIds.length} виділені нотатки</span> головними нотатками блокнота "${boardName}"?`
                                : `Ви дійсно хочете зробити <span class="confirm-modal-highlight">"${(noteManager.getNoteById(draggedNoteId) || {}).title || 'Без назви'}"</span> головною нотаткою блокнота "${boardName}"?`;

                            const confirmModal = window.App.confirmModal;
                            confirmModal.show({
                                title: confirmTitle,
                                message: confirmMsg,
                                confirmText: 'Затисніть для переміщення',
                                type: 'info',
                                onConfirm: () => {
                                    draggedNoteIds.forEach(id => noteManager.moveNoteToParent(id, null, false));
                                    state.selectedSidebarNoteIds.clear();
                                    window.App.renderApp();
                                }
                            });
                            return;
                        }

                        // Варіант 2: Відпустили над іконкою-кишенькою або розкритою кишенею знизу (.sidebar-nest-pocket)
                        if (nestTargetId) {
                            finalContainer.insertBefore(itemWrap, placeholder);
                            placeholder.remove();

                            const targetParentId = nestTargetId;
                            const targetParentNote = noteManager.getNoteById(targetParentId);
                            const parentTitle = (targetParentNote && targetParentNote.title.trim()) ? targetParentNote.title.trim() : 'Без назви';

                            const confirmTitle = isGroupDrag
                                ? `Зробити ${draggedNoteIds.length} нотатки піднотатками?`
                                : 'Зробити піднотаткою?';

                            const confirmMsg = isGroupDrag
                                ? `Ви дійсно хочете перемістити <span class="confirm-modal-highlight">${draggedNoteIds.length} виділені нотатки</span> у піднотатки для <span class="confirm-modal-highlight">"${parentTitle}"</span>?`
                                : `Ви дійсно хочете зробити нотатку <span class="confirm-modal-highlight">"${(noteManager.getNoteById(draggedNoteId) || {}).title || 'Без назви'}"</span> піднотаткою для <span class="confirm-modal-highlight">"${parentTitle}"</span>?`;

                            const confirmModal = window.App.confirmModal;
                            confirmModal.show({
                                title: confirmTitle,
                                message: confirmMsg,
                                confirmText: 'Затисніть для переміщення',
                                type: 'info',
                                onConfirm: () => {
                                    state.expandedSidebarNoteIds.add(targetParentId);
                                    draggedNoteIds.forEach(id => noteManager.moveNoteToParent(id, targetParentId, false));
                                    state.selectedSidebarNoteIds.clear();
                                    window.App.renderApp();
                                },
                                onCancel: () => {
                                    sidebarView.renderNotesList();
                                }
                            });
                            return;
                        }

                        // Варіант 3: Переміщення між різними контейнерами (наприклад, перетягли піднотатку в головний список root)
                        const isFinalRoot = finalContainer === notesList;
                        const finalParentNode = isFinalRoot ? null : finalContainer.closest('.sidebar-note-tree-node');
                        const finalParentId = isFinalRoot ? null : (finalParentNode && finalParentNode.querySelector('.note-item') ? finalParentNode.querySelector('.note-item').dataset.id : null);

                        if (finalParentId !== parentId) {
                            // Отримуємо існуючі нотатки цільового рівня
                            const targetExistingNotes = noteManager.getNotesForColumn(finalParentId);
                            const targetExistingIds = targetExistingNotes.map(n => n.id);

                            // Визначаємо точний порядок вставки на новому рівні з позиції плейсхолдера
                            const allChildren = [...finalContainer.children];
                            const targetNewOrderIds = [];
                            let groupInserted = false;

                            allChildren.forEach((child) => {
                                if (child === placeholder) {
                                    targetNewOrderIds.push(...draggedNoteIds);
                                    groupInserted = true;
                                } else if (child.classList && child.classList.contains('sidebar-note-tree-node')) {
                                    const r = child.querySelector('.note-item');
                                    const id = r ? r.dataset.id : null;
                                    if (id && targetExistingIds.includes(id) && !draggedNoteIds.includes(id)) {
                                        targetNewOrderIds.push(id);
                                    }
                                }
                            });

                            if (!groupInserted) {
                                targetNewOrderIds.push(...draggedNoteIds);
                            }

                            finalContainer.insertBefore(itemWrap, placeholder);
                            placeholder.remove();

                            const currentBoard = window.App.boardManager.getActiveBoard();
                            const boardName = currentBoard ? currentBoard.name : 'блокнот';

                            const targetTitle = finalParentId === null
                                ? `головні нотатки блокнота "${boardName}"`
                                : `піднотатки для "${(noteManager.getNoteById(finalParentId) || {}).title || 'Без назви'}"`;

                            const confirmTitle = isGroupDrag
                                ? `Перемістити ${draggedNoteIds.length} нотатки?`
                                : (finalParentId === null ? 'Перемістити в головні нотатки?' : 'Перемістити в іншу гілку?');

                            const confirmMsg = isGroupDrag
                                ? `Ви дійсно хочете перемістити <span class="confirm-modal-highlight">${draggedNoteIds.length} виділені нотатки</span> в ${targetTitle}?`
                                : `Ви дійсно хочете перемістити <span class="confirm-modal-highlight">"${(noteManager.getNoteById(draggedNoteId) || {}).title || 'Без назви'}"</span> в ${targetTitle}?`;

                            const confirmModal = window.App.confirmModal;
                            confirmModal.show({
                                title: confirmTitle,
                                message: confirmMsg,
                                confirmText: 'Затисніть для переміщення',
                                type: 'info',
                                onConfirm: () => {
                                    if (finalParentId) state.expandedSidebarNoteIds.add(finalParentId);
                                    // 1. Оновлюємо parentId для всіх перетягуваних нотаток без проміжного рендеру
                                    draggedNoteIds.forEach(id => {
                                        const note = noteManager.getNoteById(id);
                                        if (note) {
                                            note.parentId = finalParentId;
                                            note.updatedAt = Date.now();
                                            if (window.App.cloudSync && window.App.cloudSync.syncNote) {
                                                window.App.cloudSync.syncNote(note);
                                            }
                                        }
                                    });
                                    // 2. Впорядковуємо нотатки на новому рівні строго за позицією плейсхолдера
                                    noteManager.reorderNotesByIds(targetNewOrderIds, finalParentId);
                                    state.selectedSidebarNoteIds.clear();
                                    window.App.renderApp();
                                },
                                onCancel: () => {
                                    sidebarView.renderNotesList();
                                }
                            });
                            return;
                        }

                        // Варіант 4: Звичайне перевпорядкування в межах того самого рівня
                        if (isGroupDrag) {
                            // Отримуємо всі ID поточного рівня
                            const allCurrentLevelNotes = noteManager.getNotesForColumn(parentId);
                            const currentLevelIds = allCurrentLevelNotes.map(n => n.id);

                            // Відбираємо з виділених тільки ті, що належать поточному рівню
                            const groupIdsOnLevel = draggedNoteIds.filter(id => currentLevelIds.includes(id));
                            
                            // Отримуємо всі вузли контейнера включно з плейсхолдером перед переміщенням
                            const allChildren = [...finalContainer.children];

                            const newOrderIds = [];
                            let groupInserted = false;

                            allChildren.forEach((child) => {
                                if (child === placeholder) {
                                    newOrderIds.push(...groupIdsOnLevel);
                                    groupInserted = true;
                                } else if (child.classList && child.classList.contains('sidebar-note-tree-node')) {
                                    const r = child.querySelector('.note-item');
                                    const id = r ? r.dataset.id : null;
                                    // Додаємо тільки невиділені нотатки поточного рівня
                                    if (id && currentLevelIds.includes(id) && !groupIdsOnLevel.includes(id)) {
                                        newOrderIds.push(id);
                                    }
                                }
                            });

                            if (!groupInserted) {
                                newOrderIds.push(...groupIdsOnLevel);
                            }

                            finalContainer.insertBefore(itemWrap, placeholder);
                            placeholder.remove();

                            noteManager.reorderNotesByIds(newOrderIds, parentId);
                        } else {
                            finalContainer.insertBefore(itemWrap, placeholder);
                            placeholder.remove();

                            const orderedNodes = [...finalContainer.children].filter(el => el.classList.contains('sidebar-note-tree-node'));
                            const newOrderIds = orderedNodes.map(node => {
                                const r = node.querySelector('.note-item');
                                return r ? r.dataset.id : null;
                            }).filter(Boolean);

                            noteManager.reorderNotesByIds(newOrderIds, parentId);
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
        }
    };
})();
