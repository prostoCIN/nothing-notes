// js/sidebar/sidebarSwipe.js - Управління свайпом вліво для виклику службових кнопок на мобільних (Telegram / iOS стиль)
window.App = window.App || {};

(function() {
    let activeSwipedItem = null;

    function closeActiveSwipe() {
        if (activeSwipedItem) {
            activeSwipedItem.classList.remove('is-swiped');
            const content = activeSwipedItem.querySelector('.board-item-name, .note-item-title');
            if (content) content.style.transform = '';
            activeSwipedItem = null;
        }
    }

    // Закриття відкритого свайпу при кліку за межами плашки
    document.addEventListener('pointerdown', (e) => {
        if (activeSwipedItem && !activeSwipedItem.contains(e.target)) {
            closeActiveSwipe();
        }
    }, { passive: true });

    // Закриття відкритого свайпу при скролі списку
    window.addEventListener('scroll', () => {
        if (activeSwipedItem) closeActiveSwipe();
    }, { capture: true, passive: true });

    window.App.sidebarSwipe = {
        closeAll() {
            closeActiveSwipe();
        },

        attachSwipe(el) {
            if (!el) return;

            let startX = 0;
            let startY = 0;
            let currentX = 0;
            let isSwiping = false;
            let isScrolling = false;
            let touchStarted = false;

            const onTouchStart = (e) => {
                if (window.innerWidth > 768) return;
                const touch = e.touches[0];
                if (!touch) return;

                // Якщо зараз триває інлайн-редагування назви — не свайпаємо
                if (el.classList.contains('is-editing') || el.querySelector('[contenteditable="true"]')) return;

                // Якщо клікнули безпосередньо по кнопці дій, ручці перетягування чи стрілочці розгортання — ігноруємо
                if (
                    e.target.closest('.board-actions, .note-actions') || 
                    e.target.closest('.note-toggle-arrow') || 
                    e.target.closest('.board-drag-handle') || 
                    el.classList.contains('touch-drag-active') || 
                    el.classList.contains('is-board-dragging') || 
                    el.classList.contains('is-dragging') || 
                    document.body.classList.contains('is-sidebar-dragging')
                ) {
                    return;
                }

                startX = touch.clientX;
                startY = touch.clientY;
                currentX = startX;
                isSwiping = false;
                isScrolling = false;
                touchStarted = true;

                // Закриваємо попередньо відкриту іншу плашку
                if (activeSwipedItem && activeSwipedItem !== el) {
                    closeActiveSwipe();
                }
            };

            const onTouchMove = (e) => {
                if (!touchStarted) return;
                const touch = e.touches[0];
                if (!touch) return;

                const deltaX = touch.clientX - startX;
                const deltaY = touch.clientY - startY;

                // Визначаємо намір користувача на початку руху
                if (!isSwiping && !isScrolling) {
                    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 7) {
                        isScrolling = true;
                        return;
                    }
                    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
                        isSwiping = true;
                    }
                }

                if (isScrolling) return;

                if (isSwiping) {
                    // Блокуємо вертикальне тремтіння сторінки при горизонтальному свайпі
                    if (e.cancelable) e.preventDefault();

                    const isCurrentlySwiped = el.classList.contains('is-swiped');
                    if (!isCurrentlySwiped) {
                        // Тягнемо вліво (від'ємний deltaX)
                        if (deltaX < -30) {
                            el.classList.add('is-swiped');
                            activeSwipedItem = el;
                        }
                    } else {
                        // Якщо вже відкрито і тягнемо вправо — закриваємо
                        if (deltaX > 25) {
                            el.classList.remove('is-swiped');
                            if (activeSwipedItem === el) activeSwipedItem = null;
                        }
                    }
                }
            };

            const onTouchEnd = (e) => {
                if (!touchStarted) return;
                touchStarted = false;

                if (isSwiping) {
                    const endX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : currentX;
                    const deltaX = endX - startX;
                    const isCurrentlySwiped = el.classList.contains('is-swiped');

                    if (!isCurrentlySwiped) {
                        if (deltaX < -30) {
                            el.classList.add('is-swiped');
                            activeSwipedItem = el;
                        } else {
                            el.classList.remove('is-swiped');
                        }
                    } else {
                        if (deltaX > 25) {
                            el.classList.remove('is-swiped');
                            if (activeSwipedItem === el) activeSwipedItem = null;
                        } else {
                            el.classList.add('is-swiped');
                            activeSwipedItem = el;
                        }
                    }
                }

                isSwiping = false;
                isScrolling = false;
            };

            el.addEventListener('touchstart', onTouchStart, { passive: true });
            el.addEventListener('touchmove', onTouchMove, { passive: false });
            el.addEventListener('touchend', onTouchEnd, { passive: true });
            el.addEventListener('touchcancel', onTouchEnd, { passive: true });

            // Якщо плашка була свайпнута, звичайний клік по її тілу просто закриває свайп
            el.addEventListener('click', (e) => {
                if (el.classList.contains('is-swiped')) {
                    if (!e.target.closest('.board-actions, .note-actions')) {
                        e.preventDefault();
                        e.stopPropagation();
                        closeActiveSwipe();
                    }
                }
            }, true);
        }
    };
})();
