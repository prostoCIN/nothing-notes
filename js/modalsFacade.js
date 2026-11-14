// js/modalsFacade.js - Застарілий фасад, тепер модалки імпортуються напряму в main.js
export async function loadAuthModal() {
    return window.App.authModal;
}

export async function loadSettingsModal() {
    return window.App.settingsModal;
}
