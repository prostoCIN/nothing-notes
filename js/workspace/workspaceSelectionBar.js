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

                    <!-- 1.5. Поділитись виділеними -->
                    <button class="selection-action-btn" id="ws-action-share-btn" title="Поділитись виділеними нотатками">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="18" cy="5" r="3"></circle>
                            <circle cx="6" cy="12" r="3"></circle>
                            <circle cx="18" cy="19" r="3"></circle>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                        </svg>
                        <span class="selection-btn-label desktop-only">Поділитись</span>
                    </button>

                    <!-- 2. Дублювати -->
                    <button class="selection-action-btn" id="ws-action-duplicate-btn" title="Дублювати виділені">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span class="selection-btn-label desktop-only">Дублювати</span>
                    </button>

                    <!-- 2.5. Перенести в іншу нотатку (створити піднотатки) -->
                    <button class="selection-action-btn" id="ws-action-move-btn" title="Перенести вибрані нотатки як піднотатки в іншу нотатку">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="15 10 20 15 15 20"></polyline>
                            <path d="M4 4v7a4 4 0 0 0 4 4h12"></path>
                        </svg>
                        <span class="selection-btn-label desktop-only">В піднотатки</span>
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

            // Запобігаємо випадковому закриттю підменю при взаємодії всередині них
            barElement.querySelectorAll('.selection-submenu-dropdown').forEach(d => {
                d.addEventListener('pointerdown', (e) => e.stopPropagation());
                d.addEventListener('click', (e) => e.stopPropagation());
            });

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

                        if (window.App.workspaceSelectionActions) {
                            window.App.workspaceSelectionActions.changeColor(selectedIds, c.id);
                        } else {
                            noteManager.updateMultipleNotes(selectedIds, { color: c.id });
                        }
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
                    badge.textContent = FONT_LABELS[stepIdx];
                    tickLines.forEach((t, i) => t.classList.toggle('active', i === stepIdx));

                    const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
                    if (selectedIds.length === 0) return;

                    if (window.App.workspaceSelectionActions) {
                        window.App.workspaceSelectionActions.changeFontSize(selectedIds, stepIdx, false);
                    }
                };

                slider.addEventListener('input', (e) => {
                    e.stopPropagation();
                    const stepIdx = Math.max(0, Math.min(3, parseInt(e.target.value, 10) || 0));
                    applyStep(stepIdx);
                });

                slider.addEventListener('change', (e) => {
                    const stepIdx = Math.max(0, Math.min(3, parseInt(e.target.value, 10) || 0));
                    const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
                    if (window.App.workspaceSelectionActions) {
                        window.App.workspaceSelectionActions.changeFontSize(selectedIds, stepIdx, true);
                    }
                });

                tickLines.forEach(tick => {
                    tick.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const stepIdx = parseInt(tick.dataset.step, 10);
                        slider.value = stepIdx;
                        applyStep(stepIdx);
                        const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
                        if (window.App.workspaceSelectionActions) {
                            window.App.workspaceSelectionActions.changeFontSize(selectedIds, stepIdx, true);
                        }
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
                        const item = document.createElement('div');
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
                            <div class="selection-tag-main-action">
                                <span class="selection-tag-color-dot tag-tape-color-${colorIndex}"></span>
                                <span class="selection-tag-text">${tagText}</span>
                                <span class="selection-tag-status-icon">${allHaveTag ? '✓' : (someHaveTag ? '–' : '')}</span>
                            </div>
                            <button class="selection-tag-del-btn" title="Видалити цей тег з усіх нотаток та зі списку">×</button>
                        `;

                        // Клік по самому тегу — додати до виділених або зняти з них
                        const mainAction = item.querySelector('.selection-tag-main-action');
                        mainAction.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (selectedIds.length === 0) return;
                            if (window.App.workspaceSelectionActions) {
                                window.App.workspaceSelectionActions.toggleTag(selectedIds, tagText);
                            }
                        });

                        // Клік по кнопці × — повне видалення тегу зі списку та з усіх нотаток
                        const delBtn = item.querySelector('.selection-tag-del-btn');
                        delBtn.addEventListener('pointerdown', (e) => {
                            e.stopPropagation();
                        });
                        delBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (window.App.workspaceSelectionActions) {
                                window.App.workspaceSelectionActions.deleteTagGlobally(tagText);
                            }
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
                    if (window.App.workspaceSelectionActions) {
                        window.App.workspaceSelectionActions.clearAllTags(selectedIds);
                    }
                });

                containerEl.appendChild(clearTagsBtn);

                // Рядок створення нового тегу прямо з панелі вибору
                const addRow = document.createElement('div');
                addRow.className = 'tag-add-option-row';

                const addInput = document.createElement('input');
                addInput.type = 'text';
                addInput.className = 'tag-add-input';
                addInput.placeholder = 'Новий тег...';

                const submitNewTag = () => {
                    const newOpt = addInput.value.trim();
                    if (newOpt) {
                        const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
                        if (window.App.workspaceSelectionActions) {
                            window.App.workspaceSelectionActions.createAndAssignTag(newOpt, selectedIds);
                        }
                    }
                };

                addInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        submitNewTag();
                    }
                });
                addInput.addEventListener('click', (e) => e.stopPropagation());

                const addBtnSubmit = document.createElement('button');
                addBtnSubmit.className = 'tag-add-btn';
                addBtnSubmit.textContent = '+ Створити';
                addBtnSubmit.addEventListener('click', (e) => {
                    e.stopPropagation();
                    submitNewTag();
                });

                addRow.appendChild(addInput);
                addRow.appendChild(addBtnSubmit);
                containerEl.appendChild(addRow);
            };

            populateTagContainer(barElement.querySelector('#ws-desktop-tags'));
            populateTagContainer(barElement.querySelector('#ws-more-tags'));

            // Переконуємось, що відкрите підменю тегів або загальне мобільне меню залишається активним
            if (activeSubMenu === 'tag') {
                const targetDropdown = barElement.querySelector('#ws-submenu-tag');
                const targetBtn = barElement.querySelector('#ws-action-tag-btn');
                if (targetDropdown) targetDropdown.classList.add('active');
                if (targetBtn) targetBtn.classList.add('active');
            } else if (activeSubMenu === 'more') {
                const targetDropdown = barElement.querySelector('#ws-submenu-more');
                const targetBtn = barElement.querySelector('#ws-action-more-btn');
                if (targetDropdown) targetDropdown.classList.add('active');
                if (targetBtn) targetBtn.classList.add('active');
            }
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

            // Поділитись виділеними
            const shareBtn = barElement.querySelector('#ws-action-share-btn');
            if (shareBtn) {
                shareBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.closeSubmenus();
                    const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
                    if (selectedIds.length === 0) return;

                    if (window.App.workspaceSelectionActions) {
                        window.App.workspaceSelectionActions.shareNotes(selectedIds);
                    } else if (window.App.shareManager) {
                        window.App.shareManager.showShareModal(state.activeBoardId, selectedIds);
                    }
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

                    if (window.App.workspaceSelectionActions) {
                        window.App.workspaceSelectionActions.duplicateNotes(selectedIds);
                    } else {
                        selectedIds.forEach(id => {
                            noteManager.duplicateNote(id);
                        });
                    }
                });
            }

            // Перенести вибрані в іншу нотатку (створити піднотатки)
            const moveBtn = barElement.querySelector('#ws-action-move-btn');
            if (moveBtn) {
                moveBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.closeSubmenus();
                    const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
                    if (selectedIds.length === 0) return;
                    this.openMoveModal(selectedIds);
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

                    if (window.App.workspaceSelectionActions) {
                        window.App.workspaceSelectionActions.deleteNotes(selectedIds, e);
                    } else {
                        noteManager.deleteNotes(selectedIds, e);
                    }
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
        },

        // Відкриття модального вікна вибору батьківської нотатки для створення піднотаток
        openMoveModal(selectedIds) {
            const state = window.App.state;
            const noteManager = window.App.noteManager;
            if (!selectedIds || selectedIds.length === 0 || !state || !noteManager) return;

            // Видаляємо старе модальне вікно, якщо існувало
            const existing = document.getElementById('move-notes-modal-backdrop');
            if (existing) existing.remove();

            // Всі нотатки поточного активного блокнота
            const allNotes = state.notes.filter(n => n.boardId === state.activeBoardId);
            const notesMap = new Map(allNotes.map(n => [n.id, n]));

            // Визначаємо заборонені ID (самі вибрані нотатки та всі їхні нащадки, щоб уникнути циклів)
            const invalidTargetIds = new Set(selectedIds);
            selectedIds.forEach(id => {
                const descendants = noteManager.getDescendantIds ? noteManager.getDescendantIds(id) : [];
                descendants.forEach(dId => invalidTargetIds.add(dId));
            });

            // Доступні нотатки-кандидати як батьки
            const candidateNotes = allNotes.filter(n => !invalidTargetIds.has(n.id));

            // Перевіряємо, чи є серед вибраних нотатки, які вже є чиїмись піднотатками
            const hasSubnotesInSelection = selectedIds.some(id => {
                const n = notesMap.get(id);
                return n && n.parentId !== null;
            });

            // Допоміжна функція екранування HTML
            const escapeHtml = (str) => {
                if (!str) return '';
                return String(str)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            };

            // Допоміжна функція для побудови шляху нотатки (хлібні крихти)
            const getNotePath = (note) => {
                const parts = [];
                let curr = note.parentId ? notesMap.get(note.parentId) : null;
                let depth = 0;
                while (curr && depth < 10) {
                    parts.unshift(curr.title && curr.title.trim() ? curr.title.trim() : 'Без назви');
                    curr = curr.parentId ? notesMap.get(curr.parentId) : null;
                    depth++;
                }
                return parts;
            };

            // Рахуємо кількість прямих дочірніх нотаток для кожної
            const childCountMap = new Map();
            allNotes.forEach(n => {
                if (n.parentId) {
                    childCountMap.set(n.parentId, (childCountMap.get(n.parentId) || 0) + 1);
                }
            });

            // Створюємо DOM модалки
            const modalEl = document.createElement('div');
            modalEl.id = 'move-notes-modal-backdrop';
            modalEl.className = 'move-notes-modal-backdrop';

            const countText = selectedIds.length === 1 
                ? '1 нотатка' 
                : (selectedIds.length < 5 ? `${selectedIds.length} нотатки` : `${selectedIds.length} нотаток`);

            modalEl.innerHTML = `
                <div class="move-notes-modal-card">
                    <div class="move-notes-modal-header">
                        <div class="move-notes-title-wrap">
                            <div class="move-notes-icon-wrap">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="15 10 20 15 15 20"></polyline>
                                    <path d="M4 4v7a4 4 0 0 0 4 4h12"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 class="move-notes-modal-title">
                                    <span>Перенести в піднотатки</span>
                                    <span class="move-notes-count-badge">${countText}</span>
                                </h3>
                                <p class="move-notes-modal-subtitle">Оберіть нотатку, до якої будуть додані вибрані нотатки як піднотатки</p>
                            </div>
                        </div>
                        <button class="move-notes-close-btn" id="move-notes-close-btn" title="Закрити (Esc)">✕</button>
                    </div>

                    <div class="move-notes-search-wrap">
                        <svg class="move-notes-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input type="text" class="move-notes-search-input" id="move-notes-search-input" placeholder="Пошук нотатки за назвою..." autocomplete="off">
                    </div>

                    <div class="move-notes-list-container" id="move-notes-list"></div>
                </div>
            `;

            document.body.appendChild(modalEl);

            const listContainer = modalEl.querySelector('#move-notes-list');
            const searchInput = modalEl.querySelector('#move-notes-search-input');
            const closeBtn = modalEl.querySelector('#move-notes-close-btn');

            const closeModal = () => {
                document.removeEventListener('keydown', handleKeydown);
                modalEl.remove();
            };

            const handleKeydown = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    closeModal();
                }
            };
            document.addEventListener('keydown', handleKeydown);

            modalEl.addEventListener('click', (e) => {
                if (e.target === modalEl) {
                    closeModal();
                }
            });

            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    closeModal();
                });
            }

            const onSelectTarget = (targetParentId, targetTitle) => {
                closeModal();
                if (window.App.workspaceSelectionActions && window.App.workspaceSelectionActions.moveNotesToParent) {
                    window.App.workspaceSelectionActions.moveNotesToParent(selectedIds, targetParentId);
                }
            };

            const renderList = (filterQuery = '') => {
                if (!listContainer) return;
                listContainer.innerHTML = '';
                const q = filterQuery.toLowerCase().trim();

                // 1. Опція перенесення в корінь (якщо є піднотатки або за запитом)
                if (hasSubnotesInSelection && (!q || 'головні нотатки корінь перша колонка'.includes(q))) {
                    const rootItem = document.createElement('div');
                    rootItem.className = 'move-notes-item is-root-option';
                    rootItem.innerHTML = `
                        <div class="move-notes-item-icon">📁</div>
                        <div class="move-notes-item-info">
                            <div class="move-notes-item-title">Головний рівень блокнота</div>
                            <div class="move-notes-item-meta">Зробити кореневими нотатками першої колонки (без батька)</div>
                        </div>
                        <div class="move-notes-item-action">
                            <span class="move-notes-item-badge">Корінь</span>
                            <svg class="move-notes-item-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    `;
                    rootItem.addEventListener('click', () => {
                        onSelectTarget(null, 'Головний рівень блокнота');
                    });
                    listContainer.appendChild(rootItem);
                }

                // 2. Фільтруємо нотатки
                const filteredCandidates = candidateNotes.filter(n => {
                    if (!q) return true;
                    const titleMatch = (n.title || '').toLowerCase().includes(q);
                    const contentMatch = (n.content || '').toLowerCase().includes(q);
                    return titleMatch || contentMatch;
                });

                if (filteredCandidates.length === 0 && (!hasSubnotesInSelection || q)) {
                    const emptyEl = document.createElement('div');
                    emptyEl.className = 'move-notes-empty';
                    emptyEl.textContent = q ? 'Нотаток за запитом не знайдено' : 'Немає доступних нотаток для перенесення';
                    listContainer.appendChild(emptyEl);
                    return;
                }

                filteredCandidates.forEach(n => {
                    const item = document.createElement('div');
                    item.className = 'move-notes-item';
                    item.dataset.noteId = n.id;

                    const title = (n.title && n.title.trim()) ? n.title.trim() : 'Без назви';
                    const path = getNotePath(n);
                    const pathText = path.length > 0 ? path.join(' > ') : 'Головний рівень';
                    const childCount = childCountMap.get(n.id) || 0;
                    const childCountText = childCount === 1 ? '1 піднотатка' : (childCount < 5 ? `${childCount} піднотатки` : `${childCount} піднотаток`);

                    item.innerHTML = `
                        <div class="move-notes-item-icon">${n.icon || '📝'}</div>
                        <div class="move-notes-item-info">
                            <div class="move-notes-item-title">${escapeHtml(title)}</div>
                            <div class="move-notes-item-meta">${escapeHtml(pathText)} · ${childCountText}</div>
                        </div>
                        <div class="move-notes-item-action">
                            <svg class="move-notes-item-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    `;

                    item.addEventListener('click', () => {
                        onSelectTarget(n.id, title);
                    });

                    listContainer.appendChild(item);
                });
            };

            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    renderList(e.target.value);
                });
            }

            renderList();
            if (searchInput) {
                setTimeout(() => searchInput.focus(), 50);
            }
        }
    };
})();