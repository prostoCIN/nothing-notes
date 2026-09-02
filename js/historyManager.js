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

            // Глибока копія стану з усіма масивами тегів та зображень
            const snapshot = JSON.parse(JSON.stringify(state.notes));

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
                preTypingSnapshot = JSON.parse(JSON.stringify(state.notes));
                undoStack.push(preTypingSnapshot);
                if (undoStack.length > MAX_HISTORY_STEPS) {
                    undoStack.shift();
                }
                this.updateButtonsState();
            }

            // Завершення блоку набору тексту після паузи у 600 мс
            clearTimeout(textInputDebounceTimer);
            textInputDebounceTimer = setTimeout(() => {
                const currentSnapshot = JSON.parse(JSON.stringify(state.notes));
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
            const currentSnapshot = JSON.parse(JSON.stringify(state.notes));
            redoStack.push(currentSnapshot);

            const previousSnapshot = undoStack.pop();
            if (previousSnapshot) {
                isExecutingHistoryAction = true;
                try {
                    this.applyStateUpdate(JSON.parse(JSON.stringify(previousSnapshot)));
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
            const currentSnapshot = JSON.parse(JSON.stringify(state.notes));
            undoStack.push(currentSnapshot);

            const nextSnapshot = redoStack.pop();
            if (nextSnapshot) {
                isExecutingHistoryAction = true;
                try {
                    this.applyStateUpdate(JSON.parse(JSON.stringify(nextSnapshot)));
                } catch (e) {
                    console.error('Помилка при Redo:', e);
                } finally {
                    isExecutingHistoryAction = false;
                }
            }

            this.updateButtonsState();
        },

        // Розумне безшовне застосування змін стану
        applyStateUpdate(newNotes) {
            const state = window.App.state;
            const storage = window.App.storage;

            const previousNotes = state.notes || [];
            const newIdsSet = new Set(newNotes.map(n => n.id));
            const deletedNotes = previousNotes.filter(n => !newIdsSet.has(n.id));

            // Оновлюємо timestamp для всіх змінених або відновлених нотаток
            const now = Date.now();
            newNotes.forEach(note => {
                note.updatedAt = now;
            });

            state.notes = newNotes;
            storage.saveNotes(state.notes);

            // 1. Якщо при Undo відкотилося створення нотатки (вона зникла) — видаляємо її з хмари
            if (deletedNotes.length > 0 && window.App.cloudSync) {
                const deletedIds = deletedNotes.map(n => n.id);
                if (typeof window.App.cloudSync.deleteNotesFromCloud === 'function') {
                    window.App.cloudSync.deleteNotesFromCloud(deletedIds);
                } else {
                    deletedIds.forEach(id => window.App.cloudSync.deleteNoteFromCloud(id));
                }
            }

            // 2. Якщо нотатки були відновлені або змінені — миттєво пушимо їх у хмару
            if (window.App.cloudSync && typeof window.App.cloudSync.syncNote === 'function') {
                newNotes.forEach(note => window.App.cloudSync.syncNote(note));
                if (typeof window.App.cloudSync.flushPendingNotes === 'function') {
                    window.App.cloudSync.flushPendingNotes();
                }
            }

            // Оновлюємо інтерфейс
            if (window.App.sidebarView) window.App.sidebarView.render();
            if (window.App.workspaceView) window.App.workspaceView.render();

            if (window.App.workspaceSelectionBar && typeof window.App.workspaceSelectionBar.refreshTagSubmenu === 'function') {
                window.App.workspaceSelectionBar.refreshTagSubmenu();
                window.App.workspaceSelectionBar.updateUI();
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