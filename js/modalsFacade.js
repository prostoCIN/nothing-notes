// js/modalsFacade.js - Легковажні проксі для лінивого завантаження важких модалок (Auth, Settings)
window.App = window.App || {};

let authModalLoadingPromise = null;
let settingsModalLoadingPromise = null;

async function loadAuthModal() {
    if (!authModalLoadingPromise) {
        authModalLoadingPromise = import('./authModal.js').then(() => {
            if (window.App.authModal && window.App.authModal.init) {
                window.App.authModal.init();
            }
            return window.App.authModal;
        });
    }
    return authModalLoadingPromise;
}

async function loadSettingsModal() {
    if (!settingsModalLoadingPromise) {
        settingsModalLoadingPromise = import('./settings/settingsModalModule.js').then(() => {
            if (window.App.settingsModal && window.App.settingsModal.init) {
                window.App.settingsModal.init();
            }
            return window.App.settingsModal;
        });
    }
    return settingsModalLoadingPromise;
}

// Початковий легковажний проксі для authModal
window.App.authModal = {
    isOpen: false,
    init() {
        // Відкладена ініціалізація до першого виклику open
    },
    async open(mode) {
        const modal = await loadAuthModal();
        if (modal && modal.open) {
            return modal.open(mode);
        }
    },
    close() {
        // Якщо ще не завантажено, модалка і так закрита
    }
};

// Початковий легковажний проксі для settingsModal
window.App.settingsModal = {
    isOpen: false,
    init() {
        if (window.App.settingsPreferences && window.App.settingsPreferences.init) {
            window.App.settingsPreferences.init();
        }
    },
    loadPreferences() {
        return window.App.settingsPreferences ? window.App.settingsPreferences.loadPreferences() : null;
    },
    applyPreferences() {
        return window.App.settingsPreferences ? window.App.settingsPreferences.applyPreferences() : null;
    },
    getTheme() {
        return window.App.settingsPreferences ? window.App.settingsPreferences.getTheme() : 'forest';
    },
    setTheme(themeKey, save = true) {
        return window.App.settingsPreferences ? window.App.settingsPreferences.setTheme(themeKey, save) : null;
    },
    isAutoCapitalizeEnabled() {
        return window.App.settingsPreferences ? window.App.settingsPreferences.isAutoCapitalizeEnabled() : true;
    },
    isCompactViewEnabled() {
        return window.App.settingsPreferences ? window.App.settingsPreferences.isCompactViewEnabled() : false;
    },
    setAutoCapitalize(val) {
        return window.App.settingsPreferences ? window.App.settingsPreferences.setAutoCapitalize(val) : null;
    },
    setCompactView(val) {
        return window.App.settingsPreferences ? window.App.settingsPreferences.setCompactView(val) : null;
    },
    async open(tab) {
        const modal = await loadSettingsModal();
        if (modal && modal.open) {
            return modal.open(tab);
        }
    },
    close() {},
    render() {}
};

export { loadAuthModal, loadSettingsModal };
