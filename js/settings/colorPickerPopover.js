// js/settings/colorPickerPopover.js - Кастомний калорпікер у стилі Nothing / Dark Forest
window.App = window.App || {};

(function() {
    const PRESET_COLORS = [
        '#1D1E19', // Forest Dark
        '#272822', // Olive Surface
        '#32332C', // Elevated
        '#141416', // Asphalt
        '#0F172A', // Obsidian
        '#FFFFFF', // White
        '#16B981', // Nothing Emerald
        '#A6E22E', // Mint
        '#F92672', // Crimson
        '#F59E0B', // Amber
        '#38BDF8', // Sky
        '#A855F7'  // Violet
    ];

    function hexToRgb(hex) {
        if (!hex || typeof hex !== 'string') return { r: 0, g: 0, b: 0 };
        let c = hex.replace('#', '').trim();
        if (c.length === 3) {
            c = c.split('').map(x => x + x).join('');
        }
        if (c.length !== 6) return { r: 0, g: 0, b: 0 };
        const num = parseInt(c, 16);
        if (isNaN(num)) return { r: 0, g: 0, b: 0 };
        return {
            r: (num >> 16) & 255,
            g: (num >> 8) & 255,
            b: num & 255
        };
    }

    function rgbToHex(r, g, b) {
        const toHex = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
        return '#' + toHex(r) + toHex(g) + toHex(b);
    }

    function rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const d = max - min;
        let h = 0;
        const s = max === 0 ? 0 : d / max;
        const v = max;
        if (d !== 0) {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h * 360, s, v };
    }

    function hsvToRgb(h, s, v) {
        let r, g, b;
        const i = Math.floor((h / 60) % 6);
        const f = (h / 60) - Math.floor(h / 60);
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        switch (i) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
            default: r = 0; g = 0; b = 0; break;
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    function isValidHex(hex) {
        return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);
    }

    function normalizeHex(hex) {
        if (!hex.startsWith('#')) hex = '#' + hex;
        if (hex.length === 4) {
            hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }
        return hex.toLowerCase();
    }

    let activeInstance = null;

    const colorPickerPopover = {
        PRESET_COLORS,
        hexToRgb,
        rgbToHex,
        rgbToHsv,
        hsvToRgb,
        isValidHex,
        normalizeHex,

        isOpen() {
            return Boolean(activeInstance);
        },

        close() {
            if (!activeInstance) return;
            const inst = activeInstance;
            activeInstance = null;

            if (inst.anchorEl) {
                inst.anchorEl.classList.remove('is-active-swatch');
            }

            if (inst.cleanupListeners) {
                inst.cleanupListeners();
            }

            if (inst.popoverEl && inst.popoverEl.parentNode) {
                inst.popoverEl.parentNode.removeChild(inst.popoverEl);
            }

            if (typeof inst.onClose === 'function') {
                inst.onClose(inst.currentHex);
            }
        },

        open({ anchorEl, initialColor = '#16b981', onChange, onClose }) {
            // Закриваємо попередній, якщо він відкритий
            if (activeInstance) {
                const wasSameAnchor = activeInstance.anchorEl === anchorEl;
                this.close();
                if (wasSameAnchor) return; // повторний клік на той самий свотч закриває його
            }

            const isUa = !window.App.i18n || (window.App.i18n.getLanguage && window.App.i18n.getLanguage() === 'ua');
            const cleanHex = isValidHex(initialColor) ? normalizeHex(initialColor) : '#16b981';
            const rgb = hexToRgb(cleanHex);
            const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);

            let currentHue = hsv.h;
            let currentSat = hsv.s;
            let currentVal = hsv.v;
            let currentHex = cleanHex;

            const popoverEl = document.createElement('div');
            popoverEl.className = 'ncp-popover';
            popoverEl.setAttribute('role', 'dialog');
            popoverEl.setAttribute('aria-label', isUa ? 'Вибір кольору' : 'Color Picker');

            const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

            // Генеруємо сітку пресетів
            const presetsHTML = PRESET_COLORS.map(color => {
                const isActive = color.toLowerCase() === currentHex.toLowerCase();
                return `
                    <button type="button" class="ncp-preset-item ${isActive ? 'active' : ''}" 
                            data-color="${color}" 
                            style="background-color: ${color};" 
                            title="${color}">
                    </button>
                `;
            }).join('');

            popoverEl.innerHTML = `
                <div class="ncp-canvas-wrap">
                    <div class="ncp-canvas-bg"></div>
                    <div class="ncp-canvas-thumb"></div>
                </div>

                <div class="ncp-hue-wrap">
                    <div class="ncp-hue-thumb"></div>
                </div>

                <div class="ncp-presets">
                    ${presetsHTML}
                </div>

                <div class="ncp-footer">
                    <div class="ncp-preview" style="background-color: ${currentHex};"></div>
                    ${hasEyeDropper ? `
                        <button type="button" class="ncp-eyedropper-btn" title="${isUa ? 'Піпетка' : 'EyeDropper'}">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="m2 22 1-1h3l9-9"></path>
                                <path d="M3 21v-3l9-9"></path>
                                <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9"></path>
                            </svg>
                        </button>
                    ` : ''}
                    <div class="ncp-input-wrap">
                        <span class="ncp-hash">#</span>
                        <input type="text" class="ncp-hex-input" value="${currentHex.replace('#', '').toUpperCase()}" maxlength="6" spellcheck="false">
                    </div>
                    <button type="button" class="ncp-copy-btn" title="${isUa ? 'Скопіювати HEX' : 'Copy HEX'}">
                        <svg class="ncp-copy-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
                        </svg>
                        <svg class="ncp-check-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:none; color:var(--accent-color);">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </button>
                </div>
            `;

            document.body.appendChild(popoverEl);

            if (anchorEl) {
                anchorEl.classList.add('is-active-swatch');
            }

            // Елементи інтерфейсу
            const canvasWrap = popoverEl.querySelector('.ncp-canvas-wrap');
            const canvasThumb = popoverEl.querySelector('.ncp-canvas-thumb');
            const hueWrap = popoverEl.querySelector('.ncp-hue-wrap');
            const hueThumb = popoverEl.querySelector('.ncp-hue-thumb');
            const previewEl = popoverEl.querySelector('.ncp-preview');
            const hexInput = popoverEl.querySelector('.ncp-hex-input');
            const eyedropperBtn = popoverEl.querySelector('.ncp-eyedropper-btn');
            const copyBtn = popoverEl.querySelector('.ncp-copy-btn');
            const presetBtns = popoverEl.querySelectorAll('.ncp-preset-item');

            // Оновлення положення елементів інтерфейсу
            function syncUI(notify = true) {
                const rgbVal = hsvToRgb(currentHue, currentSat, currentVal);
                currentHex = rgbToHex(rgbVal.r, rgbVal.g, rgbVal.b).toLowerCase();

                if (activeInstance) {
                    activeInstance.currentHex = currentHex;
                }

                // Положення та колір 2D полотна
                canvasWrap.style.backgroundColor = `hsl(${Math.round(currentHue)}, 100%, 50%)`;
                canvasThumb.style.left = `${(currentSat * 100).toFixed(1)}%`;
                canvasThumb.style.top = `${((1 - currentVal) * 100).toFixed(1)}%`;
                canvasThumb.style.backgroundColor = currentHex;

                // Положення повзунка Hue
                hueThumb.style.left = `${((currentHue / 360) * 100).toFixed(1)}%`;

                // Прев'ю та інпут
                previewEl.style.backgroundColor = currentHex;
                if (document.activeElement !== hexInput) {
                    hexInput.value = currentHex.replace('#', '').toUpperCase();
                }

                // Активний пресет
                presetBtns.forEach(btn => {
                    const c = btn.getAttribute('data-color').toLowerCase();
                    btn.classList.toggle('active', c === currentHex);
                });

                if (notify && typeof onChange === 'function') {
                    onChange(currentHex);
                }
            }

            // Позиціонування відносно anchorEl
            function updatePosition() {
                if (!anchorEl) return;
                const rect = anchorEl.getBoundingClientRect();
                const popRect = popoverEl.getBoundingClientRect();
                const margin = 10;

                let left = rect.right + 10;
                let top = rect.top - 20;

                // Якщо праворуч не вистачає місця — розміщуємо ліворуч
                if (left + popRect.width + margin > window.innerWidth) {
                    left = rect.left - popRect.width - 10;
                }

                // Якщо і ліворуч виходить за межі — центруємо/обмежуємо
                if (left < margin) {
                    left = Math.max(margin, (window.innerWidth - popRect.width) / 2);
                }

                // Вертикальне обмеження
                if (top + popRect.height + margin > window.innerHeight) {
                    top = window.innerHeight - popRect.height - margin;
                }
                if (top < margin) {
                    top = margin;
                }

                popoverEl.style.left = `${Math.round(left)}px`;
                popoverEl.style.top = `${Math.round(top)}px`;
            }

            syncUI(false);
            updatePosition();

            // 1. Dragging по 2D Canvas (Saturation & Value)
            let isDraggingCanvas = false;
            function updateFromCanvasEvent(e) {
                const rect = canvasWrap.getBoundingClientRect();
                let x = (e.clientX - rect.left) / rect.width;
                let y = (e.clientY - rect.top) / rect.height;
                x = Math.max(0, Math.min(1, x));
                y = Math.max(0, Math.min(1, y));
                currentSat = x;
                currentVal = 1 - y;
                syncUI(true);
            }

            canvasWrap.addEventListener('pointerdown', (e) => {
                isDraggingCanvas = true;
                canvasWrap.setPointerCapture(e.pointerId);
                updateFromCanvasEvent(e);
            });

            canvasWrap.addEventListener('pointermove', (e) => {
                if (isDraggingCanvas) updateFromCanvasEvent(e);
            });

            const onCanvasPointerUp = (e) => {
                if (isDraggingCanvas) {
                    isDraggingCanvas = false;
                    try { canvasWrap.releasePointerCapture(e.pointerId); } catch (_) {}
                }
            };
            canvasWrap.addEventListener('pointerup', onCanvasPointerUp);
            canvasWrap.addEventListener('pointercancel', onCanvasPointerUp);

            // 2. Dragging по Hue slider
            let isDraggingHue = false;
            function updateFromHueEvent(e) {
                const rect = hueWrap.getBoundingClientRect();
                let x = (e.clientX - rect.left) / rect.width;
                x = Math.max(0, Math.min(1, x));
                currentHue = x * 360;
                if (currentHue >= 360) currentHue = 359.99;
                syncUI(true);
            }

            hueWrap.addEventListener('pointerdown', (e) => {
                isDraggingHue = true;
                hueWrap.setPointerCapture(e.pointerId);
                updateFromHueEvent(e);
            });

            hueWrap.addEventListener('pointermove', (e) => {
                if (isDraggingHue) updateFromHueEvent(e);
            });

            const onHuePointerUp = (e) => {
                if (isDraggingHue) {
                    isDraggingHue = false;
                    try { hueWrap.releasePointerCapture(e.pointerId); } catch (_) {}
                }
            };
            hueWrap.addEventListener('pointerup', onHuePointerUp);
            hueWrap.addEventListener('pointercancel', onHuePointerUp);

            // 3. Кліки по пресетах
            presetBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const color = btn.getAttribute('data-color');
                    const rgbP = hexToRgb(color);
                    const hsvP = rgbToHsv(rgbP.r, rgbP.g, rgbP.b);
                    currentHue = hsvP.h;
                    currentSat = hsvP.s;
                    currentVal = hsvP.v;
                    syncUI(true);
                });
            });

            // 4. Ручне редагування HEX інпуту
            hexInput.addEventListener('input', () => {
                let val = hexInput.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                hexInput.value = val.toUpperCase();
                if (val.length === 3 || val.length === 6) {
                    const fullHex = normalizeHex('#' + val);
                    const rgbP = hexToRgb(fullHex);
                    const hsvP = rgbToHsv(rgbP.r, rgbP.g, rgbP.b);
                    currentHue = hsvP.h;
                    currentSat = hsvP.s;
                    currentVal = hsvP.v;
                    syncUI(true);
                }
            });

            // 5. Піпетка (EyeDropper API)
            if (eyedropperBtn) {
                eyedropperBtn.addEventListener('click', async () => {
                    if (window.EyeDropper) {
                        try {
                            const dropper = new window.EyeDropper();
                            const res = await dropper.open();
                            if (res && res.sRGBHex) {
                                const fullHex = normalizeHex(res.sRGBHex);
                                const rgbP = hexToRgb(fullHex);
                                const hsvP = rgbToHsv(rgbP.r, rgbP.g, rgbP.b);
                                currentHue = hsvP.h;
                                currentSat = hsvP.s;
                                currentVal = hsvP.v;
                                syncUI(true);
                            }
                        } catch (err) {
                            // Скасовано користувачем
                        }
                    }
                });
            }

            // 6. Копіювання HEX
            if (copyBtn) {
                copyBtn.addEventListener('click', () => {
                    const text = currentHex.toUpperCase();
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(text);
                    }
                    const copyIcon = copyBtn.querySelector('.ncp-copy-icon');
                    const checkIcon = copyBtn.querySelector('.ncp-check-icon');
                    if (copyIcon && checkIcon) {
                        copyIcon.style.display = 'none';
                        checkIcon.style.display = 'block';
                        setTimeout(() => {
                            copyIcon.style.display = 'block';
                            checkIcon.style.display = 'none';
                        }, 1200);
                    }
                });
            }

            // 7. Закриття по кліку зовні та Esc
            const onDocPointerDown = (e) => {
                if (popoverEl.contains(e.target) || (anchorEl && anchorEl.contains(e.target))) {
                    return;
                }
                colorPickerPopover.close();
            };

            const onDocKeyDown = (e) => {
                if (e.key === 'Escape') {
                    colorPickerPopover.close();
                }
            };

            const onWindowResize = () => {
                updatePosition();
            };

            // Додаємо з невеликою затримкою, щоб клік-відкриття не спрацював як клік зовні
            setTimeout(() => {
                document.addEventListener('pointerdown', onDocPointerDown);
                document.addEventListener('keydown', onDocKeyDown);
                window.addEventListener('resize', onWindowResize);
                window.addEventListener('scroll', onWindowResize, true);
            }, 0);

            const cleanupListeners = () => {
                document.removeEventListener('pointerdown', onDocPointerDown);
                document.removeEventListener('keydown', onDocKeyDown);
                window.removeEventListener('resize', onWindowResize);
                window.removeEventListener('scroll', onWindowResize, true);
            };

            activeInstance = {
                anchorEl,
                popoverEl,
                cleanupListeners,
                onClose,
                _currentHex: currentHex,
                get currentHex() {
                    return this._currentHex;
                },
                set currentHex(val) {
                    this._currentHex = val;
                },
                updateColor(hex) {
                    if (isValidHex(hex)) {
                        const fullHex = normalizeHex(hex);
                        const rgbP = hexToRgb(fullHex);
                        const hsvP = rgbToHsv(rgbP.r, rgbP.g, rgbP.b);
                        currentHue = hsvP.h;
                        currentSat = hsvP.s;
                        currentVal = hsvP.v;
                        currentHex = fullHex;
                        if (activeInstance) activeInstance.currentHex = fullHex;
                        syncUI(false);
                    }
                }
            };
        }
    };

    window.App.colorPickerPopover = colorPickerPopover;
})();
