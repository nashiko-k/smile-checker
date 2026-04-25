import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../lib/theme';

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
      <View style={styles.center}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconEmoji}>📸</Text>
          <Text style={styles.iconSmile}>😊</Text>
        </View>
        <Text style={styles.appName}>FaceGlow</Text>
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
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  iconEmoji: {
    fontSize: 52,
  },
  iconSmile: {
    position: 'absolute',
    bottom: 22,
    right: 24,
    fontSize: 26,
  },
  appName: {
    color: colors.primaryDeep,
    fontSize: 38,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
