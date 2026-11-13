// js/board/boardConnect.js - Управління створенням та перепідключенням зв'язків між нотатками на дошці
window.App = window.App || {};

(function() {
    let isConnecting = false;
    let connectingSourceNode = null;
    let connectingSourceSide = null;
    let connectingStartPos = null;
    let connectingCurrentPos = null;
    let connectingTargetNode = null;
    let connectingTargetNodes = null; // Список цільових нотаток при груповому підключенні
    let connectingIsValid = false;

    window.App.boardConnect = {
        isConnecting() {
            return isConnecting;
        },

        getState() {
            return {
                isConnecting,
                sourceNode: connectingSourceNode,
                sourceSide: connectingSourceSide,
                startPos: connectingStartPos,
                currentPos: connectingCurrentPos,
                targetNode: connectingTargetNode,
                targetNodes: connectingTargetNodes,
                isValid: connectingIsValid
            };
        },

        attachConnectionHandles(cardEl, node, boardView) {
            const t = (k, p) => (window.App && window.App.i18n) ? window.App.i18n.t(k, p) : k;
            const sides = ['top', 'bottom', 'left', 'right'];
            sides.forEach(side => {
                const handle = document.createElement('div');
                handle.className = `board-connect-handle board-connect-handle-${side}`;
                handle.dataset.side = side;
                handle.title = t('board.connectHandleTitle') || "Провести зв'язок (зробити піднотаткою)";
                handle.setAttribute('data-i18n-title', 'board.connectHandleTitle');
                handle.innerHTML = `
                    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                        <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z"/>
                    </svg>
                `;

                handle.addEventListener('pointerdown', (e) => {
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    e.preventDefault();
                    this.startConnecting(node, side, e, boardView);
                });

                cardEl.appendChild(handle);
            });
        },

        startConnecting(node, side, e, boardView) {
            isConnecting = true;
            connectingSourceNode = node;
            connectingSourceSide = side;

            const nw = node.width || (node.element ? node.element.offsetWidth || 380 : 380);
            const nh = node.height || (node.element ? node.element.offsetHeight || 140 : 140);

            let startX = node.x + nw / 2;
            let startY = node.y + nh / 2;
            if (side === 'top') {
                startX = node.x + nw / 2;
                startY = node.y;
            } else if (side === 'bottom') {
                startX = node.x + nw / 2;
                startY = node.y + nh;
            } else if (side === 'left') {
                startX = node.x;
                startY = node.y + nh / 2;
            } else if (side === 'right') {
                startX = node.x + nw;
                startY = node.y + nh / 2;
            }

            connectingStartPos = { x: startX, y: startY };
            const interaction = window.App.boardInteraction;
            const canvas = boardView.getCanvas();
            const world = interaction.screenToWorld(e.clientX, e.clientY, canvas);
            connectingCurrentPos = { x: world.x, y: world.y };
            connectingTargetNode = null;
            connectingTargetNodes = null;
            connectingIsValid = false;

            const container = boardView.getContainer();
            if (container) {
                container.classList.add('is-connecting-mode');
            }

            boardView.draw();
        },

        clearTargetHighlights() {
            if (connectingTargetNode && connectingTargetNode.element) {
                connectingTargetNode.element.classList.remove('is-connect-target-valid', 'is-connect-target-invalid');
                delete connectingTargetNode.element.dataset.connectBadge;
            }
            if (Array.isArray(connectingTargetNodes)) {
                connectingTargetNodes.forEach(n => {
                    if (n && n.element) {
                        n.element.classList.remove('is-connect-target-valid', 'is-connect-target-invalid');
                        delete n.element.dataset.connectBadge;
                    }
                });
            }
        },

        handleConnectingMove(e, boardView) {
            if (!isConnecting) return;

            const interaction = window.App.boardInteraction;
            const canvas = boardView.getCanvas();
            const nodes = boardView.getNodes();
            const world = interaction.screenToWorld(e.clientX, e.clientY, canvas);
            connectingCurrentPos = { x: world.x, y: world.y };

            // Пошук картки під курсором
            let candidateNode = null;
            const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.note-sticker');
            if (el && el.dataset.boardNodeId) {
                candidateNode = nodes.find(n => n.id === el.dataset.boardNodeId);
            }
            if (!candidateNode) {
                for (let i = nodes.length - 1; i >= 0; i--) {
                    const n = nodes[i];
                    const nw = n.width || 380;
                    const nh = n.height || 140;
                    if (world.x >= n.x && world.x <= n.x + nw && world.y >= n.y && world.y <= n.y + nh) {
                        candidateNode = n;
                        break;
                    }
                }
            }

            // Перевіряємо, чи є цільова картка частиною виділеної групи на дошці
            const state = window.App.state;
            const selectedIds = state ? state.selectedWorkspaceNoteIds : null;
            const isCandidateInSelection = selectedIds && candidateNode && selectedIds.has(candidateNode.id) && selectedIds.size > 1;

            if (connectingTargetNode !== candidateNode) {
                this.clearTargetHighlights();
                connectingTargetNode = candidateNode;

                if (candidateNode) {
                    const t = (k, p) => (window.App && window.App.i18n) ? window.App.i18n.t(k, p) : k;

                    if (isCandidateInSelection) {
                        // Знаходимо всі нотатки у виділеній групі (крім самої вихідної)
                        const selectedNodes = nodes.filter(n => selectedIds.has(n.id) && n.id !== connectingSourceNode.id);
                        const validTargets = selectedNodes.filter(n => this.isValidConnection(connectingSourceNode, n, nodes));
                        const invalidTargets = selectedNodes.filter(n => !this.isValidConnection(connectingSourceNode, n, nodes));

                        connectingTargetNodes = validTargets;
                        connectingIsValid = validTargets.length > 0;

                        validTargets.forEach(n => {
                            if (n.element) {
                                n.element.classList.add('is-connect-target-valid');
                                n.element.classList.remove('is-connect-target-invalid');
                                delete n.element.dataset.connectBadge;
                            }
                        });

                        invalidTargets.forEach(n => {
                            if (n.element) {
                                n.element.classList.add('is-connect-target-invalid');
                                n.element.classList.remove('is-connect-target-valid');
                                delete n.element.dataset.connectBadge;
                            }
                        });

                        if (candidateNode.element) {
                            if (connectingIsValid) {
                                candidateNode.element.dataset.connectBadge = t('board.connectBadgeMakeSubnotesGroup', { count: validTargets.length }) || `Зробити піднотатками (${validTargets.length})`;
                            } else {
                                candidateNode.element.dataset.connectBadge = t('board.connectBadgeCycle') || "Неможливо (цикл)";
                            }
                        }
                    } else {
                        // Одиночне з'єднання
                        connectingTargetNodes = null;
                        connectingIsValid = this.isValidConnection(connectingSourceNode, candidateNode, nodes);

                        if (candidateNode.element) {
                            candidateNode.element.classList.toggle('is-connect-target-valid', connectingIsValid);
                            candidateNode.element.classList.toggle('is-connect-target-invalid', !connectingIsValid);

                            if (connectingIsValid) {
                                const currentParentId = candidateNode.parentId || (candidateNode.note ? candidateNode.note.parentId : null);
                                candidateNode.element.dataset.connectBadge = currentParentId 
                                    ? (t('board.connectBadgeChange') || "Змінити зв'язок")
                                    : (t('board.connectBadgeMakeSubnote') || "Зробити піднотаткою");
                            } else {
                                if (candidateNode.id === connectingSourceNode.id) {
                                    candidateNode.element.dataset.connectBadge = t('board.connectBadgeSelf') || "Неможливо (сама до себе)";
                                } else if (candidateNode.parentId === connectingSourceNode.id || (candidateNode.note && candidateNode.note.parentId === connectingSourceNode.id)) {
                                    candidateNode.element.dataset.connectBadge = t('board.connectBadgeAlreadySubnote') || "Вже є піднотаткою";
                                } else {
                                    candidateNode.element.dataset.connectBadge = t('board.connectBadgeCycle') || "Неможливо (цикл)";
                                }
                            }
                        }
                    }
                } else {
                    connectingTargetNodes = null;
                    connectingIsValid = false;
                }
            }

            boardView.draw();
        },

        handleConnectingUp(e, boardView) {
            if (!isConnecting) return;

            this.clearTargetHighlights();
            const container = boardView.getContainer();
            if (container) {
                container.classList.remove('is-connecting-mode');
            }

            const source = connectingSourceNode;
            const target = connectingTargetNode;
            const targetNodes = connectingTargetNodes;
            const isValid = connectingIsValid;

            this.reset();

            if (isValid && source) {
                if (Array.isArray(targetNodes) && targetNodes.length > 1) {
                    this.connectMultipleNodes(source, targetNodes, boardView);
                } else if (target) {
                    this.connectNodes(source, target, boardView);
                }
            } else {
                boardView.draw();
            }
        },

        isValidConnection(sourceNode, targetNode, nodes) {
            if (!sourceNode || !targetNode) return false;
            if (sourceNode.id === targetNode.id) return false;

            // Якщо вона вже є піднотаткою саме цієї вихідної нотатки
            const currentParentId = targetNode.parentId || (targetNode.note ? targetNode.note.parentId : null);
            if (currentParentId === sourceNode.id) {
                return false;
            }

            // Перевірка належності до одного блокноту
            const sourceBoardId = sourceNode.note ? sourceNode.note.boardId : null;
            const targetBoardId = targetNode.note ? targetNode.note.boardId : null;
            if (sourceBoardId && targetBoardId && String(sourceBoardId) !== String(targetBoardId)) {
                return false;
            }

            // Захист від циклічних зв'язків: цільова нотатка не може бути предком вихідної
            let curr = sourceNode;
            const visited = new Set();
            while (curr && curr.parentId) {
                if (curr.parentId === targetNode.id) return false;
                if (visited.has(curr.parentId)) break;
                visited.add(curr.parentId);
                curr = nodes ? nodes.find(n => n.id === curr.parentId) : null;
            }

            // Додатково перевіряємо дерево нащадків цільової нотатки
            if (window.App.noteManager && window.App.noteManager.getDescendantIds) {
                const descendantIds = new Set(window.App.noteManager.getDescendantIds(targetNode.id));
                if (descendantIds.has(sourceNode.id)) return false;
            }

            return true;
        },

        connectNodes(sourceNode, targetNode, boardView) {
            if (!sourceNode || !targetNode) return;
            const nodes = boardView.getNodes();
            if (!this.isValidConnection(sourceNode, targetNode, nodes)) return;

            if (window.App.historyManager) {
                window.App.historyManager.recordState('connect_nodes');
            }

            if (window.App.noteManager) {
                const success = window.App.noteManager.moveNoteToParent(targetNode.id, sourceNode.id);
                if (success) {
                    boardView.buildBoardData({ preserveCamera: true });
                    if (window.App.sidebarView) window.App.sidebarView.render();
                }
            }
        },

        // Групове підключення всіх виділених нотаток до однієї батьківської нотатки
        connectMultipleNodes(sourceNode, targetNodes, boardView) {
            if (!sourceNode || !Array.isArray(targetNodes) || targetNodes.length === 0) return;
            const nodes = boardView.getNodes();
            const validTargets = targetNodes.filter(t => this.isValidConnection(sourceNode, t, nodes));
            if (validTargets.length === 0) return;

            const targetIds = validTargets.map(t => t.id);

            if (window.App.workspaceSelectionActions && window.App.workspaceSelectionActions.moveNotesToParent) {
                window.App.workspaceSelectionActions.moveNotesToParent(targetIds, sourceNode.id);
                boardView.buildBoardData({ preserveCamera: true });
                if (window.App.sidebarView) window.App.sidebarView.render();
            } else if (window.App.noteManager) {
                if (window.App.historyManager) {
                    window.App.historyManager.recordState('connect_nodes');
                }
                let anyMoved = false;
                targetIds.forEach(id => {
                    const ok = window.App.noteManager.moveNoteToParent(id, sourceNode.id, false);
                    if (ok) anyMoved = true;
                });
                if (anyMoved) {
                    boardView.buildBoardData({ preserveCamera: true });
                    if (window.App.sidebarView) window.App.sidebarView.render();
                }
            }
        },

        reset() {
            this.clearTargetHighlights();
            isConnecting = false;
            connectingSourceNode = null;
            connectingSourceSide = null;
            connectingStartPos = null;
            connectingCurrentPos = null;
            connectingTargetNode = null;
            connectingTargetNodes = null;
            connectingIsValid = false;
        }
    };
})();
