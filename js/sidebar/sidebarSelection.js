// js/sidebar/sidebarSelection.js - Модуль рамки виділення мишкою (Marquee Selection) та гарячих клавіш для блокнотів і нотаток
window.App = window.App || {};

(function() {
    function setupMarquee({
        container,
        itemSelector,
        idDataAttr,
        ignoreSelector,
        getSelectedSet,
        onSelectionChange,
        onClearSelection
    }) {
        if (!container) return;

        let marqueeEl = null;
        let startX = 0;
        let startY = 0;
        let isMarquee = false;

        container.addEventListener('pointerdown', (e) => {
            if (window.innerWidth <= 768 || e.pointerType === 'touch') return;
            if (e.button !== 0) return;
            if (e.target.closest(ignoreSelector)) return;

            e.preventDefault();
            document.body.style.userSelect = 'none';

            const sidebarEl = document.querySelector('.sidebar');
            const sidebarRect = sidebarEl ? sidebarEl.getBoundingClientRect() : null;

            startX = e.clientX;
            startY = e.clientY;
            isMarquee = false;

            const selectedSet = getSelectedSet();
            const initialSelection = (e.ctrlKey || e.metaKey) ? new Set(selectedSet) : new Set();

            const onMarqueeMove = (moveEvent) => {
                moveEvent.preventDefault();
                let currentX = moveEvent.clientX;
                let currentY = moveEvent.clientY;

                if (sidebarRect) {
                    currentX = Math.max(sidebarRect.left, Math.min(sidebarRect.right, currentX));
                    currentY = Math.max(sidebarRect.top, Math.min(sidebarRect.bottom, currentY));
                }

                const width = Math.abs(currentX - startX);
                const height = Math.abs(currentY - startY);

                if (!isMarquee && (width > 4 || height > 4)) {
                    isMarquee = true;
                    marqueeEl = document.createElement('div');
                    marqueeEl.className = 'sidebar-marquee-selection';
                    document.body.appendChild(marqueeEl);
                }

                if (isMarquee && marqueeEl) {
                    const left = Math.min(startX, currentX);
                    const top = Math.min(startY, currentY);

                    marqueeEl.style.left = `${left}px`;
                    marqueeEl.style.top = `${top}px`;
                    marqueeEl.style.width = `${width}px`;
                    marqueeEl.style.height = `${height}px`;

                    const marqueeRect = { left, top, right: left + width, bottom: top + height };
                    const allItemRows = document.querySelectorAll(itemSelector);

                    allItemRows.forEach(row => {
                        const itemId = row.dataset[idDataAttr];
                        if (!itemId) return;
                        const rowRect = row.getBoundingClientRect();
                        const isIntersecting = !(
                            rowRect.right < marqueeRect.left ||
                            rowRect.left > marqueeRect.right ||
                            rowRect.bottom < marqueeRect.top ||
                            rowRect.top > marqueeRect.bottom
                        );

                        if (isIntersecting) {
                            selectedSet.add(itemId);
                        } else if (!initialSelection.has(itemId)) {
                            selectedSet.delete(itemId);
                        }
                    });

                    if (onSelectionChange) onSelectionChange(allItemRows, selectedSet);
                }
            };

            const onMarqueeUp = () => {
                window.removeEventListener('pointermove', onMarqueeMove);
                window.removeEventListener('pointerup', onMarqueeUp);
                window.removeEventListener('pointercancel', onMarqueeUp);
                document.body.style.userSelect = '';
                window.getSelection()?.removeAllRanges();

                if (marqueeEl) {
                    marqueeEl.remove();
                    marqueeEl = null;
                }

                if (!isMarquee && !e.ctrlKey && !e.metaKey) {
                    if (onClearSelection) onClearSelection();
                }
            };

            window.addEventListener('pointermove', onMarqueeMove);
            window.addEventListener('pointerup', onMarqueeUp);
            window.addEventListener('pointercancel', onMarqueeUp);
        });
    }

    window.App.sidebarSelection = {
        init() {
            const els = window.App.getElements();
            const state = window.App.state;
            state.selectedSidebarBoardIds = state.selectedSidebarBoardIds || new Set();

            // 1. Рамка виділення для нотаток у лівій панелі (звичайні та спільні)
            if (els.notesList) {
                setupMarquee({
                    container: els.notesList,
                    itemSelector: '.sidebar .note-item[data-id]',
                    idDataAttr: 'id',
                    ignoreSelector: '.note-item, .delete-btn, .note-toggle-arrow, .sidebar-action-btn, .sidebar-nest-drop-zone',
                    getSelectedSet: () => state.selectedSidebarNoteIds,
                    onSelectionChange: (rows, set) => {
                        rows.forEach(r => r.classList.toggle('is-selected', set.has(r.dataset.id)));
                    },
                    onClearSelection: () => {
                        state.selectedSidebarNoteIds.clear();
                        state.activeNoteId = null;
                        document.querySelectorAll('.sidebar .note-item').forEach(el => el.classList.remove('is-selected', 'is-active-note', 'active'));
                    }
                });
            }

            // 2. Рамка виділення для блокнотів (звичайні та спільні для читання)
            const boardsSection = document.querySelector('.sidebar-section.boards-section');
            const sharedSection = document.getElementById('shared-boards-section');

            const boardMarqueeConfig = {
                itemSelector: '#sidebar-boards-list .board-item, #sidebar-shared-boards-list .board-item',
                idDataAttr: 'boardId',
                ignoreSelector: '.board-item, .board-actions, .sidebar-action-btn, .delete-btn, .board-delete-btn, .board-clone-btn, .board-drag-handle, .header-add-btn, input',
                getSelectedSet: () => state.selectedSidebarBoardIds,
                onSelectionChange: (rows, set) => {
                    rows.forEach(r => r.classList.toggle('is-selected', set.has(r.dataset.boardId)));
                },
                onClearSelection: () => {
                    state.selectedSidebarBoardIds.clear();
                    document.querySelectorAll('#sidebar-boards-list .board-item, #sidebar-shared-boards-list .board-item').forEach(el => el.classList.remove('is-selected'));
                }
            };

            if (boardsSection) {
                setupMarquee({ container: boardsSection, ...boardMarqueeConfig });
            }
            if (sharedSection) {
                setupMarquee({ container: sharedSection, ...boardMarqueeConfig });
            }

            // 3. Гаряча клавіша Delete / Backspace для видалення виділених блокнотів або нотаток
            window.addEventListener('keydown', (e) => {
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    const activeEl = document.activeElement;
                    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
                    if (isTyping) return;

                    const modalEl = document.getElementById('confirm-modal-overlay');
                    if (modalEl && modalEl.style.display !== 'none' && !modalEl.classList.contains('hidden')) return;

                    // Пріоритет 1: Виділені блокноти
                    if (state.selectedSidebarBoardIds && state.selectedSidebarBoardIds.size > 0) {
                        e.preventDefault();
                        if (window.App.boardManager && window.App.boardManager.deleteBoards) {
                            window.App.boardManager.deleteBoards(Array.from(state.selectedSidebarBoardIds), e);
                        }
                        return;
                    }

                    // Пріоритет 2: Виділені нотатки
                    if (state.selectedSidebarNoteIds && state.selectedSidebarNoteIds.size > 0) {
                        e.preventDefault();
                        const firstSelectedId = Array.from(state.selectedSidebarNoteIds)[0];
                        if (window.App.noteManager && window.App.noteManager.deleteNote) {
                            window.App.noteManager.deleteNote(firstSelectedId, e);
                        }
                    }
                }
            });
        }
    };
})();
