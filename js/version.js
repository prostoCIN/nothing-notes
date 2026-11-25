// js/version.js - Версія додатку NothingNotes та діагностичне логування
export const APP_VERSION = '1.4.0';
export const COMMIT_HASH = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'dev';
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';

let hasLogged = false;

/**
 * Одноразове логування поточної версії та хешу комміту в консоль DevTools при завантаженні сайту
 */
export function logAppVersion() {
    if (hasLogged) return;
    hasLogged = true;

    // Фірмовий триколірний бейдж у стилі Nothing OS
    console.log(
        `%c NothingNotes %c v${APP_VERSION} %c #${COMMIT_HASH} `,
        'background: #18181b; color: #f4f4f5; font-weight: 700; font-size: 11px; padding: 3px 6px; border-radius: 4px 0 0 4px; border: 1px solid #27272a; border-right: none;',
        'background: #e11d48; color: #ffffff; font-weight: 700; font-size: 11px; padding: 3px 6px; border: 1px solid #e11d48; border-right: none;',
        'background: #27272a; color: #a1a1aa; font-weight: 600; font-size: 11px; padding: 3px 6px; border-radius: 0 4px 4px 0; border: 1px solid #3f3f46;'
    );
}

window.App = window.App || {};
window.App.version = APP_VERSION;
window.App.commit = COMMIT_HASH;
window.App.buildTime = BUILD_TIME;
window.App.logAppVersion = logAppVersion;

