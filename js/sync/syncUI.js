// js/sync/syncUI.js - Оновлення інтерфейсу профілю в сайдбарі та завершення драгу
window.App = window.App || {};

(function() {
    let pullDebounceTimer = null;

    window.App.syncUI = {
        updateAuthUI(user) {
            let profileCard = document.getElementById('sidebar-user-profile');
            const sidebar = document.querySelector('.sidebar');
            if (!sidebar) return;

            if (!profileCard) {
                profileCard = document.createElement('div');
                profileCard.id = 'sidebar-user-profile';
                profileCard.className = 'sidebar-user-profile';
                sidebar.appendChild(profileCard);
            }

            if (user) {
                const nickname = (user.user_metadata && (user.user_metadata.username || user.user_metadata.nickname || user.user_metadata.display_name)) || user.email.split('@')[0];
                const initial = nickname.charAt(0).toUpperCase();

                const i18n = window.App?.i18n;
                const inCloudTitle = i18n ? i18n.t('auth.inCloud') : 'У хмарі';
                const manageAccountsTitle = i18n ? i18n.t('auth.accountManagement') : 'Керування акаунтами';

                profileCard.innerHTML = `
                    <div class="user-profile-clickable" id="user-profile-info-click" title="${manageAccountsTitle}">
                        <div class="user-avatar">${initial}</div>
                        <div class="user-info">
                            <div class="user-name-row">
                                <span class="user-email" title="${user.email}">${nickname}</span>
                                <span class="user-cloud-icon" title="${inCloudTitle}">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
                                    </svg>
                                </span>
                            </div>
                        </div>
                        <div class="user-profile-chevron" title="${manageAccountsTitle}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </div>
                    </div>
                    <button class="sidebar-settings-btn" id="sidebar-settings-btn" title="Налаштування сайту">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                `;

                const clickWrap = profileCard.querySelector('#user-profile-info-click');
                if (clickWrap) {
                    clickWrap.addEventListener('click', () => {
                        if (window.App && window.App.accountManager) {
                            window.App.accountManager.toggleOverlay();
                        } else if (window.App && window.App.settingsModal) {
                            window.App.settingsModal.open();
                        }
                    });
                }

                const settingsBtn = profileCard.querySelector('#sidebar-settings-btn');
                if (settingsBtn) {
                    settingsBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (window.App.settingsModal) window.App.settingsModal.open();
                    });
                }
            } else {
                profileCard.innerHTML = `
                    <button class="sidebar-login-btn" id="sidebar-login-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                            <polyline points="10 17 15 12 10 7"></polyline>
                            <line x1="15" y1="12" x2="3" y2="12"></line>
                        </svg>
                        <span>Увійти / Реєстрація</span>
                    </button>
                    <button class="sidebar-settings-btn sidebar-settings-guest-btn" id="sidebar-settings-btn" title="Налаштування сайту">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                `;

                const loginBtn = profileCard.querySelector('#sidebar-login-btn');
                if (loginBtn) {
                    loginBtn.addEventListener('click', () => {
                        if (window.App.authModal) {
                            window.App.authModal.open();
                        }
                    });
                }

                const settingsBtn = profileCard.querySelector('#sidebar-settings-btn');
                if (settingsBtn) {
                    settingsBtn.addEventListener('click', () => {
                        if (window.App.settingsModal) {
                            window.App.settingsModal.open();
                        }
                    });
                }
            }
        },

        // Викликається після завершення перетягування картки (pointerup) для безпечного застосування відкладених оновлень
        onDragEnd(cloudSync) {
            const state = window.App.state;
            if (cloudSync._deferredPulledNotes) {
                const notesToApply = cloudSync._deferredPulledNotes;
                cloudSync._deferredPulledNotes = null;
                cloudSync._pendingPullAfterDrag = false;
                if (state) {
                    state.notes = notesToApply;
                    window.App.storage.saveNotes(state.notes, true);
                }
                if (window.App.sidebarView) window.App.sidebarView.render();
                if (window.App.workspaceView) window.App.workspaceView.render();
            } else if (cloudSync._pendingPullAfterDrag) {
                cloudSync._pendingPullAfterDrag = false;
                clearTimeout(pullDebounceTimer);
                pullDebounceTimer = setTimeout(() => {
                    cloudSync.pullFromCloud();
                }, 150);
            }
        }
    };
})();
