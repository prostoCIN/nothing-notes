// js/workspace/workspaceSelectionBar.js - Панель масового вибору та дій (Nothing Modular Dock)
window.App = window.App || {};

(function() {
    let barElement = null;
    let activeSubMenu = null; // 'style' | 'plus' | 'more'
    let activePlusTab = 'tags'; // 'tags' | 'bookmarks' | 'subnotes'

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
                    <button class="selection-bar-close-btn" id="ws-sel-cancel-btn" title="Скасувати вибір" data-i18n-title="selectionBar.cancelSelection">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                    <div class="selection-bar-info">
                        <span class="selection-bar-count-desktop desktop-only" id="ws-sel-count-desktop">Вибрано 0</span>
                        <button class="selection-bar-count-badge mobile-only" id="ws-sel-count-mobile" title="Вибрати всі / Зняти всі" data-i18n-title="selectionBar.toggleSelectAll">0</button>
                        <span class="selection-bar-divider desktop-only">|</span>
                        <button class="selection-bar-text-btn desktop-only" id="ws-sel-all-btn-desktop" data-i18n="selectionBar.selectAll">Вибрати всі</button>
                        <button class="selection-bar-text-btn desktop-only" id="ws-sel-clear-btn-desktop" data-i18n="selectionBar.clearAll">Зняти всі</button>
                    </div>
                </div>

                <div class="selection-bar-actions">
                    <!-- ГРУПА 1: Оформлення (Стиль: колір + шрифт) та Додавання (Плюс: теги + закладка + піднотатки) -->
                    <div class="selection-action-group selection-group-tools" id="ws-group-tools">
                        <!-- 1. Стиль (Колір та Шрифт) -->
                        <div class="selection-action-item" id="ws-action-style-wrap">
                            <button class="selection-action-btn" id="ws-action-style-btn" title="Оформлення (колір та шрифт)" data-i18n-title="selectionBar.styleTitle">
                                <span class="selection-btn-icon">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle>
                                        <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle>
                                        <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle>
                                        <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle>
                                        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path>
                                    </svg>
                                </span>
                                <span class="selection-btn-label desktop-only" data-i18n="selectionBar.styleTitle">Стиль</span>
                            </button>
                            <div class="selection-submenu-dropdown selection-style-dropdown" id="ws-submenu-style">
                                <div class="selection-dropdown-section">
                                    <div class="selection-submenu-title" data-i18n="selectionBar.selectColorTitle">Колір нотаток:</div>
                                    <div class="selection-color-swatches" id="ws-style-colors"></div>
                                </div>
                                <div class="selection-dropdown-divider"></div>
                                <div class="selection-dropdown-section">
                                    <div class="selection-submenu-title">
                                        <span data-i18n="selectionBar.fontSizeTitle">Розмір тексту:</span>
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
                            </div>
                        </div>

                        <!-- 2. Додати (Теги, Закладки, Піднотатки) з сегментованими вкладками -->
                        <div class="selection-action-item" id="ws-action-plus-wrap">
                            <button class="selection-action-btn" id="ws-action-plus-btn" title="Додати (теги, закладки, піднотатки)" data-i18n-title="selectionBar.plusTitle">
                                <span class="selection-btn-icon">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                    </svg>
                                </span>
                                <span class="selection-btn-label desktop-only" data-i18n="selectionBar.addBtn">Додати</span>
                            </button>
                            <div class="selection-submenu-dropdown selection-plus-dropdown" id="ws-submenu-plus">
                                <div class="selection-plus-nav">
                                    <button type="button" class="selection-nav-tab active" data-tab="tags">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                            <line x1="7" y1="7" x2="7.01" y2="7"></line>
                                        </svg>
                                        <span data-i18n="selectionBar.tagSelected">Теги</span>
                                    </button>
                                    <button type="button" class="selection-nav-tab" data-tab="bookmarks">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                                        </svg>
                                        <span data-i18n="selectionBar.bookmarkSelected">Закладки</span>
                                    </button>
                                    <button type="button" class="selection-nav-tab" data-tab="subnotes">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="9 10 4 15 9 20"></polyline>
                                            <path d="M20 4v7a4 4 0 0 1-4 4H4"></path>
                                        </svg>
                                        <span data-i18n="selectionBar.tabSubnotes">Піднотатки</span>
                                    </button>
                                </div>

                                <!-- 1. Панель Теги -->
                                <div class="selection-tab-pane" id="ws-pane-tags">
                                    <div id="ws-plus-tags"></div>
                                </div>

                                <!-- 2. Панель Закладки -->
                                <div class="selection-tab-pane" id="ws-pane-bookmarks" style="display: none;"></div>

                                <!-- 3. Панель Піднотатки -->
                                <div class="selection-tab-pane" id="ws-pane-subnotes" style="display: none;"></div>
                            </div>
                        </div>
                    </div>

                    <span class="selection-group-separator desktop-only" id="ws-sep-tools"></span>

                    <!-- ГРУПА 2: Дії (Меню "..." з Поділитись / Дублювати, та Видалити) -->
                    <div class="selection-action-group selection-group-actions" id="ws-group-actions">
                        <!-- Кнопка "..." (Дії: Поділитись, Дублювати) -->
                        <div class="selection-action-item" id="ws-action-more-wrap">
                            <button class="selection-action-btn" id="ws-action-more-btn" title="Дії з виділеними" data-i18n-title="selectionBar.moreActionsTitle">
                                <span class="selection-btn-icon">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                        <circle cx="12" cy="12" r="2.2"></circle>
                                        <circle cx="19" cy="12" r="2.2"></circle>
                                        <circle cx="5" cy="12" r="2.2"></circle>
                                    </svg>
                                </span>
                                <span class="selection-btn-label desktop-only" data-i18n="selectionBar.moreActions">Дії</span>
                            </button>
                            <div class="selection-submenu-dropdown selection-more-actions-dropdown" id="ws-submenu-more">
                                <button type="button" class="selection-menu-action-row" id="ws-action-share-btn">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <circle cx="18" cy="5" r="3"></circle>
                                        <circle cx="6" cy="12" r="3"></circle>
                                        <circle cx="18" cy="19" r="3"></circle>
                                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                                    </svg>
                                    <span data-i18n="selectionBar.shareSelected">Поділитись виділеними</span>
                                </button>
                                <button type="button" class="selection-menu-action-row" id="ws-action-duplicate-btn">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                    <span data-i18n="sticker.duplicate">Дублювати</span>
                                </button>
                            </div>
                        </div>

                        <!-- Видалити -->
                        <button class="selection-action-btn selection-action-delete-btn" id="ws-action-delete-btn" title="Видалити виділені" data-i18n-title="selectionBar.deleteSelected">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 6h18"></path>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            <span class="selection-btn-label desktop-only" data-i18n="selectionBar.deleteSelected">Видалити</span>
                        </button>
                    </div>
                </div>
            `;

            if (window.App && window.App.i18n && window.App.i18n.updateDOM) {
                window.App.i18n.updateDOM(barElement);
            }

            document.body.appendChild(barElement);

            this.buildSubmenus();
            this.bindBarEvents();
        },

        buildSubmenus() {
            const state = window.App.state;
            const noteManager = window.App.noteManager;

            // Запобігаємо випадковому закриттю підменю при взаємодії всередині них
            barElement.querySelectorAll('.selection-submenu-dropdown').forEach(d => {
                d.addEventListener('pointerdown', (e) => e.stopPropagation());
                d.addEventListener('click', (e) => e.stopPropagation());
            });

            // Навігація між вкладками в меню "Додати"
            barElement.querySelectorAll('.selection-nav-tab').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const tab = btn.dataset.tab;
                    this.switchPlusTab(tab);
                });
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

            populateColors(barElement.querySelector('#ws-style-colors'));

            // Налаштування слайдера шрифту зі шкалою S / M / L / XL
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

            setupFontSlider('#ws-sel-font-slider', '#ws-sel-font-badge');

            // Теги
            this.refreshTagSubmenu();
        },

        switchPlusTab(tabName) {
            activePlusTab = tabName;
            if (!barElement) return;

            barElement.querySelectorAll('.selection-nav-tab').forEach(b => {
                b.classList.toggle('active', b.dataset.tab === tabName);
            });

            const panes = {
                tags: barElement.querySelector('#ws-pane-tags'),
                bookmarks: barElement.querySelector('#ws-pane-bookmarks'),
                subnotes: barElement.querySelector('#ws-pane-subnotes')
            };

            Object.keys(panes).forEach(k => {
                if (panes[k]) {
                    panes[k].style.display = (k === tabName) ? 'flex' : 'none';
                }
            });

            if (tabName === 'tags') {
                this.refreshTagSubmenu();
            } else if (tabName === 'bookmarks') {
                this.refreshBookmarksSubmenu();
            } else if (tabName === 'subnotes') {
                this.refreshSubnotesSubmenu();
            }
        },

        syncStyleState() {
            if (!barElement) return;
            const state = window.App.state;
            const noteManager = window.App.noteManager;
            const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
            if (selectedIds.length === 0) return;

            const FONT_LABELS = window.App.FONT_LABELS || ['S (12px)', 'M (16px)', 'L (24px)', 'XL (32px)'];
            const selectedNotes = selectedIds.map(id => noteManager ? noteManager.getNoteById(id) : null).filter(Boolean);
            if (selectedNotes.length === 0) return;

            const firstFontSize = selectedNotes[0].fontSize;
            const allSameSize = selectedNotes.every(n => n.fontSize === firstFontSize);
            const stepIdx = (allSameSize && typeof firstFontSize === 'number' && firstFontSize >= 0 && firstFontSize <= 3) 
                ? firstFontSize 
                : 1;

            const slider = barElement.querySelector('#ws-sel-font-slider');
            const badge = barElement.querySelector('#ws-sel-font-badge');
            if (slider) slider.value = stepIdx;
            if (badge) badge.textContent = FONT_LABELS[stepIdx];

            const sliderContainer = slider ? slider.closest('.sticker-font-slider-container') : null;
            const tickLines = sliderContainer ? sliderContainer.querySelectorAll('.note-font-tick-line') : [];
            tickLines.forEach((t, i) => t.classList.toggle('active', i === stepIdx));
        },

        refreshTagSubmenu() {
            if (!barElement) return;
            const state = window.App.state;
            const storage = window.App.storage;
            const noteManager = window.App.noteManager;

            const t = (k, p) => (window.App && window.App.i18n) ? window.App.i18n.t(k, p) : k;

            const populateTagContainer = (containerEl) => {
                if (!containerEl) return;
                containerEl.innerHTML = '';

                const options = storage.getTagOptions ? storage.getTagOptions() : [];

                if (options.length === 0) {
                    const emptyText = document.createElement('div');
                    emptyText.className = 'selection-submenu-empty';
                    emptyText.textContent = t('sticker.emptyTags');
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
                            <button class="selection-tag-del-btn" title="${t('sticker.delTagTooltip')}">×</button>
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
                    <span>${t('selectionBar.clearAllTags')}</span>
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
                addInput.placeholder = t('sticker.newTagPlaceholder');

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

                const addBtn = document.createElement('button');
                addBtn.type = 'button';
                addBtn.className = 'tag-add-btn';
                addBtn.textContent = '+';
                addBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    submitNewTag();
                });

                addRow.appendChild(addInput);
                addRow.appendChild(addBtn);
                containerEl.appendChild(addRow);
            };

            populateTagContainer(barElement.querySelector('#ws-plus-tags'));
        },

        refreshBookmarksSubmenu() {
            const pane = barElement.querySelector('#ws-pane-bookmarks');
            if (!pane) return;
            pane.innerHTML = '';
            const state = window.App.state;
            const noteManager = window.App.noteManager;
            const stickerBookmarks = window.App.stickerBookmarks;
            const t = (k, p) => (window.App && window.App.i18n) ? window.App.i18n.t(k, p) : k;

            const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
            const selectedNotes = selectedIds.map(id => noteManager ? noteManager.getNoteById(id) : null).filter(Boolean);

            // Кнопка відкриття Bookmark Picker
            const pickerBtn = document.createElement('button');
            pickerBtn.type = 'button';
            pickerBtn.className = 'selection-bookmark-action-btn';
            pickerBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>${t('selectionBar.bookmarkTitle') || 'Обрати закладку для виділених...'}</span>
            `;
            pickerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeSubmenus();
                if (stickerBookmarks && stickerBookmarks.openBookmarkPicker) {
                    stickerBookmarks.openBookmarkPicker(selectedNotes);
                }
            });
            pane.appendChild(pickerBtn);

            // Список наявних закладок у виділених нотатках
            const allLinkedIds = new Set();
            selectedNotes.forEach(n => {
                const ids = Array.isArray(n.linkedNoteIds) ? n.linkedNoteIds : (stickerBookmarks ? stickerBookmarks.getSavedBookmarks(n.id) : []);
                ids.forEach(id => allLinkedIds.add(id));
            });

            if (allLinkedIds.size > 0) {
                const linkedListTitle = document.createElement('div');
                linkedListTitle.className = 'selection-submenu-title';
                linkedListTitle.style.marginTop = '6px';
                linkedListTitle.textContent = t('selectionBar.bookmarkTabTitle') || 'Прив\'язані закладки:';
                pane.appendChild(linkedListTitle);

                const listWrap = document.createElement('div');
                listWrap.className = 'selection-tag-list';
                listWrap.style.maxHeight = '140px';

                allLinkedIds.forEach(targetId => {
                    const targetNote = noteManager ? noteManager.getNoteById(targetId) : null;
                    if (!targetNote) return;

                    const item = document.createElement('div');
                    item.className = 'selection-tag-item';
                    const rawTitle = (targetNote.title && targetNote.title.trim()) ? targetNote.title.trim() : (t('common.untitled') || 'Без назви');
                    const icon = targetNote.icon || '🔖';

                    item.innerHTML = `
                        <div class="selection-tag-main-action">
                            <span>${icon}</span>
                            <span class="selection-tag-text">${rawTitle}</span>
                        </div>
                        <button class="selection-tag-del-btn" title="Видалити закладку">×</button>
                    `;

                    // Видалити цю закладку з усіх виділених нотаток
                    const delBtn = item.querySelector('.selection-tag-del-btn');
                    delBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        selectedNotes.forEach(n => {
                            if (stickerBookmarks && stickerBookmarks.removeBookmark) {
                                stickerBookmarks.removeBookmark(n, targetId, null, false);
                            }
                        });
                        this.refreshBookmarksSubmenu();
                    });

                    listWrap.appendChild(item);
                });

                pane.appendChild(listWrap);

                // Очистити всі закладки
                const clearBtn = document.createElement('button');
                clearBtn.type = 'button';
                clearBtn.className = 'selection-tag-clear-btn';
                clearBtn.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    <span>Очистити всі закладки</span>
                `;
                clearBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    allLinkedIds.forEach(targetId => {
                        selectedNotes.forEach(n => {
                            if (stickerBookmarks && stickerBookmarks.removeBookmark) {
                                stickerBookmarks.removeBookmark(n, targetId, null, false);
                            }
                        });
                    });
                    this.refreshBookmarksSubmenu();
                });
                pane.appendChild(clearBtn);
            }
        },

        refreshSubnotesSubmenu() {
            const pane = barElement.querySelector('#ws-pane-subnotes');
            if (!pane) return;
            pane.innerHTML = '';
            const state = window.App.state;
            const noteManager = window.App.noteManager;
            const actions = window.App.workspaceSelectionActions;
            const t = (k, p) => (window.App && window.App.i18n) ? window.App.i18n.t(k, p) : k;

            const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
            if (selectedIds.length === 0) return;

            const currentBoardId = state.activeBoardId;
            const allNotes = (state.notes || []).filter(n => !n.isDeleted && (!currentBoardId || n.boardId === currentBoardId));

            // Виключаємо самі виділені нотатки та їхніх нащадків
            const excludedIds = new Set(selectedIds);
            selectedIds.forEach(id => {
                const descendants = noteManager && noteManager.getDescendantIds ? noteManager.getDescendantIds(id) : [];
                descendants.forEach(dId => excludedIds.add(dId));
            });

            const eligibleParents = allNotes.filter(n => !excludedIds.has(n.id));

            // Поле швидкого пошуку нотатки
            const searchWrap = document.createElement('div');
            searchWrap.className = 'tag-add-option-row';
            searchWrap.style.marginBottom = '6px';
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'tag-add-input';
            searchInput.placeholder = t('selectionBar.searchParentNote') || 'Пошук батьківської нотатки...';
            searchWrap.appendChild(searchInput);
            pane.appendChild(searchWrap);

            const listWrap = document.createElement('div');
            listWrap.className = 'selection-tag-list';
            listWrap.style.maxHeight = '150px';

            const renderList = (filterText = '') => {
                listWrap.innerHTML = '';

                // Опція зробити кореневими нотатками (зняти батька)
                const rootOption = document.createElement('div');
                rootOption.className = 'selection-tag-item';
                rootOption.style.cursor = 'pointer';
                rootOption.innerHTML = `
                    <div class="selection-tag-main-action">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="19" x2="12" y2="5"></line>
                            <polyline points="5 12 12 5 19 12"></polyline>
                        </svg>
                        <span class="selection-tag-text" style="font-weight: 700;">${t('selectionBar.detachSubnotes') || 'Головні нотатки (без батька)'}</span>
                    </div>
                `;
                rootOption.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.closeSubmenus();
                    if (actions && actions.moveNotesToParent) {
                        actions.moveNotesToParent(selectedIds, null);
                    }
                    if (window.App.showNotification) {
                        window.App.showNotification('Нотатки переміщено в корінь');
                    }
                });
                listWrap.appendChild(rootOption);

                const filtered = filterText
                    ? eligibleParents.filter(n => (n.title || '').toLowerCase().includes(filterText.toLowerCase()) || (n.content || '').toLowerCase().includes(filterText.toLowerCase()))
                    : eligibleParents;

                if (filtered.length === 0) {
                    const emptyMsg = document.createElement('div');
                    emptyMsg.className = 'selection-submenu-empty';
                    emptyMsg.textContent = 'Нотаток не знайдено';
                    listWrap.appendChild(emptyMsg);
                } else {
                    filtered.forEach(parentNote => {
                        const item = document.createElement('div');
                        item.className = 'selection-tag-item';
                        item.style.cursor = 'pointer';

                        const rawTitle = (parentNote.title && parentNote.title.trim()) ? parentNote.title.trim() : (t('common.untitled') || 'Без назви');
                        const icon = parentNote.icon || '📄';

                        item.innerHTML = `
                            <div class="selection-tag-main-action">
                                <span>${icon}</span>
                                <span class="selection-tag-text">${rawTitle}</span>
                            </div>
                        `;

                        item.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.closeSubmenus();
                            if (actions && actions.moveNotesToParent) {
                                actions.moveNotesToParent(selectedIds, parentNote.id);
                            }
                            if (window.App.showNotification) {
                                window.App.showNotification(`Зроблено піднотатками "${rawTitle}"`);
                            }
                        });

                        listWrap.appendChild(item);
                    });
                }
            };

            renderList();

            searchInput.addEventListener('input', (e) => {
                renderList(e.target.value.trim());
            });
            searchInput.addEventListener('click', (e) => e.stopPropagation());

            pane.appendChild(listWrap);
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
            if (selAllDesktop) selAllDesktop.addEventListener('click', selectAll);

            // Зняти всі
            const clearAll = () => {
                state.selectedWorkspaceNoteIds.clear();
                this.updateUI();
            };

            const clearAllDesktop = barElement.querySelector('#ws-sel-clear-btn-desktop');
            if (clearAllDesktop) clearAllDesktop.addEventListener('click', clearAll);

            // Мобільний смарт-бейдж: перемикання "Вибрати всі" ⇄ "Зняти всі"
            const countMobile = barElement.querySelector('#ws-sel-count-mobile');
            if (countMobile) {
                countMobile.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const allVisibleStickers = document.querySelectorAll('.note-sticker[data-note-id]');
                    const totalVisible = allVisibleStickers.length;
                    if (totalVisible === 0) return;
                    if (state.selectedWorkspaceNoteIds.size >= totalVisible) {
                        clearAll();
                    } else {
                        selectAll();
                    }
                });
            }

            // Кнопка Стиль (Колір + Шрифт)
            const styleBtn = barElement.querySelector('#ws-action-style-btn');
            if (styleBtn) {
                styleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.syncStyleState();
                    this.toggleSubmenu('style');
                });
            }

            // Кнопка Додати (Теги, Закладки, Піднотатки)
            const plusBtn = barElement.querySelector('#ws-action-plus-btn');
            if (plusBtn) {
                plusBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.switchPlusTab(activePlusTab);
                    this.toggleSubmenu('plus');
                });
            }

            // Кнопка Дії "три крапки" (Поділитись, Дублювати)
            const moreBtn = barElement.querySelector('#ws-action-more-btn');
            if (moreBtn) {
                moreBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleSubmenu('more');
                });
            }

            // Поділитись виділеними (всередині меню Дії)
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

            // Дублювати виділені (всередині меню Дії)
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
            document.addEventListener('click', (e) => {
                if (activeSubMenu && barElement && !barElement.contains(e.target)) {
                    this.closeSubmenus();
                }
            });

            // Закриття по Escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    if (activeSubMenu) {
                        this.closeSubmenus();
                    } else if (window.App.state && window.App.state.isWorkspaceSelectMode) {
                        this.exitSelectMode();
                    }
                }
            });
        },

        toggleSubmenu(menuName) {
            const isSame = (activeSubMenu === menuName);
            this.closeSubmenus();
            if (!isSame) {
                activeSubMenu = menuName;
                const dropdown = barElement.querySelector(`#ws-submenu-${menuName}`);
                const btn = barElement.querySelector(`#ws-action-${menuName}-btn`);
                if (dropdown) dropdown.classList.add('active');
                if (btn) btn.classList.add('active');
            }
        },

        closeSubmenus() {
            activeSubMenu = null;
            if (!barElement) return;
            barElement.querySelectorAll('.selection-submenu-dropdown').forEach(d => d.classList.remove('active'));
            barElement.querySelectorAll('.selection-action-btn').forEach(b => {
                if (b.id !== 'ws-action-delete-btn') b.classList.remove('active');
            });
        },

        enterSelectMode() {
            const state = window.App.state;
            state.isWorkspaceSelectMode = true;
            this.updateUI();
        },

        exitSelectMode() {
            const state = window.App.state;
            state.isWorkspaceSelectMode = false;
            state.selectedWorkspaceNoteIds.clear();
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
            if (!state.isWorkspaceSelectMode) {
                this.enterSelectMode();
            }
            if (state.selectedWorkspaceNoteIds.has(noteId)) {
                state.selectedWorkspaceNoteIds.delete(noteId);
            } else {
                state.selectedWorkspaceNoteIds.add(noteId);
            }
            this.updateUI();
        },

        updateUI() {
            const state = window.App.state;

            if (!barElement) this.createBarDOM();

            // 1. Оновлюємо стан самої плашки дій
            if (state.isWorkspaceSelectMode) {
                barElement.classList.add('active');
                const count = state.selectedWorkspaceNoteIds.size;
                const countDesktop = barElement.querySelector('#ws-sel-count-desktop');
                const countMobile = barElement.querySelector('#ws-sel-count-mobile');
                const t = (k, p) => (window.App && window.App.i18n) ? window.App.i18n.t(k, p) : k;
                if (countDesktop) countDesktop.textContent = t('selectionBar.selectedCount', { count });
                if (countMobile) countMobile.textContent = count;

                // Визначаємо чи активний блокнот або всі вибрані нотатки є read-only
                const currentBoard = window.App.boardManager ? window.App.boardManager.getActiveBoard() : null;
                const isCurrentBoardReadOnly = !!(currentBoard && currentBoard.isReadOnly) || (state.activeBoardId && state.activeBoardId.startsWith('shared_'));
                
                // Перевіряємо також вибрані нотатки
                const noteManager = window.App.noteManager;
                const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
                const hasOnlyReadOnlyNotes = selectedIds.length > 0 && selectedIds.every(id => {
                    const n = noteManager ? noteManager.getNoteById(id) : null;
                    return n && (n.isReadOnly || (n.boardId && n.boardId.startsWith('shared_')));
                });

                const isReadOnlyContext = isCurrentBoardReadOnly || hasOnlyReadOnlyNotes;

                // Елементи для редагування стилів та метаданих (стиль, плюс)
                const groupTools = barElement.querySelector('#ws-group-tools');
                const sepTools = barElement.querySelector('#ws-sep-tools');
                const duplicateBtn = barElement.querySelector('#ws-action-duplicate-btn');
                const deleteBtn = barElement.querySelector('#ws-action-delete-btn');

                if (isReadOnlyContext) {
                    if (groupTools) groupTools.style.display = 'none';
                    if (sepTools) sepTools.style.display = 'none';
                } else {
                    if (groupTools) groupTools.style.display = '';
                    if (sepTools) sepTools.style.display = '';
                }

                // Адаптація кнопки дублювання (клонування)
                if (duplicateBtn) {
                    const dupLabel = duplicateBtn.querySelector('.selection-btn-label');
                    if (isReadOnlyContext) {
                        const canClone = !currentBoard || currentBoard.allowClone !== false;
                        duplicateBtn.title = canClone ? t('selectionBar.cloneSelected') : t('selectionBar.cloneNotAllowed');
                        if (dupLabel) dupLabel.textContent = t('selectionBar.cloneSelected');
                        duplicateBtn.style.display = canClone ? '' : 'none';
                    } else {
                        duplicateBtn.title = t('selectionBar.duplicateSelected');
                        if (dupLabel) dupLabel.textContent = t('sticker.duplicate');
                        duplicateBtn.style.display = '';
                    }
                }

                // Адаптація кнопки видалення / приховування
                if (deleteBtn) {
                    const delLabel = deleteBtn.querySelector('.selection-btn-label');
                    if (isReadOnlyContext) {
                        deleteBtn.title = t('selectionBar.hideSelected');
                        if (delLabel) delLabel.textContent = t('selectionBar.hideSelected');
                    } else {
                        deleteBtn.title = t('selectionBar.deleteSelected');
                        if (delLabel) delLabel.textContent = t('selectionBar.deleteSelected');
                    }
                }

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
            const t = (k, p) => (window.App && window.App.i18n) ? window.App.i18n.t(k, p) : k;
            if (islandSelectBtn && islandSelectText) {
                if (state.isWorkspaceSelectMode) {
                    islandSelectBtn.classList.add('active');
                    islandSelectText.textContent = t('workspace.doneBtn');
                    islandSelectBtn.title = t('workspace.exitSelectTitle');
                } else {
                    islandSelectBtn.classList.remove('active');
                    islandSelectText.textContent = t('workspace.selectBtn');
                    islandSelectBtn.title = t('workspace.selectTitle');
                }
            }
        },

        updateLanguage() {
            if (barElement && window.App && window.App.i18n && window.App.i18n.updateDOM) {
                window.App.i18n.updateDOM(barElement);
                this.buildSubmenus();
                this.updateUI();
            }
        }
    };
})();
