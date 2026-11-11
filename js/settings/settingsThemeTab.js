// js/settings/settingsThemeTab.js - Вкладка кастомізації теми оформлення та редагування root-кольорів
window.App = window.App || {};

(function() {
    const STORAGE_KEY_CUSTOM_COLORS = 'nothing_notes_custom_colors';

    const CUSTOM_TOKEN_GROUPS = [
        {
            id: 'surfaces',
            titleUa: 'Поверхні та фони',
            titleEn: 'Surfaces & Backgrounds',
            tokens: [
                {
                    key: '--bg-base',
                    aliases: ['--bg-color'],
                    nameUa: 'Фон сторінки (полотно)',
                    nameEn: 'Base background',
                    default: '#1d1e19',
                    descUa: 'Головне робоче полотно додатку',
                    descEn: 'Main application background'
                },
                {
                    key: '--bg-surface',
                    aliases: ['--sidebar-bg', '--column-bg'],
                    nameUa: 'Сайдбар та колонки',
                    nameEn: 'Sidebar & columns',
                    default: '#272822',
                    descUa: 'Бічна панель та заголовки колонок',
                    descEn: 'Sidebar and column containers'
                },
                {
                    key: '--bg-elevated',
                    aliases: ['--modal-bg', '--surface-dropdown', '--toolbar-bg'],
                    nameUa: 'Вікна, меню та тулбари',
                    nameEn: 'Modals, menus & toolbars',
                    default: '#32332c',
                    descUa: 'Спливаючі вікна, меню та плаваючі панелі',
                    descEn: 'Popups, dropdowns and floating toolbars'
                },
                {
                    key: '--bg-subtle',
                    aliases: ['--code-bg', '--tab-bg'],
                    nameUa: 'Поля вводу та кнопки',
                    nameEn: 'Inputs & secondary buttons',
                    default: '#22231d',
                    descUa: 'Інпути, чіпи, другорядні кнопки',
                    descEn: 'Input fields, chips and secondary buttons'
                }
            ]
        },
        {
            id: 'typography',
            titleUa: 'Текст та типографіка',
            titleEn: 'Text & Typography',
            tokens: [
                {
                    key: '--text-main',
                    aliases: [],
                    nameUa: 'Основний текст',
                    nameEn: 'Primary text',
                    default: '#f8f8f2',
                    descUa: 'Заголовки, назви нотаток, основний вміст',
                    descEn: 'Headers, note titles, main content'
                },
                {
                    key: '--text-muted',
                    aliases: [],
                    nameUa: 'Другорядний текст',
                    nameEn: 'Muted text',
                    default: '#8c8d84',
                    descUa: 'Підказки, дати, другорядні підписи',
                    descEn: 'Hints, dates, secondary labels'
                }
            ]
        },
        {
            id: 'borders',
            titleUa: 'Межі та роздільники',
            titleEn: 'Borders & Dividers',
            tokens: [
                {
                    key: '--border-subtle',
                    aliases: ['--border-color'],
                    nameUa: 'Тонкі роздільники',
                    nameEn: 'Subtle borders',
                    default: '#3a3b33',
                    descUa: 'Розділювальні лінії списків і меню',
                    descEn: 'Divider lines for lists and menus'
                },
                {
                    key: '--border-strong',
                    aliases: [],
                    nameUa: 'Активні контури',
                    nameEn: 'Strong borders',
                    default: '#5a5b4c',
                    descUa: 'Рамки карток та активні контури',
                    descEn: 'Card outlines and active borders'
                }
            ]
        },
        {
            id: 'accents',
            titleUa: 'Акценти та стани',
            titleEn: 'Accents & Signals',
            tokens: [
                {
                    key: '--accent-color',
                    aliases: [],
                    nameUa: 'Фірмовий смарт-акцент',
                    nameEn: 'Brand accent',
                    default: '#16b981',
                    descUa: 'Смарагдові кнопки дій, виділення, чекбокси',
                    descEn: 'Emerald action buttons, highlights, checks'
                },
                {
                    key: '--danger-color',
                    aliases: [],
                    nameUa: 'Колір небезпеки',
                    nameEn: 'Danger color',
                    default: '#f92672',
                    descUa: 'Кнопки видалення та попередження',
                    descEn: 'Delete buttons and critical actions'
                }
            ]
        }
    ];

    function hexToRgba(hex, alpha) {
        if (!hex || typeof hex !== 'string') return null;
        let c = hex.replace('#', '').trim();
        if (c.length === 3) {
            c = c.split('').map(ch => ch + ch).join('');
        }
        if (c.length !== 6) return null;
        const num = parseInt(c, 16);
        if (isNaN(num)) return null;
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function isValidHex(hex) {
        return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);
    }

    function normalizeHex(hex) {
        if (!hex.startsWith('#')) hex = '#' + hex;
        return hex.toLowerCase();
    }

    const settingsThemeTab = {
        CUSTOM_TOKEN_GROUPS,

        getCustomColors() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_COLORS);
                return raw ? JSON.parse(raw) : {};
            } catch (e) {
                return {};
            }
        },

        saveCustomColors(colors) {
            try {
                localStorage.setItem(STORAGE_KEY_CUSTOM_COLORS, JSON.stringify(colors));
            } catch (e) {
                console.warn('[SettingsThemeTab] Помилка збереження кольорів:', e);
            }
        },

        applyCustomColors() {
            const colors = this.getCustomColors();
            const root = document.documentElement;

            for (const group of CUSTOM_TOKEN_GROUPS) {
                for (const token of group.tokens) {
                    const val = colors[token.key];
                    if (val && isValidHex(val)) {
                        root.style.setProperty(token.key, val);
                        token.aliases.forEach(alias => root.style.setProperty(alias, val));

                        // Спеціальні залежні змінні
                        if (token.key === '--accent-color') {
                            const sub = hexToRgba(val, 0.15);
                            if (sub) root.style.setProperty('--accent-subtle', sub);
                        } else if (token.key === '--danger-color') {
                            const sub = hexToRgba(val, 0.15);
                            if (sub) root.style.setProperty('--danger-subtle', sub);
                        } else if (token.key === '--bg-base') {
                            const metaTheme = document.querySelector('meta[name="theme-color"]');
                            if (metaTheme) metaTheme.setAttribute('content', val);
                        }
                    } else {
                        root.style.removeProperty(token.key);
                        token.aliases.forEach(alias => root.style.removeProperty(alias));
                    }
                }
            }
        },

        setCustomColor(key, hex) {
            if (!isValidHex(hex)) return;
            const colors = this.getCustomColors();
            colors[key] = normalizeHex(hex);
            this.saveCustomColors(colors);
            this.applyCustomColors();
        },

        resetAll() {
            try {
                localStorage.removeItem(STORAGE_KEY_CUSTOM_COLORS);
            } catch (e) {}

            const root = document.documentElement;
            for (const group of CUSTOM_TOKEN_GROUPS) {
                for (const token of group.tokens) {
                    root.style.removeProperty(token.key);
                    token.aliases.forEach(alias => root.style.removeProperty(alias));
                }
            }
            root.style.removeProperty('--accent-subtle');
            root.style.removeProperty('--danger-subtle');

            const metaTheme = document.querySelector('meta[name="theme-color"]');
            if (metaTheme) metaTheme.setAttribute('content', '#1d1e19');

            this.applyCustomColors();
        },

        renderHTML(isVisible) {
            const isUa = !window.App.i18n || (window.App.i18n.getLanguage && window.App.i18n.getLanguage() === 'ua');
            const customColors = this.getCustomColors();

            let groupsHTML = '';
            for (const group of CUSTOM_TOKEN_GROUPS) {
                const groupTitle = isUa ? group.titleUa : group.titleEn;
                let rowsHTML = '';

                for (const token of group.tokens) {
                    const tokenName = isUa ? token.nameUa : token.nameEn;
                    const tokenDesc = isUa ? token.descUa : token.descEn;
                    const currentColor = (customColors[token.key] || token.default).toUpperCase();
                    const isCustom = Boolean(customColors[token.key] && customColors[token.key].toLowerCase() !== token.default.toLowerCase());

                    rowsHTML += `
                        <div class="theme-token-row" data-token-key="${token.key}">
                            <div class="theme-token-info">
                                <span class="theme-token-name">${tokenName}</span>
                                <span class="theme-token-desc">${tokenDesc}</span>
                            </div>
                            <div class="theme-token-controls">
                                <div class="theme-color-swatch-wrap" title="${isUa ? 'Відкрити палітру' : 'Open color picker'}">
                                    <div class="theme-color-swatch-preview" style="background-color: ${currentColor};"></div>
                                    <input type="color" class="theme-native-color-picker" value="${currentColor.startsWith('#') && currentColor.length === 7 ? currentColor : token.default}" data-token-key="${token.key}">
                                </div>
                                <input type="text" class="theme-hex-input" value="${currentColor}" maxlength="7" spellcheck="false" data-token-key="${token.key}">
                                ${isCustom ? `
                                    <button type="button" class="theme-token-reset-btn" data-reset-key="${token.key}" title="${isUa ? 'Скинути до дефолту' : 'Reset to default'}">↺</button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }

                groupsHTML += `
                    <div class="theme-token-group">
                        <div class="theme-token-group-title">${groupTitle}</div>
                        ${rowsHTML}
                    </div>
                `;
            }

            return `
                <div class="settings-tab-content settings-theme-customizer" id="settings-tab-theme" style="display: ${isVisible ? 'flex' : 'none'};">
                    <div class="theme-customizer-banner">
                        <div class="theme-customizer-banner-info">
                            <span class="theme-customizer-banner-title">${isUa ? 'Базова тема: Темний ліс' : 'Base Theme: Forest'}</span>
                            <span class="theme-customizer-banner-desc">${isUa ? 'Змінюйте кольори в реальному часі за допомогою палітри' : 'Customize colors in real-time using color pickers'}</span>
                        </div>
                        <button type="button" class="theme-reset-all-btn" id="theme-reset-all-btn">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                                <path d="M3 3v5h5"></path>
                            </svg>
                            <span>${isUa ? 'Скинути всі' : 'Reset all'}</span>
                        </button>
                    </div>

                    ${groupsHTML}
                </div>
            `;
        },

        bindEvents(modalOverlayEl, onUpdate) {
            if (!modalOverlayEl) return;

            // 1. Color Picker inputs (real-time live update)
            const swatchWraps = modalOverlayEl.querySelectorAll('.theme-color-swatch-wrap');
            swatchWraps.forEach(wrap => {
                wrap.addEventListener('click', (e) => {
                    const picker = wrap.querySelector('.theme-native-color-picker');
                    if (picker && e.target !== picker) {
                        if (typeof picker.showPicker === 'function') {
                            try { picker.showPicker(); } catch (err) { picker.click(); }
                        } else {
                            picker.click();
                        }
                    }
                });
            });

            const colorPickers = modalOverlayEl.querySelectorAll('.theme-native-color-picker');
            colorPickers.forEach(picker => {
                picker.addEventListener('input', (e) => {
                    const key = picker.getAttribute('data-token-key');
                    const hex = e.target.value;
                    const row = picker.closest('.theme-token-row');
                    if (row) {
                        const preview = row.querySelector('.theme-color-swatch-preview');
                        const hexInput = row.querySelector('.theme-hex-input');
                        if (preview) preview.style.backgroundColor = hex;
                        if (hexInput) hexInput.value = hex.toUpperCase();
                    }
                    this.setCustomColor(key, hex);
                });

                picker.addEventListener('change', () => {
                    if (typeof onUpdate === 'function') onUpdate();
                });
            });

            // 2. HEX text inputs
            const hexInputs = modalOverlayEl.querySelectorAll('.theme-hex-input');
            hexInputs.forEach(input => {
                input.addEventListener('change', (e) => {
                    let hex = e.target.value.trim();
                    if (!hex.startsWith('#')) hex = '#' + hex;
                    if (isValidHex(hex)) {
                        const key = input.getAttribute('data-token-key');
                        const row = input.closest('.theme-token-row');
                        if (row) {
                            const preview = row.querySelector('.theme-color-swatch-preview');
                            const nativePicker = row.querySelector('.theme-native-color-picker');
                            if (preview) preview.style.backgroundColor = hex;
                            if (nativePicker && hex.length === 7) nativePicker.value = hex;
                        }
                        this.setCustomColor(key, hex);
                        if (typeof onUpdate === 'function') onUpdate();
                    }
                });
            });

            // 3. Reset All Button
            const resetAllBtn = modalOverlayEl.querySelector('#theme-reset-all-btn');
            if (resetAllBtn) {
                resetAllBtn.addEventListener('click', () => {
                    this.resetAll();
                    if (typeof onUpdate === 'function') onUpdate();
                });
            }

            // 4. Individual Token Reset Buttons
            const resetTokenBtns = modalOverlayEl.querySelectorAll('.theme-token-reset-btn');
            resetTokenBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const key = btn.getAttribute('data-reset-key');
                    const colors = this.getCustomColors();
                    delete colors[key];
                    this.saveCustomColors(colors);
                    this.applyCustomColors();
                    if (typeof onUpdate === 'function') onUpdate();
                });
            });
        }
    };

    window.App.settingsThemeTab = settingsThemeTab;

    // Автоматичне застосування збережених кастомних кольорів при ініціалізації
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => settingsThemeTab.applyCustomColors());
    } else {
        settingsThemeTab.applyCustomColors();
    }
})();
