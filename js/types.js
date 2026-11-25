// js/types.js - JSDoc типізація моделей даних NothingNotes для IDE автокомпліту та перевірки типів

/**
 * @typedef {Object} Note
 * @property {string} id - Унікальний ідентифікатор нотатки (UUID)
 * @property {string} boardId - ID блокнота, якому належить нотатка
 * @property {string|null} [parentId] - ID батьківської нотатки для ієрархії колонок
 * @property {string} title - Заголовок нотатки
 * @property {string} [content] - HTML-вміст нотатки
 * @property {string} [color] - Назва кольору зі списку NOTE_COLORS (напр. 'yellow', 'blue')
 * @property {string} [icon] - Емодзі-іконка нотатки
 * @property {Array<string|{id: string, text: string}>} [tags] - Теги нотатки
 * @property {Array<string>} [linkedNoteIds] - ID нотаток для Washi-закладок (двосторонній зв'язок)
 * @property {number} [canvasX] - Положення X на нескінченній 2D-дошці (Canvas)
 * @property {number} [canvasY] - Положення Y на нескінченній 2D-дошці (Canvas)
 * @property {number} [boardX] - Дублююча координата X
 * @property {number} [boardY] - Дублююча координата Y
 * @property {number} [orderIndex] - Порядковий номер у колонці
 * @property {number} [createdAt] - Мітка часу створення (ms)
 * @property {number} [updatedAt] - Мітка часу останнього оновлення (ms)
 * @property {number|null} [deletedAt] - Мітка часу видалення для кошика/м'якого видалення
 */

/**
 * @typedef {Object} Board
 * @property {string} id - Унікальний ID блокнота
 * @property {string} name - Назва блокнота
 * @property {string} [icon] - Емодзі-іконка блокнота
 * @property {number} [order_index] - Порядковий номер у бічній панелі
 * @property {Array<string>} [tag_options] - Список збережених тегів для автокомпліту
 * @property {string} [created_at] - ISO рядок часу створення
 * @property {string} [updated_at] - ISO рядок часу оновлення
 * @property {boolean} [isReadOnly] - Чи відкритий блокнот у режимі читання (shared)
 */

/**
 * @typedef {Object} Point
 * @property {number} x - Координата X
 * @property {number} y - Координата Y
 */

/**
 * @typedef {Object} Camera
 * @property {number} x - Зсув камери по осі X
 * @property {number} y - Зсув камери по осі Y
 * @property {number} zoom - Масштаб (1.0 = 100%)
 */

/**
 * @typedef {Object} ShareInfo
 * @property {string} share_token - Унікальний токен для публічного посилання
 * @property {string} board_id - ID блокнота, яким поділилися
 * @property {string} owner_id - UUID власника
 * @property {string} [owner_email] - Email власника
 * @property {Array<string>} [note_ids] - Список ID дозволених нотаток
 */

/**
 * @typedef {Object} AppState
 * @property {Array<Board>} boards - Список блокнотів користувача
 * @property {Array<Note>} notes - Список нотаток користувача
 * @property {string|null} activeBoardId - ID поточного активного блокнота
 * @property {string|null} activeNoteId - ID поточної активної нотатки
 * @property {'columns'|'canvas'|'graph'} viewMode - Режим перегляду
 * @property {Array<Board>} [readOnlyBoards] - Список спільних блокнотів для читання
 */

export {};
