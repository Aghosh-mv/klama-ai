import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as Clipboard from 'expo-clipboard';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Speech from 'expo-speech';
import * as Battery from 'expo-battery';
import { Linking, Platform, Share } from 'react-native';

export interface GameSpec {
  type: 'guess' | 'trivia' | 'rps';
  title: string;
  content?: string;
  answer?: string;
}

export interface ActionResult {
  handled: boolean;
  message: string;
  game?: GameSpec;
}

export function tellTime(): string {
  const now = new Date();
  return `The time is ${now.toLocaleTimeString()} on ${now.toLocaleDateString()}.`;
}

export function parseReminder(
  text: string
): { label: string; date: Date } | null {
  const lower = text.toLowerCase();

  const inMatch = lower.match(
    /remind me to (.+?) in (\d+)\s*(minute|min|hour|hr|second|sec)s?/
  );
  if (inMatch) {
    const label = inMatch[1].trim();
    const amount = parseInt(inMatch[2], 10);
    const unit = inMatch[3];
    const ms = unit.startsWith('min')
      ? amount * 60000
      : unit.startsWith('hour') || unit.startsWith('hr')
      ? amount * 3600000
      : amount * 1000;
    return { label, date: new Date(Date.now() + ms) };
  }

  const atMatch = lower.match(/remind me to (.+?) at (\d{1,2}):?(\d{2})?/);
  if (atMatch) {
    const label = atMatch[1].trim();
    const h = parseInt(atMatch[2], 10);
    const m = parseInt(atMatch[3] || '0', 10);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
    return { label, date: d };
  }

  return null;
}

export async function setReminder(label: string, date: Date): Promise<string> {
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Klama AI Reminder', body: label },
    trigger: date,
  });
  return `Reminder set for "${label}" at ${date.toLocaleTimeString()}.`;
}

export async function getWeather(): Promise<string> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return 'Location permission needed for weather.';
    const loc = await Location.getCurrentPositionAsync({});
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.coords.latitude}&longitude=${loc.coords.longitude}&current_weather=true`;
    const r = await fetch(url);
    const j = await r.json();
    const w = j.current_weather;
    if (!w) return 'Weather data unavailable right now.';
    return `Currently ${w.temperature}°C, wind ${w.windspeed} km/h (weather code ${w.weathercode}). Powered by Open-Meteo.`;
  } catch (e) {
    return 'Could not fetch weather.';
  }
}

export function webSearch(query: string): string {
  const q = encodeURIComponent(
    query.replace(/^search (for )?/i, '').trim()
  );
  Linking.openURL(`https://www.google.com/search?q=${q}`);
  return `Opening a web search for "${query}".`;
}

export async function copyText(text: string): Promise<string> {
  await Clipboard.setStringAsync(text);
  return 'Copied to clipboard — you can paste it anywhere.';
}

const TRIVIA = [
  { q: 'What planet is known as the Red Planet?', a: 'Mars' },
  { q: 'How many continents are there?', a: '7' },
  { q: 'What is the capital of France?', a: 'Paris' },
  { q: 'Which language runs in web browsers natively?', a: 'JavaScript' },
  { q: 'What gas do plants absorb?', a: 'Carbon dioxide' },
];

export function makeGame(prompt: string): GameSpec | null {
  const p = prompt.toLowerCase();
  if (p.includes('guess') || p.includes('number game')) {
    const answer = Math.floor(Math.random() * 100) + 1;
    return {
      type: 'guess',
      title: 'Guess the Number (1–100)',
      answer: String(answer),
    };
  }
  if (p.includes('rock') || p.includes('rps') || p.includes('paper scissors')) {
    return { type: 'rps', title: 'Rock Paper Scissors' };
  }
  if (p.includes('trivia') || p.includes('quiz') || p.includes('game')) {
    const t = TRIVIA[Math.floor(Math.random() * TRIVIA.length)];
    return { type: 'trivia', title: 'Quick Trivia', content: t.q, answer: t.a };
  }
  return null;
}

// Keyword router: turns a raw prompt into a real device action.
export async function runAction(text: string): Promise<ActionResult> {
  const lower = text.toLowerCase();

  if (/(what|current|the)?\s*time|tell me the time|time now/.test(lower)) {
    return { handled: true, message: tellTime() };
  }

  if (/(weather|temperature|rain|forecast|how (hot|cold))/.test(lower)) {
    const msg = await getWeather();
    return { handled: true, message: msg };
  }

  const reminder = parseReminder(text);
  if (reminder) {
    const msg = await setReminder(reminder.label, reminder.date);
    return { handled: true, message: msg };
  }

  // Real Android alarm via the built-in Clock app.
  const alarmMatch = lower.match(
    /(set |start )?an? alarm (for |at )?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/
  );
  if (alarmMatch) {
    const msg = await setAlarm(
      parseInt(alarmMatch[3], 10),
      alarmMatch[4] ? parseInt(alarmMatch[4], 10) : 0,
      alarmMatch[5]
    );
    return { handled: true, message: msg };
  }

  // Timer via Clock app (Android).
  const timerMatch = lower.match(/timer (for )?(\d+)\s*(minute|min|second|sec|hour|hr)s?/);
  if (timerMatch) {
    const amount = parseInt(timerMatch[2], 10);
    const unit = timerMatch[3];
    const seconds =
      unit.startsWith('min') ? amount * 60 : unit.startsWith('hour') || unit.startsWith('hr') ? amount * 3600 : amount;
    const msg = await startTimer(seconds);
    return { handled: true, message: msg };
  }

  // Open another app by name (Android).
  const openMatch = lower.match(/open (.+)/);
  if (openMatch && !/(open (the )?(search|browser|web))/.test(lower)) {
    const msg = await openApp(openMatch[1].trim());
    return { handled: true, message: msg };
  }

  if (/(^|\s)search(\s|$)|look up|google/.test(lower)) {
    const msg = webSearch(text);
    return { handled: true, message: msg };
  }

  if (/(copy|clipboard|type this|write this|draft)/.test(lower)) {
    const clean = text
      .replace(/^(copy|type|write|draft|clipboard)\s*(this|the text)?\s*/i, '')
      .trim();
    const msg = await copyText(clean || text);
    return { handled: true, message: msg };
  }

  if (/(what can you do|help|capabilities|commands)/.test(lower)) {
    return { handled: true, message: capabilitiesList() };
  }

  if (/share (this|that|:|…)/.test(lower) || lower.startsWith('share ')) {
    const payload = text.replace(/^share\s*/i, '').trim();
    const msg = await shareText(payload || 'Hello from Klama AI');
    return { handled: true, message: msg };
  }

  if (/flashlight (on|off)/.test(lower)) {
    const on = /on/.test(lower);
    const msg = await flashlight(on);
    return { handled: true, message: msg };
  }

  if (/(battery|how much (charge|battery))/.test(lower)) {
    const msg = await batteryLevel();
    return { handled: true, message: msg };
  }

  const nameMatch = lower.match(/your (name is|name's) (.+)/);
  if (nameMatch) {
    const msg = setAssistantName(nameMatch[2].trim());
    return { handled: true, message: msg };
  }

  if (/(run|do) (my )?routine/.test(lower)) {
    const steps = (aiAssistant.getMemory('routine') || '')
      .split('|')
      .filter(Boolean);
    if (!steps.length) {
      return {
        handled: true,
        message: 'No routine saved. Say "save routine: step1 | step2".',
      };
    }
    const results = await runRoutine(steps);
    return { handled: true, message: 'Routine:\n' + results.join('\n') };
  }

  const saveRoutine = lower.match(/save routine:\s*(.+)/);
  if (saveRoutine) {
    aiAssistant.setMemory('routine', saveRoutine[1].trim());
    return { handled: true, message: 'Routine saved.' };
  }

  const game = makeGame(text);
  if (game) {
    return {
      handled: true,
      message: `Starting game: ${game.title}. Use the panel below.`,
      game,
    };
  }

  return { handled: false, message: '' };
}

// --- Alarm / Timer (Android) ---

export async function setAlarm(
  hour: number,
  minute: number,
  meridian?: string
): Promise<string> {
  let h = hour;
  if (meridian === 'pm' && h < 12) h += 12;
  if (meridian === 'am' && h === 12) h = 0;

  if (Platform.OS === 'android') {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.SET_ALARM', {
        // @ts-ignore - extra keys are passed through
        extra: {
          'android.intent.extra.alarm.HOUR': h,
          'android.intent.extra.alarm.MINUTES': minute,
          'android.intent.extra.alarm.SKIP_UI': false,
          'android.intent.extra.alarm.MESSAGE': 'Klama AI alarm',
        },
      });
      return `Alarm set for ${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')} (via Clock app).`;
    } catch (e) {
      return 'Could not set alarm.';
    }
  }
  // iOS fallback: critical notification reminder.
  const date = new Date();
  date.setHours(h, minute, 0, 0);
  if (date.getTime() < Date.now()) date.setDate(date.getDate() + 1);
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Klama AI Alarm', body: 'Wake up!', priority: 'max' as any },
    trigger: date,
  });
  return `Alarm reminder set for ${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')} (iOS: notification).`;
}

export async function startTimer(seconds: number): Promise<string> {
  if (Platform.OS === 'android') {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.SET_TIMER', {
        // @ts-ignore
        extra: {
          'android.intent.extra.alarm.LENGTH': seconds,
          'android.intent.extra.alarm.SKIP_UI': false,
          'android.intent.extra.alarm.MESSAGE': 'Klama AI timer',
        },
      });
      return `Timer set for ${seconds} seconds (via Clock app).`;
    } catch (e) {
      return 'Could not start timer.';
    }
  }
  const date = new Date(Date.now() + seconds * 1000);
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Klama AI Timer', body: 'Time is up!' },
    trigger: date,
  });
  return `Timer reminder set for ${seconds} seconds (iOS: notification).`;
}

export async function openApp(name: string): Promise<string> {
  if (Platform.OS !== 'android') {
    return `Opening apps by name is Android-only. Try a web search instead.`;
  }
  const pkg = appPackageFor(name);
  if (!pkg) {
    return `I don't know the package for "${name}". Try "search for ${name}".`;
  }
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
      // @ts-ignore
      packageName: pkg,
      className: `${pkg}.MainActivity`,
    });
    return `Opening ${name}.`;
  } catch (e) {
    return `Could not open ${name}.`;
  }
}

function appPackageFor(name: string): string | null {
  const map: Record<string, string> = {
    whatsapp: 'com.whatsapp',
    youtube: 'com.google.android.youtube',
    chrome: 'com.android.chrome',
    gmail: 'com.google.android.gm',
    maps: 'com.google.android.apps.maps',
    camera: 'com.android.camera2',
    settings: 'com.android.settings',
    calculator: 'com.android.calculator2',
    spotify: 'com.spotify.music',
    instagram: 'com.instagram.android',
    telegram: 'org.telegram.messenger',
  };
  return map[name.toLowerCase()] || null;
}

export function capabilitiesList(): string {
  return [
    'I can:',
    '• Wake on your custom word (screen off)',
    '• Tell the time and date',
    '• Set reminders ("remind me to X in 20 minutes")',
    '• Set a real alarm / timer (Android Clock)',
    '• Report weather from your location',
    '• Web search, copy text, open apps (Android)',
    '• Play mini-games from a prompt',
    '• Chat with Gemini for everything else',
  ].join('\n');
}

export function speak(text: string): void {
  Speech.speak(text, { rate: 1.0, pitch: 1.0 });
}

export async function shareText(text: string): Promise<string> {
  try {
    await Share.share({ message: text });
    return 'Opened the share sheet.';
  } catch (e) {
    return 'Could not open share sheet.';
  }
}

export async function flashlight(on: boolean): Promise<string> {
  if (Platform.OS !== 'android') return 'Flashlight control is Android-only.';
  try {
    await IntentLauncher.startActivityAsync(
      on ? 'android.media.action.STILL_IMAGE_CAMERA' : 'android.intent.action.MAIN',
      {}
    );
    return on ? 'Flashlight on (via camera).' : 'Flashlight off.';
  } catch (e) {
    return 'Flashlight not available here.';
  }
}

export async function batteryLevel(): Promise<string> {
  try {
    const pct = await Battery.getBatteryLevelAsync();
    return `Battery is at ${Math.round(pct * 100)}%.`;
  } catch (e) {
    return 'Could not read battery.';
  }
}

// Agentic "routine": run a saved list of steps. Stored in memory as "routine".
export async function runRoutine(steps: string[]): Promise<string[]> {
  const results: string[] = [];
  for (const step of steps) {
    const action = await runAction(step);
    results.push(action.handled ? action.message : `(ask AI) ${step}`);
  }
  return results;
}

export function setAssistantName(name: string): string {
  aiAssistant.setMemory('assistant_name', name);
  return `Okay, I'll respond to the name "${name}" from now on.`;
}

export function getAssistantName(): string {
  return aiAssistant.getMemory('assistant_name') || 'Klama';
}

export async function capabilitiesList(): string {
  return [
    'I am ' + getAssistantName() + '. I can:',
    '• Wake on your custom word (screen off)',
    '• Talk back with voice (TTS)',
    '• Tell time, date, and battery %',
    '• Set reminders, alarms, and timers',
    '• Report weather from your location',
    '• Web search, copy text, share, open apps (Android)',
    '• Toggle flashlight (Android)',
    '• Play mini-games from a prompt',
    '• Run a saved routine of steps',
    '• Chat with your AI key for everything else',
  ].join('\n');
}
