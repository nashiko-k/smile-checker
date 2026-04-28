import {
  AdEventType,
  InterstitialAd,
} from 'react-native-google-mobile-ads';
import { INTERSTITIAL_AD_UNIT_ID } from './ads';

let interstitial: InterstitialAd | null = null;
let isLoaded = false;

/** アプリ起動時に1回だけ呼ぶ。広告枠を裏で読み込む。 */
export function initInterstitial(): void {
  if (interstitial) return;
  const ad = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, {
    requestNonPersonalizedAdsOnly: true,
  });
  ad.addAdEventListener(AdEventType.LOADED, () => {
    isLoaded = true;
  });
  ad.addAdEventListener(AdEventType.ERROR, () => {
    isLoaded = false;
  });
  ad.load();
  interstitial = ad;
}

/**
 * 既に読み込み済みなら広告を表示し、閉じられるまで（または失敗まで）待つ。
 * 未読み込み・未初期化なら即 resolve（呼び出し側はそのまま画面遷移すれば良い）。
 */
export async function maybeShowInterstitial(): Promise<void> {
  const ad = interstitial;
  if (!ad || !isLoaded) return;
  isLoaded = false;
  await new Promise<void>((resolve) => {
    let done = false;
    let unsubClose: (() => void) | null = null;
    let unsubErr: (() => void) | null = null;
    const finish = () => {
      if (done) return;
      done = true;
      unsubClose?.();
      unsubErr?.();
      // 次回用に再ロード（成功時は LOADED で isLoaded = true になる）
      ad.load();
      resolve();
    };
    unsubClose = ad.addAdEventListener(AdEventType.CLOSED, finish);
    unsubErr = ad.addAdEventListener(AdEventType.ERROR, finish);
    ad.show().catch(() => finish());
    // 安全弁
    setTimeout(finish, 10000);
  });
}
