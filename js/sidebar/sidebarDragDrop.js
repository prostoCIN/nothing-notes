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

            row.addEventListener('pointerdown', (e) => {
                // Не перетягуємо при кліку на кнопки видалення або стрілочку розгортання
                if (e.target.closest('.delete-btn') || e.target.closest('.note-toggle-arrow') || e.button !== 0) return;

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

                const onPointerMove = (moveEvent) => {
                    if (!isDragging) {
                        if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 5) {
                            isDragging = true;
                            document.body.classList.add('is-sidebar-dragging');
                            initialRect = row.getBoundingClientRect();
                            shiftX = startX - initialRect.left;
                            shiftY = startY - initialRect.top;

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
                                        const otherNode = els.notesList.querySelector(`.note-item[data-id="${dId}"]`)?.closest('.sidebar-note-tree-node');
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
                            itemWrap.style.left = `${moveEvent.clientX - shiftX}px`;
                            itemWrap.style.top = `${moveEvent.clientY - shiftY}px`;
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
                        }
                    } else {
                        itemWrap.style.left = `${moveEvent.clientX - shiftX}px`;
                        itemWrap.style.top = `${moveEvent.clientY - shiftY}px`;

                        // 1. Перевірка наведення на шапку "НОТАТКИ" (винесення піднотатки в корінь)
                        const notesHeader = document.querySelector('.notes-header');
                        if (notesHeader && parentId !== null) {
                            const headerRect = notesHeader.getBoundingClientRect();
                            if (
                                moveEvent.clientY >= headerRect.top &&
                                moveEvent.clientY <= headerRect.bottom &&
                                moveEvent.clientX >= headerRect.left &&
                                moveEvent.clientX <= headerRect.right
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
                                moveEvent.clientX >= pocketRect.left - 25 &&
                                moveEvent.clientX <= pocketRect.right + 25 &&
                                moveEvent.clientY >= pocketRect.top - 12 &&
                                moveEvent.clientY <= pocketRect.bottom + 15
                            ) {
                                isInsideActivePocketZone = true;
                                if (
                                    moveEvent.clientX >= pocketRect.left &&
                                    moveEvent.clientX <= pocketRect.right &&
                                    moveEvent.clientY >= pocketRect.top &&
                                    moveEvent.clientY <= pocketRect.bottom
                                ) {
                                    activeOpenPocket.classList.add('active-hover');
                                } else {
                                    activeOpenPocket.classList.remove('active-hover');
                                }
                            }
                        }

                        const allNestZones = [...els.notesList.querySelectorAll('.sidebar-nest-drop-zone')];
                        let hoveredNestZone = null;

                        for (const zone of allNestZones) {
                            if (invalidTargetIds.has(zone.dataset.targetId)) continue;
                            const zRect = zone.getBoundingClientRect();
                            if (
                                moveEvent.clientX >= zRect.left - 12 &&
                                moveEvent.clientX <= zRect.right + 18 &&
                                moveEvent.clientY >= zRect.top - 10 &&
                                moveEvent.clientY <= zRect.bottom + 10
                            ) {
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
                        let targetContainer = els.notesList; // За замовчуванням головний рівень (корінь)

                        // Шукаємо найближчий відкритий підсписок, якщо курсор знаходиться праворуч із відступом
                        const allSubLists = [...els.notesList.querySelectorAll('.sidebar-subnotes-list')];
                        for (const subList of allSubLists) {
                            const subRect = subList.getBoundingClientRect();
                            if (
                                moveEvent.clientY >= subRect.top &&
                                moveEvent.clientY <= subRect.bottom &&
                                moveEvent.clientX >= subRect.left - 10
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
                            if (moveEvent.clientY < middleY) {
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

                        // Плавна анімація розсування сусідніх нотаток
                        if (positionChanged) {
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
                };

                const onPointerUp = () => {
                    window.removeEventListener('pointermove', onPointerMove);
                    window.removeEventListener('pointerup', onPointerUp);
                    window.removeEventListener('pointercancel', onPointerUp);
                    document.body.classList.remove('is-sidebar-dragging');

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
                                const node = els.notesList.querySelector(`.note-item[data-id="${dId}"]`)?.closest('.sidebar-note-tree-node');
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
                        const isFinalRoot = finalContainer === els.notesList;
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

                window.addEventListener('pointermove', onPointerMove);
                window.addEventListener('pointerup', onPointerUp);
                window.addEventListener('pointercancel', onPointerUp);
            });
        }
    };
})();
