import { StyleSheet, View } from 'react-native';
import {
  BannerAd,
  BannerAdSize,
} from 'react-native-google-mobile-ads';
import { BANNER_AD_UNIT_ID } from '../lib/ads';
import { colors } from '../lib/theme';

/**
 * タブバーのすぐ上に置く共通バナー。
 * ANCHORED_ADAPTIVE_BANNER は端末幅にフィットする推奨サイズ。
 */
export function AppBannerAd() {
  return (
    <View style={styles.wrap}>
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: colors.bgTab,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
});
