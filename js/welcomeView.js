// js/welcomeView.js - Екран першого знайомства (вхід або локальний режим)
window.App = window.App || {};

(function() {
    window.App.welcomeView = {
        init() {
            this.bindEvents();
        },

        bindEvents() {
            const els = window.App.getElements();

            if (els.welcomeLoginBtn) {
                els.welcomeLoginBtn.addEventListener('click', () => {
                    if (window.App.authModal) {
                        window.App.authModal.open();
                    }
                });
            }

            if (els.welcomeGuestBtn) {
                els.welcomeGuestBtn.addEventListener('click', () => {
                    // Перехід у робочу область без хмари
                    this.hide();
                    if (window.App.sidebarView) window.App.sidebarView.render();
                    if (window.App.workspaceView) window.App.workspaceView.render();
                });
            }
        },

        show() {
            const els = window.App.getElements();
            els.welcomeScreen.style.display = 'flex';
            els.appContainer.style.display = 'none';
        },

        hide() {
            const els = window.App.getElements();
            els.welcomeScreen.style.display = 'none';
            els.appContainer.style.display = 'flex';
        }
    };
})();
