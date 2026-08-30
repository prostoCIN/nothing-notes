// js/dom.js - Отримання DOM елементів
window.App = window.App || {};

window.App.getElements = function() {
    return {
        // Екрани
        welcomeScreen: document.getElementById('welcome-screen'),
        appContainer: document.getElementById('app-container'),

        // Екран привітання
        welcomeBoardInput: document.getElementById('welcome-board-input'),
        createFirstBoardBtn: document.getElementById('create-first-board-btn'),
        welcomeLoginBtn: document.getElementById('welcome-login-btn'),

        // Сайдбар
        sidebarAddBoardBtn: document.getElementById('sidebar-add-board-btn'),
        sidebarNewBoardForm: document.getElementById('sidebar-new-board-form'),
        sidebarNewBoardInput: document.getElementById('sidebar-new-board-input'),
        sidebarBoardsList: document.getElementById('sidebar-boards-list'),
        addNoteBtn: document.getElementById('add-note-btn'),
        notesList: document.getElementById('notes-list'),

        // Робоча область
        boardWorkspace: document.getElementById('board-workspace'),
        columnsContainer: document.getElementById('columns-container')
    };
};
