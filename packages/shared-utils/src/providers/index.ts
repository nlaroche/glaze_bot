import type {
  VisionProvider,
  TTSProvider,
  STTProvider,
  CaptureProvider,
} from "@glazebot/shared-types";

type ProviderFactory<T> = () => T;

class ProviderRegistry {
  private vision = new Map<string, ProviderFactory<VisionProvider>>();
  private tts = new Map<string, ProviderFactory<TTSProvider>>();
  private stt = new Map<string, ProviderFactory<STTProvider>>();
  private capture = new Map<string, ProviderFactory<CaptureProvider>>();

  registerVision(id: string, factory: ProviderFactory<VisionProvider>) {
    this.vision.set(id, factory);
  }

  registerTTS(id: string, factory: ProviderFactory<TTSProvider>) {
    this.tts.set(id, factory);
  }

  registerSTT(id: string, factory: ProviderFactory<STTProvider>) {
    this.stt.set(id, factory);
  }

  registerCapture(id: string, factory: ProviderFactory<CaptureProvider>) {
    this.capture.set(id, factory);
  }

  getVision(id: string): VisionProvider {
    const factory = this.vision.get(id);
    if (!factory) throw new Error(`Vision provider "${id}" not registered`);
    return factory();
  }

  getTTS(id: string): TTSProvider {
    const factory = this.tts.get(id);
    if (!factory) throw new Error(`TTS provider "${id}" not registered`);
    return factory();
  }

  getSTT(id: string): STTProvider {
    const factory = this.stt.get(id);
    if (!factory) throw new Error(`STT provider "${id}" not registered`);
    return factory();
  }

  getCapture(id: string): CaptureProvider {
    const factory = this.capture.get(id);
    if (!factory) throw new Error(`Capture provider "${id}" not registered`);
    return factory();
  }
}

export const providerRegistry = new ProviderRegistry();
