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
import { MaterialCommunityIcons } from '@expo/vector-icons';

import WakeWordService, { WakeWordEvent } from './src/wakeWordService';
import { aiAssistant } from './src/AIAssistant';
import {
  runAction,
  speak,
  getAssistantName,
  listenOnce,
  extractCommand,
  getStopWord,
  setStopWord,
  setAssistantName,
  getVolumeHint,
  saveConversationEntry,
  getConversationHistory,
} from './src/tools';
import GamePanel from './src/GamePanel';
import SetupWizard from './src/SetupWizard';

const MODEL_DIR = 'assets/models';

const QUICK_ACTIONS = [
  { icon: 'clock-outline', label: 'Time', cmd: 'what time is it' },
  { icon: 'weather-partly-cloudy', label: 'Weather', cmd: 'what is the weather' },
  { icon: 'calendar-clock', label: 'Reminder', cmd: 'remind me to call mom in 30 minutes' },
  { icon: 'weather-lightning', label: 'Game', cmd: 'let us play trivia' },
  { icon: 'alarm-light', label: 'Alarm', cmd: 'set an alarm for 7 am' },
  { icon: 'bell-check', label: 'Timer', cmd: 'start a 10 minute timer' },
];

export default function App() {
  const [apiKey, setAPIKey] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [statusText, setStatusText] = useState('Idle');
  const [conversation, setConversation] = useState([]);
  const [modelPaths, setModelPaths] = useState(null);
  const [game, setGame] = useState(null);
  const [gameFeedback, setGameFeedback] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [assistantReady, setAssistantReady] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [viewMode, setViewMode] = useState('voice'); // 'voice' | 'chat'

  // Load saved settings on mount
  useEffect(() => {
    (async () => {
      const savedKey = aiAssistant.getMemory('api_key') || '';
      const setupComplete = aiAssistant.getMemory('setup_complete') === 'true';

      if (savedKey) setAPIKey(savedKey);

      if (!setupComplete) {
        setShowSetup(true);
      } else {
        const savedName = aiAssistant.getMemory('assistant_name') || null;
        setAssistantName(savedName || 'Klama');
        setAssistantReady(true);
        await loadModels(savedName || 'Klama');
      }

      // Load conversation history
      const history = await getConversationHistory();
      setConversation(history.map((h) => `${h.role}: ${h.text}`));
    })();
  }, []);

  // Request permissions
  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        try {
          const status = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          ]);
        } catch (err) {
          console.warn('Permission error:', err);
        }
      }
    })();
  }, []);

  // Back handler
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackExit', () => true);
    return () => backHandler.remove();
  }, []);

  const loadModels = useCallback(async (wordName) => {
    const modelMap = {
      Jarvis: 'hey_jarvis.onnx',
      Assistant: 'hey_assistant.onnx',
      Computer: 'hey_computer.onnx',
    };
    const modelFile = modelMap[wordName];
    if (!modelFile) return false;
    const basePath = `${MODEL_DIR}/${wordName.toLowerCase()}`;
    const paths = WakeWordService.getDefaultModelPaths(basePath);
    setModelPaths(paths);

    const loaded = await WakeWordService.initialize(paths);
    if (loaded) {
      setStatusText(`Ready! Say "${wordName}..."`);
      WakeWordService.startListening(handleWakeWord);
    }
    return loaded;
  }, [handleWakeWord]);

  const handleSetupComplete = useCallback((settings) => {
    if (!settings.apiKey || !settings.assistantName || !settings.wakeWord) {
      Alert.alert('Setup Incomplete', 'Please fill in all required fields');
      return;
    }

    setAPIKey(settings.apiKey);
    setAssistantName(settings.assistantName);

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

    if (settings.dailyFuel) aiAssistant.setMemory('daily_fuel', settings.dailyFuel);
    if (settings.energyType) aiAssistant.setMemory('energy_type', settings.energyType);
    if (settings.vibe) aiAssistant.setMemory('vibe', settings.vibe);

    setStopWord('');
    setShowSetup(false);
    setAssistantReady(true);
    loadModels(settings.assistantName);
  }, [loadModels]);

  const handleAction = useCallback(async (text, volumeHint) => {
    const action = await runAction(text);
    if (!action.handled) return false;

    const name = getAssistantName();
    setConversation((prev) => [...prev, `You: ${text}`, `${name}: ${action.message}`]);
    saveConversationEntry({ role: 'user', text, timestamp: Date.now() });
    saveConversationEntry({ role: 'assistant', text: action.message, timestamp: Date.now() });

    if (action.game) {
      setGame(action.game);
      setGameFeedback('');
    }

    if (!isMuted) speak(action.message, volumeHint);
    setStatusText('Listening...');
    return true;
  }, [isMuted]);

  const sendToAI = useCallback(async (text) => {
    if (!text.trim()) return;
    const didAction = await handleAction(text);
    if (didAction) return;

    if (!apiKey) {
      Alert.alert('Need API Key', 'Enter your AI API key to chat.');
      return;
    }

    setStatusText('Processing...');
    const response = await aiAssistant.respond(text);
    if (response) {
      const name = getAssistantName();
      setConversation((prev) => [...prev, `You: ${text}`, `${name}: ${response.text}`]);
      saveConversationEntry({ role: 'user', text, timestamp: Date.now() });
      saveConversationEntry({ role: 'assistant', text: response.text, timestamp: Date.now() });
      if (!isMuted) speak(response.text);
      setStatusText('Listening...');
    }
  }, [apiKey, handleAction, isMuted]);

  const handleWakeWord = useCallback(async (event) => {
    setWakeWordDetected(true);
    const stopWord = getStopWord();
    const listenPrompt = stopWord ? `Say "${stopWord}" when done` : 'Speak your command';
    setStatusText(`${event.detectedWord} heard — ${listenPrompt}`);
    const name = getAssistantName();
    setConversation((prev) => [...prev, `${event.detectedWord} woke up. Listening...`]);
    if (!isMuted) speak(`Yes? ${stopWord ? `Say ${stopWord} when done.` : 'Go ahead.'}`);

    setIsListening(true);
    const result = await listenOnce(listenPrompt);
    setIsListening(false);

    if (!result) {
      setStatusText('Did not catch that.');
      return;
    }

    // result could be text, or { text, volume } if we extend later
    let command, volumeHint;
    if (typeof result === 'object' && result.text) {
      command = stopWord ? extractCommand(result.text) : result.text.trim();
      volumeHint = result.volume;
    } else {
      command = stopWord ? extractCommand(result) : result.trim();
    }
    if (!command) {
      setStatusText('No command detected.');
      return;
    }

    const acted = await handleAction(command, volumeHint);
    if (!acted) {
      if (!apiKey) {
        Alert.alert('Need API Key', 'Enter your AI API key to chat.');
        setStatusText('Ready');
        return;
      }
      setStatusText('Processing...');
      const response = await aiAssistant.respond(command);
      if (response) {
        const name = getAssistantName();
        setConversation((prev) => [...prev, `You: ${command}`, `${name}: ${response.text}`]);
        saveConversationEntry({ role: 'user', text: command, timestamp: Date.now() });
        saveConversationEntry({ role: 'assistant', text: response.text, timestamp: Date.now() });
        if (!isMuted) speak(response.text, volumeHint);
        setStatusText('Listening...');
      }
    }
  }, [apiKey, handleAction, isMuted]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0f0f23', '#1a1a3e']} style={styles.gradient}>
        {/* Setup Wizard */}
        <SetupWizard visible={showSetup} onComplete={handleSetupComplete} onSkip={() => setShowSetup(false)} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>KLAMA.AI</Text>
            <Text style={styles.headerSubtitle}>
              {getAssistantName()} — {statusText}
            </Text>
          </View>
          <View style={styles.headerControls}>
            <TouchableOpacity style={[styles.iconBtn, isMuted && styles.iconBtnActive]} onPress={() => setIsMuted(!isMuted)}>
              <MaterialCommunityIcons name={isMuted ? "microphone-off" : "microphone"} size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setViewMode(viewMode === 'voice' ? 'chat' : 'voice')}>
              <MaterialCommunityIcons name={viewMode === 'voice' ? 'chat' : 'microphone'} size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSetup(true)}>
              <MaterialCommunityIcons name="cog" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Status Dot */}
        <View style={styles.statusBar}>
          <View style={[styles.statusDot, isListening && styles.statusActive]} />
          <Text style={styles.statusText}>{statusText}</Text>
        </View>

        {/* Messages */}
        <FlatList
          data={conversation}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => {
            const isUser = item.startsWith('You:');
            return (
              <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
                <Text style={styles.messageText}>{item}</Text>
              </View>
            );
          }}
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

        {/* Voice Mode Input */}
        {viewMode === 'voice' && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inputWrapper}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.inputContainer}>
                <TextInput
                  placeholder={apiKey ? 'Type a command...' : 'Enter AI API key first...'}
                  value={apiKey ? chatInput : apiKey}
                  onChangeText={apiKey ? setChatInput : setAPIKey}
                  style={styles.textInput}
                  placeholderTextColor="#888"
                  onSubmitEditing={() => (apiKey ? sendToAI(chatInput) : null)}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, isListening && styles.sendBtnActive]}
                  onPress={() => (apiKey ? sendToAI(chatInput) : null)}
                  disabled={!apiKey}
                >
                  <MaterialCommunityIcons name="send" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>

            {/* Quick Actions Grid */}
            <View style={styles.actionGrid}>
              {QUICK_ACTIONS.map((item) => (
                <TouchableOpacity key={item.label} style={styles.actionBtn} onPress={() => sendToAI(item.cmd)}>
                  <MaterialCommunityIcons name={item.icon} size={22} color="#00d4ff" />
                  <Text style={styles.actionLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </KeyboardAvoidingView>
        )}

        {/* Chat Mode Input */}
        {viewMode === 'chat' && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inputWrapper}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={[styles.inputContainer, { gap: 10 }]}>
                <TextInput
                  placeholder="Ask Klama anything..."
                  value={chatInput}
                  onChangeText={setChatInput}
                  style={styles.textInput}
                  placeholderTextColor="#888"
                  onSubmitEditing={() => sendToAI(chatInput)}
                />
                <TouchableOpacity style={[styles.sendBtn, isListening && styles.sendBtnActive]} onPress={() => sendToAI(chatInput)} disabled={!apiKey}>
                  <MaterialCommunityIcons name="send" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        )}
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
  messageList: { flexGrow: 1, padding: 16, paddingBottom: 10 },
  messageBubble: {
    maxWidth: '82%',
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    lineHeight: 20,
  },
  userBubble: { backgroundColor: '#23375c', alignSelf: 'flex-end' },
  assistantBubble: { backgroundColor: '#1a2a4a', alignSelf: 'flex-start' },
  messageText: { color: '#e0e0e0', fontSize: 15, lineHeight: 20 },
  inputWrapper: { paddingHorizontal: 20, paddingBottom: 20 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 15,
  },
  actionBtn: {
    width: '14%',
    minWidth: 50,
    alignItems: 'center',
    gap: 4,
  },
  actionLabel: { color: '#aaa', fontSize: 11, textAlign: 'center' },
});
