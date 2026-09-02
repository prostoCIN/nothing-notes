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
                        <span class="selection-bar-count-desktop desktop-only" id="ws-sel-count-desktop">Вибрано 0</span>
                        <span class="selection-bar-count-badge mobile-only" id="ws-sel-count-mobile">0</span>
                        <span class="selection-bar-divider desktop-only">|</span>
                        <button class="selection-bar-text-btn desktop-only" id="ws-sel-all-btn-desktop">Вибрати всі</button>
                        <button class="selection-bar-text-btn desktop-only" id="ws-sel-clear-btn-desktop">Зняти всі</button>
                        <div class="selection-bar-quick-btns mobile-only">
                            <button class="selection-bar-icon-btn" id="ws-sel-all-btn-mobile" title="Вибрати всі нотатки">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M9 11l3 3L22 4"></path>
                                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                                </svg>
                            </button>
                            <button class="selection-bar-icon-btn" id="ws-sel-clear-btn-mobile" title="Зняти всі виділення">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                    <line x1="9" y1="9" x2="15" y2="15"></line>
                                    <line x1="15" y1="9" x2="9" y2="15"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="selection-bar-actions">
                    <!-- ДЕСКТОП: Окремі кнопки Колір, Теги, Шрифт -->
                    <div class="selection-action-item desktop-only" id="ws-action-color-wrap">
                        <button class="selection-action-btn" id="ws-action-color-btn" title="Змінити колір">
                            <span class="selection-btn-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle>
                                    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle>
                                    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle>
                                    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle>
                                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path>
                                </svg>
                            </span>
                            <span class="selection-btn-label">Колір</span>
                        </button>
                        <div class="selection-submenu-dropdown selection-color-dropdown" id="ws-submenu-color">
                            <div class="selection-submenu-title">Обрати колір для виділених:</div>
                            <div class="selection-color-swatches" id="ws-desktop-colors"></div>
                        </div>
                    </div>

                    <div class="selection-action-item desktop-only" id="ws-action-tag-wrap">
                        <button class="selection-action-btn" id="ws-action-tag-btn" title="Прикріпити теги">
                            <span class="selection-btn-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                    <line x1="7" y1="7" x2="7.01" y2="7"></line>
                                </svg>
                            </span>
                            <span class="selection-btn-label">Теги</span>
                        </button>
                        <div class="selection-submenu-dropdown selection-tag-dropdown" id="ws-submenu-tag">
                            <div class="selection-submenu-title">Прикріпити тег:</div>
                            <div id="ws-desktop-tags"></div>
                        </div>
                    </div>

                    <div class="selection-action-item desktop-only" id="ws-action-font-wrap">
                        <button class="selection-action-btn" id="ws-action-font-btn" title="Розмір шрифту">
                            <span class="selection-btn-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="4 7 4 4 20 4 20 7"></polyline>
                                    <line x1="9" y1="20" x2="15" y2="20"></line>
                                    <line x1="12" y1="4" x2="12" y2="20"></line>
                                </svg>
                            </span>
                            <span class="selection-btn-label">Шрифт</span>
                        </button>
                        <div class="selection-submenu-dropdown selection-font-dropdown" id="ws-submenu-font">
                            <div class="selection-submenu-title">
                                <span>Розмір тексту:</span>
                                <span class="font-size-value-badge" id="ws-sel-font-badge-desktop">M (16px)</span>
                            </div>
                            <div class="sticker-font-slider-container">
                                <span class="slider-min-icon">A</span>
                                <div class="note-font-slider-track-wrap">
                                    <input type="range" class="sticker-font-slider" id="ws-sel-font-slider-desktop" min="0" max="3" step="1" value="1">
                                    <div class="note-font-slider-ticks">
                                        <span class="note-font-tick-line" data-step="0" title="S"></span>
                                        <span class="note-font-tick-line active" data-step="1" title="M"></span>
                                        <span class="note-font-tick-line" data-step="2" title="L"></span>
                                        <span class="note-font-tick-line" data-step="3" title="XL"></span>
                                    </div>
                                </div>
                                <span class="slider-max-icon">A</span>
                            </div>
                        </div>
                    </div>

                    <!-- МОБІЛЬНИЙ: Єдине меню '...' (Колір, Розмір, Теги) -->
                    <div class="selection-action-item mobile-only" id="ws-action-more-wrap">
                        <button class="selection-action-btn" id="ws-action-more-btn" title="Оформлення та теги">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="12" r="2.2"></circle>
                                <circle cx="19" cy="12" r="2.2"></circle>
                                <circle cx="5" cy="12" r="2.2"></circle>
                            </svg>
                        </button>
                        <div class="selection-submenu-dropdown selection-more-dropdown" id="ws-submenu-more">
                            <div class="selection-more-section">
                                <div class="selection-more-sec-title">
                                    <span class="selection-sec-title-left">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle>
                                            <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle>
                                            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle>
                                            <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle>
                                            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path>
                                        </svg>
                                        <span>Колір</span>
                                    </span>
                                </div>
                                <div class="selection-color-swatches" id="ws-more-colors"></div>
                            </div>
                            <div class="selection-more-section">
                                <div class="selection-more-sec-title">
                                    <span class="selection-sec-title-left">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="4 7 4 4 20 4 20 7"></polyline>
                                            <line x1="9" y1="20" x2="15" y2="20"></line>
                                            <line x1="12" y1="4" x2="12" y2="20"></line>
                                        </svg>
                                        <span>Розмір тексту</span>
                                    </span>
                                    <span class="font-size-value-badge" id="ws-sel-font-badge">M (16px)</span>
                                </div>
                                <div class="sticker-font-slider-container">
                                    <span class="slider-min-icon">A</span>
                                    <div class="note-font-slider-track-wrap">
                                        <input type="range" class="sticker-font-slider" id="ws-sel-font-slider" min="0" max="3" step="1" value="1">
                                        <div class="note-font-slider-ticks">
                                            <span class="note-font-tick-line" data-step="0" title="S"></span>
                                            <span class="note-font-tick-line active" data-step="1" title="M"></span>
                                            <span class="note-font-tick-line" data-step="2" title="L"></span>
                                            <span class="note-font-tick-line" data-step="3" title="XL"></span>
                                        </div>
                                    </div>
                                    <span class="slider-max-icon">A</span>
                                </div>
                            </div>
                            <div class="selection-more-section">
                                <div class="selection-more-sec-title">
                                    <span class="selection-sec-title-left">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                            <line x1="7" y1="7" x2="7.01" y2="7"></line>
                                        </svg>
                                        <span>Теги</span>
                                    </span>
                                </div>
                                <div id="ws-more-tags"></div>
                            </div>
                        </div>
                    </div>

                    <!-- 2. Дублювати -->
                    <button class="selection-action-btn" id="ws-action-duplicate-btn" title="Дублювати виділені">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span class="selection-btn-label desktop-only">Дублювати</span>
                    </button>

                    <!-- 3. Видалити -->
                    <button class="selection-action-btn selection-action-delete-btn" id="ws-action-delete-btn" title="Видалити виділені">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        <span class="selection-btn-label desktop-only">Видалити</span>
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

            const colors = window.App.NOTE_COLORS || [
                { id: 'yellow', hex: '#fef08a', name: 'Жовтий' },
                { id: 'green',  hex: '#bbf7d0', name: 'Зелений' },
                { id: 'blue',   hex: '#bae6fd', name: 'Блакитний' },
                { id: 'purple', hex: '#e9d5ff', name: 'Фіолетовий' },
                { id: 'pink',   hex: '#fbcfe8', name: 'Рожевий' },
                { id: 'orange', hex: '#fed7aa', name: 'Помаранчевий' },
                { id: 'gray',   hex: '#e2e8f0', name: 'Сірий' }
            ];

            const populateColors = (containerEl) => {
                if (!containerEl) return;
                containerEl.innerHTML = '';
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

                    containerEl.appendChild(swatch);
                });
            };

            // Заповнюємо кольори для Десктопу та Мобільного
            populateColors(barElement.querySelector('#ws-desktop-colors'));
            populateColors(barElement.querySelector('#ws-more-colors'));

            // Налаштування слайдерів шрифту (Десктоп і Мобільний) зі стандартною шкалою S / M / L / XL
            const FONT_SIZES = window.App.FONT_SIZES || [12, 16, 24, 32];
            const FONT_LABELS = window.App.FONT_LABELS || ['S (12px)', 'M (16px)', 'L (24px)', 'XL (32px)'];

            const setupFontSlider = (sliderId, badgeId) => {
                const slider = barElement.querySelector(sliderId);
                const badge = barElement.querySelector(badgeId);
                if (!slider || !badge) return;

                const sliderContainer = slider.closest('.sticker-font-slider-container');
                const tickLines = sliderContainer ? sliderContainer.querySelectorAll('.note-font-tick-line') : [];

                const applyStep = (stepIdx) => {
                    const newSize = FONT_SIZES[stepIdx];
                    badge.textContent = FONT_LABELS[stepIdx];
                    tickLines.forEach((t, i) => t.classList.toggle('active', i === stepIdx));

                    const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
                    if (selectedIds.length === 0) return;

                    selectedIds.forEach(id => {
                        const card = document.querySelector(`.note-sticker[data-note-id="${id}"]`);
                        if (card) {
                            card.dataset.fontStep = stepIdx;
                            card.style.setProperty('--custom-content-font-size', `${newSize}px`);
                            card.style.setProperty('--custom-title-font-size', `${Math.round(newSize * 1.5)}px`);
                            card.style.setProperty('--custom-line-height', `${Math.max(26, Math.round(newSize * 1.7))}px`);
                            card.classList.add('has-custom-font-size');
                        }
                    });

                    noteManager.updateMultipleNotes(selectedIds, { fontSize: newSize }, false);
                };

                slider.addEventListener('input', (e) => {
                    e.stopPropagation();
                    const stepIdx = Math.max(0, Math.min(3, parseInt(e.target.value, 10) || 0));
                    applyStep(stepIdx);
                });

                slider.addEventListener('change', (e) => {
                    const stepIdx = Math.max(0, Math.min(3, parseInt(e.target.value, 10) || 0));
                    const newSize = FONT_SIZES[stepIdx];
                    const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
                    noteManager.updateMultipleNotes(selectedIds, { fontSize: newSize }, true);
                });

                tickLines.forEach(tick => {
                    tick.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const stepIdx = parseInt(tick.dataset.step, 10);
                        slider.value = stepIdx;
                        applyStep(stepIdx);
                        const newSize = FONT_SIZES[stepIdx];
                        const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
                        noteManager.updateMultipleNotes(selectedIds, { fontSize: newSize }, true);
                    });
                });
            };

            setupFontSlider('#ws-sel-font-slider-desktop', '#ws-sel-font-badge-desktop');
            setupFontSlider('#ws-sel-font-slider', '#ws-sel-font-badge');

            // Теги
            this.refreshTagSubmenu();
        },

        refreshTagSubmenu() {
            if (!barElement) return;
            const state = window.App.state;
            const storage = window.App.storage;
            const noteManager = window.App.noteManager;

            const populateTagContainer = (containerEl) => {
                if (!containerEl) return;
                containerEl.innerHTML = '';

                const options = storage.getTagOptions ? storage.getTagOptions() : [];

                if (options.length === 0) {
                    const emptyText = document.createElement('div');
                    emptyText.className = 'selection-submenu-empty';
                    emptyText.textContent = 'Немає створених тегів';
                    containerEl.appendChild(emptyText);
                } else {
                    const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
                    const selectedNotes = selectedIds.map(id => noteManager.getNoteById(id)).filter(Boolean);

                    const tagList = document.createElement('div');
                    tagList.className = 'selection-tag-list';

                    options.forEach(tagText => {
                        const item = document.createElement('button');
                        item.className = 'selection-tag-item';

                        const colorIndex = window.App.getTagColorIndex ? window.App.getTagColorIndex(tagText) : 0;

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

                    containerEl.appendChild(tagList);
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

                containerEl.appendChild(clearTagsBtn);
            };

            populateTagContainer(barElement.querySelector('#ws-desktop-tags'));
            populateTagContainer(barElement.querySelector('#ws-more-tags'));
        },

        bindBarEvents() {
            const state = window.App.state;
            const noteManager = window.App.noteManager;

            // Кнопка закриття режиму вибору
            const cancelBtn = barElement.querySelector('#ws-sel-cancel-btn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    this.exitSelectMode();
                });
            }

            // Вибрати всі
            const selectAll = () => {
                const allVisibleStickers = document.querySelectorAll('.note-sticker[data-note-id]');
                allVisibleStickers.forEach(card => {
                    if (card.dataset.noteId) {
                        state.selectedWorkspaceNoteIds.add(card.dataset.noteId);
                    }
                });
                this.updateUI();
            };

            const selAllDesktop = barElement.querySelector('#ws-sel-all-btn-desktop');
            const selAllMobile = barElement.querySelector('#ws-sel-all-btn-mobile');
            if (selAllDesktop) selAllDesktop.addEventListener('click', selectAll);
            if (selAllMobile) selAllMobile.addEventListener('click', selectAll);

            // Зняти всі
            const clearAll = () => {
                state.selectedWorkspaceNoteIds.clear();
                this.updateUI();
            };

            const clearAllDesktop = barElement.querySelector('#ws-sel-clear-btn-desktop');
            const clearAllMobile = barElement.querySelector('#ws-sel-clear-btn-mobile');
            if (clearAllDesktop) clearAllDesktop.addEventListener('click', clearAll);
            if (clearAllMobile) clearAllMobile.addEventListener('click', clearAll);

            // Кнопки субменю Десктоп
            const colorBtn = barElement.querySelector('#ws-action-color-btn');
            if (colorBtn) {
                colorBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleSubmenu('color');
                });
            }

            const tagBtn = barElement.querySelector('#ws-action-tag-btn');
            if (tagBtn) {
                tagBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.refreshTagSubmenu();
                    this.toggleSubmenu('tag');
                });
            }

            const fontBtn = barElement.querySelector('#ws-action-font-btn');
            if (fontBtn) {
                fontBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleSubmenu('font');
                });
            }

            // Кнопка відкриття меню "три крапки" (Мобільний)
            const moreBtn = barElement.querySelector('#ws-action-more-btn');
            if (moreBtn) {
                moreBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.refreshTagSubmenu();
                    this.toggleSubmenu('more');
                });
            }

            // Дублювати виділені
            const duplicateBtn = barElement.querySelector('#ws-action-duplicate-btn');
            if (duplicateBtn) {
                duplicateBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.closeSubmenus();
                    const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
                    if (selectedIds.length === 0) return;

                    selectedIds.forEach(id => {
                        noteManager.duplicateNote(id);
                    });
                });
            }

            // Видалити виділені (з модальним вікном підтвердження)
            const deleteBtn = barElement.querySelector('#ws-action-delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.closeSubmenus();
                    const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
                    if (selectedIds.length === 0) return;

                    noteManager.deleteNotes(selectedIds, e);
                });
            }
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
                const countDesktop = barElement.querySelector('#ws-sel-count-desktop');
                const countMobile = barElement.querySelector('#ws-sel-count-mobile');
                if (countDesktop) countDesktop.textContent = `Вибрано ${count}`;
                if (countMobile) countMobile.textContent = count;

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