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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const WAKE_WORDS = ['Jarvis', 'Assistant', 'Computer', 'Alexa'];

export default function SetupWizard({ visible, onComplete, onSkip }) {
  const [step, setStep] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [assistantName, setAssistantName] = useState('');
  const [wakeWord, setWakeWord] = useState('');
  const [customStopWord, setCustomStopWord] = useState('');

  const handleComplete = () => {
    if (!apiKey.trim() || !assistantName.trim() || !wakeWord.trim()) {
      Alert.alert('Incomplete', 'Please fill in all required fields');
      return;
    }
    onComplete({
      apiKey: apiKey.trim(),
      assistantName: assistantName.trim(),
      wakeWord: wakeWord.trim(),
      stopWord: customStopWord.trim() || undefined,
    });
  };

  const steps = [
    {
      icon: 'key',
      title: 'AI API Key',
      subtitle: 'Enter your Gemini API key (free from Google AI)',
      field: () => (
        <TextInput
          style={styles.input}
          placeholder="AIza..."
          value={apiKey}
          onChangeText={setApiKey}
          secureTextEntry
          placeholderTextColor="#888"
        />
      ),
    },
    {
      icon: 'account',
      title: 'Your Assistant\'s Name',
      subtitle: 'What should your assistant be called?',
      field: () => (
        <TextInput
          style={styles.input}
          placeholder="e.g., Klama, Jarvis, Nova"
          value={assistantName}
          onChangeText={setAssistantName}
          placeholderTextColor="#888"
        />
      ),
    },
    {
      icon: 'microphone',
      title: 'Wake Word',
      subtitle: 'Which word activates your assistant?',
      field: () => (
        <View style={styles.wordGrid}>
          {WAKE_WORDS.map((word) => (
            <TouchableOpacity
              key={word}
              style={[
                styles.wordBtn,
                wakeWord === word && styles.wordBtnSelected,
              ]}
              onPress={() => setWakeWord(word)}
            >
              <Text
                style={[
                  styles.wordText,
                  wakeWord === word && styles.wordTextSelected,
                ]}
              >
                {word}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ),
    },
    {
      icon: 'lock-reset',
      title: 'Stop Word (Optional)',
      subtitle: 'Say this word to send your command (empty = process immediately)',
      field: () => (
        <TextInput
          style={styles.input}
          placeholder="Default: none (processes immediately)"
          value={customStopWord}
          onChangeText={setCustomStopWord}
          placeholderTextColor="#888"
        />
      ),
    },
  ];

  const current = steps[step];

  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.modalContainer}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalContent}
        >
          <View style={styles.modalHeader}>
            <LinearGradient
              colors={['#00d4ff', '#0066cc']}
              style={styles.headerIcon}
            >
              <MaterialCommunityIcons name={current.icon} size={32} color="#fff" />
            </LinearGradient>
            <Text style={styles.modalTitle}>{current.title}</Text>
            <Text style={styles.modalSubtitle}>{current.subtitle}</Text>
          </View>

          <View style={styles.modalBody}>{current.field()}</View>

          <View style={styles.modalFooter}>
            <View style={stepsBar(step, steps.length)} />

            <View style={styles.modalButtons}>
              {step > 0 && (
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnSecondary]}
                  onPress={() => setStep(step - 1)}
                >
                  <Text style={styles.modalBtnTextSecondary}>Back</Text>
                </TouchableOpacity>
              )}
              {step < steps.length - 1 ? (
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnPrimary]}
                  onPress={() => setStep(step + 1)}
                >
                  <Text style={styles.modalBtnTextPrimary}>Next</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnPrimary]}
                  onPress={handleComplete}
                >
                  <Text style={styles.modalBtnTextPrimary}>Finish</Text>
                </TouchableOpacity>
              )}
            </View>

            <Pressable onPress={onSkip} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip Setup</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </Modal>
  );
}

function stepsBar(current, total) {
  const dots = [];
  for (let i = 0; i < total; i++) {
    dots.push(
      <View
        key={i}
        style={[
          styles.stepDot,
          i === current && styles.stepDotActive,
          i < current && styles.stepDotComplete,
        ]}
      />
    );
  }
  return <View style={styles.stepsContainer}>{dots}</View>;
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1 },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalHeader: { alignItems: 'center', marginBottom: 30 },
  headerIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  modalTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  modalSubtitle: { color: '#888', fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },
  modalBody: { width: '100%', marginBottom: 30 },
  input: {
    backgroundColor: '#23375c',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
  },
  wordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  wordBtn: {
    borderWidth: 2,
    borderColor: '#23375c',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  wordBtnSelected: { backgroundColor: '#00d4ff' },
  wordText: { color: '#aaa', fontSize: 16 },
  wordTextSelected: { color: '#1a1a2e' },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 25,
  },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#333' },
  stepDotActive: { backgroundColor: '#00d4ff' },
  stepDotComplete: { backgroundColor: '#00ff88' },
  modalButtons: { flexDirection: 'row', justifyContent: 'center', gap: 15 },
  modalBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalBtnPrimary: { backgroundColor: '#00d4ff' },
  modalBtnSecondary: { backgroundColor: 'transparent' },
  modalBtnTextPrimary: { color: '#1a1a2e', fontWeight: 'bold' },
  modalBtnTextSecondary: { color: '#aaa' },
  skipBtn: { marginTop: 20 },
  skipText: { color: '#666', fontSize: 14 },
});
