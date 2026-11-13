// js/historyManager.js - Оптимізований менеджер історії дій (Undo / Redo, Ctrl+Z, Ctrl+Y)
// Працює на базі Smart Delta Diff, дедуплікації знімків та неблокуючого введення.
window.App = window.App || {};

(function() {
    const MAX_HISTORY_STEPS = 50;
    
    // Ізольована історія дій для кожного окремого блокнота (boardId -> { undoStack, redoStack, preTypingSnapshot })
    const boardHistory = new Map();
    let isExecutingHistoryAction = false;
    let textInputDebounceTimer = null;

    // Відкладена черга хмарної синхронізації
    let cloudSyncDebounceTimer = null;
    const pendingCloudModified = new Map();
    const pendingCloudDeleted = new Set();

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
                tags: Array.isArray(n.tags) ? [...n.tags] : [],
                linkedNoteIds: Array.isArray(n.linkedNoteIds) ? [...n.linkedNoteIds] : []
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
        if (a.canvasX !== b.canvasX) return false;
        if (a.canvasY !== b.canvasY) return false;
        if (a.boardX !== b.boardX) return false;
        if (a.boardY !== b.boardY) return false;

        // Порівняння масивів тегів
        const aTags = Array.isArray(a.tags) ? a.tags : [];
        const bTags = Array.isArray(b.tags) ? b.tags : [];
        if (aTags.length !== bTags.length) return false;
        for (let i = 0; i < aTags.length; i++) {
            if (aTags[i] !== bTags[i]) return false;
        }

        // Порівняння закладок
        const aLinked = Array.isArray(a.linkedNoteIds) ? a.linkedNoteIds : [];
        const bLinked = Array.isArray(b.linkedNoteIds) ? b.linkedNoteIds : [];
        if (aLinked.length !== bLinked.length) return false;
        for (let i = 0; i < aLinked.length; i++) {
            if (aLinked[i] !== bLinked[i]) return false;
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

    /**
     * Порівняння двох повних знімків блокнота для усунення дублікатів (Ghost Undo)
     */
    function areSnapshotsEqual(snapA, snapB) {
        if (!snapA || !snapB) return false;
        if (snapA.length !== snapB.length) return false;
        const mapB = new Map(snapB.map(n => [n.id, n]));
        for (let i = 0; i < snapA.length; i++) {
            const a = snapA[i];
            const b = mapB.get(a.id);
            if (!b || !areNotesEqual(a, b)) return false;
        }
        return true;
    }

    window.App.historyManager = {
        init() {
            this.bindUIButtons();
            this.bindKeyboardShortcuts();
            this.updateButtonsState();
        },

        // Захоплення поточного знімка стану активного блокнота з дедуплікацією
        recordState(description = 'action') {
            if (isExecutingHistoryAction) return;

            const state = window.App.state;
            if (!state || !state.activeBoardId) return;

            const h = getActiveBoardHistory();
            const snapshot = captureActiveBoardSnapshot();

            // Якщо попередній стан у стеку такий самий — не дублюємо
            const lastInStack = h.undoStack[h.undoStack.length - 1];
            if (lastInStack && areSnapshotsEqual(lastInStack, snapshot)) {
                return;
            }

            h.undoStack.push(snapshot);
            if (h.undoStack.length > MAX_HISTORY_STEPS) {
                h.undoStack.shift();
            }

            // Нова дія очищає Redo
            h.redoStack.length = 0;
            h.preTypingSnapshot = null;
            this.updateButtonsState();
        },

        // Запис для подій введення тексту (дебаунс 450 мс з дедуплікацією)
        recordTextChange() {
            if (isExecutingHistoryAction) return;

            const state = window.App.state;
            if (!state || !state.activeBoardId) return;

            const h = getActiveBoardHistory();

            // Фіксуємо стан "ДО" початку серії введення тексту
            if (!h.preTypingSnapshot) {
                h.preTypingSnapshot = captureActiveBoardSnapshot();
                const lastInStack = h.undoStack[h.undoStack.length - 1];
                if (!lastInStack || !areSnapshotsEqual(lastInStack, h.preTypingSnapshot)) {
                    h.undoStack.push(h.preTypingSnapshot);
                    if (h.undoStack.length > MAX_HISTORY_STEPS) {
                        h.undoStack.shift();
                    }
                    this.updateButtonsState();
                }
            }

            clearTimeout(textInputDebounceTimer);
            textInputDebounceTimer = setTimeout(() => {
                const currentSnapshot = captureActiveBoardSnapshot();
                const lastInStack = h.undoStack[h.undoStack.length - 1];
                if (!lastInStack || !areSnapshotsEqual(lastInStack, currentSnapshot)) {
                    h.undoStack.push(currentSnapshot);
                    if (h.undoStack.length > MAX_HISTORY_STEPS) {
                        h.undoStack.shift();
                    }
                }
                h.preTypingSnapshot = null;
                this.updateButtonsState();
            }, 450);
        },

        // Відкат (Undo) з дедуплікацією — гарантоване спрацьовування з першого кліку
        undo() {
            if (textInputDebounceTimer) {
                clearTimeout(textInputDebounceTimer);
                textInputDebounceTimer = null;
            }

            const h = getActiveBoardHistory();
            h.preTypingSnapshot = null;

            if (h.undoStack.length === 0) return;

            const currentSnapshot = captureActiveBoardSnapshot();

            // Шукаємо перший попередній стан, який РЕАЛЬНО відрізняється від поточного на екрані
            let previousSnapshot = null;
            while (h.undoStack.length > 0) {
                const candidate = h.undoStack.pop();
                if (!areSnapshotsEqual(candidate, currentSnapshot)) {
                    previousSnapshot = candidate;
                    break;
                }
            }

            if (!previousSnapshot) {
                this.updateButtonsState();
                return;
            }

            // Поточний стан записуємо в Redo
            h.redoStack.push(currentSnapshot);

            isExecutingHistoryAction = true;
            try {
                this.triggerVisualFeedback('undo');
                this.applyStateUpdate(previousSnapshot);
            } catch (e) {
                console.error('[HistoryManager] Помилка при Undo:', e);
            } finally {
                isExecutingHistoryAction = false;
            }

            this.updateButtonsState();
        },

        // Повторення (Redo) з дедуплікацією
        redo() {
            const h = getActiveBoardHistory();
            if (h.redoStack.length === 0) return;

            const currentSnapshot = captureActiveBoardSnapshot();

            // Шукаємо наступний стан, який РЕАЛЬНО відрізняється від поточного
            let nextSnapshot = null;
            while (h.redoStack.length > 0) {
                const candidate = h.redoStack.pop();
                if (!areSnapshotsEqual(candidate, currentSnapshot)) {
                    nextSnapshot = candidate;
                    break;
                }
            }

            if (!nextSnapshot) {
                this.updateButtonsState();
                return;
            }

            // Поточний стан записуємо в Undo
            h.undoStack.push(currentSnapshot);

            isExecutingHistoryAction = true;
            try {
                this.triggerVisualFeedback('redo');
                this.applyStateUpdate(nextSnapshot);
            } catch (e) {
                console.error('[HistoryManager] Помилка при Redo:', e);
            } finally {
                isExecutingHistoryAction = false;
            }

            this.updateButtonsState();
        },

        // Розумне точкове застосування змін стану (Smart Diff) без блокування UI
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
                    actuallyDeletedIds.push(curr.id);
                } else if (!areNotesEqual(curr, target)) {
                    actuallyModified.push(target);
                }
            });

            // 2. Знаходимо відновлені нотатки
            targetBoardNotes.forEach(target => {
                if (!currentMap.has(target.id)) {
                    actuallyRestored.push(target);
                }
            });

            const now = Date.now();
            actuallyModified.forEach(n => { n.updatedAt = now; });
            actuallyRestored.forEach(n => { n.updatedAt = now; });

            // Оновлюємо стан: нотатки інших блокнотів залишаються неторканими
            const otherBoardsNotes = state.notes.filter(n => n.boardId !== activeBoardId);
            state.notes = [...otherBoardsNotes, ...targetBoardNotes];

            // 1. Асинхронний запис у LocalStorage (не блокує інтерфейс синхронним stringify)
            storage.saveNotes(state.notes, false);

            // 2. Відкладена дебаунс-синхронізація з хмарою (зменшує затримку мережі при серійних натисканнях)
            this.scheduleCloudSync(actuallyModified, actuallyRestored, actuallyDeletedIds);

            // 3. Миттєве оновлення UI
            if (window.App.sidebarView) window.App.sidebarView.render();
            if (window.App.workspaceView) window.App.workspaceView.render();

            if (window.App.workspaceSelectionBar && typeof window.App.workspaceSelectionBar.refreshTagSubmenu === 'function') {
                window.App.workspaceSelectionBar.refreshTagSubmenu();
                window.App.workspaceSelectionBar.updateUI();
            }
        },

        // Дебаунс хмарної синхронізації
        scheduleCloudSync(modified, restored, deletedIds) {
            if (!window.App.cloudSync) return;

            (modified || []).forEach(n => pendingCloudModified.set(n.id, n));
            (restored || []).forEach(n => pendingCloudModified.set(n.id, n));
            (deletedIds || []).forEach(id => {
                pendingCloudDeleted.add(id);
                pendingCloudModified.delete(id);
            });

            clearTimeout(cloudSyncDebounceTimer);
            cloudSyncDebounceTimer = setTimeout(() => {
                if (window.App.cloudSync) {
                    if (pendingCloudDeleted.size > 0) {
                        const toDelete = Array.from(pendingCloudDeleted);
                        if (typeof window.App.cloudSync.deleteNotesFromCloud === 'function') {
                            window.App.cloudSync.deleteNotesFromCloud(toDelete);
                        } else {
                            toDelete.forEach(id => window.App.cloudSync.deleteNoteFromCloud(id));
                        }
                        pendingCloudDeleted.clear();
                    }

                    if (pendingCloudModified.size > 0) {
                        pendingCloudModified.forEach(note => window.App.cloudSync.syncNote(note));
                        if (typeof window.App.cloudSync.flushPendingNotes === 'function') {
                            window.App.cloudSync.flushPendingNotes();
                        }
                        pendingCloudModified.clear();
                    }
                }
            }, 350);
        },

        // Візуальний мікро-відгук на кнопках у хедері
        triggerVisualFeedback(action = 'undo') {
            const btnId = action === 'redo' ? 'workspace-redo-btn' : 'workspace-undo-btn';
            const btn = document.getElementById(btnId);
            if (btn && !btn.disabled) {
                btn.classList.add('history-active-pulse');
                setTimeout(() => {
                    btn.classList.remove('history-active-pulse');
                }, 180);
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
                const isUndoKey = (code === 'KeyZ' || key === 'z' || key === 'я') && !e.shiftKey;
                const isRedoKey = (code === 'KeyY' || key === 'y' || key === 'н') || ((code === 'KeyZ' || key === 'z' || key === 'я') && e.shiftKey);

                if (!isUndoKey && !isRedoKey) return;

                // 1. Якщо користувач у полі вводу чи textarea — залишаємо нативне скасування тексту
                const activeEl = document.activeElement;
                if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                    return;
                }

                // 2. Якщо користувач редагує текст у нотатці (contenteditable) — дозволяємо браузеру
                // виконувати миттєве посимвольне скасування тексту (0 мс) зі збереженням позиції курсору
                const isContentEditable = activeEl && (activeEl.isContentEditable || activeEl.closest('[contenteditable="true"]'));
                if (isContentEditable) {
                    return;
                }

                // 3. Для всіх інших випадків (робочий простір, картки, переміщення, кольори, видалення тощо):
                e.preventDefault();
                e.stopPropagation();

                if (isUndoKey) {
                    this.undo();
                } else if (isRedoKey) {
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
