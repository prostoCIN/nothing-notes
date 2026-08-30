// js/sidebar/sidebarSelection.js - Модуль рамки виділення мишкою (Marquee Selection) та гарячих клавіш
window.App = window.App || {};

(function() {
    window.App.sidebarSelection = {
        init() {
            const els = window.App.getElements();
            if (!els.notesList) return;

            let marqueeEl = null;
            let startX = 0;
            let startY = 0;
            let isMarquee = false;
            const state = window.App.state;

            els.notesList.addEventListener('pointerdown', (e) => {
                // Якщо клік на конкретний елемент нотатки або кнопку - виділення рамкою не запускаємо
                if (e.target.closest('.note-item') || e.target.closest('.delete-btn') || e.target.closest('.note-toggle-arrow') || e.button !== 0) {
                    return;
                }

                // Запобігаємо виділенню системного тексту на робочому просторі
                e.preventDefault();
                document.body.style.userSelect = 'none';

                const sidebarEl = document.querySelector('.sidebar');
                const sidebarRect = sidebarEl ? sidebarEl.getBoundingClientRect() : null;

                startX = e.clientX;
                startY = e.clientY;
                isMarquee = false;

                const initialSelection = (e.ctrlKey || e.metaKey) ? new Set(state.selectedSidebarNoteIds) : new Set();

                const onMarqueeMove = (moveEvent) => {
                    moveEvent.preventDefault();
                    // Обмежуємо координати рамки виключно лівою панеллю (сайдбаром)
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
                        const allItemRows = els.notesList.querySelectorAll('.note-item[data-id]');

                        allItemRows.forEach(row => {
                            const noteId = row.dataset.id;
                            const rowRect = row.getBoundingClientRect();
                            const isIntersecting = !(
                                rowRect.right < marqueeRect.left ||
                                rowRect.left > marqueeRect.right ||
                                rowRect.bottom < marqueeRect.top ||
                                rowRect.top > marqueeRect.bottom
                            );

                            if (isIntersecting) {
                                state.selectedSidebarNoteIds.add(noteId);
                            } else if (!initialSelection.has(noteId)) {
                                state.selectedSidebarNoteIds.delete(noteId);
                            }
                        });

                        // Оновлюємо CSS класи виділення
                        allItemRows.forEach(row => {
                            row.classList.toggle('is-selected', state.selectedSidebarNoteIds.has(row.dataset.id));
                        });
                    }
                };

                const onMarqueeUp = () => {
                    window.removeEventListener('pointermove', onMarqueeMove);
                    window.removeEventListener('pointerup', onMarqueeUp);
                    window.removeEventListener('pointercancel', onMarqueeUp);
                    document.body.style.userSelect = '';

                    // Знімаємо виділення системного тексту, якщо щось випадково зачепилось
                    window.getSelection()?.removeAllRanges();

                    if (marqueeEl) {
                        marqueeEl.remove();
                        marqueeEl = null;
                    }

                    // Якщо це був просто клік у порожнє місце без перетягування — скидаємо виділення
                    if (!isMarquee && !e.ctrlKey && !e.metaKey) {
                        state.selectedSidebarNoteIds.clear();
                        els.notesList.querySelectorAll('.note-item.is-selected').forEach(el => el.classList.remove('is-selected'));
                    }
                };

                window.addEventListener('pointermove', onMarqueeMove);
                window.addEventListener('pointerup', onMarqueeUp);
                window.addEventListener('pointercancel', onMarqueeUp);
            });

            // Гаряча клавіша Delete / Backspace для видалення виділених нотаток
            window.addEventListener('keydown', (e) => {
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    // Якщо користувач зараз пише текст у input/textarea або модальне вікно відкрито — не перехоплюємо
                    const activeEl = document.activeElement;
                    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
                    if (isTyping) return;

                    const modalEl = document.getElementById('confirm-modal-overlay');
                    if (modalEl && modalEl.style.display !== 'none' && !modalEl.classList.contains('hidden')) return;

                    if (state.selectedSidebarNoteIds.size > 0) {
                        e.preventDefault();
                        const firstSelectedId = Array.from(state.selectedSidebarNoteIds)[0];
                        window.App.noteManager.deleteNote(firstSelectedId);
                    }
                }
            });
        }
    };
})();
