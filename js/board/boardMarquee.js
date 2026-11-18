// js/board/boardMarquee.js - Логіка виділення прямокутною рамкою (Marquee selection) на полотні дошки
window.App = window.App || {};

(function() {
    let isPreparing = false;
    let isActive = false;
    let startPos = { x: 0, y: 0 };
    let initialSelection = new Set();
    let wasInSelectMode = false;
    let marqueeEl = null;

    function checkIntersection(marqueeRect, initialSet, nodesLayer) {
        const state = window.App.state;
        if (!state || !state.selectedWorkspaceNoteIds) return;
        if (!nodesLayer) return;

        const cards = nodesLayer.querySelectorAll('.note-sticker[data-note-id]');
        cards.forEach(card => {
            const noteId = card.dataset.noteId;
            if (!noteId) return;
            if (card.style.display === 'none') return;

            const cardRect = card.getBoundingClientRect();
            const isIntersecting = !(
                cardRect.right < marqueeRect.left ||
                cardRect.left > marqueeRect.right ||
                cardRect.bottom < marqueeRect.top ||
                cardRect.top > marqueeRect.bottom
            );

            if (isIntersecting) {
                state.selectedWorkspaceNoteIds.add(noteId);
            } else if (!initialSet || !initialSet.has(noteId)) {
                state.selectedWorkspaceNoteIds.delete(noteId);
            }
        });

        if (window.App.workspaceSelectionBar) {
            window.App.workspaceSelectionBar.updateUI();
        }
    }

    window.App.boardMarquee = {
        isPreparing() {
            return isPreparing;
        },

        isActive() {
            return isActive;
        },

        start(e) {
            isPreparing = true;
            isActive = false;
            startPos = { x: e.clientX, y: e.clientY };

            const state = window.App.state;
            const isModifier = Boolean(e.ctrlKey || e.metaKey || e.shiftKey);
            wasInSelectMode = Boolean(state && state.isWorkspaceSelectMode);
            initialSelection = (isModifier && state && state.selectedWorkspaceNoteIds)
                ? new Set(state.selectedWorkspaceNoteIds)
                : new Set();
        },

        move(e, nodesLayer) {
            if (!isPreparing) return false;

            const dx = e.clientX - startPos.x;
            const dy = e.clientY - startPos.y;

            if (!isActive && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
                isActive = true;
                document.body.style.userSelect = 'none';

                const state = window.App.state;
                if (window.App.workspaceSelectionBar && state && !state.isWorkspaceSelectMode) {
                    window.App.workspaceSelectionBar.enterSelectMode();
                }

                const isModifier = Boolean(e.ctrlKey || e.metaKey || e.shiftKey);
                if (!isModifier && state && state.selectedWorkspaceNoteIds) {
                    state.selectedWorkspaceNoteIds.clear();
                }

                if (!marqueeEl) {
                    marqueeEl = document.createElement('div');
                    marqueeEl.className = 'workspace-marquee-selection';
                    document.body.appendChild(marqueeEl);
                }
            }

            if (isActive && marqueeEl) {
                e.preventDefault();
                const left = Math.min(startPos.x, e.clientX);
                const top = Math.min(startPos.y, e.clientY);
                const width = Math.abs(e.clientX - startPos.x);
                const height = Math.abs(e.clientY - startPos.y);

                marqueeEl.style.left = left + 'px';
                marqueeEl.style.top = top + 'px';
                marqueeEl.style.width = width + 'px';
                marqueeEl.style.height = height + 'px';

                checkIntersection({
                    left: left,
                    top: top,
                    right: left + width,
                    bottom: top + height
                }, initialSelection, nodesLayer);

                return true;
            }

            return false;
        },

        up(e) {
            if (!isPreparing && !isActive) return false;

            document.body.style.userSelect = '';
            if (marqueeEl) {
                marqueeEl.remove();
                marqueeEl = null;
            }

            const state = window.App.state;
            if (isActive) {
                if (window.App.workspaceSelectionBar) {
                    window.App.workspaceSelectionBar.updateUI();
                }
                if (!wasInSelectMode && state && state.selectedWorkspaceNoteIds && state.selectedWorkspaceNoteIds.size === 0) {
                    if (window.App.workspaceSelectionBar) {
                        window.App.workspaceSelectionBar.exitSelectMode();
                    }
                }
            } else {
                // Клік без перетягування
                const dx = Math.abs(e.clientX - startPos.x);
                const dy = Math.abs(e.clientY - startPos.y);
                if (dx < 5 && dy < 5 && wasInSelectMode && !e.shiftKey) {
                    if (window.App.workspaceSelectionBar) {
                        window.App.workspaceSelectionBar.exitSelectMode();
                    }
                }
            }

            isPreparing = false;
            isActive = false;
            return true;
        },

        cleanup() {
            if (marqueeEl) {
                marqueeEl.remove();
                marqueeEl = null;
            }
            isPreparing = false;
            isActive = false;
        }
    };
})();
