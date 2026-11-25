// tests/mobileSidebarSwipe.test.js - Unit tests for mobile swipe to open/close sidebar
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import '../js/sidebarView.js';

describe('Mobile Sidebar Swipe Gestures', () => {
    let sidebarView;
    let mockSidebar;
    let mockOverlay;
    let mockColumnsContainer;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="sidebar-overlay" class="sidebar-overlay"></div>
            <aside id="sidebar" class="sidebar"></aside>
            <div id="columns-container" class="columns-container" style="overflow-x: auto;">
                <div class="board-column" data-column-id="col-1"></div>
                <div class="board-column" data-column-id="col-2"></div>
            </div>
        `;
        document.body.className = '';

        mockSidebar = document.getElementById('sidebar');
        mockOverlay = document.getElementById('sidebar-overlay');
        mockColumnsContainer = document.getElementById('columns-container');

        window.App = window.App || {};
        window.App.getElements = () => ({
            sidebar: mockSidebar,
            sidebarOverlay: mockOverlay,
            columnsContainer: mockColumnsContainer
        });

        sidebarView = window.App.sidebarView;
        expect(sidebarView).toBeDefined();

        // Default to mobile width
        window.innerWidth = 375;

        // Init gestures
        sidebarView.bindMobileSwipeGestures();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function dispatchTouchSequence(options) {
        const {
            startX,
            startY,
            endX,
            endY,
            duration = 100,
            target = mockColumnsContainer
        } = options;

        const touchStart = new Event('touchstart', { bubbles: true, cancelable: true });
        touchStart.touches = [{ clientX: startX, clientY: startY }];
        target.dispatchEvent(touchStart);

        const touchEnd = new Event('touchend', { bubbles: true, cancelable: true });
        touchEnd.changedTouches = [{ clientX: endX, clientY: endY }];
        touchEnd.touches = [];

        // Simulate time lapse if needed
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + duration);
        window.dispatchEvent(touchEnd);
    }

    it('opens mobile sidebar when swiping right from first column on mobile', () => {
        mockColumnsContainer.scrollLeft = 0;

        dispatchTouchSequence({
            startX: 50,
            startY: 200,
            endX: 130, // deltaX = +80px (swipe right)
            endY: 205
        });

        expect(mockSidebar.classList.contains('mobile-open')).toBe(true);
        expect(mockOverlay.classList.contains('active')).toBe(true);
        expect(document.body.classList.contains('mobile-sidebar-active')).toBe(true);
    });

    it('opens mobile sidebar when swiping from the left edge', () => {
        mockColumnsContainer.scrollLeft = 100; // Not at scroll 0, but edge swipe

        dispatchTouchSequence({
            startX: 20, // Edge < 45px
            startY: 300,
            endX: 90, // deltaX = +70px
            endY: 305
        });

        expect(mockSidebar.classList.contains('mobile-open')).toBe(true);
    });

    it('does NOT open sidebar when swiping right if user is scrolled into other columns', () => {
        mockColumnsContainer.scrollLeft = 300; // In second column

        dispatchTouchSequence({
            startX: 150, // Not edge
            startY: 200,
            endX: 230,
            endY: 205
        });

        expect(mockSidebar.classList.contains('mobile-open')).toBe(false);
        expect(document.body.classList.contains('mobile-sidebar-active')).toBe(false);
    });

    it('does NOT open sidebar when swiping left from first column (allows scrolling to column 2)', () => {
        mockColumnsContainer.scrollLeft = 0;

        dispatchTouchSequence({
            startX: 200,
            startY: 200,
            endX: 120, // deltaX = -80px (swipe left towards next column)
            endY: 205
        });

        expect(mockSidebar.classList.contains('mobile-open')).toBe(false);
    });

    it('does NOT open sidebar during vertical scrolling gestures', () => {
        mockColumnsContainer.scrollLeft = 0;

        dispatchTouchSequence({
            startX: 50,
            startY: 100,
            endX: 70, // deltaX = +20px
            endY: 250 // deltaY = +150px (vertical scroll)
        });

        expect(mockSidebar.classList.contains('mobile-open')).toBe(false);
    });

    it('closes mobile sidebar when swiping left on open sidebar', () => {
        sidebarView.openMobileSidebar();
        expect(document.body.classList.contains('mobile-sidebar-active')).toBe(true);

        dispatchTouchSequence({
            startX: 250,
            startY: 200,
            endX: 150, // deltaX = -100px (swipe left to close)
            endY: 205,
            target: mockSidebar
        });

        expect(mockSidebar.classList.contains('mobile-open')).toBe(false);
        expect(document.body.classList.contains('mobile-sidebar-active')).toBe(false);
    });

    it('does NOT open sidebar on desktop screens (> 768px)', () => {
        window.innerWidth = 1024;
        mockColumnsContainer.scrollLeft = 0;

        dispatchTouchSequence({
            startX: 30,
            startY: 200,
            endX: 150,
            endY: 205
        });

        expect(mockSidebar.classList.contains('mobile-open')).toBe(false);
    });

    it('does NOT open sidebar when note dragging is in progress', () => {
        document.body.classList.add('is-sticker-dragging');
        mockColumnsContainer.scrollLeft = 0;

        dispatchTouchSequence({
            startX: 30,
            startY: 200,
            endX: 150,
            endY: 205
        });

        expect(mockSidebar.classList.contains('mobile-open')).toBe(false);
    });
});
