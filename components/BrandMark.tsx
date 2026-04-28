import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * 笑顔チェッカー ブランドマーク。
 * ピンクの円の中にカメラ + 黄色いスマイル絵文字風の構図。
 * Design system の assets/logo-mark.svg をそのまま再現。
 */
export function BrandMark({ size = 140 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 140 140">
      <Circle cx="70" cy="70" r="70" fill="#FF85A2" />
      {/* カメラ本体 */}
      <Rect x="34" y="48" width="72" height="52" rx="10" fill="#FFFFFF" />
      <Rect x="56" y="42" width="28" height="10" rx="3" fill="#FFFFFF" />
      <Circle cx="70" cy="74" r="16" fill="#FFE0E8" />
      <Circle cx="70" cy="74" r="9" fill="#FF85A2" />
      <Circle cx="93" cy="58" r="3" fill="#FFC1D0" />
      {/* スマイル */}
      <Circle
        cx="100"
        cy="98"
        r="14"
        fill="#FFE89A"
        stroke="#FFFFFF"
        strokeWidth="3"
      />
      <Circle cx="95" cy="95" r="1.6" fill="#5A3E2B" />
      <Circle cx="105" cy="95" r="1.6" fill="#5A3E2B" />
      <Path
        d="M93 100 Q100 107 107 100"
        stroke="#5A3E2B"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}
