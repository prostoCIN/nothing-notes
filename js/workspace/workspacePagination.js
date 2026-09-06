// js/workspace/workspacePagination.js - Індикатор пагінації колонок на мобільних пристроях
window.App = window.App || {};

(function() {
    window.App.workspacePagination = {
        /**
         * Рендерить крапки індикатора пагінації колонок для мобільних екранів
         */
        render() {
            const container = document.getElementById('mobile-columns-pagination');
            if (!container) return;

            const state = window.App.state;
            const columnCount = (state && state.activeChain && state.activeChain.length) ? state.activeChain.length : 1;

            // Якщо колонка всього одна — ховаємо індикатор
            if (columnCount <= 1 || window.innerWidth > 768) {
                container.classList.remove('visible');
                container.innerHTML = '';
                return;
            }

            container.classList.add('visible');
            container.innerHTML = '';

            for (let i = 0; i < columnCount; i++) {
                const dot = document.createElement('div');
                dot.className = `mobile-pagination-dot ${i === 0 ? 'active' : ''}`;
                dot.dataset.colIndex = i;
                dot.addEventListener('click', () => {
                    const columnsContainer = document.getElementById('columns-container');
                    if (columnsContainer) {
                        const targetLeft = i * window.innerWidth;
                        columnsContainer.scrollTo({ left: targetLeft, behavior: 'smooth' });
                    }
                });
                container.appendChild(dot);
            }

            this.update();
        },

        /**
         * Оновлює активну крапку відповідно до поточного скролу колонок
         */
        update() {
            const container = document.getElementById('mobile-columns-pagination');
            const columnsContainer = document.getElementById('columns-container');
            if (!container || !columnsContainer || window.innerWidth > 768) return;

            const scrollLeft = columnsContainer.scrollLeft;
            const colWidth = window.innerWidth;
            const activeIndex = Math.round(scrollLeft / colWidth);

            const dots = container.querySelectorAll('.mobile-pagination-dot');
            dots.forEach((dot, idx) => {
                dot.classList.toggle('active', idx === activeIndex);
            });
        }
    };
})();
