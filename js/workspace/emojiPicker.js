// js/workspace/emojiPicker.js - Модуль інтерактивного вибору Notion-емодзі
window.App = window.App || {};

(function() {
    const RECENTS_KEY = 'nothingnotes_recent_emojis';

    function getRecentEmojis() {
        try {
            const raw = localStorage.getItem(RECENTS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveRecentEmoji(emoji) {
        if (!emoji) return;
        try {
            let recents = getRecentEmojis();
            recents = [emoji, ...recents.filter(e => e !== emoji)].slice(0, 21);
            localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
        } catch (e) {}
    }

    window.App.emojiPicker = {
        createEmojiPicker(targetItem, onIconChange, customRemoveHandler) {
            const isNote = targetItem && targetItem.id && typeof targetItem.content !== 'undefined';
            const currentIcon = isNote ? targetItem.icon : (targetItem ? targetItem.icon : null);
            const defaultEmptyIcon = isNote ? '📄' : '📁';

            const t = (k, p) => (window.App && window.App.i18n) ? window.App.i18n.t(k, p) : k;

            const emojiWrap = document.createElement('div');
            emojiWrap.className = 'sticker-emoji-wrap';

            const emojiBtn = document.createElement('button');
            emojiBtn.className = `sticker-emoji-btn ${!currentIcon ? 'empty-icon' : ''}`;
            emojiBtn.title = currentIcon ? (t('emoji.changeIcon') || 'Змінити емодзі') : (t('emoji.addIcon') || 'Додати емодзі');
            if (window.App.setEmojiContent) {
                window.App.setEmojiContent(emojiBtn, currentIcon, defaultEmptyIcon, 24);
            } else {
                emojiBtn.textContent = currentIcon || defaultEmptyIcon;
            }

            // Випадаюче вікно вибору Notion-емодзі з повною клавіатурою категорій
            const emojiDropdown = document.createElement('div');
            emojiDropdown.className = 'sticker-emoji-picker-dropdown';

            // Шапка пікера (Пошук з кнопкою очищення + кнопка Видалити)
            const pickerHeader = document.createElement('div');
            pickerHeader.className = 'emoji-picker-header';

            const searchWrap = document.createElement('div');
            searchWrap.className = 'emoji-search-wrap';

            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'emoji-search-input';
            searchInput.placeholder = t('emoji.searchPlaceholder') || 'Пошук емодзі...';

            const clearSearchBtn = document.createElement('button');
            clearSearchBtn.type = 'button';
            clearSearchBtn.className = 'emoji-clear-search-btn';
            clearSearchBtn.innerHTML = '✕';
            clearSearchBtn.title = t('emoji.clearSearch') || 'Очистити';
            clearSearchBtn.style.display = 'none';

            searchWrap.appendChild(searchInput);
            searchWrap.appendChild(clearSearchBtn);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'emoji-remove-btn';
            removeBtn.textContent = t('common.delete') || 'Видалити';
            removeBtn.title = t('emoji.removeIcon') || 'Прибрати іконку';
            removeBtn.style.display = currentIcon ? 'block' : 'none';

            const setPickerActiveState = (active) => {
                const col = emojiWrap.closest('.board-column');
                const header = emojiWrap.closest('.column-header');
                const titleWrap = emojiWrap.closest('.column-title-wrap');
                emojiWrap.classList.toggle('has-active-emoji-picker', active);
                if (titleWrap) titleWrap.classList.toggle('has-active-emoji-picker', active);
                if (header) header.classList.toggle('has-active-emoji-picker', active);
                if (col) col.classList.toggle('has-active-emoji-picker', active);
            };

            const handleSelectEmoji = (emoji) => {
                saveRecentEmoji(emoji);
                if (isNote) {
                    window.App.noteManager.updateNote(targetItem.id, { icon: emoji });
                    targetItem.icon = emoji;
                }
                if (window.App.setEmojiContent) {
                    window.App.setEmojiContent(emojiBtn, emoji, defaultEmptyIcon, 24);
                } else {
                    emojiBtn.textContent = emoji;
                }
                emojiBtn.classList.remove('empty-icon');
                emojiBtn.title = t('emoji.changeIcon') || 'Змінити емодзі';
                removeBtn.style.display = 'block';
                emojiDropdown.classList.remove('active', 'open-upward');
                setPickerActiveState(false);
                if (onIconChange) onIconChange(emoji);
                if (isNote && window.App.sidebarView) {
                    window.App.sidebarView.renderNotesList();
                }
            };

            const createEmojiButton = (emoji) => {
                const itemBtn = document.createElement('button');
                itemBtn.type = 'button';
                itemBtn.className = 'emoji-grid-item';
                itemBtn.dataset.emoji = emoji;
                const kw = (window.App.emojiKeywords && window.App.emojiKeywords[emoji]) || '';
                itemBtn.dataset.keywords = kw;

                if (window.App.isAppleDevice) {
                    itemBtn.textContent = emoji;
                } else if (window.App.getAppleEmojiUrl) {
                    const img = document.createElement('img');
                    img.src = window.App.getAppleEmojiUrl(emoji);
                    img.className = 'apple-emoji-img';
                    img.width = 24;
                    img.height = 24;
                    img.loading = 'lazy';
                    img.alt = emoji;
                    img.draggable = false;
                    img.onerror = () => {
                        itemBtn.textContent = emoji;
                    };
                    itemBtn.appendChild(img);
                } else {
                    itemBtn.textContent = emoji;
                }

                itemBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleSelectEmoji(emoji);
                });
                return itemBtn;
            };

            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isNote) {
                    window.App.noteManager.updateNote(targetItem.id, { icon: null });
                    targetItem.icon = null;
                }
                if (window.App.setEmojiContent) {
                    window.App.setEmojiContent(emojiBtn, null, defaultEmptyIcon, 24);
                } else {
                    emojiBtn.textContent = defaultEmptyIcon;
                }
                emojiBtn.classList.add('empty-icon');
                emojiBtn.title = t('emoji.addIcon') || 'Додати емодзі';
                removeBtn.style.display = 'none';
                emojiDropdown.classList.remove('active', 'open-upward');
                setPickerActiveState(false);
                if (customRemoveHandler) {
                    customRemoveHandler();
                } else if (onIconChange) {
                    onIconChange(null);
                }
                if (isNote && window.App.sidebarView) {
                    window.App.sidebarView.renderNotesList();
                }
            });

            pickerHeader.appendChild(searchWrap);
            pickerHeader.appendChild(removeBtn);

            // Скрол-контейнер з усіма категоріями та емодзі
            const scrollContainer = document.createElement('div');
            scrollContainer.className = 'emoji-picker-scroll';

            // Блок сповіщення про відсутність результатів пошуку
            const noResultsEl = document.createElement('div');
            noResultsEl.className = 'emoji-no-results';
            noResultsEl.textContent = t('emoji.notFound') || 'Емодзі не знайдено';
            noResultsEl.style.display = 'none';

            // Нижня панель швидкого перемикання категорій
            const categoriesBar = document.createElement('div');
            categoriesBar.className = 'emoji-categories-bar';
            const catButtonsMap = new Map();

            // Секція "Часто використовувані" (Recent)
            const recentSection = document.createElement('div');
            recentSection.className = 'emoji-category-section emoji-recent-section';
            recentSection.dataset.catId = 'recent';

            const recentTitle = document.createElement('div');
            recentTitle.className = 'emoji-category-title';
            const recentTitleText = t('emoji.categories.recent');
            recentTitle.textContent = (recentTitleText && !recentTitleText.startsWith('emoji.')) ? recentTitleText : 'Часто використовувані';

            const recentGrid = document.createElement('div');
            recentGrid.className = 'emoji-grid';
            recentSection.appendChild(recentTitle);
            recentSection.appendChild(recentGrid);
            scrollContainer.appendChild(recentSection);

            // Кнопка переходу до "Часто використовувані" у табах
            const recentCatBtn = document.createElement('button');
            recentCatBtn.type = 'button';
            recentCatBtn.className = 'emoji-cat-tab-btn';
            recentCatBtn.title = recentTitle.textContent;
            if (window.App.setEmojiContent) {
                window.App.setEmojiContent(recentCatBtn, '🕒', null, 18);
            } else {
                recentCatBtn.textContent = '🕒';
            }
            catButtonsMap.set('recent', recentCatBtn);
            recentCatBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                scrollContainer.scrollTop = recentSection.offsetTop - scrollContainer.offsetTop;
                categoriesBar.querySelectorAll('.emoji-cat-tab-btn').forEach(b => b.classList.remove('active'));
                recentCatBtn.classList.add('active');
            });
            categoriesBar.appendChild(recentCatBtn);

            const updateRecentSection = () => {
                const recents = getRecentEmojis();
                recentGrid.innerHTML = '';
                if (recents.length > 0) {
                    recents.forEach(emoji => {
                        recentGrid.appendChild(createEmojiButton(emoji));
                    });
                    recentSection.style.display = 'block';
                    recentCatBtn.style.display = 'flex';
                } else {
                    recentSection.style.display = 'none';
                    recentCatBtn.style.display = 'none';
                }
            };
            updateRecentSection();

            // Основні стандартні категорії
            const categories = window.App.emojiCategories || [];

            categories.forEach((cat, idx) => {
                const catSection = document.createElement('div');
                catSection.className = 'emoji-category-section';
                catSection.dataset.catId = cat.id;

                const catTitle = document.createElement('div');
                catTitle.className = 'emoji-category-title';
                const i18nName = t('emoji.categories.' + cat.id);
                catTitle.textContent = (i18nName && !i18nName.startsWith('emoji.')) ? i18nName : cat.name;

                const grid = document.createElement('div');
                grid.className = 'emoji-grid';

                cat.emojis.forEach(emoji => {
                    grid.appendChild(createEmojiButton(emoji));
                });

                catSection.appendChild(catTitle);
                catSection.appendChild(grid);
                scrollContainer.appendChild(catSection);

                // Кнопка категорії у табах
                const catBtn = document.createElement('button');
                catBtn.type = 'button';
                const isInitialActive = (idx === 0 && getRecentEmojis().length === 0);
                catBtn.className = `emoji-cat-tab-btn ${isInitialActive ? 'active' : ''}`;
                catBtn.title = catTitle.textContent;
                if (window.App.setEmojiContent) {
                    window.App.setEmojiContent(catBtn, cat.icon, null, 18);
                } else {
                    catBtn.textContent = cat.icon;
                }
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

            if (getRecentEmojis().length > 0) {
                recentCatBtn.classList.add('active');
            }

            scrollContainer.appendChild(noResultsEl);

            // Підсвічування активної вкладки категорії при скролі
            scrollContainer.addEventListener('scroll', () => {
                const sections = scrollContainer.querySelectorAll('.emoji-category-section');
                let current = '';
                sections.forEach(sec => {
                    if (sec.style.display === 'none') return;
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

            // Пошук емодзі в реальному часі за символом, білінгвальними ключовими словами або назвою категорії
            const handleSearch = () => {
                const query = searchInput.value.trim().toLowerCase();
                clearSearchBtn.style.display = query ? 'flex' : 'none';

                const allItems = scrollContainer.querySelectorAll('.emoji-grid-item');
                const allSections = scrollContainer.querySelectorAll('.emoji-category-section');

                if (!query) {
                    allSections.forEach(s => {
                        if (s === recentSection && getRecentEmojis().length === 0) {
                            s.style.display = 'none';
                        } else {
                            s.style.display = 'block';
                        }
                    });
                    allItems.forEach(i => i.style.display = 'flex');
                    categoriesBar.style.display = 'flex';
                    noResultsEl.style.display = 'none';
                    return;
                }

                categoriesBar.style.display = 'none';
                let totalVisible = 0;

                allSections.forEach(sec => {
                    let hasVisible = false;
                    const secTitle = (sec.querySelector('.emoji-category-title')?.textContent || '').toLowerCase();
                    const titleMatches = secTitle.includes(query);
                    const items = sec.querySelectorAll('.emoji-grid-item');

                    items.forEach(item => {
                        const kw = item.dataset.keywords || '';
                        const glyph = item.dataset.emoji || item.textContent || '';
                        if (glyph.includes(query) || kw.includes(query) || titleMatches) {
                            item.style.display = 'flex';
                            hasVisible = true;
                            totalVisible++;
                        } else {
                            item.style.display = 'none';
                        }
                    });

                    sec.style.display = hasVisible ? 'block' : 'none';
                });

                noResultsEl.style.display = totalVisible === 0 ? 'block' : 'none';
            };

            searchInput.addEventListener('input', handleSearch);

            clearSearchBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                searchInput.value = '';
                handleSearch();
                searchInput.focus();
            });

            emojiDropdown.appendChild(pickerHeader);
            emojiDropdown.appendChild(scrollContainer);
            emojiDropdown.appendChild(categoriesBar);

            // Зупиняємо спливання подій коліщатка миші та кліків,
            // щоб полотно дошки чи графа не перехоплювали скрол та взаємодію з емодзі
            emojiDropdown.addEventListener('wheel', (e) => {
                e.stopPropagation();
            }, { passive: true });
            emojiDropdown.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
            });

            emojiBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Закриваємо інші пікери та меню
                document.querySelectorAll('.sticker-emoji-picker-dropdown.active, .sticker-menu-dropdown.active, .sticker-tag-dropdown.active, .column-filter-dropdown.active').forEach(el => {
                    if (el !== emojiDropdown) el.classList.remove('active', 'open-upward');
                });
                document.querySelectorAll('.has-active-emoji-picker').forEach(el => {
                    if (!el.contains(emojiDropdown)) el.classList.remove('has-active-emoji-picker');
                });

                const willOpen = !emojiDropdown.classList.contains('active');
                if (willOpen) {
                    // Оновлюємо секцію нещодавніх емодзі перед показом
                    updateRecentSection();

                    // Якщо є активний пошук, скидаємо його або оновлюємо
                    if (searchInput.value) {
                        searchInput.value = '';
                        handleSearch();
                    }

                    if (window.App.smartPositionDropdown) {
                        window.App.smartPositionDropdown(emojiBtn, emojiDropdown, 320);
                    }
                    emojiDropdown.classList.add('active');
                    setPickerActiveState(true);
                    if (window.innerWidth > 768) {
                        setTimeout(() => searchInput.focus(), 60);
                    }
                } else {
                    emojiDropdown.classList.remove('active', 'open-upward');
                    setPickerActiveState(false);
                }
            });

            emojiWrap.appendChild(emojiBtn);
            emojiWrap.appendChild(emojiDropdown);

            return emojiWrap;
        }
    };
})();
