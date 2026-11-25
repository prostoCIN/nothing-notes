// tests/boardAndGraphSearch.test.js - Unit tests for board and graph search filtering
import { describe, it, expect } from 'vitest';
import '../js/graph/graphRenderer.js';

describe('Board and Graph Search filtering by title only', () => {
    it('graph search matches only node.title and ignores node.content', () => {
        const renderer = window.App?.graphRenderer;
        expect(renderer).toBeDefined();

        const nodeMatchTitle = {
            id: 'n1',
            title: 'План проекту',
            content: 'Детальний опис завдань',
            element: document.createElement('div'),
            x: 0,
            y: 0
        };

        const nodeMatchContentOnly = {
            id: 'n2',
            title: 'Звичайна нотатка',
            content: 'Тут є слово план всередині тексту',
            element: document.createElement('div'),
            x: 10,
            y: 10
        };

        const nodes = [nodeMatchTitle, nodeMatchContentOnly];

        const mockCanvas = document.createElement('canvas');
        mockCanvas.getBoundingClientRect = () => ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600 });
        const mockCtx = {
            save: () => {},
            restore: () => {},
            clearRect: () => {},
            translate: () => {},
            scale: () => {},
            beginPath: () => {},
            arc: () => {},
            stroke: () => {},
            fill: () => {},
            moveTo: () => {},
            lineTo: () => {},
            setLineDash: () => {},
            fillText: () => {}
        };

        renderer.render(
            mockCtx,
            mockCanvas,
            nodes,
            [],
            { x: 0, y: 0, zoom: 1 },
            { searchQuery: 'план' }
        );

        // n1 matches because title contains 'план'
        expect(nodeMatchTitle.element.classList.contains('is-match')).toBe(true);
        expect(nodeMatchTitle.element.classList.contains('is-faded')).toBe(false);

        // n2 must NOT match because 'план' is only in content, not title
        expect(nodeMatchContentOnly.element.classList.contains('is-match')).toBe(false);
        expect(nodeMatchContentOnly.element.classList.contains('is-faded')).toBe(true);
    });
});
