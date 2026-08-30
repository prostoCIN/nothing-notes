// js/confirmModal.js - Вспливаюче вікно підтвердження видалення з кнопкою затискання
window.App = window.App || {};

(function() {
    let overlay = null;
    let modalBox = null;
    let titleEl = null;
    let descEl = null;
    let cancelBtn = null;
    let holdBtn = null;
    let holdProgress = null;
    let holdBtnText = null;

    let holdStartTime = 0;
    let holdTimerId = null;
    const HOLD_DURATION = 600; // 0.6 секунди для швидкого та комфортного затискання
    let onConfirmCallback = null;

    let iconBadgeEl = null;

    function createModalDOM() {
        if (overlay) return;

        overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        modalBox = document.createElement('div');
        modalBox.className = 'confirm-modal-box';

        modalBox.innerHTML = `
            <div class="confirm-modal-header">
                <div class="confirm-modal-icon-badge" id="confirm-modal-icon-badge">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                </div>
                <h3 class="confirm-modal-title" id="confirm-modal-title">Підтвердження дії</h3>
            </div>
            <div class="confirm-modal-body" id="confirm-modal-desc">
                Ви впевнені, що хочете виконати цю дію?
            </div>
            <div class="confirm-modal-actions">
                <button class="modal-cancel-btn" id="confirm-modal-cancel">Скасувати</button>
                <button class="hold-delete-btn" id="confirm-modal-hold-delete">
                    <span class="hold-btn-progress"></span>
                    <span class="hold-btn-text">Затисніть для підтвердження</span>
                </button>
            </div>
        `;

        overlay.appendChild(modalBox);
        document.body.appendChild(overlay);

        titleEl = modalBox.querySelector('#confirm-modal-title');
        descEl = modalBox.querySelector('#confirm-modal-desc');
        iconBadgeEl = modalBox.querySelector('#confirm-modal-icon-badge');
        cancelBtn = modalBox.querySelector('#confirm-modal-cancel');
        holdBtn = modalBox.querySelector('#confirm-modal-hold-delete');
        holdProgress = modalBox.querySelector('.hold-btn-progress');
        holdBtnText = modalBox.querySelector('.hold-btn-text');

        // Скасування
        cancelBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('active')) {
                closeModal();
            }
        });

        // Події затискання кнопки (Pointer Events для підтримки миші і тачу)
        holdBtn.addEventListener('pointerdown', startHold);
        window.addEventListener('pointerup', cancelHold);
        window.addEventListener('pointercancel', cancelHold);
    }

    function startHold(e) {
        if (e.button !== 0) return; // Тільки ліва кнопка миші
        e.preventDefault();

        holdStartTime = Date.now();
        holdBtn.classList.add('holding');

        function updateProgress() {
            const elapsed = Date.now() - holdStartTime;
            const progress = Math.min(100, (elapsed / HOLD_DURATION) * 100);
            holdProgress.style.width = `${progress}%`;

            if (progress >= 100) {
                completeHold();
            } else {
                holdTimerId = requestAnimationFrame(updateProgress);
            }
        }

        holdTimerId = requestAnimationFrame(updateProgress);
    }

    function cancelHold() {
        if (holdTimerId) {
            cancelAnimationFrame(holdTimerId);
            holdTimerId = null;
        }
        if (holdBtn) {
            holdBtn.classList.remove('holding');
            holdProgress.style.transition = 'width 0.2s ease-out';
            holdProgress.style.width = '0%';
            setTimeout(() => {
                if (holdProgress) holdProgress.style.transition = 'width 0.05s linear';
            }, 200);
        }
    }

    function completeHold() {
        cancelHold();
        const cb = onConfirmCallback;
        closeModal();
        if (cb) cb();
    }

    function closeModal() {
        if (!overlay) return;
        cancelHold();
        overlay.classList.remove('active');
        onConfirmCallback = null;
    }

    window.App.confirmModal = {
        /**
         * Показує універсальне модальне вікно підтвердження із затисканням
         * @param {Object} options { title, message, confirmText, type, onConfirm }
         */
        show({ title, message, confirmText, type = 'danger', onConfirm }) {
            createModalDOM();

            titleEl.textContent = title || 'Підтвердження дії';
            descEl.innerHTML = message || 'Ви впевнені, що хочете продовжити?';
            holdBtnText.textContent = confirmText || (type === 'danger' ? 'Затисніть для видалення' : 'Затисніть для підтвердження');
            onConfirmCallback = onConfirm;

            // Налаштування іконки та стилю кнопки (danger / info)
            if (type === 'info') {
                iconBadgeEl.className = 'confirm-modal-icon-badge info-badge';
                iconBadgeEl.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                `;
                holdBtn.className = 'hold-delete-btn hold-info-btn';
            } else {
                iconBadgeEl.className = 'confirm-modal-icon-badge';
                iconBadgeEl.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                `;
                holdBtn.className = 'hold-delete-btn';
            }

            holdProgress.style.width = '0%';
            holdBtn.classList.remove('holding');

            overlay.classList.add('active');
        }
    };
})();
