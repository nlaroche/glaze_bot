import { describe, it, expect, vi } from 'vitest';
import { EngineEventBus } from '$lib/commentary/events';

describe('EngineEventBus', () => {
  it('on() receives emitted events', () => {
    const bus = new EngineEventBus();
    const handler = vi.fn();
    bus.on('engine:started', handler);

    bus.emit('engine:started', {});

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({});
  });

  it('on() returns a working unsubscribe function', () => {
    const bus = new EngineEventBus();
    const handler = vi.fn();
    const unsub = bus.on('engine:started', handler);

    bus.emit('engine:started', {});
    expect(handler).toHaveBeenCalledOnce();

    unsub();
    bus.emit('engine:started', {});
    expect(handler).toHaveBeenCalledOnce(); // still 1, not 2
  });

  it('clear() removes all listeners', () => {
    const bus = new EngineEventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    bus.on('engine:started', handler1);
    bus.on('engine:stopped', handler2);

    bus.clear();

    bus.emit('engine:started', {});
    bus.emit('engine:stopped', {});
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  it('multiple listeners on same event all fire', () => {
    const bus = new EngineEventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const handler3 = vi.fn();
    bus.on('engine:started', handler1);
    bus.on('engine:started', handler2);
    bus.on('engine:started', handler3);

    bus.emit('engine:started', {});

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
    expect(handler3).toHaveBeenCalledOnce();
  });

  it('listener errors do not break other listeners', () => {
    const bus = new EngineEventBus();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const handler1 = vi.fn();
    const handler2 = vi.fn(() => { throw new Error('boom'); });
    const handler3 = vi.fn();

    bus.on('engine:started', handler1);
    bus.on('engine:started', handler2);
    bus.on('engine:started', handler3);

    bus.emit('engine:started', {});

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
    expect(handler3).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledOnce();

    errorSpy.mockRestore();
  });

  it('emitting event with no listeners does not throw', () => {
    const bus = new EngineEventBus();
    expect(() => bus.emit('engine:started', {})).not.toThrow();
  });

  it('passes correct data to listeners', () => {
    const bus = new EngineEventBus();
    const handler = vi.fn();
    bus.on('pipeline:start', handler);

    const data = { requestId: 'req-1', trigger: 'timed' as const, character: 'TestChar' };
    bus.emit('pipeline:start', data);

    expect(handler).toHaveBeenCalledWith(data);
  });
});
