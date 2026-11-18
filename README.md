# NothingNotes 📝

> Мінімалістичний, надшвидкий персональний простір для думок, ідей та нотаток без фреймворкового оверхеду.

[![Deploy to GitHub Pages](https://github.com/cinlo/minimal-notes/actions/workflows/deploy.yml/badge.svg)](https://github.com/cinlo/minimal-notes/actions/workflows/deploy.yml)
[![Keep Supabase Alive](https://github.com/cinlo/minimal-notes/actions/workflows/keep-supabase-alive.yml/badge.svg)](https://github.com/cinlo/minimal-notes/actions/workflows/keep-supabase-alive.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)

---

## 💡 Основна ідея

**NothingNotes** поєднує три підходи до управління знаннями (Personal Knowledge Management):
1. **Каскадні колонки Міллера (Miller Columns / Andy Matuschak Mode)** — нескінченне горизонтальне розгортання вкладених думок без втрати контексту.
2. **Інтерактивна 2D-дошка (Canvas Sticky Board)** — нескінченне полотно зі стікерами, навігацією pan/zoom та з'єднувальними кабелями на кривих Безьє.
3. **Граф зв'язків (Obsidian-like Force Graph)** — фізична симуляція зв'язків між нотатками за законами Кулона та Гука.

Додаток побудований за принципом **Offline-First**: усі дані повністю зберігаються локально (LocalStorage + IndexedDB для медіафайлів), а хмара Supabase забезпечує миттєву фонову синхронізацію та спільний доступ.

---

## 🚀 Ключові можливості

* ⚡ **Zero-Frameworks (Чистий Vanilla JS + Vite)**: Миттєвий старт, наднизьке споживання оперативної пам'яті, 60+ FPS.
* 📦 **PWA & Офлайн**: Повноцінний Service Worker, кешування та підтримка автономної роботи.
* 🛡️ **Захист від зомбі-нотаток**: Вбудований кеш видалених ідентифікаторів (Tombstones), що запобігає відновленню видалених нотаток під час відновлення інтернет-з'єднання.
* ⏪ **Розумний Undo/Redo**: Ізольований для кожного окремого блокнота Memento-стек із дедуплікацією знімків та Smart Delta Diff.
* 🧭 **Deep Linking & Клієнтський Роутер**: Повноцінна історія переходів (`#/board/:id`, `#/board/:id/canvas`, `#/board/:id/graph`, `#/share/:token`), підтримка кнопок «Назад» і «Вперед» у браузері.
* 🎨 **Washi Tape & Маркери**: Стікери, японські клейкі стрічки, текстові маркери та гумка для виділення думок.
* 👥 **Мультиакаунтність**: Швидке перемикання між різними обліковими записами без втрати локальних даних.
* 🌐 **Двомовність**: Повна підтримка української та англійської мов (UA / EN).

---

## 🛠️ Стек технологій

* **Збірка**: [Vite 6](https://vitejs.dev/)
* **Ядро**: Vanilla JavaScript (ES2022 Modules), Canvas API, IndexedDB API, Service Worker API
* **Хмарний бекенд**: [Supabase](https://supabase.com/) (PostgreSQL, Auth, Realtime, Storage)
* **Безпека**: [DOMPurify](https://github.com/cure53/DOMPurify) (санітизація Markdown та HTML)
* **Тестування**: [Vitest](https://vitest.dev/), JSDOM, Fake-IndexedDB
* **Стилізація**: Vanilla CSS3, CSS Custom Properties, Glassmorphism

---

## 📦 Встановлення та запуск

### 1. Клонування репозиторію
```bash
git clone https://github.com/cinlo/minimal-notes.git
cd minimal-notes
```

### 2. Встановлення залежностей
```bash
npm install
```

### 3. Налаштування змінних оточення
Створіть файл `.env.local` на основі `.env.example`:
```bash
cp .env.example .env.local
```
Вкажіть ваші ключі Supabase:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Запуск у режимі розробки
```bash
npm run dev
```

### 5. Запуск тестів
```bash
npm test
```

### 6. Збірка для production
```bash
npm run build
```

---

## 🏛️ Архітектура проєкту

```
minimal-notes/
├── css/                  # Модульні таблиці стилів (теми, сайдбар, колонки, дошка, граф)
├── js/                   # Ядро та модулі логіки додатку
│   ├── board/            # Модуль 2D Canvas (кабелі, зум, розкладка, контекстне меню)
│   ├── graph/            # Фізична симуляція та рендеринг графа зв'язків
│   ├── i18n/             # Локалізація (en.js, ua.js)
│   ├── settings/         # Модальне вікно налаштувань, кастомні кольори та теми
│   ├── share/            # Модулі спільного доступу та шерингу
│   ├── sidebar/          # Деревоподібний сайдбар, drag-and-drop, resizer
│   ├── sync/             # Офлайн-черга, tombstones, Supabase realtime
│   ├── workspace/        # Картки, маркери, колонки Міллера, виділення рамкою
│   ├── eventBus.js       # Центральна шина подій (Publish/Subscribe)
│   ├── historyManager.js # Ізольована історія дій (Undo/Redo)
│   ├── imageDb.js        # IndexedDB сховище зображень
│   ├── router.js         # Клієнтський Hash-роутер (Deep linking)
│   ├── state.js          # Глобальний стан додатку
│   ├── app.js            # Головний оркестратор
│   └── main.js           # Точка входу Vite
├── public/               # Маніфест PWA, сервіс-воркер, іконки
├── tests/                # Автоматизовані модульні тести (Vitest)
└── index.html            # Головний HTML-каркас
```

---

## 📄 Ліцензія

Розповсюджується під ліцензією MIT. Деталі у файлі [LICENSE](LICENSE).
