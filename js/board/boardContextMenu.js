// js/board/boardContextMenu.js - Контекстне меню полотна для створення нотаток
window.App = window.App || {};

(function() {
    let menuEl = null;
    let boundClose = null;

    window.App.boardContextMenu = {
        show(clientX, clientY, worldX, worldY, callbacks = {}) {
            this.close();

            const { onCreateNote, onAutoLayout, onResetZoom } = callbacks;

            menuEl = document.createElement('div');
            menuEl.className = 'board-canvas-context-menu';
            menuEl.style.left = Math.min(window.innerWidth - 220, clientX) + 'px';
            menuEl.style.top = Math.min(window.innerHeight - 180, clientY) + 'px';

            menuEl.innerHTML = `
                <button class="board-canvas-context-item is-primary" id="ctx-create-note-btn">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="9"></circle>
                        <line x1="12" y1="8" x2="12" y2="16"></line>
                        <line x1="8" y1="12" x2="16" y2="12"></line>
                    </svg>
                    <span>Створити нотатку тут</span>
                </button>
                <div class="board-canvas-context-divider"></div>
                <button class="board-canvas-context-item" id="ctx-layout-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="7" height="7"></rect>
                        <rect x="14" y="3" width="7" height="7"></rect>
                        <rect x="14" y="14" width="7" height="7"></rect>
                        <rect x="3" y="14" width="7" height="7"></rect>
                    </svg>
                    <span>Впорядкувати стікери</span>
                </button>
                <button class="board-canvas-context-item" id="ctx-reset-zoom-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M15 3h6v6"></path>
                        <path d="M9 21H3v-6"></path>
                        <path d="M21 3l-7 7"></path>
                        <path d="M3 21l7-7"></path>
                    </svg>
                    <span>Скинути масштаб</span>
                </button>
            `;

            document.body.appendChild(menuEl);

            const createBtn = menuEl.querySelector('#ctx-create-note-btn');
            const layoutBtn = menuEl.querySelector('#ctx-layout-btn');
            const resetBtn = menuEl.querySelector('#ctx-reset-zoom-btn');

            if (createBtn) {
                createBtn.addEventListener('click', () => {
                    this.close();
                    if (typeof onCreateNote === 'function') onCreateNote(worldX, worldY);
                });
            }

            if (layoutBtn) {
                layoutBtn.addEventListener('click', () => {
                    this.close();
                    if (typeof onAutoLayout === 'function') onAutoLayout();
                });
            }

            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    this.close();
                    if (typeof onResetZoom === 'function') onResetZoom();
                });
            }

            boundClose = (e) => {
                if (menuEl && !menuEl.contains(e.target)) {
                    this.close();
                }
            };

            setTimeout(() => {
                document.addEventListener('pointerdown', boundClose);
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') this.close();
                }, { once: true });
            }, 10);
        },

        close() {
            if (boundClose) {
                document.removeEventListener('pointerdown', boundClose);
                boundClose = null;
            }
            if (menuEl && menuEl.parentNode) {
                menuEl.parentNode.removeChild(menuEl);
            }
            menuEl = null;
        }
    };
})();
