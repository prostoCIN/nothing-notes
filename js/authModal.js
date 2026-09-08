// js/authModal.js - Модальне вікно входу та реєстрації користувача
window.App = window.App || {};

(function() {
    let modalEl = null;
    let setModeFn = null;

    window.App.authModal = {
        init() {
            this.createModalDOM();
        },

        createModalDOM() {
            if (modalEl) return;

            modalEl = document.createElement('div');
            modalEl.id = 'auth-modal';
            modalEl.className = 'auth-modal-overlay';
            modalEl.style.display = 'none';

            modalEl.innerHTML = `
                <div class="auth-modal-backdrop"></div>
                <div class="auth-modal-card">
                    <button class="auth-modal-close" id="auth-close-btn" title="Закрити">×</button>
                    
                    <div class="auth-modal-header">
                        <div class="auth-brand">
                            <img src="img/Logo.svg" alt="NothingNotes Logo" class="auth-logo">
                            <h2>Nothing<span class="brand-title-accent">Notes</span></h2>
                        </div>
                        <p id="auth-subtitle">Увійдіть за допомогою логіну або email, щоб синхронізувати нотатки.</p>
                    </div>

                    <div class="auth-tabs" id="auth-tabs">
                        <button type="button" class="auth-tab-btn active" id="auth-tab-login">Вхід</button>
                        <button type="button" class="auth-tab-btn" id="auth-tab-register">Реєстрація</button>
                    </div>

                    <form id="auth-form" class="auth-form" novalidate>
                        <!-- Секція входу -->
                        <div id="auth-login-section" class="auth-form-section">
                            <div class="auth-input-group">
                                <label for="auth-identifier">Логін або Email</label>
                                <input type="text" id="auth-identifier" placeholder="Логін або your@email.com" autocomplete="username">
                            </div>

                            <div class="auth-input-group">
                                <label for="auth-login-password">Пароль</label>
                                <div class="auth-password-wrapper">
                                    <input type="password" id="auth-login-password" placeholder="Введіть пароль" autocomplete="current-password">
                                    <button type="button" class="auth-password-toggle-btn" data-target="auth-login-password" title="Показати/приховати пароль" tabindex="-1">
                                        <svg class="icon-eye" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                                            <circle cx="12" cy="12" r="3"></circle>
                                        </svg>
                                        <svg class="icon-eye-off" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
                                            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path>
                                            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path>
                                            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path>
                                            <line x1="2" y1="2" x2="22" y2="22"></line>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Секція реєстрації -->
                        <div id="auth-register-section" class="auth-form-section" style="display: none;">
                            <div class="auth-input-group">
                                <label for="auth-reg-username">Логін (нікнейм)</label>
                                <input type="text" id="auth-reg-username" placeholder="alex_notes" autocomplete="username" minlength="3" maxlength="30">
                                <span class="auth-input-hint">Від 3 до 30 символів (букви, цифри, _ або -)</span>
                            </div>

                            <div class="auth-input-group">
                                <label for="auth-reg-email">Email</label>
                                <input type="email" id="auth-reg-email" placeholder="your@email.com" autocomplete="email">
                                <span class="auth-input-hint">Для відновлення доступу та синхронізації</span>
                            </div>

                            <div class="auth-input-group">
                                <label for="auth-reg-password">Пароль</label>
                                <div class="auth-password-wrapper">
                                    <input type="password" id="auth-reg-password" placeholder="Мінімум 6 символів" autocomplete="new-password">
                                    <button type="button" class="auth-password-toggle-btn" data-target="auth-reg-password" title="Показати/приховати пароль" tabindex="-1">
                                        <svg class="icon-eye" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                                            <circle cx="12" cy="12" r="3"></circle>
                                        </svg>
                                        <svg class="icon-eye-off" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
                                            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path>
                                            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path>
                                            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path>
                                            <line x1="2" y1="2" x2="22" y2="22"></line>
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div class="auth-input-group">
                                <label for="auth-reg-confirm">Повтор пароля</label>
                                <div class="auth-password-wrapper">
                                    <input type="password" id="auth-reg-confirm" placeholder="Повторіть пароль" autocomplete="new-password">
                                    <button type="button" class="auth-password-toggle-btn" data-target="auth-reg-confirm" title="Показати/приховати пароль" tabindex="-1">
                                        <svg class="icon-eye" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                                            <circle cx="12" cy="12" r="3"></circle>
                                        </svg>
                                        <svg class="icon-eye-off" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
                                            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path>
                                            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path>
                                            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path>
                                            <line x1="2" y1="2" x2="22" y2="22"></line>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div id="auth-error-msg" class="auth-error-msg" style="display: none;"></div>
                        <div id="auth-success-msg" class="auth-success-msg" style="display: none;"></div>

                        <button type="submit" class="auth-submit-btn" id="auth-submit-btn">
                            <span id="auth-btn-text">Увійти</span>
                        </button>
                    </form>

                    <div class="auth-footer">
                        <span id="auth-toggle-text">Ще немає акаунту?</span>
                        <button type="button" class="auth-toggle-btn" id="auth-toggle-mode-btn">Зареєструватися</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modalEl);

            let isSignUpMode = false;
            const form = modalEl.querySelector('#auth-form');
            const tabLogin = modalEl.querySelector('#auth-tab-login');
            const tabRegister = modalEl.querySelector('#auth-tab-register');
            const loginSection = modalEl.querySelector('#auth-login-section');
            const registerSection = modalEl.querySelector('#auth-register-section');
            const subtitle = modalEl.querySelector('#auth-subtitle');

            const identifierInput = modalEl.querySelector('#auth-identifier');
            const loginPassInput = modalEl.querySelector('#auth-login-password');

            const regUsernameInput = modalEl.querySelector('#auth-reg-username');
            const regEmailInput = modalEl.querySelector('#auth-reg-email');
            const regPassInput = modalEl.querySelector('#auth-reg-password');
            const regConfirmInput = modalEl.querySelector('#auth-reg-confirm');

            const submitBtn = modalEl.querySelector('#auth-submit-btn');
            const btnText = modalEl.querySelector('#auth-btn-text');
            const toggleBtn = modalEl.querySelector('#auth-toggle-mode-btn');
            const toggleText = modalEl.querySelector('#auth-toggle-text');
            const errorMsg = modalEl.querySelector('#auth-error-msg');
            const successMsg = modalEl.querySelector('#auth-success-msg');
            const closeBtn = modalEl.querySelector('#auth-close-btn');
            const backdrop = modalEl.querySelector('.auth-modal-backdrop');

            // Обробник кнопок показу/приховування паролів
            modalEl.querySelectorAll('.auth-password-toggle-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetId = btn.getAttribute('data-target');
                    const input = modalEl.querySelector('#' + targetId);
                    if (!input) return;
                    const isPass = input.type === 'password';
                    input.type = isPass ? 'text' : 'password';
                    const iconEye = btn.querySelector('.icon-eye');
                    const iconEyeOff = btn.querySelector('.icon-eye-off');
                    if (iconEye && iconEyeOff) {
                        iconEye.style.display = isPass ? 'none' : 'block';
                        iconEyeOff.style.display = isPass ? 'block' : 'none';
                    }
                    input.focus();
                });
            });

            setModeFn = (signUp) => {
                isSignUpMode = Boolean(signUp);
                errorMsg.style.display = 'none';
                errorMsg.textContent = '';
                successMsg.style.display = 'none';
                successMsg.textContent = '';

                if (isSignUpMode) {
                    tabLogin.classList.remove('active');
                    tabRegister.classList.add('active');
                    loginSection.style.display = 'none';
                    registerSection.style.display = 'flex';
                    subtitle.textContent = 'Створіть акаунт для надійної синхронізації ваших нотаток.';
                    btnText.textContent = 'Створити акаунт';
                    toggleText.textContent = 'Вже маєте акаунт?';
                    toggleBtn.textContent = 'Увійти';
                    setTimeout(() => regUsernameInput && regUsernameInput.focus(), 50);
                } else {
                    tabRegister.classList.remove('active');
                    tabLogin.classList.add('active');
                    registerSection.style.display = 'none';
                    loginSection.style.display = 'flex';
                    subtitle.textContent = 'Увійдіть за допомогою логіну або email, щоб синхронізувати нотатки.';
                    btnText.textContent = 'Увійти';
                    toggleText.textContent = 'Ще немає акаунту?';
                    toggleBtn.textContent = 'Зареєструватися';
                    setTimeout(() => identifierInput && identifierInput.focus(), 50);
                }
            };

            tabLogin.addEventListener('click', () => setModeFn(false));
            tabRegister.addEventListener('click', () => setModeFn(true));
            toggleBtn.addEventListener('click', () => setModeFn(!isSignUpMode));

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                errorMsg.style.display = 'none';
                errorMsg.textContent = '';
                successMsg.style.display = 'none';
                successMsg.textContent = '';

                const supabase = window.App && window.App.supabase;
                if (!supabase) {
                    errorMsg.textContent = 'Помилка: клієнт Supabase не ініціалізовано.';
                    errorMsg.style.display = 'block';
                    return;
                }

                submitBtn.disabled = true;
                btnText.textContent = 'Обробка...';

                try {
                    if (isSignUpMode) {
                        const username = regUsernameInput.value.trim();
                        const email = regEmailInput.value.trim().toLowerCase();
                        const password = regPassInput.value;
                        const confirmPass = regConfirmInput.value;

                        if (!username) {
                            throw new Error('Будь ласка, введіть логін.');
                        }
                        if (username.length < 3 || username.length > 30) {
                            throw new Error('Логін має містити від 3 до 30 символів.');
                        }
                        if (!/^[a-zA-Z0-9_.\-]+$/.test(username)) {
                            throw new Error('Логін може містити лише латинські букви, цифри, _, - або .');
                        }
                        if (username.includes('@')) {
                            throw new Error('Логін не може містити символ "@".');
                        }
                        if (!email || !email.includes('@') || !email.includes('.')) {
                            throw new Error('Будь ласка, введіть коректну адресу email.');
                        }
                        if (!password || password.length < 6) {
                            throw new Error('Пароль повинен містити щонайменше 6 символів.');
                        }
                        if (password !== confirmPass) {
                            throw new Error('Введені паролі не співпадають.');
                        }

                        // Перевірка чи логін вже зайнятий у таблиці profiles
                        try {
                            const { data: existingProf } = await supabase
                                .from('profiles')
                                .select('username')
                                .ilike('username', username)
                                .maybeSingle();

                            if (existingProf) {
                                throw new Error(`Логін "${username}" вже зайнятий. Оберіть, будь ласка, інший.`);
                            }
                        } catch (err) {
                            if (err.message && err.message.includes('вже зайнятий')) {
                                throw err;
                            }
                            // Якщо таблиця profiles ще не створена користувачем, продовжуємо реєстрацію
                        }

                        const { data, error } = await supabase.auth.signUp({
                            email,
                            password,
                            options: {
                                data: {
                                    username: username
                                }
                            }
                        });

                        if (error) {
                            if (error.message.toLowerCase().includes('already registered')) {
                                throw new Error('Користувач з таким email вже зареєстрований.');
                            }
                            throw error;
                        }

                        // Якщо користувач створений, зберігаємо профіль
                        if (data && data.user) {
                            try {
                                await supabase.from('profiles').upsert({
                                    id: data.user.id,
                                    username: username,
                                    email: email,
                                    updated_at: new Date().toISOString()
                                });
                            } catch (profErr) {
                                console.warn('Попередження збереження профілю:', profErr);
                            }
                        }

                        if (data.user && !data.session) {
                            successMsg.textContent = 'Акаунт успішно створено! Перевірте свою пошту для підтвердження або увійдіть.';
                            successMsg.style.display = 'block';
                        } else {
                            this.close();
                        }
                    } else {
                        // Режим входу
                        const identifier = identifierInput.value.trim();
                        const password = loginPassInput.value;

                        if (!identifier) {
                            throw new Error('Введіть логін або Email.');
                        }
                        if (!password) {
                            throw new Error('Введіть пароль.');
                        }

                        let loginEmail = identifier;

                        // Якщо введений ідентифікатор не є email (немає '@') - шукаємо email за логіном
                        if (!identifier.includes('@')) {
                            let resolved = null;

                            // 1. Спроба через RPC функцію get_email_by_username
                            try {
                                const { data: rpcEmail, error: rpcErr } = await supabase.rpc('get_email_by_username', {
                                    p_username: identifier
                                });
                                if (!rpcErr && rpcEmail) {
                                    resolved = rpcEmail;
                                }
                            } catch (rpcEx) {}

                            // 2. Fallback: прямий запит до таблиці profiles
                            if (!resolved) {
                                try {
                                    const { data: profile } = await supabase
                                        .from('profiles')
                                        .select('email')
                                        .ilike('username', identifier)
                                        .maybeSingle();

                                    if (profile && profile.email) {
                                        resolved = profile.email;
                                    }
                                } catch (dbEx) {}
                            }

                            if (!resolved) {
                                throw new Error(`Користувача з логіном "${identifier}" не знайдено.`);
                            }

                            loginEmail = resolved;
                        }

                        const { data, error } = await supabase.auth.signInWithPassword({
                            email: loginEmail,
                            password
                        });

                        if (error) {
                            if (error.message.toLowerCase().includes('invalid login credentials')) {
                                throw new Error('Невірний логін / email або пароль.');
                            }
                            throw error;
                        }

                        this.close();
                    }
                } catch (err) {
                    errorMsg.textContent = err.message || 'Помилка авторизації';
                    errorMsg.style.display = 'block';
                } finally {
                    submitBtn.disabled = false;
                    btnText.textContent = isSignUpMode ? 'Створити акаунт' : 'Увійти';
                }
            });

            closeBtn.addEventListener('click', () => this.close());
            backdrop.addEventListener('click', () => this.close());

            window.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modalEl.classList.contains('active')) {
                    this.close();
                }
            });
        },

        open(isSignUp = false) {
            if (!modalEl) this.createModalDOM();
            modalEl.style.display = 'flex';
            setTimeout(() => modalEl.classList.add('active'), 10);
            if (setModeFn) {
                setModeFn(Boolean(isSignUp));
            }
        },

        close() {
            if (!modalEl) return;
            modalEl.classList.remove('active');
            setTimeout(() => {
                modalEl.style.display = 'none';
            }, 200);
        }
    };
})();
