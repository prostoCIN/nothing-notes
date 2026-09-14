// js/dom.js - Отримання DOM елементів
window.App = window.App || {};

window.App.getElements = function() {
    return {
        // Екрани
        welcomeScreen: document.getElementById('welcome-screen'),
        appContainer: document.getElementById('app-container'),

        // Екран привітання
        welcomeLoginBtn: document.getElementById('welcome-login-btn'),
        welcomeGuestBtn: document.getElementById('welcome-guest-btn'),

        // Сайдбар
        sidebar: document.getElementById('sidebar'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        mobileMenuBtn: document.getElementById('mobile-menu-btn'),
        sidebarCloseBtn: document.getElementById('sidebar-close-btn'),
        sidebarAddBoardBtn: document.getElementById('sidebar-add-board-btn'),
        sidebarNewBoardForm: document.getElementById('sidebar-new-board-form'),
        sidebarNewBoardInput: document.getElementById('sidebar-new-board-input'),
        sidebarBoardsList: document.getElementById('sidebar-boards-list'),
        sharedBoardsSection: document.getElementById('shared-boards-section'),
        sidebarSharedBoardsList: document.getElementById('sidebar-shared-boards-list'),
        addNoteBtn: document.getElementById('add-note-btn'),
        notesList: document.getElementById('notes-list'),

        // Робоча область
        boardWorkspace: document.getElementById('board-workspace'),
        columnsContainer: document.getElementById('columns-container')
    };
};

// Уніфіковані утиліти для Drag & Drop (FLIP анімація, плавний автоскрол)
window.App.dragUtils = {
    /**
     * Плавна анімація FLIP (First, Last, Invert, Play) для перевпорядкованих елементів
     * @param {HTMLElement[]} elements - Масив DOM-елементів для анімації
     * @param {Map<HTMLElement, DOMRect>} oldPositionsMap - Попередні координати до DOM-мутації
     * @param {number} [duration=200] - Тривалість анімації в мілісекундах
     */
    animateFLIP(elements, oldPositionsMap, duration = 200) {
        if (!elements || !oldPositionsMap) return;
        elements.forEach(element => {
            const oldRect = oldPositionsMap.get(element);
            if (!oldRect) return;
            const newRect = element.getBoundingClientRect();
            const dx = oldRect.left - newRect.left;
            const dy = oldRect.top - newRect.top;

            if (dx !== 0 || dy !== 0) {
                element.style.transition = 'none';
                element.style.transform = `translate(${dx}px, ${dy}px)`;
                requestAnimationFrame(() => {
                    element.style.transition = `transform ${duration}ms cubic-bezier(0.2, 0, 0, 1)`;
                    element.style.transform = '';
                });
            }
        });
    },

    /**
     * Створює автоскролер для контейнера при наближенні курсору до меж
     * @param {HTMLElement} container - Контейнер для прокрутки
     * @param {Object} [options={}] - Опції (edgeThreshold, maxSpeed, horizontal, vertical)
     * @returns {Object} { update(x, y), start(onScroll), stop() }
     */
    createAutoScroller(target, options = {}) {
        if (!target) return { update() {}, start() {}, stop() {} };

        const getContainer = typeof target === 'function' ? target : () => target;
        const edgeThreshold = options.edgeThreshold || 70;
        const maxSpeed = options.maxSpeed || 20;
        const allowVertical = options.vertical !== false;
        const allowHorizontal = options.horizontal === true;

        let rafId = null;
        let lastX = 0;
        let lastY = 0;
        let onScrollCb = null;
        let isActive = false;

        const loop = () => {
            if (!isActive) return;
            const container = getContainer();
            if (!container) {
                rafId = requestAnimationFrame(loop);
                return;
            }

            const rect = container.getBoundingClientRect();
            let scrolled = false;
            const isInsideX = lastX >= rect.left - 30 && lastX <= rect.right + 30;
            const isInsideY = lastY >= rect.top - 30 && lastY <= rect.bottom + 30;

            // Вертикальний автоскрол
            if (allowVertical && isInsideX) {
                if (lastY < rect.top + edgeThreshold && lastY >= rect.top - 30) {
                    const dist = (rect.top + edgeThreshold) - lastY;
                    const speed = Math.min(maxSpeed, Math.max(3, (dist / edgeThreshold) * maxSpeed));
                    if (container.scrollTop > 0) {
                        container.scrollTop -= speed;
                        scrolled = true;
                    }
                } else if (lastY > rect.bottom - edgeThreshold && lastY <= rect.bottom + 30) {
                    const dist = lastY - (rect.bottom - edgeThreshold);
                    const speed = Math.min(maxSpeed, Math.max(3, (dist / edgeThreshold) * maxSpeed));
                    const maxScroll = container.scrollHeight - container.clientHeight;
                    if (container.scrollTop < maxScroll) {
                        container.scrollTop += speed;
                        scrolled = true;
                    }
                }
            }

            // Горизонтальний автоскрол
            if (allowHorizontal && isInsideY) {
                if (lastX < rect.left + edgeThreshold && lastX >= rect.left - 30) {
                    const dist = (rect.left + edgeThreshold) - lastX;
                    const speed = Math.min(maxSpeed, Math.max(3, (dist / edgeThreshold) * maxSpeed));
                    if (container.scrollLeft > 0) {
                        container.scrollLeft -= speed;
                        scrolled = true;
                    }
                } else if (lastX > rect.right - edgeThreshold && lastX <= rect.right + 30) {
                    const dist = lastX - (rect.right - edgeThreshold);
                    const speed = Math.min(maxSpeed, Math.max(3, (dist / edgeThreshold) * maxSpeed));
                    const maxScroll = container.scrollWidth - container.clientWidth;
                    if (container.scrollLeft < maxScroll) {
                        container.scrollLeft += speed;
                        scrolled = true;
                    }
                }
            }

            if (scrolled && onScrollCb) {
                onScrollCb(lastX, lastY);
            }

            rafId = requestAnimationFrame(loop);
        };

        return {
            update(clientX, clientY) {
                lastX = clientX;
                lastY = clientY;
            },
            start(callback) {
                if (isActive) return;
                isActive = true;
                onScrollCb = callback || null;
                rafId = requestAnimationFrame(loop);
            },
            stop() {
                isActive = false;
                if (rafId) {
                    cancelAnimationFrame(rafId);
                    rafId = null;
                }
            }
        };
    }
};
