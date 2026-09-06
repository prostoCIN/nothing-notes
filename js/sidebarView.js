// js/sidebarView.js - Головний контролер бічної панелі (блокноти та дерево нотаток)
window.App = window.App || {};

(function() {
    let onSelectNoteCallback = null;

    window.App.sidebarView = {
        init(callbacks = {}) {
            onSelectNoteCallback = callbacks.onSelectNote || null;
            this.bindEvents();

            if (window.App.sidebarBoards && window.App.sidebarBoards.bindNewBoardForm) {
                window.App.sidebarBoards.bindNewBoardForm();
            }

            if (window.App.sidebarSelection) {
                window.App.sidebarSelection.init();
            }
        },

        bindEvents() {
            const els = window.App.getElements();
            if (!els) return;

            // Відкриття та закриття мобільного сайдбару
            if (els.mobileMenuBtn) {
                els.mobileMenuBtn.addEventListener('click', () => this.openMobileSidebar());
            }
            if (els.sidebarCloseBtn) {
                els.sidebarCloseBtn.addEventListener('click', () => this.closeMobileSidebar());
            }
            if (els.sidebarOverlay) {
                els.sidebarOverlay.addEventListener('click', () => this.closeMobileSidebar());
            }

            // Додавання нотатки з сайдбару
            if (els.addNoteBtn) {
                els.addNoteBtn.addEventListener('click', () => {
                    if (window.App.noteManager) {
                        window.App.noteManager.createNewNote(null, true);
                    }
                    if (window.innerWidth <= 768) {
                        this.closeMobileSidebar();
                    }
                });
            }
        },

        openMobileSidebar() {
            const els = window.App.getElements();
            if (els.sidebar) els.sidebar.classList.add('mobile-open');
            if (els.sidebarOverlay) els.sidebarOverlay.classList.add('active');
            document.body.classList.add('mobile-sidebar-active');
        },

        closeMobileSidebar() {
            const els = window.App.getElements();
            if (els.sidebar) els.sidebar.classList.remove('mobile-open');
            if (els.sidebarOverlay) els.sidebarOverlay.classList.remove('active');
            document.body.classList.remove('mobile-sidebar-active');
        },

        render() {
            this.renderBoardsList();
            this.renderNotesList();
        },

        renderBoardsList() {
            if (window.App.sidebarBoards && window.App.sidebarBoards.renderBoardsList) {
                window.App.sidebarBoards.renderBoardsList();
            }
        },

        renderSharedBoardsList() {
            if (window.App.sidebarBoards && window.App.sidebarBoards.renderSharedBoardsList) {
                window.App.sidebarBoards.renderSharedBoardsList();
            }
        },

        renderNotesList() {
            const els = window.App.getElements();
            if (!els || !els.notesList) return;

            // Зберігаємо позиції елементів перед перерендером для плавної FLIP-анімації
            const prevRects = new Map();
            els.notesList.querySelectorAll('.note-item[data-id]').forEach(item => {
                prevRects.set(item.dataset.id, item.getBoundingClientRect());
            });

            els.notesList.innerHTML = '';

            // Викликаємо рендеринг дерева нотаток з модуля sidebarTree
            if (window.App.sidebarTree) {
                window.App.sidebarTree.renderLevel(null, els.notesList, 0, onSelectNoteCallback);
            }

            // Плавна анімація FLIP ковзання нотаток після перерендеру
            if (prevRects.size > 0) {
                els.notesList.querySelectorAll('.note-item[data-id]').forEach(item => {
                    const oldRect = prevRects.get(item.dataset.id);
                    if (!oldRect) return;
                    const newRect = item.getBoundingClientRect();
                    const dy = oldRect.top - newRect.top;

                    if (dy !== 0) {
                        item.style.transition = 'none';
                        item.style.transform = `translateY(${dy}px)`;
                        requestAnimationFrame(() => {
                            item.style.transition = 'transform 0.22s cubic-bezier(0.2, 0, 0, 1)';
                            item.style.transform = '';
                        });
                    }
                });
            }
        },

        updateNoteListItem(id, title, icon) {
            const row = document.querySelector(`.note-item[data-id="${id}"]`);
            if (row) {
                const titleSpan = row.querySelector('.note-item-title');
                if (titleSpan) titleSpan.textContent = title || 'Без назви';
                const iconSpan = row.querySelector('.note-item-icon');
                if (iconSpan) iconSpan.textContent = icon || '📄';
            }
        }
    };
})();
