// js/accountManager.js - Управління мульти-акаунтами та перемиканням сесій користувача
window.App = window.App || {};

(function() {
    const STORAGE_KEY = 'nothing_notes_saved_accounts';

    let overlayEl = null;
    let backdropEl = null;

    function getSavedAccounts() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveAccounts(accounts) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
        } catch (e) {
            console.warn('[AccountManager] Failed to save accounts:', e);
        }
    }

    window.App.accountManager = {
        init() {
            this.createOverlayDOM();
        },

        createOverlayDOM() {
            if (overlayEl && document.body.contains(overlayEl)) return;

            backdropEl = document.createElement('div');
            backdropEl.className = 'account-overlay-backdrop';
            backdropEl.id = 'account-overlay-backdrop';
            backdropEl.style.display = 'none';

            overlayEl = document.createElement('div');
            overlayEl.className = 'account-switcher-overlay';
            overlayEl.id = 'account-switcher-overlay';
            overlayEl.style.display = 'none';

            backdropEl.addEventListener('click', () => this.closeOverlay());

            window.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && overlayEl && overlayEl.classList.contains('active')) {
                    this.closeOverlay();
                }
            });

            document.body.appendChild(backdropEl);
            document.body.appendChild(overlayEl);
        },

        saveAccountFromSession(session) {
            if (!session || !session.user || !session.access_token) return;
            const user = session.user;
            const accounts = getSavedAccounts();

            const nickname = (user.user_metadata && (user.user_metadata.username || user.user_metadata.nickname || user.user_metadata.display_name)) || user.email.split('@')[0];
            const initial = nickname.charAt(0).toUpperCase();

            const existingIdx = accounts.findIndex(a => a.id === user.id);
            const accountData = {
                id: user.id,
                email: user.email,
                nickname: nickname,
                initial: initial,
                accessToken: session.access_token,
                refreshToken: session.refresh_token,
                userMetadata: user.user_metadata || {},
                lastActive: Date.now()
            };

            if (existingIdx >= 0) {
                accounts[existingIdx] = { ...accounts[existingIdx], ...accountData };
            } else {
                accounts.push(accountData);
            }

            saveAccounts(accounts);
        },

        openOverlay() {
            this.createOverlayDOM();
            this.renderOverlayContent();

            const profileCard = document.getElementById('sidebar-user-profile');
            const clickWrap = document.getElementById('user-profile-info-click');
            if (clickWrap) {
                clickWrap.classList.add('is-open');
            }

            if (profileCard && overlayEl) {
                const rect = profileCard.getBoundingClientRect();
                const isMobile = window.innerWidth <= 768;

                if (!isMobile) {
                    overlayEl.style.position = 'fixed';
                    overlayEl.style.bottom = `${Math.max(12, window.innerHeight - rect.top + 8)}px`;
                    overlayEl.style.left = `${Math.max(10, rect.left)}px`;
                    overlayEl.style.transform = 'none';
                } else {
                    overlayEl.style.position = 'fixed';
                    overlayEl.style.bottom = '20px';
                    overlayEl.style.left = '50%';
                    overlayEl.style.transform = 'translateX(-50%)';
                }
            }

            backdropEl.style.display = 'block';
            overlayEl.style.display = 'block';
            void overlayEl.offsetHeight;
            overlayEl.classList.add('active');
        },

        closeOverlay() {
            if (overlayEl) {
                overlayEl.classList.remove('active');
                overlayEl.style.display = 'none';
            }
            if (backdropEl) {
                backdropEl.style.display = 'none';
            }

            const clickWrap = document.getElementById('user-profile-info-click');
            if (clickWrap) {
                clickWrap.classList.remove('is-open');
            }
        },

        toggleOverlay() {
            if (overlayEl && overlayEl.classList.contains('active')) {
                this.closeOverlay();
            } else {
                this.openOverlay();
            }
        },

        renderOverlayContent() {
            if (!overlayEl) return;

            const currentUser = window.App.cloudSync ? window.App.cloudSync.getCurrentUser() : null;
            const accounts = getSavedAccounts();

            const currentNickname = currentUser 
                ? ((currentUser.user_metadata && (currentUser.user_metadata.username || currentUser.user_metadata.nickname || currentUser.user_metadata.display_name)) || currentUser.email.split('@')[0])
                : 'Користувач';
            const currentInitial = currentNickname.charAt(0).toUpperCase();

            // Відфільтровуємо інші акаунти (окрім активного)
            const otherAccounts = accounts.filter(a => !currentUser || a.id !== currentUser.id);

            let otherAccountsHtml = '';
            if (otherAccounts.length > 0) {
                otherAccountsHtml = `
                    <div class="account-switcher-section-title">Інші збережені акаунти</div>
                    ${otherAccounts.map(acc => `
                        <div class="account-item account-other-item" data-account-id="${acc.id}">
                            <div class="account-avatar">${acc.initial || 'U'}</div>
                            <div class="account-details">
                                <div class="account-name" title="${acc.nickname}">${acc.nickname}</div>
                                <div class="account-email" title="${acc.email}">${acc.email}</div>
                            </div>
                            <button class="account-item-logout-btn" data-account-id="${acc.id}" title="Вийти з цього акаунта (${acc.email})">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                    <polyline points="16 17 21 12 16 7"></polyline>
                                    <line x1="21" y1="12" x2="9" y2="12"></line>
                                </svg>
                            </button>
                        </div>
                    `).join('')}
                `;
            }

            overlayEl.innerHTML = `
                <div class="account-switcher-header">
                    <div class="account-switcher-title">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        <span>Облікові записи</span>
                    </div>
                    <button class="account-switcher-close" id="account-switcher-close" title="Закрити">×</button>
                </div>

                <div class="account-switcher-list">
                    ${currentUser ? `
                        <div class="account-switcher-section-title">Поточний акаунт</div>
                        <div class="account-item is-current">
                            <div class="account-avatar">${currentInitial}</div>
                            <div class="account-details">
                                <div class="account-name" title="${currentNickname}">${currentNickname}</div>
                                <div class="account-email" title="${currentUser.email}">${currentUser.email}</div>
                            </div>
                            <div class="account-badge-current">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                <span>Активний</span>
                            </div>
                        </div>
                    ` : `
                        <div class="account-guest-notice">Ви не увійшли в акаунт</div>
                    `}

                    ${otherAccountsHtml}
                </div>

                <div class="account-switcher-footer">
                    <button class="account-action-btn account-add-btn" id="account-add-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        <span>Додати акаунт</span>
                    </button>

                    ${currentUser ? `
                        <button class="account-action-btn account-logout-btn" id="account-logout-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                            <span>Вийти з акаунта</span>
                        </button>
                    ` : ''}
                </div>
            `;

            // Обробники подій
            const closeBtn = overlayEl.querySelector('#account-switcher-close');
            if (closeBtn) closeBtn.addEventListener('click', () => this.closeOverlay());

            const addBtn = overlayEl.querySelector('#account-add-btn');
            if (addBtn) {
                addBtn.addEventListener('click', () => {
                    this.closeOverlay();
                    if (window.App.authModal) {
                        window.App.authModal.open();
                    }
                });
            }

            const logoutBtn = overlayEl.querySelector('#account-logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => {
                    this.logoutCurrent();
                });
            }

            // Перемикання на інший збережений акаунт
            overlayEl.querySelectorAll('.account-other-item').forEach(row => {
                row.addEventListener('click', (e) => {
                    if (e.target.closest('.account-item-logout-btn')) return;
                    const accountId = row.dataset.accountId;
                    if (accountId) {
                        this.switchAccount(accountId, row);
                    }
                });
            });

            // Вихід з окремого не поточного акаунта
            overlayEl.querySelectorAll('.account-item-logout-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const accountId = btn.dataset.accountId;
                    if (accountId) {
                        this.removeAccount(accountId);
                    }
                });
            });
        },

        async switchAccount(targetId, rowEl = null) {
            const accounts = getSavedAccounts();
            const target = accounts.find(a => a.id === targetId);
            if (!target) return;

            const currentUser = window.App.cloudSync ? window.App.cloudSync.getCurrentUser() : null;
            if (currentUser && currentUser.id === targetId) {
                this.closeOverlay();
                return;
            }

            const supabase = window.App.supabase;
            if (!supabase) return;

            if (rowEl) {
                rowEl.classList.add('is-switching');
                const nameEl = rowEl.querySelector('.account-name');
                if (nameEl) nameEl.textContent = 'Перемикання...';
            }

            try {
                const { data, error } = await supabase.auth.setSession({
                    access_token: target.accessToken,
                    refresh_token: target.refreshToken
                });

                if (error) {
                    console.warn('[AccountManager] setSession error:', error);
                    if (window.App.confirmModal) {
                        window.App.confirmModal.show({
                            title: 'Сесія закінчилася',
                            message: `Термін дії сесії для акаунта <b>${target.email}</b> минув.<br><br>Увійдіть у нього повторно.`,
                            confirmText: 'Увійти знову',
                            cancelText: 'Видалити зі списку',
                            type: 'warning',
                            onConfirm: () => {
                                this.closeOverlay();
                                if (window.App.authModal) {
                                    window.App.authModal.open();
                                }
                            },
                            onCancel: () => {
                                this.removeAccount(target.id);
                            }
                        });
                    }
                    return;
                }

                target.lastActive = Date.now();
                if (data && data.session) {
                    target.accessToken = data.session.access_token;
                    target.refreshToken = data.session.refresh_token;
                }
                saveAccounts(accounts);

                this.closeOverlay();
            } catch (err) {
                console.error('[AccountManager] switchAccount exception:', err);
                this.closeOverlay();
            }
        },

        async removeAccount(accountId) {
            let accounts = getSavedAccounts();
            const currentUser = window.App.cloudSync ? window.App.cloudSync.getCurrentUser() : null;
            const isCurrent = currentUser && currentUser.id === accountId;

            accounts = accounts.filter(a => a.id !== accountId);
            saveAccounts(accounts);

            if (isCurrent) {
                if (accounts.length > 0) {
                    // Якщо видалено поточний, але є інші — перемикаємо на перший доступний
                    await this.switchAccount(accounts[0].id);
                } else {
                    // Інакше повністю виходимо у гостьовий режим
                    if (window.App.supabase) {
                        await window.App.supabase.auth.signOut();
                    }
                    this.closeOverlay();
                }
            } else {
                // Оновлюємо оверлей для не поточного акаунта
                this.renderOverlayContent();
            }
        },

        async logoutCurrent() {
            const currentUser = window.App.cloudSync ? window.App.cloudSync.getCurrentUser() : null;
            if (currentUser) {
                await this.removeAccount(currentUser.id);
            } else if (window.App.supabase) {
                await window.App.supabase.auth.signOut();
            }
            this.closeOverlay();
        }
    };
})();
