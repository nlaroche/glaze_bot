import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EngineEventBus } from '$lib/commentary/events';
import { DebugLogger } from '$lib/commentary/debug-logger';

const mockLogDebug = vi.fn();
const mockPushTtsTiming = vi.fn();
const mockCaptureFrame = vi.fn(() => 1);
const mockSetFrameResponse = vi.fn();
const mockSetFrameSceneContext = vi.fn();

vi.mock('$lib/stores/debug.svelte', () => ({
  logDebug: (...args: unknown[]) => mockLogDebug(...args),
  pushTtsTiming: (...args: unknown[]) => mockPushTtsTiming(...args),
  captureFrame: (...args: unknown[]) => mockCaptureFrame(...args),
  setFrameResponse: (...args: unknown[]) => mockSetFrameResponse(...args),
  setFrameSceneContext: (...args: unknown[]) => mockSetFrameSceneContext(...args),
}));

describe('DebugLogger', () => {
  let bus: EngineEventBus;
  let logger: DebugLogger;

  beforeEach(() => {
    bus = new EngineEventBus();
    logger = new DebugLogger(bus);
    logger.attach();
    vi.clearAllMocks();
  });

  afterEach(() => {
    logger.detach();
    bus.clear();
  });

  it('logs engine lifecycle events', () => {
    bus.emit('engine:started', {});
    expect(mockLogDebug).toHaveBeenCalledWith('info', 'Commentary engine started');

    mockLogDebug.mockClear();
    bus.emit('engine:stopped', {});
    expect(mockLogDebug).toHaveBeenCalledWith('info', 'Commentary engine stopped');

    mockLogDebug.mockClear();
    bus.emit('engine:paused', {});
    expect(mockLogDebug).toHaveBeenCalledWith('info', 'Commentary engine paused');

    mockLogDebug.mockClear();
    bus.emit('engine:resumed', {});
    expect(mockLogDebug).toHaveBeenCalledWith('info', 'Commentary engine resumed');
  });

  it('logs pipeline:frame with size and dimensions', () => {
    bus.emit('pipeline:frame', { requestId: 'r1', size: 5000, width: 1920, height: 1080 });
    expect(mockLogDebug).toHaveBeenCalledWith('frame', { size: 5000, width: 1920, height: 1080 });
  });

  it('logs pipeline:llm-start as llm-request', () => {
    bus.emit('pipeline:llm-start', {
      requestId: 'r1',
      character: 'TestChar',
      historyLength: 4,
      playerText: 'hello',
    });
    expect(mockLogDebug).toHaveBeenCalledWith('llm-request', {
      character: 'TestChar',
      historyLength: 4,
      playerText: 'hello',
    });
  });

  it('logs pipeline:llm-end as llm-response', () => {
    bus.emit('pipeline:llm-end', {
      requestId: 'r1',
      character: 'TestChar',
      text: 'Hello!',
      usage: { input_tokens: 100, output_tokens: 20 },
    });
    expect(mockLogDebug).toHaveBeenCalledWith('llm-response', {
      character: 'TestChar',
      text: 'Hello!',
      usage: { input_tokens: 100, output_tokens: 20 },
    });
  });

  it('logs pipeline:llm-error as error', () => {
    bus.emit('pipeline:llm-error', { requestId: 'r1', error: 'Server Error', status: 500 });
    expect(mockLogDebug).toHaveBeenCalledWith('error', {
      step: 'generate-commentary',
      status: 500,
      message: 'Server Error',
    });
  });

  it('logs pipeline:abort as info', () => {
    bus.emit('pipeline:abort', { requestId: 'r1', reason: 'User message takes priority' });
    expect(mockLogDebug).toHaveBeenCalledWith('info', { message: 'User message takes priority' });
  });

  it('computes TTS timing from event pairs', () => {
    // Simulate the timing chain
    const now = Date.now();
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(now)          // pipeline:start
      .mockReturnValueOnce(now + 100)    // pipeline:llm-start
      .mockReturnValueOnce(now + 500)    // pipeline:tts-start
      .mockReturnValueOnce(now + 800);   // pipeline:tts-end (for pushTtsTiming id)

    bus.emit('pipeline:start', { requestId: 'r1', trigger: 'timed', character: 'TestChar' });
    bus.emit('pipeline:llm-start', { requestId: 'r1', character: 'TestChar', historyLength: 0 });
    bus.emit('pipeline:tts-start', { requestId: 'r1', character: 'TestChar', voiceId: 'v1', textLength: 50, mode: 'buffered' });

    bus.emit('pipeline:tts-end', {
      requestId: 'r1',
      character: 'TestChar',
      mode: 'buffered',
      ttfbMs: 80,
      firstAudioMs: 150,
      totalMs: 400,
      audioSize: 2048,
    });

    expect(mockPushTtsTiming).toHaveBeenCalledOnce();
    const timing = mockPushTtsTiming.mock.calls[0][0];

    // llmDuration = ttsStart - llmStart = 500 - 100 = 400
    expect(timing.llmDuration).toBe(400);
    expect(timing.ttsRequestDuration).toBe(80);
    // ttsTransferDuration = firstAudioMs - ttfbMs = 150 - 80 = 70
    expect(timing.ttsTransferDuration).toBe(70);
    // playbackDuration = totalMs - firstAudioMs = 400 - 150 = 250
    expect(timing.playbackDuration).toBe(250);
    expect(timing.totalDuration).toBe(400);
    expect(timing.audioSize).toBe(2048);
    expect(timing.characterName).toBe('TestChar');
    expect(timing.mode).toBe('buffered');

    vi.restoreAllMocks();
  });

  it('pipeline:end cleans up request timings', () => {
    bus.emit('pipeline:start', { requestId: 'r1', trigger: 'timed', character: 'TestChar' });
    bus.emit('pipeline:end', { requestId: 'r1', trigger: 'timed' });

    // Emitting tts-end now should NOT call pushTtsTiming since timings were cleaned up
    bus.emit('pipeline:tts-end', {
      requestId: 'r1',
      character: 'TestChar',
      mode: 'buffered',
      ttfbMs: 50,
      firstAudioMs: 100,
      totalMs: 200,
      audioSize: 1024,
    });

    expect(mockPushTtsTiming).not.toHaveBeenCalled();
  });

  it('detach() stops all subscriptions', () => {
    logger.detach();

    bus.emit('engine:started', {});
    bus.emit('pipeline:llm-error', { requestId: 'r1', error: 'test' });

    expect(mockLogDebug).not.toHaveBeenCalled();
  });

  it('logs context events', () => {
    bus.emit('context:start', { sceneHistoryLength: 3, detectedGame: 'Fortnite', gameSearchOnCooldown: false });
    expect(mockLogDebug).toHaveBeenCalledWith('context-request', {
      sceneHistoryLength: 3,
      detectedGame: 'Fortnite',
      gameSearchOnCooldown: false,
    });

    mockLogDebug.mockClear();
    bus.emit('context:end', { description: 'A battle scene', game_name: 'Fortnite', usage: { input_tokens: 50, output_tokens: 10 } });
    expect(mockLogDebug).toHaveBeenCalledWith('context-response', {
      description: 'A battle scene',
      game_name: 'Fortnite',
      usage: { input_tokens: 50, output_tokens: 10 },
    });

    mockLogDebug.mockClear();
    bus.emit('context:error', { error: 'Network fail' });
    expect(mockLogDebug).toHaveBeenCalledWith('error', { step: 'context', message: 'Network fail' });
  });

  it('logs STT events', () => {
    bus.emit('stt:start', { mode: 'push-to-talk', key: 'ShiftLeft' });
    expect(mockLogDebug).toHaveBeenCalledWith('stt-request', { mode: 'push-to-talk', key: 'ShiftLeft' });

    mockLogDebug.mockClear();
    bus.emit('stt:end', { mode: 'push-to-talk', text: 'Hello world' });
    expect(mockLogDebug).toHaveBeenCalledWith('stt-response', { mode: 'push-to-talk', text: 'Hello world' });
  });

  it('recordFrame delegates to captureFrame', () => {
    const id = logger.recordFrame('data:image/png;base64,abc');
    expect(mockCaptureFrame).toHaveBeenCalledWith('data:image/png;base64,abc');
    expect(id).toBe(1);
  });

  it('recordFrameResponse delegates to setFrameResponse', () => {
    logger.recordFrameResponse(1, 'AI says hello');
    expect(mockSetFrameResponse).toHaveBeenCalledWith(1, 'AI says hello');
  });
});
