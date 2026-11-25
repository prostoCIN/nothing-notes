// tests/securityHardening.test.js - Unit tests for security hardening, HTTP headers, XSS prevention & safe links
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import '../js/workspace/stickerPasteSanitizer.js';
import { backupManager } from '../js/backupManager.js';

describe('Security Hardening & Protection Audit', () => {
    describe('HTTP Security Headers (vercel.json)', () => {
        it('configures essential security headers for all routes', () => {
            const vercelConfigPath = path.resolve(process.cwd(), 'vercel.json');
            expect(fs.existsSync(vercelConfigPath)).toBe(true);

            const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
            expect(vercelConfig.headers).toBeDefined();
            expect(Array.isArray(vercelConfig.headers)).toBe(true);

            const allRouteHeaderObj = vercelConfig.headers.find(h => h.source === '/(.*)');
            expect(allRouteHeaderObj).toBeDefined();

            const headerMap = {};
            allRouteHeaderObj.headers.forEach(h => {
                headerMap[h.key.toLowerCase()] = h.value;
            });

            // Clickjacking protection
            expect(headerMap['x-frame-options']).toBe('DENY');

            // MIME-type sniffing protection
            expect(headerMap['x-content-type-options']).toBe('nosniff');

            // Referrer leakage prevention
            expect(headerMap['referrer-policy']).toBe('strict-origin-when-cross-origin');

            // Permissions policy restricting sensitive hardware APIs
            expect(headerMap['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');

            // Cross-Origin Opener Policy for window.opener isolation while supporting OAuth popups
            expect(headerMap['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
        });
    });

    describe('HTML Sanitization & Safe Links (stickerPasteSanitizer)', () => {
        let sanitizer;

        beforeEach(() => {
            sanitizer = window.App?.stickerPasteSanitizer;
            expect(sanitizer).toBeDefined();
        });

        it('completely removes active executable tags (script, iframe, object)', () => {
            const maliciousHtml = '<div>Text<script>alert("xss")</script><iframe src="//evil.com"></iframe></div>';
            const cleaned = sanitizer.sanitizeNoteHtml(maliciousHtml);
            expect(cleaned).toBe('Text');
            expect(cleaned).not.toContain('script');
            expect(cleaned).not.toContain('iframe');
            expect(cleaned).not.toContain('alert');
        });

        it('strips all inline event handlers (onerror, onload, onclick, etc.)', () => {
            const dirty = '<b onclick="malicious()" onmouseover="steal()">Bold text</b>';
            const cleaned = sanitizer.sanitizeNoteHtml(dirty);
            expect(cleaned).toBe('<b>Bold text</b>');
            expect(cleaned).not.toContain('onclick');
            expect(cleaned).not.toContain('onmouseover');
        });

        it('prevents Reverse Tabnabbing by adding target="_blank" and rel="noopener noreferrer"', () => {
            const linkHtml = '<a href="https://example.com">Safe Website</a>';
            const cleaned = sanitizer.sanitizeNoteHtml(linkHtml);
            expect(cleaned).toBe('<a href="https://example.com" target="_blank" rel="noopener noreferrer">Safe Website</a>');
        });

        it('neutralizes javascript: pseudo-protocol links by unwrapping them to text', () => {
            const maliciousLink = '<a href="javascript:alert(document.domain)">Click Me</a>';
            const cleaned = sanitizer.sanitizeNoteHtml(maliciousLink);
            expect(cleaned).toBe('Click Me');
            expect(cleaned).not.toContain('javascript:');
            expect(cleaned).not.toContain('<a');
        });

        it('neutralizes data: and vbscript: links by unwrapping them to text', () => {
            const dataLink = '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Payload</a>';
            const vbLink = '<a href="vbscript:msgbox(1)">VisualBasic</a>';

            expect(sanitizer.sanitizeNoteHtml(dataLink)).toBe('Payload');
            expect(sanitizer.sanitizeNoteHtml(vbLink)).toBe('VisualBasic');
        });

        it('preserves valid safe protocols: https://, http://, mailto:, tel:', () => {
            const https = sanitizer.sanitizeNoteHtml('<a href="https://google.com">Google</a>');
            const mailto = sanitizer.sanitizeNoteHtml('<a href="mailto:user@test.com">Support</a>');
            const tel = sanitizer.sanitizeNoteHtml('<a href="tel:+123456789">Call</a>');

            expect(https).toBe('<a href="https://google.com" target="_blank" rel="noopener noreferrer">Google</a>');
            expect(mailto).toBe('<a href="mailto:user@test.com" target="_blank" rel="noopener noreferrer">Support</a>');
            expect(tel).toBe('<a href="tel:+123456789" target="_blank" rel="noopener noreferrer">Call</a>');
        });

        it('strips malicious styles and unknown attributes from links', () => {
            const linkWithStyle = '<a href="https://example.com" style="position:fixed;top:0;width:100%" class="phishing-overlay" id="attack">Link</a>';
            const cleaned = sanitizer.sanitizeNoteHtml(linkWithStyle);
            expect(cleaned).toBe('<a href="https://example.com" target="_blank" rel="noopener noreferrer">Link</a>');
            expect(cleaned).not.toContain('style');
            expect(cleaned).not.toContain('class');
            expect(cleaned).not.toContain('id');
        });
    });

    describe('JSON Backup Import Sanitization (backupManager)', () => {
        beforeEach(() => {
            window.App = window.App || {};
            window.App.state = {
                boards: [],
                notes: []
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
        });

        it('sanitizes malicious script and dangerous link payloads inside imported notes', () => {
            const maliciousBackup = JSON.stringify({
                version: 1,
                data: {
                    boards: [{ id: 'b1', name: 'Board 1' }],
                    notes: [
                        {
                            id: 'n_malicious',
                            boardId: 'b1',
                            title: 'Hacked note',
                            content: '<p>Before</p><script>alert("steal")</script><a href="javascript:exploit()">Click</a><p>After</p>'
                        }
                    ]
                }
            });

            backupManager.importJsonBackup(maliciousBackup, { mode: 'replace' });

            const imported = window.App.state.notes[0];
            expect(imported).toBeDefined();
            expect(imported.content).not.toContain('<script>');
            expect(imported.content).not.toContain('javascript:');
            expect(imported.content).toContain('Before');
            expect(imported.content).toContain('Click');
            expect(imported.content).toContain('After');
        });

        it('clamps oversized titles and board names to prevent payload bloating', () => {
            const massiveTitle = 'A'.repeat(2000);
            const massiveBoardName = 'B'.repeat(500);

            const bloatedBackup = JSON.stringify({
                version: 1,
                data: {
                    boards: [{ id: 'b_bloat', name: massiveBoardName }],
                    notes: [
                        {
                            id: 'n_bloat',
                            boardId: 'b_bloat',
                            title: massiveTitle,
                            content: 'Clean'
                        }
                    ]
                }
            });

            backupManager.importJsonBackup(bloatedBackup, { mode: 'replace' });

            const board = window.App.state.boards[0];
            const note = window.App.state.notes[0];

            expect(board.name.length).toBeLessThanOrEqual(100);
            expect(note.title.length).toBeLessThanOrEqual(500);
        });

        it('filters out malformed or unsafe image URLs in imported notes', () => {
            const backupWithImages = JSON.stringify({
                version: 1,
                data: {
                    boards: [{ id: 'b_img', name: 'Images Board' }],
                    notes: [
                        {
                            id: 'n_img',
                            boardId: 'b_img',
                            title: 'Images',
                            content: 'Note with images',
                            images: [
                                'https://supabase.co/storage/v1/object/public/notes-images/pic.webp',
                                'javascript:alert(1)',
                                'data:text/html,<script>alert(1)</script>',
                                'data:image/webp;base64,UklGR',
                                'blob:http://localhost/test-blob',
                                'img_12345_local'
                            ]
                        }
                    ]
                }
            });

            backupManager.importJsonBackup(backupWithImages, { mode: 'replace' });

            const note = window.App.state.notes[0];
            expect(note.images).toHaveLength(4);
            expect(note.images).toContain('https://supabase.co/storage/v1/object/public/notes-images/pic.webp');
            expect(note.images).toContain('data:image/webp;base64,UklGR');
            expect(note.images).toContain('blob:http://localhost/test-blob');
            expect(note.images).toContain('img_12345_local');
            expect(note.images).not.toContain('javascript:alert(1)');
            expect(note.images).not.toContain('data:text/html,<script>alert(1)</script>');
        });
    });
});
