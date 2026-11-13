// js/workspace/stickerSubnotes.js - Модуль інтерактивного списку піднотаток для картки стікера
window.App = window.App || {};

(function() {
    window.App.stickerSubnotes = {
        /**
         * Створює інтерактивний блок списку піднотаток для стікера
         * @param {Object} note - Об'єкт нотатки
         * @param {number} colIndex - Порядковий номер колонки
         * @param {boolean} isChainOpen - Чи відкрита наразі колонка ланцюжка
         * @param {boolean} isReadOnly - Прапорець тільки для читання
         * @returns {HTMLElement|null} - DOM-елемент або null якщо режим читання і піднотаток немає
         */
        createSubnotesBlock(note, colIndex, isChainOpen, isReadOnly = false) {
            const noteManager = window.App.noteManager;
            const workspaceView = window.App.workspaceView;

            if (!noteManager || !noteManager.getNotesForColumn) return null;

            const childNotes = noteManager.getNotesForColumn(note.id);
            const childCount = childNotes.length;
            const i18n = window.App.i18n;

            // Допоміжна функція швидкого створення піднотатки
            const triggerQuickAdd = (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                if (isReadOnly) return;

                if (window.App.state && window.App.state.viewMode !== 'columns') {
                    if (noteManager && noteManager.createNewNote) {
                        noteManager.createNewNote(note.id, true);
                    }
                } else {
                    if (!isChainOpen && workspaceView && workspaceView.toggleChain) {
                        workspaceView.toggleChain(note.id, colIndex);
                    }
                    if (noteManager && noteManager.createNewNote) {
                        setTimeout(() => noteManager.createNewNote(note.id, true), 80);
                    }
                }
            };

            // Допоміжна функція відкриття/закриття ланцюжка
            const triggerToggleChain = (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                if (workspaceView && workspaceView.toggleChain) {
                    workspaceView.toggleChain(note.id, colIndex);
                }
            };

            // 1. Стан, коли піднотаток ще немає (childCount === 0) -> Ghost-плашка Варіанту А
            if (childCount === 0) {
                if (isReadOnly) return null; // Для режиму перегляду чужих нотаток нічого не показуємо

                const ghostBox = document.createElement('div');
                ghostBox.className = 'sticker-subnotes-container sticker-subnotes-empty-ghost';
                const addText = i18n ? (i18n.t('sticker.addSubnote') || 'Додати піднотатку') : 'Додати піднотатку';
                ghostBox.title = addText;

                ghostBox.innerHTML = `
                    <div class="subnotes-empty-add-area">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        <span class="subnotes-empty-add-label">${addText}</span>
                    </div>
                    <div class="subnotes-nav-btn subnotes-empty-nav-btn" title="${addText}">
                        <svg class="subnotes-nav-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                            <polyline points="12 5 19 12 12 19"></polyline>
                        </svg>
                    </div>
                `;

                ghostBox.addEventListener('click', triggerQuickAdd);
                return ghostBox;
            }

            // 2. Стан, коли піднотатки вже є (childCount > 0)
            const subnotesBox = document.createElement('div');
            subnotesBox.className = `sticker-subnotes-container ${isChainOpen ? 'is-expanded' : ''}`;

            const subnotesTitleText = i18n ? i18n.t('sticker.subnotesTitle') : 'Піднотатки';
            const navTooltip = isChainOpen 
                ? (i18n ? i18n.t('sticker.hideSubnotesCol') : 'Приховати колонку піднотаток') 
                : (i18n ? i18n.t('sticker.openSubnotesCol') : 'Перейти до піднотаток');
            const quickAddTooltip = i18n ? (i18n.t('sticker.addSubnote') || 'Додати піднотатку') : 'Додати піднотатку';

            // Основна ліва частина (заголовок + прев'ю списку)
            const mainArea = document.createElement('div');
            mainArea.className = 'subnotes-main-area';
            mainArea.title = navTooltip;

            const headerRow = document.createElement('div');
            headerRow.className = 'sticker-subnotes-header';

            const headerLeft = document.createElement('div');
            headerLeft.className = 'subnotes-header-left';
            headerLeft.innerHTML = `
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
                <span>${subnotesTitleText}</span>
                <span class="subnotes-pill-badge">${childCount}</span>
            `;

            if (!isReadOnly) {
                const quickAddBtn = document.createElement('button');
                quickAddBtn.type = 'button';
                quickAddBtn.className = 'subnotes-quick-add-btn';
                quickAddBtn.title = quickAddTooltip;
                quickAddBtn.innerHTML = `
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                `;
                quickAddBtn.addEventListener('click', triggerQuickAdd);
                headerLeft.appendChild(quickAddBtn);
            }

            headerRow.appendChild(headerLeft);

            // Прев'ю-список піднотаток
            const previewList = document.createElement('div');
            previewList.className = 'sticker-subnotes-preview-list';

            const defaultUntitled = i18n ? i18n.t('sticker.untitled') : 'Без назви';
            const maxPreview = 3;
            childNotes.slice(0, maxPreview).forEach(child => {
                const item = document.createElement('div');
                item.className = 'subnotes-preview-item';
                const childIcon = child.icon || '📄';
                const childIconHtml = window.App.renderAppleEmoji ? window.App.renderAppleEmoji(childIcon, 14) : childIcon;
                item.innerHTML = `
                    <span class="subnotes-preview-bullet">•</span>
                    <span class="subnotes-preview-icon">${childIconHtml}</span>
                    <span class="subnotes-preview-title">${child.title ? child.title.trim() : defaultUntitled}</span>
                `;
                previewList.appendChild(item);
            });

            if (childCount > maxPreview) {
                const moreItem = document.createElement('div');
                moreItem.className = 'subnotes-preview-more';
                const moreCount = childCount - maxPreview;
                moreItem.textContent = i18n ? i18n.t('sticker.moreSubnotes', { count: moreCount }) : `+ ще ${moreCount}...`;
                previewList.appendChild(moreItem);
            }

            mainArea.appendChild(headerRow);
            mainArea.appendChild(previewList);
            mainArea.addEventListener('click', triggerToggleChain);

            // Права кнопка переходу (~56px на всю висоту блоку зі стрілочкою)
            const navBtn = document.createElement('button');
            navBtn.type = 'button';
            navBtn.className = `subnotes-nav-btn ${isChainOpen ? 'active' : ''}`;
            navBtn.title = navTooltip;
            navBtn.innerHTML = `
                <svg class="subnotes-nav-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
            `;
            navBtn.addEventListener('click', triggerToggleChain);

            subnotesBox.appendChild(mainArea);
            subnotesBox.appendChild(navBtn);

            return subnotesBox;
        }
    };
})();
