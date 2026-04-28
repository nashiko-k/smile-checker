import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../lib/theme';
import { BrandMark } from './BrandMark';
import { Flower, Sparkle } from './decorations';

export function SplashOverlay({ onDone }: { onDone: () => void }) {
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => onDone());
    }, 1200);
    return () => clearTimeout(t);
  }, [fade, onDone]);

  return (
    <Animated.View
      pointerEvents="auto"
      style={[StyleSheet.absoluteFillObject, { opacity: fade }]}
    >
      <LinearGradient
        colors={['#FFE0E8', '#FFF0F5', '#F8F4FF']}
        style={StyleSheet.absoluteFill}
      />

      {/* 装飾：きらきら + お花 */}
      <View
        pointerEvents="none"
        style={[styles.deco, { top: 110, left: 56, opacity: 0.55 }]}
      >
        <Sparkle size={20} color="#FFB6C1" />
      </View>
      <View
        pointerEvents="none"
        style={[styles.deco, { top: 180, right: 60, opacity: 0.55 }]}
      >
        <Sparkle size={14} color="#FFB6C1" />
      </View>
      <View
        pointerEvents="none"
        style={[styles.deco, { top: 240, left: 38, opacity: 0.4 }]}
      >
        <Flower size={26} color={colors.flower} />
      </View>
      <View
        pointerEvents="none"
        style={[styles.deco, { top: 280, right: 38, opacity: 0.35 }]}
      >
        <Sparkle size={14} color={colors.sky} />
      </View>
      <View
        pointerEvents="none"
        style={[styles.deco, { bottom: 200, left: 48, opacity: 0.7 }]}
      >
        <Sparkle size={16} color={colors.skySoft} />
      </View>
      <View
        pointerEvents="none"
        style={[styles.deco, { bottom: 130, right: 70, opacity: 0.55 }]}
      >
        <Sparkle size={22} color="#FFB6C1" />
      </View>

      <View style={styles.center}>
        <BrandMark size={140} />
        <Text style={styles.appName}>笑顔チェッカー</Text>
        <Text style={styles.subtitle}>きょうの顔、いい感じ。</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  deco: {
    position: 'absolute',
  },
  appName: {
    color: colors.primaryDeep,
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 22,
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textMid,
    fontSize: 13,
    fontWeight: '400',
  },
});
