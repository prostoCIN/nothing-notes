// js/workspace/stickerMenu.js - Модуль випадаючого меню трьох крапок стікера (кольори, розмір шрифту, дії)
window.App = window.App || {};

(function() {
    /**
     * Створює блок інформації про нотатку у верхній частині меню (заголовок, дата створення)
     */
    function buildHeaderInfo(note) {
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

        return headerInfo;
    }

    /**
     * Створює блок палітри кольорів стікера
     */
    function buildColorPalette(note, card, menuDropdown, onClose) {
        const noteManager = window.App.noteManager;

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

                if (noteManager) {
                    noteManager.updateNote(note.id, { color: c.id });
                }
                note.color = c.id;
                menuDropdown.classList.remove('active');
                if (onClose) onClose();
            });

            colorPalette.appendChild(swatch);
        });

        return { colorTitle, colorPalette };
    }

    /**
     * Створює блок слайдера розміру шрифту нотатки
     */
    function buildFontSizeSlider(note, card) {
        const noteManager = window.App.noteManager;

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

            if (noteManager) {
                noteManager.updateNote(note.id, { fontSize: newSize });
            }
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

        return { fontSizeHeader, sliderContainer };
    }

    /**
     * Створює інтерактивні пункти меню дій (піднотатки, фото, теги, поширення, дублювання, видалення)
     */
    function appendMenuItems(menuDropdown, note, card, colIndex, isChainOpen, onClose) {
        const noteManager = window.App.noteManager;
        const workspaceView = window.App.workspaceView;

        // 1. Пункт "Додати піднотатку"
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
            if (noteManager) {
                setTimeout(() => noteManager.createNewNote(note.id, true), 80);
            }
        });
        menuDropdown.appendChild(addSubnoteItem);

        // 2. Пункт "Додати фото"
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

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.multiple = true;
        fileInput.style.display = 'none';

        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files || []);
            if (files.length === 0) return;
            if (window.App.stickerGallery) {
                await window.App.stickerGallery.attachImagesToNote(note.id, files, card);
            }
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

        // 3. Пункт "Додати тег"
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

        // 4. Пункт "Поділитись нотаткою"
        const shareItem = document.createElement('div');
        shareItem.className = 'sticker-menu-item';
        shareItem.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
            <span>Поділитись нотаткою</span>
        `;
        shareItem.addEventListener('click', (e) => {
            e.stopPropagation();
            menuDropdown.classList.remove('active');
            if (onClose) onClose();
            if (window.App.shareManager) {
                window.App.shareManager.showShareModal(note.boardId, [note.id]);
            }
        });
        menuDropdown.appendChild(shareItem);

        // 5. Пункт "Дублювати нотатку"
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
            if (noteManager) {
                noteManager.duplicateNote(note.id);
            }
        });
        menuDropdown.appendChild(duplicateItem);

        // 6. Пункт "Видалити нотатку"
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
            if (noteManager) {
                noteManager.deleteNote(note.id, e);
            }
        });
        menuDropdown.appendChild(deleteItem);

        // 7. Пункт "Піднотатки (к-сть)" якщо є піднотатки
        const childNotes = noteManager ? noteManager.getNotesForColumn(note.id) : [];
        const childCount = childNotes.length;

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
    }

    window.App.stickerMenu = {
        /**
         * Будує DOM-елемент випадаючого списку дій для нотатки
         */
        createDropdown(note, card, colIndex = 0, isChainOpen = false, onClose = null) {
            const menuDropdown = document.createElement('div');
            menuDropdown.className = 'sticker-menu-dropdown';

            // 0. Заголовок нотатки та дата додавання
            const headerInfo = buildHeaderInfo(note);
            menuDropdown.appendChild(headerInfo);

            const divider0 = document.createElement('div');
            divider0.className = 'sticker-menu-divider';
            menuDropdown.appendChild(divider0);

            // 1. Палітра кольорів
            const { colorTitle, colorPalette } = buildColorPalette(note, card, menuDropdown, onClose);
            menuDropdown.appendChild(colorTitle);
            menuDropdown.appendChild(colorPalette);

            // 2. Розмір тексту
            const { fontSizeHeader, sliderContainer } = buildFontSizeSlider(note, card);
            menuDropdown.appendChild(fontSizeHeader);
            menuDropdown.appendChild(sliderContainer);

            // 3. Пункти дій
            appendMenuItems(menuDropdown, note, card, colIndex, isChainOpen, onClose);

            return menuDropdown;
        },

        /**
         * Створює блок кнопки "три крапки" та випадаючого меню для стікера
         */
        createMenu(note, card, colIndex, isChainOpen) {
            const noteManager = window.App.noteManager;
            const childNotes = noteManager ? noteManager.getNotesForColumn(note.id) : [];
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

        // --- Делегати зворотної сумісності для операцій з фотографіями ---
        initGalleryImageControls(imgWrap, noteId) {
            if (window.App.stickerGallery) {
                return window.App.stickerGallery.initGalleryImageControls(imgWrap, noteId);
            }
        },

        async attachImagesToNote(noteId, files, card = null) {
            if (window.App.stickerGallery) {
                return await window.App.stickerGallery.attachImagesToNote(noteId, files, card);
            }
        },

        openImageLightbox(src) {
            if (window.App.stickerGallery) {
                return window.App.stickerGallery.openImageLightbox(src);
            }
        }
    };
})();
