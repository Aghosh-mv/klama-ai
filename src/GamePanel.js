import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function GamePanel({ game, feedback, setFeedback, onClose }) {
  const [guess, setGuess] = useState('');

  if (game.type === 'guess') {
    return (
      <Modal visible transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.panel}>
            <Text style={styles.title}>{game.title}</Text>
            <Text style={styles.instructions}>Guess a number between 1-100</Text>
            <TextInput
              style={styles.input}
              placeholder="Your guess..."
              keyboardType="numeric"
              value={guess}
              onChangeText={setGuess}
              onSubmitEditing={() => {
                const g = parseInt(guess, 10);
                if (!g) {
                  setFeedback('Please enter a valid number');
                  return;
                }
                const ans = parseInt(game.answer || '', 10);
                if (g === ans) {
                  setFeedback('🎉 Correct!');
                } else if (g < ans) {
                  setFeedback('📉 Too low');
                } else {
                  setFeedback('📈 Too high');
                }
              }}
            />
            <Text style={styles.feedback}>{feedback}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>Close Game</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  if (game.type === 'trivia') {
    return (
      <Modal visible transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.panel}>
            <Text style={styles.title}>{game.title}</Text>
            <Text style={styles.question}>{game.content}</Text>
            <TextInput
              style={styles.input}
              placeholder="Your answer..."
              value={guess}
              onChangeText={setGuess}
              onSubmitEditing={() => {
                if (guess.trim().toLowerCase() === (game.answer || '').toLowerCase()) {
                  setFeedback('🎉 Correct!');
                } else {
                  setFeedback('Not quite. Answer: ' + game.answer);
                }
              }}
            />
            <Text style={styles.feedback}>{feedback}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>Close Game</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // Rock Paper Scissors
  const opts = ['Rock', 'Paper', 'Scissors'];
  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <Text style={styles.title}>{game.title}</Text>
          <View style={styles.rpsRow}>
            {opts.map((o) => (
              <TouchableOpacity
                key={o}
                style={styles.rpsBtn}
                onPress={() => {
                  const cpu = opts[Math.floor(Math.random() * 3)];
                  const beats = { Rock: 'Scissors', Paper: 'Rock', Scissors: 'Paper' };
                  let result;
                  if (o === cpu) result = '🤝 Draw! CPU chose ' + cpu;
                  else if (beats[o] === cpu) result = '🎉 You win! CPU chose ' + cpu;
                  else result = '💥 You lose. CPU chose ' + cpu;
                  setFeedback(result);
                }}
              >
                <MaterialCommunityIcons
                  name={
                    o === 'Rock'
                      ? 'hand-rock'
                      : o === 'Paper'
                      ? 'hand-paper'
                      : 'hand-scissors'
                  }
                  size={32}
                  color={o === 'Rock' ? '#ff6b6b' : o === 'Paper' ? '#4dabf7' : '#51cf66'}
                />
                <Text style={styles.rpsLabel}>{o}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.feedback}>{feedback}</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Close Game</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    backgroundColor: '#23375c',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    alignItems: 'center',
  },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  instructions: { color: '#888', marginBottom: 16 },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    width: '100%',
    marginBottom: 12,
  },
  feedback: { color: '#00d4ff', fontSize: 16, marginVertical: 10, minHeight: 24 },
  closeBtn: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 10,
  },
  closeText: { color: '#00d4ff', fontWeight: 'bold' },
  question: { color: '#e0e0e0', fontSize: 18, marginBottom: 16, textAlign: 'center' },
  rpsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginVertical: 15,
  },
  rpsBtn: { alignItems: 'center', gap: 6 },
  rpsLabel: { color: '#fff', fontSize: 14, marginTop: 4 },
});
