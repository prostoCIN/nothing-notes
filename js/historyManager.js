// js/historyManager.js - Оптимізований менеджер історії дій (Undo / Redo, Ctrl+Z, Ctrl+Y)
// Працює на базі Smart Delta Diff: вираховує точкові зміни без копіювання всього додатку та без спаму в БД.
window.App = window.App || {};

(function() {
    const MAX_HISTORY_STEPS = 50;
    
    // Ізольована історія дій для кожного окремого блокнота (boardId -> { undoStack, redoStack, preTypingSnapshot })
    const boardHistory = new Map();
    let isExecutingHistoryAction = false;
    let textInputDebounceTimer = null;

    /**
     * Отримати сховище історії для поточного активного блокнота
     */
    function getActiveBoardHistory() {
        const state = window.App.state;
        const activeBoardId = (state && state.activeBoardId) ? state.activeBoardId : 'default';
        if (!boardHistory.has(activeBoardId)) {
            boardHistory.set(activeBoardId, {
                undoStack: [],
                redoStack: [],
                preTypingSnapshot: null
            });
        }
        return boardHistory.get(activeBoardId);
    }

    /**
     * Створює легковажну копію нотаток ТІЛЬКИ для поточного активного блокнота
     */
    function captureActiveBoardSnapshot() {
        const state = window.App.state;
        if (!state || !state.activeBoardId || !Array.isArray(state.notes)) return [];
        const activeBoardId = state.activeBoardId;

        return state.notes
            .filter(n => n.boardId === activeBoardId)
            .map(n => ({
                ...n,
                images: Array.isArray(n.images) ? JSON.parse(JSON.stringify(n.images)) : [],
                tags: Array.isArray(n.tags) ? [...n.tags] : []
            }));
    }

    /**
     * Глибоке порівняння двох нотаток для визначення реальних змін
     */
    function areNotesEqual(a, b) {
        if (!a || !b) return false;
        if (a.title !== b.title) return false;
        if (a.content !== b.content) return false;
        if (a.color !== b.color) return false;
        if (a.fontSize !== b.fontSize) return false;
        if (a.parentId !== b.parentId) return false;
        if (a.orderIndex !== b.orderIndex) return false;
        if (a.icon !== b.icon) return false;
        if (a.isCollapsed !== b.isCollapsed) return false;
        if (a.gridCol !== b.gridCol) return false;

        // Порівняння масивів тегів
        const aTags = Array.isArray(a.tags) ? a.tags : [];
        const bTags = Array.isArray(b.tags) ? b.tags : [];
        if (aTags.length !== bTags.length) return false;
        for (let i = 0; i < aTags.length; i++) {
            if (aTags[i] !== bTags[i]) return false;
        }

        // Порівняння зображень
        const aImgs = Array.isArray(a.images) ? a.images : [];
        const bImgs = Array.isArray(b.images) ? b.images : [];
        if (aImgs.length !== bImgs.length) return false;
        for (let i = 0; i < aImgs.length; i++) {
            if (!aImgs[i] || !bImgs[i]) return false;
            if (aImgs[i].id !== bImgs[i].id || aImgs[i].url !== bImgs[i].url) return false;
        }

        return true;
    }

    window.App.historyManager = {
        init() {
            this.bindUIButtons();
            this.bindKeyboardShortcuts();
            this.updateButtonsState();
        },

        // Захоплення поточного знімка стану активного блокнота
        recordState(description = 'action') {
            if (isExecutingHistoryAction) return;

            const state = window.App.state;
            if (!state || !state.activeBoardId) return;

            const h = getActiveBoardHistory();
            const snapshot = captureActiveBoardSnapshot();

            h.undoStack.push(snapshot);
            if (h.undoStack.length > MAX_HISTORY_STEPS) {
                h.undoStack.shift();
            }

            // Нова дія очищає Redo
            h.redoStack.length = 0;
            h.preTypingSnapshot = null;
            this.updateButtonsState();
        },

        // Запис для подій введення тексту (дебаунс 600 мс)
        recordTextChange() {
            if (isExecutingHistoryAction) return;

            const state = window.App.state;
            if (!state || !state.activeBoardId) return;

            const h = getActiveBoardHistory();

            // Фіксуємо стан "ДО" початку серії введення тексту
            if (!h.preTypingSnapshot) {
                h.preTypingSnapshot = captureActiveBoardSnapshot();
                h.undoStack.push(h.preTypingSnapshot);
                if (h.undoStack.length > MAX_HISTORY_STEPS) {
                    h.undoStack.shift();
                }
                this.updateButtonsState();
            }

            clearTimeout(textInputDebounceTimer);
            textInputDebounceTimer = setTimeout(() => {
                const currentSnapshot = captureActiveBoardSnapshot();
                h.undoStack.push(currentSnapshot);
                if (h.undoStack.length > MAX_HISTORY_STEPS) {
                    h.undoStack.shift();
                }
                h.preTypingSnapshot = null;
                this.updateButtonsState();
            }, 600);
        },

        undo() {
            if (textInputDebounceTimer) {
                clearTimeout(textInputDebounceTimer);
                textInputDebounceTimer = null;
            }

            const h = getActiveBoardHistory();
            h.preTypingSnapshot = null;

            if (h.undoStack.length === 0) return;

            // Зберігаємо поточний стан у Redo перед відкатом
            const currentSnapshot = captureActiveBoardSnapshot();
            h.redoStack.push(currentSnapshot);

            const previousSnapshot = h.undoStack.pop();
            if (previousSnapshot) {
                isExecutingHistoryAction = true;
                try {
                    this.applyStateUpdate(previousSnapshot);
                } catch (e) {
                    console.error('[HistoryManager] Помилка при Undo:', e);
                } finally {
                    isExecutingHistoryAction = false;
                }
            }

            this.updateButtonsState();
        },

        redo() {
            const h = getActiveBoardHistory();
            if (h.redoStack.length === 0) return;

            // Поточний стан переносимо в Undo
            const currentSnapshot = captureActiveBoardSnapshot();
            h.undoStack.push(currentSnapshot);

            const nextSnapshot = h.redoStack.pop();
            if (nextSnapshot) {
                isExecutingHistoryAction = true;
                try {
                    this.applyStateUpdate(nextSnapshot);
                } catch (e) {
                    console.error('[HistoryManager] Помилка при Redo:', e);
                } finally {
                    isExecutingHistoryAction = false;
                }
            }

            this.updateButtonsState();
        },

        // Розумне точкове застосування змін стану (Smart Diff)
        applyStateUpdate(targetBoardNotes) {
            const state = window.App.state;
            const storage = window.App.storage;
            if (!state || !state.activeBoardId) return;

            const activeBoardId = state.activeBoardId;
            const currentBoardNotes = state.notes.filter(n => n.boardId === activeBoardId);
            const currentMap = new Map(currentBoardNotes.map(n => [n.id, n]));
            const targetMap = new Map(targetBoardNotes.map(n => [n.id, n]));

            const actuallyModified = [];
            const actuallyDeletedIds = [];
            const actuallyRestored = [];

            // 1. Знаходимо змінені або відкочені (видалені) нотатки
            currentBoardNotes.forEach(curr => {
                const target = targetMap.get(curr.id);
                if (!target) {
                    // Нотатка була в поточному стані, але її немає у відновлюваному стані (скасування створення)
                    actuallyDeletedIds.push(curr.id);
                } else if (!areNotesEqual(curr, target)) {
                    // Нотатка дійсно змінилася за своїм вмістом чи параметрами
                    actuallyModified.push(target);
                }
            });

            // 2. Знаходимо відновлені нотатки (були видалені, але повертаються)
            targetBoardNotes.forEach(target => {
                if (!currentMap.has(target.id)) {
                    actuallyRestored.push(target);
                }
            });

            console.log('[HistoryManager] ⚡ Smart Diff applied:', {
                modified: actuallyModified.length,
                restored: actuallyRestored.length,
                deleted: actuallyDeletedIds.length
            });

            const now = Date.now();
            // Оновлюємо timestamp ТІЛЬКИ для нотаток, які реально змінилися або повернулися
            actuallyModified.forEach(n => { n.updatedAt = now; });
            actuallyRestored.forEach(n => { n.updatedAt = now; });

            // Оновлюємо стан: нотатки інших блокнотів залишаються неторканими
            const otherBoardsNotes = state.notes.filter(n => n.boardId !== activeBoardId);
            state.notes = [...otherBoardsNotes, ...targetBoardNotes];
            storage.saveNotes(state.notes);

            // 3. ТОЧКОВА синхронізація з Supabase: пушимо тільки реальні зміни!
            if (window.App.cloudSync) {
                // Видаляємо нотатки, чиє створення скасувалося
                if (actuallyDeletedIds.length > 0) {
                    if (typeof window.App.cloudSync.deleteNotesFromCloud === 'function') {
                        window.App.cloudSync.deleteNotesFromCloud(actuallyDeletedIds);
                    } else {
                        actuallyDeletedIds.forEach(id => window.App.cloudSync.deleteNoteFromCloud(id));
                    }
                }

                // Пушимо ТІЛЬКИ реально змінені та відновлені нотатки
                const notesToSync = [...actuallyModified, ...actuallyRestored];
                if (notesToSync.length > 0) {
                    notesToSync.forEach(note => window.App.cloudSync.syncNote(note));
                    if (typeof window.App.cloudSync.flushPendingNotes === 'function') {
                        window.App.cloudSync.flushPendingNotes();
                    }
                }
            }

            // Оновлюємо UI
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
            // Підтримка e.code для роботи з будь-якою розкладкою (UA / EN)
            window.addEventListener('keydown', (e) => {
                const isCtrlOrCmd = e.ctrlKey || e.metaKey;
                if (!isCtrlOrCmd) return;

                const code = e.code;
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
                // Ctrl+Y (Redo)
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

            const h = getActiveBoardHistory();
            const canUndo = h.undoStack.length > 0;
            const canRedo = h.redoStack.length > 0;

            if (undoBtn) {
                undoBtn.disabled = !canUndo;
                undoBtn.classList.toggle('disabled', !canUndo);
            }

            if (redoBtn) {
                redoBtn.disabled = !canRedo;
                redoBtn.classList.toggle('disabled', !canRedo);
            }
        },

        // Скидання історії: all = true очищає всі блокноти (logout), all = false — тільки активний
        reset(all = false) {
            if (all) {
                boardHistory.clear();
            } else {
                const h = getActiveBoardHistory();
                h.undoStack.length = 0;
                h.redoStack.length = 0;
                h.preTypingSnapshot = null;
            }
            this.updateButtonsState();
        }
    };
})();