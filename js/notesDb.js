// js/notesDb.js - Локальне сховище нотаток необмеженого об'єму на базі IndexedDB
window.App = window.App || {};

(function() {
    let dbInstance = null;
    let dbPromise = null;

    const DB_NAME = 'NothingNotes_MediaDB';
    const DB_VERSION = 2; // Версія 2 додає сховище 'notes' поруч із 'images'

    const notesDb = {
        init() {
            if (dbPromise) return dbPromise;

            dbPromise = new Promise((resolve) => {
                if (typeof window === 'undefined' || !window.indexedDB) {
                    console.warn('[NotesDB] IndexedDB не підтримується.');
                    resolve(null);
                    return;
                }

                const request = window.indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('images')) {
                        db.createObjectStore('images', { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains('notes')) {
                        db.createObjectStore('notes', { keyPath: 'id' });
                    }
                };

                request.onsuccess = (e) => {
                    dbInstance = e.target.result;
                    resolve(dbInstance);
                };

                request.onerror = (e) => {
                    console.error('[NotesDB] Помилка відкриття IndexedDB:', e.target.error);
                    resolve(null);
                };
            });

            return dbPromise;
        },

        // Зберегти одну нотатку
        async saveNote(note) {
            if (!note || !note.id) return false;
            const db = await this.init();
            if (!db) return false;

            return new Promise((resolve) => {
                try {
                    const tx = db.transaction(['notes'], 'readwrite');
                    const store = tx.objectStore('notes');
                    const req = store.put(note);
                    req.onsuccess = () => resolve(true);
                    req.onerror = () => resolve(false);
                } catch (e) {
                    resolve(false);
                }
            });
        },

        // Зберегти масив нотаток в одній транзакції
        async saveAllNotes(notes) {
            if (!Array.isArray(notes) || notes.length === 0) return true;
            const db = await this.init();
            if (!db) return false;

            return new Promise((resolve) => {
                try {
                    const tx = db.transaction(['notes'], 'readwrite');
                    const store = tx.objectStore('notes');
                    notes.forEach(n => {
                        if (n && n.id) store.put(n);
                    });
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                } catch (e) {
                    resolve(false);
                }
            });
        },

        // Отримати всі нотатки з IndexedDB
        async getAllNotes() {
            const db = await this.init();
            if (!db) return [];

            return new Promise((resolve) => {
                try {
                    const tx = db.transaction(['notes'], 'readonly');
                    const store = tx.objectStore('notes');
                    const req = store.getAll();
                    req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
                    req.onerror = () => resolve([]);
                } catch (e) {
                    resolve([]);
                }
            });
        },

        // Видалити нотатку за ID
        async deleteNote(id) {
            if (!id) return false;
            const db = await this.init();
            if (!db) return false;

            return new Promise((resolve) => {
                try {
                    const tx = db.transaction(['notes'], 'readwrite');
                    const store = tx.objectStore('notes');
                    const req = store.delete(id);
                    req.onsuccess = () => resolve(true);
                    req.onerror = () => resolve(false);
                } catch (e) {
                    resolve(false);
                }
            });
        },

        // Видалити всі нотатки (при виході або скиданні)
        async clearAllNotes() {
            const db = await this.init();
            if (!db) return false;

            return new Promise((resolve) => {
                try {
                    const tx = db.transaction(['notes'], 'readwrite');
                    const store = tx.objectStore('notes');
                    const req = store.clear();
                    req.onsuccess = () => resolve(true);
                    req.onerror = () => resolve(false);
                } catch (e) {
                    resolve(false);
                }
            });
        },

        // Гідратація контенту: об'єднує нотатки з пам'яті з IndexedDB
        async hydrateNotes(stateNotes) {
            if (!Array.isArray(stateNotes) || stateNotes.length === 0) return stateNotes;
            const dbNotes = await this.getAllNotes();
            if (!dbNotes || dbNotes.length === 0) {
                // Якщо в IndexedDB ще нічого немає — тихо мігруємо всі поточні нотатки туди
                this.saveAllNotes(stateNotes);
                return stateNotes;
            }

            const dbMap = new Map(dbNotes.map(n => [n.id, n]));
            let hasHydrated = false;

            stateNotes.forEach(localNote => {
                const idbNote = dbMap.get(localNote.id);
                if (idbNote && typeof idbNote.content === 'string') {
                    if (localNote.content === undefined || localNote.content === '' || (idbNote.updatedAt && idbNote.updatedAt > (localNote.updatedAt || 0))) {
                        localNote.content = idbNote.content;
                        hasHydrated = true;
                    }
                }
            });

            return stateNotes;
        }
    };

    window.App.notesDb = notesDb;
    return notesDb;
})();

export const notesDb = window.App.notesDb;
