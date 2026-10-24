// js/settingsModal.js - Модальне вікно налаштувань додатку (координатор табів і преференцій)
window.App = window.App || {};

(function() {
    let modalOverlayEl = null;
    let currentTab = 'general';

    function t(key, params) {
        if (window.App && window.App.i18n && window.App.i18n.t) {
            return window.App.i18n.t(key, params);
        }
        return key;
    }

    const settingsModal = {
        isOpen: false,

        init() {
            if (window.App.settingsPreferences) {
                window.App.settingsPreferences.init();
            }
            this.bindGlobalKeys();
        },

        // --- Делеговані методи преференцій (зворотна сумісність) ---
        loadPreferences() {
            return window.App.settingsPreferences ? window.App.settingsPreferences.loadPreferences() : null;
        },

        applyPreferences() {
            return window.App.settingsPreferences ? window.App.settingsPreferences.applyPreferences() : null;
        },

        getTheme() {
            return window.App.settingsPreferences ? window.App.settingsPreferences.getTheme() : 'asphalt';
        },

        setTheme(themeKey, save = true) {
            return window.App.settingsPreferences ? window.App.settingsPreferences.setTheme(themeKey, save) : null;
        },

        isAutoCapitalizeEnabled() {
            return window.App.settingsPreferences ? window.App.settingsPreferences.isAutoCapitalizeEnabled() : true;
        },

        isCompactViewEnabled() {
            return window.App.settingsPreferences ? window.App.settingsPreferences.isCompactViewEnabled() : false;
        },

        setAutoCapitalize(val) {
            return window.App.settingsPreferences ? window.App.settingsPreferences.setAutoCapitalize(val) : null;
        },

        setCompactView(val) {
            return window.App.settingsPreferences ? window.App.settingsPreferences.setCompactView(val) : null;
        },

        // --- Модальний DOM та рендеринг ---
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

            const currentTheme = this.getTheme();
            const generalTabHTML = window.App.settingsAppearanceTab
                ? window.App.settingsAppearanceTab.renderHTML(currentTheme, currentTab === 'general')
                : '';
            const accountTabHTML = window.App.settingsAccountTab
                ? window.App.settingsAccountTab.renderHTML(currentTab === 'account')
                : '';
            const shortcutsTabHTML = window.App.settingsShortcutsTab
                ? window.App.settingsShortcutsTab.renderHTML(currentTab === 'shortcuts')
                : '';

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

                    ${generalTabHTML}
                    ${accountTabHTML}
                    ${shortcutsTabHTML}
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
            const tabButtons = modalOverlayEl.querySelectorAll('.settings-tab-btn');

            if (closeBtn) closeBtn.addEventListener('click', () => this.close());
            if (backdrop) backdrop.addEventListener('click', () => this.close());

            if (window.App.settingsAppearanceTab) {
                window.App.settingsAppearanceTab.bindEvents(modalOverlayEl, () => this.render());
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

        renderAccountInfo() {
            if (window.App.settingsAccountTab) {
                window.App.settingsAccountTab.renderAccountInfo(modalOverlayEl, () => this.close());
            }
        },

        open(tab = 'general') {
            this.isOpen = true;
            this.createModalDOM();
            this.switchTab(tab);

            const prefs = window.App.settingsPreferences;
            if (prefs) {
                const autoCapToggle = modalOverlayEl.querySelector('#settings-autocap-toggle');
                const compactToggle = modalOverlayEl.querySelector('#settings-compact-toggle');
                if (autoCapToggle) autoCapToggle.checked = prefs.isAutoCapitalizeEnabled();
                if (compactToggle) compactToggle.checked = prefs.isCompactViewEnabled();
                prefs.setTheme(prefs.getTheme(), false);
            }

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

    window.App.settingsModal = settingsModal;
    // Alias для швидкого доступу
    window.App.settings = window.App.settingsModal;
})();
