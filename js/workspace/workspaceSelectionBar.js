// js/workspace/workspaceSelectionBar.js - Панель масового вибору та редагування нотаток у стилі iOS Gallery
window.App = window.App || {};

(function() {
    let barElement = null;
    let activeSubMenu = null; // 'color' | 'tag' | 'font'

    window.App.workspaceSelectionBar = {
        init() {
            this.createBarDOM();
            this.bindGlobalEvents();
        },

        createBarDOM() {
            if (barElement) return;

            barElement = document.createElement('div');
            barElement.className = 'workspace-selection-bar';
            barElement.id = 'workspace-selection-bar';

            barElement.innerHTML = `
                <div class="selection-bar-left">
                    <button class="selection-bar-close-btn" id="ws-sel-cancel-btn" title="Скасувати вибір">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                    <div class="selection-bar-info">
                        <span class="selection-bar-count" id="ws-sel-count">Вибрано 0</span>
                        <span class="selection-bar-divider">|</span>
                        <button class="selection-bar-text-btn" id="ws-sel-all-btn">Вибрати всі</button>
                        <button class="selection-bar-text-btn" id="ws-sel-clear-btn">Зняти всі</button>
                    </div>
                </div>

                <div class="selection-bar-actions">
                    <!-- 1. Колір -->
                    <div class="selection-action-item" id="ws-action-color-wrap">
                        <button class="selection-action-btn" id="ws-action-color-btn" title="Змінити колір">
                            <span class="selection-btn-icon">🎨</span>
                            <span class="selection-btn-label">Колір</span>
                        </button>
                        <div class="selection-submenu-dropdown selection-color-dropdown" id="ws-submenu-color">
                            <!-- Палітра кольорів -->
                        </div>
                    </div>

                    <!-- 2. Теги -->
                    <div class="selection-action-item" id="ws-action-tag-wrap">
                        <button class="selection-action-btn" id="ws-action-tag-btn" title="Прикріпити теги">
                            <span class="selection-btn-icon">🏷️</span>
                            <span class="selection-btn-label">Теги</span>
                        </button>
                        <div class="selection-submenu-dropdown selection-tag-dropdown" id="ws-submenu-tag">
                            <!-- Список тегів -->
                        </div>
                    </div>

                    <!-- 3. Розмір шрифту -->
                    <div class="selection-action-item" id="ws-action-font-wrap">
                        <button class="selection-action-btn" id="ws-action-font-btn" title="Розмір шрифту">
                            <span class="selection-btn-icon">🔤</span>
                            <span class="selection-btn-label">Шрифт</span>
                        </button>
                        <div class="selection-submenu-dropdown selection-font-dropdown" id="ws-submenu-font">
                            <!-- Слайдер розміру шрифту -->
                        </div>
                    </div>

                    <!-- 4. Дублювати -->
                    <button class="selection-action-btn" id="ws-action-duplicate-btn" title="Дублювати виділені">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span class="selection-btn-label">Дублювати</span>
                    </button>

                    <!-- 5. Видалити -->
                    <button class="selection-action-btn selection-action-delete-btn" id="ws-action-delete-btn" title="Видалити виділені">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        <span class="selection-btn-label">Видалити</span>
                    </button>
                </div>
            `;

            document.body.appendChild(barElement);
            this.buildSubmenus();
            this.bindBarEvents();
        },

        buildSubmenus() {
            const state = window.App.state;
            const storage = window.App.storage;
            const noteManager = window.App.noteManager;

            // 1. Палітра кольорів
            const colorContainer = barElement.querySelector('#ws-submenu-color');
            const colors = [
                { id: 'yellow', hex: '#fef08a', name: 'Жовтий' },
                { id: 'green',  hex: '#bbf7d0', name: 'Зелений' },
                { id: 'blue',   hex: '#bae6fd', name: 'Блакитний' },
                { id: 'purple', hex: '#e9d5ff', name: 'Фіолетовий' },
                { id: 'pink',   hex: '#fbcfe8', name: 'Рожевий' },
                { id: 'orange', hex: '#fed7aa', name: 'Помаранчевий' },
                { id: 'gray',   hex: '#e2e8f0', name: 'Сірий' }
            ];

            const colorTitle = document.createElement('div');
            colorTitle.className = 'selection-submenu-title';
            colorTitle.textContent = 'Обрати колір для виділених:';
            colorContainer.appendChild(colorTitle);

            const paletteWrap = document.createElement('div');
            paletteWrap.className = 'selection-color-swatches';

            colors.forEach(c => {
                const swatch = document.createElement('button');
                swatch.className = 'color-swatch-btn';
                swatch.style.backgroundColor = c.hex;
                swatch.title = c.name;

                swatch.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
                    if (selectedIds.length === 0) return;

                    noteManager.updateMultipleNotes(selectedIds, { color: c.id });
                    this.closeSubmenus();
                });

                paletteWrap.appendChild(swatch);
            });

            colorContainer.appendChild(paletteWrap);

            // 2. Теги меню
            const tagContainer = barElement.querySelector('#ws-submenu-tag');
            this.refreshTagSubmenu();

            // 3. Слайдер шрифту
            const fontContainer = barElement.querySelector('#ws-submenu-font');
            const fontTitle = document.createElement('div');
            fontTitle.className = 'selection-submenu-title';
            fontTitle.innerHTML = '<span>Розмір шрифту:</span> <span class="font-size-value-badge" id="ws-sel-font-badge">16px</span>';
            fontContainer.appendChild(fontTitle);

            const sliderWrap = document.createElement('div');
            sliderWrap.className = 'sticker-font-slider-container';
            sliderWrap.innerHTML = `
                <span class="slider-min-icon">A</span>
                <input type="range" class="sticker-font-slider" id="ws-sel-font-slider" min="11" max="22" step="1" value="16">
                <span class="slider-max-icon">A</span>
            `;

            const fontSlider = sliderWrap.querySelector('#ws-sel-font-slider');
            const fontBadge = fontTitle.querySelector('#ws-sel-font-badge');

            fontSlider.addEventListener('input', (e) => {
                e.stopPropagation();
                const newSize = parseInt(e.target.value, 10);
                fontBadge.textContent = `${newSize}px`;

                const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
                if (selectedIds.length === 0) return;

                // Оновлюємо стилі нальоту
                selectedIds.forEach(id => {
                    const card = document.querySelector(`.note-sticker[data-note-id="${id}"]`);
                    if (card) {
                        card.style.setProperty('--custom-content-font-size', `${newSize}px`);
                        card.style.setProperty('--custom-title-font-size', `${Math.round(newSize * 1.85)}px`);
                        card.style.setProperty('--custom-line-height', `${Math.round(newSize * 1.9)}px`);
                        card.classList.add('has-custom-font-size');
                    }
                });

                noteManager.updateMultipleNotes(selectedIds, { fontSize: newSize }, false);
            });

            fontSlider.addEventListener('change', () => {
                const newSize = parseInt(fontSlider.value, 10);
                const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
                noteManager.updateMultipleNotes(selectedIds, { fontSize: newSize }, true);
            });

            fontContainer.appendChild(sliderWrap);
        },

        refreshTagSubmenu() {
            if (!barElement) return;
            const state = window.App.state;
            const storage = window.App.storage;
            const noteManager = window.App.noteManager;
            const tagContainer = barElement.querySelector('#ws-submenu-tag');
            if (!tagContainer) return;

            tagContainer.innerHTML = '';

            const tagTitle = document.createElement('div');
            tagTitle.className = 'selection-submenu-title';
            tagTitle.textContent = 'Прикріпити тег:';
            tagContainer.appendChild(tagTitle);

            const options = storage.getTagOptions ? storage.getTagOptions() : [];

            if (options.length === 0) {
                const emptyText = document.createElement('div');
                emptyText.className = 'selection-submenu-empty';
                emptyText.textContent = 'Немає створених тегів';
                tagContainer.appendChild(emptyText);
            } else {
                const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
                const selectedNotes = selectedIds.map(id => noteManager.getNoteById(id)).filter(Boolean);

                const tagList = document.createElement('div');
                tagList.className = 'selection-tag-list';

                options.forEach(tagText => {
                    const item = document.createElement('button');
                    item.className = 'selection-tag-item';

                    let hash = 0;
                    for (let i = 0; i < tagText.length; i++) {
                        hash = tagText.charCodeAt(i) + ((hash << 5) - hash);
                    }
                    const colorIndex = Math.abs(hash) % 6;

                    // Перевіряємо скільки з виділених нотаток мають цей тег
                    const countWithTag = selectedNotes.filter(note => {
                        const tags = Array.isArray(note.tags) ? note.tags : (note.tag ? [note.tag.text || note.tag] : []);
                        return tags.includes(tagText);
                    }).length;

                    const allHaveTag = selectedNotes.length > 0 && countWithTag === selectedNotes.length;
                    const someHaveTag = countWithTag > 0 && !allHaveTag;

                    if (allHaveTag) {
                        item.classList.add('active');
                    } else if (someHaveTag) {
                        item.classList.add('partial');
                    }

                    item.innerHTML = `
                        <span class="selection-tag-color-dot tag-tape-color-${colorIndex}"></span>
                        <span class="selection-tag-text">${tagText}</span>
                        <span class="selection-tag-status-icon">${allHaveTag ? '✓' : (someHaveTag ? '–' : '')}</span>
                    `;

                    item.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (selectedIds.length === 0) return;

                        // Якщо у всіх вже є цей тег — знімаємо його, інакше — додаємо всім
                        const shouldRemove = allHaveTag;

                        selectedIds.forEach(id => {
                            const note = noteManager.getNoteById(id);
                            if (!note) return;
                            let currentTags = Array.isArray(note.tags) ? [...note.tags] : (note.tag ? [note.tag.text || note.tag] : []);
                            
                            if (shouldRemove) {
                                currentTags = currentTags.filter(t => t !== tagText);
                            } else {
                                if (!currentTags.includes(tagText)) {
                                    currentTags.push(tagText);
                                }
                            }
                            note.tags = currentTags;
                            delete note.tag;
                        });

                        storage.saveNotes(state.notes);
                        window.App.workspaceView.render();
                        this.refreshTagSubmenu();
                    });

                    tagList.appendChild(item);
                });

                tagContainer.appendChild(tagList);
            }

            // Опція зняти всі теги
            const clearTagsBtn = document.createElement('button');
            clearTagsBtn.className = 'selection-tag-clear-btn';
            clearTagsBtn.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                <span>Очистити всі теги</span>
            `;
            clearTagsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
                if (selectedIds.length === 0) return;

                selectedIds.forEach(id => {
                    const note = noteManager.getNoteById(id);
                    if (note) {
                        note.tags = [];
                        delete note.tag;
                    }
                });

                storage.saveNotes(state.notes);
                window.App.workspaceView.render();
                this.closeSubmenus();
            });

            tagContainer.appendChild(clearTagsBtn);
        },

        bindBarEvents() {
            const state = window.App.state;
            const noteManager = window.App.noteManager;

            // Кнопка закриття режиму вибору
            const cancelBtn = barElement.querySelector('#ws-sel-cancel-btn');
            cancelBtn.addEventListener('click', () => {
                this.exitSelectMode();
            });

            // Вибрати всі
            const selectAllBtn = barElement.querySelector('#ws-sel-all-btn');
            selectAllBtn.addEventListener('click', () => {
                const allVisibleStickers = document.querySelectorAll('.note-sticker[data-note-id]');
                allVisibleStickers.forEach(card => {
                    if (card.dataset.noteId) {
                        state.selectedWorkspaceNoteIds.add(card.dataset.noteId);
                    }
                });
                this.updateUI();
            });

            // Зняти всі
            const clearAllBtn = barElement.querySelector('#ws-sel-clear-btn');
            clearAllBtn.addEventListener('click', () => {
                state.selectedWorkspaceNoteIds.clear();
                this.updateUI();
            });

            // Кнопки відкриття субменю
            const colorBtn = barElement.querySelector('#ws-action-color-btn');
            colorBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSubmenu('color');
            });

            const tagBtn = barElement.querySelector('#ws-action-tag-btn');
            tagBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.refreshTagSubmenu();
                this.toggleSubmenu('tag');
            });

            const fontBtn = barElement.querySelector('#ws-action-font-btn');
            fontBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSubmenu('font');
            });

            // Дублювати виділені
            const duplicateBtn = barElement.querySelector('#ws-action-duplicate-btn');
            duplicateBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeSubmenus();
                const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
                if (selectedIds.length === 0) return;

                selectedIds.forEach(id => {
                    noteManager.duplicateNote(id);
                });
            });

            // Видалити виділені (з модальним вікном підтвердження)
            const deleteBtn = barElement.querySelector('#ws-action-delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeSubmenus();
                const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
                if (selectedIds.length === 0) return;

                noteManager.deleteNotes(selectedIds, e);
            });
        },

        bindGlobalEvents() {
            // Закриття підменю при кліку поза ним
            document.addEventListener('pointerdown', (e) => {
                if (activeSubMenu && !e.target.closest('.selection-action-item')) {
                    this.closeSubmenus();
                }
            });

            // Escape для виходу з режиму або закриття субменю
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && window.App.state.isWorkspaceSelectMode) {
                    if (activeSubMenu) {
                        this.closeSubmenus();
                    } else {
                        this.exitSelectMode();
                    }
                }
            });
        },

        toggleSubmenu(menuName) {
            if (activeSubMenu === menuName) {
                this.closeSubmenus();
                return;
            }

            this.closeSubmenus();
            activeSubMenu = menuName;

            const targetDropdown = barElement.querySelector(`#ws-submenu-${menuName}`);
            const targetBtn = barElement.querySelector(`#ws-action-${menuName}-btn`);
            if (targetDropdown && targetBtn) {
                targetDropdown.classList.add('active');
                targetBtn.classList.add('active');
            }
        },

        closeSubmenus() {
            activeSubMenu = null;
            if (!barElement) return;
            barElement.querySelectorAll('.selection-submenu-dropdown').forEach(d => d.classList.remove('active'));
            barElement.querySelectorAll('.selection-action-btn').forEach(b => b.classList.remove('active'));
        },

        enterSelectMode() {
            const state = window.App.state;
            state.isWorkspaceSelectMode = true;
            document.body.classList.add('is-workspace-select-mode');
            this.updateUI();
        },

        exitSelectMode() {
            const state = window.App.state;
            state.isWorkspaceSelectMode = false;
            state.selectedWorkspaceNoteIds.clear();
            document.body.classList.remove('is-workspace-select-mode');
            this.closeSubmenus();
            this.updateUI();
        },

        toggleSelectMode() {
            const state = window.App.state;
            if (state.isWorkspaceSelectMode) {
                this.exitSelectMode();
            } else {
                this.enterSelectMode();
            }
        },

        toggleNoteSelection(noteId) {
            const state = window.App.state;
            if (state.selectedWorkspaceNoteIds.has(noteId)) {
                state.selectedWorkspaceNoteIds.delete(noteId);
            } else {
                state.selectedWorkspaceNoteIds.add(noteId);
            }
            this.updateUI();
        },

        updateUI() {
            const state = window.App.state;
            const workspaceView = window.App.workspaceView;

            if (!barElement) this.createBarDOM();

            // 1. Оновлюємо стан самої плашки дій
            if (state.isWorkspaceSelectMode) {
                barElement.classList.add('active');
                const count = state.selectedWorkspaceNoteIds.size;
                const countEl = barElement.querySelector('#ws-sel-count');
                if (countEl) countEl.textContent = `Вибрано ${count}`;

                // Робимо кнопки дій активними або приглушеними, якщо нічого не вибрано
                const actionBtns = barElement.querySelectorAll('.selection-action-btn');
                actionBtns.forEach(btn => {
                    btn.disabled = (count === 0);
                    btn.style.opacity = count === 0 ? '0.45' : '1';
                    btn.style.pointerEvents = count === 0 ? 'none' : 'auto';
                });
            } else {
                barElement.classList.remove('active');
            }

            // 2. Оновлюємо класи вибраних карток на робочій області
            document.querySelectorAll('.note-sticker[data-note-id]').forEach(card => {
                const noteId = card.dataset.noteId;
                if (state.isWorkspaceSelectMode) {
                    card.classList.add('in-select-mode');
                    if (state.selectedWorkspaceNoteIds.has(noteId)) {
                        card.classList.add('is-ws-selected');
                    } else {
                        card.classList.remove('is-ws-selected');
                    }
                } else {
                    card.classList.remove('in-select-mode', 'is-ws-selected');
                }
            });

            // 3. Оновлюємо вигляд кнопки "Вибрати" на верхньому острівці
            const islandSelectBtn = document.getElementById('island-select-toggle-btn');
            const islandSelectText = document.getElementById('island-select-text');
            if (islandSelectBtn && islandSelectText) {
                if (state.isWorkspaceSelectMode) {
                    islandSelectBtn.classList.add('active');
                    islandSelectText.textContent = 'Готово';
                    islandSelectBtn.title = 'Вийти з режиму вибору';
                } else {
                    islandSelectBtn.classList.remove('active');
                    islandSelectText.textContent = 'Вибрати';
                    islandSelectBtn.title = 'Режим мульти-вибору нотаток (як в iOS Галереї)';
                }
            }
        }
    };
})();