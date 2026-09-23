// js/workspace/stickerSubnotes.js - Модуль інтерактивного списку піднотаток для картки стікера
window.App = window.App || {};

(function() {
    window.App.stickerSubnotes = {
        /**
         * Створює інтерактивний блок списку піднотаток для стікера (якщо є дочірні нотатки)
         * @param {Object} note - Об'єкт нотатки
         * @param {number} colIndex - Порядковий номер колонки
         * @param {boolean} isChainOpen - Чи відкрита наразі колонка ланцюжка
         * @returns {HTMLElement|null} - DOM-елемент або null якщо піднотаток немає
         */
        createSubnotesBlock(note, colIndex, isChainOpen) {
            const noteManager = window.App.noteManager;
            const workspaceView = window.App.workspaceView;

            if (!noteManager || !noteManager.getNotesForColumn) return null;

            const childNotes = noteManager.getNotesForColumn(note.id);
            const childCount = childNotes.length;

            if (childCount === 0) return null;

            const i18n = window.App.i18n;
            const subnotesBox = document.createElement('div');
            subnotesBox.className = `sticker-subnotes-container ${isChainOpen ? 'is-expanded' : ''}`;
            subnotesBox.title = isChainOpen 
                ? (i18n ? i18n.t('sticker.hideSubnotesCol') : 'Приховати колонку піднотаток') 
                : (i18n ? i18n.t('sticker.openSubnotesCol') : 'Відкрити колонку піднотаток');

            const subnotesTitleText = i18n ? i18n.t('sticker.subnotesTitle') : 'Піднотатки';
            const subnotesStatusText = isChainOpen 
                ? (i18n ? i18n.t('sticker.subnotesOpened') : 'Відкрито')
                : (i18n ? i18n.t('sticker.subnotesView') : 'Переглянути');

            const subnotesHeader = document.createElement('div');
            subnotesHeader.className = 'sticker-subnotes-header';
            subnotesHeader.innerHTML = `
                <div class="subnotes-header-left">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                    <span>${subnotesTitleText}</span>
                    <span class="subnotes-pill-badge">${childCount}</span>
                </div>
                <div class="subnotes-header-right">
                    <span class="subnotes-toggle-status">${subnotesStatusText}</span>
                </div>
            `;

            const previewList = document.createElement('div');
            previewList.className = 'sticker-subnotes-preview-list';

            const defaultUntitled = i18n ? i18n.t('sticker.untitled') : 'Без назви';
            const maxPreview = 3;
            childNotes.slice(0, maxPreview).forEach(child => {
                const item = document.createElement('div');
                item.className = 'subnotes-preview-item';
                item.innerHTML = `
                    <span class="subnotes-preview-bullet">•</span>
                    <span class="subnotes-preview-icon">${child.icon || '📄'}</span>
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

            subnotesBox.appendChild(subnotesHeader);
            subnotesBox.appendChild(previewList);

            subnotesBox.addEventListener('click', (e) => {
                e.stopPropagation();
                if (workspaceView && workspaceView.toggleChain) {
                    workspaceView.toggleChain(note.id, colIndex);
                }
            });

            return subnotesBox;
        }
    };
})();
