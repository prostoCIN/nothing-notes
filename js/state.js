// js/state.js - Глобальний стан додатку та сховище LocalStorage
window.App = window.App || {};

// Загальні константи для стікерів, палітр та типографіки
window.App.NOTE_COLORS = [
    { id: 'yellow', hex: '#fef08a', name: 'Жовтий' },
    { id: 'green',  hex: '#bbf7d0', name: 'Зелений' },
    { id: 'blue',   hex: '#bae6fd', name: 'Блакитний' },
    { id: 'purple', hex: '#e9d5ff', name: 'Фіолетовий' },
    { id: 'pink',   hex: '#fbcfe8', name: 'Рожевий' },
    { id: 'orange', hex: '#fed7aa', name: 'Помаранчевий' },
    { id: 'gray',   hex: '#e2e8f0', name: 'Сірий' }
];

window.App.FONT_SIZES = [12, 16, 24, 32];
window.App.FONT_LABELS = ['S (12px)', 'M (16px)', 'L (24px)', 'XL (32px)'];

// Єдиний хелпер генерації колірного індексу Washi-тегу (0..5)
window.App.getTagColorIndex = function(tagText) {
    if (!tagText) return 0;
    let hash = 0;
    for (let i = 0; i < tagText.length; i++) {
        hash = tagText.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 6;
};

window.App.storage = {
    _notesSaveTimer: null,
    _pendingNotes: null,

    getBoards() {
        return JSON.parse(localStorage.getItem('minimal_boards')) || [];
    },
    saveBoards(boards) {
        localStorage.setItem('minimal_boards', JSON.stringify(boards));
    },
    getNotes() {
        return JSON.parse(localStorage.getItem('minimal_notes')) || [];
    },

    // Оптимізоване збереження нотаток з дебаунсом 300мс для уникнення надлишкових I/O операцій
    saveNotes(notes, immediate = false) {
        this._pendingNotes = notes;
        
        if (immediate) {
            this.flushNotes();
            return;
        }

        clearTimeout(this._notesSaveTimer);
        this._notesSaveTimer = setTimeout(() => {
            this.flushNotes();
        }, 300);
    },

    // Негайний фізичний запис у LocalStorage з захистом від помилок переповнення
    flushNotes() {
        if (this._pendingNotes) {
            try {
                localStorage.setItem('minimal_notes', JSON.stringify(this._pendingNotes));
                this._pendingNotes = null;
                clearTimeout(this._notesSaveTimer);
                this._notesSaveTimer = null;
            } catch (err) {
                console.warn('LocalStorage save error (likely quota exceeded):', err);
            }
        }
    },

    getActiveBoardId() {
        return localStorage.getItem('minimal_active_board_id') || null;
    },
    saveActiveBoardId(id) {
        if (id) {
            localStorage.setItem('minimal_active_board_id', id);
        } else {
            localStorage.removeItem('minimal_active_board_id');
        }
    },
    getTagOptions(boardId = null) {
        const targetBoardId = boardId || this.getActiveBoardId() || 'default';
        const defaultOptions = ['В процесі', 'Зроблено', 'Виконати пізніше'];
        
        const allBoardsTags = JSON.parse(localStorage.getItem('minimal_board_tag_options')) || {};
        if (allBoardsTags[targetBoardId]) {
            return allBoardsTags[targetBoardId];
        }

        // Міграція зі старого глобального сховища (якщо є) для першої активної дошки
        const legacyOptions = JSON.parse(localStorage.getItem('nothing_tag_options'));
        if (legacyOptions && Array.isArray(legacyOptions)) {
            allBoardsTags[targetBoardId] = legacyOptions;
            localStorage.setItem('minimal_board_tag_options', JSON.stringify(allBoardsTags));
            localStorage.removeItem('nothing_tag_options');
            return legacyOptions;
        }

        return defaultOptions;
    },
    saveTagOptions(options, boardId = null) {
        const targetBoardId = boardId || this.getActiveBoardId() || 'default';
        const allBoardsTags = JSON.parse(localStorage.getItem('minimal_board_tag_options')) || {};
        allBoardsTags[targetBoardId] = options;
        localStorage.setItem('minimal_board_tag_options', JSON.stringify(allBoardsTags));
        if (window.App && window.App.cloudSync && window.App.cloudSync.syncTagOptions) {
            window.App.cloudSync.syncTagOptions();
        }
    },
    getColumnLayouts() {
        return JSON.parse(localStorage.getItem('minimal_column_layouts')) || {};
    },
    saveColumnLayouts(layouts) {
        localStorage.setItem('minimal_column_layouts', JSON.stringify(layouts));
    },
    getGraphViewMode() {
        return localStorage.getItem('minimal_graph_view_mode') === 'true';
    },
    saveGraphViewMode(enabled) {
        localStorage.setItem('minimal_graph_view_mode', enabled ? 'true' : 'false');
    },
    getReadOnlyBoards() {
        return JSON.parse(localStorage.getItem('minimal_readonly_boards')) || [];
    },
    saveReadOnlyBoards(boards) {
        localStorage.setItem('minimal_readonly_boards', JSON.stringify(boards));
    },
    getReadOnlyNotes() {
        return JSON.parse(localStorage.getItem('minimal_readonly_notes')) || [];
    },
    saveReadOnlyNotes(notes) {
        localStorage.setItem('minimal_readonly_notes', JSON.stringify(notes));
    },
    getHiddenSharedNoteIds() {
        return JSON.parse(localStorage.getItem('minimal_hidden_shared_note_ids')) || [];
    },
    saveHiddenSharedNoteIds(ids) {
        localStorage.setItem('minimal_hidden_shared_note_ids', JSON.stringify(ids));
    },
    clearAll() {
        clearTimeout(this._notesSaveTimer);
        this._notesSaveTimer = null;
        this._pendingNotes = null;
        localStorage.removeItem('minimal_boards');
        localStorage.removeItem('minimal_notes');
        localStorage.removeItem('minimal_readonly_boards');
        localStorage.removeItem('minimal_readonly_notes');
        localStorage.removeItem('minimal_hidden_shared_note_ids');
        localStorage.removeItem('minimal_active_board_id');
        localStorage.removeItem('minimal_board_tag_options');
        localStorage.removeItem('minimal_column_layouts');
        localStorage.removeItem('minimal_graph_view_mode');
        localStorage.removeItem('minimal_offline_sync_queue');
        localStorage.removeItem('minimal_locally_deleted_ids');
    }
};

(function() {
    const rawState = {
        boards: window.App.storage.getBoards(),
        readOnlyBoards: window.App.storage.getReadOnlyBoards(),
        notes: window.App.storage.getNotes(),
        readOnlyNotes: window.App.storage.getReadOnlyNotes(),
        activeBoardId: window.App.storage.getActiveBoardId(),
        activeChain: [null], // Масив ID батьківських нотаток [null, noteId1, noteId2...]
        activeNoteId: null, // ID поточної активної/сфокусованої нотатки для візуальної синхронізації з сайдбаром
        expandedSidebarNoteIds: new Set(), // ID розгорнутих нотаток у сайдбарі
        selectedSidebarNoteIds: new Set(), // ID виділених нотаток у сайдбарі (Windows-style selection)
        selectedWorkspaceNoteIds: new Set(), // ID вибраних нотаток на головній області (iOS Gallery style)
        isWorkspaceSelectMode: false, // Режим мульти-вибору на головній області
        isGraphView: window.App.storage.getGraphViewMode(), // Режим перегляду інтерактивного графа (Obsidian Style)
        isDraggingNote: false, // Прапорець активного перетягування нотатки (блокує фонові перерендери)
        draggedNoteId: null, // ID поточної нотатки, що перетягується
        activeTagFilters: new Map(), // Карта фільтрів тегів для колонок: key: parentId || 'root' -> Set<tagText>
        columnLayouts: window.App.storage.getColumnLayouts(), // key: parentId || 'root' -> 'list' | 'grid'
        stretchedColumnKey: null // parentKey ('root' або noteId) колонки, розтягнутої на весь екран у ПК версії
    };

    // Proxy для безпечного доступу та автоматичної синхронізації при прямих мутаціях state.prop = val
    const stateProxy = new Proxy(rawState, {
        get(target, prop, receiver) {
            return Reflect.get(target, prop, receiver);
        },
        set(target, prop, value, receiver) {
            const oldValue = target[prop];
            const result = Reflect.set(target, prop, value, receiver);

            if (oldValue !== value) {
                const storage = window.App.storage;
                if (storage) {
                    switch (prop) {
                        case 'boards':
                            storage.saveBoards(value);
                            break;
                        case 'readOnlyBoards':
                            storage.saveReadOnlyBoards(value);
                            break;
                        case 'notes':
                            storage.saveNotes(value);
                            break;
                        case 'readOnlyNotes':
                            storage.saveReadOnlyNotes(value);
                            break;
                        case 'activeBoardId':
                            storage.saveActiveBoardId(value);
                            break;
                        case 'isGraphView':
                            storage.saveGraphViewMode(value);
                            break;
                        case 'columnLayouts':
                            storage.saveColumnLayouts(value);
                            break;
                    }
                }

                if (window.App.events) {
                    window.App.events.emit(`state:${String(prop)}`, { value, oldValue });
                    window.App.events.emit('state:mutation', { prop: String(prop), value, oldValue });
                }
            }

            return result;
        }
    });

    // Централізоване сховище (Store) з контрольованими методами мутацій
    const store = {
        getState() {
            return stateProxy;
        },

        getRawState() {
            return rawState;
        },

        getBoardById(id) {
            if (!id) return null;
            return rawState.boards.find(b => b.id === id)
                || (rawState.readOnlyBoards && rawState.readOnlyBoards.find(b => b.id === id))
                || null;
        },

        getActiveBoard() {
            return this.getBoardById(rawState.activeBoardId);
        },

        getNoteById(id) {
            if (!id) return null;
            return rawState.notes.find(n => n.id === id)
                || (rawState.readOnlyNotes && rawState.readOnlyNotes.find(n => n.id === id))
                || null;
        },

        setBoards(boards, persist = true) {
            rawState.boards = Array.isArray(boards) ? boards : [];
            if (persist && window.App.storage) {
                window.App.storage.saveBoards(rawState.boards);
            }
            this._notify('boards', rawState.boards);
        },

        setReadOnlyBoards(boards, persist = true) {
            rawState.readOnlyBoards = Array.isArray(boards) ? boards : [];
            if (persist && window.App.storage) {
                window.App.storage.saveReadOnlyBoards(rawState.readOnlyBoards);
            }
            this._notify('readOnlyBoards', rawState.readOnlyBoards);
        },

        setNotes(notes, persist = true, immediate = false) {
            rawState.notes = Array.isArray(notes) ? notes : [];
            if (persist && window.App.storage) {
                window.App.storage.saveNotes(rawState.notes, immediate);
            }
            this._notify('notes', rawState.notes);
        },

        setReadOnlyNotes(notes, persist = true) {
            rawState.readOnlyNotes = Array.isArray(notes) ? notes : [];
            if (persist && window.App.storage) {
                window.App.storage.saveReadOnlyNotes(rawState.readOnlyNotes);
            }
            this._notify('readOnlyNotes', rawState.readOnlyNotes);
        },

        setActiveBoardId(id, persist = true) {
            rawState.activeBoardId = id;
            if (persist && window.App.storage) {
                window.App.storage.saveActiveBoardId(id);
            }
            this._notify('activeBoardId', id);
        },

        setActiveChain(chain) {
            rawState.activeChain = Array.isArray(chain) ? chain : [null];
            this._notify('activeChain', rawState.activeChain);
        },

        setGraphView(enabled, persist = true) {
            const val = Boolean(enabled);
            rawState.isGraphView = val;
            if (persist && window.App.storage) {
                window.App.storage.saveGraphViewMode(val);
            }
            this._notify('isGraphView', val);
        },

        setColumnLayout(parentKey, layout, persist = true) {
            rawState.columnLayouts = rawState.columnLayouts || {};
            rawState.columnLayouts[parentKey] = layout;
            if (persist && window.App.storage) {
                window.App.storage.saveColumnLayouts(rawState.columnLayouts);
            }
            this._notify('columnLayouts', rawState.columnLayouts);
        },

        setColumnLayouts(layouts, persist = true) {
            rawState.columnLayouts = layouts || {};
            if (persist && window.App.storage) {
                window.App.storage.saveColumnLayouts(rawState.columnLayouts);
            }
            this._notify('columnLayouts', rawState.columnLayouts);
        },

        setWorkspaceSelectMode(enabled) {
            rawState.isWorkspaceSelectMode = Boolean(enabled);
            if (!rawState.isWorkspaceSelectMode) {
                rawState.selectedWorkspaceNoteIds.clear();
            }
            this._notify('isWorkspaceSelectMode', rawState.isWorkspaceSelectMode);
        },

        clearSelections() {
            rawState.selectedSidebarNoteIds.clear();
            rawState.selectedWorkspaceNoteIds.clear();
            rawState.isWorkspaceSelectMode = false;
            this._notify('selection:cleared', null);
        },

        setDraggingNote(isDragging, noteId = null) {
            rawState.isDraggingNote = Boolean(isDragging);
            rawState.draggedNoteId = isDragging ? noteId : null;
            this._notify('isDraggingNote', rawState.isDraggingNote);
        },

        setStretchedColumn(key) {
            rawState.stretchedColumnKey = key;
            this._notify('stretchedColumnKey', key);
        },

        resetEphemeral() {
            rawState.activeChain = [null];
            rawState.activeNoteId = null;
            rawState.expandedSidebarNoteIds.clear();
            rawState.selectedSidebarNoteIds.clear();
            rawState.selectedWorkspaceNoteIds.clear();
            rawState.isWorkspaceSelectMode = false;
            rawState.isDraggingNote = false;
            rawState.draggedNoteId = null;
            rawState.activeTagFilters.clear();
            rawState.stretchedColumnKey = null;
            this._notify('state:reset', null);
        },

        clearAll() {
            this.setBoards([], false);
            this.setReadOnlyBoards([], false);
            this.setNotes([], false);
            this.setReadOnlyNotes([], false);
            this.setActiveBoardId(null, false);
            this.resetEphemeral();
            if (window.App.storage) {
                window.App.storage.clearAll();
            }
        },

        subscribe(propOrEvent, handler) {
            if (!window.App.events) return () => {};
            const eventName = propOrEvent.includes(':') ? propOrEvent : `state:${propOrEvent}`;
            return window.App.events.on(eventName, handler);
        },

        _notify(eventOrProp, value) {
            if (window.App.events) {
                window.App.events.emit(`state:${eventOrProp}`, { value });
                window.App.events.emit('state:changed', { prop: eventOrProp, value });
            }
        }
    };

    window.App.store = store;
    window.App.state = stateProxy;
})();

// Гарантуємо запис незбережених змін перед закриттям вкладки або браузера
window.addEventListener('beforeunload', () => {
    if (window.App.storage) {
        window.App.storage.flushNotes();
    }
});
