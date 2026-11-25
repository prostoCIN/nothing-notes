// js/workspace/stickerGallery.js - Модуль Polaroid-галереї зображень для стікера
window.App = window.App || {};

(function() {
    /**
     * Автоматичне клієнтське стиснення зображень перед збереженням
     * @param {File} file
     * @returns {Promise<string>} base64 data URL
     */
    function compressImage(file) {
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
    }

    window.App.stickerGallery = {
        /**
         * Створює блок галереї зображень для стікера
         * @param {Object} note - Об'єкт нотатки
         * @param {HTMLElement} card - Кореневий DOM-елемент картки
         * @param {boolean} isReadOnly - Прапорець тільки для читання
         * @returns {HTMLElement} - DOM-елемент .sticker-images-gallery
         */
        createGallery(note, card, isReadOnly) {
            const galleryContainer = document.createElement('div');
            galleryContainer.className = 'sticker-images-gallery';
            galleryContainer.contentEditable = 'false';

            const noteImages = Array.isArray(note.images) ? note.images : [];
            if (noteImages.length > 0) {
                const t = (k, p) => (window.App && window.App.i18n) ? window.App.i18n.t(k, p) : k;
                noteImages.forEach((imgData) => {
                    const imgWrap = document.createElement('div');
                    imgWrap.className = `sticker-image-wrapper size-${imgData.size || 'm'}`;
                    imgWrap.dataset.imgId = imgData.id;
                    imgWrap.innerHTML = `
                        ${!isReadOnly ? `
                        <div class="sticker-image-toolbar">
                            <div class="sticker-img-size-group">
                                <button class="img-size-btn ${imgData.size === 's' ? 'active' : ''}" data-size="s" title="${t('sticker.imgSizeS')}">S</button>
                                <button class="img-size-btn ${imgData.size === 'm' || !imgData.size ? 'active' : ''}" data-size="m" title="${t('sticker.imgSizeM')}">M</button>
                                <button class="img-size-btn ${imgData.size === 'l' ? 'active' : ''}" data-size="l" title="${t('sticker.imgSizeL')}">L</button>
                            </div>
                            <button class="sticker-image-remove-btn" title="${t('sticker.delPhoto')}">×</button>
                        </div>` : ''}
                        <img src="${imgData.url || ''}" class="sticker-embedded-img" alt="Attached image" loading="lazy">
                    `;

                    const imgEl = imgWrap.querySelector('.sticker-embedded-img');

                    // 1. Якщо url ще немає в note (зберігається в IndexedDB) — завантажуємо з локальної бази
                    if (!imgData.url && window.App.imageDb) {
                        window.App.imageDb.getImage(imgData.id).then(loadedUrl => {
                            if (loadedUrl && imgEl) {
                                imgEl.src = loadedUrl;
                            }
                        });
                    }

                    // 2. Двосторонній захист: якщо хмарний URL недоступний (офлайн або помилка мережі) — fallback до IndexedDB
                    if (imgEl && window.App.imageDb) {
                        imgEl.addEventListener('error', () => {
                            window.App.imageDb.getImage(imgData.id).then(fallbackUrl => {
                                if (fallbackUrl && imgEl.src !== fallbackUrl) {
                                    imgEl.src = fallbackUrl;
                                }
                            });
                        }, { once: true });

                        // 3. Фоново кешуємо хмарні фото в локальний IndexedDB для надійного офлайн-доступу
                        if (imgData.url) {
                            window.App.imageDb.getImage(imgData.id).then(cached => {
                                if (!cached && typeof imgData.url === 'string' && imgData.url.startsWith('http')) {
                                    fetch(imgData.url)
                                        .then(res => res.blob())
                                        .then(blob => {
                                            const reader = new FileReader();
                                            reader.onload = () => {
                                                if (reader.result && window.App.imageDb) {
                                                    window.App.imageDb.saveImage(imgData.id, reader.result);
                                                }
                                            };
                                            reader.readAsDataURL(blob);
                                        })
                                        .catch(() => {});
                                }
                            });
                        }
                    }

                    if (!isReadOnly) {
                        this.initGalleryImageControls(imgWrap, note.id);
                    }
                    galleryContainer.appendChild(imgWrap);
                });
            } else {
                galleryContainer.style.display = 'none';
            }

            return galleryContainer;
        },

        /**
         * Ініціалізує панель керування фото в окремій галереї нотатки (S / M / L, видалення, Lightbox, Drag&Drop Swap)
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

                    const note = noteManager ? noteManager.getNoteById(noteId) : null;
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

                    const note = noteManager ? noteManager.getNoteById(noteId) : null;
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
                const items = Array.from(parentGallery.querySelectorAll('.sticker-image-wrapper'));
                const oldPositions = new Map();
                items.forEach(i => oldPositions.set(i, i.getBoundingClientRect()));

                const nextSiblingOfTarget = imgWrap.nextSibling === draggedWrap ? imgWrap : imgWrap.nextSibling;
                parentGallery.insertBefore(imgWrap, draggedWrap);
                parentGallery.insertBefore(draggedWrap, nextSiblingOfTarget);

                if (window.App.dragUtils && window.App.dragUtils.animateFLIP) {
                    window.App.dragUtils.animateFLIP(items, oldPositions, 200);
                }

                // Оновлюємо порядок у стані note.images
                const note = noteManager ? noteManager.getNoteById(noteId) : null;
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

            const currentNote = noteManager ? noteManager.getNoteById(noteId) : null;
            if (!currentNote) return;

            const images = Array.isArray(currentNote.images) ? [...currentNote.images] : [];

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

                const t = (k, p) => (window.App && window.App.i18n) ? window.App.i18n.t(k, p) : k;
                const imgWrap = document.createElement('div');
                imgWrap.className = 'sticker-image-wrapper size-m';
                imgWrap.dataset.imgId = newImgId;
                imgWrap.innerHTML = `
                    <div class="sticker-image-toolbar">
                        <div class="sticker-img-size-group">
                            <button class="img-size-btn" data-size="s" title="${t('sticker.imgSizeS')}">S</button>
                            <button class="img-size-btn active" data-size="m" title="${t('sticker.imgSizeM')}">M</button>
                            <button class="img-size-btn" data-size="l" title="${t('sticker.imgSizeL')}">L</button>
                        </div>
                        <button class="sticker-image-remove-btn" title="${t('sticker.delPhoto')}">×</button>
                    </div>
                    <img src="${base64Url}" class="sticker-embedded-img" alt="Attached image" loading="lazy">
                `;

                this.initGalleryImageControls(imgWrap, noteId);
                galleryContainer.appendChild(imgWrap);
            }

            galleryContainer.style.display = 'flex';
            if (noteManager) {
                noteManager.updateNote(noteId, { images: images });
            }
            if (window.App.storage && window.App.storage.flushNotes) {
                window.App.storage.flushNotes();
            }

            if (window.App.historyManager) {
                window.App.historyManager.recordState('add_images');
            }
        },

        /**
         * Відкриває повноекранний Lightbox для перегляду фото з підтримкою масштабування (зуму) та жестів
         */
        openImageLightbox(src) {
            const t = (k, p) => (window.App && window.App.i18n) ? window.App.i18n.t(k, p) : k;
            const existing = document.getElementById('polaroid-lightbox-modal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.id = 'polaroid-lightbox-modal';
            modal.className = 'polaroid-lightbox-modal';
            modal.innerHTML = `
                <div class="polaroid-lightbox-backdrop"></div>
                <div class="polaroid-lightbox-container">
                    <div class="polaroid-lightbox-card">
                        <div class="polaroid-lightbox-viewport" id="polaroid-lightbox-viewport">
                            <img src="${src}" class="polaroid-lightbox-img" id="polaroid-lightbox-img" alt="Enlarged photo" draggable="false">
                        </div>
                        <button class="polaroid-lightbox-close" title="${t('sticker.closeLightbox')}">×</button>
                    </div>
                    <div class="polaroid-lightbox-toolbar">
                        <button type="button" class="polaroid-zoom-btn polaroid-zoom-out" title="${t('sticker.zoomOut') || 'Зменшити (-)'}" aria-label="Zoom out" disabled>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                        <button type="button" class="polaroid-zoom-badge" title="${t('sticker.resetZoom') || 'Скинути масштаб (100%)'}" aria-label="Reset zoom">
                            <span class="polaroid-zoom-level">100%</span>
                        </button>
                        <button type="button" class="polaroid-zoom-btn polaroid-zoom-in" title="${t('sticker.zoomIn') || 'Збільшити (+)'}" aria-label="Zoom in">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                        <button type="button" class="polaroid-zoom-btn polaroid-zoom-reset" title="${t('sticker.resetZoom') || 'Оригінальний розмір'}" aria-label="Reset size" disabled>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                                <path d="M3 3v5h5"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;

            this.initLightboxZoom(modal);
            document.body.appendChild(modal);
        },

        /**
         * Ініціалізує плавний зум, жест pinch-to-zoom, панорамування та подвійний тап для Lightbox
         */
        initLightboxZoom(modal) {
            const viewport = modal.querySelector('.polaroid-lightbox-viewport');
            const img = modal.querySelector('.polaroid-lightbox-img');
            const zoomInBtn = modal.querySelector('.polaroid-zoom-in');
            const zoomOutBtn = modal.querySelector('.polaroid-zoom-out');
            const zoomBadge = modal.querySelector('.polaroid-zoom-badge');
            const zoomLevelText = modal.querySelector('.polaroid-zoom-level');
            const zoomResetBtn = modal.querySelector('.polaroid-zoom-reset');
            const closeBtn = modal.querySelector('.polaroid-lightbox-close');
            const backdrop = modal.querySelector('.polaroid-lightbox-backdrop');

            let scale = 1.0;
            let translateX = 0;
            let translateY = 0;
            const minScale = 1.0;
            const maxScale = 4.0;

            const clampBounds = () => {
                if (scale <= 1.001) {
                    translateX = 0;
                    translateY = 0;
                    return;
                }
                const vpW = viewport.clientWidth;
                const vpH = viewport.clientHeight;
                const imgW = img.offsetWidth || img.naturalWidth || vpW;
                const imgH = img.offsetHeight || img.naturalHeight || vpH;

                const scaledW = imgW * scale;
                const scaledH = imgH * scale;

                if (scaledW > vpW) {
                    const maxX = (scaledW - vpW) / 2;
                    translateX = Math.max(-maxX, Math.min(maxX, translateX));
                } else {
                    translateX = 0;
                }

                if (scaledH > vpH) {
                    const maxY = (scaledH - vpH) / 2;
                    translateY = Math.max(-maxY, Math.min(maxY, translateY));
                } else {
                    translateY = 0;
                }
            };

            const updateTransform = (animate = false) => {
                if (animate) {
                    img.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
                } else {
                    img.style.transition = 'none';
                }

                img.style.transform = `translate3d(${translateX.toFixed(2)}px, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`;

                const isZoomed = scale > 1.001;
                viewport.classList.toggle('is-zoomed', isZoomed);

                const pct = Math.round(scale * 100);
                if (zoomLevelText) zoomLevelText.textContent = `${pct}%`;
                if (zoomOutBtn) zoomOutBtn.disabled = scale <= minScale + 0.01;
                if (zoomInBtn) zoomInBtn.disabled = scale >= maxScale - 0.01;
                if (zoomResetBtn) zoomResetBtn.disabled = !isZoomed;
            };

            const setScaleAt = (newScale, focalX, focalY, animate = false) => {
                const oldScale = scale;
                scale = Math.min(Math.max(newScale, minScale), maxScale);

                if (scale <= 1.001) {
                    scale = 1.0;
                    translateX = 0;
                    translateY = 0;
                } else {
                    const rect = viewport.getBoundingClientRect();
                    const fx = (focalX !== undefined ? focalX : (rect.left + rect.width / 2)) - (rect.left + rect.width / 2);
                    const fy = (focalY !== undefined ? focalY : (rect.top + rect.height / 2)) - (rect.top + rect.height / 2);

                    const ratio = scale / oldScale;
                    translateX = fx - (fx - translateX) * ratio;
                    translateY = fy - (fy - translateY) * ratio;
                    clampBounds();
                }

                updateTransform(animate);
            };

            const resetZoom = () => {
                scale = 1.0;
                translateX = 0;
                translateY = 0;
                updateTransform(true);
            };

            if (img.complete) {
                clampBounds();
            } else {
                img.addEventListener('load', () => clampBounds(), { once: true });
            }

            // Кнопки тулбару
            if (zoomInBtn) {
                zoomInBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const target = Math.min(Math.floor((scale + 0.5) * 2) / 2, maxScale);
                    setScaleAt(target, undefined, undefined, true);
                });
            }

            if (zoomOutBtn) {
                zoomOutBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const target = Math.max(Math.ceil((scale - 0.5) * 2) / 2, minScale);
                    setScaleAt(target, undefined, undefined, true);
                });
            }

            if (zoomBadge) {
                zoomBadge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    resetZoom();
                });
            }

            if (zoomResetBtn) {
                zoomResetBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    resetZoom();
                });
            }

            // Коліщатко миші (Desktop Wheel Zoom)
            viewport.addEventListener('wheel', (e) => {
                e.preventDefault();
                const delta = -e.deltaY;
                const factor = delta > 0 ? 1.18 : 0.847;
                setScaleAt(scale * factor, e.clientX, e.clientY, false);
            }, { passive: false });

            // Подвійний клік (Desktop Double Click)
            viewport.addEventListener('dblclick', (e) => {
                e.preventDefault();
                if (scale > 1.2) {
                    resetZoom();
                } else {
                    setScaleAt(2.5, e.clientX, e.clientY, true);
                }
            });

            // Перетягування мишею при зумі (Desktop Drag Pan)
            let isMouseDown = false;
            let startMouseX = 0;
            let startMouseY = 0;
            let initialTransX = 0;
            let initialTransY = 0;

            viewport.addEventListener('mousedown', (e) => {
                if (scale <= 1.001 || e.button !== 0) return;
                isMouseDown = true;
                startMouseX = e.clientX;
                startMouseY = e.clientY;
                initialTransX = translateX;
                initialTransY = translateY;
                viewport.classList.add('is-dragging');
                e.preventDefault();
            });

            const onMouseMove = (e) => {
                if (!isMouseDown) return;
                translateX = initialTransX + (e.clientX - startMouseX);
                translateY = initialTransY + (e.clientY - startMouseY);
                clampBounds();
                updateTransform(false);
            };

            const onMouseUp = () => {
                if (isMouseDown) {
                    isMouseDown = false;
                    viewport.classList.remove('is-dragging');
                }
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);

            // Мобільні сенсорні жести (Mobile Touch: Pinch-to-zoom, Pan, Double-tap)
            let isPinching = false;
            let startPinchDist = 0;
            let startPinchScale = 1;
            let startPinchCenter = { x: 0, y: 0 };

            let isTouchDragging = false;
            let startTouchX = 0;
            let startTouchY = 0;
            let initialTouchTransX = 0;
            let initialTouchTransY = 0;

            let lastTapTime = 0;
            let lastTapPos = { x: 0, y: 0 };

            viewport.addEventListener('touchstart', (e) => {
                if (e.touches.length === 2) {
                    isPinching = true;
                    isTouchDragging = false;
                    startPinchDist = Math.hypot(
                        e.touches[0].clientX - e.touches[1].clientX,
                        e.touches[0].clientY - e.touches[1].clientY
                    );
                    startPinchScale = scale;
                    startPinchCenter = {
                        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                        y: (e.touches[0].clientY + e.touches[1].clientY) / 2
                    };
                    initialTouchTransX = translateX;
                    initialTouchTransY = translateY;
                } else if (e.touches.length === 1) {
                    const now = Date.now();
                    const touch = e.touches[0];
                    const distFromLast = Math.hypot(touch.clientX - lastTapPos.x, touch.clientY - lastTapPos.y);

                    if (now - lastTapTime < 320 && distFromLast < 35) {
                        e.preventDefault();
                        if (scale > 1.2) {
                            resetZoom();
                        } else {
                            setScaleAt(2.5, touch.clientX, touch.clientY, true);
                        }
                        lastTapTime = 0;
                        return;
                    }
                    lastTapTime = now;
                    lastTapPos = { x: touch.clientX, y: touch.clientY };

                    if (scale > 1.001) {
                        isTouchDragging = true;
                        startTouchX = touch.clientX;
                        startTouchY = touch.clientY;
                        initialTouchTransX = translateX;
                        initialTouchTransY = translateY;
                        viewport.classList.add('is-dragging');
                    }
                }
            }, { passive: false });

            viewport.addEventListener('touchmove', (e) => {
                if (isPinching && e.touches.length === 2) {
                    e.preventDefault();
                    const dist = Math.hypot(
                        e.touches[0].clientX - e.touches[1].clientX,
                        e.touches[0].clientY - e.touches[1].clientY
                    );
                    const factor = dist / (startPinchDist || 1);
                    let targetScale = startPinchScale * factor;
                    targetScale = Math.min(Math.max(targetScale, 0.75), 5.0);

                    const currentCenter = {
                        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                        y: (e.touches[0].clientY + e.touches[1].clientY) / 2
                    };

                    scale = targetScale;
                    translateX = initialTouchTransX + (currentCenter.x - startPinchCenter.x);
                    translateY = initialTouchTransY + (currentCenter.y - startPinchCenter.y);
                    clampBounds();
                    updateTransform(false);
                } else if (isTouchDragging && e.touches.length === 1 && scale > 1.001) {
                    e.preventDefault();
                    const touch = e.touches[0];
                    translateX = initialTouchTransX + (touch.clientX - startTouchX);
                    translateY = initialTouchTransY + (touch.clientY - startTouchY);
                    clampBounds();
                    updateTransform(false);
                }
            }, { passive: false });

            const onTouchEnd = (e) => {
                if (isPinching && e.touches.length < 2) {
                    isPinching = false;
                    if (scale < 1.05) {
                        resetZoom();
                    } else if (scale > maxScale) {
                        scale = maxScale;
                        clampBounds();
                        updateTransform(true);
                    } else {
                        clampBounds();
                        updateTransform(true);
                    }
                }
                if (isTouchDragging && e.touches.length === 0) {
                    isTouchDragging = false;
                    viewport.classList.remove('is-dragging');
                    clampBounds();
                    updateTransform(true);
                }
            };

            viewport.addEventListener('touchend', onTouchEnd);
            viewport.addEventListener('touchcancel', onTouchEnd);

            // Закриття модального вікна
            const closeModal = () => {
                window.removeEventListener('keydown', onKeyDown);
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                modal.remove();
            };

            backdrop.addEventListener('click', closeModal);
            closeBtn.addEventListener('click', closeModal);

            const onKeyDown = (e) => {
                if (e.key === 'Escape') {
                    closeModal();
                } else if (e.key === '+' || e.key === '=') {
                    e.preventDefault();
                    setScaleAt(Math.min(scale + 0.5, maxScale), undefined, undefined, true);
                } else if (e.key === '-' || e.key === '_') {
                    e.preventDefault();
                    setScaleAt(Math.max(scale - 0.5, minScale), undefined, undefined, true);
                } else if (e.key === '0') {
                    e.preventDefault();
                    resetZoom();
                } else if (scale > 1.001) {
                    if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        translateX += 50;
                        clampBounds();
                        updateTransform(true);
                    } else if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        translateX -= 50;
                        clampBounds();
                        updateTransform(true);
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        translateY += 50;
                        clampBounds();
                        updateTransform(true);
                    } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        translateY -= 50;
                        clampBounds();
                        updateTransform(true);
                    }
                }
            };
            window.addEventListener('keydown', onKeyDown);
        }
    };
})();
