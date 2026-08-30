// js/authModal.js - Модальне вікно входу та реєстрації користувача
window.App = window.App || {};

(function() {
    let modalEl = null;

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
                    <button class="auth-modal-close" id="auth-close-btn">×</button>
                    
                    <div class="auth-modal-header">
                        <div class="auth-brand">
                            <img src="img/Logo.svg" alt="NothingNotes Logo" class="auth-logo">
                            <h2>Nothing<span class="brand-title-accent">Notes</span></h2>
                        </div>
                        <p id="auth-subtitle">Увійдіть, щоб зберігати нотатки в хмарі та мати доступ з будь-якого пристрою.</p>
                    </div>

                    <form id="auth-form" class="auth-form">
                        <div class="auth-input-group">
                            <label for="auth-email">Email</label>
                            <input type="email" id="auth-email" required placeholder="your@email.com" autocomplete="email">
                        </div>

                        <div class="auth-input-group">
                            <label for="auth-password">Пароль</label>
                            <input type="password" id="auth-password" required minlength="6" placeholder="Мінімум 6 символів" autocomplete="current-password">
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
            const emailInput = modalEl.querySelector('#auth-email');
            const passInput = modalEl.querySelector('#auth-password');
            const submitBtn = modalEl.querySelector('#auth-submit-btn');
            const btnText = modalEl.querySelector('#auth-btn-text');
            const toggleBtn = modalEl.querySelector('#auth-toggle-mode-btn');
            const toggleText = modalEl.querySelector('#auth-toggle-text');
            const errorMsg = modalEl.querySelector('#auth-error-msg');
            const successMsg = modalEl.querySelector('#auth-success-msg');
            const closeBtn = modalEl.querySelector('#auth-close-btn');
            const backdrop = modalEl.querySelector('.auth-modal-backdrop');

            const setMode = (signUp) => {
                isSignUpMode = signUp;
                errorMsg.style.display = 'none';
                successMsg.style.display = 'none';
                if (isSignUpMode) {
                    btnText.textContent = 'Створити акаунт';
                    toggleText.textContent = 'Вже маєте акаунт?';
                    toggleBtn.textContent = 'Увійти';
                } else {
                    btnText.textContent = 'Увійти';
                    toggleText.textContent = 'Ще немає акаунту?';
                    toggleBtn.textContent = 'Зареєструватися';
                }
            };

            toggleBtn.addEventListener('click', () => setMode(!isSignUpMode));

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                errorMsg.style.display = 'none';
                successMsg.style.display = 'none';
                submitBtn.disabled = true;
                btnText.textContent = 'Обробка...';

                const email = emailInput.value.trim();
                const password = passInput.value;
                const supabase = window.App.supabase;

                if (!supabase) {
                    errorMsg.textContent = 'Помилка: клієнт Supabase не ініціалізовано.';
                    errorMsg.style.display = 'block';
                    submitBtn.disabled = false;
                    btnText.textContent = isSignUpMode ? 'Створити акаунт' : 'Увійти';
                    return;
                }

                try {
                    if (isSignUpMode) {
                        const { data, error } = await supabase.auth.signUp({
                            email,
                            password
                        });

                        if (error) throw error;

                        if (data.user && !data.session) {
                            successMsg.textContent = 'Акаунт створено! Перевірте свою пошту для підтвердження.';
                            successMsg.style.display = 'block';
                        } else {
                            this.close();
                        }
                    } else {
                        const { data, error } = await supabase.auth.signInWithPassword({
                            email,
                            password
                        });

                        if (error) throw error;
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

        open() {
            if (!modalEl) this.createModalDOM();
            modalEl.style.display = 'flex';
            setTimeout(() => modalEl.classList.add('active'), 10);
            const email = modalEl.querySelector('#auth-email');
            if (email) email.focus();
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
