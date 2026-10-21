// js/share/shareMarkdown.js - Конвертація нотаток NothingNotes в чистий Markdown та експорт файлів
window.App = window.App || {};

(function() {
    window.App.shareMarkdown = {
        convertHtmlToMarkdown(html) {
            if (!html || typeof html !== 'string') return '';
            let md = html;

            // Переноси рядків та блокові елементи
            md = md.replace(/<br\s*[\/]?>/gi, '\n');
            md = md.replace(/<\/p>/gi, '\n\n').replace(/<p[^>]*>/gi, '');
            md = md.replace(/<\/div>/gi, '\n').replace(/<div[^>]*>/gi, '');

            // Жирний шрифт
            md = md.replace(/<(?:b|strong)[^>]*>(.*?)<\/(?:b|strong)>/gi, '**$1**');

            // Курсив
            md = md.replace(/<(?:i|em)[^>]*>(.*?)<\/(?:i|em)>/gi, '*$1*');

            // Закреслення
            md = md.replace(/<(?:s|strike)[^>]*>(.*?)<\/(?:s|strike)>/gi, '~~$1~~');

            // Кольорові виділення / маркер
            md = md.replace(/<mark[^>]*>(.*?)<\/mark>/gi, '==$1==');
            md = md.replace(/<span[^>]*style="[^"]*background(?:-color)?:\s*([^";]+)[^"]*"[^>]*>(.*?)<\/span>/gi, '==$2==');

            // Підкреслення
            md = md.replace(/<u[^>]*>(.*?)<\/u>/gi, '<u>$1</u>');

            // Посилання
            md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

            // Видаляємо всі залишки HTML-тегів
            md = md.replace(/<[^>]+>/g, '');

            // Декодування HTML-сутностей
            md = md.replace(/&nbsp;/gi, ' ')
                   .replace(/&amp;/gi, '&')
                   .replace(/&lt;/gi, '<')
                   .replace(/&gt;/gi, '>')
                   .replace(/&quot;/gi, '"')
                   .replace(/&#39;/gi, "'");

            // Очищення зайвих послідовних пустих рядків
            md = md.replace(/\n{3,}/g, '\n\n').trim();

            return md;
        },

        /**
         * Генерує структурований Markdown-документ для однієї або кількох нотаток
         */
        generateMarkdownForNotes(notes, boardTitle = '') {
            if (!notes || notes.length === 0) return '# Порожня нотатка\n';

            // Якщо одна нотатка
            if (notes.length === 1) {
                const n = notes[0];
                const rawTitle = (n.title && n.title.trim()) ? n.title.trim() : 'Без назви';
                const icon = n.icon ? `${n.icon} ` : '';
                const bodyMd = this.convertHtmlToMarkdown(n.content);
                const tags = Array.isArray(n.tags) && n.tags.length > 0 
                    ? n.tags.map(t => `#${t.replace(/\s+/g, '_')}`).join(' ') 
                    : '';

                let out = `# ${icon}${rawTitle}\n\n`;
                if (tags) {
                    out += `> 🏷️ ${tags}\n\n`;
                }
                if (bodyMd) {
                    out += `${bodyMd}\n\n`;
                }
                return out.trim() + '\n';
            }

            // Якщо кілька нотаток або цілий блокнот
            let out = boardTitle ? `# 📓 ${boardTitle}\n\n` : '';

            const noteMap = new Map(notes.map(n => [n.id, n]));
            const rootNotes = notes.filter(n => !n.parentId || !noteMap.has(n.parentId));
            const childMap = new Map();
            notes.forEach(n => {
                if (n.parentId && noteMap.has(n.parentId)) {
                    if (!childMap.has(n.parentId)) childMap.set(n.parentId, []);
                    childMap.get(n.parentId).push(n);
                }
            });

            const isSingleRoot = rootNotes.length === 1 && !boardTitle;
            const appendNote = (note, depth = 1) => {
                const rawTitle = (note.title && note.title.trim()) ? note.title.trim() : 'Без назви';
                const icon = note.icon ? `${note.icon} ` : '';
                const bodyMd = this.convertHtmlToMarkdown(note.content);
                const tags = Array.isArray(note.tags) && note.tags.length > 0 
                    ? note.tags.map(t => `#${t.replace(/\s+/g, '_')}`).join(' ') 
                    : '';

                const effectiveDepth = isSingleRoot ? depth : depth + 1;
                const prefix = '#'.repeat(Math.min(6, effectiveDepth)) + ' ';
                out += `${prefix}${icon}${rawTitle}\n\n`;
                if (tags) {
                    out += `> 🏷️ ${tags}\n\n`;
                }
                if (bodyMd) {
                    out += `${bodyMd}\n\n`;
                }

                const children = childMap.get(note.id) || [];
                children.forEach(ch => appendNote(ch, depth + 1));
            };

            rootNotes.forEach(rn => appendNote(rn, 1));
            return out.trim() + '\n';
        },

        /**
         * Завантажує Markdown як .md файл на пристрій
         */
        downloadMarkdownFile(filename, content) {
            const cleanName = (filename || 'note').replace(/[\\/:*?"<>|]/g, '_').trim();
            const fullName = cleanName.endsWith('.md') ? cleanName : `${cleanName}.md`;
            const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fullName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
    };
})();
