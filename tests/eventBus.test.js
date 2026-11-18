import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../js/eventBus.js';

describe('EventBus', () => {
    let bus;

    beforeEach(() => {
        bus = window.App.events;
        bus.clear();
    });

    it('should register and trigger event handlers', () => {
        const handler = vi.fn();
        bus.on('test:event', handler);

        bus.emit('test:event', { payload: 123 });
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({ payload: 123 });
    });

    it('should support unsubscribing via off()', () => {
        const handler = vi.fn();
        bus.on('test:event', handler);
        bus.off('test:event', handler);

        bus.emit('test:event', 'data');
        expect(handler).not.toHaveBeenCalled();
    });

    it('should support unsubscribing via returned teardown function', () => {
        const handler = vi.fn();
        const unsubscribe = bus.on('test:event', handler);
        unsubscribe();

        bus.emit('test:event', 'data');
        expect(handler).not.toHaveBeenCalled();
    });

    it('should support once() single invocation', () => {
        const handler = vi.fn();
        bus.once('single:event', handler);

        bus.emit('single:event', 'first');
        bus.emit('single:event', 'second');

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith('first');
    });

    it('should safely catch errors inside handlers without stopping other listeners', () => {
        const spyError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const faultyHandler = vi.fn(() => {
            throw new Error('Boom');
        });
        const goodHandler = vi.fn();

        bus.on('error:test', faultyHandler);
        bus.on('error:test', goodHandler);

        bus.emit('error:test', true);

        expect(faultyHandler).toHaveBeenCalled();
        expect(goodHandler).toHaveBeenCalled();
        spyError.mockRestore();
    });
});
