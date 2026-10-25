// js/board/boardCables.js - Рендеринг з'єднувальних кабелів (кривих Безьє) між стікерами
window.App = window.App || {};

(function() {
    window.App.boardCables = {
        /**
         * Обчислює параметри та малює криві Безьє для всіх активних зв'язків
         */
        drawCables(ctx, edges, camera, options = {}) {
            if (!ctx || !edges || edges.length === 0) return;

            const {
                draggedNode = null,
                activeTagFilter = null
            } = options;

            edges.forEach(edge => {
                const p = edge.cachedPath;
                if (!p) return;

                const isTagEdge = (edge.type === 'tag');
                const branchColor = edge.color || '#10b981';

                ctx.beginPath();
                ctx.moveTo(p.x1, p.y1);
                ctx.bezierCurveTo(p.cp1x, p.cp1y, p.cp2x, p.cp2y, p.x2, p.y2);

                if (isTagEdge) {
                    ctx.setLineDash([6, 5]);
                } else {
                    ctx.setLineDash([]);
                }

                ctx.lineCap = 'round';

                if (edge.isFaded) {
                    ctx.strokeStyle = branchColor + '14';
                    ctx.lineWidth = 1.0 / camera.zoom;
                    ctx.shadowBlur = 0;
                } else if (edge.isActive) {
                    ctx.strokeStyle = branchColor;
                    ctx.lineWidth = (draggedNode ? 3.2 : 2.6) / camera.zoom;
                    ctx.shadowColor = branchColor;
                    ctx.shadowBlur = 12;
                } else if (edge.isFilteredOut) {
                    ctx.strokeStyle = branchColor + '20';
                    ctx.lineWidth = 1.0 / camera.zoom;
                    ctx.shadowBlur = 0;
                } else if (isTagEdge) {
                    ctx.strokeStyle = branchColor + (activeTagFilter ? 'ee' : '99');
                    ctx.lineWidth = 1.6 / camera.zoom;
                    ctx.shadowBlur = 0;
                } else {
                    ctx.strokeStyle = branchColor + 'bb';
                    ctx.lineWidth = 2.2 / camera.zoom;
                    ctx.shadowBlur = 0;
                }

                ctx.stroke();
                ctx.shadowBlur = 0;

                // Контактні піни та наконечники стрілок
                const pinRadius = Math.max(2.5, 3.5 / Math.sqrt(camera.zoom));

                // Вихідний пін-конектор
                ctx.beginPath();
                ctx.arc(p.x1, p.y1, pinRadius, 0, Math.PI * 2);
                ctx.fillStyle = ctx.strokeStyle;
                ctx.fill();

                // Вхідна стрілка / наконечник кабелю
                const angle = Math.atan2(p.y2 - p.cp2y, p.x2 - p.cp2x);
                const headLen = Math.max(7, 10 / Math.sqrt(camera.zoom));
                const wingAngle = Math.PI / 6;

                ctx.beginPath();
                ctx.moveTo(p.x2, p.y2);
                ctx.lineTo(
                    p.x2 - headLen * Math.cos(angle - wingAngle),
                    p.y2 - headLen * Math.sin(angle - wingAngle)
                );
                ctx.lineTo(
                    p.x2 - (headLen * 0.5) * Math.cos(angle),
                    p.y2 - (headLen * 0.5) * Math.sin(angle)
                );
                ctx.lineTo(
                    p.x2 - headLen * Math.cos(angle + wingAngle),
                    p.y2 - headLen * Math.sin(angle + wingAngle)
                );
                ctx.closePath();
                ctx.fillStyle = ctx.strokeStyle;
                ctx.fill();
            });

            ctx.setLineDash([]);
        },

        /**
         * Обчислює траєкторію кабелю між карткою-батьком та карткою-нащадком
         */
        calculatePath(sourceNode, targetNode) {
            if (!sourceNode || !targetNode) return null;

            const pw = sourceNode.width || (sourceNode.element ? (sourceNode.element.offsetWidth || 380) : 380);
            const ph = sourceNode.height || (sourceNode.element ? (sourceNode.element.offsetHeight || 140) : 140);
            const cw = targetNode.width || (targetNode.element ? (targetNode.element.offsetWidth || 380) : 380);
            const ch = targetNode.height || (targetNode.element ? (targetNode.element.offsetHeight || 140) : 140);

            // Визначаємо взаємне розташування: зверху-вниз чи зліва-направо
            const isBelow = (targetNode.y >= sourceNode.y + ph - 25);

            if (isBelow) {
                // Зверху-вниз: з нижнього центру батьківської картки до верхнього центру дочірньої
                const x1 = sourceNode.x + pw / 2;
                const y1 = sourceNode.y + ph;
                const x2 = targetNode.x + cw / 2;
                const y2 = targetNode.y;

                const dy = Math.max(25, y2 - y1);
                const cpOffset = Math.max(40, dy * 0.5);
                const cp1x = x1;
                const cp1y = y1 + cpOffset;
                const cp2x = x2;
                const cp2y = y2 - cpOffset;

                return { x1, y1, x2, y2, cp1x, cp1y, cp2x, cp2y };
            } else {
                // Зліва-направо або довільне положення
                const isLeft = (targetNode.x + cw <= sourceNode.x);
                let x1, y1, x2, y2;

                if (isLeft) {
                    x1 = sourceNode.x;
                    y1 = sourceNode.y + ph / 2;
                    x2 = targetNode.x + cw;
                    y2 = targetNode.y + ch / 2;
                } else {
                    x1 = sourceNode.x + pw;
                    y1 = sourceNode.y + ph / 2;
                    x2 = targetNode.x;
                    y2 = targetNode.y + ch / 2;
                }

                const dx = Math.max(25, Math.abs(x2 - x1));
                const cpOffset = Math.max(50, dx * 0.45);
                const cp1x = isLeft ? (x1 - cpOffset) : (x1 + cpOffset);
                const cp1y = y1;
                const cp2x = isLeft ? (x2 + cpOffset) : (x2 - cpOffset);
                const cp2y = y2;

                return { x1, y1, x2, y2, cp1x, cp1y, cp2x, cp2y };
            }
        }
    };
})();
