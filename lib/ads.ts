import AsyncStorage from '@react-native-async-storage/async-storage';

// ── 広告ユニットID ──────────────────────────────────────────────────────
// 開発中は必ずテスト用ID。本番IDをテスト中にクリックするとアカウント停止リスクがある。
// リリース直前にコメントを差し替えて、テストID側をコメントアウトする。
export const BANNER_AD_UNIT_ID = 'ca-app-pub-3940256099942544/2435281174';
export const INTERSTITIAL_AD_UNIT_ID =
  'ca-app-pub-3940256099942544/4411468910';

// 本番用（リリース直前に切り替え）
// export const BANNER_AD_UNIT_ID = 'ca-app-pub-6109118020281273/2236365845';
// export const INTERSTITIAL_AD_UNIT_ID = 'ca-app-pub-6109118020281273/8721883145';

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
