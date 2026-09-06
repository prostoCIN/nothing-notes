// js/workspace/workspaceSelectionActions.js - Дії масового оновлення та редагування вибраних нотаток
window.App = window.App || {};

(function() {
    window.App.workspaceSelectionActions = {
        // Зміна кольору для списку нотаток
        changeColor(noteIds, colorId) {
            if (!noteIds || noteIds.length === 0) return;
            const noteManager = window.App.noteManager;
            if (noteManager && noteManager.updateMultipleNotes) {
                noteManager.updateMultipleNotes(noteIds, { color: colorId });
            }
        },

        // Зміна кеглю шрифту для списку нотаток
        changeFontSize(noteIds, stepIdx, immediate = true) {
            if (!noteIds || noteIds.length === 0) return;
            const FONT_SIZES = window.App.FONT_SIZES || [12, 16, 24, 32];
            const newSize = FONT_SIZES[stepIdx];
            const noteManager = window.App.noteManager;

            // Миттєве оновлення стилів на DOM-елементах карток для плавного відчуття слайдера
            noteIds.forEach(id => {
                const card = document.querySelector(`.note-sticker[data-note-id="${id}"]`);
                if (card) {
                    card.dataset.fontStep = stepIdx;
                    card.style.setProperty('--custom-content-font-size', `${newSize}px`);
                    card.style.setProperty('--custom-title-font-size', `${Math.round(newSize * 1.5)}px`);
                    card.style.setProperty('--custom-line-height', `${Math.max(26, Math.round(newSize * 1.7))}px`);
                    card.classList.add('has-custom-font-size');
                }
            });

            if (noteManager && noteManager.updateMultipleNotes) {
                noteManager.updateMultipleNotes(noteIds, { fontSize: newSize }, immediate);
            }
        },

        // Додавання або зняття тегу для списку нотаток
        toggleTag(noteIds, tagText) {
            if (!noteIds || noteIds.length === 0 || !tagText) return;
            const state = window.App.state;
            const storage = window.App.storage;
            const noteManager = window.App.noteManager;

            if (window.App.historyManager) {
                window.App.historyManager.recordState('batch_tags_change');
            }

            const selectedNotes = noteIds.map(id => noteManager.getNoteById(id)).filter(Boolean);
            const countWithTag = selectedNotes.filter(note => {
                const tags = Array.isArray(note.tags) ? note.tags : (note.tag ? [note.tag.text || note.tag] : []);
                return tags.includes(tagText);
            }).length;

            const allHaveTag = selectedNotes.length > 0 && countWithTag === selectedNotes.length;
            const shouldRemove = allHaveTag || countWithTag > 0;

            selectedNotes.forEach(note => {
                let currentTags = Array.isArray(note.tags) ? [...note.tags] : (note.tag ? [note.tag.text || note.tag] : []);
                if (shouldRemove) {
                    currentTags = currentTags.filter(t => t !== tagText);
                } else {
                    if (!currentTags.includes(tagText)) {
                        currentTags.push(tagText);
                    }
                }
                note.tags = currentTags;
                note.updatedAt = Date.now();
                delete note.tag;
                if (window.App.cloudSync) {
                    window.App.cloudSync.syncNote(note);
                }
            });

            storage.saveNotes(state.notes);
            if (window.App.workspaceView) {
                window.App.workspaceView.render();
            }
            if (window.App.workspaceSelectionBar) {
                window.App.workspaceSelectionBar.refreshTagSubmenu();
            }
        },

        // Повне видалення тегу зі сховища та з усіх нотаток
        deleteTagGlobally(tagText) {
            if (!tagText) return;
            const state = window.App.state;
            const storage = window.App.storage;

            const currentOptions = (storage.getTagOptions ? storage.getTagOptions() : []).filter(o => o !== tagText);
            if (storage.saveTagOptions) {
                storage.saveTagOptions(currentOptions);
            }

            state.notes.forEach(n => {
                if (Array.isArray(n.tags) && n.tags.includes(tagText)) {
                    n.tags = n.tags.filter(t => t !== tagText);
                    n.updatedAt = Date.now();
                    if (window.App.cloudSync) window.App.cloudSync.syncNote(n);
                }
            });

            storage.saveNotes(state.notes);
            if (window.App.workspaceView) {
                window.App.workspaceView.render();
            }
            if (window.App.workspaceSelectionBar) {
                window.App.workspaceSelectionBar.refreshTagSubmenu();
            }
        },

        // Очистити всі теги з виділених нотаток
        clearAllTags(noteIds) {
            if (!noteIds || noteIds.length === 0) return;
            const state = window.App.state;
            const storage = window.App.storage;
            const noteManager = window.App.noteManager;

            if (window.App.historyManager) {
                window.App.historyManager.recordState('batch_tags_clear');
            }

            noteIds.forEach(id => {
                const note = noteManager.getNoteById(id);
                if (note) {
                    note.tags = [];
                    note.updatedAt = Date.now();
                    delete note.tag;
                    if (window.App.cloudSync) {
                        window.App.cloudSync.syncNote(note);
                    }
                }
            });

            storage.saveNotes(state.notes);
            if (window.App.workspaceView) {
                window.App.workspaceView.render();
            }
            if (window.App.workspaceSelectionBar) {
                window.App.workspaceSelectionBar.closeSubmenus();
            }
        },

        // Створити новий тег та призначити його виділеним нотаткам
        createAndAssignTag(newTagText, noteIds) {
            const tag = newTagText ? newTagText.trim() : '';
            if (!tag) return;
            const state = window.App.state;
            const storage = window.App.storage;
            const noteManager = window.App.noteManager;

            const currentAvailable = storage.getTagOptions ? storage.getTagOptions() : [];
            if (!currentAvailable.includes(tag)) {
                currentAvailable.push(tag);
                if (storage.saveTagOptions) {
                    storage.saveTagOptions(currentAvailable);
                }
            }

            if (noteIds && noteIds.length > 0) {
                noteIds.forEach(id => {
                    const note = noteManager.getNoteById(id);
                    if (note) {
                        let currentTags = Array.isArray(note.tags) ? [...note.tags] : (note.tag ? [note.tag.text || note.tag] : []);
                        if (!currentTags.includes(tag)) {
                            currentTags.push(tag);
                            note.tags = currentTags;
                            note.updatedAt = Date.now();
                            delete note.tag;
                            if (window.App.cloudSync) window.App.cloudSync.syncNote(note);
                        }
                    }
                });

                storage.saveNotes(state.notes);
                if (window.App.workspaceView) {
                    window.App.workspaceView.render();
                }
            }

            if (window.App.workspaceSelectionBar) {
                window.App.workspaceSelectionBar.refreshTagSubmenu();
            }
        },

        // Дублювати виділені нотатки
        duplicateNotes(noteIds) {
            if (!noteIds || noteIds.length === 0) return;
            const noteManager = window.App.noteManager;
            if (noteManager && noteManager.duplicateNote) {
                noteIds.forEach(id => {
                    noteManager.duplicateNote(id);
                });
            }
        },

        // Видалити виділені нотатки (з модалкою підтвердження)
        deleteNotes(noteIds, event) {
            if (!noteIds || noteIds.length === 0) return;
            const noteManager = window.App.noteManager;
            if (noteManager && noteManager.deleteNotes) {
                noteManager.deleteNotes(noteIds, event);
            }
        },

        // Поділитися виділеними нотатками
        shareNotes(noteIds) {
            if (!noteIds || noteIds.length === 0) return;
            const state = window.App.state;
            if (window.App.shareManager) {
                window.App.shareManager.showShareModal(state.activeBoardId, noteIds);
            }
        }
    };
})();
