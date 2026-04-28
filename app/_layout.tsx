import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import mobileAds from 'react-native-google-mobile-ads';
import { SplashOverlay } from '../components/SplashOverlay';
import { initInterstitial } from '../lib/interstitial';

export default function RootLayout() {
  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    mobileAds()
      .initialize()
      .then(() => initInterstitial())
      .catch(() => {});
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
