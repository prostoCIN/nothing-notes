// js/eventBus.js - Легковажна глобальна шина подій (Publish/Subscribe) для відв'язування модулів
window.App = window.App || {};

(function() {
    const listeners = new Map();

    const eventBus = {
        /**
         * Підписатися на подію
         * @param {string} event - Назва події
         * @param {Function} handler - Функція-обробник
         * @returns {Function} Функція для легкого скасування підписки
         */
        on(event, handler) {
            if (typeof handler !== 'function') return () => {};
            if (!listeners.has(event)) {
                listeners.set(event, new Set());
            }
            listeners.get(event).add(handler);

            return () => this.off(event, handler);
        },

        /**
         * Одноразова підписка на подію
         * @param {string} event - Назва події
         * @param {Function} handler - Функція-обробник
         */
        once(event, handler) {
            if (typeof handler !== 'function') return () => {};
            const wrapper = (data) => {
                this.off(event, wrapper);
                handler(data);
            };
            return this.on(event, wrapper);
        },

        /**
         * Скасувати підписку
         * @param {string} event - Назва події
         * @param {Function} handler - Функція-обробник для видалення
         */
        off(event, handler) {
            if (!listeners.has(event)) return;
            const handlers = listeners.get(event);
            handlers.delete(handler);
            if (handlers.size === 0) {
                listeners.delete(event);
            }
        },

        /**
         * Відправити подію всім підписникам
         * @param {string} event - Назва події
         * @param {any} [data] - Дані події
         */
        emit(event, data) {
            if (!listeners.has(event)) return;
            const handlers = listeners.get(event);
            // Копіюємо слухачів на випадок якщо під час виконання хтось відпишеться/додасть нового
            const copy = Array.from(handlers);
            copy.forEach(handler => {
                try {
                    handler(data);
                } catch (err) {
                    console.error(`[EventBus] Помилка в обробнику події "${event}":`, err);
                }
            });
        },

        /**
         * Очистити всіх слухачів для події або повністю всю шину
         * @param {string} [event] - Якщо передано, очищає тільки для цієї події
         */
        clear(event) {
            if (event) {
                listeners.delete(event);
            } else {
                listeners.clear();
            }
        }
    };

    window.App.events = eventBus;
    window.App.eventBus = eventBus;
})();
