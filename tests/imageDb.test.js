import { describe, it, expect, beforeEach } from 'vitest';
import '../js/imageDb.js';

describe('ImageDb (IndexedDB local storage)', () => {
    let db;

    beforeEach(() => {
        db = window.App.imageDb;
    });

    it('should save and retrieve an image dataUrl', async () => {
        const id = 'img-test-1';
        const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

        const saved = await db.saveImage(id, dataUrl);
        expect(saved).toBe(true);

        const loaded = await db.getImage(id);
        expect(loaded).toBe(dataUrl);
    });

    it('should delete an image correctly', async () => {
        const id = 'img-test-2';
        const dataUrl = 'data:image/png;base64,abc';

        await db.saveImage(id, dataUrl);
        expect(await db.getImage(id)).toBe(dataUrl);

        await db.deleteImage(id);
        const afterDelete = await db.getImage(id);
        expect(afterDelete).toBeNull();
    });
});
