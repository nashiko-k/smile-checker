import AsyncStorage from '@react-native-async-storage/async-storage';

// ── 広告ユニットID ──────────────────────────────────────────────────────
// 本番用（リリース）
export const BANNER_AD_UNIT_ID = 'ca-app-pub-6109118020281273/2236365845';
export const INTERSTITIAL_AD_UNIT_ID =
  'ca-app-pub-6109118020281273/8721883145';

// 開発中はテスト用ID。本番IDをテスト中にクリックするとアカウント停止リスクがある。
// 開発に戻すときは上記をコメントアウトして以下を有効化する。
// export const BANNER_AD_UNIT_ID = 'ca-app-pub-3940256099942544/2435281174';
// export const INTERSTITIAL_AD_UNIT_ID = 'ca-app-pub-3940256099942544/4411468910';

// ── 撮影回数カウンタ（インタースティシャル頻度判定用）────────────────
const COUNT_KEY = 'capture_count';
const INTERSTITIAL_FREQUENCY = 10;

export async function incrementCaptureCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(COUNT_KEY);
  const cur = raw ? parseInt(raw, 10) || 0 : 0;
  const next = cur + 1;
  await AsyncStorage.setItem(COUNT_KEY, String(next));
  return next;
}

export function shouldShowInterstitial(count: number): boolean {
  return count > 0 && count % INTERSTITIAL_FREQUENCY === 0;
}
