// js/historyManager.js - Глобальний менеджер історії дій (Undo / Redo, Ctrl+Z, Ctrl+Y)
window.App = window.App || {};

(function() {
    const MAX_HISTORY_STEPS = 80;
    const undoStack = [];
    const redoStack = [];
    let isExecutingHistoryAction = false;
    let textInputDebounceTimer = null;
    let preTypingSnapshot = null; // Знімок стану перед початком серії набору тексту

    window.App.historyManager = {
        init() {
            this.bindUIButtons();
            this.bindKeyboardShortcuts();
            this.updateButtonsState();
        },

        // Захоплення поточного знімка стану (snapshot)
        recordState(description = 'action') {
            if (isExecutingHistoryAction) return;

            const state = window.App.state;
            if (!state || !state.activeBoardId) return;

            // Створюємо чисту копію масиву об'єктів (структурне клонування)
            const snapshot = state.notes.map(n => ({ ...n }));

            undoStack.push(snapshot);
            if (undoStack.length > MAX_HISTORY_STEPS) {
                undoStack.shift();
            }

            // Нова дія очищає стек Redo та знімок перед набором
            redoStack.length = 0;
            preTypingSnapshot = null;
            this.updateButtonsState();
        },

        // Запис для подій введення тексту (набору літер, слів)
        recordTextChange() {
            if (isExecutingHistoryAction) return;

            const state = window.App.state;
            if (!state || !state.activeBoardId) return;

            // Якщо це початок нової серії набору тексту — зберігаємо стан "ДО" введення
            if (!preTypingSnapshot) {
                preTypingSnapshot = state.notes.map(n => ({ ...n }));
                undoStack.push(preTypingSnapshot);
                if (undoStack.length > MAX_HISTORY_STEPS) {
                    undoStack.shift();
                }
                this.updateButtonsState();
            }

            // Завершення блоку набору тексту після паузи у 600 мс
            clearTimeout(textInputDebounceTimer);
            textInputDebounceTimer = setTimeout(() => {
                const currentSnapshot = state.notes.map(n => ({ ...n }));
                undoStack.push(currentSnapshot);
                if (undoStack.length > MAX_HISTORY_STEPS) {
                    undoStack.shift();
                }
                preTypingSnapshot = null;
                this.updateButtonsState();
            }, 600);
        },

        undo() {
            // Якщо ще активний таймер набору тексту — миттєво завершуємо його
            if (textInputDebounceTimer) {
                clearTimeout(textInputDebounceTimer);
                textInputDebounceTimer = null;
            }
            preTypingSnapshot = null;

            if (undoStack.length === 0) return;

            const state = window.App.state;

            // Зберігаємо поточний стан у Redo перед відкатом
            const currentSnapshot = state.notes.map(n => ({ ...n }));
            redoStack.push(currentSnapshot);

            const previousSnapshot = undoStack.pop();
            if (previousSnapshot) {
                isExecutingHistoryAction = true;
                try {
                    this.applyStateUpdate(previousSnapshot.map(n => ({ ...n })));
                } catch (e) {
                    console.error('Помилка при Undo:', e);
                } finally {
                    isExecutingHistoryAction = false;
                }
            }

            this.updateButtonsState();
        },

        redo() {
            if (redoStack.length === 0) return;

            const state = window.App.state;

            // Поточний стан переносимо в Undo
            const currentSnapshot = state.notes.map(n => ({ ...n }));
            undoStack.push(currentSnapshot);

            const nextSnapshot = redoStack.pop();
            if (nextSnapshot) {
                isExecutingHistoryAction = true;
                try {
                    this.applyStateUpdate(nextSnapshot.map(n => ({ ...n })));
                } catch (e) {
                    console.error('Помилка при Redo:', e);
                } finally {
                    isExecutingHistoryAction = false;
                }
            }

            this.updateButtonsState();
        },

        // Розумне безшовне застосування змін стану (In-Place DOM Sync)
        applyStateUpdate(newNotes) {
            const state = window.App.state;
            const storage = window.App.storage;

            // Перевіряємо, чи змінилася кількість нотаток або їхні ID
            const currentIds = state.notes.map(n => n.id).join(',');
            const newIds = newNotes.map(n => n.id).join(',');
            const isStructuralChange = currentIds !== newIds;

            state.notes = newNotes;
            storage.saveNotes(state.notes);

            if (isStructuralChange) {
                // Якщо нотатку було створено чи видалено — повний рендер
                if (window.App.sidebarView) window.App.sidebarView.renderNotesList();
                if (window.App.workspaceView) window.App.workspaceView.render();
            } else {
                // Якщо це лише редагування тексту, розміру чи кольору — оновлюємо безпосередньо в DOM без знищення елементів
                newNotes.forEach(note => {
                    const card = document.querySelector(`.note-sticker[data-note-id="${note.id}"]`);
                    if (card) {
                        const titleEl = card.querySelector('.sticker-title');
                        if (titleEl && titleEl.innerText.trim() !== (note.title || '').trim()) {
                            titleEl.innerText = note.title || '';
                        }

                        const contentEl = card.querySelector('.sticker-content');
                        if (contentEl && contentEl.innerHTML !== (note.content || '')) {
                            contentEl.innerHTML = note.content || '';
                            if (!note.content || !note.content.trim()) {
                                contentEl.setAttribute('data-empty', 'true');
                            } else {
                                contentEl.removeAttribute('data-empty');
                            }
                        }

                        if (card.dataset.color !== note.color) {
                            card.dataset.color = note.color || 'yellow';
                        }
                    }

                    // Синхронізуємо сайдбар
                    if (window.App.sidebarView) {
                        window.App.sidebarView.updateNoteListItem(note.id, note.title, note.icon);
                    }
                });
            }
        },

        bindUIButtons() {
            const undoBtn = document.getElementById('workspace-undo-btn');
            const redoBtn = document.getElementById('workspace-redo-btn');

            if (undoBtn) {
                undoBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.undo();
                });
            }

            if (redoBtn) {
                redoBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.redo();
                });
            }
        },

        bindKeyboardShortcuts() {
            // Використовуємо useCapture = true та перевіряємо e.code для роботи з будь-якою мовною розкладкою
            window.addEventListener('keydown', (e) => {
                const isCtrlOrCmd = e.ctrlKey || e.metaKey;
                if (!isCtrlOrCmd) return;

                const code = e.code; // 'KeyZ', 'KeyY' працює незалежно від мови клавіатури (українська/англійська)
                const key = e.key.toLowerCase();

                // Ctrl+Z (Undo) або Ctrl+Shift+Z (Redo)
                if (code === 'KeyZ' || key === 'z' || key === 'я') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                } 
                // Ctrl+Y (Redo на Windows/Linux)
                else if (code === 'KeyY' || key === 'y' || key === 'н') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.redo();
                }
            }, true);
        },

        updateButtonsState() {
            const undoBtn = document.getElementById('workspace-undo-btn');
            const redoBtn = document.getElementById('workspace-redo-btn');

            if (undoBtn) {
                const canUndo = undoStack.length > 0;
                undoBtn.disabled = !canUndo;
                undoBtn.classList.toggle('disabled', !canUndo);
            }

            if (redoBtn) {
                const canRedo = redoStack.length > 0;
                redoBtn.disabled = !canRedo;
                redoBtn.classList.toggle('disabled', !canRedo);
            }
        },

        reset() {
            undoStack.length = 0;
            redoStack.length = 0;
            this.updateButtonsState();
        }
    };
})();