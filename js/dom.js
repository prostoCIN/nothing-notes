// js/dom.js - Отримання DOM елементів
window.App = window.App || {};

window.App.getElements = function() {
    return {
        // Екрани
        welcomeScreen: document.getElementById('welcome-screen'),
        appContainer: document.getElementById('app-container'),

        // Екран привітання
        welcomeLoginBtn: document.getElementById('welcome-login-btn'),
        welcomeGuestBtn: document.getElementById('welcome-guest-btn'),

        // Сайдбар
        sidebar: document.getElementById('sidebar'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        mobileMenuBtn: document.getElementById('mobile-menu-btn'),
        sidebarCloseBtn: document.getElementById('sidebar-close-btn'),
        sidebarAddBoardBtn: document.getElementById('sidebar-add-board-btn'),
        sidebarNewBoardForm: document.getElementById('sidebar-new-board-form'),
        sidebarNewBoardInput: document.getElementById('sidebar-new-board-input'),
        sidebarBoardsList: document.getElementById('sidebar-boards-list'),
        sharedBoardsSection: document.getElementById('shared-boards-section'),
        sidebarSharedBoardsList: document.getElementById('sidebar-shared-boards-list'),
        addNoteBtn: document.getElementById('add-note-btn'),
        notesList: document.getElementById('notes-list'),

        // Робоча область
        boardWorkspace: document.getElementById('board-workspace'),
        columnsContainer: document.getElementById('columns-container')
    };
};
