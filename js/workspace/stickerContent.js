// js/workspace/stickerContent.js - Модуль текстового вмісту стікера та обробки форматування/вводу
window.App = window.App || {};

(function() {
    window.App.stickerContent = {
        /**
         * Створює блок контенту для стікера та прив'язує необхідні обробники подій
         * @param {Object} note - Об'єкт нотатки
         * @param {HTMLElement} card - Кореневий DOM-елемент картки
         * @param {boolean} isReadOnly - Прапорець тільки для читання
         * @param {HTMLElement|null} titleDiv - Елемент заголовка для зв'язування подій клавіатури та вставки
         * @returns {HTMLElement} - DOM-елемент .sticker-content
         */
        createContent(note, card, isReadOnly, titleDiv = null) {
            const noteManager = window.App.noteManager;

            const contentDiv = document.createElement('div');
            contentDiv.className = 'sticker-content';
            contentDiv.contentEditable = isReadOnly ? 'false' : 'true';
            contentDiv.spellcheck = false;
            contentDiv.autocapitalize = 'off';
            contentDiv.autocomplete = 'off';
            contentDiv.dataset.placeholder = isReadOnly ? '' : 'Напишіть текст нотатки...';

            // Очищаємо контент від старих вбудованих зображень (щоб вони жили ТІЛЬКИ в галереї)
            let initialContent = note.content || '';
            if (initialContent.includes('sticker-image-wrapper')) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = initialContent;
                const legacyImgs = tempDiv.querySelectorAll('.sticker-image-wrapper');
                if (legacyImgs.length > 0) {
                    note.images = note.images || [];
                    legacyImgs.forEach(w => {
                        const img = w.querySelector('img');
                        if (img && img.src) {
                            note.images.push({
                                id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                                url: img.src,
                                size: w.classList.contains('size-m') ? 'm' : (w.classList.contains('size-l') ? 'l' : 's')
                            });
                        }
                        w.remove();
                    });
                    initialContent = tempDiv.innerHTML;
                    note.content = initialContent;
                    if (noteManager && noteManager.updateNote) {
                        noteManager.updateNote(note.id, { content: initialContent, images: note.images });
                    }
                }
            }

            contentDiv.innerHTML = initialContent;

            function updateContentPlaceholder() {
                if (isReadOnly) return;
                const text = contentDiv.innerText.replace(/\u200B/g, '').trim();
                const hasImg = contentDiv.querySelector('img');
                if (!text && !hasImg) {
                    contentDiv.setAttribute('data-empty', 'true');
                } else {
                    contentDiv.removeAttribute('data-empty');
                }
            }

            updateContentPlaceholder();

            if (!isReadOnly) {
                contentDiv.addEventListener('input', () => {
                    const text = contentDiv.innerText.replace(/\u200B/g, '').trim();
                    if (!text) {
                        contentDiv.innerHTML = '';
                        contentDiv.setAttribute('data-empty', 'true');
                        if (noteManager && noteManager.updateNote) {
                            noteManager.updateNote(note.id, { content: '' });
                        }
                    } else {
                        // Якщо весь текст видалено, але браузер зберіг порожні теги <mark></mark> чи <span></span>
                        if (contentDiv.textContent.trim() === '') {
                            contentDiv.innerHTML = '';
                            contentDiv.setAttribute('data-empty', 'true');
                            if (noteManager && noteManager.updateNote) {
                                noteManager.updateNote(note.id, { content: '' });
                            }
                        } else {
                            contentDiv.removeAttribute('data-empty');
                            if (noteManager && noteManager.updateNote) {
                                noteManager.updateNote(note.id, { content: contentDiv.innerHTML });
                            }
                        }
                    }
                });

                contentDiv.addEventListener('focus', updateContentPlaceholder);
                contentDiv.addEventListener('blur', () => {
                    const text = contentDiv.innerText.replace(/\u200B/g, '').trim();
                    if (!text) {
                        contentDiv.innerHTML = '';
                    }
                    updateContentPlaceholder();
                    if (window.App.storage && window.App.storage.flushNotes) {
                        window.App.storage.flushNotes();
                    }
                });

                // Перед введенням нового символу (beforeinput): якщо нотатка візуально порожня — гарантуємо чистий корінь без залишкових тегів
                contentDiv.addEventListener('beforeinput', () => {
                    const cleanText = contentDiv.innerText.replace(/\u200B/g, '').trim();
                    const hasImg = contentDiv.querySelector('img');

                    // Якщо текст порожній, або користувач виділив весь текст перед заміною
                    const selection = window.getSelection();
                    const isAllSelected = selection && !selection.isCollapsed && selection.toString().trim() === cleanText;

                    if ((!cleanText && !hasImg) || isAllSelected) {
                        // Якщо є залишкові теги mark, span, b
                        if (contentDiv.querySelector('mark, span, b, strong, font')) {
                            contentDiv.innerHTML = '';
                            contentDiv.removeAttribute('data-empty');
                        }
                    }
                });

                // Перехоплення вставки (Paste Ctrl+V): якщо вставляється зображення — автоматично додаємо його в Polaroid-галерею нотатки
                const handlePaste = async (e) => {
                    const clipboardData = e.clipboardData || window.clipboardData;
                    if (!clipboardData) return;

                    const items = Array.from(clipboardData.items || []);
                    const imageFiles = [];

                    for (const item of items) {
                        if (item.type && item.type.indexOf('image') !== -1) {
                            const file = item.getAsFile();
                            if (file) imageFiles.push(file);
                        }
                    }

                    // Якщо файлів напряму в items не було, перевіримо clipboardData.files
                    if (imageFiles.length === 0 && clipboardData.files && clipboardData.files.length > 0) {
                        for (const file of clipboardData.files) {
                            if (file.type && file.type.startsWith('image/')) {
                                imageFiles.push(file);
                            }
                        }
                    }

                    if (imageFiles.length > 0) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (window.App.stickerMenu && window.App.stickerMenu.attachImagesToNote) {
                            await window.App.stickerMenu.attachImagesToNote(note.id, imageFiles, card);
                        }
                    }
                };

                contentDiv.addEventListener('paste', handlePaste);
                if (titleDiv) {
                    titleDiv.addEventListener('paste', handlePaste);
                }

                // При Backspace/Delete якщо нотатка порожня або виділено все — гарантуємо видалення тегів mark
                contentDiv.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' || e.key === 'Delete') {
                        setTimeout(() => {
                            const cleanText = contentDiv.innerText.replace(/\u200B/g, '').trim();
                            const hasImg = contentDiv.querySelector('img');
                            if (!cleanText && !hasImg) {
                                contentDiv.innerHTML = '';
                                contentDiv.setAttribute('data-empty', 'true');
                                if (noteManager && noteManager.updateNote) {
                                    noteManager.updateNote(note.id, { content: '' });
                                }
                            }
                        }, 0);
                    }
                });

                // При переході на новий рядок (Enter) в кінці маркера створюємо чистий абзац
                contentDiv.addEventListener('keydown', (e) => {
                    const selection = window.getSelection();
                    if (!selection || !selection.isCollapsed || selection.rangeCount === 0) return;

                    const range = selection.getRangeAt(0);
                    let markNode = range.startContainer;
                    if (markNode.nodeType === Node.TEXT_NODE) {
                        markNode = markNode.parentElement;
                    }
                    const markEl = markNode ? markNode.closest('mark.note-marker') : null;

                    if (!markEl || !contentDiv.contains(markEl)) return;

                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const br = document.createElement('br');
                        const textNode = document.createTextNode('\u200B');
                        
                        if (markEl.nextSibling) {
                            markEl.parentNode.insertBefore(br, markEl.nextSibling);
                            markEl.parentNode.insertBefore(textNode, br.nextSibling);
                        } else {
                            markEl.parentNode.appendChild(br);
                            markEl.parentNode.appendChild(textNode);
                        }

                        const newRange = document.createRange();
                        newRange.setStartAfter(br);
                        newRange.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                        contentDiv.dispatchEvent(new Event('input'));
                    }
                });

                if (titleDiv) {
                    titleDiv.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            contentDiv.focus();
                        }
                    });
                }
            }

            return contentDiv;
        }
    };
})();
