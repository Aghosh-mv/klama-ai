# WakeWordAssistant - AI Personal Assistant

## Overview
React Native app with custom wake word detection and Gemini AI integration. 
Works on iOS and Android. Detects custom wake word even when screen is locked/standby.

## Key Features
- Custom wake word detection (user-defined name)
- On-device processing (privacy-focused)
- Gemini AI API integration
- Agentic capabilities: memory, task planning, reminders, math
- Background notification system
- Works with screen locked/standby

## Setup

### Prerequisites
- Node.js v20+
- Xcode (iOS) or Android Studio
- Gemini API key from Google AI Studio

### Installation
```bash
# Install dependencies
npm install

# Start development
npx expo start
```

### For Custom Wake Words
1. Train model at: https://github.com/alfiedennen/openwakeword-colab-2026
2. Place .onnx files in: assets/models/[your-name]/
3. Restart app and select custom word

### Android Development
```bash
npx expo run:android
```

### iOS Development (macOS)
```bash
npx expo run:ios
```

## Project Structure
```
WakeWordAssistant/
├── App.js              # Main UI with wake word selection
├── index.js            # Entry point
├── src/
│   ├── AIAssistant.ts  # AI with memory, planning, reminders
│   └── wakeWordService.ts  # openWakeWord pipeline
├── package.json          # Dependencies (expo, react-native-openwakeword)
└── assets/models/      # .onnx model files directory
```

## How It Works
1. User enters Gemini API key
2. Selects wake word (Jarvis/Assistant/Custom)
3. Grants microphone permission
4. App listens for wake word on-device
5. On detection: records command → sends to Gemini → gets response
6. AI uses agentic features: remembers context, sets reminders, does math
7. Responses can trigger native notifications

## Technical Details
- Wake word: openWakeWord 3-stage pipeline (mel → embedding → classifier)
- Audio: 16kHz mono PCM_16BIT
- AI: Gemini 1.5 Flash via Google Generative Language API
- Memory: Key-value store with 5-entry context window
- Task planning: Simple decomposition for common tasks
- Notifications: expo-notifications with platform-specific triggers