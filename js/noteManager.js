// js/noteManager.js - Управління нотатками (створення, оновлення, видалення, пошук ієрархії)
window.App = window.App || {};

(function() {
    let onNotesChangeCallback = null;

    window.App.noteManager = {
        init(callbacks) {
            onNotesChangeCallback = callbacks.onNotesChange;
        },

        // Санітизація контенту нотатки для запобігання XSS-атакам
        sanitizeContent(html) {
            if (!html || typeof html !== 'string') return '';
            if (window.DOMPurify) {
                return window.DOMPurify.sanitize(html, {
                    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'mark', 'span', 'br', 'div', 'p', 'font', 'u', 's', 'strike'],
                    ALLOWED_ATTR: ['style', 'class', 'color', 'data-placeholder', 'data-empty']
                });
            }
            // Fallback санітайзер без сторонніх бібліотек
            return html
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/on\w+="[^"]*"/gi, '')
                .replace(/on\w+='[^']*'/gi, '')
                .replace(/javascript:/gi, '');
        },

        sanitizePlainText(text) {
            if (!text || typeof text !== 'string') return '';
            return text.replace(/[<>]/g, '');
        },

        getAllNotes() {
            const state = window.App.state;
            const readOnly = state.readOnlyNotes || [];
            return [...state.notes, ...readOnly];
        },

        getNotesForColumn(parentId) {
            const state = window.App.state;
            const allNotes = this.getAllNotes();
            return allNotes.filter(n => n.boardId === state.activeBoardId && (n.parentId || null) === parentId);
        },

        // Універсальний метод отримання валідних тегів нотатки (з підтримкою як масивів, так і legacy об'єктів)
        getNoteTags(note) {
            if (!note) return [];

            let rawTags = [];
            if (Array.isArray(note.tags)) {
                rawTags = note.tags;
            } else if (note.tag && typeof note.tag === 'object' && note.tag.text) {
                rawTags = [note.tag.text];
            } else if (typeof note.tag === 'string') {
                rawTags = [note.tag];
            }

            return rawTags
                .map(t => (typeof t === 'string' ? t.trim() : ''))
                .filter(t => t !== '');
        },

        getChildNotesCount(noteId) {
            const state = window.App.state;
            const allNotes = this.getAllNotes();
            return allNotes.filter(n => n.boardId === state.activeBoardId && n.parentId === noteId).length;
        },

        getDescendantIds(noteId) {
            const allNotes = this.getAllNotes();
            const directChildren = allNotes.filter(n => n.parentId === noteId);
            let ids = directChildren.map(c => c.id);
            directChildren.forEach(c => {
                ids = ids.concat(this.getDescendantIds(c.id));
            });
            return ids;
        },

        getNoteById(id) {
            const allNotes = this.getAllNotes();
            return allNotes.find(n => n.id === id) || null;
        },

        createNewNote(parentId = null, shouldFocus = true) {
            const state = window.App.state;
            const storage = window.App.storage;
            if (!state.activeBoardId) return null;

            // Наслідуємо колір від батьківської нотатки або беремо дефолтний
            let inheritedColor = 'yellow';
            if (parentId) {
                const parentNote = this.getNoteById(parentId);
                if (parentNote && parentNote.color) {
                    inheritedColor = parentNote.color;
                }
            }

            const currentLevelNotes = this.getNotesForColumn(parentId);
            const nextOrderIndex = currentLevelNotes.length > 0
                ? Math.max(...currentLevelNotes.map(n => typeof n.orderIndex === 'number' ? n.orderIndex : 0), 0) + 1
                : 0;

            const now = Date.now();
            const newNote = {
                id: 'note_' + now.toString() + '_' + Math.random().toString(36).substr(2, 4),
                boardId: state.activeBoardId,
                parentId: parentId,
                title: '',
                content: '',
                color: inheritedColor,
                orderIndex: nextOrderIndex,
                createdAt: now,
                updatedAt: now
            };

            if (window.App.historyManager) {
                window.App.historyManager.recordState('create_note');
            }

            state.notes.push(newNote);
            storage.saveNotes(state.notes);

            if (window.App.cloudSync) {
                window.App.cloudSync.syncNote(newNote);
            }

            if (onNotesChangeCallback) {
                onNotesChangeCallback();
            }

            if (shouldFocus) {
                setTimeout(() => {
                    const noteElement = document.querySelector(`.note-sticker[data-note-id="${newNote.id}"]`);
                    if (noteElement) {
                        noteElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        const titleInput = noteElement.querySelector('.sticker-title');
                        if (titleInput) titleInput.focus();
                    }
                }, 60);
            }

            return newNote;
        },

        deleteNote(id, event) {
            if (event) event.stopPropagation();

            const state = window.App.state;

            // Перевіряємо, чи є дана нотатка частиною групи виділених (у сайдбарі чи на робочій області)
            const isSidebarGroup = state.selectedSidebarNoteIds.has(id) && state.selectedSidebarNoteIds.size > 1;
            const isWorkspaceGroup = state.selectedWorkspaceNoteIds.has(id) && state.selectedWorkspaceNoteIds.size > 1;

            if (isSidebarGroup) {
                this.deleteNotes(Array.from(state.selectedSidebarNoteIds), event);
            } else if (isWorkspaceGroup) {
                this.deleteNotes(Array.from(state.selectedWorkspaceNoteIds), event);
            } else {
                this.deleteNotes([id], event);
            }
        },

        deleteNotes(ids, event) {
            if (event) event.stopPropagation();

            const state = window.App.state;
            const storage = window.App.storage;

            const targetIds = Array.isArray(ids) ? ids.filter(Boolean) : [ids];
            if (targetIds.length === 0) return;

            // Збираємо всі ID для видалення (разом з усіма нащадками)
            const toDeleteIds = new Set();
            targetIds.forEach(targetId => {
                toDeleteIds.add(targetId);
                this.getDescendantIds(targetId).forEach(descId => toDeleteIds.add(descId));
            });

            const performDelete = () => {
                if (window.App.historyManager) {
                    window.App.historyManager.recordState('delete_notes');
                }

                // Видаляємо зв'язані фотографії цих нотаток
                const deletedNotes = state.notes.filter(n => toDeleteIds.has(n.id));
                deletedNotes.forEach(dn => {
                    if (Array.isArray(dn.images)) {
                        dn.images.forEach(im => {
                            if (im && im.id) {
                                if (window.App.imageDb) window.App.imageDb.deleteImage(im.id);
                                if (window.App.cloudSync && window.App.cloudSync.deleteImageFile) {
                                    window.App.cloudSync.deleteImageFile(im.id);
                                }
                            }
                        });
                    }
                });

                state.notes = state.notes.filter(note => !toDeleteIds.has(note.id));

                if (window.App.cloudSync) {
                    const idsArr = Array.from(toDeleteIds);
                    if (window.App.cloudSync.deleteNotesFromCloud) {
                        window.App.cloudSync.deleteNotesFromCloud(idsArr);
                    } else {
                        idsArr.forEach(delId => window.App.cloudSync.deleteNoteFromCloud(delId));
                    }
                }

                // Якщо у ланцюжку відкритих колонок була видалена нотатка - закриваємо відповідні колонки
                state.activeChain = state.activeChain.filter(pid => pid === null || !toDeleteIds.has(pid));
                state.selectedSidebarNoteIds.clear();
                state.selectedWorkspaceNoteIds.clear();

                if (window.App.workspaceSelectionBar) {
                    window.App.workspaceSelectionBar.exitSelectMode();
                }

                storage.saveNotes(state.notes);

                if (onNotesChangeCallback) {
                    onNotesChangeCallback();
                }
            };

            if (window.App.confirmModal) {
                if (targetIds.length > 1) {
                    const extraSubnotesCount = toDeleteIds.size - targetIds.length;
                    window.App.confirmModal.show({
                        title: `Видалити ${targetIds.length} виділені нотатки?`,
                        message: `Ви дійсно хочете видалити <span class="confirm-modal-highlight">${targetIds.length} виділені нотатки</span>?${extraSubnotesCount > 0 ? ` Усі їхні прив'язані піднотатки (${extraSubnotesCount} шт.) також будуть видалені.` : ''}`,
                        confirmText: 'Затисніть для видалення',
                        type: 'danger',
                        onConfirm: performDelete
                    });
                } else {
                    const id = targetIds[0];
                    const targetNote = this.getNoteById(id);
                    const noteTitle = (targetNote && targetNote.title.trim()) ? targetNote.title.trim() : 'Без назви';
                    const isSubnote = targetNote && targetNote.parentId;
                    const descendantCount = this.getDescendantIds(id).length;

                    window.App.confirmModal.show({
                        title: isSubnote ? 'Видалити піднотатку?' : 'Видалити нотатку?',
                        message: `Ви дійсно хочете видалити ${isSubnote ? 'піднотатку' : 'нотатку'} <span class="confirm-modal-highlight">"${noteTitle}"</span>?${descendantCount > 0 ? ` Усі зв'язані піднотатки (${descendantCount} шт.) також будуть видалені.` : ''}`,
                        confirmText: 'Затисніть для видалення',
                        type: 'danger',
                        onConfirm: performDelete
                    });
                }
            } else {
                performDelete();
            }
        },

        updateNote(id, updates, triggerReRender = false) {
            const state = window.App.state;
            const storage = window.App.storage;
            const index = state.notes.findIndex(n => n.id === id);

            if (index !== -1) {
                if (window.App.historyManager) {
                    if (updates.content !== undefined || updates.title !== undefined) {
                        window.App.historyManager.recordTextChange();
                    } else {
                        window.App.historyManager.recordState('update_note');
                    }
                }

                const safeUpdates = { ...updates };
                if (safeUpdates.content !== undefined) {
                    safeUpdates.content = this.sanitizeContent(safeUpdates.content);
                }
                if (safeUpdates.title !== undefined) {
                    safeUpdates.title = this.sanitizePlainText(safeUpdates.title);
                }

                state.notes[index] = { ...state.notes[index], ...safeUpdates, updatedAt: Date.now() };
                storage.saveNotes(state.notes);

                if (window.App.cloudSync) {
                    window.App.cloudSync.syncNote(state.notes[index]);
                }

                // Якщо оновлюється заголовок нотатки, до якої прив'язана колонка - оновлюємо заголовок колонки
                if (updates.title !== undefined) {
                    const linkedHeader = document.querySelector(`.board-column[data-parent-id="${id}"] .column-title`);
                    if (linkedHeader) {
                        linkedHeader.textContent = updates.title.trim() || 'Без назви';
                    }
                }

                if (triggerReRender && onNotesChangeCallback) {
                    onNotesChangeCallback();
                }
            }
        },

        updateMultipleNotes(noteIds, updates, triggerReRender = true) {
            const state = window.App.state;
            const storage = window.App.storage;
            const idsSet = new Set(noteIds);
            let hasChanges = false;

            if (window.App.historyManager) {
                window.App.historyManager.recordState('update_multiple_notes');
            }

            state.notes.forEach(note => {
                if (idsSet.has(note.id)) {
                    Object.assign(note, updates, { updatedAt: Date.now() });
                    hasChanges = true;
                    if (window.App.cloudSync) {
                        window.App.cloudSync.syncNote(note);
                    }
                }
            });

            if (hasChanges) {
                storage.saveNotes(state.notes);
                if (triggerReRender && onNotesChangeCallback) {
                    onNotesChangeCallback();
                }
            }
        },

        reorderNotes(columnNotesList, parentId) {
            const state = window.App.state;
            const storage = window.App.storage;
            const masonryWrapper = columnNotesList.querySelector('.masonry-grid-wrapper');
            let newOrderIds = [];

            if (masonryWrapper) {
                // У режимі 2-колонкової Pinterest-сітки: зчитуємо черговість із підколонок
                const colLeft = masonryWrapper.querySelector('.masonry-column-left');
                const colRight = masonryWrapper.querySelector('.masonry-column-right');

                const leftStickers = colLeft ? [...colLeft.querySelectorAll('.note-sticker')] : [];
                const rightStickers = colRight ? [...colRight.querySelectorAll('.note-sticker')] : [];

                // Збираємо послідовність карток чергуванням (L0, R0, L1, R1...)
                const maxLen = Math.max(leftStickers.length, rightStickers.length);
                for (let i = 0; i < maxLen; i++) {
                    if (i < leftStickers.length && leftStickers[i].dataset.noteId) {
                        newOrderIds.push(leftStickers[i].dataset.noteId);
                    }
                    if (i < rightStickers.length && rightStickers[i].dataset.noteId) {
                        newOrderIds.push(rightStickers[i].dataset.noteId);
                    }
                }

                // Гарантуємо ідеальний баланс 50/50: парні індекси (0, 2, 4...) -> Left, непарні (1, 3, 5...) -> Right
                // Таким чином при 4 нотатках ЗАВЖДИ буде рівно по 2 в кожній колонці
                newOrderIds.forEach((id, idx) => {
                    const note = state.notes.find(n => n.id === id);
                    if (note) {
                        note.gridCol = (idx % 2 === 0) ? 'left' : 'right';
                    }
                });
            } else {
                // У звичайному вертикальному списку
                const stickerElements = [...columnNotesList.querySelectorAll('.note-sticker')];
                newOrderIds = stickerElements.map(el => el.dataset.noteId);
                newOrderIds.forEach((id, idx) => {
                    const note = state.notes.find(n => n.id === id);
                    if (note) {
                        note.gridCol = (idx % 2 === 0) ? 'left' : 'right';
                    }
                });
            }

            this.reorderNotesByIds(newOrderIds, parentId);
        },

        swapNotes(noteIdA, noteIdB) {
            const state = window.App.state;
            const storage = window.App.storage;

            const indexA = state.notes.findIndex(n => n.id === noteIdA);
            const indexB = state.notes.findIndex(n => n.id === noteIdB);

            if (indexA === -1 || indexB === -1 || indexA === indexB) return;

            // Змінюємо порядок місцями у глобальному масиві
            const temp = state.notes[indexA];
            state.notes[indexA] = state.notes[indexB];
            state.notes[indexB] = temp;

            storage.saveNotes(state.notes);

            if (onNotesChangeCallback) {
                onNotesChangeCallback();
            }
        },

        reorderNotesByIds(newOrderIds, parentId) {
            const state = window.App.state;
            const storage = window.App.storage;

            const currentLevelNotesMap = new Map(
                state.notes.filter(n => n.boardId === state.activeBoardId && (n.parentId || null) === parentId).map(n => [n.id, n])
            );

            const sortedLevelNotes = newOrderIds.map(id => currentLevelNotesMap.get(id)).filter(Boolean);
            const otherNotes = state.notes.filter(n => !(n.boardId === state.activeBoardId && (n.parentId || null) === parentId));

            state.notes = [...sortedLevelNotes, ...otherNotes];
            storage.saveNotes(state.notes);

            if (window.App.cloudSync && window.App.cloudSync.isLoggedIn()) {
                window.App.cloudSync.pushAllToCloud();
            }

            if (onNotesChangeCallback) {
                onNotesChangeCallback();
            }
        },

        moveNoteToParent(noteId, newParentId) {
            const state = window.App.state;
            const storage = window.App.storage;

            // Запобігаємо переміщенню нотатки всередину самої себе або своїх нащадків
            const descendantIds = new Set(this.getDescendantIds(noteId));
            if (descendantIds.has(newParentId) || noteId === newParentId) return false;

            const targetNote = this.getNoteById(noteId);
            if (!targetNote) return false;

            // Якщо newParentId вказано (не null/корінь), перевіряємо існування батьківської нотатки
            if (newParentId !== null) {
                const parentNote = this.getNoteById(newParentId);
                if (!parentNote) return false;
            }

            targetNote.parentId = newParentId;
            targetNote.updatedAt = Date.now();

            storage.saveNotes(state.notes);

            if (onNotesChangeCallback) {
                onNotesChangeCallback();
            }

            return true;
        },

        duplicateNote(sourceNoteId) {
            const state = window.App.state;
            const storage = window.App.storage;
            const sourceNote = this.getNoteById(sourceNoteId);
            if (!sourceNote) return null;

            const clonedNotesList = [];

            // Рекурсивна функція копіювання нотатки та всіх її дочірніх нотаток
            const cloneNoteTree = (noteToClone, newParentId) => {
                const newNote = {
                    id: 'note_' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5),
                    boardId: noteToClone.boardId,
                    parentId: newParentId,
                    title: (noteToClone.id === sourceNoteId)
                        ? (noteToClone.title ? `${noteToClone.title} (Копія)` : 'Копія')
                        : (noteToClone.title || ''),
                    content: noteToClone.content || '',
                    color: noteToClone.color || 'yellow',
                    icon: noteToClone.icon || null,
                    tags: Array.isArray(noteToClone.tags) ? [...noteToClone.tags] : (noteToClone.tag ? [noteToClone.tag.text || noteToClone.tag] : []),
                    images: Array.isArray(noteToClone.images) ? JSON.parse(JSON.stringify(noteToClone.images)) : [],
                    fontSize: noteToClone.fontSize !== undefined ? noteToClone.fontSize : 16,
                    updatedAt: Date.now()
                };

                state.notes.push(newNote);
                clonedNotesList.push(newNote);

                // Знаходимо всіх прямих дітей та клонуємо їх
                const directChildren = state.notes.filter(n => n.boardId === noteToClone.boardId && n.parentId === noteToClone.id);
                directChildren.forEach(child => {
                    cloneNoteTree(child, newNote.id);
                });

                return newNote;
            };

            const rootClonedNote = cloneNoteTree(sourceNote, sourceNote.parentId || null);
            storage.saveNotes(state.notes);

            // Синхронізуємо всі клоновані нотатки з базою даних Supabase
            if (window.App.cloudSync) {
                clonedNotesList.forEach(clonedNote => {
                    window.App.cloudSync.syncNote(clonedNote);
                });
            }

            if (onNotesChangeCallback) {
                onNotesChangeCallback();
            }

            // Підсвічування створеної дубльованої нотатки
            setTimeout(() => {
                const noteElement = document.querySelector(`.note-sticker[data-note-id="${rootClonedNote.id}"]`);
                if (noteElement) {
                    noteElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    noteElement.classList.add('highlight-pulse');
                    setTimeout(() => noteElement.classList.remove('highlight-pulse'), 1200);
                }
            }, 100);

            return rootClonedNote;
        },

        duplicateNotes(sourceNoteIds) {
            const targetIds = Array.isArray(sourceNoteIds) ? sourceNoteIds : [sourceNoteIds];
            if (targetIds.length === 0) return [];
            const results = [];
            targetIds.forEach(id => {
                const res = this.duplicateNote(id);
                if (res) results.push(res);
            });
            return results;
        }
    };
})();
