// js/sync/syncStorage.js - Управління завантаженням, видаленням та очисткою зображень у Supabase Storage
window.App = window.App || {};

(function() {
    window.App.syncStorage = {
        // Конвертація та завантаження Base64 у Supabase Storage
        async uploadBase64Image(base64Data, imgId) {
            const supabase = window.App.supabase;
            const currentUser = window.App.cloudSync ? window.App.cloudSync.getCurrentUser() : null;
            if (!supabase || !currentUser || !base64Data) return null;

            try {
                const res = await fetch(base64Data);
                const blob = await res.blob();
                const filePath = `${currentUser.id}/${imgId}.jpg`;

                const { error } = await supabase.storage
                    .from('note-images')
                    .upload(filePath, blob, {
                        contentType: 'image/jpeg',
                        upsert: true
                    });

                if (error) {
                    console.warn('[CloudSync] Base64 upload error:', error.message);
                    return null;
                }

                const { data: publicUrlData } = supabase.storage
                    .from('note-images')
                    .getPublicUrl(filePath);

                return publicUrlData ? publicUrlData.publicUrl : null;
            } catch (err) {
                console.warn('[CloudSync] Base64 upload exception:', err);
                return null;
            }
        },

        // Завантаження фотографії в Supabase Storage Bucket
        async uploadImageFile(file, imgId) {
            const supabase = window.App.supabase;
            const currentUser = window.App.cloudSync ? window.App.cloudSync.getCurrentUser() : null;
            if (!supabase || !currentUser) return null;

            try {
                const fileExt = file.name ? file.name.split('.').pop() : 'jpg';
                const filePath = `${currentUser.id}/${imgId}.${fileExt}`;

                const { error } = await supabase.storage
                    .from('note-images')
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (error) {
                    console.warn('[CloudSync] Storage upload error:', error.message);
                    return null;
                }

                const { data: publicUrlData } = supabase.storage
                    .from('note-images')
                    .getPublicUrl(filePath);

                return publicUrlData ? publicUrlData.publicUrl : null;
            } catch (err) {
                console.warn('[CloudSync] Storage upload exception:', err);
                return null;
            }
        },

        // Миттєве видалення одного фото зі сховища Supabase Storage
        async deleteImageFile(imgId) {
            const supabase = window.App.supabase;
            const currentUser = window.App.cloudSync ? window.App.cloudSync.getCurrentUser() : null;
            if (!supabase || !currentUser || !imgId) return;

            try {
                const filePathJpg = `${currentUser.id}/${imgId}.jpg`;
                const filePathPng = `${currentUser.id}/${imgId}.png`;
                await supabase.storage.from('note-images').remove([filePathJpg, filePathPng]);
                console.log('[CloudSync] Deleted image file from Storage:', imgId);
            } catch (err) {
                console.warn('[CloudSync] Storage delete error:', err);
            }
        },

        // Збирач сміття (Garbage Collector): видаляє з Storage всі фото, яких немає в жодній нотатці
        async cleanupOrphanedImages() {
            const supabase = window.App.supabase;
            const currentUser = window.App.cloudSync ? window.App.cloudSync.getCurrentUser() : null;
            if (!supabase || !currentUser) return;
            const state = window.App.state;

            try {
                // 1. Отримуємо список усіх файлів користувача в Storage
                const { data: files, error } = await supabase.storage
                    .from('note-images')
                    .list(currentUser.id, { limit: 500 });

                if (error || !files || files.length === 0) return;

                // 2. Збираємо список усіх актуальних ID картинок з активних нотаток
                const activeImageIds = new Set();
                state.notes.forEach(note => {
                    if (Array.isArray(note.images)) {
                        note.images.forEach(im => {
                            if (im && im.id) activeImageIds.add(im.id);
                        });
                    }
                });

                // 3. Знаходимо файли-сироти
                const orphanedPaths = [];
                files.forEach(file => {
                    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                    if (!activeImageIds.has(nameWithoutExt) && nameWithoutExt !== '.emptyFolderPlaceholder') {
                        orphanedPaths.push(`${currentUser.id}/${file.name}`);
                    }
                });

                // 4. Перманентно видаляємо застарілі файли
                if (orphanedPaths.length > 0) {
                    console.log(`[CloudSync Garbage Collector] Cleaning up ${orphanedPaths.length} orphaned images from storage...`);
                    await supabase.storage.from('note-images').remove(orphanedPaths);
                }
            } catch (err) {
                console.warn('[CloudSync] Cleanup orphaned images exception:', err);
            }
        },

        // Вивантаження фото з IndexedDB у Supabase Storage для всіх нотаток, де ще немає url
        async uploadMissingLocalImages() {
            const currentUser = window.App.cloudSync ? window.App.cloudSync.getCurrentUser() : null;
            if (!currentUser || !window.App.supabase || !window.App.imageDb) return;
            const state = window.App.state;
            let uploadedCount = 0;

            for (const note of state.notes) {
                if (Array.isArray(note.images) && note.images.length > 0) {
                    let noteUpdated = false;
                    for (const img of note.images) {
                        if (!img.url) {
                            try {
                                const base64 = await window.App.imageDb.getImage(img.id);
                                if (base64) {
                                    console.log('[CloudSync] Uploading local image to cloud:', img.id);
                                    const cloudUrl = await this.uploadBase64Image(base64, img.id);
                                    if (cloudUrl) {
                                        img.url = cloudUrl;
                                        noteUpdated = true;
                                        uploadedCount++;
                                    }
                                }
                            } catch (err) {
                                console.warn('[CloudSync] Error uploading local image:', img.id, err);
                            }
                        }
                    }
                    if (noteUpdated && window.App.syncNotes) {
                        await window.App.syncNotes._pushNoteToCloud(note);
                    }
                }
            }

            if (uploadedCount > 0) {
                console.log(`[CloudSync] Successfully uploaded ${uploadedCount} images to Supabase Storage!`);
                window.App.storage.saveNotes(state.notes, true);
                if (window.App.workspaceView) window.App.workspaceView.render();
            }
        }
    };
})();
