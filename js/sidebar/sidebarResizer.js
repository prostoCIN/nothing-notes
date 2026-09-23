// js/sidebar/sidebarResizer.js - Інтерактивна зміна ширини лівої панелі (Sidebar Resizer)
window.App = window.App || {};

(function() {
    const STORAGE_KEY = 'notes_sidebar_width';
    const DEFAULT_WIDTH = 260;
    const MIN_WIDTH = 200;
    const MAX_WIDTH_CAP = 600;

    let isResizing = false;
    let startX = 0;
    let startWidth = DEFAULT_WIDTH;
    let currentWidth = DEFAULT_WIDTH;
    let activePointerId = null;
    let rAFId = null;

    function getMaxAllowedWidth() {
        return Math.min(MAX_WIDTH_CAP, Math.max(MIN_WIDTH, Math.floor(window.innerWidth * 0.55)));
    }

    function clampWidth(width) {
        const maxWidth = getMaxAllowedWidth();
        return Math.max(MIN_WIDTH, Math.min(width, maxWidth));
    }

    function applyWidth(width, saveToStorage = false) {
        currentWidth = clampWidth(width);
        document.documentElement.style.setProperty('--sidebar-width', `${currentWidth}px`);

        const els = window.App.getElements ? window.App.getElements() : null;
        if (els && els.sidebar) {
            els.sidebar.style.width = `${currentWidth}px`;
        }

        const resizer = document.getElementById('sidebar-resizer');
        if (resizer) {
            resizer.setAttribute('aria-valuenow', currentWidth.toString());
        }

        if (saveToStorage) {
            try {
                localStorage.setItem(STORAGE_KEY, currentWidth.toString());
            } catch (e) {}
        }
    }

    function restoreSavedWidth() {
        if (window.innerWidth <= 768) return;
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = parseInt(saved, 10);
                if (!isNaN(parsed) && parsed >= MIN_WIDTH) {
                    applyWidth(parsed, false);
                    return;
                }
            }
        } catch (e) {}
        applyWidth(DEFAULT_WIDTH, false);
    }

    function resetToDefault() {
        applyWidth(DEFAULT_WIDTH, true);
        notifyResize();
    }

    function notifyResize() {
        window.dispatchEvent(new Event('resize'));
        if (window.App.state && window.App.state.isGraphView && window.App.graphView && window.App.graphView.resizeCanvas) {
            window.App.graphView.resizeCanvas();
        }
    }

    function onPointerDown(e) {
        if (window.innerWidth <= 768) return;
        if (e.button !== 0) return; // Тільки ліва кнопка миші

        isResizing = true;
        activePointerId = e.pointerId;
        startX = e.clientX;

        const els = window.App.getElements ? window.App.getElements() : null;
        startWidth = (els && els.sidebar) ? els.sidebar.getBoundingClientRect().width : currentWidth;

        try {
            e.target.setPointerCapture(e.pointerId);
        } catch (err) {}

        document.body.classList.add('is-sidebar-resizing');
        document.addEventListener('pointermove', onPointerMove, { passive: false });
        document.addEventListener('pointerup', onPointerUp);
        document.addEventListener('pointercancel', onPointerUp);

        e.preventDefault();
    }

    function onPointerMove(e) {
        if (!isResizing) return;
        if (activePointerId !== null && e.pointerId !== activePointerId) return;

        const deltaX = e.clientX - startX;
        const targetWidth = startWidth + deltaX;

        if (rAFId) cancelAnimationFrame(rAFId);
        rAFId = requestAnimationFrame(() => {
            applyWidth(targetWidth, false);
            if (window.App.state && window.App.state.isGraphView && window.App.graphView && window.App.graphView.resizeCanvas) {
                window.App.graphView.resizeCanvas();
            }
        });

        e.preventDefault();
    }

    function onPointerUp(e) {
        if (!isResizing) return;
        if (activePointerId !== null && e.pointerId !== activePointerId) return;

        isResizing = false;
        activePointerId = null;

        if (rAFId) {
            cancelAnimationFrame(rAFId);
            rAFId = null;
        }

        document.body.classList.remove('is-sidebar-resizing');
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('pointercancel', onPointerUp);

        try {
            const resizer = document.getElementById('sidebar-resizer');
            if (resizer && resizer.hasPointerCapture && resizer.hasPointerCapture(e.pointerId)) {
                resizer.releasePointerCapture(e.pointerId);
            }
        } catch (err) {}

        applyWidth(currentWidth, true);
        notifyResize();
    }

    function onKeyDown(e) {
        if (window.innerWidth <= 768) return;
        const step = e.shiftKey ? 50 : 15;

        if (e.key === 'ArrowLeft') {
            applyWidth(currentWidth - step, true);
            notifyResize();
            e.preventDefault();
        } else if (e.key === 'ArrowRight') {
            applyWidth(currentWidth + step, true);
            notifyResize();
            e.preventDefault();
        } else if (e.key === 'Home' || e.key === 'Enter') {
            resetToDefault();
            e.preventDefault();
        }
    }

    // Відновлюємо ширину одразу при завантаженні скрипта, щоб запобігти зсуву верстки
    restoreSavedWidth();

    window.App.sidebarResizer = {
        init() {
            restoreSavedWidth();

            const resizer = document.getElementById('sidebar-resizer');
            if (!resizer) return;

            resizer.setAttribute('aria-valuemin', MIN_WIDTH.toString());
            resizer.setAttribute('aria-valuemax', MAX_WIDTH_CAP.toString());
            resizer.setAttribute('aria-valuenow', currentWidth.toString());

            resizer.addEventListener('pointerdown', onPointerDown);
            resizer.addEventListener('dblclick', (e) => {
                e.preventDefault();
                resetToDefault();
            });
            resizer.addEventListener('keydown', onKeyDown);

            // Автоматично адаптуємо ширину сайдбара при зміні розміру вікна браузера
            window.addEventListener('resize', () => {
                if (window.innerWidth > 768) {
                    const maxWidth = getMaxAllowedWidth();
                    if (currentWidth > maxWidth) {
                        applyWidth(maxWidth, false);
                    }
                }
            });
        },

        getCurrentWidth() {
            return currentWidth;
        },

        setWidth(width) {
            applyWidth(width, true);
            notifyResize();
        },

        reset() {
            resetToDefault();
        }
    };
})();
