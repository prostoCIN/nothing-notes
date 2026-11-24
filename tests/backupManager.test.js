import { describe, it, expect, beforeEach, vi } from 'vitest';
import { htmlToMarkdown, sanitizeFileName, backupManager } from '../js/backupManager.js';
import { unzipSync } from 'fflate';

describe('Backup & Export Manager (Step 2)', () => {
    beforeEach(() => {
        window.App = window.App || {};
        window.App.state = {
            boards: [
                { id: 'b1', name: 'My Board', icon: '📝' }
            ],
            notes: [
                {
                    id: 'n1',
                    boardId: 'b1',
                    parentId: null,
                    title: 'Test Note',
                    content: '<h1>Title</h1><p>Hello <b>world</b> with <a href="https://example.com">link</a></p><ul><li>Item 1</li><li>Item 2</li></ul>',
                    color: 'yellow',
                    tags: ['tag1', 'tag2'],
                    createdAt: 1700000000000,
                    updatedAt: 1700000010000
                }
            ]
        };

        window.App.storage = {
            saveBoards: vi.fn(),
            saveNotes: vi.fn(),
            saveActiveBoardId: vi.fn(),
            saveBoardPositionsBatch: vi.fn()
        };
        window.App.cloudSync = {
            syncBoards: vi.fn(),
            flushPendingNotes: vi.fn()
        };
        window.App.events = {
            emit: vi.fn()
        };

        // Mock URL and createElement for download triggers
        global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
        global.URL.revokeObjectURL = vi.fn();
    });

    describe('htmlToMarkdown conversion', () => {
        it('should convert HTML to clean Markdown', () => {
            const html = '<h1>Heading 1</h1><p>Paragraph with <b>bold</b> and <i>italic</i> and <code>code</code></p>';
            const md = htmlToMarkdown(html);

            expect(md).toContain('# Heading 1');
            expect(md).toContain('**bold**');
            expect(md).toContain('*italic*');
            expect(md).toContain('`code`');
        });

        it('should convert lists and links correctly', () => {
            const html = '<p><a href="https://google.com">Search</a></p><ul><li>Alpha</li><li>Beta</li></ul>';
            const md = htmlToMarkdown(html);

            expect(md).toContain('[Search](https://google.com)');
            expect(md).toContain('- Alpha');
            expect(md).toContain('- Beta');
        });

        it('should handle entity decoding and empty strings', () => {
            expect(htmlToMarkdown('')).toBe('');
            expect(htmlToMarkdown(null)).toBe('');
            expect(htmlToMarkdown('A&amp;B &lt; C &gt; D')).toBe('A&B < C > D');
        });
    });

    describe('sanitizeFileName', () => {
        it('should remove illegal filesystem characters', () => {
            expect(sanitizeFileName('FateString / Mod : Extra?')).toBe('FateString _ Mod _ Extra_');
            expect(sanitizeFileName('   ')).toBe('untitled');
            expect(sanitizeFileName(null)).toBe('untitled');
        });
    });

    describe('JSON Backup and Import', () => {
        it('should export complete JSON backup with metadata', () => {
            const res = backupManager.exportJsonBackup();
            expect(res.countBoards).toBe(1);
            expect(res.countNotes).toBe(1);
            expect(res.filename).toContain('.json');
            expect(global.URL.createObjectURL).toHaveBeenCalled();
        });

        it('should import JSON in merge mode', () => {
            const incomingJson = JSON.stringify({
                version: 1,
                data: {
                    boards: [{ id: 'b2', name: 'Second Board' }],
                    notes: [{ id: 'n2', boardId: 'b2', title: 'New Note', content: 'Clean' }]
                }
            });

            const res = backupManager.importJsonBackup(incomingJson, { mode: 'merge' });

            expect(res.importedBoards).toBe(1);
            expect(res.importedNotes).toBe(1);
            expect(res.totalBoards).toBe(2);
            expect(res.totalNotes).toBe(2);
            expect(window.App.storage.saveBoards).toHaveBeenCalled();
            expect(window.App.storage.saveNotes).toHaveBeenCalled();
        });

        it('should import JSON in replace mode', () => {
            const incomingJson = JSON.stringify({
                version: 1,
                data: {
                    boards: [{ id: 'b_only', name: 'Only Board' }],
                    notes: []
                }
            });

            const res = backupManager.importJsonBackup(incomingJson, { mode: 'replace' });

            expect(res.totalBoards).toBe(1);
            expect(res.totalNotes).toBe(0);
            expect(window.App.state.boards[0].id).toBe('b_only');
        });

        it('should throw error on invalid JSON', () => {
            expect(() => backupManager.importJsonBackup('INVALID_JSON')).toThrow();
            expect(() => backupManager.importJsonBackup(JSON.stringify({ notData: true }))).toThrow();
        });
    });

    describe('Markdown ZIP Export', () => {
        it('should generate valid ZIP archive with frontmatter and notes', () => {
            let capturedBlob = null;
            global.URL.createObjectURL = vi.fn().mockImplementation((blob) => {
                capturedBlob = blob;
                return 'blob:mock-zip';
            });

            const res = backupManager.exportMarkdownZip();

            expect(res.filename).toContain('.zip');
            expect(res.totalFiles).toBe(2); // _board.md and Test Note.md
            expect(capturedBlob).toBeDefined();
            expect(capturedBlob.type).toBe('application/zip');
        });
    });
});
