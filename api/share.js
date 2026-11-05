// api/share.js - Vercel Serverless Function для експорту нотаток у чистий Markdown для ШІ та скриптів
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sycegfwlajxdaoahqzfp.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Y2VnZndsYWp4ZGFvYWhxemZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMTAyMDUsImV4cCI6MjEwMzY4NjIwNX0.h4G6QzUpxZmnjo8F4DYNkelfAE4WKTR4Z3-JA68BFQc';

function convertHtmlToMarkdown(html) {
    if (!html || typeof html !== 'string') return '';
    let md = html;

    md = md.replace(/<br\s*[\/]?>/gi, '\n');
    md = md.replace(/<\/p>/gi, '\n\n').replace(/<p[^>]*>/gi, '');
    md = md.replace(/<\/div>/gi, '\n').replace(/<div[^>]*>/gi, '');

    md = md.replace(/<(?:b|strong)[^>]*>(.*?)<\/(?:b|strong)>/gi, '**$1**');
    md = md.replace(/<(?:i|em)[^>]*>(.*?)<\/(?:i|em)>/gi, '*$1*');
    md = md.replace(/<(?:s|strike)[^>]*>(.*?)<\/(?:s|strike)>/gi, '~~$1~~');
    md = md.replace(/<mark[^>]*>(.*?)<\/mark>/gi, '==$1==');
    md = md.replace(/<span[^>]*style="[^"]*background(?:-color)?:\s*([^";]+)[^"]*"[^>]*>(.*?)<\/span>/gi, '==$2==');
    md = md.replace(/<u[^>]*>(.*?)<\/u>/gi, '<u>$1</u>');
    md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

    md = md.replace(/<[^>]+>/g, '');
    md = md.replace(/&nbsp;/gi, ' ')
           .replace(/&amp;/gi, '&')
           .replace(/&lt;/gi, '<')
           .replace(/&gt;/gi, '>')
           .replace(/&quot;/gi, '"')
           .replace(/&#39;/gi, "'");

    return md.replace(/\n{3,}/g, '\n\n').trim();
}

function generateMarkdownForNotes(notes, boardTitle = '') {
    if (!notes || notes.length === 0) return '# Порожня нотатка\n';

    if (notes.length === 1) {
        const n = notes[0];
        const rawTitle = (n.title && n.title.trim()) ? n.title.trim() : 'Без назви';
        const icon = n.icon ? `${n.icon} ` : '';
        const bodyMd = convertHtmlToMarkdown(n.content);
        const tags = Array.isArray(n.tags) && n.tags.length > 0 
            ? n.tags.map(t => `#${t.replace(/\s+/g, '_')}`).join(' ') 
            : '';

        let out = `# ${icon}${rawTitle}\n\n`;
        if (tags) out += `> 🏷️ ${tags}\n\n`;
        if (bodyMd) out += `${bodyMd}\n\n`;
        return out.trim() + '\n';
    }

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
        const bodyMd = convertHtmlToMarkdown(note.content);
        const tags = Array.isArray(note.tags) && note.tags.length > 0 
            ? note.tags.map(t => `#${t.replace(/\s+/g, '_')}`).join(' ') 
            : '';

        const effectiveDepth = isSingleRoot ? depth : depth + 1;
        const prefix = '#'.repeat(Math.min(6, effectiveDepth)) + ' ';

        out += `${prefix}${icon}${rawTitle}\n\n`;
        if (tags) out += `> 🏷️ ${tags}\n\n`;
        if (bodyMd) out += `${bodyMd}\n\n`;

        const children = childMap.get(note.id) || [];
        children.forEach(ch => appendNote(ch, depth + 1));
    };

    rootNotes.forEach(rn => appendNote(rn, 1));
    return out.trim() + '\n';
}

export default async function handler(req, res) {
    const isEdge = !res || typeof res.setHeader !== 'function';
    const method = req.method || 'GET';

    const respond = (status, body, contentType = 'text/plain; charset=utf-8') => {
        if (!isEdge) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.setHeader('Content-Type', contentType);
            if (status === 200) {
                res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');
            }
            if (contentType.includes('application/json') && typeof body === 'object') {
                return res.status(status).json(body);
            }
            return res.status(status).send(body);
        } else {
            return new Response(typeof body === 'object' ? JSON.stringify(body) : body, {
                status,
                headers: {
                    'Content-Type': contentType,
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    ...(status === 200 ? { 'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=300' } : {})
                }
            });
        }
    };

    if (method === 'OPTIONS') {
        if (!isEdge) return res.status(200).end();
        return new Response(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        });
    }

    if (method !== 'GET') {
        return respond(405, 'Method Not Allowed');
    }

    let url;
    try {
        url = new URL(req.url, 'http://localhost');
    } catch (e) {
        url = { searchParams: new URLSearchParams() };
    }

    const shareToken = url.searchParams.get('token') || url.searchParams.get('share_board') || (req.query && (req.query.token || req.query.share_board));
    const format = url.searchParams.get('format') || (req.query && req.query.format);
    const subnotes = url.searchParams.get('subnotes') || (req.query && req.query.subnotes);

    if (!shareToken) {
        return respond(400, 'Помилка: відсутній параметр token. Приклад: /api/share?token=sh_123');
    }

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // Отримуємо конфігурацію спільного блокнота за токеном
        const { data: shareData, error: shareErr } = await supabase
            .from('board_shares')
            .select('*')
            .eq('share_token', shareToken)
            .eq('is_active', true)
            .single();

        if (shareErr || !shareData) {
            return respond(404, 'NothingNotes: Спільне посилання не знайдено або воно було деактивовано автором.');
        }

        // Отримуємо всі нотатки для цього блокнота
        const { data: notesData, error: notesErr } = await supabase
            .from('notes')
            .select('*')
            .eq('board_id', shareData.board_id);

        if (notesErr) {
            console.error('[api/share] Помилка завантаження нотаток:', notesErr);
            return respond(500, 'Помилка бази даних під час завантаження нотаток.');
        }

        let finalNotes = notesData || [];
        const includeSubnotes = subnotes !== '0' && subnotes !== 'false';

        // Якщо розшарено лише окремі нотатки — фільтруємо їх та піднотатки
        if (Array.isArray(shareData.note_ids) && shareData.note_ids.length > 0) {
            const allowedSet = new Set(shareData.note_ids);

            if (includeSubnotes) {
                let addedMore = true;
                while (addedMore) {
                    addedMore = false;
                    finalNotes.forEach(n => {
                        if (n.parent_id && allowedSet.has(n.parent_id) && !allowedSet.has(n.id)) {
                            allowedSet.add(n.id);
                            addedMore = true;
                        }
                    });
                }
            }

            finalNotes = finalNotes.filter(n => allowedSet.has(n.id));
        }

        const formattedNotes = finalNotes.map(n => ({
            id: n.id,
            parentId: n.parent_id || null,
            title: n.title || '',
            content: n.content || '',
            icon: n.icon || '',
            tags: Array.isArray(n.tags) ? n.tags : []
        }));

        const boardTitle = shareData.board_name || 'Нотатки';

        if (format === 'json') {
            return respond(200, {
                board: {
                    id: shareData.board_id,
                    name: boardTitle,
                    icon: shareData.board_icon || null
                },
                notes: formattedNotes
            }, 'application/json; charset=utf-8');
        }

        const markdown = generateMarkdownForNotes(formattedNotes, boardTitle);
        return respond(200, markdown, 'text/markdown; charset=utf-8');
    } catch (err) {
        console.error('[api/share] Неочікувана помилка сервера:', err);
        return respond(500, 'Внутрішня помилка сервера при обробці спільного доступу.');
    }
}
