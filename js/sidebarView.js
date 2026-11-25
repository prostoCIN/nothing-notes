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

            if (window.App.sidebarResizer && window.App.sidebarResizer.init) {
                window.App.sidebarResizer.init();
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

            // Кнопка входу та налаштувань у сайдбарі
            if (els.sidebarLoginBtn) {
                els.sidebarLoginBtn.addEventListener('click', () => {
                    if (window.App.authModal) {
                        window.App.authModal.open();
                    }
                });
            }

            if (els.sidebarSettingsBtn) {
                els.sidebarSettingsBtn.addEventListener('click', () => {
                    if (window.App.settingsModal) {
                        window.App.settingsModal.open();
                    }
                });
            }

            // Жести свайпу для мобільного сайдбару (відкриття з крайньої лівої колонки та закриття свайпом назад)
            this.bindMobileSwipeGestures();
        },

        bindMobileSwipeGestures() {
            let startX = 0;
            let startY = 0;
            let startTime = 0;
            let isTracking = false;
            let canOpenDrawer = false;
            let canCloseDrawer = false;

            const onTouchStart = (e) => {
                if (window.innerWidth > 768) return;
                if (!e.touches || e.touches.length !== 1) return;

                const touch = e.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;
                startTime = Date.now();

                // Якщо жест почався всередині самого сайдбару — НЕ перехоплюємо його!
                // Це повністю усуває конфлікт зі свайпами плашок (викликом кнопок редагування/видалення) та скролом списку
                if (e.target.closest('#sidebar, .sidebar')) {
                    isTracking = false;
                    return;
                }

                // Ігноруємо якщо користувач взаємодіє з інтерактивними полями введення або модалками
                if (e.target.closest('input, textarea, [contenteditable="true"], .polaroid-lightbox-viewport, .modal-overlay, #settings-modal-overlay, .color-picker-popover')) {
                    isTracking = false;
                    return;
                }

                // Ігноруємо якщо йде перетягування картки нотатки
                if (document.body.classList.contains('is-sticker-dragging') || (window.App.state && window.App.state.isDraggingNote)) {
                    isTracking = false;
                    return;
                }

                const isSidebarOpen = document.body.classList.contains('mobile-sidebar-active');

                if (isSidebarOpen) {
                    // Якщо сайдбар відкритий — дозволяємо свайп вліво по оверлею для його закриття
                    if (e.target.closest('#sidebar-overlay, .sidebar-overlay')) {
                        canOpenDrawer = false;
                        canCloseDrawer = true;
                        isTracking = true;
                    } else {
                        isTracking = false;
                    }
                } else {
                    // Якщо сайдбар закритий — перевіряємо, чи користувач у крайній першій колонці або біля лівого краю
                    canCloseDrawer = false;
                    const colsContainer = (window.App.getElements && window.App.getElements().columnsContainer) || document.getElementById('columns-container');
                    const isAtFirstColumn = !colsContainer || colsContainer.scrollLeft <= 15;
                    const isEdgeSwipe = startX <= 45;

                    if (isAtFirstColumn || isEdgeSwipe) {
                        canOpenDrawer = true;
                        isTracking = true;
                    } else {
                        canOpenDrawer = false;
                        isTracking = false;
                    }
                }
            };

            const onTouchEnd = (e) => {
                if (!isTracking) return;
                isTracking = false;

                const touch = (e.changedTouches && e.changedTouches[0]) || null;
                if (!touch) return;

                const deltaX = touch.clientX - startX;
                const deltaY = touch.clientY - startY;
                const elapsed = Date.now() - startTime;
                const absX = Math.abs(deltaX);
                const absY = Math.abs(deltaY);

                // Перевіряємо горизонтальну спрямованість жесту
                const isHorizontal = absX > absY * 1.25;

                if (canOpenDrawer && deltaX > 0 && isHorizontal) {
                    // Свайп праворуч з першої колонки: достатня відстань (45px) або швидкий рух (30px за < 320мс)
                    const isDragDistance = deltaX >= 45;
                    const isQuickFlick = deltaX >= 30 && elapsed < 320;

                    if (isDragDistance || isQuickFlick) {
                        this.openMobileSidebar();
                    }
                } else if (canCloseDrawer && deltaX < 0 && isHorizontal) {
                    // Свайп ліворуч на відкритому меню для закриття
                    const isDragDistance = absX >= 45;
                    const isQuickFlick = absX >= 30 && elapsed < 320;

                    if (isDragDistance || isQuickFlick) {
                        this.closeMobileSidebar();
                    }
                }

                canOpenDrawer = false;
                canCloseDrawer = false;
            };

            window.addEventListener('touchstart', onTouchStart, { passive: true });
            window.addEventListener('touchend', onTouchEnd, { passive: true });
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
                if (iconSpan) {
                    if (window.App.setEmojiContent) {
                        window.App.setEmojiContent(iconSpan, icon, '📄', 16);
                    } else {
                        iconSpan.textContent = icon || '📄';
                    }
                }
            }
        },

        updateBoardTitle(id, name) {
            document.querySelectorAll(`.board-item[data-board-id="${id}"] .board-item-text`).forEach(el => {
                el.textContent = name;
            });
        },

        /**
         * Встановлює активну нотатку у сайдбарі, розгортає її гілку та скролить до неї
         * @param {string|null} noteId - ID активної нотатки
         * @param {Object} [options] - { autoExpand: true, scrollIntoView: true }
         */
        setActiveNote(noteId, options = {}) {
            const state = window.App.state;
            const noteManager = window.App.noteManager;
            const els = window.App.getElements();
            if (!state) return;

            const autoExpand = options.autoExpand !== false;
            const shouldScroll = options.scrollIntoView !== false;

            state.activeNoteId = noteId;

            // Синхронізуємо виділення у сайдбарі: скидаємо всі інші виділення і залишаємо тільки активну нотатку
            if (state.selectedSidebarNoteIds) {
                state.selectedSidebarNoteIds.clear();
                if (noteId) {
                    state.selectedSidebarNoteIds.add(noteId);
                }
            }

            let needsReRender = false;

            if (noteId && autoExpand && noteManager) {
                const note = noteManager.getNoteById(noteId);
                if (note) {
                    let parentId = note.parentId;
                    while (parentId) {
                        if (!state.expandedSidebarNoteIds.has(parentId)) {
                            state.expandedSidebarNoteIds.add(parentId);
                            needsReRender = true;
                        }
                        const pNote = noteManager.getNoteById(parentId);
                        parentId = pNote ? pNote.parentId : null;
                    }
                }
            }

            if (needsReRender) {
                this.renderNotesList();
            } else if (els && els.notesList) {
                // Швидке оновлення класів: скидаємо будь-які виділення для ВСІХ інших нотаток у лівій панелі
                els.notesList.querySelectorAll('.note-item.is-active-note, .note-item.is-selected, .note-item.active').forEach(el => {
                    if (el.dataset.id !== noteId) {
                        el.classList.remove('is-active-note', 'is-selected', 'active');
                    }
                });
                if (noteId) {
                    const activeRow = els.notesList.querySelector(`.note-item[data-id="${noteId}"]`);
                    if (activeRow) {
                        activeRow.classList.add('is-active-note');
                        activeRow.classList.remove('is-selected');
                    }
                }
            }

            // Плавне докручування сайдбару до сфокусованої нотатки
            if (noteId && shouldScroll && els && els.notesList) {
                setTimeout(() => {
                    const activeRow = els.notesList.querySelector(`.note-item[data-id="${noteId}"]`);
                    if (activeRow) {
                        activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }, needsReRender ? 60 : 0);
            }
        },

        /**
         * Розгортає дерево сайдбару для ланцюжка відкритих колонок
         * @param {Array<string|null>} chain - Масив ID батьківських нотаток
         */
        expandChain(chain) {
            const state = window.App.state;
            const noteManager = window.App.noteManager;
            if (!state || !Array.isArray(chain)) return;

            let hasNewExpands = false;
            chain.forEach(noteId => {
                if (!noteId) return;
                let currId = noteId;
                while (currId) {
                    if (!state.expandedSidebarNoteIds.has(currId)) {
                        state.expandedSidebarNoteIds.add(currId);
                        hasNewExpands = true;
                    }
                    if (noteManager) {
                        const n = noteManager.getNoteById(currId);
                        currId = n ? n.parentId : null;
                    } else {
                        break;
                    }
                }
            });

            if (hasNewExpands) {
                this.renderNotesList();
            }
        }
    };
})();

export const sidebarView = window.App?.sidebarView;
