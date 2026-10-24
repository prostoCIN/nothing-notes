// js/settings/settingsAppearanceTab.js - Вкладка загальних налаштувань, теми та мови
window.App = window.App || {};

(function() {
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

    const settingsAppearanceTab = {
        renderHTML(currentTheme, isVisible) {
            const currentLang = getLang();

            return `
                <div class="settings-tab-content" id="settings-tab-general" style="display: ${isVisible ? 'flex' : 'none'};">
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

                        <button type="button" class="settings-theme-card ${currentTheme === 'ivory' ? 'active' : ''}" data-theme="ivory">
                            <div class="settings-theme-preview ivory-preview">
                                <div class="theme-preview-dot"></div>
                            </div>
                            <div class="settings-theme-label">
                                <span class="settings-theme-name" data-i18n="settings.theme.ivory.name">${t('settings.theme.ivory.name')}</span>
                                <span class="settings-theme-sub" data-i18n="settings.theme.ivory.desc">${t('settings.theme.ivory.desc')}</span>
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
            `;
        },

        bindEvents(modalOverlayEl, onLangSelect) {
            if (!modalOverlayEl) return;

            const prefs = window.App.settingsPreferences;
            const autoCapToggle = modalOverlayEl.querySelector('#settings-autocap-toggle');
            const compactToggle = modalOverlayEl.querySelector('#settings-compact-toggle');
            const themeCards = modalOverlayEl.querySelectorAll('#settings-theme-grid .settings-theme-card');
            const langDropdownWrap = modalOverlayEl.querySelector('#settings-lang-dropdown-wrap');
            const langBtn = modalOverlayEl.querySelector('#settings-lang-btn');
            const langOptions = modalOverlayEl.querySelectorAll('.settings-lang-option');

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
                            if (typeof onLangSelect === 'function') {
                                onLangSelect();
                            }
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
                    if (themeKey && prefs) {
                        prefs.setTheme(themeKey, true);
                    }
                });
            });

            if (autoCapToggle && prefs) {
                autoCapToggle.checked = prefs.isAutoCapitalizeEnabled();
                autoCapToggle.addEventListener('change', (e) => {
                    prefs.setAutoCapitalize(e.target.checked);
                });
            }

            if (compactToggle && prefs) {
                compactToggle.checked = prefs.isCompactViewEnabled();
                compactToggle.addEventListener('change', (e) => {
                    prefs.setCompactView(e.target.checked);
                });
            }
        }
    };

    window.App.settingsAppearanceTab = settingsAppearanceTab;
})();
