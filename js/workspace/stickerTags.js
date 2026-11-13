// js/workspace/stickerTags.js - Модуль стрічок тегів (Washi Tape Tags) та уніфікованого тулбару тегів (Smart Tag Hub)
window.App = window.App || {};

(function() {
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, m => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        }[m]));
    }

    /**
     * Уніфікований компонент тулбару та списку тегів (Smart Tag Hub)
     * Використовується для окремої нотатки, контекстного меню та мульти-панелі вибору
     */
    window.App.tagHub = {
        mount(container, config = {}) {
            if (!container) return;
            const state = window.App.state;
            const storage = window.App.storage;
            const noteManager = window.App.noteManager;

            const isUa = !window.App.i18n || (window.App.i18n.getLanguage && window.App.i18n.getLanguage() === 'ua');
            const getTargetNoteIds = config.getTargetNoteIds || (() => []);
            const onTagsChanged = config.onTagsChanged || (() => {});
            const onClose = config.onClose || (() => {});
            const isSelectionBar = !!config.isSelectionBar;
            const autoFocus = config.autoFocus !== false;

            let searchQuery = '';
            let selectedColorIndex = null; // null — авто-хеш, 0..5 — вибір користувача
            let keyboardFocusedIndex = -1; // -2: кнопка створення, >=0: індекс у filteredTags

            container.innerHTML = '';
            const wrapper = document.createElement('div');
            wrapper.className = `tag-hub-wrapper ${isSelectionBar ? 'is-selection-bar' : ''}`;

            // 1. Тулбар з інпутом швидкого пошуку та створення
            const toolbar = document.createElement('div');
            toolbar.className = 'tag-hub-toolbar';

            const searchWrap = document.createElement('div');
            searchWrap.className = 'tag-hub-search-wrap';

            const searchIcon = document.createElement('span');
            searchIcon.className = 'tag-hub-search-icon';
            searchIcon.innerHTML = `
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
            `;

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'tag-hub-input';
            input.placeholder = isUa ? 'Шукати або створити тег...' : 'Search or create tag...';
            input.autocomplete = 'off';
            input.spellcheck = false;

            const clearSearchBtn = document.createElement('button');
            clearSearchBtn.type = 'button';
            clearSearchBtn.className = 'tag-hub-clear-search-btn';
            clearSearchBtn.title = isUa ? 'Очистити поле' : 'Clear search';
            clearSearchBtn.innerHTML = '×';
            clearSearchBtn.style.display = 'none';

            clearSearchBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                input.value = '';
                searchQuery = '';
                selectedColorIndex = null;
                keyboardFocusedIndex = -1;
                clearSearchBtn.style.display = 'none';
                input.focus();
                renderDynamic();
            });

            searchWrap.appendChild(searchIcon);
            searchWrap.appendChild(input);
            searchWrap.appendChild(clearSearchBtn);
            toolbar.appendChild(searchWrap);
            wrapper.appendChild(toolbar);

            // 2. Блок швидкого створення тегу та палітри стрічки Washi
            const createPanel = document.createElement('div');
            createPanel.className = 'tag-hub-create-panel';
            createPanel.style.display = 'none';
            wrapper.appendChild(createPanel);

            // 3. Статус-бар з лічильником та кнопкою очищення
            const statusBar = document.createElement('div');
            statusBar.className = 'tag-hub-status-bar';
            wrapper.appendChild(statusBar);

            // 4. Список тегів
            const listContainer = document.createElement('div');
            listContainer.className = 'tag-hub-list';
            wrapper.appendChild(listContainer);

            container.appendChild(wrapper);

            // Рендер динамічного контенту списку
            function renderDynamic() {
                const rawTargetIds = getTargetNoteIds();
                const targetIds = Array.isArray(rawTargetIds) ? rawTargetIds : [];
                const targetNotes = targetIds.map(id => noteManager.getNoteById(id)).filter(Boolean);

                const allTags = storage.getTagOptions ? storage.getTagOptions() : [];
                const query = searchQuery.trim().toLowerCase();

                const filteredTags = query 
                    ? allTags.filter(t => t.toLowerCase().includes(query))
                    : allTags;

                const exactMatch = allTags.some(t => t.toLowerCase() === query);
                const showCreatePanel = query.length > 0 && !exactMatch;

                // 2. Панель створення
                if (showCreatePanel) {
                    createPanel.style.display = 'flex';
                    createPanel.innerHTML = '';

                    const autoColor = (window.App.getTagColorIndex ? window.App.getTagColorIndex(searchQuery.trim()) : 0);
                    const activeColor = selectedColorIndex !== null ? selectedColorIndex : autoColor;

                    const createBtn = document.createElement('div');
                    createBtn.className = `tag-hub-create-btn ${keyboardFocusedIndex === -2 ? 'keyboard-focused' : ''}`;
                    createBtn.innerHTML = `
                        <div class="tag-hub-create-left">
                            <span class="tag-hub-create-plus">+</span>
                            <span class="tag-hub-create-text">${isUa ? 'Створити' : 'Create'} <b>"${escapeHtml(searchQuery.trim())}"</b></span>
                        </div>
                        <span class="tag-hub-create-kbd">Enter</span>
                    `;
                    createBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        executeCreate(searchQuery.trim(), activeColor);
                    });
                    createPanel.appendChild(createBtn);

                    // Washi Color Strip
                    const colorStrip = document.createElement('div');
                    colorStrip.className = 'tag-hub-color-strip';

                    const stripLabel = document.createElement('span');
                    stripLabel.className = 'tag-hub-color-label';
                    stripLabel.textContent = isUa ? 'Стрічка:' : 'Tape:';
                    colorStrip.appendChild(stripLabel);

                    const colorDots = document.createElement('div');
                    colorDots.className = 'tag-hub-color-dots';

                    const colorNamesUa = ['Блакитний', 'Смарагдовий', 'Бурштиновий', 'Рожевий', 'Фіолетовий', 'Кораловий'];
                    const colorNamesEn = ['Blue', 'Emerald', 'Amber', 'Pink', 'Purple', 'Coral'];

                    for (let c = 0; c < 6; c++) {
                        const dotBtn = document.createElement('button');
                        dotBtn.type = 'button';
                        dotBtn.className = `tag-color-dot-btn tag-tape-color-${c} ${activeColor === c ? 'active' : ''}`;
                        dotBtn.title = isUa ? colorNamesUa[c] : colorNamesEn[c];
                        dotBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            selectedColorIndex = c;
                            renderDynamic();
                            input.focus();
                        });
                        colorDots.appendChild(dotBtn);
                    }

                    colorStrip.appendChild(colorDots);
                    createPanel.appendChild(colorStrip);
                } else {
                    createPanel.style.display = 'none';
                    createPanel.innerHTML = '';
                }

                // 3. Статус-бар
                const attachedTags = new Set();
                targetNotes.forEach(note => {
                    const noteTags = noteManager.getNoteTags ? noteManager.getNoteTags(note) : [];
                    noteTags.forEach(t => attachedTags.add(t));
                });

                if (attachedTags.size > 0) {
                    statusBar.style.display = 'flex';
                    statusBar.innerHTML = '';

                    const count = attachedTags.size;
                    const countBadge = document.createElement('span');
                    countBadge.className = 'tag-hub-count-badge';
                    countBadge.textContent = isUa 
                        ? `${count} ${count === 1 ? 'тег' : (count < 5 ? 'теги' : 'тегів')} прикріплено`
                        : `${count} tag${count === 1 ? '' : 's'} attached`;
                    statusBar.appendChild(countBadge);

                    const clearBtn = document.createElement('button');
                    clearBtn.type = 'button';
                    clearBtn.className = 'tag-hub-clear-all-btn';
                    clearBtn.innerHTML = `
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        <span>${isUa ? 'Очистити всі' : 'Clear all'}</span>
                    `;
                    clearBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        executeClearAll();
                    });
                    statusBar.appendChild(clearBtn);
                } else {
                    statusBar.style.display = 'none';
                    statusBar.innerHTML = '';
                }

                // 4. Список тегів
                listContainer.innerHTML = '';
                if (allTags.length === 0) {
                    const emptyState = document.createElement('div');
                    emptyState.className = 'tag-hub-empty-state';
                    emptyState.innerHTML = `
                        <div class="tag-hub-empty-title">${isUa ? 'Немає створених тегів' : 'No tags created yet'}</div>
                        <div class="tag-hub-empty-desc">${isUa ? 'Введіть назву вище, щоб додати перший тег' : 'Type a name above to create your first tag'}</div>
                    `;
                    listContainer.appendChild(emptyState);
                } else if (filteredTags.length === 0) {
                    const noMatch = document.createElement('div');
                    noMatch.className = 'tag-hub-no-match';
                    noMatch.textContent = isUa ? 'Нічого не знайдено' : 'No matching tags found';
                    listContainer.appendChild(noMatch);
                } else {
                    filteredTags.forEach((tagText, idx) => {
                        const colorIndex = window.App.getTagColorIndex ? window.App.getTagColorIndex(tagText) : 0;

                        let countWithTag = 0;
                        targetNotes.forEach(note => {
                            const noteTags = noteManager.getNoteTags ? noteManager.getNoteTags(note) : [];
                            if (noteTags.includes(tagText)) countWithTag++;
                        });

                        const allHave = targetNotes.length > 0 && countWithTag === targetNotes.length;
                        const someHave = countWithTag > 0 && !allHave;

                        const item = document.createElement('div');
                        item.className = `tag-hub-item ${allHave ? 'active' : ''} ${someHave ? 'partial' : ''} ${keyboardFocusedIndex === idx ? 'keyboard-focused' : ''}`;
                        item.setAttribute('data-tag', tagText);

                        item.innerHTML = `
                            <div class="tag-hub-item-main">
                                <span class="tag-hub-item-tape tag-tape-color-${colorIndex}">
                                    <span class="tag-hub-item-text">${escapeHtml(tagText)}</span>
                                </span>
                                <span class="tag-hub-item-status">${allHave ? '✓' : (someHave ? '–' : '')}</span>
                            </div>
                            <button type="button" class="tag-hub-item-del" title="${isUa ? 'Видалити тег назавжди' : 'Delete tag permanently'}">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        `;

                        const mainAction = item.querySelector('.tag-hub-item-main');
                        mainAction.addEventListener('click', (e) => {
                            e.stopPropagation();
                            executeToggle(tagText, targetIds);
                        });

                        const delBtn = item.querySelector('.tag-hub-item-del');
                        delBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            executeSafeDelete(tagText);
                        });

                        listContainer.appendChild(item);
                    });
                }
            }

            function executeCreate(tagName, colorIdx) {
                if (!tagName) return;
                const targetIds = getTargetNoteIds();
                if (window.App.workspaceSelectionActions && window.App.workspaceSelectionActions.createAndAssignTag) {
                    window.App.workspaceSelectionActions.createAndAssignTag(tagName, targetIds, colorIdx);
                }
                input.value = '';
                searchQuery = '';
                selectedColorIndex = null;
                keyboardFocusedIndex = -1;
                clearSearchBtn.style.display = 'none';
                renderDynamic();
                input.focus();
                onTagsChanged();
            }

            function executeToggle(tagText, targetIds) {
                if (window.App.workspaceSelectionActions && window.App.workspaceSelectionActions.toggleTag) {
                    window.App.workspaceSelectionActions.toggleTag(targetIds, tagText);
                }
                renderDynamic();
                input.focus();
                onTagsChanged();
            }

            function executeClearAll() {
                const targetIds = getTargetNoteIds();
                if (window.App.workspaceSelectionActions && window.App.workspaceSelectionActions.clearAllTags) {
                    window.App.workspaceSelectionActions.clearAllTags(targetIds);
                }
                renderDynamic();
                input.focus();
                onTagsChanged();
            }

            function executeSafeDelete(tagText) {
                const confirmTitle = isUa ? 'Видалити тег?' : 'Delete tag?';
                const confirmDesc = isUa 
                    ? `Тег "${tagText}" буде повністю видалено з усіх нотаток цього блокноту.`
                    : `The tag "${tagText}" will be permanently removed from all notes in this board.`;

                if (window.App.confirmModal && window.App.confirmModal.show) {
                    window.App.confirmModal.show({
                        title: confirmTitle,
                        desc: confirmDesc,
                        onConfirm: () => {
                            if (window.App.workspaceSelectionActions && window.App.workspaceSelectionActions.deleteTagGlobally) {
                                window.App.workspaceSelectionActions.deleteTagGlobally(tagText);
                            }
                            renderDynamic();
                            input.focus();
                            onTagsChanged();
                        }
                    });
                } else if (confirm(`${confirmTitle}\n${confirmDesc}`)) {
                    if (window.App.workspaceSelectionActions && window.App.workspaceSelectionActions.deleteTagGlobally) {
                        window.App.workspaceSelectionActions.deleteTagGlobally(tagText);
                    }
                    renderDynamic();
                    input.focus();
                    onTagsChanged();
                }
            }

            function scrollFocusedIntoView() {
                const focused = listContainer.querySelector('.tag-hub-item.keyboard-focused') 
                    || createPanel.querySelector('.tag-hub-create-btn.keyboard-focused');
                if (focused && focused.scrollIntoView) {
                    focused.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            }

            // Слухачі інпуту
            input.addEventListener('input', () => {
                searchQuery = input.value;
                clearSearchBtn.style.display = searchQuery.length > 0 ? 'inline-flex' : 'none';
                keyboardFocusedIndex = -1;
                renderDynamic();
            });

            input.addEventListener('keydown', (e) => {
                const allTags = storage.getTagOptions ? storage.getTagOptions() : [];
                const query = searchQuery.trim().toLowerCase();
                const filteredTags = query 
                    ? allTags.filter(t => t.toLowerCase().includes(query))
                    : allTags;
                const exactMatch = allTags.some(t => t.toLowerCase() === query);
                const hasCreateBtn = query.length > 0 && !exactMatch;

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const maxIdx = filteredTags.length - 1;
                    if (keyboardFocusedIndex === -1) {
                        keyboardFocusedIndex = hasCreateBtn ? -2 : (filteredTags.length > 0 ? 0 : -1);
                    } else if (keyboardFocusedIndex === -2) {
                        keyboardFocusedIndex = filteredTags.length > 0 ? 0 : -2;
                    } else if (keyboardFocusedIndex < maxIdx) {
                        keyboardFocusedIndex++;
                    }
                    renderDynamic();
                    scrollFocusedIntoView();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (keyboardFocusedIndex === 0) {
                        keyboardFocusedIndex = hasCreateBtn ? -2 : -1;
                    } else if (keyboardFocusedIndex > 0) {
                        keyboardFocusedIndex--;
                    }
                    renderDynamic();
                    scrollFocusedIntoView();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (keyboardFocusedIndex === -2 || (hasCreateBtn && keyboardFocusedIndex === -1)) {
                        const autoColor = (window.App.getTagColorIndex ? window.App.getTagColorIndex(searchQuery.trim()) : 0);
                        const activeColor = selectedColorIndex !== null ? selectedColorIndex : autoColor;
                        executeCreate(searchQuery.trim(), activeColor);
                    } else if (keyboardFocusedIndex >= 0 && keyboardFocusedIndex < filteredTags.length) {
                        executeToggle(filteredTags[keyboardFocusedIndex], getTargetNoteIds());
                    } else if (exactMatch) {
                        const matchedTag = allTags.find(t => t.toLowerCase() === query);
                        if (matchedTag) executeToggle(matchedTag, getTargetNoteIds());
                    } else if (searchQuery.trim().length > 0) {
                        const autoColor = (window.App.getTagColorIndex ? window.App.getTagColorIndex(searchQuery.trim()) : 0);
                        const activeColor = selectedColorIndex !== null ? selectedColorIndex : autoColor;
                        executeCreate(searchQuery.trim(), activeColor);
                    }
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    onClose();
                }
            });

            // Підписка на зовнішні зміни тегів для синхронізації
            const offTagsChanged = (window.App.events && window.App.events.on) 
                ? window.App.events.on('tags:changed', () => {
                    if (document.body.contains(container)) {
                        renderDynamic();
                    }
                }) 
                : null;

            container._tagHubCleanup = () => {
                if (typeof offTagsChanged === 'function') offTagsChanged();
            };

            renderDynamic();
            if (autoFocus) {
                setTimeout(() => input.focus(), 60);
            }
        }
    };

    /**
     * Створює блок washi-стрічок та випадаючого меню вибору тегів для нотатки
     */
    window.App.stickerTags = {
        createTagsContainer(note, card, isReadOnly = false) {
            const state = window.App.state;
            const noteManager = window.App.noteManager;

            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'sticker-tags-container';

            let noteTags = noteManager.getNoteTags ? noteManager.getNoteTags(note) : [];

            if (noteTags.length === 0) {
                tagsContainer.style.display = 'none';
            }

            const isUa = !window.App.i18n || (window.App.i18n.getLanguage && window.App.i18n.getLanguage() === 'ua');

            // 1. Рендеримо прикріплені Washi-стрічки
            noteTags.forEach(tagText => {
                const colorIndex = window.App.getTagColorIndex ? window.App.getTagColorIndex(tagText) : 0;

                const badge = document.createElement('div');
                badge.className = `sticker-tag-badge tag-tape-color-${colorIndex}`;

                const textSpan = document.createElement('span');
                textSpan.className = 'sticker-tag-badge-text';
                textSpan.textContent = tagText;
                badge.appendChild(textSpan);

                if (!isReadOnly) {
                    const removeBadgeBtn = document.createElement('button');
                    removeBadgeBtn.className = 'sticker-tag-badge-remove';
                    removeBadgeBtn.title = isUa ? 'Зняти тег' : 'Unpin tag';
                    removeBadgeBtn.innerHTML = '×';
                    removeBadgeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const freshNote = (noteManager.getNoteById && noteManager.getNoteById(note.id)) || note;
                        const freshTags = noteManager.getNoteTags ? noteManager.getNoteTags(freshNote) : [];
                        const updatedTags = freshTags.filter(t => t !== tagText);
                        noteManager.updateNote(note.id, { tags: updatedTags, tag: null }, true);
                        if (window.App.events && window.App.events.emit) {
                            window.App.events.emit('tags:changed');
                        }
                    });
                    badge.appendChild(removeBadgeBtn);
                }

                tagsContainer.appendChild(badge);
            });

            if (isReadOnly) {
                return tagsContainer;
            }

            // 2. Кнопка "+ Тег" та поповер єдиного тулбару тегів
            const addTagBtn = document.createElement('button');
            addTagBtn.className = 'sticker-add-tag-btn';
            if (noteTags.length === 0) {
                addTagBtn.style.display = 'none';
            }
            addTagBtn.title = isUa ? 'Додати або керувати тегами' : 'Add or manage tags';
            addTagBtn.innerHTML = `
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="6" x2="12" y2="18"></line>
                    <line x1="6" y1="12" x2="18" y2="12"></line>
                </svg>
                <span>${isUa ? 'Теги' : 'Tags'}</span>
            `;

            const tagDropdown = document.createElement('div');
            tagDropdown.className = 'sticker-tag-dropdown';

            const closeDropdown = () => {
                tagDropdown.classList.remove('active', 'open-upward');
                addTagBtn.classList.remove('active');
                tagsContainer.classList.remove('has-active-dropdown');
                card.classList.remove('has-active-tag');
                const badgeCount = tagsContainer.querySelectorAll('.sticker-tag-badge').length;
                if (badgeCount === 0) {
                    tagsContainer.style.display = 'none';
                    addTagBtn.style.display = 'none';
                }
            };

            const renderDropdownContent = () => {
                window.App.tagHub.mount(tagDropdown, {
                    getTargetNoteIds: () => [note.id],
                    isSelectionBar: false,
                    autoFocus: true,
                    onClose: closeDropdown,
                    onTagsChanged: () => {
                        if (window.App.workspaceSelectionBar && window.App.workspaceSelectionBar.refreshTagSubmenu) {
                            window.App.workspaceSelectionBar.refreshTagSubmenu();
                        }
                    }
                });
            };

            tagDropdown.refreshContent = renderDropdownContent;
            tagDropdown.addEventListener('pointerdown', (e) => e.stopPropagation());
            tagDropdown.addEventListener('click', (e) => e.stopPropagation());

            addTagBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.sticker-menu-dropdown.active, .sticker-emoji-picker-dropdown.active, .sticker-tag-dropdown.active, .column-filter-dropdown.active').forEach(d => {
                    if (d !== tagDropdown) {
                        d.classList.remove('active', 'open-upward');
                        const pCont = d.closest('.sticker-tags-container');
                        if (pCont) pCont.classList.remove('has-active-dropdown');
                        const pCard = d.closest('.note-sticker');
                        if (pCard) pCard.classList.remove('has-active-tag');
                    }
                });
                document.querySelectorAll('.sticker-add-tag-btn.active').forEach(b => {
                    if (b !== addTagBtn) b.classList.remove('active');
                });

                const willOpen = !tagDropdown.classList.contains('active');
                if (willOpen) {
                    renderDropdownContent();
                    if (window.App.smartPositionDropdown) {
                        window.App.smartPositionDropdown(addTagBtn, tagDropdown, 260);
                    }
                    tagDropdown.classList.add('active');
                    addTagBtn.classList.add('active');
                    tagsContainer.classList.add('has-active-dropdown');
                    card.classList.add('has-active-tag');
                } else {
                    closeDropdown();
                }
            });

            tagsContainer.appendChild(addTagBtn);
            tagsContainer.appendChild(tagDropdown);

            return tagsContainer;
        }
    };

    /**
     * Закриває окреме випадаюче меню тегів та ховає контейнер/кнопку, якщо в нотатці 0 тегів
     */
    window.App.closeTagDropdown = function(dropdownEl) {
        if (!dropdownEl) return;
        dropdownEl.classList.remove('active', 'open-upward');
        const container = dropdownEl.closest('.sticker-tags-container');
        if (container) {
            container.classList.remove('has-active-dropdown');
            const card = container.closest('.note-sticker');
            if (card) card.classList.remove('has-active-tag');
            const addBtn = container.querySelector('.sticker-add-tag-btn');
            if (addBtn) addBtn.classList.remove('active');
            if (container.querySelectorAll('.sticker-tag-badge').length === 0) {
                container.style.display = 'none';
                if (addBtn) addBtn.style.display = 'none';
            }
        }
    };

    /**
     * Закриває всі активні випадаючі меню тегів на робочому просторі
     */
    window.App.closeAllTagDropdowns = function(exceptDropdown = null) {
        document.querySelectorAll('.sticker-tag-dropdown.active').forEach(d => {
            if (d !== exceptDropdown) {
                window.App.closeTagDropdown(d);
            }
        });
    };
})();
