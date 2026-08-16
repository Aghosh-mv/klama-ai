import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  PermissionsAndroid,
  FlatList,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  BackHandler,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import WakeWordService, { WakeWordEvent } from './src/wakeWordService';
import { aiAssistant } from './src/AIAssistant';
import {
  runAction,
  GameSpec,
  speak,
  getAssistantName,
  listenOnce,
  extractCommand,
  getStopWord,
  setAssistantName,
  setStopWord,
} from './src/tools';
import GamePanel from './src/GamePanel';
import SetupWizard from './src/SetupWizard';
import GamePanel from './src/GamePanel';
import SetupWizard from './src/SetupWizard';

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
  const [conversation, setConversation] = useState([]);
  const [modelPaths, setModelPaths] = useState(null);
  const [game, setGame] = useState(null);
  const [gameFeedback, setGameFeedback] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [assistantReady, setAssistantReady] = useState(false);

  // Load saved settings on mount
  useEffect(() => {
    (async () => {
      // Check if first launch (no API key saved)
      const savedKey = aiAssistant.getMemory('api_key') || '';
      const savedName = aiAssistant.getMemory('assistant_name') || null;
      const setupComplete = aiAssistant.getMemory('setup_complete') === 'true';

      if (savedKey) setAPIKey(savedKey);
      if (!setupComplete) {
        setShowSetup(true);
      } else if (savedName) {
        setAssistantReady(true);
        // Start wake word if models available
        if (modelPaths) {
          const started = await WakeWordService.initialize(modelPaths);
          if (started) {
            WakeWordService.startListening(handleWakeWord);
            setStatusText('Listening for "' + savedName + '"...');
          }
        }
      }
    })();
  }, [modelPaths]);

  // Request permissions on Android
  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        try {
          const status = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            {
              title: 'Microphone Access',
              message: 'Needed for wake word detection',
              buttonNeutral: 'Ask Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );
          if (status !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert('Permission Required', 'Microphone access is needed for wake word detection');
          }
        } catch (err) {
          console.error('Permission error:', err);
        }
      }
    })();
  }, []);

  // Handle back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackExit', () => true);
    return () => backHandler.remove();
  }, []);

  const handleSetupComplete = useCallback((settings) => {
    if (!settings.apiKey || !settings.assistantName || !settings.wakeWord) {
      Alert.alert('Setup Incomplete', 'Please fill in all required fields');
      return;
    }

    setAPIKey(settings.apiKey);
    setAssistantName(settings.assistantName);

    // Save all settings
    aiAssistant.setMemory('api_key', settings.apiKey);
    aiAssistant.setMemory('assistant_name', settings.assistantName);
    aiAssistant.setMemory('wake_word', settings.wakeWord);
    aiAssistant.setMemory('setup_complete', 'true');
    aiAssistant.setMemory('response_style', settings.responseStyle);
    aiAssistant.setMemory('humor_level', settings.humorLevel);
    aiAssistant.setMemory('voice_style', settings.voiceStyle);
    aiAssistant.setMemory('formality', settings.formality);
    aiAssistant.setMemory('privacy_level', settings.privacyLevel);
    aiAssistant.setMemory('notification_style', settings.notificationStyle);
    aiAssistant.setMemory('always_listening', settings.alwaysListening);
    aiAssistant.setMemory('location_services', settings.locationServices);
    aiAssistant.setMemory('theme_color', settings.themeColor);
    aiAssistant.setMemory('startup_message', settings.startupMessage);
    aiAssistant.setMemory('custom_commands', settings.customCommands);

    // Default: no stop word — process immediately after wake word
    setStopWord('');

    setShowSetup(false);
    setAssistantReady(true);
    loadModels(settings.wakeWord);
  }, []);

  const loadModels = useCallback(async (wordName) => {
    const modelMap = {
      Jarvis: 'hey_jarvis.onnx',
      Assistant: 'hey_assistant.onnx',
      Computer: 'hey_computer.onnx',
    };

    const modelFile = modelMap[wordName];
    if (!modelFile) return;

    const basePath = `${MODEL_DIR}/${wordName.toLowerCase()}`;
    const paths = WakeWordService.getDefaultModelPaths(basePath);
    setModelPaths(paths);

    const loaded = await WakeWordService.initialize(paths);
    if (loaded) {
      setStatusText(`Ready! Say "${wordName}..."`);
      WakeWordService.startListening(handleWakeWord);
    }
  }, [handleWakeWord]);

  const handleWakeWord = useCallback(async (event) => {
    setWakeWordDetected(true);
    const stopWord = getStopWord();
    const listenPrompt = stopWord
      ? `Say "${stopWord}" when you're done`
      : 'Speak your command';
    setStatusText(`${event.detectedWord} heard — ${listenPrompt}`);
    setConversation(prev => [...prev, `${event.detectedWord} woke up. Listening...`]);
    if (!isMuted) {
      speak(`Yes? ${stopWord ? `Say ${stopWord} when done.` : 'Go ahead.'}`);
    }

    setIsListening(true);
    const transcript = await listenOnce(listenPrompt);
    setIsListening(false);

    if (!transcript) {
      setStatusText('Did not catch that.');
      return;
    }

    const command = stopWord ? extractCommand(transcript) : transcript.trim();
    if (!command) {
      setStatusText('No command detected.');
      return;
    }

    setConversation(prev => [...prev, 'You: ' + command]);
    const acted = await handleAction(command);
    if (!acted) {
      if (!apiKey) {
        Alert.alert('Need API key', 'Enter your AI API key to chat.');
        setStatusText('Ready');
        return;
      }
      setStatusText('Processing...');
      const response = await aiAssistant.respond(command);
      if (response) {
        setConversation(prev => [...prev, getAssistantName() + ': ' + response.text]);
        if (!isMuted) speak(response.text);
        await aiAssistant.scheduleNotification('Klama AI', response.text, 5);
      }
    }
    setStatusText('Listening...');
  }, [apiKey, handleAction, isMuted]);

  const handleAction = useCallback(async (text) => {
    const action = await runAction(text);
    if (!action.handled) return false;

    setConversation(prev => [
      ...prev,
      'You: ' + text,
      getAssistantName() + ': ' + action.message,
    ]);

    if (action.game) {
      setGame(action.game);
      setGameFeedback('');
    }

    if (!isMuted) speak(action.message);
    await aiAssistant.scheduleNotification('Klama AI', action.message, 5);
    setStatusText('Listening...');
    return true;
  }, [isMuted]);

  const sendToAI = useCallback(async (text) => {
    if (!text.trim()) return;
    if (!apiKey) {
      Alert.alert('Error', 'Please enter an AI API key');
      return;
    }

    const didAction = await handleAction(text);
    if (didAction) return;

    setStatusText('Processing...');
    const response = await aiAssistant.respond(text);
    if (response) {
      setConversation(prev => [
        ...prev,
        'You: ' + text,
        getAssistantName() + ': ' + response.text,
      ]);
      if (!isMuted) speak(response.text);
      await aiAssistant.scheduleNotification('Assistant Response', response.text, 5);
    }
    setStatusText('Listening...');
  }, [apiKey, handleAction, isMuted]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.gradient}>
        {/* Setup Wizard */}
        <SetupWizard
          visible={showSetup}
          onComplete={handleSetupComplete}
          onSkip={() => setShowSetup(false)}
        />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>KLAMA.AI</Text>
            <Text style={styles.headerSubtitle}>Your personal voice assistant</Text>
          </View>
          <View style={styles.headerControls}>
            <TouchableOpacity
              style={[styles.iconBtn, isMuted && styles.iconBtnActive]}
              onPress={() => setIsMuted(!isMuted)}
            >
              <MaterialCommunityIcons
                name={isMuted ? "microphone-off" : "microphone"}
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setShowSetup(true)}
            >
              <MaterialCommunityIcons name="cog" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Status */}
        <View style={styles.statusBar}>
          <View style={[styles.statusDot, isListening && styles.statusActive]} />
          <Text style={styles.statusText}>{statusText}</Text>
        </View>

        {/* Conversation */}
        <FlatList
          data={conversation}
          renderItem={({ item }) => (
            <View style={styles.messageBubble}>
              <Text style={styles.messageText}>{item}</Text>
            </View>
          )}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={styles.messageList}
        />

        {/* Game Panel */}
        {game && (
          <GamePanel
            game={game}
            feedback={gameFeedback}
            setFeedback={setGameFeedback}
            onClose={() => setGame(null)}
          />
        )}

        {/* Input Area */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.inputWrapper}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.inputContainer}>
              <TextInput
                placeholder="Type a command..."
                value={apiKey ? '' : apiKey}
                onChangeText={setAPIKey}
                style={styles.textInput}
                placeholderTextColor="#888"
                onSubmitEditing={({ nativeEvent }) => sendToAI(nativeEvent.text)}
              />
              <TouchableOpacity
                style={[styles.sendBtn, isListening && styles.sendBtnActive]}
                onPress={sendToAI}
                disabled={!apiKey}
              >
                <MaterialCommunityIcons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>

          {/* Quick Actions */}
          <View style={styles.actionGrid}>
            {[
              { icon: 'clock-outline', label: 'Time', cmd: 'what time is it' },
              { icon: 'weather-partly-cloudy', label: 'Weather', cmd: 'what is the weather' },
              { icon: 'calendar-clock', label: 'Reminder', cmd: 'remind me to call mom in 30 minutes' },
              { icon: 'weather-lightning', label: 'Game', cmd: 'let us play trivia' },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.actionBtn}
                onPress={() => sendToAI(item.cmd)}
              >
                <MaterialCommunityIcons name={item.icon} size={24} color="#00d4ff" />
                <Text style={styles.actionLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1, paddingTop: 50 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  headerTop: { flex: 1 },
  headerTitle: { color: '#00d4ff', fontSize: 24, fontWeight: 'bold' },
  headerSubtitle: { color: '#888', fontSize: 13, marginTop: 2 },
  headerControls: { flexDirection: 'row', gap: 10 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#23375c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: { backgroundColor: '#00d4ff' },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#555',
    marginRight: 8,
  },
  statusActive: { backgroundColor: '#00ff88' },
  statusText: { color: '#ccc', fontSize: 14 },
  messageList: { padding: 20, paddingBottom: 10 },
  messageBubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    backgroundColor: '#23375c',
    alignSelf: 'flex-start',
  },
  messageText: { color: '#e0e0e0', fontSize: 15, lineHeight: 20 },
  inputWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#23375c',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00d4ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: { backgroundColor: '#0099cc' },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 6,
  },
  actionLabel: { color: '#aaa', fontSize: 12, marginTop: 4 },
});
