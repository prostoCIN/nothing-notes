// js/boardManager.js - Управління блокнотами (створення, редагування, перемикання, видалення)
window.App = window.App || {};

(function() {
    let onBoardChangeCallback = null;
    let onWelcomeNeededCallback = null;

    window.App.boardManager = {
        init(callbacks) {
            onBoardChangeCallback = callbacks ? callbacks.onBoardChange : null;
            onWelcomeNeededCallback = callbacks ? callbacks.onWelcomeNeeded : null;
        },

        notifyBoardChanged(boardId) {
            if (onBoardChangeCallback) onBoardChangeCallback(boardId);
            if (window.App.events) window.App.events.emit('board:changed', boardId);
        },

        notifyWelcomeNeeded() {
            if (onWelcomeNeededCallback) onWelcomeNeededCallback();
            if (window.App.events) window.App.events.emit('welcome:needed');
        },

        getActiveBoard() {
            const state = window.App.state;
            if (!state.activeBoardId) return null;
            const ownBoard = state.boards.find(b => b.id === state.activeBoardId);
            if (ownBoard) return ownBoard;
            const readOnlyBoards = state.readOnlyBoards || [];
            return readOnlyBoards.find(b => b.id === state.activeBoardId) || null;
        },

        getBoardById(id) {
            const state = window.App.state;
            const ownBoard = state.boards.find(b => b.id === id);
            if (ownBoard) return ownBoard;
            const readOnlyBoards = state.readOnlyBoards || [];
            return readOnlyBoards.find(b => b.id === id) || null;
        },

        createBoard(name) {
            const trimmedName = name.trim();
            if (!trimmedName) return;

            const state = window.App.state;
            const storage = window.App.storage;

            const newBoard = {
                id: 'board_' + Date.now().toString(),
                name: trimmedName,
                createdAt: Date.now(),
                orderIndex: state.boards.length
            };
            state.boards.push(newBoard);
            storage.saveBoards(state.boards);

            if (window.App.cloudSync) {
                window.App.cloudSync.syncBoards();
            }

            if (window.App.events) {
                window.App.events.emit('board:created', newBoard);
            }

            this.switchBoard(newBoard.id);
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

            if (window.App.events) {
                window.App.events.emit('board:renamed', { boardId: id, name: trimmedName });
            }

            return true;
        },

        updateBoardIcon(id, newIcon) {
            const state = window.App.state;
            const storage = window.App.storage;

            const board = state.boards.find(b => b.id === id);
            if (!board) return false;

            board.icon = newIcon || null;
            storage.saveBoards(state.boards);

            if (window.App.cloudSync) {
                window.App.cloudSync.syncBoards();
            }

            if (window.App.events) {
                window.App.events.emit('board:icon_updated', { boardId: id, icon: newIcon });
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

            this.notifyBoardChanged(id);
        },

        reorderBoards(orderedBoardIds) {
            const state = window.App.state;
            const storage = window.App.storage;
            if (!state.boards || state.boards.length <= 1 || !Array.isArray(orderedBoardIds)) return;

            const boardMap = new Map(state.boards.map(b => [b.id, b]));
            const newBoards = [];

            orderedBoardIds.forEach((id, idx) => {
                const b = boardMap.get(id);
                if (b) {
                    b.orderIndex = idx;
                    newBoards.push(b);
                    boardMap.delete(id);
                }
            });

            // Додаємо блокноти, яких раптом не було у списку
            boardMap.forEach((b) => {
                b.orderIndex = newBoards.length;
                newBoards.push(b);
            });

            state.boards = newBoards;
            storage.saveBoards(state.boards);

            if (window.App.cloudSync) {
                window.App.cloudSync.syncBoards();
            }

            if (window.App.events) {
                window.App.events.emit('boards:reordered', state.boards);
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

                // Видаляємо всі нотатки цього блокнота та їхні фотографії
                const deletedNotes = state.notes.filter(n => n.boardId === id);
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

                state.notes = state.notes.filter(n => n.boardId !== id);
                storage.saveNotes(state.notes, true);

                if (window.App.events) {
                    window.App.events.emit('board:deleted', { boardId: id });
                }

                if (window.App.cloudSync) {
                    if (window.App.cloudSync.deleteBoardFromCloud) {
                        window.App.cloudSync.deleteBoardFromCloud(id);
                    }
                    window.App.cloudSync.syncBoards();
                    if (deletedNotes.length > 0) {
                        if (window.App.cloudSync.deleteNotesFromCloud) {
                            window.App.cloudSync.deleteNotesFromCloud(deletedNotes.map(dn => dn.id));
                        } else {
                            deletedNotes.forEach(dn => window.App.cloudSync.deleteNoteFromCloud(dn.id));
                        }
                    }
                    // Видаляємо посилання шерингу цього блокнота, щоб не лишати «мертвих» записів у базі
                    if (window.App.supabase) {
                        window.App.supabase.from('board_shares').delete().eq('board_id', id).then(() => {});
                    }
                }

                if (state.boards.length === 0) {
                    state.activeBoardId = null;
                    storage.saveActiveBoardId(null);
                    this.notifyWelcomeNeeded();
                } else {
                    if (state.activeBoardId === id) {
                        this.switchBoard(state.boards[0].id);
                    } else {
                        this.notifyBoardChanged(state.activeBoardId);
                    }
                }
            };

            const t = (k, p) => (window.App && window.App.i18n) ? window.App.i18n.t(k, p) : k;

            if (window.App.confirmModal) {
                window.App.confirmModal.show({
                    title: t('confirm.deleteBoardTitle', { name: boardName }) || `Видалити блокнот "${boardName}"?`,
                    message: t('confirm.deleteBoardMsg', { name: boardName, count: notesInBoardCount }) || `Ви дійсно хочете видалити блокнот <span class="confirm-modal-highlight">"${boardName}"</span>?${notesInBoardCount > 0 ? ` Всі нотатки в ньому (${notesInBoardCount} шт.) будуть назавжди стерті.` : ''}`,
                    confirmText: t('common.holdToConfirm') || 'Затисніть для видалення',
                    type: 'danger',
                    onConfirm: performDelete
                });
            } else {
                if (confirm(t('confirm.deleteBoardTitle', { name: boardName }) || `Ви впевнені, що хочете видалити блокнот "${boardName}"?`)) {
                    performDelete();
                }
            }
        },

        deleteBoards(ids, event) {
            if (event) event.stopPropagation();

            const state = window.App.state;
            const storage = window.App.storage;

            const targetIds = Array.isArray(ids) ? ids.filter(Boolean) : [ids];
            if (targetIds.length === 0) return;

            if (targetIds.length === 1) {
                return this.deleteBoard(targetIds[0], event);
            }

            const t = (k, p) => (window.App && window.App.i18n) ? window.App.i18n.t(k, p) : k;

            // Розділяємо на власні блокноти та спільні
            const ownBoardsToDelete = (state.boards || []).filter(b => targetIds.includes(b.id));
            const sharedBoardsToDelete = (state.readOnlyBoards || []).filter(b => targetIds.includes(b.id));

            const totalCount = ownBoardsToDelete.length + sharedBoardsToDelete.length;
            if (totalCount === 0) return;

            // Рахуємо нотатки у власних блокнотах
            const ownBoardIdsSet = new Set(ownBoardsToDelete.map(b => b.id));
            const notesInBoardsCount = (state.notes || []).filter(n => ownBoardIdsSet.has(n.boardId)).length;

            const boardNames = [...ownBoardsToDelete, ...sharedBoardsToDelete].map(b => b.name).join(', ');
            const displayNames = boardNames.length > 50 ? boardNames.slice(0, 47) + '...' : boardNames;

            const title = t('confirm.deleteBoardsTitle', { count: totalCount }) || `Видалити ${totalCount} блокнотів?`;
            let message = t('confirm.deleteBoardsMsg', { count: totalCount, names: displayNames }) || 
                `Ви дійсно хочете видалити ${totalCount} блокнотів: <span class="confirm-modal-highlight">"${displayNames}"</span>?`;
            
            if (notesInBoardsCount > 0) {
                message += `<br><br>Усі нотатки в них (${notesInBoardsCount} шт.) будуть назавжди стерті.`;
            }
            if (sharedBoardsToDelete.length > 0) {
                message += `<br><br>Спільні блокноти (${sharedBoardsToDelete.length} шт.) будуть відв'язані від вашого списку читання.`;
            }

            const performGroupDelete = () => {
                // 1. Відв'язуємо спільні блокноти
                sharedBoardsToDelete.forEach(sb => {
                    if (window.App.shareManager) {
                        window.App.shareManager.removeSharedBoard(sb.id);
                    }
                });

                // 2. Видаляємо власні блокноти
                if (ownBoardsToDelete.length > 0) {
                    state.boards = state.boards.filter(b => !ownBoardIdsSet.has(b.id));
                    storage.saveBoards(state.boards);

                    const deletedNotes = state.notes.filter(n => ownBoardIdsSet.has(n.boardId));
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

                    state.notes = state.notes.filter(n => !ownBoardIdsSet.has(n.boardId));
                    storage.saveNotes(state.notes, true);

                    if (window.App.events) {
                        ownBoardsToDelete.forEach(b => window.App.events.emit('board:deleted', { boardId: b.id }));
                    }

                    if (window.App.cloudSync) {
                        ownBoardsToDelete.forEach(b => {
                            if (window.App.cloudSync.deleteBoardFromCloud) {
                                window.App.cloudSync.deleteBoardFromCloud(b.id);
                            }
                        });
                        window.App.cloudSync.syncBoards();
                        if (deletedNotes.length > 0) {
                            if (window.App.cloudSync.deleteNotesFromCloud) {
                                window.App.cloudSync.deleteNotesFromCloud(deletedNotes.map(dn => dn.id));
                            } else {
                                deletedNotes.forEach(dn => window.App.cloudSync.deleteNoteFromCloud(dn.id));
                            }
                        }
                        if (window.App.supabase) {
                            window.App.supabase.from('board_shares').delete().in('board_id', Array.from(ownBoardIdsSet)).then(() => {});
                        }
                    }
                }

                // Очищаємо виділення
                if (state.selectedSidebarBoardIds) state.selectedSidebarBoardIds.clear();

                // Перемикаємо дошку або показуємо welcome
                const remainingOwnBoards = state.boards || [];
                const remainingSharedBoards = state.readOnlyBoards || [];
                const isCurrentActiveDeleted = targetIds.includes(state.activeBoardId);

                if (remainingOwnBoards.length === 0 && remainingSharedBoards.length === 0) {
                    state.activeBoardId = null;
                    storage.saveActiveBoardId(null);
                    this.notifyWelcomeNeeded();
                } else if (isCurrentActiveDeleted) {
                    const nextBoardId = remainingOwnBoards.length > 0 ? remainingOwnBoards[0].id : remainingSharedBoards[0].id;
                    this.switchBoard(nextBoardId);
                } else {
                    this.notifyBoardChanged(state.activeBoardId);
                }

                if (window.App.sidebarView) window.App.sidebarView.render();
            };

            if (window.App.confirmModal) {
                window.App.confirmModal.show({
                    title,
                    message,
                    confirmText: t('common.holdToConfirm') || 'Затисніть для видалення',
                    type: 'danger',
                    onConfirm: performGroupDelete
                });
            } else {
                if (confirm(title)) performGroupDelete();
            }
        }
    };
})();
