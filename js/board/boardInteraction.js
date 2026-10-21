// js/board/boardInteraction.js - Панорамування, зум (миша, тач, pinch-to-zoom) та координати
window.App = window.App || {};

(function() {
    window.App.boardInteraction = {
        camera: {
            x: 0,
            y: 0,
            zoom: 1,
            minZoom: 0.15,
            maxZoom: 3.5
        },

        screenToWorld(screenX, screenY, canvas) {
            if (!canvas) return { x: screenX, y: screenY };
            const rect = canvas.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;

            const x = (screenX - rect.left - this.camera.x) / this.camera.zoom + (width / 2);
            const y = (screenY - rect.top - this.camera.y) / this.camera.zoom + (height / 2);
            return { x, y };
        },

        worldToScreen(worldX, worldY, canvas) {
            if (!canvas) return { x: worldX, y: worldY };
            const rect = canvas.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;

            const x = (worldX - (width / 2)) * this.camera.zoom + this.camera.x + rect.left;
            const y = (worldY - (height / 2)) * this.camera.zoom + this.camera.y + rect.top;
            return { x, y };
        },

        zoomAt(deltaZoom, screenX, screenY, canvas) {
            const oldZoom = this.camera.zoom;
            const newZoom = Math.min(this.camera.maxZoom, Math.max(this.camera.minZoom, oldZoom * deltaZoom));
            if (oldZoom === newZoom) return;

            const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
            const mouseX = screenX - rect.left;
            const mouseY = screenY - rect.top;

            const worldX = (mouseX - this.camera.x - rect.width / 2) / oldZoom;
            const worldY = (mouseY - this.camera.y - rect.height / 2) / oldZoom;

            this.camera.zoom = newZoom;
            this.camera.x = mouseX - rect.width / 2 - worldX * newZoom;
            this.camera.y = mouseY - rect.height / 2 - worldY * newZoom;
        },

        resetCamera(canvas) {
            this.camera.x = 0;
            this.camera.y = 0;
            this.camera.zoom = 1;
        }
    };
})();
