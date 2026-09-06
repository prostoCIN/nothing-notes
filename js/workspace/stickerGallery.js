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
                noteImages.forEach((imgData) => {
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
                const nextSiblingOfTarget = imgWrap.nextSibling === draggedWrap ? imgWrap : imgWrap.nextSibling;
                parentGallery.insertBefore(imgWrap, draggedWrap);
                parentGallery.insertBefore(draggedWrap, nextSiblingOfTarget);

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
