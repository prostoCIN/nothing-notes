// js/router.js - Легковажний клієнтський Hash-роутер для NothingNotes
// Забезпечує deep-linking, роботу апаратних кнопок "Назад/Вперед" та збереження стану в URL.
window.App = window.App || {};

(function() {
    class HashRouter {
        constructor() {
            this.routes = [];
            this.isHandlingHashChange = false;
            this.lastDispatchedHash = null;
            this._onHashChange = this._onHashChange.bind(this);
        }

        /**
         * Додати маршрут
         * @param {string} pattern - Шаблон маршруту (наприклад, '/board/:boardId', '/board/:boardId/:mode')
         * @param {Function} handler - Обробник маршруту ({ params, query }) => void
         */
        add(pattern, handler) {
            const paramNames = [];
            // Перетворюємо :param у групу захоплення регулярного виразу
            const regexPattern = pattern
                .replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
                    paramNames.push(name);
                    return '([^/?]+)';
                });

            const regex = new RegExp('^#' + regexPattern + '(?:\\?(.*))?$');
            this.routes.push({ pattern, regex, paramNames, handler });
            return this;
        }

        /**
         * Отримати поточний хеш (без ведучого # або з нормалізацією)
         */
        getCurrentHash() {
            const hash = window.location.hash || '';
            return hash.startsWith('#') ? hash : ('#' + hash);
        }

        /**
         * Програмна навігація
         * @param {string} path - Шлях (наприклад, '/board/123/canvas' або '#/board/123')
         * @param {Object} [options]
         * @param {boolean} [options.replace=false] - Чи замінювати поточний запис історії
         */
        navigate(path, options = {}) {
            const normalized = path.startsWith('#') ? path : ('#' + (path.startsWith('/') ? path : '/' + path));
            if (this.getCurrentHash() === normalized) return;

            this.lastDispatchedHash = normalized;
            if (options.replace) {
                const url = window.location.pathname + window.location.search + normalized;
                window.history.replaceState(null, document.title, url);
                this._dispatch(normalized);
            } else {
                window.location.hash = normalized;
            }
        }

        /**
         * Синхронізувати поточний стан додатку в URL без повторного тригеру обробників
         */
        syncUrl(path, replace = true) {
            const normalized = path.startsWith('#') ? path : ('#' + (path.startsWith('/') ? path : '/' + path));
            if (this.getCurrentHash() === normalized) return;

            this.lastDispatchedHash = normalized;
            const url = window.location.pathname + window.location.search + normalized;
            if (replace) {
                window.history.replaceState(null, document.title, url);
            } else {
                window.history.pushState(null, document.title, url);
            }
        }

        _parseQuery(queryString) {
            const query = {};
            if (!queryString) return query;
            const pairs = queryString.split('&');
            pairs.forEach(pair => {
                const [key, val] = pair.split('=');
                if (key) {
                    query[decodeURIComponent(key)] = val ? decodeURIComponent(val) : true;
                }
            });
            return query;
        }

        _dispatch(rawHash) {
            const hash = rawHash || this.getCurrentHash();
            for (const route of this.routes) {
                const match = hash.match(route.regex);
                if (match) {
                    const params = {};
                    route.paramNames.forEach((name, i) => {
                        params[name] = decodeURIComponent(match[i + 1] || '');
                    });
                    const queryString = match[route.paramNames.length + 1] || '';
                    const query = this._parseQuery(queryString);

                    try {
                        route.handler({ params, query, hash });
                    } catch (err) {
                        console.error(`[Router] Помилка виконання обробника для "${hash}":`, err);
                    }
                    return true;
                }
            }
            return false;
        }

        _onHashChange() {
            const current = this.getCurrentHash();
            if (current === this.lastDispatchedHash) {
                this.lastDispatchedHash = null;
                return;
            }
            this._dispatch(current);
        }

        init() {
            window.addEventListener('hashchange', this._onHashChange);
            // Виконуємо перший диспатч для початкового стану
            const initialHash = this.getCurrentHash();
            if (initialHash && initialHash !== '#' && initialHash !== '#/') {
                this._dispatch(initialHash);
            }
        }

        destroy() {
            window.removeEventListener('hashchange', this._onHashChange);
        }
    }

    window.App.HashRouter = HashRouter;
    window.App.router = new HashRouter();
})();

export const HashRouter = window.App.HashRouter;
export const router = window.App.router;
