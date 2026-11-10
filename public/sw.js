// Service Worker для NothingNotes PWA (Автономний режим та офлайн-робота)
const CACHE_NAME = 'nothing-notes-v21';

const STATIC_PRECACHE = [
    './',
    './index.html',
    './manifest.webmanifest',
    './img/Logo.svg',
    './img/pwa-192x192.png',
    './img/pwa-512x512.png',
    './img/apple-touch-icon.png'
];

// Встановлення: попереднє кешування базової оболонки додатку
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_PRECACHE);
        }).then(() => self.skipWaiting())
    );
});

// Активація: очищення старих версій кешу
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Обробка мережевих запитів (Network-First для коду, Cache-Fallback для офлайну)
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Ігноруємо POST/PUT/DELETE або виклики Supabase API (синхронізація має власну чергу офлайн-дій)
    if (request.method !== 'GET' || url.hostname.includes('supabase.co')) {
        return;
    }

    // Для статичних файлів та сторінок: Network-first зі збереженням у кеш
    event.respondWith(
        fetch(request)
            .then((networkResponse) => {
                // Якщо отримано валідну відповідь, оновлюємо кеш у фоні
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // Якщо немає інтернету — повертаємо версію з кешу
                return caches.match(request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Якщо запит на навігацію сторінки (HTML), повертаємо корінь
                    if (request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});
