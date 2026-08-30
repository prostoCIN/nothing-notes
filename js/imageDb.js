// js/imageDb.js - Локальне сховище фотографій необмеженого об'єму на базі рідного браузерного IndexedDB
window.App = window.App || {};

window.App.imageDb = {
    _db: null,
    _dbPromise: null,

    init() {
        if (this._dbPromise) return this._dbPromise;

        this._dbPromise = new Promise((resolve) => {
            if (!window.indexedDB) {
                console.warn('IndexedDB не підтримується цим браузером.');
                resolve(null);
                return;
            }

            const request = indexedDB.open('NothingNotes_MediaDB', 1);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('images')) {
                    db.createObjectStore('images', { keyPath: 'id' });
                }
            };

            request.onsuccess = (e) => {
                this._db = e.target.result;
                resolve(this._db);
            };

            request.onerror = (e) => {
                console.error('Помилка відкриття IndexedDB:', e.target.error);
                resolve(null);
            };
        });

        return this._dbPromise;
    },

    // Зберегти фотографію у базі IndexedDB
    async saveImage(id, dataUrl) {
        const db = await this.init();
        if (!db) return false;

        return new Promise((resolve) => {
            try {
                const transaction = db.transaction(['images'], 'readwrite');
                const store = transaction.objectStore('images');
                const request = store.put({ id: id, dataUrl: dataUrl, updatedAt: Date.now() });

                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
            } catch (e) {
                console.error('Помилка запису в IndexedDB:', e);
                resolve(false);
            }
        });
    },

    // Отримати фотографію за ID
    async getImage(id) {
        const db = await this.init();
        if (!db) return null;

        return new Promise((resolve) => {
            try {
                const transaction = db.transaction(['images'], 'readonly');
                const store = transaction.objectStore('images');
                const request = store.get(id);

                request.onsuccess = () => {
                    resolve(request.result ? request.result.dataUrl : null);
                };
                request.onerror = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        });
    },

    // Видалити фотографію за ID
    async deleteImage(id) {
        const db = await this.init();
        if (!db) return false;

        return new Promise((resolve) => {
            try {
                const transaction = db.transaction(['images'], 'readwrite');
                const store = transaction.objectStore('images');
                const request = store.delete(id);

                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
            } catch (e) {
                resolve(false);
            }
        });
    }
};
