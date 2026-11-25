// tests/contentSlimmingAndWebp.test.js - Unit tests for Content Slimming & WebP Compression
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import '../js/workspace/stickerPasteSanitizer.js';
import '../js/workspace/stickerGallery.js';
import '../js/sync/syncStorage.js';
import '../js/cloudSync.js';

describe('Content Slimming (HTML Trimming & Sanitization)', () => {
    let sanitizer;

    beforeEach(() => {
        sanitizer = window.App?.stickerPasteSanitizer;
        expect(sanitizer).toBeDefined();
    });

    it('trimEmptyHtml strips trailing and leading <br> and &nbsp;', () => {
        const dirty = '<br><br>&nbsp; Hello world! &nbsp;<br><br><br>';
        const cleaned = sanitizer.trimEmptyHtml(dirty);
        expect(cleaned).toBe('Hello world!');
    });

    it('trimEmptyHtml collapses 3 or more consecutive <br> tags to double <br>', () => {
        const dirty = 'Paragraph 1<br><br><br><br><br>Paragraph 2';
        const cleaned = sanitizer.trimEmptyHtml(dirty);
        expect(cleaned).toBe('Paragraph 1<br><br>Paragraph 2');
    });

    it('trimEmptyHtml returns empty string if text has only whitespace and <br>', () => {
        expect(sanitizer.trimEmptyHtml('<br><br>&nbsp;   <br>')).toBe('');
        expect(sanitizer.trimEmptyHtml('   ')).toBe('');
        expect(sanitizer.trimEmptyHtml('<p><br></p>')).toBe('');
    });

    it('sanitizeNoteHtml integrates content slimming and preserves markers and bold tags', () => {
        const dirty = '<br><br><b>Important:</b> <mark class="note-marker hl-yellow">Urgent task</mark><br><br><br>';
        const cleaned = sanitizer.sanitizeNoteHtml(dirty);
        expect(cleaned).toBe('<b>Important:</b> <mark class="note-marker hl-yellow">Urgent task</mark>');
    });
});

describe('WebP Image Compression & Direct Compressed Upload', () => {
    let mockSupabase;
    let mockUser;

    beforeEach(() => {
        mockUser = { id: 'user_webp_test_456' };

        mockSupabase = {
            storage: {
                from: vi.fn().mockReturnValue({
                    upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
                    getPublicUrl: vi.fn((path) => ({ data: { publicUrl: `https://storage.supabase.co/${path}` } }))
                })
            }
        };

        window.App = window.App || {};
        window.App.supabase = mockSupabase;
        window.App.cloudSync = window.App.cloudSync || {};
        window.App.cloudSync.getCurrentUser = () => mockUser;
        window.App.cloudSync.currentUser = mockUser;
        window.App.cloudSync.isLoggedIn = () => true;
    });

    it('uploadBase64Image detects WebP mime type and sets .webp extension with correct Content-Type', async () => {
        // Sample 1x1 WebP base64
        const webpBase64 = 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoAAP7/2QAA';
        const imgId = 'img_webp_sample_123';

        const publicUrl = await window.App.syncStorage.uploadBase64Image(webpBase64, imgId);
        expect(publicUrl).toBeDefined();

        const bucket = mockSupabase.storage.from('note-images');
        expect(bucket.upload).toHaveBeenCalledWith(
            `${mockUser.id}/${imgId}.webp`,
            expect.any(Object),
            expect.objectContaining({
                contentType: 'image/webp',
                upsert: true
            })
        );
    });

    it('cloudSync.uploadBase64Image delegates cleanly to syncStorage.uploadBase64Image', async () => {
        const spy = vi.spyOn(window.App.syncStorage, 'uploadBase64Image').mockResolvedValue('https://storage.supabase.co/delegated.webp');

        const res = await window.App.cloudSync.uploadBase64Image('data:image/webp;base64,...', 'img_delegated');
        expect(spy).toHaveBeenCalledWith('data:image/webp;base64,...', 'img_delegated');
        expect(res).toBe('https://storage.supabase.co/delegated.webp');
    });
});
