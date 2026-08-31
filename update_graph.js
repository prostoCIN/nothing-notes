const fs = require('fs');
let code = fs.readFileSync('js/graphView.js', 'utf8');

code = code.replace('let tooltip = null;', 'let tooltip = null;\n    let nodesLayer = null;');

code = code.replace('<canvas class="graph-canvas" id="graph-canvas"></canvas>',
                    '<canvas class="graph-canvas" id="graph-canvas"></canvas>\n                <div class="graph-nodes-layer" id="graph-nodes-layer"></div>');

code = code.replace("ctx = canvas.getContext('2d');",
                    "ctx = canvas.getContext('2d');\n            nodesLayer = container.querySelector('#graph-nodes-layer');");

let start_idx = code.indexOf('// Кеш для відрендерених емодзі');
let end_idx = code.indexOf('window.App.graphView = {');
if (start_idx !== -1 && end_idx !== -1) {
    code = code.substring(0, start_idx) + code.substring(end_idx);
}

code = code.replace('nodesMap.clear();', "nodesMap.clear();\n            if (nodesLayer) nodesLayer.innerHTML = '';");

let node_creation = `
                if (nodesLayer) {
                    const el = document.createElement('div');
                    el.className = 'graph-html-node' + (isRoot ? ' is-root' : '');
                    el.title = node.title + '\\n\\n' + node.content.substring(0, 100) + '...';
                    
                    const circle = document.createElement('div');
                    circle.className = 'graph-html-node-circle';
                    if (!isRoot && node.color) {
                        circle.style.backgroundColor = colorMap[node.color] || '#10b981';
                    } else if (!isRoot && note.color) {
                        circle.style.backgroundColor = colorMap[note.color] || '#10b981';
                    }
                    circle.innerHTML = node.icon;
                    
                    const label = document.createElement('div');
                    label.className = 'graph-html-node-label';
                    label.textContent = node.title;
                    
                    el.appendChild(circle);
                    el.appendChild(label);
                    nodesLayer.appendChild(el);
                    
                    node.element = el;
                }

                nodes.push(node);
`;
code = code.replace('nodes.push(node);', node_creation);

let draw_start = code.indexOf('// 2. Малювання вершин (Nodes)');
let draw_end = code.indexOf('ctx.restore();\n        },\n\n        // Головний цикл');

let new_draw_logic = `// 2. Оновлення стану та позицій HTML-вершин
            nodes.forEach(node => {
                if (!node.element) return;
                
                const isMatch = searchQuery === '' || node.title.toLowerCase().includes(searchQuery) || node.content.toLowerCase().includes(searchQuery);
                const isHovered = (hoveredNode === node);
                const isConnected = hoveredNode && edges.some(e => (e.source === hoveredNode && e.target === node) || (e.target === hoveredNode && e.source === node));

                node.element.classList.toggle('is-hovered', isHovered);
                node.element.classList.toggle('is-connected', isConnected);
                node.element.classList.toggle('is-match', isMatch && searchQuery !== '');
                node.element.classList.toggle('is-faded', searchQuery ? !isMatch : (hoveredNode && !isHovered && !isConnected));

                node.element.style.left = node.x + 'px';
                node.element.style.top = node.y + 'px';
            });

            if (nodesLayer) {
                nodesLayer.style.transform = 'translate(' + camera.x + 'px, ' + camera.y + 'px) scale(' + camera.zoom + ') translate(' + (-width / 2) + 'px, ' + (-height / 2) + 'px)';
            }
            `;
if(draw_start !== -1 && draw_end !== -1) {
    code = code.substring(0, draw_start) + new_draw_logic + '\n            ' + code.substring(draw_end);
}

code = code.replace('<div class="graph-node-tooltip" id="graph-node-tooltip">', '<div class="graph-node-tooltip" id="graph-node-tooltip" style="display: none;">');

code = code.replace(/this\.updateTooltip\([^)]*\);?/g, '');
code = code.replace(/this\.positionTooltip\([^)]*\);?/g, '');
code = code.replace(/if\s*\(\s*hoveredNode\s*\)\s*\{\s*\}/g, ''); // empty if blocks

let func_start = code.indexOf('updateTooltip(node) {');
let func_end = code.indexOf('openNoteInWorkspace(noteId) {');
if (func_start !== -1 && func_end !== -1) {
    code = code.substring(0, func_start) + code.substring(func_end);
}

fs.writeFileSync('js/graphView.js', code);
console.log('Update completed.');
