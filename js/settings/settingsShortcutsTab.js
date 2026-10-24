// js/settings/settingsShortcutsTab.js - Вкладка гарячих клавіш
window.App = window.App || {};

(function() {
    function t(key, params) {
        if (window.App && window.App.i18n && window.App.i18n.t) {
            return window.App.i18n.t(key, params);
        }
        return key;
    }

    const settingsShortcutsTab = {
        renderHTML(isVisible) {
            return `
                <div class="settings-tab-content settings-shortcuts-list" id="settings-tab-shortcuts" style="display: ${isVisible ? 'flex' : 'none'};">
                    <div class="settings-shortcut-row">
                        <span class="settings-shortcut-label" data-i18n="settings.shortcuts.undo">${t('settings.shortcuts.undo')}</span>
                        <div class="settings-shortcut-keys">
                            <kbd class="settings-kbd">Ctrl</kbd>
                            <span>+</span>
                            <kbd class="settings-kbd">Z</kbd>
                        </div>
                    </div>
                    <div class="settings-shortcut-row">
                        <span class="settings-shortcut-label" data-i18n="settings.shortcuts.redo">${t('settings.shortcuts.redo')}</span>
                        <div class="settings-shortcut-keys">
                            <kbd class="settings-kbd">Ctrl</kbd>
                            <span>+</span>
                            <kbd class="settings-kbd">Y</kbd>
                        </div>
                    </div>
                    <div class="settings-shortcut-row">
                        <span class="settings-shortcut-label" data-i18n="settings.shortcuts.search">${t('settings.shortcuts.search')}</span>
                        <div class="settings-shortcut-keys">
                            <kbd class="settings-kbd">Ctrl</kbd>
                            <span>+</span>
                            <kbd class="settings-kbd">F</kbd>
                        </div>
                    </div>
                    <div class="settings-shortcut-row">
                        <span class="settings-shortcut-label" data-i18n="settings.shortcuts.bold">${t('settings.shortcuts.bold')}</span>
                        <div class="settings-shortcut-keys">
                            <kbd class="settings-kbd">Ctrl</kbd>
                            <span>+</span>
                            <kbd class="settings-kbd">B</kbd>
                        </div>
                    </div>
                    <div class="settings-shortcut-row">
                        <span class="settings-shortcut-label" data-i18n="settings.shortcuts.createSubnote">${t('settings.shortcuts.createSubnote')}</span>
                        <div class="settings-shortcut-keys">
                            <kbd class="settings-kbd">Shift</kbd>
                            <span>+</span>
                            <kbd class="settings-kbd">+</kbd>
                        </div>
                    </div>
                    <div class="settings-shortcut-row">
                        <span class="settings-shortcut-label" data-i18n="settings.shortcuts.close">${t('settings.shortcuts.close')}</span>
                        <div class="settings-shortcut-keys">
                            <kbd class="settings-kbd">Esc</kbd>
                        </div>
                    </div>
                    <div class="settings-shortcut-row">
                        <span class="settings-shortcut-label" data-i18n="settings.shortcuts.searchNav">${t('settings.shortcuts.searchNav')}</span>
                        <div class="settings-shortcut-keys">
                            <kbd class="settings-kbd">Enter</kbd>
                            <span>/</span>
                            <kbd class="settings-kbd">Shift + Enter</kbd>
                        </div>
                    </div>
                </div>
            `;
        }
    };

    window.App.settingsShortcutsTab = settingsShortcutsTab;
})();
