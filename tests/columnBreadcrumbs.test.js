import { describe, it, expect, beforeEach } from 'vitest';
import '../js/eventBus.js';
import '../js/state.js';
import '../js/workspace/workspaceColumn.js';

describe('Column Breadcrumbs (History of Opened Notes) Dynamic Sync', () => {
    let container;
    let state;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="columns-container" class="columns-container">
                <div class="board-column root-column" data-col-index="0" data-parent-id="root">
                    <div class="column-header">
                        <div class="column-title-wrap">
                            <h2 class="column-title">Головний блокнот</h2>
                        </div>
                    </div>
                </div>
                <div class="board-column child-column" data-col-index="1" data-parent-id="note-1">
                    <div class="column-header">
                        <div class="column-title-wrap">
                            <h2 class="column-title">Нотатка 1</h2>
                        </div>
                    </div>
                </div>
                <div class="board-column child-column" data-col-index="2" data-parent-id="note-2">
                    <div class="column-header">
                        <div class="column-title-wrap">
                            <h2 class="column-title">Піднотатка 2</h2>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container = document.getElementById('columns-container');
        state = window.App.state;
        state.activeChain = [null, 'note-1', 'note-2'];

        window.App.boardManager = {
            getActiveBoard: () => ({ name: 'Мій блокнот', icon: '📋' })
        };
        window.App.noteManager = {
            getNoteById: (id) => {
                if (id === 'note-1') return { id: 'note-1', title: 'Нотатка 1', icon: '📄' };
                if (id === 'note-2') return { id: 'note-2', title: 'Піднотатка 2', icon: '📝' };
                return null;
            }
        };
    });

    it('should create breadcrumbs showing other open levels when activeChain has multiple levels', () => {
        const col1 = container.querySelector('.board-column[data-col-index="1"]');
        window.App.workspaceColumn.updateColumnBreadcrumbs(col1, 1);

        const breadcrumbs = col1.querySelector('.column-title-breadcrumbs');
        expect(breadcrumbs).not.toBeNull();

        const links = breadcrumbs.querySelectorAll('.column-breadcrumb-link');
        // Column 1 should have links to Level 0 (Мій блокнот) and Level 2 (Піднотатка 2)
        expect(links.length).toBe(2);
        expect(links[0].dataset.targetColIndex).toBe('0');
        expect(links[1].dataset.targetColIndex).toBe('2');
    });

    it('should dynamically update breadcrumbs in remaining columns when a column is closed', () => {
        // Initially update all columns with chain [null, 'note-1', 'note-2']
        window.App.workspaceColumn.updateAllBreadcrumbs(container);

        const col1 = container.querySelector('.board-column[data-col-index="1"]');
        let breadcrumbs = col1.querySelector('.column-title-breadcrumbs');
        expect(breadcrumbs.querySelectorAll('.column-breadcrumb-link').length).toBe(2);

        // Now simulate closing Column 2: remove col 2 from DOM and slice activeChain
        const col2 = container.querySelector('.board-column[data-col-index="2"]');
        col2.remove();
        state.activeChain = [null, 'note-1'];

        // Trigger dynamic breadcrumbs update
        window.App.workspaceColumn.updateAllBreadcrumbs(container);

        // Column 1 should now only contain Level 0 (no stale link to closed Level 2)
        breadcrumbs = col1.querySelector('.column-title-breadcrumbs');
        expect(breadcrumbs).not.toBeNull();
        const updatedLinks = breadcrumbs.querySelectorAll('.column-breadcrumb-link');
        expect(updatedLinks.length).toBe(1);
        expect(updatedLinks[0].dataset.targetColIndex).toBe('0');
    });

    it('should remove breadcrumbs completely when all subnote columns are closed', () => {
        // Only root column remains
        container.querySelectorAll('.child-column').forEach(el => el.remove());
        state.activeChain = [null];

        window.App.workspaceColumn.updateAllBreadcrumbs(container);

        const rootCol = container.querySelector('.root-column');
        const breadcrumbs = rootCol.querySelector('.column-title-breadcrumbs');
        expect(breadcrumbs).toBeNull();
    });
});
