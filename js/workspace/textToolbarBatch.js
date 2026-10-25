// js/workspace/textToolbarBatch.js - Масове форматування однакових слів у всій нотатці
window.App = window.App || {};

(function() {
    function getActiveDiv(ctx) {
        if (ctx && typeof ctx.getActiveContentDiv === 'function') {
            return ctx.getActiveContentDiv();
        }
        if (window.App && window.App.textSelectionToolbar && typeof window.App.textSelectionToolbar.getActiveContentDiv === 'function') {
            return window.App.textSelectionToolbar.getActiveContentDiv();
        }
        return null;
    }

    window.App.textToolbarBatch = {
        // Застосування маркера до ВСІХ однакових слів у цій нотатці
        applyMarkerToAllOccurrences(targetText, markerClass) {
            const activeContentDiv = getActiveDiv(this);
            if (!targetText || !activeContentDiv) return;

            if (window.App.historyManager) {
                window.App.historyManager.recordState('highlight_all_occurrences');
            }

            const targetLower = targetText.toLowerCase();

            // 1. Оновлюємо або очищаємо існуючі <mark>, якщо вони містять або збігаються з цим словом
            activeContentDiv.querySelectorAll('mark.note-marker').forEach(mark => {
                const text = mark.textContent.trim();
                if (text.toLowerCase() === targetLower) {
                    mark.className = `note-marker ${markerClass}`;
                } else if (text.toLowerCase().includes(targetLower)) {
                    // Якщо mark містить більше тексту, розгортаємо його
                    const parent = mark.parentNode;
                    if (parent) {
                        while (mark.firstChild) {
                            parent.insertBefore(mark.firstChild, mark);
                        }
                        parent.removeChild(mark);
                    }
                }
            });

            activeContentDiv.normalize();

            // 2. Обходимо всі текстові вузли
            const walker = document.createTreeWalker(activeContentDiv, NodeFilter.SHOW_TEXT, null);
            const textNodes = [];
            let curr = walker.nextNode();
            while (curr) {
                textNodes.push(curr);
                curr = walker.nextNode();
            }

            textNodes.forEach(node => {
                const fullText = node.nodeValue;
                if (!fullText || !fullText.toLowerCase().includes(targetLower)) return;

                // Якщо цей вузол вже всередині <mark> з цим класом — пропускаємо
                const existingMark = node.parentElement && node.parentElement.closest('mark');
                if (existingMark && existingMark.classList.contains(markerClass)) {
                    return;
                }

                const parent = node.parentNode;
                if (!parent) return;

                const regex = new RegExp(`(${targetText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                const parts = fullText.split(regex);
                const fragment = document.createDocumentFragment();

                parts.forEach(part => {
                    if (part.toLowerCase() === targetLower) {
                        const mark = document.createElement('mark');
                        mark.className = `note-marker ${markerClass}`;
                        mark.textContent = part;
                        fragment.appendChild(mark);
                    } else if (part.length > 0) {
                        fragment.appendChild(document.createTextNode(part));
                    }
                });

                parent.replaceChild(fragment, node);
            });

            this.syncChanges();
        },

        // Зняття маркера з усіх однакових слів у нотатці
        clearMarkerFromAllOccurrences(targetText) {
            const activeContentDiv = getActiveDiv(this);
            if (!targetText || !activeContentDiv) return;

            if (window.App.historyManager) {
                window.App.historyManager.recordState('clear_all_occurrences');
            }

            const targetLower = targetText.toLowerCase();
            activeContentDiv.querySelectorAll('mark.note-marker').forEach(mark => {
                const text = mark.textContent.trim().toLowerCase();
                if (text === targetLower || text.includes(targetLower)) {
                    const parent = mark.parentNode;
                    if (parent) {
                        while (mark.firstChild) {
                            parent.insertBefore(mark.firstChild, mark);
                        }
                        parent.removeChild(mark);
                    }
                }
            });

            this.syncChanges();
        },

        // Застосування розміру шрифту до ВСІХ однакових слів у нотатці
        applyFontSizeToAllOccurrences(targetText, fontSizeStr) {
            const activeContentDiv = getActiveDiv(this);
            if (!targetText || !activeContentDiv) return;

            if (window.App.historyManager) {
                window.App.historyManager.recordState('fontsize_all_occurrences');
            }

            const targetLower = targetText.toLowerCase();

            // Оновлюємо існуючі span
            activeContentDiv.querySelectorAll('span[style*="font-size"]').forEach(sp => {
                const text = sp.textContent.trim().toLowerCase();
                if (text === targetLower) {
                    sp.style.fontSize = fontSizeStr;
                } else if (text.includes(targetLower)) {
                    const parent = sp.parentNode;
                    if (parent) {
                        while (sp.firstChild) {
                            parent.insertBefore(sp.firstChild, sp);
                        }
                        parent.removeChild(sp);
                    }
                }
            });

            activeContentDiv.normalize();

            const walker = document.createTreeWalker(activeContentDiv, NodeFilter.SHOW_TEXT, null);
            const textNodes = [];
            let curr = walker.nextNode();
            while (curr) {
                textNodes.push(curr);
                curr = walker.nextNode();
            }

            textNodes.forEach(node => {
                const fullText = node.nodeValue;
                if (!fullText || !fullText.toLowerCase().includes(targetLower)) return;

                const existingSpan = node.parentElement && node.parentElement.closest('span[style*="font-size"]');
                if (existingSpan && existingSpan.style.fontSize === fontSizeStr) {
                    return;
                }

                const parent = node.parentNode;
                if (!parent) return;

                const regex = new RegExp(`(${targetText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                const parts = fullText.split(regex);
                const fragment = document.createDocumentFragment();

                parts.forEach(part => {
                    if (part.toLowerCase() === targetLower) {
                        const span = document.createElement('span');
                        span.style.fontSize = fontSizeStr;
                        span.textContent = part;
                        fragment.appendChild(span);
                    } else if (part.length > 0) {
                        fragment.appendChild(document.createTextNode(part));
                    }
                });

                parent.replaceChild(fragment, node);
            });

            this.syncChanges();
        },

        // Застосування Regular / Bold до ВСІХ однакових слів у нотатці
        applyFontWeightToAllOccurrences(targetText, weight) {
            const activeContentDiv = getActiveDiv(this);
            if (!targetText || !activeContentDiv) return;

            if (window.App.historyManager) {
                window.App.historyManager.recordState('fontweight_all_occurrences');
            }

            const targetLower = targetText.toLowerCase();

            if (weight === 'normal') {
                activeContentDiv.querySelectorAll('b, strong').forEach(bTag => {
                    const text = bTag.textContent.trim().toLowerCase();
                    if (text === targetLower || text.includes(targetLower)) {
                        const parent = bTag.parentNode;
                        if (parent) {
                            while (bTag.firstChild) {
                                parent.insertBefore(bTag.firstChild, bTag);
                            }
                            parent.removeChild(bTag);
                        }
                    }
                });
                this.syncChanges();
                return;
            }

            activeContentDiv.normalize();

            const walker = document.createTreeWalker(activeContentDiv, NodeFilter.SHOW_TEXT, null);
            const textNodes = [];
            let curr = walker.nextNode();
            while (curr) {
                textNodes.push(curr);
                curr = walker.nextNode();
            }

            textNodes.forEach(node => {
                const fullText = node.nodeValue;
                if (!fullText || !fullText.toLowerCase().includes(targetLower)) return;

                if (node.parentElement && node.parentElement.closest('b, strong')) {
                    return;
                }

                const parent = node.parentNode;
                if (!parent) return;

                const regex = new RegExp(`(${targetText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                const parts = fullText.split(regex);
                const fragment = document.createDocumentFragment();

                parts.forEach(part => {
                    if (part.toLowerCase() === targetLower) {
                        const b = document.createElement('b');
                        b.textContent = part;
                        fragment.appendChild(b);
                    } else if (part.length > 0) {
                        fragment.appendChild(document.createTextNode(part));
                    }
                });

                parent.replaceChild(fragment, node);
            });

            this.syncChanges();
        },

        // Скидання ВСЬОГО форматування для всіх однакових слів у нотатці
        resetAllFormattingFromAllOccurrences(targetText) {
            const activeContentDiv = getActiveDiv(this);
            if (!targetText || !activeContentDiv) return;

            if (window.App.historyManager) {
                window.App.historyManager.recordState('reset_all_occurrences');
            }

            // 1. Знімаємо маркери
            this.clearMarkerFromAllOccurrences(targetText);

            // 2. Знімаємо span, b, strong, font
            const targetLower = targetText.toLowerCase();
            activeContentDiv.querySelectorAll('span, b, strong, i, em, font').forEach(el => {
                const text = el.textContent.trim().toLowerCase();
                if (text === targetLower || text.includes(targetLower)) {
                    const parent = el.parentNode;
                    if (parent) {
                        while (el.firstChild) {
                            parent.insertBefore(el.firstChild, el);
                        }
                        parent.removeChild(el);
                    }
                }
            });

            this.syncChanges();
        },

        // Автоочищення порожніх тегів та синхронізація
    };
})();
