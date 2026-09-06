// js/workspace/brushTool.js - Інструмент швидкого маркування (Highlighter Brush) у хедері
window.App = window.App || {};

(function() {
    let activeBrushMarker = null; // 'hl-green' | 'hl-yellow' тощо або null
    let currentBrushColorClass = 'hl-green';

    const colorBgMap = {
        'hl-green': '#bbf7d0',
        'hl-yellow': '#fef08a',
        'hl-blue': '#bae6fd',
        'hl-pink': '#fbcfe8',
        'hl-orange': '#fed7aa',
        'hl-purple': '#e9d5ff'
    };

    window.App.brushTool = {
        init() {
            this.bindEvents();
        },

        isActive() {
            return !!activeBrushMarker;
        },

        getActiveMarker() {
            return activeBrushMarker;
        },

        getCurrentColorClass() {
            return currentBrushColorClass;
        },

        enable(markerClass = currentBrushColorClass) {
            // Якщо увімкнена гумка — вимикаємо її
            if (window.App.eraserTool && window.App.eraserTool.isActive()) {
                window.App.eraserTool.disable();
            } else if (document.body.classList.contains('global-eraser-active')) {
                document.body.classList.remove('global-eraser-active');
                const eraserBtn = document.getElementById('workspace-eraser-btn');
                if (eraserBtn) eraserBtn.classList.remove('active');
            }

            activeBrushMarker = markerClass;
            document.body.classList.add('highlighter-brush-active');
            const brushBtn = document.getElementById('workspace-brush-btn');
            if (brushBtn) brushBtn.classList.add('active');
        },

        disable() {
            activeBrushMarker = null;
            document.body.classList.remove('highlighter-brush-active');
            const brushBtn = document.getElementById('workspace-brush-btn');
            if (brushBtn) brushBtn.classList.remove('active');

            const colorDropdown = document.getElementById('workspace-brush-dropdown');
            if (colorDropdown) colorDropdown.classList.remove('active');
        },

        toggle() {
            if (this.isActive()) {
                this.disable();
            } else {
                this.enable(currentBrushColorClass);
            }
        },

        bindEvents() {
            const headerBrushBtn = document.getElementById('workspace-brush-btn');
            const colorTriggerBtn = document.getElementById('workspace-brush-color-btn');
            const colorDropdown = document.getElementById('workspace-brush-dropdown');
            const colorDot = document.getElementById('workspace-brush-color-dot');

            if (headerBrushBtn) {
                headerBrushBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (colorDropdown) colorDropdown.classList.remove('active');
                    this.toggle();
                });
            }

            if (colorTriggerBtn && colorDropdown) {
                colorTriggerBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    colorDropdown.classList.toggle('active');
                });

                colorDropdown.querySelectorAll('.brush-palette-item').forEach(item => {
                    item.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const colorClass = item.dataset.color;
                        currentBrushColorClass = colorClass;

                        // Оновлюємо активний стан елементів палітри
                        colorDropdown.querySelectorAll('.brush-palette-item').forEach(i => i.classList.remove('active'));
                        item.classList.add('active');

                        // Оновлюємо колір крапки
                        if (colorDot) {
                            colorDot.style.backgroundColor = colorBgMap[colorClass] || '#bbf7d0';
                        }

                        // Якщо режим пензля вже увімкнений — оновлюємо його колір
                        if (activeBrushMarker) {
                            activeBrushMarker = colorClass;
                        } else {
                            this.enable(colorClass);
                        }

                        colorDropdown.classList.remove('active');
                    });
                });

                document.addEventListener('pointerdown', (e) => {
                    if (!colorDropdown.contains(e.target) && !colorTriggerBtn.contains(e.target)) {
                        colorDropdown.classList.remove('active');
                    }
                });
            }

            // Клік/виділення тексту у режимі пензля: фарбування виділеного тексту
            document.addEventListener('mouseup', (e) => {
                if (!activeBrushMarker) return;
                const contentDiv = e.target.closest('.sticker-content');
                if (!contentDiv) return;

                const selection = window.getSelection();
                if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    if (window.App.historyManager) {
                        window.App.historyManager.recordState('brush_highlight');
                    }

                    if (window.App.textSelectionToolbar) {
                        window.App.textSelectionToolbar.setActiveContentDiv(contentDiv);
                        window.App.textSelectionToolbar.applyMarkerToRange(range, activeBrushMarker);
                        window.App.textSelectionToolbar.syncChanges();
                    }

                    selection.removeAllRanges();
                }
            });

            // Вихід по Escape
            window.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && (activeBrushMarker || (colorDropdown && colorDropdown.classList.contains('active')))) {
                    this.disable();
                }
            }, true);
        }
    };
})();
