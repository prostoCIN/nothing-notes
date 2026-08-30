// js/sidebar/sidebarTree.js - Модуль рендерингу дерева нотаток та їхніх підсписків у сайдбарі
window.App = window.App || {};

(function() {
    window.App.sidebarTree = {
        /**
         * Рендерить рівень дерева нотаток
         * @param {string|null} parentId - ID батьківського елемента (або null для головного списку)
         * @param {HTMLElement} container - DOM контейнер для вставки (ul)
         * @param {number} depth - Глибина вкладеності
         * @param {Function} onSelectNote - Коллбек при кліку на нотатку
         */
        renderLevel(parentId, container, depth = 0, onSelectNote) {
            const state = window.App.state;
            const noteManager = window.App.noteManager;
            const sidebarView = window.App.sidebarView;
            const els = window.App.getElements();

            const levelNotes = state.notes.filter(n => n.boardId === state.activeBoardId && (n.parentId || null) === parentId);

            levelNotes.forEach(note => {
                const itemWrap = document.createElement('li');
                itemWrap.className = 'sidebar-note-tree-node';

                const row = document.createElement('div');
                row.className = 'note-item';
                row.dataset.id = note.id;

                const childCount = noteManager.getChildNotesCount(note.id);
                const isExpanded = state.expandedSidebarNoteIds.has(note.id);

                // Кнопка стрілочки для розгортання/згортання (лише якщо є піднотатки)
                if (childCount > 0) {
                    const arrowBtn = document.createElement('button');
                    arrowBtn.className = `note-toggle-arrow ${isExpanded ? 'expanded' : ''}`;
                    arrowBtn.innerHTML = `
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    `;
                    arrowBtn.title = isExpanded ? 'Згорнути піднотатки' : 'Розгорнути піднотатки';
                    arrowBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (state.expandedSidebarNoteIds.has(note.id)) {
                            state.expandedSidebarNoteIds.delete(note.id);
                        } else {
                            state.expandedSidebarNoteIds.add(note.id);
                        }
                        sidebarView.renderNotesList();
                    });
                    row.appendChild(arrowBtn);
                }

                // Notion емодзі іконка в сайдбарі
                const emojiSpan = document.createElement('span');
                emojiSpan.className = 'note-item-icon';
                emojiSpan.textContent = note.icon || '📄';

                const titleSpan = document.createElement('span');
                titleSpan.className = 'note-item-title';
                titleSpan.textContent = note.title.trim() || 'Без назви';

                // Лічильник піднотаток для нотатки у сайдбарі
                if (childCount > 0) {
                    const countBadge = document.createElement('span');
                    countBadge.className = 'sidebar-child-count';
                    countBadge.textContent = childCount;
                    row.appendChild(emojiSpan);
                    row.appendChild(titleSpan);
                    row.appendChild(countBadge);
                } else {
                    row.appendChild(emojiSpan);
                    row.appendChild(titleSpan);
                }

                // Спеціальна зона-іконка для перетворення на піднотатку (розташована праворуч)
                const nestZone = document.createElement('div');
                nestZone.className = 'sidebar-nest-drop-zone';
                nestZone.title = 'Перетягніть сюди, щоб зробити піднотаткою';
                nestZone.dataset.targetId = note.id;
                nestZone.innerHTML = `
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                `;

                const delBtn = document.createElement('button');
                delBtn.className = 'delete-btn';
                delBtn.innerHTML = `
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                `;
                delBtn.title = 'Видалити нотатку';
                delBtn.addEventListener('click', (e) => noteManager.deleteNote(note.id, e));

                // Логіка перетягування (Drag & Drop)
                window.App.sidebarDragDrop.attachDrag(row, itemWrap, note, parentId);

                const isSelected = state.selectedSidebarNoteIds.has(note.id);
                if (isSelected) {
                    row.classList.add('is-selected');
                }

                row.addEventListener('click', (e) => {
                    if (e.target.closest('.delete-btn') || e.target.closest('.note-toggle-arrow')) return;

                    const allVisibleRows = [...els.notesList.querySelectorAll('.note-item[data-id]')];

                    if (e.ctrlKey || e.metaKey) {
                        // Ctrl + Клік: інвертуємо виділення конкретної нотатки
                        if (state.selectedSidebarNoteIds.has(note.id)) {
                            state.selectedSidebarNoteIds.delete(note.id);
                            row.classList.remove('is-selected');
                        } else {
                            state.selectedSidebarNoteIds.add(note.id);
                            row.classList.add('is-selected');
                        }
                    } else if (e.shiftKey && state.selectedSidebarNoteIds.size > 0) {
                        // Shift + Клік: виділяємо діапазон як у Windows Explorer
                        const lastSelectedId = [...state.selectedSidebarNoteIds].pop();
                        const lastIdx = allVisibleRows.findIndex(r => r.dataset.id === lastSelectedId);
                        const currentIdx = allVisibleRows.findIndex(r => r.dataset.id === note.id);

                        if (lastIdx !== -1 && currentIdx !== -1) {
                            const start = Math.min(lastIdx, currentIdx);
                            const end = Math.max(lastIdx, currentIdx);
                            for (let i = start; i <= end; i++) {
                                const r = allVisibleRows[i];
                                state.selectedSidebarNoteIds.add(r.dataset.id);
                                r.classList.add('is-selected');
                            }
                        }
                    } else {
                        // Звичайний клік: виділяємо поточну нотатку та переходимо до неї
                        state.selectedSidebarNoteIds.clear();
                        allVisibleRows.forEach(r => r.classList.remove('is-selected'));
                        state.selectedSidebarNoteIds.add(note.id);
                        row.classList.add('is-selected');

                        if (onSelectNote) {
                            onSelectNote(note.id);
                        }
                    }
                });

                // Відкриття меню налаштувань нотатки по кліку правою кнопкою миші (Context Menu)
                row.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // Закриваємо всі відкриті меню
                    document.querySelectorAll('.sticker-menu-dropdown.active, .sticker-emoji-picker-dropdown.active, .sticker-tag-dropdown.active, .column-filter-dropdown.active, .sidebar-context-menu').forEach(el => {
                        el.classList.remove('active', 'open-upward');
                        if (el.classList.contains('sidebar-context-menu')) el.remove();
                    });

                    // Виділяємо нотатку
                    state.selectedSidebarNoteIds.clear();
                    els.notesList.querySelectorAll('.note-item.is-selected').forEach(r => r.classList.remove('is-selected'));
                    state.selectedSidebarNoteIds.add(note.id);
                    row.classList.add('is-selected');

                    if (window.App.stickerMenu && window.App.stickerMenu.createDropdown) {
                        const targetCard = document.querySelector(`.note-sticker[data-note-id="${note.id}"]`);
                        const contextMenu = window.App.stickerMenu.createDropdown(note, targetCard, 0, false, () => {
                            contextMenu.remove();
                        });

                        contextMenu.classList.add('active', 'sidebar-context-menu');
                        document.body.appendChild(contextMenu);

                        // Розраховуємо позицію меню під курсором, спираючись на його реальний адаптивний розмір
                        const menuRect = contextMenu.getBoundingClientRect();
                        const menuWidth = menuRect.width || 240;
                        const menuHeight = menuRect.height || 280;
                        let left = e.clientX;
                        let top = e.clientY;

                        if (left + menuWidth > window.innerWidth) {
                            left = window.innerWidth - menuWidth - 10;
                        }
                        if (top + menuHeight > window.innerHeight) {
                            top = window.innerHeight - menuHeight - 10;
                        }

                        contextMenu.style.left = `${Math.max(10, left)}px`;
                        contextMenu.style.top = `${Math.max(10, top)}px`;
                        contextMenu.style.position = 'fixed';

                        // Миттєве закриття контекстного меню при будь-якому кліку поза ним або натисканні Escape
                        const closeContextMenu = (evt) => {
                            if (!contextMenu.contains(evt.target)) {
                                contextMenu.remove();
                                document.removeEventListener('pointerdown', closeContextMenu, true);
                                document.removeEventListener('contextmenu', closeContextMenu, true);
                                document.removeEventListener('keydown', handleKeyClose);
                            }
                        };

                        const handleKeyClose = (evt) => {
                            if (evt.key === 'Escape') {
                                contextMenu.remove();
                                document.removeEventListener('pointerdown', closeContextMenu, true);
                                document.removeEventListener('contextmenu', closeContextMenu, true);
                                document.removeEventListener('keydown', handleKeyClose);
                            }
                        };

                        // Додаємо з невеликою затримкою, щоб поточний клік не закрив меню
                        setTimeout(() => {
                            document.addEventListener('pointerdown', closeContextMenu, true);
                            document.addEventListener('contextmenu', closeContextMenu, true);
                            document.addEventListener('keydown', handleKeyClose);
                        }, 10);
                    }
                });

                row.appendChild(delBtn);
                row.appendChild(nestZone);
                itemWrap.appendChild(row);

                // Інтерактивна кишеня піднотаток (.sidebar-nest-pocket)
                const nestPocket = document.createElement('div');
                nestPocket.className = 'sidebar-nest-pocket';
                nestPocket.dataset.targetId = note.id;
                nestPocket.innerHTML = `
                    <div class="nest-pocket-text-content">
                        <span class="nest-pocket-title">Перетягніть сюди</span>
                        <span class="nest-pocket-subtitle">щоб створити піднотатку</span>
                    </div>
                `;
                itemWrap.appendChild(nestPocket);

                // Дочірній підсписок нотаток
                if (childCount > 0) {
                    const subList = document.createElement('ul');
                    subList.className = `sidebar-list sidebar-subnotes-list ${isExpanded ? 'is-expanded' : ''}`;
                    if (isExpanded) {
                        this.renderLevel(note.id, subList, depth + 1, onSelectNote);
                    }
                    itemWrap.appendChild(subList);
                }

                container.appendChild(itemWrap);
            });
        }
    };
})();
