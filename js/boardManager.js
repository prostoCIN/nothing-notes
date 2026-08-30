// js/boardManager.js - Управління блокнотами (створення, редагування, перемикання, видалення)
window.App = window.App || {};

(function() {
    let onBoardChangeCallback = null;
    let onWelcomeNeededCallback = null;

    window.App.boardManager = {
        init(callbacks) {
            onBoardChangeCallback = callbacks.onBoardChange;
            onWelcomeNeededCallback = callbacks.onWelcomeNeeded;
        },

        getActiveBoard() {
            const state = window.App.state;
            return state.boards.find(b => b.id === state.activeBoardId) || null;
        },

        createBoard(name) {
            const trimmedName = name.trim();
            if (!trimmedName) return;

            const state = window.App.state;
            const storage = window.App.storage;
            const els = window.App.getElements();

            const newBoard = {
                id: 'board_' + Date.now().toString(),
                name: trimmedName,
                createdAt: Date.now()
            };
            state.boards.push(newBoard);
            storage.saveBoards(state.boards);

            if (window.App.cloudSync) {
                window.App.cloudSync.syncBoards();
            }

            this.switchBoard(newBoard.id);

            if (els.welcomeBoardInput) els.welcomeBoardInput.value = '';
            if (els.sidebarNewBoardInput) els.sidebarNewBoardInput.value = '';
        },

        renameBoard(id, newName) {
            const trimmedName = newName.trim();
            if (!trimmedName) return false;

            const state = window.App.state;
            const storage = window.App.storage;

            const board = state.boards.find(b => b.id === id);
            if (!board) return false;

            board.name = trimmedName;
            storage.saveBoards(state.boards);

            if (window.App.cloudSync) {
                window.App.cloudSync.syncBoards();
            }

            // Синхронізуємо DOM назви блокнота в сайдбарі
            const sidebarBoardText = document.querySelector(`.board-item[data-board-id="${id}"] .board-item-text`);
            if (sidebarBoardText) {
                sidebarBoardText.textContent = trimmedName;
            }

            // Синхронізуємо заголовок кореневої колонки, якщо це активний блокнот
            if (state.activeBoardId === id) {
                const rootColTitle = document.querySelector('.board-column.root-column .column-title');
                if (rootColTitle && rootColTitle.innerText !== trimmedName) {
                    rootColTitle.innerText = trimmedName;
                }
            }

            return true;
        },

        switchBoard(id) {
            const state = window.App.state;
            const storage = window.App.storage;

            state.activeBoardId = id;
            storage.saveActiveBoardId(id);
            state.activeChain = [null]; // Скидаємо ланцюжок відкритих колонок
            state.expandedSidebarNoteIds.clear();

            if (onBoardChangeCallback) {
                onBoardChangeCallback();
            }
        },

        deleteBoard(id, event) {
            if (event) event.stopPropagation();

            const state = window.App.state;
            const storage = window.App.storage;
            const board = state.boards.find(b => b.id === id);
            const boardName = board ? board.name : 'цей блокнот';
            const notesInBoardCount = state.notes.filter(n => n.boardId === id).length;

            const performDelete = () => {
                // Видаляємо блокнот
                state.boards = state.boards.filter(b => b.id !== id);
                storage.saveBoards(state.boards);

                // Видаляємо всі нотатки цього блокнота
                state.notes = state.notes.filter(n => n.boardId !== id);
                storage.saveNotes(state.notes);

                if (state.boards.length === 0) {
                    state.activeBoardId = null;
                    storage.saveActiveBoardId(null);
                    if (onWelcomeNeededCallback) onWelcomeNeededCallback();
                } else {
                    if (state.activeBoardId === id) {
                        this.switchBoard(state.boards[0].id);
                    } else if (onBoardChangeCallback) {
                        onBoardChangeCallback();
                    }
                }
            };

            if (window.App.confirmModal) {
                window.App.confirmModal.show({
                    title: 'Видалити блокнот?',
                    message: `Ви дійсно хочете видалити блокнот <span class="confirm-modal-highlight">"${boardName}"</span>?${notesInBoardCount > 0 ? ` Всі нотатки в ньому (${notesInBoardCount} шт.) будуть назавжди стерті.` : ''}`,
                    onConfirm: performDelete
                });
            } else {
                if (confirm(`Ви впевнені, що хочете видалити блокнот "${boardName}"?`)) {
                    performDelete();
                }
            }
        }
    };
})();
