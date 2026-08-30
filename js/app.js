// js/app.js - Головна точка входу (ініціалізація та зв''язування компонентів)
window.App = window.App || {};

document.addEventListener('DOMContentLoaded', () => {
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

    boardManager.init({
        onBoardChange: () => {
            if (window.App.historyManager) {
                window.App.historyManager.reset();
            }
            welcomeView.hide();
            sidebarView.render();
            workspaceView.render();
        },
        onWelcomeNeeded: () => {
            welcomeView.show();
        }
    });

    noteManager.init({
        onNotesChange: () => {
            sidebarView.renderNotesList();
            workspaceView.render();
        }
    });

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

    if (window.App.authModal) {
        window.App.authModal.init();
    }
    if (window.App.cloudSync) {
        window.App.cloudSync.init();
    }

    // Початкова перевірка стану
    initApp();
});

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
        if (!state.activeBoardId || !state.boards.find(b => b.id === state.activeBoardId)) {
            state.activeBoardId = state.boards[0].id;
            storage.saveActiveBoardId(state.activeBoardId);
        }
        welcomeView.hide();
        sidebarView.render();
        workspaceView.render();
    }
}
