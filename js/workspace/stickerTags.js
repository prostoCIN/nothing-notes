// js/workspace/stickerTags.js - Модуль стрічок тегів (Washi Tape Tags) та випадаючого списку тегів
window.App = window.App || {};

(function() {
    window.App.stickerTags = {
        /**
         * Створює блок washi-стрічок та випадаючого меню вибору тегів
         * @param {Object} note - Об'єкт нотатки
         * @param {HTMLElement} card - DOM-елемент картки
         * @returns {HTMLElement} - DOM елемент tagsContainer
         */
        createTagsContainer(note, card, isReadOnly = false) {
            const state = window.App.state;
            const storage = window.App.storage;
            const noteManager = window.App.noteManager;

            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'sticker-tags-container';

            // Отримуємо актуальні теги нотатки через єдиний оптимізований метод
            let noteTags = noteManager.getNoteTags ? noteManager.getNoteTags(note) : [];

            // Якщо тегів немає — приховуємо контейнер, поки користувач не відкриє його з меню
            if (noteTags.length === 0) {
                tagsContainer.style.display = 'none';
            }

            // 1. Рендеримо всі прикріплені Washi-стрічки
            noteTags.forEach(tagText => {
                const colorIndex = window.App.getTagColorIndex ? window.App.getTagColorIndex(tagText) : 0;

                const badge = document.createElement('div');
                badge.className = `sticker-tag-badge tag-tape-color-${colorIndex}`;

                const textSpan = document.createElement('span');
                textSpan.className = 'sticker-tag-badge-text';
                textSpan.textContent = tagText;
                badge.appendChild(textSpan);

                if (!isReadOnly) {
                    const removeBadgeBtn = document.createElement('button');
                    removeBadgeBtn.className = 'sticker-tag-badge-remove';
                    removeBadgeBtn.title = 'Відкріпити тег від цієї нотатки';
                    removeBadgeBtn.innerHTML = '×';
                    removeBadgeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const freshNote = (noteManager.getNoteById && noteManager.getNoteById(note.id)) || note;
                        const freshTags = noteManager.getNoteTags ? noteManager.getNoteTags(freshNote) : [];
                        const updatedTags = freshTags.filter(t => t !== tagText);
                        noteManager.updateNote(note.id, { tags: updatedTags, tag: null }, true);
                    });
                    badge.appendChild(removeBadgeBtn);
                }

                tagsContainer.appendChild(badge);
            });

            if (isReadOnly) {
                return tagsContainer;
            }

            // 2. Кнопка "+ Тег" та випадаючий список тегів
            const addTagBtn = document.createElement('button');
            addTagBtn.className = 'sticker-add-tag-btn';
            addTagBtn.title = 'Додати тег';
            addTagBtn.textContent = '+ Тег';

            const tagDropdown = document.createElement('div');
            tagDropdown.className = 'sticker-tag-dropdown';

            const renderDropdownContent = () => {
                tagDropdown.innerHTML = '';

                const freshNote = (noteManager.getNoteById && noteManager.getNoteById(note.id)) || note;
                const currentNoteTags = noteManager.getNoteTags ? noteManager.getNoteTags(freshNote) : [];

                const dHeader = document.createElement('div');
                dHeader.className = 'tag-dropdown-header';
                dHeader.innerHTML = `<span>Теги нотатки</span>`;
                tagDropdown.appendChild(dHeader);

                const availableOptions = storage.getTagOptions ? storage.getTagOptions() : [];

                const optionsList = document.createElement('div');
                optionsList.className = 'tag-options-list';

                if (availableOptions.length === 0) {
                    const emptyText = document.createElement('div');
                    emptyText.className = 'selection-submenu-empty';
                    emptyText.textContent = 'Немає створених тегів';
                    emptyText.style.padding = '6px 8px';
                    emptyText.style.fontSize = '12px';
                    emptyText.style.color = 'var(--text-muted)';
                    optionsList.appendChild(emptyText);
                } else {
                    availableOptions.forEach(opt => {
                        const isAlreadyAttached = currentNoteTags.includes(opt);
                        const colorIndex = window.App.getTagColorIndex ? window.App.getTagColorIndex(opt) : 0;

                        const optItem = document.createElement('div');
                        optItem.className = `tag-option-item ${isAlreadyAttached ? 'active' : ''}`;

                        optItem.innerHTML = `
                            <div class="tag-option-main-action">
                                <span class="selection-tag-color-dot tag-tape-color-${colorIndex}"></span>
                                <span class="tag-option-text">${opt}</span>
                                <span class="tag-option-status-icon">${isAlreadyAttached ? '✓' : ''}</span>
                            </div>
                            <button class="tag-option-del-btn" title="Видалити цей тег з усіх нотаток та зі списку">×</button>
                        `;

                        // Клік по основній області — додати / зняти тег
                        const mainAction = optItem.querySelector('.tag-option-main-action');
                        mainAction.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const noteRef = (noteManager.getNoteById && noteManager.getNoteById(note.id)) || note;
                            const latestTags = noteManager.getNoteTags ? noteManager.getNoteTags(noteRef) : [];
                            const isAttached = latestTags.includes(opt);
                            if (isAttached) {
                                const updatedTags = latestTags.filter(t => t !== opt);
                                noteManager.updateNote(note.id, { tags: updatedTags, tag: null }, true);
                            } else {
                                const updatedTags = [...latestTags, opt];
                                noteManager.updateNote(note.id, { tags: updatedTags, tag: null }, true);
                            }
                            if (window.App.workspaceSelectionBar && window.App.workspaceSelectionBar.refreshTagSubmenu) {
                                window.App.workspaceSelectionBar.refreshTagSubmenu();
                            }
                        });

                        // Клік по хрестику — повне видалення тегу зі списку та з усіх нотаток без закриття вікна
                        const delOptBtn = optItem.querySelector('.tag-option-del-btn');
                        delOptBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
                        delOptBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            e.preventDefault();

                            // 1. Видаляємо тег із загального списку збережених опцій
                            const currentAvailable = (storage.getTagOptions ? storage.getTagOptions() : []).filter(o => o !== opt);
                            if (storage.saveTagOptions) storage.saveTagOptions(currentAvailable);

                            // 2. Видаляємо цей тег з усіх нотаток у пам'яті
                            state.notes.forEach(n => {
                                if (Array.isArray(n.tags) && n.tags.includes(opt)) {
                                    n.tags = n.tags.filter(t => t !== opt);
                                    n.updatedAt = Date.now();
                                    if (window.App.cloudSync) window.App.cloudSync.syncNote(n);
                                }
                            });

                            storage.saveNotes(state.notes);

                            // 3. Оновлюємо вміст випадаючого списку тегів без його закриття
                            renderDropdownContent();
                            tagDropdown.classList.add('active');
                            addTagBtn.classList.add('active');

                            // 4. Оновлюємо візуальні бейджі на дошці без повного руйнування DOM робочої області
                            document.querySelectorAll('.sticker-tag-badge').forEach(badge => {
                                const span = badge.querySelector('.sticker-tag-badge-text');
                                if (span && span.textContent === opt) {
                                    const container = badge.closest('.sticker-tags-container');
                                    badge.remove();
                                    if (container) {
                                        const remainingBadges = container.querySelectorAll('.sticker-tag-badge');
                                        if (remainingBadges.length === 0 && !container.querySelector('.sticker-tag-dropdown.active')) {
                                            container.style.display = 'none';
                                        }
                                    }
                                }
                            });

                            if (window.App.workspaceSelectionBar && window.App.workspaceSelectionBar.refreshTagSubmenu) {
                                window.App.workspaceSelectionBar.refreshTagSubmenu();
                            }
                        });

                        optionsList.appendChild(optItem);
                    });
                }

                tagDropdown.appendChild(optionsList);

                // Опція зняти всі теги з цієї нотатки (якщо є хоча б один)
                if (currentNoteTags.length > 0) {
                    const clearSingleNoteTagsBtn = document.createElement('button');
                    clearSingleNoteTagsBtn.className = 'selection-tag-clear-btn';
                    clearSingleNoteTagsBtn.style.margin = '4px 0 6px 0';
                    clearSingleNoteTagsBtn.innerHTML = `
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        <span>Очистити всі теги</span>
                    `;
                    clearSingleNoteTagsBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        noteManager.updateNote(note.id, { tags: [], tag: null }, true);
                        if (window.App.workspaceSelectionBar && window.App.workspaceSelectionBar.refreshTagSubmenu) {
                            window.App.workspaceSelectionBar.refreshTagSubmenu();
                        }
                    });
                    tagDropdown.appendChild(clearSingleNoteTagsBtn);
                }

                // Рядок створення нового варіанту тегу
                const addRow = document.createElement('div');
                addRow.className = 'tag-add-option-row';

                const addInput = document.createElement('input');
                addInput.type = 'text';
                addInput.className = 'tag-add-input';
                addInput.placeholder = 'Новий тег...';

                const submitNewOption = () => {
                    const newOpt = addInput.value.trim();
                    if (newOpt) {
                        const currentAvailable = storage.getTagOptions ? storage.getTagOptions() : [];
                        if (!currentAvailable.includes(newOpt)) {
                            currentAvailable.push(newOpt);
                            if (storage.saveTagOptions) storage.saveTagOptions(currentAvailable);
                        }
                        const freshNote = (noteManager.getNoteById && noteManager.getNoteById(note.id)) || note;
                        const latestTags = noteManager.getNoteTags ? noteManager.getNoteTags(freshNote) : [];
                        if (!latestTags.includes(newOpt)) {
                            const updatedTags = [...latestTags, newOpt];
                            noteManager.updateNote(note.id, { tags: updatedTags, tag: null }, true);
                        }
                        addInput.value = '';
                        if (window.App.workspaceSelectionBar && window.App.workspaceSelectionBar.refreshTagSubmenu) {
                            window.App.workspaceSelectionBar.refreshTagSubmenu();
                        }
                    }
                };

                addInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        submitNewOption();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        tagDropdown.classList.remove('active', 'open-upward');
                        addTagBtn.classList.remove('active');
                    }
                });

                addInput.addEventListener('click', (e) => e.stopPropagation());

                const addBtnSubmit = document.createElement('button');
                addBtnSubmit.className = 'tag-add-btn';
                addBtnSubmit.textContent = '+ Створити';
                addBtnSubmit.addEventListener('click', (e) => {
                    e.stopPropagation();
                    submitNewOption();
                });

                addRow.appendChild(addInput);
                addRow.appendChild(addBtnSubmit);
                tagDropdown.appendChild(addRow);
            };

            tagDropdown.refreshContent = renderDropdownContent;
            tagDropdown.addEventListener('pointerdown', (e) => e.stopPropagation());
            tagDropdown.addEventListener('click', (e) => e.stopPropagation());
            renderDropdownContent();

            addTagBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.sticker-menu-dropdown.active, .sticker-emoji-picker-dropdown.active, .sticker-tag-dropdown.active, .column-filter-dropdown.active').forEach(d => {
                    if (d !== tagDropdown) d.classList.remove('active', 'open-upward');
                });
                document.querySelectorAll('.sticker-add-tag-btn.active').forEach(b => {
                    if (b !== addTagBtn) b.classList.remove('active');
                });

                const willOpen = !tagDropdown.classList.contains('active');
                if (willOpen) {
                    renderDropdownContent(); // Завжди беремо свіжі глобальні теги перед показом
                    if (window.App.smartPositionDropdown) {
                        window.App.smartPositionDropdown(addTagBtn, tagDropdown, 180);
                    }
                    tagDropdown.classList.add('active');
                    addTagBtn.classList.add('active');
                    const addInput = tagDropdown.querySelector('.tag-add-input');
                    if (addInput) setTimeout(() => addInput.focus(), 60);
                } else {
                    tagDropdown.classList.remove('active', 'open-upward');
                    addTagBtn.classList.remove('active');
                }
            });

            tagsContainer.appendChild(addTagBtn);
            tagsContainer.appendChild(tagDropdown);

            return tagsContainer;
        }
    };
})();
