// js/main.js - Єдина модульна точка входу додатку для Vite
import '../styles.css';

// Бібліотеки (замінюють зовнішні CDN на надійні npm-пакети)
import { createClient } from '@supabase/supabase-js';
import DOMPurify from 'dompurify';

window.supabase = window.supabase || { createClient };
window.DOMPurify = window.DOMPurify || DOMPurify;

// 1. Базові модулі ядра та стану
import './dom.js';
import './eventBus.js';
import './imageDb.js';
import './state.js';
import './historyManager.js';
import './confirmModal.js';
import './boardManager.js';
import './noteManager.js';
import './stickerDrag.js';
import './welcomeView.js';
import './emojiData.js';

// 2. Модулі лівої бічної панелі (Sidebar)
import './sidebar/sidebarSelection.js';
import './sidebar/sidebarDragDrop.js';
import './sidebar/sidebarTree.js';
import './sidebar/sidebarBoards.js';
import './sidebarView.js';

// 3. Модулі робочої області та стікерів (Workspace)
import './workspace/emojiPicker.js';
import './workspace/stickerGallery.js';
import './workspace/stickerMenu.js';
import './workspace/stickerTags.js';
import './workspace/stickerHeader.js';
import './workspace/stickerContent.js';
import './workspace/stickerSubnotes.js';
import './workspace/columnMenu.js';
import './workspace/columnFilter.js';
import './workspace/workspaceSelectionActions.js';
import './workspace/workspaceSelectionBar.js';
import './workspace/textSelectionToolbar.js';
import './workspace/brushTool.js';
import './workspace/eraserTool.js';
import './workspace/workspaceSearch.js';
import './workspace/stickerCard.js';
import './workspace/workspaceColumn.js';
import './workspace/workspacePagination.js';
import './workspaceView.js';
import './graphView.js';

// 4. Модулі хмари, аутентифікації та налаштувань
import './supabaseClient.js';
import './cloudSync.js';
import './shareManager.js';
import './authModal.js';
import './settingsModal.js';

// 5. Головний оркестратор та ініціалізація додатку
import './app.js';
