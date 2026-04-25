import { useState } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { SplashOverlay } from '../components/SplashOverlay';

export default function RootLayout() {
  const [splashVisible, setSplashVisible] = useState(true);

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
