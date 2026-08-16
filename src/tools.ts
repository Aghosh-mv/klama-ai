import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as Clipboard from 'expo-clipboard';
import { Linking } from 'react-native';

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
