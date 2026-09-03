// js/workspace/stickerCard.js - Модуль побудови повної DOM-картки стікера
window.App = window.App || {};

(function() {
    window.App.stickerCard = {
        /**
         * Створює повний DOM-елемент стікера нотатки
         * @param {Object} note - Об'єкт нотатки
         * @param {number} colIndex - Порядковий номер колонки
         * @returns {HTMLElement} - DOM елемент card
         */
        createCard(note, colIndex) {
            const state = window.App.state;
            const noteManager = window.App.noteManager;
            const sidebarView = window.App.sidebarView;
            const workspaceView = window.App.workspaceView;

            const card = document.createElement('div');
            card.className = 'note-sticker';
            card.dataset.noteId = note.id;
            card.dataset.parentId = note.parentId || 'root';

            // Перевіряємо чи нотатка належить до спільного (тільки для читання) блокнота
            const currentBoard = window.App.boardManager.getActiveBoard();
            const isReadOnly = !!note.isReadOnly || !!(currentBoard && currentBoard.isReadOnly) || (note.boardId && note.boardId.startsWith('shared_'));

            if (isReadOnly) {
                card.classList.add('is-readonly');
            }

            // Застосовуємо збережений або дефолтний колір стікера
            const noteColor = note.color || 'yellow';
            card.classList.add(`color-${noteColor}`);

            // Застосовуємо збережений або дефолтний розмір шрифту
            const rawFontSize = note.fontSize;
            if (typeof rawFontSize === 'number') {
                const stepIdx = rawFontSize <= 12 ? 0 : rawFontSize <= 16 ? 1 : rawFontSize <= 24 ? 2 : 3;
                card.dataset.fontStep = stepIdx;
                card.style.setProperty('--custom-content-font-size', `${rawFontSize}px`);
                card.style.setProperty('--custom-title-font-size', `${Math.round(rawFontSize * 1.85)}px`);
                card.style.setProperty('--custom-line-height', `${Math.round(rawFontSize * 1.9)}px`);
                card.classList.add('has-custom-font-size');
            } else if (rawFontSize === 'small' || rawFontSize === 'medium' || rawFontSize === 'large') {
                card.classList.add(`font-size-${rawFontSize}`);
            }

            // Чекбокс вибору у стилі iOS Галереї (круглий з галочкою)
            const selectCheckbox = document.createElement('div');
            selectCheckbox.className = 'sticker-select-checkbox';
            selectCheckbox.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
            card.appendChild(selectCheckbox);

            if (state.isWorkspaceSelectMode) {
                card.classList.add('in-select-mode');
                if (state.selectedWorkspaceNoteIds.has(note.id)) {
                    card.classList.add('is-ws-selected');
                }
            }

            // Клік по картці в режимі вибору перемикає виділення (як в iOS галереї)
            card.addEventListener('click', (e) => {
                if (window.App.state.isWorkspaceSelectMode) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.App.workspaceSelectionBar) {
                        window.App.workspaceSelectionBar.toggleNoteSelection(note.id);
                    }
                }
            }, true);

            // Смужка перфорації з дірочками по лівому краю (ручка перетягування)
            const perforationHandle = document.createElement('div');
            perforationHandle.className = 'sticker-perforation-handle';
            perforationHandle.title = 'Перетягніть для зміни порядку';
            card.appendChild(perforationHandle);

            // Header
            const header = document.createElement('div');
            header.className = 'sticker-header';

            const titleWrap = document.createElement('div');
            titleWrap.className = 'sticker-title-wrap';

            // 1. Notion-емодзі пікер (тільки для редагованих нотаток)
            let emojiWrap;
            if (!isReadOnly) {
                emojiWrap = window.App.emojiPicker.createEmojiPicker(note, (newIcon) => {
                    sidebarView.updateNoteListItem(note.id, note.title, newIcon);
                });
            } else {
                emojiWrap = document.createElement('span');
                emojiWrap.className = 'sticker-header-icon';
                emojiWrap.textContent = note.icon || '📄';
                emojiWrap.style.marginRight = '6px';
                emojiWrap.style.fontSize = '15px';
            }

            // 2. Заголовок нотатки
            const titleDiv = document.createElement('div');
            titleDiv.className = 'sticker-title';
            titleDiv.contentEditable = isReadOnly ? 'false' : 'true';
            titleDiv.spellcheck = false;
            titleDiv.autocapitalize = 'off';
            titleDiv.autocomplete = 'off';
            titleDiv.dataset.placeholder = isReadOnly ? '' : 'Заголовок...';
            titleDiv.innerText = note.title || '';

            function updateTitlePlaceholder() {
                if (isReadOnly) return;
                if (titleDiv.textContent.trim() === '') {
                    titleDiv.setAttribute('data-empty', 'true');
                } else {
                    titleDiv.removeAttribute('data-empty');
                }
            }

            updateTitlePlaceholder();

            if (!isReadOnly) {
                titleDiv.addEventListener('input', () => {
                    updateTitlePlaceholder();
                    const text = titleDiv.innerText.replace(/\r?\n|\r/g, ' ').trim();
                    noteManager.updateNote(note.id, { title: text });
                    sidebarView.updateNoteListItem(note.id, text, note.icon);
                });

                titleDiv.addEventListener('focus', updateTitlePlaceholder);
                titleDiv.addEventListener('blur', updateTitlePlaceholder);
            }

            titleWrap.appendChild(emojiWrap);
            titleWrap.appendChild(titleDiv);

            // 3. Меню та кнопки дій
            const actions = document.createElement('div');
            actions.className = 'sticker-actions';

            const childNotes = noteManager.getNotesForColumn(note.id);
            const childCount = childNotes.length;
            const isChainOpen = state.activeChain[colIndex + 1] === note.id;

            if (isChainOpen) {
                card.classList.add('active-parent-note');
            }

            // Меню "три крапки"
            let menuDropdownWrap = null;
            if (!isReadOnly) {
                menuDropdownWrap = window.App.stickerMenu.createMenu(note, card, colIndex, isChainOpen);
            }

            // Ручка перетягування (Drag Handle)
            const dragHandle = document.createElement('div');
            dragHandle.className = 'sticker-drag-handle';
            dragHandle.title = 'Перетягніть для зміни порядку або між колонками';
            dragHandle.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="8" cy="4" r="2"></circle>
                    <circle cx="8" cy="12" r="2"></circle>
                    <circle cx="8" cy="20" r="2"></circle>
                    <circle cx="16" cy="4" r="2"></circle>
                    <circle cx="16" cy="12" r="2"></circle>
                    <circle cx="16" cy="20" r="2"></circle>
                </svg>
            `;

            // Кнопка швидкого видалення
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'sticker-delete-btn';
            deleteBtn.title = 'Видалити нотатку';
            deleteBtn.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18"></path>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            `;
            deleteBtn.addEventListener('click', (e) => noteManager.deleteNote(note.id, e));

            if (menuDropdownWrap) actions.appendChild(menuDropdownWrap);
            if (!isReadOnly) {
                actions.appendChild(dragHandle);
                actions.appendChild(deleteBtn);
            }
            header.appendChild(titleWrap);
            header.appendChild(actions);

            // 4. Текст нотатки (Content)
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
                    noteManager.updateNote(note.id, { content: initialContent, images: note.images });
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
                        noteManager.updateNote(note.id, { content: '' });
                    } else {
                        // Якщо весь текст видалено, але браузер зберіг порожні теги <mark></mark> чи <span></span>
                        if (contentDiv.textContent.trim() === '') {
                            contentDiv.innerHTML = '';
                            contentDiv.setAttribute('data-empty', 'true');
                            noteManager.updateNote(note.id, { content: '' });
                        } else {
                            contentDiv.removeAttribute('data-empty');
                            noteManager.updateNote(note.id, { content: contentDiv.innerHTML });
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
            }

            if (!isReadOnly) {
                // Перед введенням нового символу (beforeinput): якщо нотатка візуально порожня — гарантуємо чистий корінь без залишкових тегів
                contentDiv.addEventListener('beforeinput', (e) => {
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
                titleDiv.addEventListener('paste', handlePaste);

                // При Backspace/Delete якщо нотатка порожня або виділено все — гарантуємо видалення тегів mark
                contentDiv.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' || e.key === 'Delete') {
                        setTimeout(() => {
                            const cleanText = contentDiv.innerText.replace(/\u200B/g, '').trim();
                            const hasImg = contentDiv.querySelector('img');
                            if (!cleanText && !hasImg) {
                                contentDiv.innerHTML = '';
                                contentDiv.setAttribute('data-empty', 'true');
                                noteManager.updateNote(note.id, { content: '' });
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

                titleDiv.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        contentDiv.focus();
                    }
                });
            }

            card.appendChild(header);
            card.appendChild(contentDiv);

            // 4.5 Окрема галерея фотографій (Non-editable область суто для Polaroid карток)
            const galleryContainer = document.createElement('div');
            galleryContainer.className = 'sticker-images-gallery';
            galleryContainer.contentEditable = 'false';

            const noteImages = Array.isArray(note.images) ? note.images : [];
            if (noteImages.length > 0) {
                noteImages.forEach(async (imgData) => {
                    const imgWrap = document.createElement('div');
                    imgWrap.className = `sticker-image-wrapper size-${imgData.size || 'm'}`;
                    imgWrap.dataset.imgId = imgData.id;
                    imgWrap.innerHTML = `
                        ${!isReadOnly ? `
                        <div class="sticker-image-toolbar">
                            <div class="sticker-img-size-group">
                                <button class="img-size-btn ${imgData.size === 's' ? 'active' : ''}" data-size="s" title="Малий розмір (S)">S</button>
                                <button class="img-size-btn ${imgData.size === 'm' || !imgData.size ? 'active' : ''}" data-size="m" title="Середній розмір (M)">M</button>
                                <button class="img-size-btn ${imgData.size === 'l' ? 'active' : ''}" data-size="l" title="Повний розмір (L)">L</button>
                            </div>
                            <button class="sticker-image-remove-btn" title="Видалити фото">×</button>
                        </div>` : ''}
                        <img src="${imgData.url || ''}" class="sticker-embedded-img" alt="Attached image" loading="lazy">
                    `;

                    // Якщо url ще немає в note (бо зберігається в IndexedDB), завантажуємо з IndexedDB
                    if (!imgData.url && window.App.imageDb) {
                        const imgEl = imgWrap.querySelector('.sticker-embedded-img');
                        window.App.imageDb.getImage(imgData.id).then(loadedUrl => {
                            if (loadedUrl && imgEl) {
                                imgEl.src = loadedUrl;
                            }
                        });
                    }

                    if (!isReadOnly && window.App.stickerMenu && window.App.stickerMenu.initGalleryImageControls) {
                        window.App.stickerMenu.initGalleryImageControls(imgWrap, note.id);
                    }
                    galleryContainer.appendChild(imgWrap);
                });
            } else {
                galleryContainer.style.display = 'none';
            }

            card.appendChild(galleryContainer);

            // 5. Washi Tape теги
            const tagsContainer = window.App.stickerTags.createTagsContainer(note, card, isReadOnly);
            card.appendChild(tagsContainer);

            // 6. Інтерактивний блок списку піднотаток (якщо є)
            if (childCount > 0) {
                const subnotesBox = document.createElement('div');
                subnotesBox.className = `sticker-subnotes-container ${isChainOpen ? 'is-expanded' : ''}`;
                subnotesBox.title = isChainOpen ? 'Приховати колонку піднотаток' : 'Відкрити колонку піднотаток';

                const subnotesHeader = document.createElement('div');
                subnotesHeader.className = 'sticker-subnotes-header';
                subnotesHeader.innerHTML = `
                    <div class="subnotes-header-left">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                        </svg>
                        <span>Піднотатки</span>
                        <span class="subnotes-pill-badge">${childCount}</span>
                    </div>
                    <div class="subnotes-header-right">
                        <span class="subnotes-toggle-status">${isChainOpen ? 'Відкрито' : 'Переглянути'}</span>
                    </div>
                `;

                const previewList = document.createElement('div');
                previewList.className = 'sticker-subnotes-preview-list';

                const maxPreview = 3;
                childNotes.slice(0, maxPreview).forEach(child => {
                    const item = document.createElement('div');
                    item.className = 'subnotes-preview-item';
                    item.innerHTML = `
                        <span class="subnotes-preview-bullet">•</span>
                        <span class="subnotes-preview-icon">${child.icon || '📄'}</span>
                        <span class="subnotes-preview-title">${child.title ? child.title.trim() : 'Без назви'}</span>
                    `;
                    previewList.appendChild(item);
                });

                if (childCount > maxPreview) {
                    const moreItem = document.createElement('div');
                    moreItem.className = 'subnotes-preview-more';
                    moreItem.textContent = `+ ще ${childCount - maxPreview}...`;
                    previewList.appendChild(moreItem);
                }

                subnotesBox.appendChild(subnotesHeader);
                subnotesBox.appendChild(previewList);

                subnotesBox.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (workspaceView) {
                        workspaceView.toggleChain(note.id, colIndex);
                    }
                });

                card.appendChild(subnotesBox);
            }

            // Виклик тулбоксу/меню нотатки на ПКМ (Правий клік мишкою) - Тільки для власних редагованих нотаток
            if (!isReadOnly) {
                card.addEventListener('contextmenu', (e) => {
                    // Якщо користувач виділив текст у нотатці — не блокуємо виділення
                    const selection = window.getSelection();
                    if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
                        return;
                    }

                    e.preventDefault();
                    e.stopPropagation();

                    const moreBtn = card.querySelector('.sticker-more-btn');
                    const menuDropdown = card.querySelector('.sticker-menu-dropdown');

                    // Закриваємо всі інші відкриті меню
                    document.querySelectorAll('.sticker-menu-dropdown.active, .sticker-emoji-picker-dropdown.active, .sticker-tag-dropdown.active, .column-filter-dropdown.active, .sidebar-context-menu').forEach(d => {
                        if (d !== menuDropdown) d.classList.remove('active', 'open-upward');
                    });

                    if (menuDropdown && moreBtn) {
                        if (window.App.smartPositionDropdown) {
                            window.App.smartPositionDropdown(moreBtn, menuDropdown, 160);
                        }
                        menuDropdown.classList.add('active');
                    }
                });
            }

            // Ініціалізація перетягування (Drag & Drop) стікера на робочому просторі (тільки для власних редагованих нотаток)
            if (!isReadOnly && window.App.initStickerDrag) {
                window.App.initStickerDrag(card, [perforationHandle, dragHandle], note.parentId || null);
            }

            return card;
        }
    };
})();
