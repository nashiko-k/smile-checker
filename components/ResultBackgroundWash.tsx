import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * 結果画面用の柔らかい背景。
 * 中央上方からピンクが射すラジアルグラデーション + 0.85 の白ウォッシュ。
 * Design system の screens.jsx ScreenResult 背景仕様を再現。
 */
export function ResultBackgroundWash() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <RadialGradient
            id="resultGrad"
            cx="50%"
            cy="40%"
            rx="80%"
            ry="80%"
            fx="50%"
            fy="40%"
          >
            <Stop offset="0%" stopColor="#FFD1DC" stopOpacity="1" />
            <Stop offset="60%" stopColor="#FFE6EC" stopOpacity="1" />
            <Stop offset="100%" stopColor="#FFF5F7" stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#resultGrad)" />
      </Svg>
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(255,255,255,0.85)' },
        ]}
      />
    </View>
  );
}
