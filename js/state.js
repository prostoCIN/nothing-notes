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
    clearAll() {
        clearTimeout(this._notesSaveTimer);
        this._notesSaveTimer = null;
        this._pendingNotes = null;
        localStorage.removeItem('minimal_boards');
        localStorage.removeItem('minimal_notes');
        localStorage.removeItem('minimal_active_board_id');
        localStorage.removeItem('minimal_board_tag_options');
        localStorage.removeItem('minimal_column_layouts');
        localStorage.removeItem('minimal_graph_view_mode');
    }
};

window.App.state = {
    boards: window.App.storage.getBoards(),
    notes: window.App.storage.getNotes(),
    activeBoardId: window.App.storage.getActiveBoardId(),
    activeChain: [null], // Масив ID батьківських нотаток [null, noteId1, noteId2...]
    expandedSidebarNoteIds: new Set(), // ID розгорнутих нотаток у сайдбарі
    selectedSidebarNoteIds: new Set(), // ID виділених нотаток у сайдбарі (Windows-style selection)
    selectedWorkspaceNoteIds: new Set(), // ID вибраних нотаток на головній області (iOS Gallery style)
    isWorkspaceSelectMode: false, // Режим мульти-вибору на головній області
    isGraphView: window.App.storage.getGraphViewMode(), // Режим перегляду інтерактивного графа (Obsidian Style)
    activeTagFilters: new Map(), // Карта фільтрів тегів для колонок: key: parentId || 'root' -> Set<tagText>
    columnLayouts: window.App.storage.getColumnLayouts() // key: parentId || 'root' -> 'list' | 'grid'
};

// Гарантуємо запис незбережених змін перед закриттям вкладки або браузера
window.addEventListener('beforeunload', () => {
    if (window.App.storage) {
        window.App.storage.flushNotes();
    }
});
