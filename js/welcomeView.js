// js/welcomeView.js - Екран першого знайомства (створення першої дошки)
window.App = window.App || {};

(function() {
    window.App.welcomeView = {
        init() {
            this.bindEvents();
        },

        bindEvents() {
            const els = window.App.getElements();
            if (!els.createFirstBoardBtn || !els.welcomeBoardInput) return;

            els.createFirstBoardBtn.addEventListener('click', () => {
                const name = els.welcomeBoardInput.value.trim();
                if (name) window.App.boardManager.createBoard(name);
            });

            els.welcomeBoardInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const name = els.welcomeBoardInput.value.trim();
                    if (name) window.App.boardManager.createBoard(name);
                }
            });
        },

        show() {
            const els = window.App.getElements();
            els.welcomeScreen.style.display = 'flex';
            els.appContainer.style.display = 'none';
            setTimeout(() => {
                if (els.welcomeBoardInput) els.welcomeBoardInput.focus();
            }, 100);
        },

        hide() {
            const els = window.App.getElements();
            els.welcomeScreen.style.display = 'none';
            els.appContainer.style.display = 'flex';
        }
    };
})();
