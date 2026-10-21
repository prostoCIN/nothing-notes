// js/graph/graphPreview.js - Картка швидкого прев'ю вмісту нотатки при наведенні
window.App = window.App || {};

(function() {
    let previewEl = null;
    let previewTimeout = null;

    window.App.graphPreview = {
        init(container) {
            if (!container) return;
            previewEl = container.querySelector('#graph-preview-card');
            if (!previewEl) {
                previewEl = document.createElement('div');
                previewEl.id = 'graph-preview-card';
                previewEl.className = 'graph-preview-card';
                container.appendChild(previewEl);
            }
        },

        show(node, screenX, screenY) {
            if (!previewEl || !node || !node.note) return;

            clearTimeout(previewTimeout);

            const title = node.title || 'Без назви';
            const icon = node.note.icon || '📄';
            const plainContent = (node.content || '').replace(/<[^>]*>/g, '').trim() || 'Порожня нотатка';

            let tagsHtml = '';
            if (node.tags && node.tags.length > 0) {
                tagsHtml = node.tags.map(t => {
                    const text = typeof t === 'string' ? t : (t.text || '');
                    return `<span style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-size:10px;">#${text}</span>`;
                }).join(' ');
            }

            previewEl.innerHTML = `
                <div class="graph-preview-header">
                    <span class="graph-preview-emoji">${icon}</span>
                    <span class="graph-preview-title">${title}</span>
                </div>
                <div class="graph-preview-body">${plainContent}</div>
                <div class="graph-preview-footer">
                    <div>${tagsHtml}</div>
                    <span>Клікніть, щоб відкрити</span>
                </div>
            `;

            previewEl.style.left = Math.min(window.innerWidth - 310, screenX + 16) + 'px';
            previewEl.style.top = Math.min(window.innerHeight - 200, screenY + 16) + 'px';
            previewEl.classList.add('active');
        },

        hide() {
            if (previewEl) {
                previewEl.classList.remove('active');
            }
        }
    };
})();
