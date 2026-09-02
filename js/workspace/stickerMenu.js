// js/workspace/stickerMenu.js - Модуль випадаючого меню трьох крапок стікера (кольори, копіювання, піднотатки)
window.App = window.App || {};

(function() {
    window.App.stickerMenu = {
        /**
         * Будує DOM-елемент випадаючого списку дій для нотатки
         * @param {Object} note - Об'єкт нотатки
         * @param {HTMLElement|null} card - DOM-елемент картки (якщо є)
         * @param {number} colIndex - Індекс колонки
         * @param {boolean} isChainOpen - Чи відкритий ланцюжок піднотаток
         * @param {Function} onClose - Коллбек при закритті меню
         * @returns {HTMLElement} - DOM елемент menuDropdown
         */
        createDropdown(note, card, colIndex = 0, isChainOpen = false, onClose = null) {
            const noteManager = window.App.noteManager;
            const workspaceView = window.App.workspaceView;

            const childNotes = noteManager.getNotesForColumn(note.id);
            const childCount = childNotes.length;

            const menuDropdown = document.createElement('div');
            menuDropdown.className = 'sticker-menu-dropdown';

            // 0. Заголовок нотатки та дата додавання
            const headerInfo = document.createElement('div');
            headerInfo.className = 'sticker-menu-header-info';

            const rawTitle = (note.title && note.title.trim()) ? note.title.trim() : 'Без назви';
            const noteIcon = note.icon || '';
            const timestamp = note.createdAt || (note.id.startsWith('note_') ? parseInt(note.id.split('_')[1], 10) : note.updatedAt) || Date.now();
            
            let dateStr = '';
            try {
                const d = new Date(timestamp);
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                dateStr = `${day}.${month}.${year}, ${hours}:${minutes}`;
            } catch (e) {
                dateStr = 'Нещодавно';
            }

            headerInfo.innerHTML = `
                <div class="sticker-menu-header-title">
                    ${noteIcon ? `<span class="sticker-menu-header-icon">${noteIcon}</span>` : ''}
                    <span class="sticker-menu-header-text" title="${rawTitle}">${rawTitle}</span>
                </div>
                <div class="sticker-menu-header-date">Створено: ${dateStr}</div>
            `;

            menuDropdown.appendChild(headerInfo);

            const divider0 = document.createElement('div');
            divider0.className = 'sticker-menu-divider';
            menuDropdown.appendChild(divider0);

            // Секція: Палітра кольорів
            const colorTitle = document.createElement('div');
            colorTitle.className = 'sticker-menu-section-title';
            colorTitle.textContent = 'Колір стікера';

            const colorPalette = document.createElement('div');
            colorPalette.className = 'sticker-color-palette';

            const colors = window.App.NOTE_COLORS || [
                { id: 'yellow', hex: '#fef08a', name: 'Жовтий' },
                { id: 'green',  hex: '#bbf7d0', name: 'Зелений' },
                { id: 'blue',   hex: '#bae6fd', name: 'Блакитний' },
                { id: 'purple', hex: '#e9d5ff', name: 'Фіолетовий' },
                { id: 'pink',   hex: '#fbcfe8', name: 'Рожевий' },
                { id: 'orange', hex: '#fed7aa', name: 'Помаранчевий' },
                { id: 'gray',   hex: '#e2e8f0', name: 'Сірий' }
            ];

            const activeColor = note.color || 'yellow';

            colors.forEach(c => {
                const swatch = document.createElement('button');
                swatch.className = `color-swatch-btn ${c.id === activeColor ? 'active' : ''}`;
                swatch.style.backgroundColor = c.hex;
                swatch.title = c.name;

                swatch.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (card) {
                        colors.forEach(clr => card.classList.remove(`color-${clr.id}`));
                        card.classList.add(`color-${c.id}`);
                    }

                    colorPalette.querySelectorAll('.color-swatch-btn').forEach(btn => btn.classList.remove('active'));
                    swatch.classList.add('active');

                    noteManager.updateNote(note.id, { color: c.id });
                    note.color = c.id;
                    menuDropdown.classList.remove('active');
                    if (onClose) onClose();
                });

                colorPalette.appendChild(swatch);
            });

            menuDropdown.appendChild(colorTitle);
            menuDropdown.appendChild(colorPalette);

            // Секція: Розмір шрифту (повзунок з 4 шкалами: 12, 16, 24, 32)
            const FONT_SIZES = window.App.FONT_SIZES || [12, 16, 24, 32];
            const FONT_LABELS = window.App.FONT_LABELS || ['S (12px)', 'M (16px)', 'L (24px)', 'XL (32px)'];
            const rawSizePx = typeof note.fontSize === 'number' ? note.fontSize : (note.fontSize === 'small' ? 12 : (note.fontSize === 'large' ? 24 : 16));
            
            let closestStepIdx = 1; // 16px за замовчуванням
            let minDiff = Infinity;
            FONT_SIZES.forEach((size, idx) => {
                const diff = Math.abs(size - rawSizePx);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestStepIdx = idx;
                }
            });

            const currentSizePx = FONT_SIZES[closestStepIdx];

            const fontSizeHeader = document.createElement('div');
            fontSizeHeader.className = 'sticker-menu-section-title sticker-font-size-header';

            const fontSizeTitle = document.createElement('span');
            fontSizeTitle.textContent = 'Розмір тексту';

            const fontSizeValueBadge = document.createElement('span');
            fontSizeValueBadge.className = 'font-size-value-badge';
            fontSizeValueBadge.textContent = FONT_LABELS[closestStepIdx];

            fontSizeHeader.appendChild(fontSizeTitle);
            fontSizeHeader.appendChild(fontSizeValueBadge);

            const sliderContainer = document.createElement('div');
            sliderContainer.className = 'sticker-font-slider-container';

            sliderContainer.innerHTML = `
                <span class="slider-min-icon">A</span>
                <div class="note-font-slider-track-wrap">
                    <input type="range" class="sticker-font-slider" min="0" max="3" step="1" value="${closestStepIdx}">
                    <div class="note-font-slider-ticks">
                        <span class="note-font-tick-line ${closestStepIdx === 0 ? 'active' : ''}" data-step="0" title="S"></span>
                        <span class="note-font-tick-line ${closestStepIdx === 1 ? 'active' : ''}" data-step="1" title="M"></span>
                        <span class="note-font-tick-line ${closestStepIdx === 2 ? 'active' : ''}" data-step="2" title="L"></span>
                        <span class="note-font-tick-line ${closestStepIdx === 3 ? 'active' : ''}" data-step="3" title="XL"></span>
                    </div>
                </div>
                <span class="slider-max-icon">A</span>
            `;

            const sliderInput = sliderContainer.querySelector('.sticker-font-slider');
            const tickLines = sliderContainer.querySelectorAll('.note-font-tick-line');

            const applySize = (stepIdx) => {
                const newSize = FONT_SIZES[stepIdx];
                fontSizeValueBadge.textContent = FONT_LABELS[stepIdx];
                tickLines.forEach((t, i) => t.classList.toggle('active', i === stepIdx));

                if (card) {
                    card.dataset.fontStep = stepIdx;
                    card.style.setProperty('--custom-content-font-size', `${newSize}px`);
                    card.style.setProperty('--custom-title-font-size', `${Math.round(newSize * 1.5)}px`);
                    card.style.setProperty('--custom-line-height', `${Math.max(26, Math.round(newSize * 1.7))}px`);
                    card.classList.add('has-custom-font-size');
                }

                noteManager.updateNote(note.id, { fontSize: newSize });
                note.fontSize = newSize;
            };

            sliderInput.addEventListener('input', (e) => {
                e.stopPropagation();
                const stepIdx = Math.max(0, Math.min(3, parseInt(e.target.value, 10) || 0));
                applySize(stepIdx);
            });

            tickLines.forEach(tick => {
                tick.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const stepIdx = parseInt(tick.dataset.step, 10);
                    sliderInput.value = stepIdx;
                    applySize(stepIdx);
                });
            });

            sliderInput.addEventListener('click', (e) => e.stopPropagation());

            menuDropdown.appendChild(fontSizeHeader);
            menuDropdown.appendChild(sliderContainer);

            // Пункт "Додати піднотатку"
            const addSubnoteItem = document.createElement('div');
            addSubnoteItem.className = 'sticker-menu-item';
            addSubnoteItem.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>Додати піднотатку</span>
            `;
            addSubnoteItem.addEventListener('click', (e) => {
                e.stopPropagation();
                menuDropdown.classList.remove('active');
                if (onClose) onClose();
                if (!isChainOpen && workspaceView) {
                    workspaceView.toggleChain(note.id, colIndex);
                }
                setTimeout(() => noteManager.createNewNote(note.id, true), 80);
            });
            menuDropdown.appendChild(addSubnoteItem);

            // Пункт "Додати зображення"
            const addImageMenuItem = document.createElement('div');
            addImageMenuItem.className = 'sticker-menu-item';
            addImageMenuItem.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
                    <circle cx="9" cy="9" r="2"></circle>
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
                </svg>
                <span>Додати фото</span>
            `;

            // Прихований input для вибору файлів (підтримує декілька фото одночасно)
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.multiple = true;
            fileInput.style.display = 'none';

            fileInput.addEventListener('change', async (e) => {
                const files = Array.from(e.target.files || []);
                if (files.length === 0) return;
                await window.App.stickerMenu.attachImagesToNote(note.id, files, card);
                fileInput.value = '';
            });

            addImageMenuItem.appendChild(fileInput);

            addImageMenuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                menuDropdown.classList.remove('active');
                if (onClose) onClose();
                fileInput.click();
            });

            menuDropdown.appendChild(addImageMenuItem);

            // Пункт "Додати тег"
            const addTagMenuItem = document.createElement('div');
            addTagMenuItem.className = 'sticker-menu-item';
            addTagMenuItem.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                    <line x1="7" y1="7" x2="7.01" y2="7"></line>
                </svg>
                <span>Додати тег</span>
            `;
            addTagMenuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                menuDropdown.classList.remove('active');
                if (onClose) onClose();

                // Якщо клікнули з картки на робочому просторі
                if (card) {
                    const tagsBox = card.querySelector('.sticker-tags-container');
                    if (tagsBox) tagsBox.style.display = 'flex';

                    setTimeout(() => {
                        const addBtn = card.querySelector('.sticker-add-tag-btn');
                        const tagDropdown = card.querySelector('.sticker-tag-dropdown');
                        if (addBtn && tagDropdown) {
                            if (typeof tagDropdown.refreshContent === 'function') tagDropdown.refreshContent();
                            if (window.App.smartPositionDropdown) {
                                window.App.smartPositionDropdown(addBtn, tagDropdown, 160);
                            }
                            tagDropdown.classList.add('active');
                            addBtn.classList.add('active');
                            const addInput = tagDropdown.querySelector('.tag-add-input');
                            if (addInput) addInput.focus();
                        }
                    }, 60);
                }
            });
            menuDropdown.appendChild(addTagMenuItem);

            // Пункт "Дублювати нотатку"
            const duplicateItem = document.createElement('div');
            duplicateItem.className = 'sticker-menu-item';
            duplicateItem.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Дублювати нотатку</span>
            `;
            duplicateItem.addEventListener('click', (e) => {
                e.stopPropagation();
                menuDropdown.classList.remove('active');
                if (onClose) onClose();
                noteManager.duplicateNote(note.id);
            });
            menuDropdown.appendChild(duplicateItem);

            // Пункт "Видалити нотатку"
            const deleteItem = document.createElement('div');
            deleteItem.className = 'sticker-menu-item sticker-menu-item-delete';
            deleteItem.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18"></path>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>Видалити нотатку</span>
            `;
            deleteItem.addEventListener('click', (e) => {
                e.stopPropagation();
                menuDropdown.classList.remove('active');
                if (onClose) onClose();
                noteManager.deleteNote(note.id, e);
            });
            menuDropdown.appendChild(deleteItem);

            // Пункт "Піднотатки (к-сть)" якщо є піднотатки
            if (childCount > 0) {
                const viewSubnotesItem = document.createElement('div');
                viewSubnotesItem.className = `sticker-menu-item ${isChainOpen ? 'active' : ''}`;
                viewSubnotesItem.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                    <span>${isChainOpen ? 'Закрити' : 'Піднотатки'}</span>
                    <span class="menu-item-badge">${childCount}</span>
                `;
                viewSubnotesItem.addEventListener('click', (e) => {
                    e.stopPropagation();
                    menuDropdown.classList.remove('active');
                    if (onClose) onClose();
                    if (workspaceView) {
                        workspaceView.toggleChain(note.id, colIndex);
                    }
                });
                menuDropdown.appendChild(viewSubnotesItem);
            }

            return menuDropdown;
        },

        /**
         * Створює блок кнопки "три крапки" та випадаючого меню для стікера
         * @param {Object} note - Об'єкт нотатки
         * @param {HTMLElement} card - DOM-елемент картки
         * @param {number} colIndex - Індекс колонки
         * @param {boolean} isChainOpen - Чи відкритий ланцюжок піднотаток
         * @returns {HTMLElement} - DOM елемент menuDropdownWrap
         */
        createMenu(note, card, colIndex, isChainOpen) {
            const noteManager = window.App.noteManager;
            const childNotes = noteManager.getNotesForColumn(note.id);
            const childCount = childNotes.length;

            const menuDropdownWrap = document.createElement('div');
            menuDropdownWrap.className = 'sticker-menu-wrap';

            const moreBtn = document.createElement('button');
            moreBtn.className = `sticker-more-btn ${isChainOpen ? 'has-active-chain' : ''}`;
            moreBtn.title = 'Опції нотатки';
            moreBtn.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="2.2"></circle>
                    <circle cx="19" cy="12" r="2.2"></circle>
                    <circle cx="5" cy="12" r="2.2"></circle>
                </svg>
                ${childCount > 0 ? `<span class="more-subnotes-dot"></span>` : ''}
            `;

            const menuDropdown = this.createDropdown(note, card, colIndex, isChainOpen);

            moreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.sticker-menu-dropdown.active, .sticker-emoji-picker-dropdown.active, .sticker-tag-dropdown.active, .column-filter-dropdown.active').forEach(d => {
                    if (d !== menuDropdown) d.classList.remove('active', 'open-upward');
                });

                const willOpen = !menuDropdown.classList.contains('active');
                if (willOpen) {
                    if (window.App.smartPositionDropdown) {
                        window.App.smartPositionDropdown(moreBtn, menuDropdown, 160);
                    }
                    menuDropdown.classList.add('active');
                } else {
                    menuDropdown.classList.remove('active', 'open-upward');
                }
            });

            menuDropdownWrap.appendChild(moreBtn);
            menuDropdownWrap.appendChild(menuDropdown);

            return menuDropdownWrap;
        },

        /**
         * Ініціалізує панель керування фото в окремій галереї нотатки (S / M / L, видалення, Lightbox)
         */
        initGalleryImageControls(imgWrap, noteId) {
            const noteManager = window.App.noteManager;
            const sizeBtns = imgWrap.querySelectorAll('.img-size-btn');
            const rmBtn = imgWrap.querySelector('.sticker-image-remove-btn');
            const img = imgWrap.querySelector('.sticker-embedded-img');
            const imgId = imgWrap.dataset.imgId;

            // Перемикання розмірів S / M / L
            sizeBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const size = btn.dataset.size;
                    imgWrap.classList.remove('size-s', 'size-m', 'size-l');
                    imgWrap.classList.add(`size-${size}`);
                    sizeBtns.forEach(b => b.classList.toggle('active', b === btn));

                    const note = noteManager.getNoteById(noteId);
                    if (note && Array.isArray(note.images)) {
                        const targetImg = note.images.find(im => im.id === imgId);
                        if (targetImg) targetImg.size = size;
                        noteManager.updateNote(noteId, { images: note.images });
                    }

                    if (window.App.historyManager) {
                        window.App.historyManager.recordState('change_image_size');
                    }
                });
            });

            // Видалення фото
            if (rmBtn) {
                rmBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    const parentGallery = imgWrap.parentNode;
                    imgWrap.remove();

                    const note = noteManager.getNoteById(noteId);
                    if (note && Array.isArray(note.images)) {
                        const updatedImages = note.images.filter(im => im.id !== imgId);
                        noteManager.updateNote(noteId, { images: updatedImages });
                        if (updatedImages.length === 0 && parentGallery) {
                            parentGallery.style.display = 'none';
                        }
                    }

                    // Видаляємо з бази IndexedDB
                    if (window.App.imageDb) {
                        window.App.imageDb.deleteImage(imgId);
                    }

                    // Видаляємо файл з хмарного сховища Supabase Storage
                    if (window.App.cloudSync && window.App.cloudSync.deleteImageFile) {
                        window.App.cloudSync.deleteImageFile(imgId);
                    }

                    if (window.App.historyManager) {
                        window.App.historyManager.recordState('remove_image');
                    }
                });
            }

            // Забороняємо браузерне перетягування самого зображення <img> всередині Polaroid
            if (img) {
                img.draggable = false;
                img.addEventListener('dragstart', (e) => e.preventDefault());

                // Клік по фото для повноекранного перегляду (Lightbox)
                img.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openImageLightbox(img.src);
                });
            }

            // Перетягування саме всієї Polaroid-картки (imgWrap) та миттєвий СВАП
            imgWrap.draggable = true;

            imgWrap.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                window._activeDraggingPhotoWrap = imgWrap;
                window._activeDraggingPhotoId = imgId;
                imgWrap.classList.add('is-dragging-photo');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', imgId);

                // Налаштовуємо акуратну картинку перетягування саме всієї картки Polaroid
                if (e.dataTransfer.setDragImage) {
                    const rect = imgWrap.getBoundingClientRect();
                    e.dataTransfer.setDragImage(imgWrap, rect.width / 2, 20);
                }
            });

            imgWrap.addEventListener('dragend', (e) => {
                e.stopPropagation();
                imgWrap.classList.remove('is-dragging-photo');
                window._activeDraggingPhotoWrap = null;
                window._activeDraggingPhotoId = null;
                document.querySelectorAll('.sticker-image-wrapper.drag-over-photo').forEach(el => {
                    el.classList.remove('drag-over-photo');
                });
            });

            imgWrap.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                const draggingWrap = window._activeDraggingPhotoWrap;
                if (draggingWrap && draggingWrap !== imgWrap && draggingWrap.parentNode === imgWrap.parentNode) {
                    if (!imgWrap.classList.contains('drag-over-photo')) {
                        imgWrap.classList.add('drag-over-photo');
                    }
                }
            });

            imgWrap.addEventListener('dragleave', (e) => {
                e.stopPropagation();
                imgWrap.classList.remove('drag-over-photo');
            });

            imgWrap.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                imgWrap.classList.remove('drag-over-photo');

                const draggedWrap = window._activeDraggingPhotoWrap;
                const draggedId = window._activeDraggingPhotoId || e.dataTransfer.getData('text/plain');
                if (!draggedWrap || !draggedId || draggedId === imgId) return;

                const parentGallery = imgWrap.parentNode;
                if (!parentGallery || draggedWrap.parentNode !== parentGallery) return;

                // 🔄 МИТТЄВИЙ СВАП (Обмін двох фотографій місцями в DOM)
                const nextSiblingOfTarget = imgWrap.nextSibling === draggedWrap ? imgWrap : imgWrap.nextSibling;
                parentGallery.insertBefore(imgWrap, draggedWrap);
                parentGallery.insertBefore(draggedWrap, nextSiblingOfTarget);

                // Оновлюємо порядок у стані note.images
                const note = noteManager.getNoteById(noteId);
                if (note && Array.isArray(note.images)) {
                    const newOrderIds = Array.from(parentGallery.querySelectorAll('.sticker-image-wrapper')).map(w => w.dataset.imgId);
                    const reorderedImages = [];
                    newOrderIds.forEach(id => {
                        const found = note.images.find(im => im.id === id);
                        if (found) reorderedImages.push(found);
                    });
                    note.images = reorderedImages;
                    noteManager.updateNote(noteId, { images: reorderedImages });
                    if (window.App.storage && window.App.storage.flushNotes) {
                        window.App.storage.flushNotes();
                    }
                    if (window.App.historyManager) {
                        window.App.historyManager.recordState('swap_images');
                    }
                }
            });
        },

        /**
         * Універсальне додавання зображень (через вибір файлу або Paste Ctrl+V) у галерею нотатки
         */
        async attachImagesToNote(noteId, files, card = null) {
            const noteManager = window.App.noteManager;
            if (!noteId || !files || files.length === 0) return;

            if (!card) {
                card = document.querySelector(`.note-sticker[data-note-id="${noteId}"]`);
            }
            if (!card) return;

            const galleryContainer = card.querySelector('.sticker-images-gallery');
            if (!galleryContainer) return;

            const currentNote = noteManager.getNoteById(noteId);
            if (!currentNote) return;

            const images = Array.isArray(currentNote.images) ? [...currentNote.images] : [];

            // Автоматичне стиснення зображень перед збереженням
            const compressImage = (file) => {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const img = new Image();
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const MAX_DIM = 1200;
                            let w = img.width;
                            let h = img.height;

                            if (w > MAX_DIM || h > MAX_DIM) {
                                if (w > h) {
                                    h = Math.round((h * MAX_DIM) / w);
                                    w = MAX_DIM;
                                } else {
                                    w = Math.round((w * MAX_DIM) / h);
                                    h = MAX_DIM;
                                }
                            }

                            canvas.width = w;
                            canvas.height = h;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, w, h);

                            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
                            resolve(compressedDataUrl);
                        };
                        img.src = e.target.result;
                    };
                    reader.readAsDataURL(file);
                });
            };

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (!file.type || !file.type.startsWith('image/')) continue;

                const base64Url = await compressImage(file);
                const newImgId = 'img_' + Date.now().toString() + '_' + i + '_' + Math.random().toString(36).substr(2, 4);

                // Зберігаємо фото в локальну IndexedDB для миттєвого відображення оффлайн
                if (window.App.imageDb) {
                    await window.App.imageDb.saveImage(newImgId, base64Url);
                }

                // Якщо користувач авторизований — вивантажуємо фото у Supabase Storage Bucket
                let cloudUrl = null;
                if (window.App.cloudSync && window.App.cloudSync.isLoggedIn()) {
                    cloudUrl = await window.App.cloudSync.uploadImageFile(file, newImgId);
                }

                const imgObj = {
                    id: newImgId,
                    url: cloudUrl || undefined,
                    size: 'm'
                };

                images.push(imgObj);

                const imgWrap = document.createElement('div');
                imgWrap.className = 'sticker-image-wrapper size-m';
                imgWrap.dataset.imgId = newImgId;
                imgWrap.innerHTML = `
                    <div class="sticker-image-toolbar">
                        <div class="sticker-img-size-group">
                            <button class="img-size-btn" data-size="s" title="Малий розмір (S)">S</button>
                            <button class="img-size-btn active" data-size="m" title="Середній розмір (M)">M</button>
                            <button class="img-size-btn" data-size="l" title="Повний розмір (L)">L</button>
                        </div>
                        <button class="sticker-image-remove-btn" title="Видалити фото">×</button>
                    </div>
                    <img src="${base64Url}" class="sticker-embedded-img" alt="Attached image" loading="lazy">
                `;

                this.initGalleryImageControls(imgWrap, noteId);
                galleryContainer.appendChild(imgWrap);
            }

            galleryContainer.style.display = 'flex';
            noteManager.updateNote(noteId, { images: images });
            if (window.App.storage && window.App.storage.flushNotes) {
                window.App.storage.flushNotes();
            }

            if (window.App.historyManager) {
                window.App.historyManager.recordState('add_images');
            }
        },

        /**
         * Відкриває повноекранний Lightbox для перегляду фото
         */
        openImageLightbox(src) {
            const existing = document.getElementById('polaroid-lightbox-modal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.id = 'polaroid-lightbox-modal';
            modal.className = 'polaroid-lightbox-modal';
            modal.innerHTML = `
                <div class="polaroid-lightbox-backdrop"></div>
                <div class="polaroid-lightbox-card">
                    <img src="${src}" class="polaroid-lightbox-img" alt="Enlarged photo">
                    <button class="polaroid-lightbox-close" title="Закрити (Esc)">×</button>
                </div>
            `;

            const closeModal = () => modal.remove();

            modal.querySelector('.polaroid-lightbox-backdrop').addEventListener('click', closeModal);
            modal.querySelector('.polaroid-lightbox-close').addEventListener('click', closeModal);

            const handleKey = (e) => {
                if (e.key === 'Escape') {
                    closeModal();
                    window.removeEventListener('keydown', handleKey);
                }
            };
            window.addEventListener('keydown', handleKey);

            document.body.appendChild(modal);
        }
    };
})();
