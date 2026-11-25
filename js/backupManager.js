// js/backupManager.js - Резервне копіювання, імпорт та експорт даних (JSON / Markdown ZIP)
import { zipSync, strToU8 } from 'fflate';

window.App = window.App || {};

export function htmlToMarkdown(html) {
    if (!html || typeof html !== 'string') return '';

    let text = html;

    // Line breaks and paragraphs
    text = text.replace(/<br\s*[\/]?>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<p[^>]*>/gi, '');
    text = text.replace(/<\/div>/gi, '\n');
    text = text.replace(/<div[^>]*>/gi, '');

    // Headers
    text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
    text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
    text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');

    // Bold & italic
    text = text.replace(/<(b|strong)[^>]*>(.*?)<\/(b|strong)>/gi, '**$2**');
    text = text.replace(/<(i|em)[^>]*>(.*?)<\/(i|em)>/gi, '*$2*');

    // Inline code & pre
    text = text.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
    text = text.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n');

    // Links
    text = text.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

    // To-Do checkboxes
    text = text.replace(/<span[^>]*class="[^"]*todo-checkbox[^"]*"[^>]*data-checked="true"[^>]*><\/span>/gi, '- [x] ');
    text = text.replace(/<span[^>]*class="[^"]*todo-checkbox[^"]*"[^>]*><\/span>/gi, '- [ ] ');

    // Lists
    text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
    text = text.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');

    // Remove any remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    // Clean up excessive blank lines (more than 2 consecutive newlines)
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
}

export function sanitizeFileName(name, fallback = 'untitled') {
    if (!name || typeof name !== 'string') return fallback;
    const clean = name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
    return clean || fallback;
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 1000);
}

function getFormattedDateStamp() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}_${h}-${min}`;
}

export const backupManager = {
    htmlToMarkdown,
    sanitizeFileName,

    // 1. Експорт повного JSON-дампу
    exportJsonBackup() {
        const state = window.App?.state || {};
        const storage = window.App?.storage || {};

        let tagOptions = {};
        try {
            tagOptions = JSON.parse(localStorage.getItem('minimal_board_tag_options') || '{}');
        } catch {}

        let boardPositions = {};
        try {
            boardPositions = storage.getBoardPositions ? storage.getBoardPositions() : JSON.parse(localStorage.getItem('minimal_board_positions') || '{}');
        } catch {}

        let noteBookmarks = {};
        try {
            noteBookmarks = JSON.parse(localStorage.getItem('minimal_note_bookmarks') || '{}');
        } catch {}

        const backupData = {
            version: 1,
            appName: 'NothingNotes',
            createdAt: new Date().toISOString(),
            data: {
                boards: state.boards || [],
                notes: state.notes || [],
                readOnlyBoards: state.readOnlyBoards || [],
                readOnlyNotes: state.readOnlyNotes || [],
                tagOptions,
                boardPositions,
                noteBookmarks
            }
        };

        const jsonStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const filename = `nothing-notes-backup_${getFormattedDateStamp()}.json`;
        triggerDownload(blob, filename);

        return { filename, countBoards: backupData.data.boards.length, countNotes: backupData.data.notes.length };
    },

    // 2. Імпорт з JSON (з підтримкою merge та replace)
    importJsonBackup(jsonString, { mode = 'merge' } = {}) {
        let parsed;
        try {
            parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
        } catch (e) {
            throw new Error('Невалідний JSON-файл резервної копії.');
        }

        const data = parsed.data || parsed;
        if (!data || (!Array.isArray(data.boards) && !Array.isArray(data.notes))) {
            throw new Error('Файл не містить структури блокнотів чи нотаток NothingNotes.');
        }

        const rawBoards = Array.isArray(data.boards) ? data.boards : [];
        const rawNotes = Array.isArray(data.notes) ? data.notes : [];

        const sanitizer = window.App?.stickerPasteSanitizer;

        // Санітизація та валідація вхідних блокнотів
        const incomingBoards = rawBoards
            .filter(b => b && typeof b === 'object' && b.id)
            .map(b => ({
                ...b,
                id: String(b.id),
                name: String(b.name || '').slice(0, 100),
                icon: typeof b.icon === 'string' ? b.icon.slice(0, 30) : null
            }));

        // Санітизація та валідація вхідних нотаток (захист від Stored XSS та роздутих пейлоадів)
        const incomingNotes = rawNotes
            .filter(n => n && typeof n === 'object' && n.id)
            .map(n => {
                const rawContent = typeof n.content === 'string' ? n.content : '';
                const safeContent = (sanitizer && sanitizer.sanitizeNoteHtml)
                    ? sanitizer.sanitizeNoteHtml(rawContent)
                    : rawContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

                const safeTitle = String(n.title || '').slice(0, 500);

                const safeTags = Array.isArray(n.tags)
                    ? n.tags.filter(t => typeof t === 'string').map(t => t.trim().slice(0, 50)).slice(0, 50)
                    : [];

                const safeImages = Array.isArray(n.images)
                    ? n.images.filter(img => typeof img === 'string' && (img.startsWith('http://') || img.startsWith('https://') || img.startsWith('data:image/') || img.startsWith('img_') || img.startsWith('blob:')))
                    : [];

                return {
                    ...n,
                    id: String(n.id),
                    title: safeTitle,
                    content: safeContent,
                    tags: safeTags,
                    images: safeImages
                };
            });

        const state = window.App?.state;
        const storage = window.App?.storage;

        if (!state) throw new Error('Стан додатку недоступний.');

        let finalBoards = [];
        let finalNotes = [];

        if (mode === 'replace') {
            finalBoards = incomingBoards;
            finalNotes = incomingNotes;
        } else {
            // Merge mode: об'єднуємо за унікальним ID
            const boardMap = new Map((state.boards || []).map(b => [b.id, b]));
            incomingBoards.forEach(b => {
                if (b && b.id) {
                    if (!boardMap.has(b.id)) {
                        boardMap.set(b.id, b);
                    } else {
                        // Оновлюємо існуючий
                        boardMap.set(b.id, { ...boardMap.get(b.id), ...b });
                    }
                }
            });
            finalBoards = Array.from(boardMap.values());

            const noteMap = new Map((state.notes || []).map(n => [n.id, n]));
            incomingNotes.forEach(n => {
                if (n && n.id) {
                    if (!noteMap.has(n.id)) {
                        noteMap.set(n.id, n);
                    } else {
                        const existing = noteMap.get(n.id);
                        const incomingUpdated = n.updatedAt ? new Date(n.updatedAt).getTime() : 0;
                        const existingUpdated = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
                        if (incomingUpdated >= existingUpdated) {
                            noteMap.set(n.id, { ...existing, ...n });
                        }
                    }
                }
            });
            finalNotes = Array.from(noteMap.values());
        }

        // Зберігаємо оновлені дані
        state.boards = finalBoards;
        state.notes = finalNotes;

        if (storage?.saveBoards) storage.saveBoards(finalBoards);
        if (storage?.saveNotes) storage.saveNotes(finalNotes, true);

        // Якщо імпортовано теги та позиції
        if (data.tagOptions && typeof data.tagOptions === 'object') {
            try {
                const currentTags = JSON.parse(localStorage.getItem('minimal_board_tag_options') || '{}');
                const mergedTags = (mode === 'replace') ? data.tagOptions : { ...currentTags, ...data.tagOptions };
                localStorage.setItem('minimal_board_tag_options', JSON.stringify(mergedTags));
            } catch {}
        }

        if (data.boardPositions && typeof data.boardPositions === 'object') {
            try {
                if (storage?.saveBoardPositionsBatch) {
                    storage.saveBoardPositionsBatch(data.boardPositions);
                }
            } catch {}
        }

        // Якщо активна дошка відсутня або видалена — обираємо першу доступну
        if (!state.activeBoardId || !state.boards.some(b => b.id === state.activeBoardId)) {
            state.activeBoardId = state.boards.length > 0 ? state.boards[0].id : null;
            if (storage?.saveActiveBoardId) storage.saveActiveBoardId(state.activeBoardId);
        }

        // Хмарна синхронізація (якщо користувач онлайн)
        if (window.App?.cloudSync) {
            if (window.App.cloudSync.syncBoards) window.App.cloudSync.syncBoards();
            if (window.App.cloudSync.flushPendingNotes) window.App.cloudSync.flushPendingNotes();
        }

        // Сповіщення підсистем та рендеринг
        if (window.App?.events) {
            window.App.events.emit('board:changed', state.activeBoardId);
            window.App.events.emit('notes:changed');
        }

        if (window.App?.sidebarView?.render) window.App.sidebarView.render();
        if (window.App?.workspaceView?.render) window.App.workspaceView.render();

        return {
            importedBoards: incomingBoards.length,
            importedNotes: incomingNotes.length,
            totalBoards: finalBoards.length,
            totalNotes: finalNotes.length
        };
    },

    // 3. Експорт у структурований Markdown ZIP-архів (для Obsidian / Notion)
    exportMarkdownZip() {
        const state = window.App?.state || {};
        const boards = state.boards || [];
        const notes = state.notes || [];

        const boardMap = new Map(boards.map(b => [b.id, b]));
        const zipFiles = {};

        // Групуємо нотатки за блокнотами
        boards.forEach(board => {
            const folderName = sanitizeFileName(board.name || 'Untitled Board');
            const boardNotes = notes.filter(n => n.boardId === board.id);

            // Додаємо оглядовий файл для блокнота
            const boardReadme = [
                '---',
                `id: ${board.id}`,
                `name: "${board.name || ''}"`,
                `icon: "${board.icon || ''}"`,
                `notes_count: ${boardNotes.length}`,
                `exported_at: ${new Date().toISOString()}`,
                '---',
                '',
                `# ${board.icon ? board.icon + ' ' : ''}${board.name || 'Untitled Board'}`,
                '',
                `Блокнот містить ${boardNotes.length} нотаток.`
            ].join('\n');

            zipFiles[`${folderName}/_board.md`] = strToU8(boardReadme);

            // Формуємо окремий .md файл для кожної нотатки
            const nameCounters = {};
            boardNotes.forEach(note => {
                let noteTitle = note.title ? note.title.trim() : '';
                if (!noteTitle) noteTitle = 'Без назви';
                let safeTitle = sanitizeFileName(noteTitle);

                // Запобігаємо колізіям однакових назв у межах одного блокнота
                if (nameCounters[safeTitle] !== undefined) {
                    nameCounters[safeTitle]++;
                    safeTitle = `${safeTitle} (${nameCounters[safeTitle]})`;
                } else {
                    nameCounters[safeTitle] = 0;
                }

                const createdIso = note.createdAt ? new Date(note.createdAt).toISOString() : new Date().toISOString();
                const updatedIso = note.updatedAt ? new Date(note.updatedAt).toISOString() : createdIso;
                const mdContent = htmlToMarkdown(note.content || '');

                const frontmatter = [
                    '---',
                    `id: ${note.id}`,
                    `title: "${(note.title || '').replace(/"/g, '\\"')}"`,
                    `board_id: ${note.boardId || ''}`,
                    `parent_id: ${note.parentId || 'null'}`,
                    `color: ${note.color || 'yellow'}`,
                    `tags: [${(Array.isArray(note.tags) ? note.tags : []).map(t => `"${t}"`).join(', ')}]`,
                    `created_at: ${createdIso}`,
                    `updated_at: ${updatedIso}`,
                    '---',
                    '',
                    `# ${note.title || 'Без назви'}`,
                    '',
                    mdContent
                ].join('\n');

                zipFiles[`${folderName}/${safeTitle}.md`] = strToU8(frontmatter);
            });
        });

        // Стискаємо в ZIP
        const zipped = zipSync(zipFiles, { level: 6 });
        const blob = new Blob([zipped], { type: 'application/zip' });
        const filename = `nothing-notes-markdown_${getFormattedDateStamp()}.zip`;
        triggerDownload(blob, filename);

        return { filename, totalFiles: Object.keys(zipFiles).length };
    }
};

window.App.backupManager = backupManager;
