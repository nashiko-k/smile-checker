import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import mobileAds from 'react-native-google-mobile-ads';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { SplashOverlay } from '../components/SplashOverlay';
import { initInterstitial } from '../lib/interstitial';

export default function RootLayout() {
  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    (async () => {
      // ATT (App Tracking Transparency) の許可ダイアログを先に表示。
      // 許可/拒否のいずれでも AdMob は初期化する（拒否時は非パーソナライズ広告）。
      try {
        await requestTrackingPermissionsAsync();
      } catch {}
      try {
        await mobileAds().initialize();
        await initInterstitial();
      } catch {}
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="baseline" options={{ presentation: 'modal' }} />
      </Stack>
      {splashVisible && (
        <SplashOverlay onDone={() => setSplashVisible(false)} />
      )}
    </GestureHandlerRootView>
  );
}
