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
        createTagsContainer(note, card) {
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

                const removeBadgeBtn = document.createElement('button');
                removeBadgeBtn.className = 'sticker-tag-badge-remove';
                removeBadgeBtn.title = 'Відкріпити тег від цієї нотатки';
                removeBadgeBtn.innerHTML = '×';
                removeBadgeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const updatedTags = noteTags.filter(t => t !== tagText);
                    noteManager.updateNote(note.id, { tags: updatedTags, tag: null }, true);
                });

                badge.appendChild(textSpan);
                badge.appendChild(removeBadgeBtn);
                tagsContainer.appendChild(badge);
            });

            // 2. Кнопка "+ Тег" та випадаючий список тегів
            const addTagBtn = document.createElement('button');
            addTagBtn.className = 'sticker-add-tag-btn';
            addTagBtn.title = 'Додати тег';
            addTagBtn.textContent = '+ Тег';

            const tagDropdown = document.createElement('div');
            tagDropdown.className = 'sticker-tag-dropdown';

            const renderDropdownContent = () => {
                tagDropdown.innerHTML = '';

                const dHeader = document.createElement('div');
                dHeader.className = 'tag-dropdown-header';
                dHeader.innerHTML = `<span>Теги нотатки</span>`;
                tagDropdown.appendChild(dHeader);

                const availableOptions = storage.getTagOptions ? storage.getTagOptions() : [];

                const optionsList = document.createElement('div');
                optionsList.className = 'tag-options-list';

                availableOptions.forEach(opt => {
                    const isAlreadyAttached = noteTags.includes(opt);
                    const optItem = document.createElement('div');
                    optItem.className = `tag-option-item ${isAlreadyAttached ? 'active' : ''}`;

                    const optText = document.createElement('span');
                    optText.className = 'tag-option-text';
                    optText.textContent = `${isAlreadyAttached ? '✓ ' : ''}${opt}`;

                    const delOptBtn = document.createElement('button');
                    delOptBtn.className = 'tag-option-del-btn';
                    delOptBtn.innerHTML = '×';
                    delOptBtn.title = 'Видалити цей варіант тегу зі списку та з усіх нотаток';
                    delOptBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();

                        // 1. Видаляємо тег із загального списку збережених опцій у сховищі
                        const currentAvailable = (storage.getTagOptions ? storage.getTagOptions() : []).filter(o => o !== opt);
                        if (storage.saveTagOptions) storage.saveTagOptions(currentAvailable);

                        // 2. Каскадно видаляємо цей тег з нотаток ЦІЄЇ дошки у пам'яті
                        let notesUpdated = false;
                        const currentBoardId = note.boardId || state.activeBoardId;
                        state.notes.forEach(n => {
                            if (n.boardId === currentBoardId) {
                                if (Array.isArray(n.tags) && n.tags.includes(opt)) {
                                    n.tags = n.tags.filter(t => t !== opt);
                                    notesUpdated = true;
                                }
                                if (n.tag && n.tag.text === opt) {
                                    n.tag = null;
                                    notesUpdated = true;
                                }
                            }
                        });

                        if (notesUpdated) {
                            storage.saveNotes(state.notes);
                            if (window.App.cloudSync && window.App.cloudSync.isLoggedIn()) {
                                window.App.cloudSync.pushAllToCloud();
                            }
                        }

                        // 3. Оновлюємо список тегів поточної картки локально
                        noteTags = noteTags.filter(t => t !== opt);

                        // 4. Оновлюємо ВСІ меню тегів, які зараз згенеровані на сторінці
                        document.querySelectorAll('.sticker-tag-dropdown').forEach(dd => {
                            if (typeof dd.refreshContent === 'function') {
                                dd.refreshContent();
                            }
                        });

                        // 5. Миттєво видаляємо бейджі цього тегу зі ВСІХ нотаток на екрані (у всіх колонках)
                        document.querySelectorAll('.sticker-tag-badge').forEach(badge => {
                            const badgeText = badge.querySelector('.sticker-tag-badge-text')?.textContent;
                            if (badgeText === opt) {
                                badge.remove();
                            }
                        });
                    });

                    optItem.appendChild(optText);
                    optItem.appendChild(delOptBtn);

                    optItem.addEventListener('click', (e) => {
                        if (e.target.closest('.tag-option-del-btn')) return;
                        e.stopPropagation();
                        if (isAlreadyAttached) {
                            // Знімаємо тег
                            const updatedTags = noteTags.filter(t => t !== opt);
                            noteManager.updateNote(note.id, { tags: updatedTags, tag: null }, true);
                        } else {
                            // Додаємо тег до нотатки
                            const updatedTags = [...noteTags, opt];
                            noteManager.updateNote(note.id, { tags: updatedTags, tag: null }, true);
                        }
                    });

                    optionsList.appendChild(optItem);
                });

                tagDropdown.appendChild(optionsList);

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
                        if (!noteTags.includes(newOpt)) {
                            const updatedTags = [...noteTags, newOpt];
                            noteManager.updateNote(note.id, { tags: updatedTags, tag: null }, true);
                        }
                        // Оновлюємо всі випадаючі меню
                        document.querySelectorAll('.sticker-tag-dropdown').forEach(dd => {
                            if (typeof dd.refreshContent === 'function') dd.refreshContent();
                        });
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
