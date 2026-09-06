// js/workspace/workspaceSearch.js - Глобальний пошук на дошці (Ctrl+F) та швидкі інструменти хедера
window.App = window.App || {};

(function() {
    let searchMatches = []; // Масив об'єктів { noteId, matchIndexInNote }
    let currentMatchIndex = -1;

    window.App.workspaceSearch = {
        init() {
            this.bindEvents();
            this.bindQuickTools();
        },

        isOpen() {
            const searchBar = document.getElementById('workspace-search-bar');
            return searchBar && searchBar.style.display === 'flex';
        },

        open() {
            const searchBar = document.getElementById('workspace-search-bar');
            const searchInput = document.getElementById('workspace-search-input');
            if (searchBar) {
                searchBar.style.display = 'flex';
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                    if (searchInput.value.trim()) {
                        this.performSearch(searchInput.value);
                    }
                }
            }
        },

        close() {
            const searchBar = document.getElementById('workspace-search-bar');
            const searchInput = document.getElementById('workspace-search-input');
            if (searchBar) searchBar.style.display = 'none';
            if (searchInput) searchInput.value = '';
            this.clearHighlights();
        },

        toggle() {
            if (this.isOpen()) {
                this.close();
            } else {
                this.open();
            }
        },

        clearHighlights() {
            const searchCount = document.getElementById('workspace-search-count');
            const searchNav = document.getElementById('workspace-search-nav');

            document.querySelectorAll('mark.workspace-search-highlight').forEach(mark => {
                const parent = mark.parentNode;
                if (parent) {
                    while (mark.firstChild) {
                        parent.insertBefore(mark.firstChild, mark);
                    }
                    parent.removeChild(mark);
                }
            });

            document.querySelectorAll('.sticker-content, .sticker-title').forEach(el => el.normalize());
            searchMatches = [];
            currentMatchIndex = -1;

            if (searchCount) searchCount.style.display = 'none';
            if (searchNav) searchNav.style.display = 'none';
        },

        highlightCurrentMatch(index) {
            const searchCount = document.getElementById('workspace-search-count');
            const searchInput = document.getElementById('workspace-search-input');

            if (searchMatches.length === 0 || index < 0 || index >= searchMatches.length) return;

            // Знімаємо клас active з усіх підсвічувань
            document.querySelectorAll('mark.workspace-search-highlight.current-search-match').forEach(m => {
                m.classList.remove('current-search-match');
            });

            const targetMatch = searchMatches[index];
            currentMatchIndex = index;

            if (searchCount) {
                searchCount.textContent = `${index + 1}/${searchMatches.length}`;
                searchCount.style.display = 'inline-block';
            }

            // Перевіряємо чи картка цієї нотатки зараз присутня у відкритих колонках DOM
            let card = document.querySelector(`.note-sticker[data-note-id="${targetMatch.noteId}"]`);

            const focusAndScrollToMatch = (targetCard) => {
                if (!targetCard) return;
                const cardMarks = Array.from(targetCard.querySelectorAll('mark.workspace-search-highlight'));
                const matchEl = cardMarks[targetMatch.matchIndexInNote] || cardMarks[0] || targetCard;

                if (matchEl && matchEl.classList) {
                    matchEl.classList.add('current-search-match');
                    matchEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                } else {
                    targetCard.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                }
            };

            if (!card) {
                // Нотатка схована в закритій піднотатці — відкриваємо ланцюжок колонок
                if (window.App.workspaceView && window.App.workspaceView.scrollToNote) {
                    window.App.workspaceView.scrollToNote(targetMatch.noteId);
                    setTimeout(() => {
                        if (searchInput) {
                            this.applyHighlightsToDOM(searchInput.value.trim().toLowerCase());
                        }
                        const newCard = document.querySelector(`.note-sticker[data-note-id="${targetMatch.noteId}"]`);
                        focusAndScrollToMatch(newCard);
                    }, 120);
                }
            } else {
                focusAndScrollToMatch(card);
            }
        },

        applyHighlightsToDOM(target) {
            if (!target || target.length < 1) return;

            document.querySelectorAll('.sticker-title, .sticker-content').forEach(textContainer => {
                const card = textContainer.closest('.note-sticker');
                if (!card) return;

                const walker = document.createTreeWalker(textContainer, NodeFilter.SHOW_TEXT, null);
                const textNodes = [];
                let curr = walker.nextNode();
                while (curr) {
                    textNodes.push(curr);
                    curr = walker.nextNode();
                }

                textNodes.forEach(node => {
                    const val = node.nodeValue;
                    if (!val) return;
                    const lower = val.toLowerCase();
                    const idx = lower.indexOf(target);
                    if (idx !== -1) {
                        const parent = node.parentNode;
                        if (!parent || parent.classList?.contains('workspace-search-highlight')) return;

                        const parts = [];
                        let lastIdx = 0;
                        let pos = lower.indexOf(target, lastIdx);

                        while (pos !== -1) {
                            parts.push(val.substring(lastIdx, pos));
                            parts.push(val.substring(pos, pos + target.length));
                            lastIdx = pos + target.length;
                            pos = lower.indexOf(target, lastIdx);
                        }
                        parts.push(val.substring(lastIdx));

                        const fragment = document.createDocumentFragment();
                        for (let i = 0; i < parts.length; i++) {
                            if (i % 2 === 1) {
                                const mark = document.createElement('mark');
                                mark.className = 'workspace-search-highlight';
                                mark.textContent = parts[i];
                                fragment.appendChild(mark);
                            } else if (parts[i]) {
                                fragment.appendChild(document.createTextNode(parts[i]));
                            }
                        }
                        parent.replaceChild(fragment, node);
                    }
                });
            });
        },

        performSearch(query) {
            const searchCount = document.getElementById('workspace-search-count');
            const searchNav = document.getElementById('workspace-search-nav');

            this.clearHighlights();
            if (!query || query.trim().length < 1) {
                return;
            }

            const target = query.trim().toLowerCase();
            const state = window.App.state;

            // Шукаємо збіги в усіх нотатках активної дошки
            const boardNotes = state.notes.filter(n => n.boardId === state.activeBoardId);
            const matchesList = [];

            boardNotes.forEach(note => {
                let countInThisNote = 0;

                // 1. Пошук у заголовку
                if (note.title) {
                    const cleanTitle = note.title.toLowerCase();
                    let pos = cleanTitle.indexOf(target);
                    while (pos !== -1) {
                        matchesList.push({
                            noteId: note.id,
                            matchIndexInNote: countInThisNote
                        });
                        countInThisNote++;
                        pos = cleanTitle.indexOf(target, pos + target.length);
                    }
                }

                // 2. Пошук у контенті
                if (note.content) {
                    const temp = document.createElement('div');
                    temp.innerHTML = note.content || '';
                    const cleanContent = temp.textContent.toLowerCase();
                    let pos = cleanContent.indexOf(target);
                    while (pos !== -1) {
                        matchesList.push({
                            noteId: note.id,
                            matchIndexInNote: countInThisNote
                        });
                        countInThisNote++;
                        pos = cleanContent.indexOf(target, pos + target.length);
                    }
                }
            });

            searchMatches = matchesList;

            if (searchMatches.length === 0) {
                if (searchCount) {
                    searchCount.textContent = '0/0';
                    searchCount.style.display = 'inline-block';
                }
                if (searchNav) searchNav.style.display = 'none';
                return;
            }

            // Накладаємо підсвічування на всі видимі картки на екрані
            this.applyHighlightsToDOM(target);

            // Показуємо кнопки навігації та переходимо до 1-го збігу
            if (searchNav) searchNav.style.display = 'inline-flex';
            this.highlightCurrentMatch(0);
        },

        goToNextMatch() {
            if (searchMatches.length === 0) return;
            const nextIndex = (currentMatchIndex + 1) % searchMatches.length;
            this.highlightCurrentMatch(nextIndex);
        },

        goToPrevMatch() {
            if (searchMatches.length === 0) return;
            const prevIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
            this.highlightCurrentMatch(prevIndex);
        },

        bindEvents() {
            const searchBtn = document.getElementById('workspace-search-btn');
            const searchBar = document.getElementById('workspace-search-bar');
            const searchInput = document.getElementById('workspace-search-input');
            const searchClose = document.getElementById('workspace-search-close');
            const searchPrevBtn = document.getElementById('workspace-search-prev');
            const searchNextBtn = document.getElementById('workspace-search-next');
            const searchWrap = document.getElementById('workspace-search-wrap');

            if (searchBtn) {
                searchBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggle();
                });
            }

            if (searchClose) {
                searchClose.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.close();
                });
            }

            if (searchNextBtn) {
                searchNextBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.goToNextMatch();
                });
            }

            if (searchPrevBtn) {
                searchPrevBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.goToPrevMatch();
                });
            }

            // Закриття пошуку при кліку поза ним
            document.addEventListener('pointerdown', (e) => {
                if (searchWrap && !searchWrap.contains(e.target)) {
                    if (searchBar && searchBar.style.display === 'flex') {
                        this.close();
                    }
                }
            });

            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.performSearch(e.target.value);
                });
                searchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.close();
                    } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        this.goToNextMatch();
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        this.goToPrevMatch();
                    } else if (e.key === 'Escape') {
                        this.close();
                    }
                });
            }

            // Глобальне перехоплення Ctrl+F та вихід по Escape
            window.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'f' || e.code === 'KeyF')) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    this.open();
                } else if (e.key === 'Escape') {
                    if (this.isOpen()) {
                        this.close();
                    }
                }
            }, true);
        },

        bindQuickTools() {
            // Дзен / Фокус Режим
            const zenBtn = document.getElementById('workspace-zen-btn');
            if (zenBtn) {
                zenBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    document.body.classList.toggle('zen-mode-active');
                });
            }

            // Згорнути всі ланцюжки піднотаток
            const collapseBtn = document.getElementById('workspace-collapse-btn');
            if (collapseBtn) {
                collapseBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const state = window.App.state;
                    if (state && state.activeChain && state.activeChain.length > 1) {
                        state.activeChain = [null];
                        if (window.App.workspaceView) {
                            window.App.workspaceView.render();
                        }
                    }
                });
            }
        }
    };
})();
