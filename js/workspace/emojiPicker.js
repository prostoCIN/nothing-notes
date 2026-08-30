// js/workspace/emojiPicker.js - Модуль інтерактивного вибору Notion-емодзі
window.App = window.App || {};

(function() {
    window.App.emojiPicker = {
        createEmojiPicker(note, onIconChange) {
            const noteManager = window.App.noteManager;
            const sidebarView = window.App.sidebarView;

            const emojiWrap = document.createElement('div');
            emojiWrap.className = 'sticker-emoji-wrap';

            const emojiBtn = document.createElement('button');
            emojiBtn.className = `sticker-emoji-btn ${!note.icon ? 'empty-icon' : ''}`;
            emojiBtn.title = note.icon ? 'Змінити емодзі' : 'Додати емодзі';
            emojiBtn.textContent = note.icon || '📄';

            // Випадаюче вікно вибору Notion-емодзі з повною клавіатурою категорій
            const emojiDropdown = document.createElement('div');
            emojiDropdown.className = 'sticker-emoji-picker-dropdown';

            // Шапка пікера (Пошук + кнопка Видалити)
            const pickerHeader = document.createElement('div');
            pickerHeader.className = 'emoji-picker-header';

            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'emoji-search-input';
            searchInput.placeholder = 'Пошук емодзі...';

            const removeBtn = document.createElement('button');
            removeBtn.className = 'emoji-remove-btn';
            removeBtn.textContent = 'Видалити';
            removeBtn.title = 'Прибрати іконку';
            removeBtn.style.display = note.icon ? 'block' : 'none';

            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                noteManager.updateNote(note.id, { icon: null });
                note.icon = null;
                emojiBtn.textContent = '📄';
                emojiBtn.classList.add('empty-icon');
                emojiBtn.title = 'Додати емодзі';
                removeBtn.style.display = 'none';
                emojiDropdown.classList.remove('active');
                if (onIconChange) onIconChange(null);
                sidebarView.renderNotesList();
            });

            pickerHeader.appendChild(searchInput);
            pickerHeader.appendChild(removeBtn);

            // Скрол-контейнер з усіма категоріями та емодзі
            const scrollContainer = document.createElement('div');
            scrollContainer.className = 'emoji-picker-scroll';

            const categories = window.App.emojiCategories || [];

            // Рендер категорій і сіток
            categories.forEach(cat => {
                const catSection = document.createElement('div');
                catSection.className = 'emoji-category-section';
                catSection.dataset.catId = cat.id;

                const catTitle = document.createElement('div');
                catTitle.className = 'emoji-category-title';
                catTitle.textContent = cat.name;

                const grid = document.createElement('div');
                grid.className = 'emoji-grid';

                cat.emojis.forEach(emoji => {
                    const itemBtn = document.createElement('button');
                    itemBtn.className = 'emoji-grid-item';
                    itemBtn.textContent = emoji;
                    itemBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        noteManager.updateNote(note.id, { icon: emoji });
                        note.icon = emoji;
                        emojiBtn.textContent = emoji;
                        emojiBtn.classList.remove('empty-icon');
                        emojiBtn.title = 'Змінити емодзі';
                        removeBtn.style.display = 'block';
                        emojiDropdown.classList.remove('active');
                        if (onIconChange) onIconChange(emoji);
                        sidebarView.renderNotesList();
                    });
                    grid.appendChild(itemBtn);
                });

                catSection.appendChild(catTitle);
                catSection.appendChild(grid);
                scrollContainer.appendChild(catSection);
            });

            // Нижня панель швидкого перемикання категорій
            const categoriesBar = document.createElement('div');
            categoriesBar.className = 'emoji-categories-bar';

            const catButtonsMap = new Map();

            categories.forEach((cat, idx) => {
                const catBtn = document.createElement('button');
                catBtn.className = `emoji-cat-tab-btn ${idx === 0 ? 'active' : ''}`;
                catBtn.title = cat.name;
                catBtn.textContent = cat.icon;
                catButtonsMap.set(cat.id, catBtn);

                catBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const targetSection = scrollContainer.querySelector(`.emoji-category-section[data-cat-id="${cat.id}"]`);
                    if (targetSection) {
                        scrollContainer.scrollTop = targetSection.offsetTop - scrollContainer.offsetTop;
                    }
                    categoriesBar.querySelectorAll('.emoji-cat-tab-btn').forEach(b => b.classList.remove('active'));
                    catBtn.classList.add('active');
                });

                categoriesBar.appendChild(catBtn);
            });

            // Підсвічування активної вкладки категорії при скролі
            scrollContainer.addEventListener('scroll', () => {
                const sections = scrollContainer.querySelectorAll('.emoji-category-section');
                let current = '';
                sections.forEach(sec => {
                    const top = sec.offsetTop - scrollContainer.offsetTop;
                    if (scrollContainer.scrollTop >= top - 25) {
                        current = sec.dataset.catId;
                    }
                });
                if (current) {
                    categoriesBar.querySelectorAll('.emoji-cat-tab-btn').forEach(b => b.classList.remove('active'));
                    const activeBtn = catButtonsMap.get(current);
                    if (activeBtn) activeBtn.classList.add('active');
                }
            });

            // Пошук емодзі в реальному часі
            searchInput.addEventListener('input', () => {
                const query = searchInput.value.trim().toLowerCase();
                const allItems = scrollContainer.querySelectorAll('.emoji-grid-item');
                const allSections = scrollContainer.querySelectorAll('.emoji-category-section');

                if (!query) {
                    allSections.forEach(s => s.style.display = 'block');
                    allItems.forEach(i => i.style.display = 'flex');
                    categoriesBar.style.display = 'flex';
                    return;
                }

                categoriesBar.style.display = 'none';

                allSections.forEach(sec => {
                    let hasVisible = false;
                    const items = sec.querySelectorAll('.emoji-grid-item');
                    items.forEach(item => {
                        if (item.textContent.includes(query) || sec.querySelector('.emoji-category-title').textContent.toLowerCase().includes(query)) {
                            item.style.display = 'flex';
                            hasVisible = true;
                        } else {
                            item.style.display = 'none';
                        }
                    });
                    sec.style.display = hasVisible ? 'block' : 'none';
                });
            });

            emojiDropdown.appendChild(pickerHeader);
            emojiDropdown.appendChild(scrollContainer);
            emojiDropdown.appendChild(categoriesBar);

            emojiBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Закриваємо інші пікери та меню
                document.querySelectorAll('.sticker-emoji-picker-dropdown.active, .sticker-menu-dropdown.active, .sticker-tag-dropdown.active, .column-filter-dropdown.active').forEach(el => {
                    if (el !== emojiDropdown) el.classList.remove('active', 'open-upward');
                });

                const willOpen = !emojiDropdown.classList.contains('active');
                if (willOpen) {
                    if (window.App.smartPositionDropdown) {
                        window.App.smartPositionDropdown(emojiBtn, emojiDropdown, 320);
                    }
                    emojiDropdown.classList.add('active');
                    setTimeout(() => searchInput.focus(), 60);
                } else {
                    emojiDropdown.classList.remove('active', 'open-upward');
                }
            });

            emojiWrap.appendChild(emojiBtn);
            emojiWrap.appendChild(emojiDropdown);

            return emojiWrap;
        }
    };
})();
