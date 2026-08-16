import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const WAKE_WORDS = ['Jarvis', 'Assistant', 'Computer', 'Klama', 'Nova'];

export default function SetupWizard({ visible, onComplete, onSkip }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    apiKey: '',
    assistantName: '',
    wakeWord: '',
    phoneType: '',
    responseStyle: 'friendly',
    humorLevel: 'moderate',
    voiceStyle: 'natural',
    formality: 'casual',
    privacyLevel: 'session',
    notificationStyle: 'gentle',
    alwaysListening: 'true',
    locationServices: 'true',
    usageFocus: 'balanced',
    themeColor: '#00d4ff',
    startupMessage: '',
    customCommands: '',
  });

  const update = (key, value) => setData({ ...data, [key]: value });

  const handleComplete = () => {
    if (!data.apiKey.trim()) {
      Alert.alert('Almost there!', 'API key helps me think, so I need it 😉');
      return;
    }
    if (!data.assistantName.trim()) {
      Alert.alert('Name required', 'I need to know how to address you, boss 👔');
      return;
    }
    if (!data.wakeWord.trim()) {
      Alert.alert('Wake word required', 'How am I supposed to wake up? 🤔');
      return;
    }
    onComplete(data);
  };

  const handlePrev = () => setStep(Math.max(0, step - 1));
  const handleNext = () => setStep(step + 1);

  const questions = [
    {
      icon: 'key',
      title: 'AI Brain Key',
      subtitle: "Got a Gemini API key? Drop it here — it's how I think 💡✨",
      field: () => (
        <View style={{ width: '100%' }}>
          <TextInput
            style={[styles.input, { backgroundColor: '#1a1a2e' }]}
            placeholder="AIzaSy... (free from Google AI Studio)"
            value={data.apiKey}
            onChangeText={(v) => update('apiKey', v)}
            placeholderTextColor="#888"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.helpBtn}
            onPress={() => {
              Alert.alert(
                'How to Get Your Free API Key',
                '1. Go to https://aistudio.google.com/apikey\n' +
                '2. Sign in with your Google account\n' +
                '3. Click "Create API Key"\n' +
                '4. Copy the key (starts with "AIza")\n' +
                '5. Paste here and tap "Let\'s Go!" 🚀',
                [{ text: 'Got it', style: 'cancel' }]
              );
            }}
          >
            <Text style={styles.helpBtnText}>💡 How do I get this?</Text>
          </TouchableOpacity>
        </View>
      ),
      preview: data.apiKey
        ? '✅ Key accepted! I can now think and chat.'
        : '❌ I need a key to work — get one from Google AI Studio (free).',
    },
    {
      icon: 'account-star',
      title: 'My Name Is?',
      subtitle: 'What should I call you? I answer to anything (within reason) 😎',
      field: () => (
        <TextInput
          style={styles.input}
          placeholder="Boss? Human? Coffee-fueled genius?"
          value={data.assistantName}
          onChangeText={(v) => update('assistantName', v)}
          placeholderTextColor="#888"
        />
      ),
    },
    {
      icon: 'microphone',
      title: 'Wake-Up Call',
      subtitle: 'What magic word wakes me up? Pick one or teach me your own 🙌',
      field: () => (
        <View>
          <View style={styles.wordGrid}>
            {WAKE_WORDS.map((word) => (
              <TouchableOpacity
                key={word}
                style={[
                  styles.wordBtn,
                  data.wakeWord === word && styles.wordBtnSelected,
                ]}
                onPress={() => update('wakeWord', word)}
              >
                <Text style={[styles.wordText, data.wakeWord === word && styles.wordTextSelected]}>
                  {`"${word}"`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.input, { marginTop: 12 }]}
            placeholder="Or type your own magic word"
            value={data.wakeWord}
            onChangeText={(v) => update('wakeWord', v)}
            placeholderTextColor="#888"
          />
        </View>
      ),
      preview: data.wakeWord
        ? `✅ Wake word: "${data.wakeWord}" — I'll wake when I hear this`
        : '❌ Pick or type a wake word so I can listen for you.',
    },
    {
      icon: 'robot-happy',
      title: 'My Personality',
      subtitle: 'How chatty should I be? Chill, professional, or chaotic gremlin?',
      field: () => (
        <View style={styles.choiceGrid}>
          {['chatty', 'friendly', 'professional', 'chaotic'].map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.choiceBtn, data.responseStyle === opt && styles.choiceSelected]}
              onPress={() => {
                update('responseStyle', opt);
                update('humorLevel', opt === 'chatty' || opt === 'chaotic' ? 'high' : opt === 'professional' ? 'low' : 'moderate');
              }}
            >
              <Text style={[styles.choiceText, data.responseStyle === opt && styles.choiceTextSelected]}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ),
      preview: `🤖 Mode: ${data.responseStyle} | Humor: ${data.humorLevel}`,
    },
    {
      icon: 'shield-account',
      title: 'Privacy First',
      subtitle: 'Should I remember our chats or ghost them like my ex? 👻',
      field: () => (
        <View style={styles.choiceGrid}>
          <TouchableOpacity
            style={[styles.choiceBtn, data.privacyLevel === 'session' && styles.choiceSelected]}
            onPress={() => update('privacyLevel', 'session')}
          >
            <Text style={[styles.choiceText, data.privacyLevel === 'session' && styles.choiceTextSelected]}>
              Forgetting (Session Only)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.choiceBtn, data.privacyLevel === 'persistent' && styles.choiceSelected]}
            onPress={() => update('privacyLevel', 'persistent')}
          >
            <Text style={[styles.choiceText, data.privacyLevel === 'persistent' && styles.choiceTextSelected]}>
              Remember Everything
            </Text>
          </TouchableOpacity>
        </View>
      ),
      preview: data.privacyLevel === 'session'
        ? '🔒 I forget chats each session (more private)'
        : '💾 I remember our chats (context-aware)',
    },
    {
      icon: 'flash-alert',
      title: 'Notifications',
      subtitle: 'When I ping you, should I tap your shoulder gently or shake you awake?',
      field: () => (
        <View style={styles.choiceGrid}>
          {['gentle', 'loud', 'silent'].map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.choiceBtn, data.notificationStyle === opt && styles.choiceSelected]}
              onPress={() => update('notificationStyle', opt)}
            >
              <Text style={[styles.choiceText, data.notificationStyle === opt && styles.choiceTextSelected]}>
                {opt === 'gentle' ? 'Gentle' : opt === 'loud' ? 'LOUD' : 'Silent'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ),
      preview: `🔔 Pings: ${data.notificationStyle === 'loud' ? 'LOUD' : data.notificationStyle === 'silent' ? 'Silent' : 'Gentle'}`,
    },
    {
      icon: 'earth',
      title: 'Location?',
      subtitle: 'Can I peek at where you are for weather and local stuff? 🌍',
      field: () => (
        <View style={styles.choiceGrid}>
          <TouchableOpacity
            style={[styles.choiceBtn, data.locationServices === 'true' && styles.choiceSelected]}
            onPress={() => update('locationServices', 'true')}
          >
            <Text style={[styles.choiceText, data.locationServices === 'true' && styles.choiceTextSelected]}>
              Yes, I trust you
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.choiceBtn, data.locationServices === 'false' && styles.choiceSelected]}
            onPress={() => update('locationServices', 'false')}
          >
            <Text style={[styles.choiceText, data.locationServices === 'false' && styles.choiceTextSelected]}>
              Nope, I'm paranoid
            </Text>
          </TouchableOpacity>
        </View>
      ),
      preview: data.locationServices === 'true'
        ? '📍 Yes — I can give weather for your area'
        : '🙈 No — privacy mode (weather will be generic)',
    },
    {
      icon: 'eye',
      title: 'Theme Glow',
      subtitle: 'What color should my buttons glow? Give me a hex or color name 🎨',
      field: () => (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TextInput
            style={[styles.input, { flex: 2 }]}
            placeholder="#00d4ff"
            value={data.themeColor}
            onChangeText={(v) => update('themeColor', v)}
            placeholderTextColor="#888"
          />
          <View style={[styles.colorPreview, { backgroundColor: data.themeColor || '#333' }]} />
        </View>
      ),
      preview: data.themeColor
        ? `🎨 Glow color set: ${data.themeColor}`
        : '🎨 Pick a color — this is your assistant\'s brand',
    },
    {
      icon: 'weather-sunset',
      title: 'Coffee or Tea?',
      subtitle: 'Tell me your daily fuel — I\'ll cheer you on ☕🍵',
      field: () => (
        <View style={styles.choiceGrid}>
          {['coffee', 'tea', 'neither', 'both'].map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.choiceBtn, data.dailyFuel === opt && styles.choiceSelected]}
              onPress={() => update('dailyFuel', opt)}
            >
              <Text style={[styles.choiceText, data.dailyFuel === opt && styles.choiceTextSelected]}>
                {opt === 'both' ? 'Both!' : opt.charAt(0).toUpperCase() + opt.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ),
      preview: data.dailyFuel
        ? `✅ Got it — ${data.dailyFuel === 'both' ? 'you love both!' : 'you like ' + data.dailyFuel} `
        : '❌ Pick one so I know your vibe 😄',
    },
    {
      icon: 'weather-sunset',
      title: 'Night Owl or Early Bird?',
      subtitle: 'Are you team sunrise or team midnight? 🌙☀️',
      field: () => (
        <View style={styles.choiceGrid}>
          {['early-bird', 'night-owl', 'both', 'neither'].map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.choiceBtn, data.energyType === opt && styles.choiceSelected]}
              onPress={() => update('energyType', opt)}
            >
              <Text style={[styles.choiceText, data.energyType === opt && styles.choiceTextSelected]}>
                {opt === 'early-bird' ? 'Sunrise ☀️' : opt === 'night-owl' ? 'Midnight 🌙' : opt === 'both' ? 'Both' : 'No preference'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ),
      preview: data.energyType
        ? `🌙 You're a ${data.energyType.replace('-', ' ')}`
        : '❌ So I know when to be energetic vs chill',
    },
    {
      icon: 'weather-sunset',
      title: 'Your Vibe Check',
      subtitle: 'What one word should describe my attitude today? (e.g., sassy, chill, hype)',
      field: () => (
        <TextInput
          style={styles.input}
          placeholder="sassy / chill / hype / professor-mode"
          value={data.vibe}
          onChangeText={(v) => update('vibe', v)}
          placeholderTextColor="#888"
        />
      ),
      preview: data.vibe
        ? `🎭 Vibe set: ${data.vibe} — I\'ll match that`
        : '❌ One word — how I should act today',
    },
    },
    {
      icon: 'chat-sleep',
      title: 'Wake-Up Words',
      subtitle: "When I wake up, what should I say? (e.g., 'How can I help you?')",
      field: () => (
        <TextInput
          style={styles.input}
          placeholder="Default: 'Yes? Go ahead.'"
          value={data.startupMessage}
          onChangeText={(v) => update('startupMessage', v)}
          placeholderTextColor="#888"
        />
      ),
    },
    {
      icon: 'lightning-bolt',
      title: 'Power Mode',
      subtitle: 'Keep listening always, or save battery when idle?',
      field: () => (
        <View style={styles.choiceGrid}>
          <TouchableOpacity
            style={[styles.choiceBtn, data.alwaysListening === 'true' && styles.choiceSelected]}
            onPress={() => update('alwaysListening', 'true')}
          >
            <Text style={[styles.choiceText, data.alwaysListening === 'true' && styles.choiceTextSelected]}>
              Always On
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.choiceBtn, data.alwaysListening === 'false' && styles.choiceSelected]}
            onPress={() => update('alwaysListening', 'false')}
          >
            <Text style={[styles.choiceText, data.alwaysListening === 'false' && styles.choiceTextSelected]}>
              Battery Saver
            </Text>
          </TouchableOpacity>
        </View>
      ),
    },
    {
      icon: 'clipboard-text',
      title: 'Custom Shortcuts',
      subtitle: 'Teach me quick phrases like "meeting mode" → mute phone + start timer',
      field: () => (
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          placeholder="shortcut: action | another shortcut: action"
          value={data.customCommands}
          onChangeText={(v) => update('customCommands', v)}
          placeholderTextColor="#888"
          multiline
        />
      ),
    },
  ];

  const current = questions[step];

  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <LinearGradient colors={['#0f0f23', '#1a1a3e', '#16213e']} style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, padding: 20 }}
        >
          <ScrollView contentContainerStyle={{ flex: 1, justifyContent: 'center' }}>
            {/* Progress */}
            <View style={styles.stepsContainer}>
              {questions.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.stepDot,
                    i === step && styles.stepDotActive,
                    i < step && styles.stepDotComplete,
                  ]}
                />
              ))}
            </View>

            {/* Content */}
            <View style={styles.questionCard}>
              <Text style={styles.questionEmoji}>
                {['🔑', '👤', '🪄', '😄', '👻', '🔔', '🌍', '🎨', '💬', '⚡', '⌨️'][step] || '•'}
              </Text>
              <Text style={styles.questionTitle}>{current.title}</Text>
              <Text style={styles.questionSubtitle}>{current.subtitle}</Text>
              {current.field()}
              {current.preview ? (
                <View style={styles.previewBox}>
                  <Text style={styles.previewText}>{current.preview}</Text>
                </View>
              ) : null}
            </View>

            {/* Navigation */}
            <View style={styles.navContainer}>
              <TouchableOpacity
                style={[styles.navBtn, styles.navBtnGhost]}
                onPress={handlePrev}
                disabled={step === 0}
              >
                <Text style={styles.navBtnTextGhost}>Back</Text>
              </TouchableOpacity>

              {step < questions.length - 1 ? (
                <TouchableOpacity style={[styles.navBtn, styles.navBtnPrimary]} onPress={handleNext}>
                  <Text style={styles.navBtnTextPrimary}>Next</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.navBtn, styles.navBtnPrimary]} onPress={handleComplete}>
                  <Text style={styles.navBtnTextPrimary}>Let's Go! ✨</Text>
                </TouchableOpacity>
              )}
            </View>

            <Pressable onPress={onSkip} style={{ alignItems: 'center', marginTop: 15 }}>
              <Text style={styles.skipText}>Skip for now (I'll finish later)</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 25,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#444',
  },
  stepDotActive: { backgroundColor: '#00d4ff' },
  stepDotComplete: { backgroundColor: '#00ff88' },
  questionCard: {
    backgroundColor: '#23375c',
    borderRadius: 24,
    padding: 24,
    marginBottom: 25,
    alignItems: 'center',
  },
  questionEmoji: { fontSize: 48, marginBottom: 12 },
  questionTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  questionSubtitle: { color: '#999', fontSize: 14, marginBottom: 18, textAlign: 'center' },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    width: '100%',
  },
  wordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  wordBtn: {
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  wordBtnSelected: { backgroundColor: '#00d4ff' },
  wordText: { color: '#aaa', fontSize: 14 },
  wordTextSelected: { color: '#1a1a2e' },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  choiceBtn: {
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 130,
  },
  choiceSelected: { backgroundColor: '#00d4ff' },
  choiceText: { color: '#aaa', fontSize: 14, textAlign: 'center' },
  choiceTextSelected: { color: '#1a1a2e' },
  colorPreview: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333',
  },
  navContainer: { flexDirection: 'row', justifyContent: 'center', gap: 15 },
  navBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  navBtnGhost: { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#333' },
  navBtnPrimary: { backgroundColor: '#00d4ff' },
  navBtnTextGhost: { color: '#aaa' },
  navBtnTextPrimary: { color: '#1a1a2e', fontWeight: 'bold' },
  skipText: { color: '#666', fontSize: 14 },
  helpBtn: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  },
  helpBtnText: { color: '#00d4ff', fontSize: 13, textAlign: 'center' },
  previewBox: {
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  previewText: { color: '#fff', fontSize: 13, textAlign: 'center' },
});
