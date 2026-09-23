// js/workspace/workspaceMarquee.js - Виділення нотаток рамкою курсором (Marquee Selection) у колонках робочої області
window.App = window.App || {};

(function() {
    let marqueeEl = null;
    let startX = 0;
    let startY = 0;
    let isMarquee = false;
    let wasInSelectMode = false;
    let initialSelection = new Set();
    let autoScrollRaf = null;
    let lastClientX = 0;
    let lastClientY = 0;

    function getTargetColumnNotesList(x, y) {
        const el = document.elementFromPoint(x, y);
        return el ? el.closest('.column-notes-list') : null;
    }

    function checkIntersection(marqueeRect) {
        const state = window.App.state;
        if (!state || !state.selectedWorkspaceNoteIds) return;

        const cards = document.querySelectorAll('.note-sticker[data-note-id]');
        cards.forEach(card => {
            const noteId = card.dataset.noteId;
            if (!noteId) return;

            const cardRect = card.getBoundingClientRect();
            const isIntersecting = !(
                cardRect.right < marqueeRect.left ||
                cardRect.left > marqueeRect.right ||
                cardRect.bottom < marqueeRect.top ||
                cardRect.top > marqueeRect.bottom
            );

            if (isIntersecting) {
                state.selectedWorkspaceNoteIds.add(noteId);
            } else if (!initialSelection.has(noteId)) {
                state.selectedWorkspaceNoteIds.delete(noteId);
            }
        });

        if (window.App.workspaceSelectionBar) {
            window.App.workspaceSelectionBar.updateUI();
        }
    }

    function handleAutoScroll() {
        if (!isMarquee) return;

        const columnsContainer = document.getElementById('columns-container');
        if (!columnsContainer) return;

        const containerRect = columnsContainer.getBoundingClientRect();
        const scrollZone = 50;
        const scrollSpeed = 10;

        // Горизонтальний автоскрол контейнера колонок
        if (lastClientX > containerRect.right - scrollZone && lastClientX < containerRect.right + 25) {
            columnsContainer.scrollLeft += scrollSpeed;
        } else if (lastClientX < containerRect.left + scrollZone && lastClientX > containerRect.left - 25) {
            columnsContainer.scrollLeft -= scrollSpeed;
        }

        // Вертикальний автоскрол списку нотаток всередині колонки
        const notesList = getTargetColumnNotesList(lastClientX, lastClientY);
        if (notesList) {
            const listRect = notesList.getBoundingClientRect();
            if (lastClientY > listRect.bottom - scrollZone) {
                notesList.scrollTop += scrollSpeed;
            } else if (lastClientY < listRect.top + scrollZone) {
                notesList.scrollTop -= scrollSpeed;
            }
        }

        if (marqueeEl) {
            const left = Math.min(startX, lastClientX);
            const top = Math.min(startY, lastClientY);
            const width = Math.abs(lastClientX - startX);
            const height = Math.abs(lastClientY - startY);
            checkIntersection({ left, top, right: left + width, bottom: top + height });
        }

        autoScrollRaf = requestAnimationFrame(handleAutoScroll);
    }

    window.App.workspaceMarquee = {
        init() {
            const workspaceEl = document.getElementById('board-workspace');
            if (!workspaceEl) return;

            workspaceEl.addEventListener('pointerdown', (e) => {
                // Тільки ліва кнопка миші
                if (e.button !== 0) return;
                // Не перехоплюємо нативний тач-скрол на смартфонах/планшетах
                if (e.pointerType === 'touch') return;

                const state = window.App.state;
                // Не запускаємо в режимі графу або під час перетягування нотатки
                if (state && (state.isGraphView || state.isDraggingNote)) return;

                // Перевіряємо, чи клік не припав на інтерактивний елемент або нотатку
                const invalidTarget = e.target.closest(
                    '.note-sticker, ' +
                    '.workspace-top-header, ' +
                    '.column-header, ' +
                    '.add-note-bottom-container, ' +
                    '.workspace-selection-bar, ' +
                    '.sticker-menu-dropdown, ' +
                    '.sticker-emoji-picker-dropdown, ' +
                    '.sticker-tag-dropdown, ' +
                    '.column-menu-dropdown, ' +
                    '.column-filter-dropdown, ' +
                    '.sidebar-context-menu, ' +
                    '.mobile-columns-pagination, ' +
                    '.sidebar, ' +
                    '.sidebar-resizer, ' +
                    'button, ' +
                    'input, ' +
                    'textarea, ' +
                    'a'
                );
                if (invalidTarget) return;

                startX = e.clientX;
                startY = e.clientY;
                lastClientX = e.clientX;
                lastClientY = e.clientY;
                isMarquee = false;
                wasInSelectMode = Boolean(state && state.isWorkspaceSelectMode);

                const isModifier = Boolean(e.ctrlKey || e.metaKey || e.shiftKey);
                initialSelection = (isModifier && state && state.selectedWorkspaceNoteIds)
                    ? new Set(state.selectedWorkspaceNoteIds)
                    : new Set();

                const onPointerMove = (moveEv) => {
                    lastClientX = moveEv.clientX;
                    lastClientY = moveEv.clientY;

                    const dx = moveEv.clientX - startX;
                    const dy = moveEv.clientY - startY;

                    if (!isMarquee && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
                        isMarquee = true;
                        document.body.style.userSelect = 'none';

                        // Активуємо режим мульти-вибору робочої області
                        if (window.App.workspaceSelectionBar) {
                            if (!state.isWorkspaceSelectMode) {
                                window.App.workspaceSelectionBar.enterSelectMode();
                            }
                        }

                        if (!isModifier && state && state.selectedWorkspaceNoteIds) {
                            state.selectedWorkspaceNoteIds.clear();
                        }

                        marqueeEl = document.createElement('div');
                        marqueeEl.className = 'workspace-marquee-selection';
                        document.body.appendChild(marqueeEl);

                        if (!autoScrollRaf) {
                            autoScrollRaf = requestAnimationFrame(handleAutoScroll);
                        }
                    }

                    if (isMarquee && marqueeEl) {
                        moveEv.preventDefault();
                        const left = Math.min(startX, moveEv.clientX);
                        const top = Math.min(startY, moveEv.clientY);
                        const width = Math.abs(moveEv.clientX - startX);
                        const height = Math.abs(moveEv.clientY - startY);

                        marqueeEl.style.left = `${left}px`;
                        marqueeEl.style.top = `${top}px`;
                        marqueeEl.style.width = `${width}px`;
                        marqueeEl.style.height = `${height}px`;

                        checkIntersection({ left, top, right: left + width, bottom: top + height });
                    }
                };

                const onPointerUp = (upEv) => {
                    window.removeEventListener('pointermove', onPointerMove);
                    window.removeEventListener('pointerup', onPointerUp);
                    window.removeEventListener('pointercancel', onPointerUp);

                    document.body.style.userSelect = '';
                    window.getSelection()?.removeAllRanges();

                    if (autoScrollRaf) {
                        cancelAnimationFrame(autoScrollRaf);
                        autoScrollRaf = null;
                    }

                    if (marqueeEl) {
                        marqueeEl.remove();
                        marqueeEl = null;
                    }

                    if (isMarquee) {
                        if (window.App.workspaceSelectionBar) {
                            window.App.workspaceSelectionBar.updateUI();
                        }
                        // Якщо нічого не було захоплено і користувач до цього не був у режимі вибору — виходимо
                        if (!wasInSelectMode && state && state.selectedWorkspaceNoteIds && state.selectedWorkspaceNoteIds.size === 0) {
                            if (window.App.workspaceSelectionBar) {
                                window.App.workspaceSelectionBar.exitSelectMode();
                            }
                        }
                    } else {
                        // Якщо це був простий клік у порожнє місце без перетягування:
                        // скидаємо режим вибору (як в iOS галереї або провіднику)
                        if (wasInSelectMode && !isModifier) {
                            if (window.App.workspaceSelectionBar) {
                                window.App.workspaceSelectionBar.exitSelectMode();
                            }
                        }
                    }

                    isMarquee = false;
                };

                window.addEventListener('pointermove', onPointerMove, { passive: false });
                window.addEventListener('pointerup', onPointerUp);
                window.addEventListener('pointercancel', onPointerUp);
            });

            // Гарячі клавіші для вибраних нотаток у робочій області
            window.addEventListener('keydown', (e) => {
                const state = window.App.state;
                if (!state || !state.isWorkspaceSelectMode) return;

                const activeEl = document.activeElement;
                const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
                if (isTyping) return;

                const modalEl = document.getElementById('confirm-modal-overlay');
                if (modalEl && modalEl.style.display !== 'none' && !modalEl.classList.contains('hidden')) return;

                // Видалення виділених нотаток клавішею Delete / Backspace
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    if (state.selectedWorkspaceNoteIds && state.selectedWorkspaceNoteIds.size > 0) {
                        e.preventDefault();
                        const selectedIds = Array.from(state.selectedWorkspaceNoteIds);
                        if (window.App.workspaceSelectionActions) {
                            window.App.workspaceSelectionActions.deleteNotes(selectedIds, e);
                        } else if (window.App.noteManager) {
                            window.App.noteManager.deleteNotes(selectedIds, e);
                        }
                    }
                }

                // Ctrl+A / Cmd+A для вибору всіх нотаток на дошці
                if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A' || e.key === 'ф' || e.key === 'Ф')) {
                    e.preventDefault();
                    document.querySelectorAll('.note-sticker[data-note-id]').forEach(card => {
                        if (card.dataset.noteId) {
                            state.selectedWorkspaceNoteIds.add(card.dataset.noteId);
                        }
                    });
                    if (window.App.workspaceSelectionBar) {
                        window.App.workspaceSelectionBar.updateUI();
                    }
                }
            });
        }
    };
})();
