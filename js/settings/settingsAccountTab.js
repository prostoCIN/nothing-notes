// js/settings/settingsAccountTab.js - Вкладка акаунту та хмари
window.App = window.App || {};

(function() {
    function t(key, params) {
        if (window.App && window.App.i18n && window.App.i18n.t) {
            return window.App.i18n.t(key, params);
        }
        return key;
    }

    const settingsAccountTab = {
        renderHTML(isVisible) {
            return `
                <div class="settings-tab-content" id="settings-tab-account" style="display: ${isVisible ? 'flex' : 'none'};">
                    <div class="settings-account-card" id="settings-account-container">
                        <!-- Заповнюється динамічно -->
                    </div>

                    <div class="settings-stats-row">
                        <div class="settings-stat-box">
                            <div class="settings-stat-num" id="settings-stat-boards">0</div>
                            <div class="settings-stat-label" data-i18n="settings.account.boardsStat">${t('settings.account.boardsStat')}</div>
                        </div>
                        <div class="settings-stat-box">
                            <div class="settings-stat-num" id="settings-stat-notes">0</div>
                            <div class="settings-stat-label" data-i18n="settings.account.notesStat">${t('settings.account.notesStat')}</div>
                        </div>
                    </div>
                </div>
            `;
        },

        async renderAccountInfo(modalOverlayEl, onCloseModal) {
            if (!modalOverlayEl) return;
            const container = modalOverlayEl.querySelector('#settings-account-container');
            const boardsCountEl = modalOverlayEl.querySelector('#settings-stat-boards');
            const notesCountEl = modalOverlayEl.querySelector('#settings-stat-notes');

            const state = window.App.state;
            if (boardsCountEl) boardsCountEl.textContent = (state && state.boards ? state.boards.length : 0);
            if (notesCountEl) notesCountEl.textContent = (state && state.notes ? state.notes.length : 0);

            if (!container) return;

            let user = null;
            if (window.App.supabase && window.App.supabase.auth) {
                try {
                    const { data } = await window.App.supabase.auth.getUser();
                    user = data?.user || null;
                } catch (e) {
                    user = null;
                }
            }

            if (user) {
                const nickname = (user.user_metadata && (user.user_metadata.username || user.user_metadata.nickname || user.user_metadata.display_name)) || user.email.split('@')[0];
                const initial = nickname.charAt(0).toUpperCase();

                container.innerHTML = `
                    <div class="settings-account-header">
                        <div class="settings-account-avatar">${initial}</div>
                        <div class="settings-account-details">
                            <div class="settings-account-name">${nickname}</div>
                            <div class="settings-account-email" title="${user.email}">${user.email}</div>
                        </div>
                    </div>
                    <div class="settings-account-badge online">
                        <span class="settings-badge-dot"></span>
                        <span data-i18n="settings.account.loggedInTitle">${t('settings.account.loggedInTitle')}</span>
                    </div>
                    <div class="settings-account-actions">
                        <button class="settings-btn-danger" id="settings-logout-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                            <span data-i18n="settings.account.logoutBtn">${t('settings.account.logoutBtn')}</span>
                        </button>
                    </div>
                `;

                const logoutBtn = container.querySelector('#settings-logout-btn');
                if (logoutBtn) {
                    logoutBtn.addEventListener('click', async () => {
                        if (typeof onCloseModal === 'function') onCloseModal();
                        if (window.App.supabase && window.App.supabase.auth) {
                            await window.App.supabase.auth.signOut();
                        }
                    });
                }
            } else {
                container.innerHTML = `
                    <div class="settings-account-header">
                        <div class="settings-account-avatar" style="background: rgba(255,255,255,0.08); color: var(--text-muted);">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                        </div>
                        <div class="settings-account-details">
                            <div class="settings-account-name" data-i18n="settings.account.guestTitle">${t('settings.account.guestTitle')}</div>
                            <div class="settings-account-email" data-i18n="settings.account.guestDesc">${t('settings.account.guestDesc')}</div>
                        </div>
                    </div>
                    <div class="settings-account-badge offline">
                        <span class="settings-badge-dot"></span>
                        <span data-i18n="welcome.guestBtn">${t('welcome.guestBtn')}</span>
                    </div>
                    <div class="settings-account-actions">
                        <button class="settings-btn-primary" id="settings-login-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                                <polyline points="10 17 15 12 10 7"></polyline>
                                <line x1="15" y1="12" x2="3" y2="12"></line>
                            </svg>
                            <span data-i18n="welcome.loginBtn">${t('welcome.loginBtn')}</span>
                        </button>
                    </div>
                `;

                const loginBtn = container.querySelector('#settings-login-btn');
                if (loginBtn) {
                    loginBtn.addEventListener('click', () => {
                        if (typeof onCloseModal === 'function') onCloseModal();
                        if (window.App.authModal) {
                            window.App.authModal.open();
                        }
                    });
                }
            }
        }
    };

    window.App.settingsAccountTab = settingsAccountTab;
})();
