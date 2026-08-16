import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  PermissionsAndroid,
  FlatList,
  ScrollView,
  TextInput,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Location from 'expo-location';

import WakeWordService, { WakeWordEvent } from './src/wakeWordService';
import { aiAssistant } from './src/AIAssistant';
import { runAction, GameSpec, speak, getAssistantName } from './src/tools';

const MODEL_DIR = 'assets/models';

const DEFAULT_WORDS = [
  { name: 'Jarvis', model: 'hey_jarvis.onnx' },
  { name: 'Assistant', model: 'hey_assistant.onnx' },
  { name: 'Computer', model: 'hey_computer.onnx' },
];

export default function App() {
  const [apiKey, setAPIKey] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [wakeWordDetected, setWakeWordDetected] = useState(false);
  const [statusText, setStatusText] = useState('Idle');
  const [conversation, setConversation] = useState<string[]>([]);
  const [modelPaths, setModelPaths] = useState<{
    melspectrogram: string;
    embedding: string;
    wakeWord: string;
  } | null>(null);
  const [game, setGame] = useState<GameSpec | null>(null);
  const [gameFeedback, setGameFeedback] = useState('');

  useEffect(() => {
    (async () => {
      // Request microphone permission on Android
      if (Platform.OS === 'android') {
        try {
          const status = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            {
              title: 'Wake Word Assistant',
              message: 'This app needs microphone access to detect wake words and voice commands',
              buttonNeutral: 'Ask Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );
          if (status !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert('Permission Required', 'Microphone permission is required for wake word detection');
          }
        } catch (err) {
          console.error('Permission request error:', err);
        }
      }
    })();
  }, []);

  useEffect(() => {
    // Initialize notifications
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShow: true,
        refresh: false,
      }),
    });
  }, []);

  const loadModels = useCallback(async (wordName: string) => {
    const modelMap: Record<string, string> = {
      Jarvis: 'hey_jarvis.onnx',
      Assistant: 'hey_assistant.onnx',
      Computer: 'hey_computer.onnx',
    };

    const modelFile = modelMap[wordName];
    if (!modelFile) {
      Alert.alert('Error', 'Unknown wake word model');
      return;
    }

    const basePath = `${MODEL_DIR}/${wordName.toLowerCase()}`;
    setModelPaths(WakeWordService.getDefaultModelPaths(basePath));

    const loaded = await WakeWordService.initialize(setModelPaths!);
    if (loaded) {
      setStatusText(`Model loaded: ${wordName}`);
      Alert.alert('Success', `Wake word model "${wordName}" loaded successfully!`);
    }
  }, []);

  const handleWakeWord = useCallback(async (event: WakeWordEvent) => {
    setWakeWordDetected(true);
    setStatusText(`Wake word detected! (${event.detectedWord})`);
    setConversation(prev => [...prev, `Wake word: ${event.detectedWord} (${event.probability.toFixed(2)})`]);

    // Start recording user command
    try {
      const { recording } = await Audio.Recording.makeAsync({
        audio: {
          sampleRate: 16000,
          channelNumber: 1,
          encoding: 'PCM_16BIT',
        },
        android: { audioSource: 'DEFAULT' },
        ios: { audioSource: 'DEFAULT' },
      });

      await recording.prepareToRecordAsync();
      await recording.startAsync();

      setIsListening(true);

      // Record for 3 seconds
      const timeoutId = setTimeout(async () => {
        await recording.stopAndUnloadAsync();
        const buffer = await recording.getContentsAsync();
        const pcmData = buffer.data;

        const float32Data = new Float32Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
          float32Data[i] = pcmData[i] / 32768.0;
        }

        if (modelPaths) {
          const result = await Openwakeword.processBuffer(float32Data, modelPaths);

          if (result && result.isWakingWord) {
            // Placeholder command — replace with real STT later.
            // For now we demonstrate the action layer with a sample prompt.
            await sendToAI('What time is it?');
          }
        }
        setIsListening(false);
      }, 3000);

      return () => clearTimeout(timeoutId);
    } catch (err) {
      console.error('Recording error:', err);
      setIsListening(false);
    }
  }, [modelPaths]);

  const handleAction = useCallback(async (text: string) => {
    const action = await runAction(text);
    if (!action.handled) return false;

    setConversation(prev => [...prev, 'You: ' + text]);
    setConversation(prev => [...prev, getAssistantName() + ': ' + action.message]);

    if (action.game) {
      setGame(action.game);
      setGameFeedback('');
    }

    speak(action.message);
    await aiAssistant.scheduleNotification('Klama AI', action.message, 5);
    setStatusText('Ready');
    return true;
  }, []);

  const sendToAI = useCallback(async (text: string) => {
    if (!text.trim()) return;
    if (!apiKey) {
      Alert.alert('Error', 'Please enter an API key first');
      return;
    }

    // Try real device actions first (reminders, time, weather, search, games…)
    const didAction = await handleAction(text);
    if (didAction) return;

    setStatusText('Processing...');
    const response = await aiAssistant.respond(text);

    if (response) {
      setConversation(prev => [...prev, 'You: ' + text]);
      setConversation(prev => [...prev, getAssistantName() + ': ' + response.text]);
      speak(response.text);
      await aiAssistant.scheduleNotification(
        'Assistant Response',
        response.text,
        5
      );
    }
    setStatusText('Ready');
  }, [apiKey, handleAction]);

  const trainCustomModel = useCallback(async (wordName: string) => {
    Alert.alert(
      'Train Custom Model',
      'Custom wake word training is available via the openWakeWord Colab notebook. Would you like to open it?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Colab',
          onPress: () => {
            window.open('https://colab.research.google.com/drive/1q1oe2zOyZp7UsB3jJiQ1IFn8z5YfjwEb?usp=sharing', '_system');
          },
        },
      ]
    );
  }, []);

  useEffect(() => {
    // Initialize background fetch for always-on listening (when app is in background)
    BackgroundFetch.registerTaskAsync('wake-word-detector', {
      // This will be called when the system wants to fetch
      // In a real implementation, you'd check for wake word here
      // minBackgroundFetchInterval: 15 * 60, // 15 minutes
    });
  }, []);

  const startWakeWordListening = useCallback(() => {
    if (!modelPaths) {
      Alert.alert('Error', 'Please load a wake word model first');
      return;
    }
    WakeWordService.startListening(handleWakeWord);
    setIsListening(true);
    setStatusText('Listening for wake word...');
  }, [handleWakeWord, modelPaths]);

  const stopWakeWordListening = useCallback(() => {
    WakeWordService.stopListening();
    setIsListening(false);
    setStatusText('Idle');
  }, []);

  const renderWordButtons = () => {
    if (!modelPaths) {
      return DEFAULT_WORDS.map((word) => (
        <TouchableOpacity
          key={word.name}
          style={[styles.wordBtn, styles.inactiveWord]}
          onPress={() => loadModels(word.name)}
        >
          <Text style={styles.wordText}>{word.name}</Text>
        </TouchableOpacity>
      ));
    }
    // If models are loaded, show the custom word buttons
    return [
      <TouchableOpacity
        key="jarvis"
        style={[styles.wordBtn, styles.activeWord]}
        onPress={() => loadModels('Jarvis')}
      >
        <Text style={styles.wordText}>Jarvis</Text>
      </TouchableOpacity>,
      <TouchableOpacity
        key="assistant"
        style={[styles.wordBtn, {}]}
        onPress={() => loadModels('Assistant')}
      >
        <Text style={styles.wordText}>Assistant</Text>
      </TouchableOpacity>,
      <TouchableOpacity
        key="computer"
        style={[styles.wordBtn, {}]}
        onPress={() => loadModels('Computer')}
      >
        <Text style={styles.wordText}>Computer</Text>
      </TouchableOpacity>,
    ];
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <FlatList
        data={conversation}
        renderItem={({ item }) => <Text style={styles.message}>{item}</Text>}
        keyExtractor={(item, index) => index.toString()}
        contentContainerStyle={styles.list}
      />

      <View style={styles.inputArea}>
        <TextInput
          placeholder="Enter your AI API key (Gemini/OpenAI)..."
          value={apiKey}
          onChangeText={setAPIKey}
          style={styles.input}
          returnKeyType="send"
          onSubmitEditing={() => sendToAI(apiKey)}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={() => sendToAI(apiKey)}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity style={[styles.button, isListening ? styles.active : styles.inactive]} onPress={startWakeWordListening}>
          <Text style={styles.buttonText}>Start Listening</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, !isListening ? styles.active : styles.inactive]} onPress={stopWakeWordListening}>
          <Text style={styles.buttonText}>Stop</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.wordSelect}>
        {renderWordButtons()}
      </View>

      {game && (
        <GamePanel
          game={game}
          feedback={gameFeedback}
          setFeedback={setGameFeedback}
          onClose={() => setGame(null)}
        />
      )}
    </View>
  );
}

function GamePanel({ game, feedback, setFeedback, onClose }: {
  game: GameSpec;
  feedback: string;
  setFeedback: (s: string) => void;
  onClose: () => void;
}) {
  const [guess, setGuess] = useState('');
  const [rpsChoice, setRpsChoice] = useState('');

  if (game.type === 'guess') {
    return (
      <View style={styles.gamePanel}>
        <Text style={styles.gameTitle}>{game.title}</Text>
        <TextInput
          style={styles.input}
          placeholder="Your guess (1-100)"
          keyboardType="numeric"
          value={guess}
          onChangeText={setGuess}
        />
        <TouchableOpacity
          style={styles.sendBtn}
          onPress={() => {
            const g = parseInt(guess, 10);
            const ans = parseInt(game.answer || '', 10);
            if (g === ans) setFeedback('Correct! 🎉');
            else if (g < ans) setFeedback('Too low.');
            else setFeedback('Too high.');
          }}
        >
          <Text style={styles.sendText}>Guess</Text>
        </TouchableOpacity>
        <Text style={styles.gameFeedback}>{feedback}</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (game.type === 'trivia') {
    return (
      <View style={styles.gamePanel}>
        <Text style={styles.gameTitle}>{game.title}</Text>
        <Text style={styles.triviaQ}>{game.content}</Text>
        <TextInput
          style={styles.input}
          placeholder="Your answer"
          value={guess}
          onChangeText={setGuess}
        />
        <TouchableOpacity
          style={styles.sendBtn}
          onPress={() => {
            if (guess.trim().toLowerCase() === (game.answer || '').toLowerCase())
              setFeedback('Correct! 🎉');
            else setFeedback('Not quite. Answer: ' + game.answer);
          }}
        >
          <Text style={styles.sendText}>Answer</Text>
        </TouchableOpacity>
        <Text style={styles.gameFeedback}>{feedback}</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // rps
  const options = ['Rock', 'Paper', 'Scissors'];
  const beats: Record<string, string> = {
    Rock: 'Scissors',
    Paper: 'Rock',
    Scissors: 'Paper',
  };
  return (
    <View style={styles.gamePanel}>
      <Text style={styles.gameTitle}>{game.title}</Text>
      <View style={styles.rpsRow}>
        {options.map((o) => (
          <TouchableOpacity
            key={o}
            style={styles.rpsBtn}
            onPress={() => {
              const cpu = options[Math.floor(Math.random() * 3)];
              if (o === cpu) setFeedback('Draw! CPU also chose ' + cpu);
              else if (beats[o] === cpu)
                setFeedback('You win! CPU chose ' + cpu);
              else setFeedback('You lose. CPU chose ' + cpu);
            }}
          >
            <Text style={styles.rpsText}>{o}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.gameFeedback}>{feedback}</Text>
      <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
        <Text style={styles.closeText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  message: {
    marginBottom: 8,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    maxWidth: '80%',
    marginRight: 'auto',
    marginLeft: 'auto',
  },
  list: {
    maxHeight: 200,
    paddingBottom: 10,
  },
  inputArea: {
    flexDirection: 'row',
    marginTop: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    height: 50,
    fontSize: 16,
  },
  sendBtn: {
    backgroundColor: '#0066ff',
    paddingHorizontal: 20,
    borderRadius: 20,
    marginHorizontal: 8,
  },
  sendText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  buttons: {
    flexDirection: 'row',
    marginTop: 20,
    alignItems: 'center',
  },
  button: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  active: {
    backgroundColor: '#0066ff',
  },
  inactive: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  wordSelect: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordBtn: {
    flex: 1,
    padding: 8,
    borderRadius: 6,
    marginHorizontal: 2,
    backgroundColor: '#e0e0e0',
  },
  activeWord: {
    backgroundColor: '#0066ff',
  },
  inactiveWord: {
    backgroundColor: '#ccc',
  },
  wordText: {
    color: '#333',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 14,
  },
});