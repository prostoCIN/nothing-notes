// js/graph/graphExport.js - Мультиформатний експорт графа для ШІ та візуалізації
window.App = window.App || {};

(function() {
    let modalEl = null;

    window.App.graphExport = {
        show(nodes, edges, currentBoard) {
            this.close();

            const boardName = (currentBoard ? currentBoard.name : 'Граф').trim();

            modalEl = document.createElement('div');
            modalEl.className = 'graph-export-modal-backdrop';

            const mermaidCode = this.generateMermaid(nodes, edges);
            const jsonCode = this.generateJSON(nodes, edges, currentBoard);
            const markdownCode = this.generateMarkdown(nodes, edges);

            modalEl.innerHTML = `
                <div class="graph-export-modal">
                    <div class="graph-export-modal-header">
                        <div class="graph-export-modal-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            <span>Експорт графу нотаток «${boardName}»</span>
                        </div>
                        <button class="graph-export-close-btn" id="graph-export-close">✕</button>
                    </div>

                    <div class="graph-export-tabs">
                        <button class="graph-export-tab active" data-tab="mermaid">📊 Mermaid.js</button>
                        <button class="graph-export-tab" data-tab="json">🤖 JSON для ШІ</button>
                        <button class="graph-export-tab" data-tab="markdown">📝 Markdown Mindmap</button>
                    </div>

                    <div class="graph-export-content">
                        <div class="graph-export-code-block" id="export-block-mermaid">
                            <pre class="graph-export-code"><code>${this.escapeHtml(mermaidCode)}</code></pre>
                        </div>
                        <div class="graph-export-code-block" id="export-block-json" style="display:none;">
                            <pre class="graph-export-code"><code>${this.escapeHtml(jsonCode)}</code></pre>
                        </div>
                        <div class="graph-export-code-block" id="export-block-markdown" style="display:none;">
                            <pre class="graph-export-code"><code>${this.escapeHtml(markdownCode)}</code></pre>
                        </div>
                    </div>

                    <div class="graph-export-modal-footer">
                        <div class="graph-export-actions">
                            <button class="graph-export-copy-btn" id="graph-export-copy-btn">
                                📋 Копіювати в буфер
                            </button>
                            <button class="graph-export-download-btn" id="graph-export-download-btn">
                                💾 Завантажити файл
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modalEl);

            let activeTab = 'mermaid';
            const tabBtns = modalEl.querySelectorAll('.graph-export-tab');
            tabBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    tabBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    activeTab = btn.dataset.tab;

                    modalEl.querySelector('#export-block-mermaid').style.display = activeTab === 'mermaid' ? 'block' : 'none';
                    modalEl.querySelector('#export-block-json').style.display = activeTab === 'json' ? 'block' : 'none';
                    modalEl.querySelector('#export-block-markdown').style.display = activeTab === 'markdown' ? 'block' : 'none';
                });
            });

            const copyBtn = modalEl.querySelector('#graph-export-copy-btn');
            if (copyBtn) {
                copyBtn.addEventListener('click', () => {
                    let code = mermaidCode;
                    if (activeTab === 'json') code = jsonCode;
                    if (activeTab === 'markdown') code = markdownCode;

                    navigator.clipboard.writeText(code).then(() => {
                        copyBtn.textContent = '✓ Скопійовано!';
                        setTimeout(() => { copyBtn.textContent = '📋 Копіювати в буфер'; }, 2000);
                    });
                });
            }

            const downloadBtn = modalEl.querySelector('#graph-export-download-btn');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', () => {
                    let code = mermaidCode;
                    let filename = `${boardName}-graph.mmd`;
                    let mime = 'text/plain';

                    if (activeTab === 'json') {
                        code = jsonCode;
                        filename = `${boardName}-graph.json`;
                        mime = 'application/json';
                    } else if (activeTab === 'markdown') {
                        code = markdownCode;
                        filename = `${boardName}-mindmap.md`;
                    }

                    const blob = new Blob([code], { type: mime });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(url);
                });
            }

            modalEl.querySelector('#graph-export-close').addEventListener('click', () => this.close());
            modalEl.addEventListener('pointerdown', (e) => {
                if (e.target === modalEl) this.close();
            });
        },

        close() {
            if (modalEl && modalEl.parentNode) {
                modalEl.parentNode.removeChild(modalEl);
            }
            modalEl = null;
        },

        generateMermaid(nodes, edges) {
            let res = 'graph TD\n';
            nodes.forEach(n => {
                const label = (n.title || 'Нотатка').replace(/["\[\]\(\)]/g, ' ');
                res += `    n_${n.id}["${label}"]\n`;
            });
            edges.forEach(e => {
                if (e.type === 'hierarchy') {
                    res += `    n_${e.source} --> n_${e.target}\n`;
                } else if (e.type === 'tag') {
                    res += `    n_${e.source} -.- n_${e.target}\n`;
                }
            });
            return res;
        },

        generateJSON(nodes, edges, currentBoard) {
            return JSON.stringify({
                board: currentBoard ? { id: currentBoard.id, name: currentBoard.name } : null,
                exportedAt: new Date().toISOString(),
                nodes: nodes.map(n => ({
                    id: n.id,
                    title: n.title,
                    isRoot: n.isRoot,
                    tags: n.tags
                })),
                edges: edges.map(e => ({
                    source: e.source,
                    target: e.target,
                    type: e.type
                }))
            }, null, 2);
        },

        generateMarkdown(nodes, edges) {
            let res = '# Mindmap\n\n';
            const roots = nodes.filter(n => n.isRoot);

            const printTree = (nodeId, indent) => {
                const node = nodes.find(n => n.id === nodeId);
                if (!node) return;
                res += `${'  '.repeat(indent)}- ${node.title || 'Нотатка'}\n`;
                const children = edges.filter(e => e.source === nodeId && e.type === 'hierarchy');
                children.forEach(c => printTree(c.target, indent + 1));
            };

            roots.forEach(r => printTree(r.id, 0));
            return res;
        },

        escapeHtml(str) {
            return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
    };
})();
