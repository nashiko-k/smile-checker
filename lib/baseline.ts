import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const STORAGE_KEY = 'baseline_data';
const IMAGE_DIR = `${FileSystem.documentDirectory}baseline/`;

export type BaselineData = {
  age: number;
  smilingProb: number;
  leftEyeOpen: number;
  rightEyeOpen: number;
  timestamp: number;
  imagePath: string;
};

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(IMAGE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
  }
}

export async function saveBaseline(
  scores: Omit<BaselineData, 'imagePath' | 'timestamp'>,
  sourceImageUri: string,
): Promise<BaselineData> {
  await ensureDir();

  const prev = await loadBaseline();
  if (prev?.imagePath) {
    try {
      await FileSystem.deleteAsync(prev.imagePath, { idempotent: true });
    } catch {}
  }

  const timestamp = Date.now();
  const dest = `${IMAGE_DIR}baseline_${timestamp}.jpg`;
  const src = sourceImageUri.startsWith('file://')
    ? sourceImageUri
    : `file://${sourceImageUri}`;
  await FileSystem.copyAsync({ from: src, to: dest });

  const data: BaselineData = {
    ...scores,
    imagePath: dest,
    timestamp,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

export async function loadBaseline(): Promise<BaselineData | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BaselineData;
  } catch {
    return null;
  }
}

export async function clearBaseline(): Promise<void> {
  const prev = await loadBaseline();
  if (prev?.imagePath) {
    try {
      await FileSystem.deleteAsync(prev.imagePath, { idempotent: true });
    } catch {}
  }
  await AsyncStorage.removeItem(STORAGE_KEY);
}
