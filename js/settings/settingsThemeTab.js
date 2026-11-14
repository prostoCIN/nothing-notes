// js/settings/settingsThemeTab.js - Вкладка кастомізації теми оформлення, редагування root-кольорів та збереження пресетів
window.App = window.App || {};

(function() {
    const STORAGE_KEY_CUSTOM_COLORS = 'nothing_notes_custom_colors';
    const STORAGE_KEY_THEME_PRESETS = 'nothing_notes_theme_presets';

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
                    aliases: ['--sidebar-bg', '--column-bg', '--header-bg'],
                    nameUa: 'Сайдбар та колонки',
                    nameEn: 'Sidebar & columns',
                    default: '#272822',
                    descUa: 'Бічна панель та заголовки колонок',
                    descEn: 'Sidebar and column containers'
                },
                {
                    key: '--bg-elevated',
                    aliases: ['--modal-bg', '--surface-dropdown', '--toolbar-bg', '--search-bar-bg'],
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
                    aliases: ['--border-color', '--search-bar-border'],
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
                    aliases: ['--accent-emerald'],
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

    const BUILTIN_PRESETS = [
        {
            id: 'builtin_forest',
            nameUa: 'Темний ліс',
            nameEn: 'Forest (Default)',
            isCustom: false,
            colors: {
                '--bg-base': '#1d1e19',
                '--bg-surface': '#272822',
                '--bg-elevated': '#32332c',
                '--bg-subtle': '#22231d',
                '--text-main': '#f8f8f2',
                '--text-muted': '#8c8d84',
                '--border-subtle': '#3a3b33',
                '--border-strong': '#5a5b4c',
                '--accent-color': '#16b981',
                '--danger-color': '#f92672'
            }
        },
        {
            id: 'builtin_obsidian',
            nameUa: 'OLED Обсидіан',
            nameEn: 'OLED Obsidian',
            isCustom: false,
            colors: {
                '--bg-base': '#050507',
                '--bg-surface': '#101114',
                '--bg-elevated': '#181920',
                '--bg-subtle': '#0d0e12',
                '--text-main': '#f3f4f6',
                '--text-muted': '#71717a',
                '--border-subtle': '#20222a',
                '--border-strong': '#383b47',
                '--accent-color': '#3b82f6',
                '--danger-color': '#ef4444'
            }
        },
        {
            id: 'builtin_cyberpunk',
            nameUa: 'Синтвейв Неон',
            nameEn: 'Synthwave Neon',
            isCustom: false,
            colors: {
                '--bg-base': '#0e1017',
                '--bg-surface': '#171a26',
                '--bg-elevated': '#202536',
                '--bg-subtle': '#121520',
                '--text-main': '#f1f5f9',
                '--text-muted': '#8899ac',
                '--border-subtle': '#282e44',
                '--border-strong': '#424c6e',
                '--accent-color': '#ec4899',
                '--danger-color': '#f43f5e'
            }
        },
        {
            id: 'builtin_mocha',
            nameUa: 'Теплий Мокко',
            nameEn: 'Warm Mocha',
            isCustom: false,
            colors: {
                '--bg-base': '#181411',
                '--bg-surface': '#231d18',
                '--bg-elevated': '#2f2721',
                '--bg-subtle': '#1d1814',
                '--text-main': '#f5efe6',
                '--text-muted': '#9e9184',
                '--border-subtle': '#3b322a',
                '--border-strong': '#574a3f',
                '--accent-color': '#f59e0b',
                '--danger-color': '#e11d48'
            }
        },
        {
            id: 'builtin_nordic',
            nameUa: 'Нордичний Сизий',
            nameEn: 'Nordic Frost',
            isCustom: false,
            colors: {
                '--bg-base': '#11161d',
                '--bg-surface': '#182029',
                '--bg-elevated': '#222c38',
                '--bg-subtle': '#141a22',
                '--text-main': '#f0f6fc',
                '--text-muted': '#7d8f9f',
                '--border-subtle': '#283544',
                '--border-strong': '#3d4f66',
                '--accent-color': '#06b6d4',
                '--danger-color': '#f87171'
            }
        },
        {
            id: 'builtin_amethyst',
            nameUa: 'Глибокий Аметист',
            nameEn: 'Deep Amethyst',
            isCustom: false,
            colors: {
                '--bg-base': '#130f1c',
                '--bg-surface': '#1d172b',
                '--bg-elevated': '#271f3a',
                '--bg-subtle': '#161121',
                '--text-main': '#f5f3ff',
                '--text-muted': '#8f85a4',
                '--border-subtle': '#342a4d',
                '--border-strong': '#4f3f75',
                '--accent-color': '#a855f7',
                '--danger-color': '#fb7185'
            }
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
        BUILTIN_PRESETS,

        getCurrentUserId() {
            try {
                // 1. Якщо сесія вже в оперативній пам'яті
                const cs = window.App.cloudSync;
                const user = cs && cs.getCurrentUser ? cs.getCurrentUser() : null;
                if (user && user.id) return user.id;

                // 2. Якщо додаток щойно перезавантажився, перевіряємо збережений акаунт (синхронно в 0 мс)
                const rawAccounts = localStorage.getItem('nothing_notes_saved_accounts');
                if (rawAccounts) {
                    const accs = JSON.parse(rawAccounts);
                    const activeAcc = Array.isArray(accs) ? (accs.find(a => a.is_active) || accs[0]) : null;
                    if (activeAcc && activeAcc.id) return activeAcc.id;
                }

                // 3. Також перевіряємо сесійний токен Supabase
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
                        const val = JSON.parse(localStorage.getItem(k));
                        if (val && val.user && val.user.id) return val.user.id;
                    }
                }
                return null;
            } catch (e) {
                return null;
            }
        },

        getCustomColors() {
            try {
                const uid = this.getCurrentUserId();
                let raw = null;
                if (uid) {
                    raw = localStorage.getItem(`${STORAGE_KEY_CUSTOM_COLORS}_${uid}`);
                }
                if (!raw) {
                    raw = localStorage.getItem(STORAGE_KEY_CUSTOM_COLORS);
                }
                return raw ? JSON.parse(raw) : {};
            } catch (e) {
                return {};
            }
        },

        saveCustomColors(colors, syncToCloud = true) {
            try {
                const uid = this.getCurrentUserId();
                const json = colors && Object.keys(colors).length > 0 ? JSON.stringify(colors) : null;
                if (json) {
                    localStorage.setItem(STORAGE_KEY_CUSTOM_COLORS, json);
                    if (uid) {
                        localStorage.setItem(`${STORAGE_KEY_CUSTOM_COLORS}_${uid}`, json);
                    }
                } else {
                    localStorage.removeItem(STORAGE_KEY_CUSTOM_COLORS);
                    if (uid) {
                        localStorage.removeItem(`${STORAGE_KEY_CUSTOM_COLORS}_${uid}`);
                    }
                }
            } catch (e) {
                console.warn('[SettingsThemeTab] Помилка збереження кольорів:', e);
            }
            if (syncToCloud) {
                this.syncThemesToCloud();
            }
        },

        getSavedPresets() {
            try {
                const uid = this.getCurrentUserId();
                if (!uid) return [];
                const key = `${STORAGE_KEY_THEME_PRESETS}_${uid}`;
                let raw = localStorage.getItem(key);
                if (!raw) {
                    // Якщо в ключі користувача ще пусто, але є старий локальний набір — переносимо його до акаунту
                    const legacy = localStorage.getItem(STORAGE_KEY_THEME_PRESETS);
                    if (legacy) {
                        localStorage.setItem(key, legacy);
                        localStorage.removeItem(STORAGE_KEY_THEME_PRESETS);
                        raw = legacy;
                    }
                }
                return raw ? JSON.parse(raw) : [];
            } catch (e) {
                return [];
            }
        },

        saveSavedPresets(presets, syncToCloud = true) {
            try {
                const uid = this.getCurrentUserId();
                if (!uid) return;
                const key = `${STORAGE_KEY_THEME_PRESETS}_${uid}`;
                localStorage.setItem(key, JSON.stringify(presets));
                localStorage.removeItem(STORAGE_KEY_THEME_PRESETS);
            } catch (e) {
                console.warn('[SettingsThemeTab] Помилка збереження пресетів:', e);
            }
            if (syncToCloud) {
                this.syncThemesToCloud();
            }
        },

        async syncThemesToCloud() {
            try {
                const supabase = window.App.supabase;
                const cs = window.App.cloudSync;
                const user = cs && cs.getCurrentUser ? cs.getCurrentUser() : null;
                if (!supabase || !user) return;

                const presets = this.getSavedPresets();
                const colors = this.getCustomColors();

                await supabase.auth.updateUser({
                    data: {
                        theme_presets: presets,
                        custom_colors: colors
                    }
                });

                if (user.user_metadata) {
                    user.user_metadata.theme_presets = presets;
                    user.user_metadata.custom_colors = colors;
                }
            } catch (err) {
                console.warn('[SettingsThemeTab] Не вдалося синхронізувати тему з хмарою:', err);
            }
        },

        loadThemesFromCloud(user) {
            if (!user) return;
            const meta = user.user_metadata || {};
            const cloudPresets = meta.theme_presets;
            const cloudColors = meta.custom_colors;
            const uid = user.id;

            // 1. Пресети акаунта: якщо є в хмарі — оновлюємо локальний кеш акаунта
            if (Array.isArray(cloudPresets)) {
                localStorage.setItem(`${STORAGE_KEY_THEME_PRESETS}_${uid}`, JSON.stringify(cloudPresets));
                localStorage.removeItem(STORAGE_KEY_THEME_PRESETS);
            } else {
                // Якщо в хмарі ще нема пресетів, але в акаунті локально є — відправляємо в хмару
                const localPresets = this.getSavedPresets();
                if (localPresets.length > 0) {
                    this.syncThemesToCloud();
                }
            }

            // 2. Кольори теми акаунта
            if (cloudColors && typeof cloudColors === 'object' && Object.keys(cloudColors).length > 0) {
                this.saveCustomColors(cloudColors, false);
                this.applyCustomColors();
            } else if (meta.hasOwnProperty('custom_colors') && Object.keys(cloudColors || {}).length === 0) {
                this.resetAll();
            } else {
                const current = this.getCustomColors();
                if (Object.keys(current).length > 0) {
                    this.syncThemesToCloud();
                }
            }

            this.updateActivePresetBadges();
            this.refreshPresetsGrid();
        },

        getAllPresets() {
            const uid = this.getCurrentUserId();
            // Якщо користувач не увійшов в акаунт — доступний лише базовий набір
            if (!uid) {
                return [...BUILTIN_PRESETS];
            }
            const saved = this.getSavedPresets();
            return [...BUILTIN_PRESETS, ...saved];
        },

        isPresetActive(preset) {
            if (!preset || !preset.colors) return false;
            const currentColors = this.getCustomColors();
            for (const group of CUSTOM_TOKEN_GROUPS) {
                for (const token of group.tokens) {
                    const activeVal = (currentColors[token.key] || token.default).toLowerCase();
                    const presetVal = (preset.colors[token.key] || token.default).toLowerCase();
                    if (activeVal !== presetVal) {
                        return false;
                    }
                }
            }
            return true;
        },

        getActivePresetId() {
            const all = this.getAllPresets();
            for (const p of all) {
                if (this.isPresetActive(p)) return p.id;
            }
            return null;
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
                            const sub = hexToRgba(val, 0.14);
                            if (sub) root.style.setProperty('--accent-subtle', sub);
                            const glow = hexToRgba(val, 0.35);
                            if (glow) root.style.setProperty('--accent-glow', glow);
                            const border = hexToRgba(val, 0.28);
                            if (border) root.style.setProperty('--accent-border', border);
                            const hover = hexToRgba(val, 0.20);
                            if (hover) root.style.setProperty('--accent-hover', hover);
                            const strong = hexToRgba(val, 0.50);
                            if (strong) root.style.setProperty('--accent-strong', strong);
                            const soft = hexToRgba(val, 0.08);
                            if (soft) root.style.setProperty('--accent-soft', soft);

                            // Контрастний колір тексту для акцентних кнопок: темний #062419 для світлих/яскравих відтінків, білий для темних
                            const getLuminance = (hex) => {
                                let c = hex.replace('#', '').trim();
                                if (c.length === 3) c = c.split('').map(x => x + x).join('');
                                if (c.length !== 6) return 1;
                                const r = parseInt(c.substring(0, 2), 16);
                                const g = parseInt(c.substring(2, 4), 16);
                                const b = parseInt(c.substring(4, 6), 16);
                                return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                            };
                            root.style.setProperty('--accent-contrast', getLuminance(val) > 0.48 ? '#062419' : '#ffffff');
                        } else if (token.key === '--danger-color') {
                            const sub = hexToRgba(val, 0.14);
                            if (sub) root.style.setProperty('--danger-subtle', sub);
                        } else if (token.key === '--bg-base') {
                            const metaTheme = document.querySelector('meta[name="theme-color"]');
                            if (metaTheme) metaTheme.setAttribute('content', val);
                        }
                    } else {
                        root.style.removeProperty(token.key);
                        token.aliases.forEach(alias => root.style.removeProperty(alias));

                        // Очищення залежних змінних при скиданні окремого токена
                        if (token.key === '--accent-color') {
                            root.style.removeProperty('--accent-subtle');
                            root.style.removeProperty('--accent-glow');
                            root.style.removeProperty('--accent-border');
                            root.style.removeProperty('--accent-hover');
                            root.style.removeProperty('--accent-strong');
                            root.style.removeProperty('--accent-soft');
                            root.style.removeProperty('--accent-contrast');
                        } else if (token.key === '--danger-color') {
                            root.style.removeProperty('--danger-subtle');
                        } else if (token.key === '--bg-base') {
                            const metaTheme = document.querySelector('meta[name="theme-color"]');
                            if (metaTheme) metaTheme.setAttribute('content', '#1d1e19');
                        }
                    }
                }
            }

            // Динамічний градієнт фону полотна дошки та інтерактивного графу зв'язків
            const currentBase = root.style.getPropertyValue('--bg-base') || colors['--bg-base'] || '';
            const currentSurface = root.style.getPropertyValue('--bg-surface') || colors['--bg-surface'] || '';
            if (currentBase || currentSurface) {
                const baseVal = currentBase || 'var(--bg-base)';
                const surfaceVal = currentSurface || 'var(--bg-surface)';
                root.style.setProperty('--graph-bg', `radial-gradient(circle at center, ${surfaceVal} 0%, ${baseVal} 100%)`);
            } else {
                root.style.removeProperty('--graph-bg');
            }
        },

        setCustomColor(key, hex) {
            if (!isValidHex(hex)) return;
            const colors = this.getCustomColors();
            const normHex = normalizeHex(hex);
            const defaultColor = this.getDefaultColor(key);

            if (normHex.toLowerCase() === defaultColor.toLowerCase()) {
                delete colors[key];
            } else {
                colors[key] = normHex;
            }

            this.saveCustomColors(colors);
            this.applyCustomColors();
            this.updateActivePresetBadges();
        },

        getDefaultColor(tokenKey) {
            for (const group of CUSTOM_TOKEN_GROUPS) {
                const found = group.tokens.find(t => t.key === tokenKey);
                if (found) return found.default;
            }
            return '#16b981';
        },

        updateTokenRowState(tokenKey, hex) {
            const row = document.querySelector(`.theme-token-row[data-token-key="${tokenKey}"]`);
            if (!row) return;

            const preview = row.querySelector('.theme-color-swatch-preview');
            const hexInput = row.querySelector('.theme-hex-input');
            const controls = row.querySelector('.theme-token-controls');
            const normHex = normalizeHex(hex);

            if (preview) preview.style.backgroundColor = normHex;
            if (hexInput && document.activeElement !== hexInput) {
                hexInput.value = normHex.toUpperCase();
            }

            const defaultColor = this.getDefaultColor(tokenKey);
            const isCustom = normHex.toLowerCase() !== defaultColor.toLowerCase();
            let resetBtn = row.querySelector('.theme-token-reset-btn');

            if (isCustom) {
                if (!resetBtn && controls) {
                    resetBtn = document.createElement('button');
                    resetBtn.type = 'button';
                    resetBtn.className = 'theme-token-reset-btn';
                    resetBtn.setAttribute('data-reset-key', tokenKey);
                    const isUa = !window.App.i18n || (window.App.i18n.getLanguage && window.App.i18n.getLanguage() === 'ua');
                    resetBtn.setAttribute('title', isUa ? 'Скинути до дефолту' : 'Reset to default');
                    resetBtn.textContent = '↺';
                    resetBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.resetToken(tokenKey);
                    });
                    controls.appendChild(resetBtn);
                }
            } else if (resetBtn) {
                resetBtn.remove();
            }
        },

        resetToken(key) {
            if (window.App.colorPickerPopover) window.App.colorPickerPopover.close();
            const colors = this.getCustomColors();
            delete colors[key];
            this.saveCustomColors(colors);
            this.applyCustomColors();

            const defaultColor = this.getDefaultColor(key);
            this.updateTokenRowState(key, defaultColor);
            this.updateActivePresetBadges();
        },

        resetAll() {
            if (window.App.colorPickerPopover) window.App.colorPickerPopover.close();
            try {
                const uid = this.getCurrentUserId();
                localStorage.removeItem(STORAGE_KEY_CUSTOM_COLORS);
                if (uid) {
                    localStorage.removeItem(`${STORAGE_KEY_CUSTOM_COLORS}_${uid}`);
                }
            } catch (e) {}

            const root = document.documentElement;
            for (const group of CUSTOM_TOKEN_GROUPS) {
                for (const token of group.tokens) {
                    root.style.removeProperty(token.key);
                    token.aliases.forEach(alias => root.style.removeProperty(alias));
                    this.updateTokenRowState(token.key, token.default);
                }
            }
            root.style.removeProperty('--accent-subtle');
            root.style.removeProperty('--accent-glow');
            root.style.removeProperty('--accent-border');
            root.style.removeProperty('--accent-hover');
            root.style.removeProperty('--accent-strong');
            root.style.removeProperty('--accent-soft');
            root.style.removeProperty('--accent-contrast');
            root.style.removeProperty('--danger-subtle');
            root.style.removeProperty('--graph-bg');

            const metaTheme = document.querySelector('meta[name="theme-color"]');
            if (metaTheme) metaTheme.setAttribute('content', '#1d1e19');

            this.updateActivePresetBadges();
            this.syncThemesToCloud();
        },

        applyPreset(presetId) {
            const all = this.getAllPresets();
            const preset = all.find(p => p.id === presetId);
            if (!preset) return;

            if (preset.id === 'builtin_forest') {
                this.resetAll();
                return;
            }

            const colorsToSave = {};
            for (const group of CUSTOM_TOKEN_GROUPS) {
                for (const token of group.tokens) {
                    const val = preset.colors[token.key] || token.default;
                    if (val.toLowerCase() !== token.default.toLowerCase()) {
                        colorsToSave[token.key] = val.toLowerCase();
                    }
                }
            }

            this.saveCustomColors(colorsToSave);
            this.applyCustomColors();

            // Оновлюємо стан інпутів і свотчів у списку токенів
            for (const group of CUSTOM_TOKEN_GROUPS) {
                for (const token of group.tokens) {
                    const effectiveColor = preset.colors[token.key] || token.default;
                    this.updateTokenRowState(token.key, effectiveColor);
                }
            }

            this.updateActivePresetBadges();
        },

        saveCurrentAsPreset(name) {
            const cleanName = (name || '').trim();
            if (!cleanName) return null;

            const uid = this.getCurrentUserId();
            if (!uid) {
                if (window.App.authModal && window.App.authModal.open) {
                    window.App.authModal.open(false);
                }
                return null;
            }

            const currentColors = this.getCustomColors();
            const fullSnapshot = {};
            for (const group of CUSTOM_TOKEN_GROUPS) {
                for (const token of group.tokens) {
                    fullSnapshot[token.key] = (currentColors[token.key] || token.default).toLowerCase();
                }
            }

            const newPreset = {
                id: 'custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                name: cleanName,
                isCustom: true,
                colors: fullSnapshot,
                createdAt: Date.now()
            };

            const saved = this.getSavedPresets();
            saved.push(newPreset);
            this.saveSavedPresets(saved, true);

            return newPreset;
        },

        deletePreset(presetId) {
            let saved = this.getSavedPresets();
            saved = saved.filter(p => p.id !== presetId);
            this.saveSavedPresets(saved);
        },

        updateActivePresetBadges(container = document) {
            const activeId = this.getActivePresetId();
            const isUa = !window.App.i18n || (window.App.i18n.getLanguage && window.App.i18n.getLanguage() === 'ua');

            container.querySelectorAll('.theme-preset-card').forEach(card => {
                const id = card.getAttribute('data-preset-id');
                const isActive = id === activeId;
                card.classList.toggle('active', isActive);

                let check = card.querySelector('.theme-preset-active-check');
                if (isActive) {
                    if (!check) {
                        check = document.createElement('span');
                        check.className = 'theme-preset-active-check';
                        check.setAttribute('title', isUa ? 'Активний набір' : 'Active preset');
                        check.innerHTML = `
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="16 9 10.5 14.5 8 12"></polyline>
                            </svg>
                        `;
                        card.appendChild(check);
                    }
                } else if (check) {
                    check.remove();
                }
            });
        },

        renderPresetsCardsHTML(isUa) {
            const allPresets = this.getAllPresets();
            const activeId = this.getActivePresetId();

            return allPresets.map(preset => {
                const presetName = preset.isCustom ? preset.name : (isUa ? preset.nameUa : preset.nameEn);
                const isActive = preset.id === activeId;
                const bgBase = preset.colors['--bg-base'] || '#1d1e19';
                const bgSurface = preset.colors['--bg-surface'] || '#272822';
                const accent = preset.colors['--accent-color'] || '#16b981';
                const textMain = preset.colors['--text-main'] || '#f8f8f2';

                return `
                    <div class="theme-preset-card ${isActive ? 'active' : ''}" data-preset-id="${preset.id}" role="button" tabindex="0" title="${isUa ? 'Застосувати набір' : 'Apply preset'}">
                        ${isActive ? `
                            <span class="theme-preset-active-check" title="${isUa ? 'Активний набір' : 'Active preset'}">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="16 9 10.5 14.5 8 12"></polyline>
                                </svg>
                            </span>
                        ` : ''}
                        <div class="theme-preset-swatches">
                            <span class="theme-preset-swatch" style="background-color: ${bgBase};" title="${isUa ? 'Фон' : 'Background'}: ${bgBase}"></span>
                            <span class="theme-preset-swatch" style="background-color: ${bgSurface};" title="${isUa ? 'Поверхня' : 'Surface'}: ${bgSurface}"></span>
                            <span class="theme-preset-swatch" style="background-color: ${accent};" title="${isUa ? 'Акцент' : 'Accent'}: ${accent}"></span>
                            <span class="theme-preset-swatch" style="background-color: ${textMain};" title="${isUa ? 'Текст' : 'Text'}: ${textMain}"></span>
                        </div>
                        <div class="theme-preset-info">
                            <span class="theme-preset-name">${presetName}</span>
                        </div>
                        ${preset.isCustom ? `
                            <button type="button" class="theme-preset-delete-btn" data-delete-id="${preset.id}" title="${isUa ? 'Видалити пресет' : 'Delete preset'}">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                `;
            }).join('');
        },

        renderPresetsSectionHTML(isUa) {
            return `
                <div class="theme-presets-section">
                    <div class="theme-presets-header">
                        <div class="theme-presets-title-wrap">
                            <span class="theme-presets-title">${isUa ? 'Колекції та набори теми' : 'Theme Presets & Palettes'}</span>
                            <span class="theme-presets-subtitle">${isUa ? 'Оберіть стиль в один клік або налаштуйте власні кольори нижче' : 'Choose a style in one click or customize colors below'}</span>
                        </div>
                    </div>

                    <div class="theme-presets-grid" id="theme-presets-grid">
                        ${this.renderPresetsCardsHTML(isUa)}
                    </div>
                </div>
            `;
        },

        renderSavePresetBottomHTML(isUa) {
            return `
                <div class="theme-save-preset-bottom-section">
                    <button type="button" class="theme-save-preset-btn-large" id="theme-save-preset-btn">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        <span>${isUa ? 'Зберегти поточні кольори як новий пресет' : 'Save current colors as a new preset'}</span>
                    </button>

                    <div class="theme-preset-create-form" id="theme-preset-create-form" style="display: none;">
                        <input type="text" class="theme-preset-name-input" id="theme-preset-name-input" placeholder="${isUa ? 'Введіть назву пресету (наприклад: Мій Океан)...' : 'Preset name (e.g. My Ocean)...'}" maxlength="32" autocomplete="off" spellcheck="false">
                        <button type="button" class="theme-preset-submit-btn" id="theme-preset-submit-btn">${isUa ? 'Зберегти' : 'Save'}</button>
                        <button type="button" class="theme-preset-cancel-btn" id="theme-preset-cancel-btn">${isUa ? 'Скасувати' : 'Cancel'}</button>
                    </div>
                </div>
            `;
        },

        refreshPresetsGrid(modalOverlayEl) {
            if (!modalOverlayEl) modalOverlayEl = document.querySelector('.modal-overlay');
            if (!modalOverlayEl) return;
            const grid = modalOverlayEl.querySelector('#theme-presets-grid');
            if (!grid) return;
            const isUa = !window.App.i18n || (window.App.i18n.getLanguage && window.App.i18n.getLanguage() === 'ua');
            grid.innerHTML = this.renderPresetsCardsHTML(isUa);
            this.bindPresetCardEvents(modalOverlayEl);
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
                                <div class="theme-color-swatch-wrap" data-token-key="${token.key}" title="${isUa ? 'Відкрити палітру кольорів' : 'Open color picker'}" tabindex="0" role="button" aria-label="${tokenName}">
                                    <div class="theme-color-swatch-preview" style="background-color: ${currentColor};"></div>
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
                            <span class="theme-customizer-banner-title">${isUa ? 'Палітра оформлення інтерфейсу' : 'Interface Theme Palette'}</span>
                            <span class="theme-customizer-banner-desc">${isUa ? 'Керуйте глобальними кольорами сторінки або збережіть свій стиль' : 'Manage global theme colors or save your custom style'}</span>
                        </div>
                        <button type="button" class="theme-reset-all-btn" id="theme-reset-all-btn">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                                <path d="M3 3v5h5"></path>
                            </svg>
                            <span>${isUa ? 'Скинути всі' : 'Reset all'}</span>
                        </button>
                    </div>

                    ${this.renderPresetsSectionHTML(isUa)}

                    ${groupsHTML}

                    ${this.renderSavePresetBottomHTML(isUa)}
                </div>
            `;
        },

        bindPresetCardEvents(modalOverlayEl) {
            if (!modalOverlayEl) return;

            modalOverlayEl.querySelectorAll('.theme-preset-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.theme-preset-delete-btn')) return;
                    const id = card.getAttribute('data-preset-id');
                    this.applyPreset(id);
                });

                card.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        if (e.target.closest('.theme-preset-delete-btn')) return;
                        e.preventDefault();
                        const id = card.getAttribute('data-preset-id');
                        this.applyPreset(id);
                    }
                });
            });

            modalOverlayEl.querySelectorAll('.theme-preset-delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = btn.getAttribute('data-delete-id');
                    this.deletePreset(id);
                    this.refreshPresetsGrid(modalOverlayEl);
                    this.updateActivePresetBadges(modalOverlayEl);
                });
            });
        },

        bindPresetEvents(modalOverlayEl) {
            if (!modalOverlayEl) return;

            const saveBtn = modalOverlayEl.querySelector('#theme-save-preset-btn');
            const createForm = modalOverlayEl.querySelector('#theme-preset-create-form');
            const nameInput = modalOverlayEl.querySelector('#theme-preset-name-input');
            const submitBtn = modalOverlayEl.querySelector('#theme-preset-submit-btn');
            const cancelBtn = modalOverlayEl.querySelector('#theme-preset-cancel-btn');

            if (saveBtn && createForm) {
                saveBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!this.getCurrentUserId()) {
                        if (window.App.authModal && window.App.authModal.open) {
                            window.App.authModal.open(false);
                        }
                        return;
                    }
                    createForm.style.display = 'flex';
                    saveBtn.style.display = 'none';
                    if (nameInput) {
                        nameInput.value = '';
                        setTimeout(() => {
                            nameInput.focus();
                            createForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }, 50);
                    }
                });
            }

            const handleCreate = () => {
                if (!nameInput) return;
                const name = nameInput.value.trim();
                if (!name) {
                    nameInput.focus();
                    return;
                }
                const preset = this.saveCurrentAsPreset(name);
                if (preset) {
                    createForm.style.display = 'none';
                    if (saveBtn) saveBtn.style.display = 'flex';
                    nameInput.value = '';
                    this.refreshPresetsGrid(modalOverlayEl);
                    this.updateActivePresetBadges(modalOverlayEl);
                    const grid = modalOverlayEl.querySelector('#theme-presets-grid');
                    if (grid) {
                        grid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }
            };

            if (submitBtn) {
                submitBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleCreate();
                });
            }

            if (cancelBtn) {
                cancelBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (createForm) createForm.style.display = 'none';
                    if (saveBtn) saveBtn.style.display = 'flex';
                    if (nameInput) nameInput.value = '';
                });
            }

            if (nameInput) {
                nameInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreate();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        if (createForm) createForm.style.display = 'none';
                        if (saveBtn) saveBtn.style.display = 'flex';
                        nameInput.value = '';
                    }
                });
            }

            this.bindPresetCardEvents(modalOverlayEl);
        },

        bindEvents(modalOverlayEl) {
            if (!modalOverlayEl) return;

            // 1. Події системи пресетів
            this.bindPresetEvents(modalOverlayEl);

            // 2. Відкриття кастомного NothingNotes калорпікера по кліку на свотч
            const swatchWraps = modalOverlayEl.querySelectorAll('.theme-color-swatch-wrap');
            swatchWraps.forEach(wrap => {
                const handleOpenPicker = (e) => {
                    e.stopPropagation();
                    const key = wrap.getAttribute('data-token-key');
                    const row = wrap.closest('.theme-token-row');
                    const hexInput = row ? row.querySelector('.theme-hex-input') : null;
                    const currentHex = hexInput && isValidHex(hexInput.value) ? hexInput.value : '#16b981';

                    if (window.App.colorPickerPopover) {
                        window.App.colorPickerPopover.open({
                            anchorEl: wrap,
                            initialColor: currentHex,
                            onChange: (newHex) => {
                                this.setCustomColor(key, newHex);
                                this.updateTokenRowState(key, newHex);
                            },
                            onClose: (finalHex) => {
                                if (finalHex && isValidHex(finalHex)) {
                                    this.setCustomColor(key, finalHex);
                                    this.updateTokenRowState(key, finalHex);
                                }
                            }
                        });
                    }
                };

                wrap.addEventListener('click', handleOpenPicker);
                wrap.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenPicker(e);
                    }
                });
            });

            // 3. Редагування кольору через поле введення HEX
            const hexInputs = modalOverlayEl.querySelectorAll('.theme-hex-input');
            hexInputs.forEach(input => {
                input.addEventListener('input', (e) => {
                    let hex = e.target.value.trim();
                    if (!hex.startsWith('#')) hex = '#' + hex;
                    if (isValidHex(hex)) {
                        const key = input.getAttribute('data-token-key');
                        this.setCustomColor(key, hex);
                        this.updateTokenRowState(key, hex);
                        if (window.App.colorPickerPopover && window.App.colorPickerPopover.isOpen()) {
                            window.App.colorPickerPopover.updateColor(hex);
                        }
                    }
                });

                input.addEventListener('change', (e) => {
                    let hex = e.target.value.trim();
                    if (!hex.startsWith('#')) hex = '#' + hex;
                    if (isValidHex(hex)) {
                        const key = input.getAttribute('data-token-key');
                        this.setCustomColor(key, hex);
                        this.updateTokenRowState(key, hex);
                    }
                });
            });

            // 4. Скинути всі кольори до стандартних
            const resetAllBtn = modalOverlayEl.querySelector('#theme-reset-all-btn');
            if (resetAllBtn) {
                resetAllBtn.addEventListener('click', () => {
                    this.resetAll();
                });
            }

            // 5. Скинути окремий колір
            const resetTokenBtns = modalOverlayEl.querySelectorAll('.theme-token-reset-btn');
            resetTokenBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const key = btn.getAttribute('data-reset-key');
                    this.resetToken(key);
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
