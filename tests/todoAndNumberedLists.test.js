// tests/todoAndNumberedLists.test.js - Unit tests for Interactive To-Do Checkboxes & Auto Numbered Lists
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../js/workspace/stickerPasteSanitizer.js';
import '../js/workspace/stickerContent.js';
import { htmlToMarkdown } from '../js/backupManager.js';

describe('Interactive To-Do Checkboxes & Auto Numbered Lists', () => {
    let sanitizer;

    beforeEach(() => {
        sanitizer = window.App?.stickerPasteSanitizer;
        expect(sanitizer).toBeDefined();

        window.App = window.App || {};
        window.App.noteManager = {
            updateNote: vi.fn()
        };
    });

    describe('HTML Sanitization of To-Do items', () => {
        it('preserves .todo-item and .todo-checkbox classes and data-checked attribute', () => {
            const rawHtml = '<span class="todo-item" data-checked="false"><span class="todo-checkbox" contenteditable="false" data-checked="false"></span>Купити молоко</span>';
            const cleaned = sanitizer.sanitizeNoteHtml(rawHtml);

            expect(cleaned).toContain('todo-item');
            expect(cleaned).toContain('todo-checkbox');
            expect(cleaned).toContain('data-checked="false"');
            expect(cleaned).toContain('Купити молоко');
        });

        it('preserves checked state data-checked="true"', () => {
            const rawHtml = '<span class="todo-item" data-checked="true"><span class="todo-checkbox" contenteditable="false" data-checked="true"></span>Виконане завдання</span>';
            const cleaned = sanitizer.sanitizeNoteHtml(rawHtml);

            expect(cleaned).toContain('data-checked="true"');
            expect(cleaned).toContain('Виконане завдання');
        });

        it('sanitizes dangerous inline attributes while keeping todo structure safe', () => {
            const dirty = '<span class="todo-item" data-checked="false" onclick="steal()"><span class="todo-checkbox" style="color:red" data-checked="false"></span><script>alert(1)</script>Текст</span>';
            const cleaned = sanitizer.sanitizeNoteHtml(dirty);

            expect(cleaned).not.toContain('onclick');
            expect(cleaned).not.toContain('script');
            expect(cleaned).not.toContain('alert');
            expect(cleaned).toContain('todo-item');
            expect(cleaned).toContain('todo-checkbox');
            expect(cleaned).toContain('Текст');
        });
    });

    describe('Markdown Export Compatibility', () => {
        it('converts unchecked todo checkboxes to - [ ] in Markdown', () => {
            const html = '<span class="todo-item" data-checked="false"><span class="todo-checkbox" contenteditable="false" data-checked="false"></span>Купити молоко</span>';
            const md = htmlToMarkdown(html);
            expect(md).toContain('- [ ] Купити молоко');
        });

        it('converts checked todo checkboxes to - [x] in Markdown', () => {
            const html = '<span class="todo-item" data-checked="true"><span class="todo-checkbox" contenteditable="false" data-checked="true"></span>Завдання зроблено</span>';
            const md = htmlToMarkdown(html);
            expect(md).toContain('- [x] Завдання зроблено');
        });

        it('exports numbered lists cleanly to Markdown without corruption', () => {
            const html = '1. Перший пункт<br>2. Другий пункт<br>3. Третій пункт';
            const md = htmlToMarkdown(html);
            expect(md).toContain('1. Перший пункт');
            expect(md).toContain('2. Другий пункт');
            expect(md).toContain('3. Третій пункт');
        });
    });

    describe('DOM Behavior and Event Handlers', () => {
        let note;
        let card;
        let contentDiv;

        beforeEach(() => {
            note = {
                id: 'note_test_todo_1',
                content: '<span class="todo-item" data-checked="false"><span class="todo-checkbox" contenteditable="false" data-checked="false"></span>Купити каву</span>'
            };
            card = document.createElement('div');
            contentDiv = window.App.stickerContent.createContent(note, card, false);
            document.body.appendChild(contentDiv);
        });

        it('toggles checkbox data-checked state on click and updates note', () => {
            const box = contentDiv.querySelector('.todo-checkbox');
            const item = contentDiv.querySelector('.todo-item');
            expect(box).toBeDefined();
            expect(box.getAttribute('data-checked')).toBe('false');

            // Click to check
            box.click();
            expect(box.getAttribute('data-checked')).toBe('true');
            expect(item.getAttribute('data-checked')).toBe('true');
            expect(window.App.noteManager.updateNote).toHaveBeenCalledWith('note_test_todo_1', expect.objectContaining({
                content: expect.stringContaining('data-checked="true"')
            }));

            // Click to uncheck
            box.click();
            expect(box.getAttribute('data-checked')).toBe('false');
            expect(item.getAttribute('data-checked')).toBe('false');
        });

        it('does not toggle checkbox in read-only mode', () => {
            const readOnlyDiv = window.App.stickerContent.createContent(note, card, true);
            const box = readOnlyDiv.querySelector('.todo-checkbox');
            box.click();
            expect(box.getAttribute('data-checked')).toBe('false');
            expect(window.App.noteManager.updateNote).not.toHaveBeenCalled();
        });

        it('preserves newly created checkbox on first line of an empty note when input event triggers', () => {
            const emptyNote = { id: 'note_empty_first_line', content: '' };
            const emptyDiv = window.App.stickerContent.createContent(emptyNote, card, false);
            document.body.appendChild(emptyDiv);

            // Simulate typing '[]' on first line
            const textNode = document.createTextNode('[]');
            emptyDiv.appendChild(textNode);

            const sel = window.getSelection();
            const range = document.createRange();
            range.setStart(textNode, 2);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);

            // Press space
            const spaceEvent = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
            emptyDiv.dispatchEvent(spaceEvent);

            const createdBox = emptyDiv.querySelector('.todo-checkbox');
            expect(createdBox).not.toBeNull();
            expect(emptyDiv.innerHTML).toContain('todo-checkbox');
            expect(emptyDiv.getAttribute('data-empty')).toBeNull();
        });

        it('automatically adds visual indentation when user types "1." and presses space', () => {
            const emptyNote = { id: 'note_numbered_indent', content: '' };
            const emptyDiv = window.App.stickerContent.createContent(emptyNote, card, false);
            document.body.appendChild(emptyDiv);

            // Simulate typing '1.'
            const textNode = document.createTextNode('1.');
            emptyDiv.appendChild(textNode);

            const sel = window.getSelection();
            const range = document.createRange();
            range.setStart(textNode, 2);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);

            // Press space
            const spaceEvent = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
            emptyDiv.dispatchEvent(spaceEvent);

            expect(textNode.nodeValue).toContain('1.');
            // Should contain non-breaking spaces before 1.
            expect(textNode.nodeValue).toMatch(/^[\s\u00A0]{2,}1\./);
        });

        it('creates a new todo-checkbox with matching class on Enter', () => {
            const todoNote = {
                id: 'note_enter_test',
                content: '<span class="todo-item" data-checked="false"><span class="todo-checkbox" contenteditable="false" data-checked="false"></span>Перший пункт</span>'
            };
            const div = window.App.stickerContent.createContent(todoNote, card, false);
            document.body.appendChild(div);

            const item = div.querySelector('.todo-item');
            const textChild = item.lastChild;

            const sel = window.getSelection();
            const range = document.createRange();
            range.setStart(textChild, textChild.length || 0);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);

            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
            div.dispatchEvent(enterEvent);

            const allCheckboxes = div.querySelectorAll('.todo-checkbox');
            expect(allCheckboxes.length).toBe(2);
        });

        it('automatically continues numbered list when started on line 2 (after <br>)', () => {
            const noteOnLine2 = {
                id: 'note_numbered_line_2_br',
                content: 'Перший рядок тексту<br>1. Пункт списку'
            };
            const div = window.App.stickerContent.createContent(noteOnLine2, card, false);
            document.body.appendChild(div);

            const textNodes = [];
            const walk = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
            while (walk.nextNode()) textNodes.push(walk.currentNode);

            const secondLineText = textNodes[textNodes.length - 1];
            expect(secondLineText.nodeValue).toContain('1. Пункт списку');

            const sel = window.getSelection();
            const range = document.createRange();
            range.setStart(secondLineText, secondLineText.nodeValue.length);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);

            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
            div.dispatchEvent(enterEvent);

            expect(div.innerHTML).toContain('2.');
        });

        it('automatically continues numbered list when started on line 2 (inside separate <div> line)', () => {
            const div = window.App.stickerContent.createContent({ id: 'note_numbered_line_2_div', content: '' }, card, false);
            document.body.appendChild(div);

            const divLine1 = document.createElement('div');
            divLine1.textContent = 'Перший рядок тексту';
            div.appendChild(divLine1);

            const divLine2 = document.createElement('div');
            const textNode2 = document.createTextNode('1. Пункт списку');
            divLine2.appendChild(textNode2);
            div.appendChild(divLine2);

            const sel = window.getSelection();
            const range = document.createRange();
            range.setStart(textNode2, textNode2.nodeValue.length);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);

            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
            div.dispatchEvent(enterEvent);

            expect(div.innerHTML).toContain('2.');
        });

        it('supports two separate numbered lists in the same note', () => {
            const twoListsNote = {
                id: 'note_two_lists',
                content: '1. Пункт А<br>2. Пункт Б'
            };
            const div = window.App.stickerContent.createContent(twoListsNote, card, false);
            document.body.appendChild(div);

            // User enters a blank line (<br>) and starts a new list '1.'
            const br = document.createElement('br');
            div.appendChild(br);

            const newTextNode = document.createTextNode('1.');
            div.appendChild(newTextNode);

            const sel = window.getSelection();
            const range = document.createRange();
            range.setStart(newTextNode, 2);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);

            // Press space
            const spaceEvent = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
            div.dispatchEvent(spaceEvent);

            expect(newTextNode.nodeValue).toMatch(/^[\s\u00A0]{2,}1\./);

            // User types text and presses Enter
            newTextNode.nodeValue += 'Пункт В';
            const range2 = document.createRange();
            range2.setStart(newTextNode, newTextNode.nodeValue.length);
            range2.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range2);

            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
            div.dispatchEvent(enterEvent);

            // Second list must continue with 2., not 3.!
            expect(div.innerHTML).toContain('1.');
            expect(div.innerHTML).toContain('2.');
            expect(div.innerHTML).toContain('Пункт В');
        });
    });
});
