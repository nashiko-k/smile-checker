import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const STORAGE_KEY = 'history_data';
const IMAGE_DIR = `${FileSystem.documentDirectory}history/`;

export type HistoryEntry = {
  timestamp: number;
  date: string; // YYYY-MM-DD (ローカル時刻)
  faceAge: number;
  smileProb: number;
  smileLevel: number; // 1-10
  imagePath: string;
};

export function dateStringFromTimestamp(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(IMAGE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
  }
}

function smileLevelFromProb(prob: number): number {
  const clamped = Math.max(0, Math.min(1, prob));
  return Math.min(10, Math.floor(clamped * 10) + 1);
}

function migrateEntry(raw: unknown): HistoryEntry | null {
  if (typeof raw !== 'object' || raw == null) return null;
  const r = raw as Record<string, unknown>;
  const timestamp = typeof r.timestamp === 'number' ? r.timestamp : null;
  if (timestamp == null) return null;

  const faceAge =
    typeof r.faceAge === 'number'
      ? r.faceAge
      : typeof r.age === 'number'
        ? r.age
        : null;
  const smileProb =
    typeof r.smileProb === 'number'
      ? r.smileProb
      : typeof r.smilingProb === 'number'
        ? r.smilingProb
        : null;
  if (faceAge == null || smileProb == null) return null;

  const imagePath = typeof r.imagePath === 'string' ? r.imagePath : '';
  const date =
    typeof r.date === 'string' ? r.date : dateStringFromTimestamp(timestamp);
  const smileLevel =
    typeof r.smileLevel === 'number'
      ? r.smileLevel
      : smileLevelFromProb(smileProb);

  return { timestamp, date, faceAge, smileProb, smileLevel, imagePath };
}

export async function addHistoryEntry(
  entry: {
    faceAge: number;
    smileProb: number;
    smileLevel: number;
  },
  sourceImageUri: string,
): Promise<HistoryEntry> {
  await ensureDir();
  const timestamp = Date.now();
  const dest = `${IMAGE_DIR}${timestamp}.jpg`;
  const src = sourceImageUri.startsWith('file://')
    ? sourceImageUri
    : `file://${sourceImageUri}`;
  await FileSystem.copyAsync({ from: src, to: dest });

  const newEntry: HistoryEntry = {
    ...entry,
    timestamp,
    date: dateStringFromTimestamp(timestamp),
    imagePath: dest,
  };
  const existing = await loadHistory();
  const next = [newEntry, ...existing];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return newEntry;
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(migrateEntry)
      .filter((e): e is HistoryEntry => e != null);
  } catch {
    return [];
  }
}

async function safeDeleteImage(path: string): Promise<void> {
  if (!path) return;
  try {
    await FileSystem.deleteAsync(path, { idempotent: true });
  } catch {}
}

export async function deleteHistoryEntry(timestamp: number): Promise<void> {
  const entries = await loadHistory();
  const target = entries.find((e) => e.timestamp === timestamp);
  if (target?.imagePath) {
    await safeDeleteImage(target.imagePath);
  }
  const next = entries.filter((e) => e.timestamp !== timestamp);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export async function deleteHistoryPhoto(timestamp: number): Promise<void> {
  const entries = await loadHistory();
  const target = entries.find((e) => e.timestamp === timestamp);
  if (!target) return;
  if (target.imagePath) {
    await safeDeleteImage(target.imagePath);
  }
  const next = entries.map((e) =>
    e.timestamp === timestamp ? { ...e, imagePath: '' } : e,
  );
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function formatTimeHM(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours());
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
