// js/settings/settingsPreferences.js - Збереження та застосування параметрів додатку (теми, автокапіталізація, компактний вигляд)
window.App = window.App || {};

(function() {
    const STORAGE_KEY_AUTO_CAP = 'nothing_notes_auto_capitalize';
    const STORAGE_KEY_COMPACT = 'nothing_notes_compact_view';
    const STORAGE_KEY_THEME = 'nothing_notes_theme';

    const THEMES = [
        { key: 'forest', nameKey: 'settings.theme.forest.name', descKey: 'settings.theme.forest.desc', metaColor: '#1d1e19' }
    ];

    let autoCapitalize = true;
    let compactView = false;
    let currentTheme = 'forest';

    const settingsPreferences = {
        THEMES,

        init() {
            this.loadPreferences();
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

                currentTheme = 'forest';
                try {
                    localStorage.setItem(STORAGE_KEY_THEME, 'forest');
                } catch (e) {}
            } catch (err) {
                console.warn('[SettingsPreferences] Помилка зчитування preferences:', err);
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

        setTheme(themeKey = 'forest', save = true) {
            currentTheme = 'forest';
            themeKey = 'forest';

            document.documentElement.setAttribute('data-theme', themeKey);

            const themeObj = THEMES.find(t => t.key === themeKey);
            if (themeObj) {
                let metaTheme = document.querySelector('meta[name="theme-color"]');
                if (!metaTheme) {
                    metaTheme = document.createElement('meta');
                    metaTheme.name = 'theme-color';
                    if (document.head) {
                        document.head.appendChild(metaTheme);
                    }
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

            const modalOverlayEl = document.getElementById('settings-modal');
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

            if (window.App.state && window.App.state.viewMode === 'board' && window.App.boardView) {
                window.App.boardView.render();
            } else if (window.App.state && window.App.state.viewMode === 'graph' && window.App.graphView) {
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
        }
    };

    window.App.settingsPreferences = settingsPreferences;
})();
