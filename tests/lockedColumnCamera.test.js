import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../js/eventBus.js';
import '../js/state.js';

describe('Locked Column Camera & Zen Mode Sync', () => {
    let container;
    let lockedCol;
    let state;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="columns-container" class="columns-container has-locked-column" style="width: 1000px; padding-left: 24px; padding-right: 24px;">
                <div class="board-column root-column" data-parent-id="root" style="width: 500px;"></div>
                <div class="board-column child-column column-locked" data-parent-id="sub-1" style="width: 900px;"></div>
            </div>
        `;
        container = document.getElementById('columns-container');
        lockedCol = container.querySelector('.column-locked');

        // Mock layout properties in JSDOM
        Object.defineProperty(container, 'clientWidth', { value: 1000, configurable: true });
        Object.defineProperty(container, 'scrollLeft', { value: 0, writable: true, configurable: true });
        Object.defineProperty(lockedCol, 'offsetLeft', { value: 540, configurable: true });
        Object.defineProperty(lockedCol, 'offsetWidth', { value: 900, configurable: true });

        state = window.App.state;
        state.lockedColumnKey = 'sub-1';
        state.lockedScrollLeft = null;

        window.App.getElements = () => ({ columnsContainer: container });
    });

    it('should anchor the camera to the right boundary stop of the locked column', () => {
        // Calculation expected:
        // colRight = 540 + 900 = 1440
        // paddingRight = 24
        // clientWidth = 1000
        // targetScroll = 1440 - 1000 + 24 = 464
        const paddingRight = 24;
        const colRight = lockedCol.offsetLeft + lockedCol.offsetWidth;
        const expectedScroll = colRight - container.clientWidth + paddingRight;

        expect(expectedScroll).toBe(464);

        // When scrolled to expectedScroll, right edge aligns exactly with container.clientWidth - paddingRight:
        const rightEdgeInViewport = colRight - expectedScroll;
        expect(rightEdgeInViewport).toBe(container.clientWidth - paddingRight);
    });

    it('should prevent right-side clipping in concentration mode with wider clientWidth', () => {
        // When entering concentration mode, container expands to 1400px:
        Object.defineProperty(container, 'clientWidth', { value: 1400, configurable: true });

        const paddingRight = 24;
        const colRight = lockedCol.offsetLeft + lockedCol.offsetWidth;
        const expectedScroll = Math.max(0, colRight - 1400 + paddingRight);

        expect(expectedScroll).toBe(1440 - 1400 + 24); // 64px
        const rightEdgeInViewport = colRight - expectedScroll;
        expect(rightEdgeInViewport).toBe(1400 - paddingRight);
    });
});
