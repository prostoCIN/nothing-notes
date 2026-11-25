// tests/imageStorageSafety.test.js - Unit tests for image storage protection, upload rescue, and offline fallback
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import '../js/sync/syncStorage.js';
import '../js/cloudSync.js';
import '../js/workspace/stickerGallery.js';

describe('Image Storage Safety & Rescue', () => {
    let mockSupabase;
    let mockUser;
    let mockImageDb;

    beforeEach(() => {
        mockUser = { id: 'user_img_test_123', email: 'test@example.com' };

        mockImageDb = {
            _store: new Map(),
            init: vi.fn().mockResolvedValue(true),
            saveImage: vi.fn(async (id, dataUrl) => {
                mockImageDb._store.set(id, dataUrl);
                return true;
            }),
            getImage: vi.fn(async (id) => {
                return mockImageDb._store.get(id) || null;
            }),
            deleteImage: vi.fn(async (id) => {
                mockImageDb._store.delete(id);
                return true;
            }),
            clearAll: vi.fn(async () => {
                mockImageDb._store.clear();
                return true;
            })
        };

        mockSupabase = {
            storage: {
                from: vi.fn().mockReturnValue({
                    list: vi.fn().mockResolvedValue({ data: [], error: null }),
                    upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
                    remove: vi.fn().mockResolvedValue({ data: {}, error: null }),
                    getPublicUrl: vi.fn((path) => ({ data: { publicUrl: `https://storage.supabase.co/${path}` } }))
                })
            }
        };

        window.App = window.App || {};
        window.App.supabase = mockSupabase;
        window.App.imageDb = mockImageDb;
        window.App.state = {
            notes: [],
            readOnlyNotes: [],
            boards: [{ id: 'b1', name: 'Board 1' }]
        };
        window.App.cloudSync = {
            getCurrentUser: () => mockUser,
            currentUser: mockUser,
            isLoggedIn: () => true
        };
        window.App.syncNotes = {
            _pushNoteToCloud: vi.fn().mockResolvedValue(true)
        };
        window.App.storage = {
            saveNotes: vi.fn()
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('cleanupOrphanedImages NEVER removes images if state.notes is empty or loading', async () => {
        window.App.state.notes = [];

        await window.App.syncStorage.cleanupOrphanedImages();

        // Must not call list or remove
        const bucket = mockSupabase.storage.from('note-images');
        expect(bucket.remove).not.toHaveBeenCalled();
    });

    it('cleanupOrphanedImages protects images from active notes and read-only notes', async () => {
        window.App.state.notes = [
            { id: 'n1', images: [{ id: 'img_active_1' }] }
        ];
        window.App.state.readOnlyNotes = [
            { id: 'shared_n1', images: [{ id: 'img_shared_1' }] }
        ];

        const bucket = mockSupabase.storage.from('note-images');
        bucket.list.mockResolvedValue({
            data: [
                { name: 'img_active_1.jpg', created_at: new Date(Date.now() - 10 * 86400000).toISOString() },
                { name: 'img_shared_1.png', created_at: new Date(Date.now() - 10 * 86400000).toISOString() }
            ],
            error: null
        });

        await window.App.syncStorage.cleanupOrphanedImages();

        expect(bucket.remove).not.toHaveBeenCalled();
    });

    it('cleanupOrphanedImages enforces 7-day grace period for unlinked files', async () => {
        window.App.state.notes = [
            { id: 'n1', images: [] }
        ];

        const now = Date.now();
        const twoDaysAgo = new Date(now - 2 * 86400000).toISOString();
        const tenDaysAgo = new Date(now - 10 * 86400000).toISOString();

        const bucket = mockSupabase.storage.from('note-images');
        bucket.list.mockResolvedValue({
            data: [
                { name: 'fresh_unlinked_img.jpg', created_at: twoDaysAgo },
                { name: 'old_orphaned_img.jpg', created_at: tenDaysAgo }
            ],
            error: null
        });

        await window.App.syncStorage.cleanupOrphanedImages();

        // Should ONLY remove the file older than 7 days!
        expect(bucket.remove).toHaveBeenCalledWith([
            `${mockUser.id}/old_orphaned_img.jpg`
        ]);
        expect(bucket.remove).not.toHaveBeenCalledWith(
            expect.arrayContaining([`${mockUser.id}/fresh_unlinked_img.jpg`])
        );
    });

    it('uploadMissingLocalImages rescues images that exist only in IndexedDB', async () => {
        const testImgId = 'img_local_rescue_777';
        const testBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

        mockImageDb._store.set(testImgId, testBase64);

        window.App.state.notes = [
            {
                id: 'n_rescue',
                images: [{ id: testImgId, size: 'm' }] // No url!
            }
        ];

        // Mock uploadBase64Image
        vi.spyOn(window.App.syncStorage, 'uploadBase64Image').mockResolvedValue('https://storage.supabase.co/uploaded_rescue.jpg');

        await window.App.syncStorage.uploadMissingLocalImages();

        expect(window.App.syncStorage.uploadBase64Image).toHaveBeenCalledWith(testBase64, testImgId);
        expect(window.App.state.notes[0].images[0].url).toBe('https://storage.supabase.co/uploaded_rescue.jpg');
        expect(window.App.syncNotes._pushNoteToCloud).toHaveBeenCalledWith(window.App.state.notes[0]);
    });

    it('stickerGallery createGallery attaches offline IndexedDB fallback on error', async () => {
        const testImgId = 'img_fallback_999';
        mockImageDb._store.set(testImgId, 'data:image/jpeg;base64,fallback_data');

        const note = {
            id: 'n_gallery',
            images: [{ id: testImgId, url: 'https://cdn.example.com/broken.jpg', size: 'm' }]
        };
        const card = document.createElement('div');

        const gallery = window.App.stickerGallery.createGallery(note, card, false);
        const imgEl = gallery.querySelector('.sticker-embedded-img');
        expect(imgEl).toBeDefined();

        // Trigger error event
        imgEl.dispatchEvent(new Event('error'));

        // Allow microtasks
        await new Promise(r => setTimeout(r, 10));

        expect(mockImageDb.getImage).toHaveBeenCalledWith(testImgId);
        expect(imgEl.src).toContain('fallback_data');
    });
});
