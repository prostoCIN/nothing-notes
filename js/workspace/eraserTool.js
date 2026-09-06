// js/workspace/eraserTool.js - Інструмент швидкої гумки маркерів у хедері
window.App = window.App || {};

(function() {
    window.App.eraserTool = {
        init() {
            this.bindEvents();
        },

        isActive() {
            return document.body.classList.contains('global-eraser-active');
        },

        enable() {
            // Якщо увімкнений пензель — вимикаємо його
            if (window.App.brushTool && window.App.brushTool.isActive()) {
                window.App.brushTool.disable();
            } else if (document.body.classList.contains('highlighter-brush-active')) {
                document.body.classList.remove('highlighter-brush-active');
                const brushBtn = document.getElementById('workspace-brush-btn');
                if (brushBtn) brushBtn.classList.remove('active');
            }

            document.body.classList.add('global-eraser-active');
            const eraserBtn = document.getElementById('workspace-eraser-btn');
            if (eraserBtn) eraserBtn.classList.add('active');
        },

        disable() {
            document.body.classList.remove('global-eraser-active');
            const eraserBtn = document.getElementById('workspace-eraser-btn');
            if (eraserBtn) eraserBtn.classList.remove('active');
        },

        toggle(enable) {
            const isCurrentlyActive = this.isActive();
            const shouldBeActive = (typeof enable === 'boolean') ? enable : !isCurrentlyActive;
            if (shouldBeActive) {
                this.enable();
            } else {
                this.disable();
            }
        },

        bindEvents() {
            const eraserBtn = document.getElementById('workspace-eraser-btn');
            if (eraserBtn) {
                eraserBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.toggle();
                });
            }

            // Робота гумки по виділенню тексту мишею
            document.addEventListener('mouseup', (e) => {
                if (!this.isActive()) return;
                const contentDiv = e.target.closest('.sticker-content');
                if (!contentDiv) return;

                const selection = window.getSelection();
                if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    if (window.App.historyManager) {
                        window.App.historyManager.recordState('eraser_selection');
                    }

                    if (window.App.textSelectionToolbar) {
                        window.App.textSelectionToolbar.setActiveContentDiv(contentDiv);
                        window.App.textSelectionToolbar.clearMarkerFromRange(range);
                        window.App.textSelectionToolbar.syncChanges();
                    }

                    selection.removeAllRanges();
                }
            });

            // Вихід по Escape
            window.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isActive()) {
                    this.disable();
                }
            }, true);
        }
    };
})();
