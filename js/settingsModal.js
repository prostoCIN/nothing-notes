// js/settingsModal.js - Модальне вікно налаштувань додатку
window.App = window.App || {};

(function() {
    const STORAGE_KEY_AUTO_CAP = 'nothing_notes_auto_capitalize';
    const STORAGE_KEY_COMPACT = 'nothing_notes_compact_view';
    const STORAGE_KEY_THEME = 'nothing_notes_theme';

    const THEMES = [
        { key: 'asphalt', name: 'Асфальт', desc: 'Темна (поточна)', metaColor: '#141416' },
        { key: 'light', name: 'Біла', desc: 'Світла', metaColor: '#f7f7fa' },
        { key: 'night-sky', name: 'Нічне небо', desc: 'Темно-синя', metaColor: '#0b0f19' },
        { key: 'forest', name: 'Темний ліс', desc: 'Темно-зелена', metaColor: '#07130e' }
    ];

    let modalOverlayEl = null;
    let autoCapitalize = true;
    let compactView = false;
    let currentTheme = 'asphalt';
    let currentTab = 'general';

    window.App.settingsModal = {
        init() {
            this.loadPreferences();
            this.createModalDOM();
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

            // Застосовуємо тему до html елемента
            document.documentElement.setAttribute('data-theme', themeKey);

            // Оновлюємо theme-color для браузерів на мобільних пристроях
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

            // Оновлюємо вигляд карток у модальному вікні
            if (modalOverlayEl) {
                const cards = modalOverlayEl.querySelectorAll('.settings-theme-card');
                cards.forEach(card => {
                    if (card.getAttribute('data-theme') === themeKey) {
                        card.classList.add('active');
                    } else {
                        card.classList.remove('active');
                    }
                });
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

            modalOverlayEl.innerHTML = `
                <div class="settings-modal-backdrop" id="settings-backdrop"></div>
                <div class="settings-modal-card">
                    <button class="settings-modal-close" id="settings-close-btn" title="Закрити (Esc)">✕</button>
                    
                    <div class="settings-modal-header">
                        <div class="settings-header-icon-badge">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </div>
                        <div class="settings-header-titles">
                            <h2 class="settings-modal-title">Налаштування</h2>
                            <p class="settings-modal-subtitle">Параметри теми, інтерфейсу та облікового запису</p>
                        </div>
                    </div>

                    <!-- Таби навігації -->
                    <div class="settings-tabs" id="settings-tabs">
                        <button type="button" class="settings-tab-btn active" data-tab="general">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                            <span>Загальні</span>
                        </button>
                        <button type="button" class="settings-tab-btn" data-tab="account">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            <span>Акаунт і хмара</span>
                        </button>
                        <button type="button" class="settings-tab-btn" data-tab="shortcuts">
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
                            <span>Гарячі клавіші</span>
                        </button>
                    </div>

                    <!-- Вміст: Загальні -->
                    <div class="settings-tab-content" id="settings-tab-general">
                        <!-- Блок 1: Вибір теми оформлення сайту -->
                        <div class="settings-section-title">Тема оформлення</div>
                        <div class="settings-theme-grid" id="settings-theme-grid">
                            <button type="button" class="settings-theme-card ${currentTheme === 'asphalt' ? 'active' : ''}" data-theme="asphalt">
                                <div class="settings-theme-preview asphalt-preview">
                                    <div class="theme-preview-dot"></div>
                                </div>
                                <div class="settings-theme-label">
                                    <span class="settings-theme-name">Асфальт</span>
                                    <span class="settings-theme-sub">Темна (поточна)</span>
                                </div>
                                <div class="settings-theme-check">✓</div>
                            </button>

                            <button type="button" class="settings-theme-card ${currentTheme === 'light' ? 'active' : ''}" data-theme="light">
                                <div class="settings-theme-preview light-preview">
                                    <div class="theme-preview-dot"></div>
                                </div>
                                <div class="settings-theme-label">
                                    <span class="settings-theme-name">Біла</span>
                                    <span class="settings-theme-sub">Світла</span>
                                </div>
                                <div class="settings-theme-check">✓</div>
                            </button>

                            <button type="button" class="settings-theme-card ${currentTheme === 'night-sky' ? 'active' : ''}" data-theme="night-sky">
                                <div class="settings-theme-preview night-sky-preview">
                                    <div class="theme-preview-dot"></div>
                                </div>
                                <div class="settings-theme-label">
                                    <span class="settings-theme-name">Нічне небо</span>
                                    <span class="settings-theme-sub">Темно-синя</span>
                                </div>
                                <div class="settings-theme-check">✓</div>
                            </button>

                            <button type="button" class="settings-theme-card ${currentTheme === 'forest' ? 'active' : ''}" data-theme="forest">
                                <div class="settings-theme-preview forest-preview">
                                    <div class="theme-preview-dot"></div>
                                </div>
                                <div class="settings-theme-label">
                                    <span class="settings-theme-name">Темний ліс</span>
                                    <span class="settings-theme-sub">Темно-зелена</span>
                                </div>
                                <div class="settings-theme-check">✓</div>
                            </button>
                        </div>

                        <!-- Блок 2: Параметри редактора та нотаток -->
                        <div class="settings-section-title" style="margin-top: 14px;">Редактор та нотатки</div>
                        <div class="settings-item">
                            <div class="settings-item-info">
                                <div class="settings-item-title">Велика літера після крапки</div>
                                <div class="settings-item-desc">Автоматично робити першу літеру великою на початку рядка та після крапки (. ! ?)</div>
                            </div>
                            <label class="settings-toggle-switch">
                                <input type="checkbox" id="settings-autocap-toggle">
                                <span class="settings-toggle-slider"></span>
                            </label>
                        </div>

                        <div class="settings-item">
                            <div class="settings-item-info">
                                <div class="settings-item-title">Компактний режим нотаток</div>
                                <div class="settings-item-desc">Зменшити внутрішні відступи стікерів для більш щільного розташування карток</div>
                            </div>
                            <label class="settings-toggle-switch">
                                <input type="checkbox" id="settings-compact-toggle">
                                <span class="settings-toggle-slider"></span>
                            </label>
                        </div>

                        <div class="settings-item">
                            <div class="settings-item-info">
                                <div class="settings-item-title">Швидкий маркер та гумка</div>
                                <div class="settings-item-desc">Використовуйте інструменти маркера у верхньому меню для виділення важливого кольорами</div>
                            </div>
                        </div>
                    </div>

                    <!-- Вміст: Акаунт і хмара -->
                    <div class="settings-tab-content" id="settings-tab-account" style="display: none;">
                        <div class="settings-account-card" id="settings-account-container">
                            <!-- Заповнюється динамічно -->
                        </div>

                        <div class="settings-stats-row">
                            <div class="settings-stat-box">
                                <div class="settings-stat-num" id="settings-stat-boards">0</div>
                                <div class="settings-stat-label">Блокнотів</div>
                            </div>
                            <div class="settings-stat-box">
                                <div class="settings-stat-num" id="settings-stat-notes">0</div>
                                <div class="settings-stat-label">Нотаток на дошці</div>
                            </div>
                        </div>
                    </div>

                    <!-- Вміст: Гарячі клавіші -->
                    <div class="settings-tab-content settings-shortcuts-list" id="settings-tab-shortcuts" style="display: none;">
                        <div class="settings-shortcut-row">
                            <span class="settings-shortcut-label">Скасувати дію</span>
                            <div class="settings-shortcut-keys">
                                <kbd class="settings-kbd">Ctrl</kbd>
                                <span>+</span>
                                <kbd class="settings-kbd">Z</kbd>
                            </div>
                        </div>
                        <div class="settings-shortcut-row">
                            <span class="settings-shortcut-label">Повторити дію</span>
                            <div class="settings-shortcut-keys">
                                <kbd class="settings-kbd">Ctrl</kbd>
                                <span>+</span>
                                <kbd class="settings-kbd">Y</kbd>
                            </div>
                        </div>
                        <div class="settings-shortcut-row">
                            <span class="settings-shortcut-label">Пошук слів на дошці</span>
                            <div class="settings-shortcut-keys">
                                <kbd class="settings-kbd">Ctrl</kbd>
                                <span>+</span>
                                <kbd class="settings-kbd">F</kbd>
                            </div>
                        </div>
                        <div class="settings-shortcut-row">
                            <span class="settings-shortcut-label">Жирний текст</span>
                            <div class="settings-shortcut-keys">
                                <kbd class="settings-kbd">Ctrl</kbd>
                                <span>+</span>
                                <kbd class="settings-kbd">B</kbd>
                            </div>
                        </div>
                        <div class="settings-shortcut-row">
                            <span class="settings-shortcut-label">Закрити вікно / вийти з маркера</span>
                            <div class="settings-shortcut-keys">
                                <kbd class="settings-kbd">Esc</kbd>
                            </div>
                        </div>
                        <div class="settings-shortcut-row">
                            <span class="settings-shortcut-label">Навігація по збігах пошуку</span>
                            <div class="settings-shortcut-keys">
                                <kbd class="settings-kbd">Enter</kbd>
                                <span>/</span>
                                <kbd class="settings-kbd">Shift + Enter</kbd>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modalOverlayEl);
            this.bindEvents();
        },

        bindEvents() {
            if (!modalOverlayEl) return;

            const closeBtn = modalOverlayEl.querySelector('#settings-close-btn');
            const backdrop = modalOverlayEl.querySelector('#settings-backdrop');
            const autoCapToggle = modalOverlayEl.querySelector('#settings-autocap-toggle');
            const compactToggle = modalOverlayEl.querySelector('#settings-compact-toggle');
            const tabButtons = modalOverlayEl.querySelectorAll('.settings-tab-btn');
            const themeCards = modalOverlayEl.querySelectorAll('.settings-theme-card');

            if (closeBtn) closeBtn.addEventListener('click', () => this.close());
            if (backdrop) backdrop.addEventListener('click', () => this.close());

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

            // Оновлюємо лічильники
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
                        <span>Синхронізація активна (Supabase)</span>
                    </div>
                    <div class="settings-account-actions">
                        <button class="settings-btn-danger" id="settings-logout-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                            <span>Вийти з акаунта</span>
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
                            <div class="settings-account-name">Гостьовий режим</div>
                            <div class="settings-account-email">Дані зберігаються локально в браузері</div>
                        </div>
                    </div>
                    <div class="settings-account-badge offline">
                        <span class="settings-badge-dot"></span>
                        <span>Без збереження в хмарі</span>
                    </div>
                    <div class="settings-account-actions">
                        <button class="settings-btn-primary" id="settings-login-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                                <polyline points="10 17 15 12 10 7"></polyline>
                                <line x1="15" y1="12" x2="3" y2="12"></line>
                            </svg>
                            <span>Увійти або зареєструватися</span>
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
            this.createModalDOM();
            this.switchTab(tab);

            // Оновлюємо стан чекбоксів та тем
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
