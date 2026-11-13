// js/welcomeView.js - Екран першого знайомства (вхід або локальний режим)
window.App = window.App || {};

(function() {
    window.App.welcomeView = {
        init() {
            this.bindEvents();
        },

        bindEvents() {
            const els = window.App.getElements();

            const loginBtn = els.welcomeLoginBtn || document.getElementById('welcome-login-btn');
            if (loginBtn) {
                loginBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (window.App.authModal) {
                        window.App.authModal.open();
                    }
                });
            }

            if (els.welcomeGuestBtn) {
                els.welcomeGuestBtn.addEventListener('click', () => {
                    // Перехід у робочу область без хмари
                    this.hide();
                    const state = window.App.state;
                    if (state) {
                        if (state.boards.length === 0 && window.App.boardManager) {
                            const defaultName = (window.App.i18n ? window.App.i18n.t('sidebar.newBoardDefaultName') : null) || 'Мій блокнот';
                            window.App.boardManager.createBoard(defaultName);
                        } else if (!state.activeBoardId && state.boards.length > 0) {
                            state.activeBoardId = state.boards[0].id;
                            if (window.App.storage) {
                                window.App.storage.saveActiveBoardId(state.activeBoardId);
                            }
                        }
                    }
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
