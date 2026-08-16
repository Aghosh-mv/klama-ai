import Openwakeword from 'react-native-openwakeword';
import { Audio } from 'expo-av';
import { Platform, Alert } from 'react-native';

export interface WakeWordEvent {
  timestamp: number;
  probability: number;
  isWakingWord: boolean;
  detectedWord?: string;
}

export class WakeWordService {
  private listener: NodeJS.Timeout | null = null;
  private onWakeWord: ((event: WakeWordEvent) => void) | null = null;
  private isListening: boolean = false;
  private readonly DEFAULT_THRESHOLD = 0.5;

  constructor() {}

  async initialize(modelPaths: {
    melspectrogram: string;
    embedding: string;
    wakeWord: string;
  }): Promise<boolean> {
    try {
      const loaded = await Openwakeword.loadModels(
        modelPaths.melspectrogram,
        modelPaths.embedding,
        modelPaths.wakeWord
      );
      return loaded;
    } catch (error) {
      console.error('Failed to load wake word models:', error);
      Alert.alert('Error', 'Failed to load wake word models. Please ensure .onnx model files are in the assets directory.');
      return false;
    }
  }

  async startListening(onWakeWord: (event: WakeWordEvent) => void): Promise<void> {
    this.onWakeWord = onWakeWord;
    this.isListening = true;

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.error('Microphone permission not granted');
        this.isListening = false;
        return;
      }

      const recording = await Audio.Recording.makeAsync({
        audio: {
          sampleRate: 16000,
          channelNumber: 1,
          encoding: 'PCM_16BIT',
        },
        android: {
          audioSource: 'DEFAULT',
          outputFormat: 'DEFAULT',
          bitRate: 128000,
        },
        ios: {
          audioSource: 'DEFAULT',
          outputFormat: 'DEFAULT',
          bitRate: 128000,
        },
      });

      await recording.prepareToRecordAsync();
      await recording.startAsync();

      this.listener = setInterval(async () => {
        if (!this.isListening) return;

        try {
          const buffer = await recording.readAsync();
          const pcmData = buffer.data;

          // Convert Int16Array to float32 for open wakeword
          const float32Data = new Float32Array(pcmData.length);
          for (let i = 0; i < pcmData.length; i++) {
            float32Data[i] = pcmData[i] / 32768.0;
          }

          // Feed to open wakeword
          const result = await Openwakeword.processBuffer(float32Data);

          if (result && result.isWakingWord) {
            const event: WakeWordEvent = {
              timestamp: Date.now(),
              probability: result.probability !== undefined ? result.probability : 0,
              isWakingWord: true,
              detectedWord: result.detectedWord || 'Custom Wake Word',
            };
            this.onWakeWord?.(event);
          }
        } catch (processError) {
          console.error('Error processing buffer:', processError);
        }
      }, 100);

      console.log('Wake word listening started');

    } catch (error) {
      console.error('Error starting wake word listening:', error);
      this.isListening = false;
    }
  }

  stopListening(): void {
    this.isListening = false;
    if (this.listener) {
      clearInterval(this.listener);
      this.listener = null;
    }
    Openwakeword.unloadModels();
    console.log('Wake word listening stopped');
  }

  static getDefaultModelPaths(basePath: string): {
    melspectrogram: string;
    embedding: string;
    wakeWord: string;
  } {
    return {
      melspectrogram: `${basePath}/melspectrogram.onnx`,
      embedding: `${basePath}/embedding_model.onnx`,
      wakeWord: `${basePath}/hey_jarvis.onnx`,
    };
  }
}

export default WakeWordService;