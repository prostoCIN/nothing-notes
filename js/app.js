// js/app.js - Головна точка входу (ініціалізація та зв''язування компонентів)
window.App = window.App || {};

function bootstrapApp() {
    const welcomeView = window.App.welcomeView;
    const boardManager = window.App.boardManager;
    const noteManager = window.App.noteManager;
    const sidebarView = window.App.sidebarView;
    const workspaceView = window.App.workspaceView;

    // Ініціалізація компонентів та передача зворотних викликів (callbacks)
    welcomeView.init();

    if (window.App.historyManager) {
        window.App.historyManager.init();
    }

    // Підписка на події через центральний EventBus
    if (window.App.events) {
        window.App.events.on('notes:changed', () => {
            sidebarView.renderNotesList();
            workspaceView.render();
        });

        window.App.events.on('board:changed', () => {
            if (window.App.historyManager) {
                window.App.historyManager.updateButtonsState();
            }
            if (window.App.state) {
                window.App.state.stretchedColumnKey = null;
            }
            welcomeView.hide();
            sidebarView.render();
            workspaceView.render();
        });

        window.App.events.on('welcome:needed', () => {
            welcomeView.show();
        });

        window.App.events.on('board:switched', () => {
            if (window.App.historyManager) {
                window.App.historyManager.updateButtonsState();
            }
            if (window.App.state) {
                window.App.state.activeNoteId = null;
            }
            welcomeView.hide();
            sidebarView.render();
            workspaceView.render();
        });

        window.App.events.on('board:renamed', ({ boardId, name }) => {
            if (sidebarView && sidebarView.updateBoardTitle) {
                sidebarView.updateBoardTitle(boardId, name);
            }
            if (workspaceView && workspaceView.updateBoardTitle) {
                workspaceView.updateBoardTitle(boardId, name);
            }
        });

        window.App.events.on('board:icon_updated', () => {
            if (sidebarView && sidebarView.renderBoardsList) {
                sidebarView.renderBoardsList();
            }
            if (workspaceView && workspaceView.render) {
                workspaceView.render();
            }
        });

        window.App.events.on('note:created', ({ note, shouldFocus }) => {
            if (window.App.sidebarView) {
                window.App.sidebarView.setActiveNote(note.id, { autoExpand: true, scrollIntoView: true });
            }
            if (shouldFocus && workspaceView && workspaceView.focusNote) {
                workspaceView.focusNote(note.id);
            }
        });

        window.App.events.on('note:duplicated', ({ note }) => {
            if (workspaceView && workspaceView.highlightNote) {
                workspaceView.highlightNote(note.id);
            }
        });

        window.App.events.on('note:updated', ({ id, note, updates }) => {
            if (updates && updates.title !== undefined) {
                if (workspaceView && workspaceView.updateNoteTitle) {
                    workspaceView.updateNoteTitle(id, updates.title);
                }
                if (sidebarView && sidebarView.updateNoteListItem) {
                    sidebarView.updateNoteListItem(id, updates.title, note.icon);
                }
            }
        });

        window.App.events.on('notes:deleted', () => {
            if (window.App.workspaceSelectionBar && window.App.workspaceSelectionBar.exitSelectMode) {
                window.App.workspaceSelectionBar.exitSelectMode();
            }
        });
    }

    boardManager.init();
    noteManager.init();

    sidebarView.init({
        onSelectNote: (noteId) => {
            workspaceView.scrollToNote(noteId);
            if (window.innerWidth <= 768 && window.App.sidebarView.closeMobileSidebar) {
                window.App.sidebarView.closeMobileSidebar();
            }
        }
    });

    workspaceView.init();
    if (window.App.workspaceSelectionBar) {
        window.App.workspaceSelectionBar.init();
    }
    if (window.App.textSelectionToolbar) {
        window.App.textSelectionToolbar.init();
    }
    if (window.App.brushTool) {
        window.App.brushTool.init();
    }
    if (window.App.eraserTool) {
        window.App.eraserTool.init();
    }
    if (window.App.workspaceSearch) {
        window.App.workspaceSearch.init();
    }

    if (window.App.authModal) {
        window.App.authModal.init();
    }
    if (window.App.settingsModal) {
        window.App.settingsModal.init();
    }
    if (window.App.cloudSync) {
        window.App.cloudSync.init();
    }

    // Делегована глобальна обробка кліків по кнопках входу та налаштувань (гарантія роботи за будь-якого стану DOM)
    document.addEventListener('click', (e) => {
        const loginTrigger = e.target.closest('#sidebar-login-btn, #welcome-login-btn, #settings-login-btn, .sidebar-login-btn');
        if (loginTrigger) {
            e.preventDefault();
            if (window.App.settingsModal && window.App.settingsModal.close) {
                window.App.settingsModal.close();
            }
            if (window.App.authModal) {
                window.App.authModal.open();
            }
            return;
        }

        const settingsTrigger = e.target.closest('#sidebar-settings-btn, .sidebar-settings-guest-btn');
        if (settingsTrigger) {
            e.preventDefault();
            if (window.App.settingsModal) {
                window.App.settingsModal.open();
            }
            return;
        }
    });

    // Початкова перевірка стану
    initApp();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapApp);
} else {
    bootstrapApp();
}

function initApp() {
    const state = window.App.state;
    const storage = window.App.storage;
    const welcomeView = window.App.welcomeView;
    const sidebarView = window.App.sidebarView;
    const workspaceView = window.App.workspaceView;

    if (state.boards.length === 0) {
        welcomeView.show();
    } else {
        // Очищаємо нотатки від залишкових інлайн-стилів форматування тексту
        let hasChanges = false;
        state.notes.forEach(note => {
            if (note.content && (note.content.includes('style=') || note.content.includes('<font') || note.content.includes('<span'))) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = note.content;
                tempDiv.querySelectorAll('span, font').forEach(el => {
                    const parent = el.parentNode;
                    while (el.firstChild) {
                        parent.insertBefore(el.firstChild, el);
                    }
                    parent.removeChild(el);
                });
                const cleaned = tempDiv.innerHTML.replace(/<span[^>]*>/gi, '').replace(/<\/span>/gi, '');
                if (cleaned !== note.content) {
                    note.content = cleaned;
                    hasChanges = true;
                }
            }
        });

        if (hasChanges) {
            storage.saveNotes(state.notes);
        }

        // Перевіряємо чи активна дошка існує, якщо ні - беремо першу
        const activeExists = state.boards.some(b => b.id === state.activeBoardId) || (state.readOnlyBoards && state.readOnlyBoards.some(b => b.id === state.activeBoardId));
        if (!state.activeBoardId || !activeExists) {
            state.activeBoardId = state.boards[0].id;
            storage.saveActiveBoardId(state.activeBoardId);
        }
        welcomeView.hide();
        sidebarView.render();
        workspaceView.render();
    }

    // Перевіряємо, чи перейшов користувач за посиланням спільного доступу ?share_board=...
    handleShareUrlParams();
}

async function handleShareUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const shareToken = urlParams.get('share_board');
    if (!shareToken) return;

    const format = urlParams.get('format');
    const view = urlParams.get('view');
    const isAiRawMode = format === 'md' || format === 'raw' || view === 'raw' || view === 'md';

    if (!isAiRawMode) {
        // Очищаємо URL параметр, щоб не спамити модалкою при ручному оновленні F5
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
    }

    if (!window.App.shareManager) return;

    const subnotesParam = urlParams.get('subnotes');
    const includeSubnotes = subnotesParam !== '0';

    try {
        const info = await window.App.shareManager.fetchShareInfo(shareToken, includeSubnotes);
        if (!info || !info.board || !info.share) {
            window.App.confirmModal.show({
                title: 'Посилання недійсне',
                message: 'Це посилання на спільний блокнот застаріло або було вимкнено власником.',
                confirmText: 'Зрозуміло',
                type: 'danger',
                onConfirm: () => {}
            });
            return;
        }

        // Якщо це спеціальний режим перегляду для ШІ чи сирого тексту — показуємо чистий Markdown
        if (isAiRawMode) {
            window.App.shareManager.renderRawMarkdownView(info);
            return;
        }

        // Перевіряємо, чи користувач не є власником цього блокнота
        const state = window.App.state;
        const isOwnBoard = state.boards.some(b => b.id === info.share.board_id);
        const supabase = window.App.supabase;
        const { data: authData } = supabase ? await supabase.auth.getUser() : { data: {} };
        const isCurrentUserOwner = authData && authData.user && authData.user.id === info.share.owner_id;

        if (isOwnBoard || isCurrentUserOwner) {
            window.App.confirmModal.show({
                title: 'Ваш власний блокнот',
                message: `Ви є власником блокнота <span class="confirm-modal-highlight">"${info.board.name}"</span>. Він уже є у списку ваших блокнотів із повними правами редагування.`,
                confirmText: 'Перейти до блокнота',
                type: 'info',
                onConfirm: () => {
                    // Просто перемикаємо на власний блокнот
                    if (window.App.boardManager) {
                        window.App.boardManager.switchBoard(info.share.board_id);
                    }
                }
            });
            return;
        }

        const isSpecificNotes = Array.isArray(info.share.note_ids) && info.share.note_ids.length > 0;
        const ownerTitle = info.share.owner_email ? `<b>${info.share.owner_email}</b>` : 'інший користувач';
        const notesCountText = info.notes.length === 1 ? '1 нотаткою' : `${info.notes.length} нотатками`;

        const messageHtml = isSpecificNotes 
            ? `Користувач ${ownerTitle} поділився з вами ${notesCountText} із блокнота <span class="confirm-modal-highlight">"${info.board.name}"</span> у режимі читання.<br><br>Додати цей блокнот до списку ваших блокнотів для читання?`
            : `Користувач ${ownerTitle} поділився з вами блокнотом <span class="confirm-modal-highlight">"${info.board.name}"</span> (${info.notes.length} нотаток) у режимі читання.<br><br>Додати його до списку ваших блокнотів для читання?`;

        window.App.confirmModal.show({
            title: '📖 Спільний блокнот',
            message: messageHtml,
            confirmText: 'Додати для читання',
            type: 'info',
            onConfirm: () => {
                window.App.shareManager.addSharedBoardToState(info.board, info.notes);
            }
        });
    } catch (err) {
        console.error('[App] Error handling share param:', err);
    }
}
