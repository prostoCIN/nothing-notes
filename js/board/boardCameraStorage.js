// js/board/boardCameraStorage.js - Управління збереженням, відновленням та розрахунком в'юпорту камери дошки
window.App = window.App || {};

(function() {
    const BOARD_CAMERAS_KEY = 'minimal_board_cameras';
    const boardCameras = new Map(); // boardId -> { x, y, zoom }
    let saveCameraTimeout = null;

    function loadBoardCameras() {
        try {
            const raw = localStorage.getItem(BOARD_CAMERAS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    Object.entries(parsed).forEach(([id, cam]) => {
                        if (cam && typeof cam.x === 'number' && typeof cam.y === 'number' && typeof cam.zoom === 'number') {
                            boardCameras.set(String(id), cam);
                        }
                    });
                }
            }
        } catch (e) {
            console.warn('[BoardCameraStorage] Помилка завантаження камер блокнотів:', e);
        }
    }

    // Завантажуємо збережені камери при старті модуля
    loadBoardCameras();

    function persistBoardCamerasToStorage(immediate = false) {
        const doSave = () => {
            try {
                const obj = {};
                boardCameras.forEach((cam, id) => {
                    obj[id] = cam;
                });
                localStorage.setItem(BOARD_CAMERAS_KEY, JSON.stringify(obj));
            } catch (e) {
                console.warn('[BoardCameraStorage] Помилка збереження камер блокнотів:', e);
            }
        };

        if (immediate) {
            if (saveCameraTimeout) {
                clearTimeout(saveCameraTimeout);
                saveCameraTimeout = null;
            }
            doSave();
        } else {
            if (saveCameraTimeout) clearTimeout(saveCameraTimeout);
            saveCameraTimeout = setTimeout(() => {
                saveCameraTimeout = null;
                doSave();
            }, 200);
        }
    }

    window.App.boardCameraStorage = {
        getSavedCamera(boardId) {
            if (!boardId) return null;
            return boardCameras.get(String(boardId)) || null;
        },

        hasSavedCamera(boardId) {
            if (!boardId) return false;
            return boardCameras.has(String(boardId));
        },

        saveCamera(boardId, camera, immediate = false) {
            if (!boardId || !camera) return;
            boardCameras.set(String(boardId), {
                x: camera.x,
                y: camera.y,
                zoom: camera.zoom
            });
            persistBoardCamerasToStorage(immediate);
        },

        areNotesInViewport(nodes, container, canvas, camera) {
            if (!nodes || nodes.length === 0) return true;
            if (!container || !canvas) return true;
            const rect = container.getBoundingClientRect();
            const width = (rect && rect.width > 50) ? rect.width : (canvas.offsetWidth || window.innerWidth || 800);
            const height = (rect && rect.height > 50) ? rect.height : (canvas.offsetHeight || window.innerHeight || 600);
            if (!camera) return true;

            const zoom = camera.zoom || 1;

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            nodes.forEach(n => {
                const nw = n.width || 380;
                const nh = n.height || 140;
                if (typeof n.x === 'number' && !isNaN(n.x)) {
                    minX = Math.min(minX, n.x);
                    maxX = Math.max(maxX, n.x + nw);
                }
                if (typeof n.y === 'number' && !isNaN(n.y)) {
                    minY = Math.min(minY, n.y);
                    maxY = Math.max(maxY, n.y + nh);
                }
            });

            if (!isFinite(minX) || !isFinite(minY)) return true;

            const screenMinX = (minX - width / 2) * zoom + camera.x;
            const screenMaxX = (maxX - width / 2) * zoom + camera.x;
            const screenMinY = (minY - height / 2) * zoom + camera.y;
            const screenMaxY = (maxY - height / 2) * zoom + camera.y;

            return (
                screenMaxX > 60 &&
                screenMinX < width - 60 &&
                screenMaxY > 60 &&
                screenMinY < height - 60
            );
        },

        centerCameraOnAllNodes(options) {
            const {
                nodes = [],
                container,
                canvas,
                camera,
                onResize,
                onDraw,
                boardId
            } = options;

            if (!canvas || !container || !camera) return;

            const rect = container.getBoundingClientRect();
            if (!rect || rect.width <= 50 || rect.height <= 50) {
                requestAnimationFrame(() => this.centerCameraOnAllNodes(options));
                return;
            }

            if (typeof onResize === 'function') onResize();
            const w = rect.width;
            const h = rect.height;

            if (nodes.length === 0) {
                if (window.App.boardInteraction) {
                    window.App.boardInteraction.initCamera(w, h);
                }
                if (boardId) this.saveCamera(boardId, camera, true);
                if (typeof onDraw === 'function') onDraw();
                return;
            }

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            nodes.forEach(n => {
                const nw = n.width || (n.element && n.element.offsetWidth > 40 ? n.element.offsetWidth : 380);
                const nh = n.height || (n.element && n.element.offsetHeight > 40 ? n.element.offsetHeight : 140);
                if (typeof n.x === 'number' && !isNaN(n.x)) {
                    minX = Math.min(minX, n.x);
                    maxX = Math.max(maxX, n.x + nw);
                }
                if (typeof n.y === 'number' && !isNaN(n.y)) {
                    minY = Math.min(minY, n.y);
                    maxY = Math.max(maxY, n.y + nh);
                }
            });

            if (!isFinite(minX) || !isFinite(minY)) {
                if (window.App.boardInteraction) {
                    window.App.boardInteraction.initCamera(w, h);
                }
                if (boardId) this.saveCamera(boardId, camera, true);
                if (typeof onDraw === 'function') onDraw();
                return;
            }

            const boundingW = Math.max(300, maxX - minX);
            const boundingH = Math.max(200, maxY - minY);
            const centerWorldX = minX + boundingW / 2;
            const centerWorldY = minY + boundingH / 2;

            const isMobile = window.innerWidth <= 768;
            const padX = isMobile ? 80 : 160;
            const padY = isMobile ? 90 : 180;

            const availW = Math.max(150, w - padX);
            const availH = Math.max(150, h - padY);

            const scaleX = availW / boundingW;
            const scaleY = availH / boundingH;
            let targetZoom = Math.min(scaleX, scaleY);

            // Обмежуємо комфортні рамки масштабування при підгонці
            targetZoom = Math.min(1.0, Math.max(0.25, targetZoom));

            camera.zoom = targetZoom;
            camera.x = (w / 2) - (centerWorldX - w / 2) * targetZoom;
            camera.y = (h / 2) - (centerWorldY - h / 2) * targetZoom;

            if (boardId) this.saveCamera(boardId, camera, true);
            if (typeof onDraw === 'function') onDraw();
        }
    };
})();
