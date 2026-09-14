// js/sidebar/sidebarActions.js - Спільний модуль дій та інлайн-редагування для елементів лівої панелі (блокноти та нотатки)
window.App = window.App || {};

(function() {
    window.App.sidebarActions = {
        /**
         * Створює контейнер кнопок дій (поділитись, перейменувати, видалити тощо)
         * @param {Object} options
         * @param {string} [options.containerClass='item-actions']
         * @param {Object} [options.share] - { title, onClick }
         * @param {Object} [options.edit] - { title, onClick }
         * @param {Object} [options.delete] - { title, onClick }
         * @param {Array<HTMLElement>} [options.extraButtons]
         * @returns {HTMLElement}
         */
        createActionButtons(options = {}) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = options.containerClass || 'item-actions';

            if (options.extraButtons && Array.isArray(options.extraButtons)) {
                options.extraButtons.forEach(btn => actionsDiv.appendChild(btn));
            }

            // 1. Кнопка "Поділитись"
            if (options.share) {
                const shareBtn = document.createElement('button');
                shareBtn.className = 'sidebar-action-btn share-btn';
                shareBtn.title = options.share.title || 'Поділитись';
                shareBtn.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="18" cy="5" r="3"></circle>
                        <circle cx="6" cy="12" r="3"></circle>
                        <circle cx="18" cy="19" r="3"></circle>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                `;
                shareBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (options.share.onClick) options.share.onClick(e);
                });
                actionsDiv.appendChild(shareBtn);
            }

            // 2. Кнопка "Редагувати / Перейменувати"
            if (options.edit) {
                const editBtn = document.createElement('button');
                editBtn.className = 'sidebar-action-btn edit-btn';
                editBtn.title = options.edit.title || 'Перейменувати';
                editBtn.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                `;
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (options.edit.onClick) options.edit.onClick(e);
                });
                actionsDiv.appendChild(editBtn);
            }

            // 3. Кнопка "Видалити"
            if (options.delete) {
                const delBtn = document.createElement('button');
                delBtn.className = 'sidebar-action-btn delete-btn';
                delBtn.title = options.delete.title || 'Видалити';
                delBtn.innerHTML = `
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                `;
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (options.delete.onClick) options.delete.onClick(e);
                });
                actionsDiv.appendChild(delBtn);
            }

            return actionsDiv;
        },

        /**
         * Прикріплює інлайн-редагування назви елемента (блокнота або нотатки)
         * @param {HTMLElement} rowElement - Рядок (.board-item або .note-item)
         * @param {HTMLElement} textElement - Текстовий span (.board-item-text або .note-item-title)
         * @param {Object} options
         * @param {Function} options.getCurrentText - функція повернення початкового тексту
         * @param {boolean} [options.allowEmpty=false] - чи дозволено залишати порожнім
         * @param {string} [options.defaultDisplay=''] - текст за замовчуванням при порожньому значенні
         * @param {Function} options.onSave - коллбек збереження (новий_текст)
         * @param {Function} [options.onCancel] - коллбек скасування
         * @returns {Object} { startEditing, finishEditing }
         */
        attachInlineEditor(rowElement, textElement, options = {}) {
            let isEditing = false;

            const finishEditing = () => {
                if (!isEditing || textElement.contentEditable !== 'true') return;
                isEditing = false;
                textElement.contentEditable = 'false';
                rowElement.classList.remove('is-editing');
                textElement.scrollLeft = 0;
                document.removeEventListener('pointerdown', onOutsidePointerDown, true);

                const originalText = options.getCurrentText ? options.getCurrentText() : '';
                const rawNewText = textElement.innerText.replace(/\r?\n|\r/g, ' ').trim();

                if (rawNewText !== originalText) {
                    if (rawNewText === '') {
                        if (options.allowEmpty) {
                            textElement.textContent = options.defaultDisplay || 'Без назви';
                            if (options.onSave) options.onSave('');
                        } else {
                            textElement.textContent = originalText;
                        }
                    } else {
                        textElement.textContent = rawNewText;
                        if (options.onSave) options.onSave(rawNewText);
                    }
                } else {
                    textElement.textContent = rawNewText || (options.defaultDisplay || 'Без назви');
                }
            };

            const onOutsidePointerDown = (evt) => {
                if (!textElement.contains(evt.target)) {
                    finishEditing();
                }
            };

            const startEditing = () => {
                if (isEditing) return;
                isEditing = true;
                rowElement.classList.add('is-editing');
                textElement.contentEditable = 'true';

                const originalText = options.getCurrentText ? options.getCurrentText() : '';
                if (!originalText || !originalText.trim()) {
                    textElement.textContent = '';
                }

                textElement.focus();

                const range = document.createRange();
                range.selectNodeContents(textElement);
                const sel = window.getSelection();
                if (sel) {
                    sel.removeAllRanges();
                    sel.addRange(range);
                }

                setTimeout(() => {
                    document.addEventListener('pointerdown', onOutsidePointerDown, true);
                }, 10);
            };

            textElement.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                startEditing();
            });

            textElement.addEventListener('blur', finishEditing);

            textElement.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    textElement.blur();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    isEditing = false;
                    document.removeEventListener('pointerdown', onOutsidePointerDown, true);
                    rowElement.classList.remove('is-editing');
                    textElement.scrollLeft = 0;
                    const orig = options.getCurrentText ? options.getCurrentText() : '';
                    textElement.textContent = orig.trim() || (options.defaultDisplay || 'Без назви');
                    textElement.contentEditable = 'false';
                    if (options.onCancel) options.onCancel();
                }
            });

            return { startEditing, finishEditing };
        }
    };
})();
