// js/settingsModal.js - Модальне вікно налаштувань додатку
window.App = window.App || {};

(function() {
    const STORAGE_KEY_AUTO_CAP = 'nothing_notes_auto_capitalize';
    const STORAGE_KEY_COMPACT = 'nothing_notes_compact_view';
    const STORAGE_KEY_THEME = 'nothing_notes_theme';

    const THEMES = [
        { key: 'asphalt', nameKey: 'settings.theme.asphalt.name', descKey: 'settings.theme.asphalt.desc', metaColor: '#141416' },
        { key: 'light', nameKey: 'settings.theme.light.name', descKey: 'settings.theme.light.desc', metaColor: '#f7f7fa' },
        { key: 'night-sky', nameKey: 'settings.theme.nightSky.name', descKey: 'settings.theme.nightSky.desc', metaColor: '#0b0f19' },
        { key: 'forest', nameKey: 'settings.theme.forest.name', descKey: 'settings.theme.forest.desc', metaColor: '#1d1e19' }
    ];

    let modalOverlayEl = null;
    let autoCapitalize = true;
    let compactView = false;
    let currentTheme = 'asphalt';
    let currentTab = 'general';

    function t(key, params) {
        if (window.App && window.App.i18n && window.App.i18n.t) {
            return window.App.i18n.t(key, params);
        }
        return key;
    }

    function getLang() {
        if (window.App && window.App.i18n && window.App.i18n.getLanguage) {
            return window.App.i18n.getLanguage();
        }
        return 'ua';
    }

    window.App.settingsModal = {
        isOpen: false,

        init() {
            this.loadPreferences();
            this.bindGlobalKeys();
            this.applyPreferences();
        },

        loadPreferences() {
            try {
                const savedCap = localStorage.getItem(STORAGE_KEY_AUTO_CAP);
                if (savedCap !== null) {
                    autoCapitalize = savedCap === 'true';
                } else {
                    autoCapitalize = true;
                }

                const savedCompact = localStorage.getItem(STORAGE_KEY_COMPACT);
                if (savedCompact !== null) {
                    compactView = savedCompact === 'true';
                } else {
                    compactView = false;
                }

                const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
                if (savedTheme && THEMES.some(t => t.key === savedTheme)) {
                    currentTheme = savedTheme;
                } else {
                    currentTheme = 'asphalt';
                }
            } catch (err) {
                console.warn('[Settings] Помилка зчитування preferences:', err);
            }
        },

        applyPreferences() {
            if (compactView) {
                document.body.classList.add('compact-notes-mode');
            } else {
                document.body.classList.remove('compact-notes-mode');
            }
            this.setTheme(currentTheme, false);
        },

        getTheme() {
            return currentTheme;
        },

        setTheme(themeKey, save = true) {
            if (!THEMES.some(t => t.key === themeKey)) {
                themeKey = 'asphalt';
            }
            currentTheme = themeKey;

            document.documentElement.setAttribute('data-theme', themeKey);

            const themeObj = THEMES.find(t => t.key === themeKey);
            if (themeObj) {
                let metaTheme = document.querySelector('meta[name="theme-color"]');
                if (!metaTheme) {
                    metaTheme = document.createElement('meta');
                    metaTheme.name = 'theme-color';
                    document.head.appendChild(metaTheme);
                }
                metaTheme.setAttribute('content', themeObj.metaColor);
            }

            if (save) {
                try {
                    localStorage.setItem(STORAGE_KEY_THEME, themeKey);
                } catch (e) {
                    console.warn(e);
                }
            }

            if (modalOverlayEl) {
                const cards = modalOverlayEl.querySelectorAll('#settings-theme-grid .settings-theme-card');
                cards.forEach(card => {
                    if (card.getAttribute('data-theme') === themeKey) {
                        card.classList.add('active');
                    } else {
                        card.classList.remove('active');
                    }
                });
            }

            if (window.App.state && window.App.state.isGraphView && window.App.graphView) {
                window.App.graphView.render();
            }
        },

        isAutoCapitalizeEnabled() {
            return autoCapitalize;
        },

        isCompactViewEnabled() {
            return compactView;
        },

        setAutoCapitalize(val) {
            autoCapitalize = Boolean(val);
            try {
                localStorage.setItem(STORAGE_KEY_AUTO_CAP, String(autoCapitalize));
            } catch (e) {
                console.warn(e);
            }
        },

        setCompactView(val) {
            compactView = Boolean(val);
            try {
                localStorage.setItem(STORAGE_KEY_COMPACT, String(compactView));
            } catch (e) {
                console.warn(e);
            }
            this.applyPreferences();
        },

        createModalDOM() {
            if (modalOverlayEl) return;

            modalOverlayEl = document.createElement('div');
            modalOverlayEl.id = 'settings-modal';
            modalOverlayEl.className = 'settings-modal-overlay';
            modalOverlayEl.style.display = 'none';

            document.body.appendChild(modalOverlayEl);
            this.render();
        },

        render() {
            if (!modalOverlayEl) return;

            const currentLang = getLang();

            modalOverlayEl.innerHTML = `
                <div class="settings-modal-backdrop" id="settings-backdrop"></div>
                <div class="settings-modal-card">
                    <button class="settings-modal-close" id="settings-close-btn" title="${t('settings.closeTitle')}">✕</button>
                    
                    <div class="settings-modal-header">
                        <div class="settings-header-icon-badge">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </div>
                        <div class="settings-header-titles">
                            <h2 class="settings-modal-title" data-i18n="settings.title">${t('settings.title')}</h2>
                            <p class="settings-modal-subtitle" data-i18n="settings.subtitle">${t('settings.subtitle')}</p>
                        </div>
                    </div>

                    <!-- Таби навігації -->
                    <div class="settings-tabs" id="settings-tabs">
                        <button type="button" class="settings-tab-btn ${currentTab === 'general' ? 'active' : ''}" data-tab="general">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                            <span data-i18n="settings.tabs.general">${t('settings.tabs.general')}</span>
                        </button>
                        <button type="button" class="settings-tab-btn ${currentTab === 'account' ? 'active' : ''}" data-tab="account">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            <span data-i18n="settings.tabs.account">${t('settings.tabs.account')}</span>
                        </button>
                        <button type="button" class="settings-tab-btn ${currentTab === 'shortcuts' ? 'active' : ''}" data-tab="shortcuts">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                                <path d="M6 8h.001"></path>
                                <path d="M10 8h.001"></path>
                                <path d="M14 8h.001"></path>
                                <path d="M18 8h.001"></path>
                                <path d="M8 12h.001"></path>
                                <path d="M12 12h.001"></path>
                                <path d="M16 12h.001"></path>
                                <path d="M7 16h10"></path>
                            </svg>
                            <span data-i18n="settings.tabs.shortcuts">${t('settings.tabs.shortcuts')}</span>
                        </button>
                    </div>

                    <!-- Вміст: Загальні -->
                    <div class="settings-tab-content" id="settings-tab-general" style="display: ${currentTab === 'general' ? 'flex' : 'none'};">
                        <!-- Блок 0: Вибір мови додатку (випадаючий список з прапорами) -->
                        <div class="settings-item settings-lang-item">
                            <div class="settings-item-info">
                                <div class="settings-item-title" data-i18n="settings.language.title">${t('settings.language.title')}</div>
                                <div class="settings-item-desc" data-i18n="settings.language.desc">${t('settings.language.desc')}</div>
                            </div>
                            <div class="settings-lang-dropdown-wrap" id="settings-lang-dropdown-wrap">
                                <button type="button" class="settings-lang-dropdown-btn" id="settings-lang-btn" aria-haspopup="listbox" aria-expanded="false">
                                    <span class="settings-lang-btn-left">
                                        ${(window.App && window.App.i18n && window.App.i18n.getFlagSvg) ? window.App.i18n.getFlagSvg(currentLang) : ''}
                                        <span class="settings-lang-btn-label">${currentLang === 'ua' ? t('settings.language.ua') : t('settings.language.en')}</span>
                                    </span>
                                    <svg class="settings-lang-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </button>
                                <div class="settings-lang-dropdown-menu" id="settings-lang-menu" role="listbox">
                                    <button type="button" class="settings-lang-option ${currentLang === 'ua' ? 'selected' : ''}" data-lang="ua" role="option">
                                        ${(window.App && window.App.i18n && window.App.i18n.getFlagSvg) ? window.App.i18n.getFlagSvg('ua') : ''}
                                        <span class="settings-lang-option-name" data-i18n="settings.language.ua">${t('settings.language.ua')}</span>
                                        ${currentLang === 'ua' ? '<span class="settings-lang-option-check">✓</span>' : ''}
                                    </button>
                                    <button type="button" class="settings-lang-option ${currentLang === 'en' ? 'selected' : ''}" data-lang="en" role="option">
                                        ${(window.App && window.App.i18n && window.App.i18n.getFlagSvg) ? window.App.i18n.getFlagSvg('en') : ''}
                                        <span class="settings-lang-option-name" data-i18n="settings.language.en">${t('settings.language.en')}</span>
                                        ${currentLang === 'en' ? '<span class="settings-lang-option-check">✓</span>' : ''}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Блок 1: Вибір теми оформлення сайту -->
                        <div class="settings-section-title" style="margin-top: 10px;" data-i18n="settings.theme.title">${t('settings.theme.title')}</div>
                        <div class="settings-theme-grid" id="settings-theme-grid">
                            <button type="button" class="settings-theme-card ${currentTheme === 'asphalt' ? 'active' : ''}" data-theme="asphalt">
                                <div class="settings-theme-preview asphalt-preview">
                                    <div class="theme-preview-dot"></div>
                                </div>
                                <div class="settings-theme-label">
                                    <span class="settings-theme-name" data-i18n="settings.theme.asphalt.name">${t('settings.theme.asphalt.name')}</span>
                                    <span class="settings-theme-sub" data-i18n="settings.theme.asphalt.desc">${t('settings.theme.asphalt.desc')}</span>
                                </div>
                                <div class="settings-theme-check">✓</div>
                            </button>

                            <button type="button" class="settings-theme-card ${currentTheme === 'light' ? 'active' : ''}" data-theme="light">
                                <div class="settings-theme-preview light-preview">
                                    <div class="theme-preview-dot"></div>
                                </div>
                                <div class="settings-theme-label">
                                    <span class="settings-theme-name" data-i18n="settings.theme.light.name">${t('settings.theme.light.name')}</span>
                                    <span class="settings-theme-sub" data-i18n="settings.theme.light.desc">${t('settings.theme.light.desc')}</span>
                                </div>
                                <div class="settings-theme-check">✓</div>
                            </button>

                            <button type="button" class="settings-theme-card ${currentTheme === 'night-sky' ? 'active' : ''}" data-theme="night-sky">
                                <div class="settings-theme-preview night-sky-preview">
                                    <div class="theme-preview-dot"></div>
                                </div>
                                <div class="settings-theme-label">
                                    <span class="settings-theme-name" data-i18n="settings.theme.nightSky.name">${t('settings.theme.nightSky.name')}</span>
                                    <span class="settings-theme-sub" data-i18n="settings.theme.nightSky.desc">${t('settings.theme.nightSky.desc')}</span>
                                </div>
                                <div class="settings-theme-check">✓</div>
                            </button>

                            <button type="button" class="settings-theme-card ${currentTheme === 'forest' ? 'active' : ''}" data-theme="forest">
                                <div class="settings-theme-preview forest-preview">
                                    <div class="theme-preview-dot"></div>
                                </div>
                                <div class="settings-theme-label">
                                    <span class="settings-theme-name" data-i18n="settings.theme.forest.name">${t('settings.theme.forest.name')}</span>
                                    <span class="settings-theme-sub" data-i18n="settings.theme.forest.desc">${t('settings.theme.forest.desc')}</span>
                                </div>
                                <div class="settings-theme-check">✓</div>
                            </button>
                        </div>

                        <!-- Блок 2: Параметри редактора та нотаток -->
                        <div class="settings-section-title" style="margin-top: 14px;" data-i18n="settings.editor.title">${t('settings.editor.title')}</div>
                        <div class="settings-item">
                            <div class="settings-item-info">
                                <div class="settings-item-title" data-i18n="settings.editor.autocapTitle">${t('settings.editor.autocapTitle')}</div>
                                <div class="settings-item-desc" data-i18n="settings.editor.autocapDesc">${t('settings.editor.autocapDesc')}</div>
                            </div>
                            <label class="settings-toggle-switch">
                                <input type="checkbox" id="settings-autocap-toggle">
                                <span class="settings-toggle-slider"></span>
                            </label>
                        </div>

                        <div class="settings-item">
                            <div class="settings-item-info">
                                <div class="settings-item-title" data-i18n="settings.editor.compactTitle">${t('settings.editor.compactTitle')}</div>
                                <div class="settings-item-desc" data-i18n="settings.editor.compactDesc">${t('settings.editor.compactDesc')}</div>
                            </div>
                            <label class="settings-toggle-switch">
                                <input type="checkbox" id="settings-compact-toggle">
                                <span class="settings-toggle-slider"></span>
                            </label>
                        </div>

                        <div class="settings-item">
                            <div class="settings-item-info">
                                <div class="settings-item-title" data-i18n="settings.editor.toolsTitle">${t('settings.editor.toolsTitle')}</div>
                                <div class="settings-item-desc" data-i18n="settings.editor.toolsDesc">${t('settings.editor.toolsDesc')}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Вміст: Акаунт і хмара -->
                    <div class="settings-tab-content" id="settings-tab-account" style="display: ${currentTab === 'account' ? 'flex' : 'none'};">
                        <div class="settings-account-card" id="settings-account-container">
                            <!-- Заповнюється динамічно -->
                        </div>

                        <div class="settings-stats-row">
                            <div class="settings-stat-box">
                                <div class="settings-stat-num" id="settings-stat-boards">0</div>
                                <div class="settings-stat-label" data-i18n="settings.account.boardsStat">${t('settings.account.boardsStat')}</div>
                            </div>
                            <div class="settings-stat-box">
                                <div class="settings-stat-num" id="settings-stat-notes">0</div>
                                <div class="settings-stat-label" data-i18n="settings.account.notesStat">${t('settings.account.notesStat')}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Вміст: Гарячі клавіші -->
                    <div class="settings-tab-content settings-shortcuts-list" id="settings-tab-shortcuts" style="display: ${currentTab === 'shortcuts' ? 'flex' : 'none'};">
                        <div class="settings-shortcut-row">
                            <span class="settings-shortcut-label" data-i18n="settings.shortcuts.undo">${t('settings.shortcuts.undo')}</span>
                            <div class="settings-shortcut-keys">
                                <kbd class="settings-kbd">Ctrl</kbd>
                                <span>+</span>
                                <kbd class="settings-kbd">Z</kbd>
                            </div>
                        </div>
                        <div class="settings-shortcut-row">
                            <span class="settings-shortcut-label" data-i18n="settings.shortcuts.redo">${t('settings.shortcuts.redo')}</span>
                            <div class="settings-shortcut-keys">
                                <kbd class="settings-kbd">Ctrl</kbd>
                                <span>+</span>
                                <kbd class="settings-kbd">Y</kbd>
                            </div>
                        </div>
                        <div class="settings-shortcut-row">
                            <span class="settings-shortcut-label" data-i18n="settings.shortcuts.search">${t('settings.shortcuts.search')}</span>
                            <div class="settings-shortcut-keys">
                                <kbd class="settings-kbd">Ctrl</kbd>
                                <span>+</span>
                                <kbd class="settings-kbd">F</kbd>
                            </div>
                        </div>
                        <div class="settings-shortcut-row">
                            <span class="settings-shortcut-label" data-i18n="settings.shortcuts.bold">${t('settings.shortcuts.bold')}</span>
                            <div class="settings-shortcut-keys">
                                <kbd class="settings-kbd">Ctrl</kbd>
                                <span>+</span>
                                <kbd class="settings-kbd">B</kbd>
                            </div>
                        </div>
                        <div class="settings-shortcut-row">
                            <span class="settings-shortcut-label" data-i18n="settings.shortcuts.close">${t('settings.shortcuts.close')}</span>
                            <div class="settings-shortcut-keys">
                                <kbd class="settings-kbd">Esc</kbd>
                            </div>
                        </div>
                        <div class="settings-shortcut-row">
                            <span class="settings-shortcut-label" data-i18n="settings.shortcuts.searchNav">${t('settings.shortcuts.searchNav')}</span>
                            <div class="settings-shortcut-keys">
                                <kbd class="settings-kbd">Enter</kbd>
                                <span>/</span>
                                <kbd class="settings-kbd">Shift + Enter</kbd>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            this.bindEvents();
            if (currentTab === 'account') {
                this.renderAccountInfo();
            }
        },

        bindEvents() {
            if (!modalOverlayEl) return;

            const closeBtn = modalOverlayEl.querySelector('#settings-close-btn');
            const backdrop = modalOverlayEl.querySelector('#settings-backdrop');
            const autoCapToggle = modalOverlayEl.querySelector('#settings-autocap-toggle');
            const compactToggle = modalOverlayEl.querySelector('#settings-compact-toggle');
            const tabButtons = modalOverlayEl.querySelectorAll('.settings-tab-btn');
            const themeCards = modalOverlayEl.querySelectorAll('#settings-theme-grid .settings-theme-card');
            const langDropdownWrap = modalOverlayEl.querySelector('#settings-lang-dropdown-wrap');
            const langBtn = modalOverlayEl.querySelector('#settings-lang-btn');
            const langOptions = modalOverlayEl.querySelectorAll('.settings-lang-option');

            if (closeBtn) closeBtn.addEventListener('click', () => this.close());
            if (backdrop) backdrop.addEventListener('click', () => this.close());

            // Вибір мови через випадаючий список
            if (langBtn && langDropdownWrap) {
                langBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isOpen = langDropdownWrap.classList.toggle('open');
                    langBtn.setAttribute('aria-expanded', String(isOpen));
                });

                langOptions.forEach(opt => {
                    opt.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const lang = opt.getAttribute('data-lang');
                        langDropdownWrap.classList.remove('open');
                        langBtn.setAttribute('aria-expanded', 'false');
                        if (lang && window.App.i18n) {
                            window.App.i18n.setLanguage(lang);
                            this.render();
                        }
                    });
                });

                document.addEventListener('click', (e) => {
                    if (langDropdownWrap && !langDropdownWrap.contains(e.target)) {
                        langDropdownWrap.classList.remove('open');
                        langBtn.setAttribute('aria-expanded', 'false');
                    }
                });
            }

            // Вибір теми
            themeCards.forEach(card => {
                card.addEventListener('click', () => {
                    const themeKey = card.getAttribute('data-theme');
                    if (themeKey) {
                        this.setTheme(themeKey, true);
                    }
                });
            });

            if (autoCapToggle) {
                autoCapToggle.checked = autoCapitalize;
                autoCapToggle.addEventListener('change', (e) => {
                    this.setAutoCapitalize(e.target.checked);
                });
            }

            if (compactToggle) {
                compactToggle.checked = compactView;
                compactToggle.addEventListener('change', (e) => {
                    this.setCompactView(e.target.checked);
                });
            }

            tabButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const tabKey = btn.getAttribute('data-tab');
                    this.switchTab(tabKey);
                });
            });
        },

        bindGlobalKeys() {
            window.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modalOverlayEl && modalOverlayEl.classList.contains('active')) {
                    this.close();
                }
            });

            // Делегований клік для відкриття налаштувань з бічної панелі
            document.addEventListener('click', (e) => {
                const settingsBtn = e.target.closest('#sidebar-settings-btn');
                if (settingsBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.open();
                }
            });
        },

        switchTab(tabKey) {
            currentTab = tabKey;
            if (!modalOverlayEl) return;

            const tabButtons = modalOverlayEl.querySelectorAll('.settings-tab-btn');
            tabButtons.forEach(btn => {
                if (btn.getAttribute('data-tab') === tabKey) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            const generalEl = modalOverlayEl.querySelector('#settings-tab-general');
            const accountEl = modalOverlayEl.querySelector('#settings-tab-account');
            const shortcutsEl = modalOverlayEl.querySelector('#settings-tab-shortcuts');

            if (generalEl) generalEl.style.display = tabKey === 'general' ? 'flex' : 'none';
            if (accountEl) accountEl.style.display = tabKey === 'account' ? 'flex' : 'none';
            if (shortcutsEl) shortcutsEl.style.display = tabKey === 'shortcuts' ? 'flex' : 'none';

            if (tabKey === 'account') {
                this.renderAccountInfo();
            }
        },

        async renderAccountInfo() {
            if (!modalOverlayEl) return;
            const container = modalOverlayEl.querySelector('#settings-account-container');
            const boardsCountEl = modalOverlayEl.querySelector('#settings-stat-boards');
            const notesCountEl = modalOverlayEl.querySelector('#settings-stat-notes');

            const state = window.App.state;
            if (boardsCountEl) boardsCountEl.textContent = (state && state.boards ? state.boards.length : 0);
            if (notesCountEl) notesCountEl.textContent = (state && state.notes ? state.notes.length : 0);

            if (!container) return;

            let user = null;
            if (window.App.supabase && window.App.supabase.auth) {
                try {
                    const { data } = await window.App.supabase.auth.getUser();
                    user = data?.user || null;
                } catch (e) {
                    user = null;
                }
            }

            if (user) {
                const nickname = (user.user_metadata && (user.user_metadata.username || user.user_metadata.nickname || user.user_metadata.display_name)) || user.email.split('@')[0];
                const initial = nickname.charAt(0).toUpperCase();

                container.innerHTML = `
                    <div class="settings-account-header">
                        <div class="settings-account-avatar">${initial}</div>
                        <div class="settings-account-details">
                            <div class="settings-account-name">${nickname}</div>
                            <div class="settings-account-email" title="${user.email}">${user.email}</div>
                        </div>
                    </div>
                    <div class="settings-account-badge online">
                        <span class="settings-badge-dot"></span>
                        <span data-i18n="settings.account.loggedInTitle">${t('settings.account.loggedInTitle')}</span>
                    </div>
                    <div class="settings-account-actions">
                        <button class="settings-btn-danger" id="settings-logout-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                            <span data-i18n="settings.account.logoutBtn">${t('settings.account.logoutBtn')}</span>
                        </button>
                    </div>
                `;

                const logoutBtn = container.querySelector('#settings-logout-btn');
                if (logoutBtn) {
                    logoutBtn.addEventListener('click', async () => {
                        this.close();
                        if (window.App.supabase && window.App.supabase.auth) {
                            await window.App.supabase.auth.signOut();
                        }
                    });
                }
            } else {
                container.innerHTML = `
                    <div class="settings-account-header">
                        <div class="settings-account-avatar" style="background: rgba(255,255,255,0.08); color: var(--text-muted);">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                        </div>
                        <div class="settings-account-details">
                            <div class="settings-account-name" data-i18n="settings.account.guestTitle">${t('settings.account.guestTitle')}</div>
                            <div class="settings-account-email" data-i18n="settings.account.guestDesc">${t('settings.account.guestDesc')}</div>
                        </div>
                    </div>
                    <div class="settings-account-badge offline">
                        <span class="settings-badge-dot"></span>
                        <span data-i18n="welcome.guestBtn">${t('welcome.guestBtn')}</span>
                    </div>
                    <div class="settings-account-actions">
                        <button class="settings-btn-primary" id="settings-login-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                                <polyline points="10 17 15 12 10 7"></polyline>
                                <line x1="15" y1="12" x2="3" y2="12"></line>
                            </svg>
                            <span data-i18n="welcome.loginBtn">${t('welcome.loginBtn')}</span>
                        </button>
                    </div>
                `;

                const loginBtn = container.querySelector('#settings-login-btn');
                if (loginBtn) {
                    loginBtn.addEventListener('click', () => {
                        this.close();
                        if (window.App.authModal) {
                            window.App.authModal.open();
                        }
                    });
                }
            }
        },

        open(tab = 'general') {
            this.isOpen = true;
            this.createModalDOM();
            this.switchTab(tab);

            const autoCapToggle = modalOverlayEl.querySelector('#settings-autocap-toggle');
            const compactToggle = modalOverlayEl.querySelector('#settings-compact-toggle');
            if (autoCapToggle) autoCapToggle.checked = autoCapitalize;
            if (compactToggle) compactToggle.checked = compactView;

            this.setTheme(currentTheme, false);

            modalOverlayEl.style.display = 'flex';
            requestAnimationFrame(() => {
                modalOverlayEl.classList.add('active');
            });
        },

        close() {
            this.isOpen = false;
            if (!modalOverlayEl) return;
            modalOverlayEl.classList.remove('active');
            setTimeout(() => {
                if (!modalOverlayEl.classList.contains('active')) {
                    modalOverlayEl.style.display = 'none';
                }
            }, 200);
        }
    };

    // Alias для швидкого доступу
    window.App.settings = window.App.settingsModal;
})();
