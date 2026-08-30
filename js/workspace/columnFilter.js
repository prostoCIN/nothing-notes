// js/workspace/columnFilter.js - Модуль фільтрації нотаток за тегами в шапці колонки
window.App = window.App || {};

(function() {
    window.App.columnFilter = {
        /**
         * Створює блок кнопки фільтра та випадаючого списку тегів для колонки
         * @param {string|null} parentNoteId - ID батьківської нотатки або null для кореня
         * @param {Set} currentColumnFilter - Поточний активний набір фільтрів тегів
         * @param {Function} onFilterChange - Коллбек при зміні фільтра (перерендер)
         * @returns {HTMLElement} - DOM елемент filterWrap
         */
        createFilter(parentNoteId, currentColumnFilter, onFilterChange) {
            const state = window.App.state;
            const parentKey = parentNoteId || 'root';

            const filterWrap = document.createElement('div');
            filterWrap.className = 'column-filter-wrap';

            const filterBtn = document.createElement('button');
            filterBtn.className = `column-filter-btn ${currentColumnFilter.size > 0 ? 'has-filter' : ''}`;
            filterBtn.title = 'Фільтрувати нотатки за тегами';
            filterBtn.innerHTML = `
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                </svg>
                <span>${currentColumnFilter.size > 0 ? `Теги (${currentColumnFilter.size})` : 'Фільтр'}</span>
            `;

            const filterDropdown = document.createElement('div');
            filterDropdown.className = 'column-filter-dropdown';

            const renderFilterDropdown = () => {
                filterDropdown.innerHTML = '';

                const fHeader = document.createElement('div');
                fHeader.className = 'column-filter-header';
                fHeader.innerHTML = `<span>Фільтр за тегами</span>`;

                if (currentColumnFilter.size > 0) {
                    const clearBtn = document.createElement('button');
                    clearBtn.className = 'column-filter-clear-all';
                    clearBtn.textContent = 'Скинути';
                    clearBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        state.activeTagFilters.delete(parentKey);
                        if (onFilterChange) onFilterChange();
                    });
                    fHeader.appendChild(clearBtn);
                }

                filterDropdown.appendChild(fHeader);

                const storage = window.App.storage;
                const availableTags = storage.getTagOptions ? storage.getTagOptions() : [];

                const fList = document.createElement('div');
                fList.className = 'column-filter-list';

                if (availableTags.length === 0) {
                    const emptyItem = document.createElement('div');
                    emptyItem.className = 'column-filter-item-empty';
                    emptyItem.textContent = 'Немає створених тегів';
                    fList.appendChild(emptyItem);
                } else {
                    availableTags.forEach(tagName => {
                        const isChecked = currentColumnFilter.has(tagName);
                        const item = document.createElement('div');
                        item.className = `column-filter-item ${isChecked ? 'active' : ''}`;
                        item.innerHTML = `
                            <span>🏷️ ${tagName}</span>
                            <span>${isChecked ? '✓' : ''}</span>
                        `;
                        item.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (isChecked) {
                                currentColumnFilter.delete(tagName);
                                if (currentColumnFilter.size === 0) {
                                    state.activeTagFilters.delete(parentKey);
                                } else {
                                    state.activeTagFilters.set(parentKey, currentColumnFilter);
                                }
                            } else {
                                currentColumnFilter.add(tagName);
                                state.activeTagFilters.set(parentKey, currentColumnFilter);
                            }
                            if (onFilterChange) onFilterChange();
                        });
                        fList.appendChild(item);
                    });
                }

                filterDropdown.appendChild(fList);
            };

            filterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.column-filter-dropdown.active, .sticker-menu-dropdown.active, .sticker-emoji-picker-dropdown.active, .sticker-tag-dropdown.active').forEach(d => {
                    if (d !== filterDropdown) d.classList.remove('active', 'open-upward');
                });

                const willOpen = !filterDropdown.classList.contains('active');
                if (willOpen) {
                    renderFilterDropdown();
                    filterDropdown.classList.add('active');
                    filterBtn.classList.add('active');
                } else {
                    filterDropdown.classList.remove('active');
                    filterBtn.classList.remove('active');
                }
            });

            filterWrap.appendChild(filterBtn);
            filterWrap.appendChild(filterDropdown);

            return filterWrap;
        }
    };
})();
