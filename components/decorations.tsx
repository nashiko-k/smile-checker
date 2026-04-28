import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

export function Sparkle({
  size = 20,
  color = '#FFB6C1',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2 C12.6 7.6 16.4 11.4 22 12 C16.4 12.6 12.6 16.4 12 22 C11.4 16.4 7.6 12.6 2 12 C7.6 11.4 11.4 7.6 12 2 Z"
        fill={color}
      />
    </Svg>
  );
}

export function Flower({
  size = 26,
  color = '#E0CFE8',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G fill={color}>
        <Ellipse cx="12" cy="5" rx="3" ry="4" />
        <Ellipse cx="12" cy="19" rx="3" ry="4" />
        <Ellipse cx="5" cy="9.5" rx="4" ry="3" transform="rotate(-30 5 9.5)" />
        <Ellipse cx="19" cy="9.5" rx="4" ry="3" transform="rotate(30 19 9.5)" />
        <Ellipse cx="5" cy="14.5" rx="4" ry="3" transform="rotate(30 5 14.5)" />
        <Ellipse cx="19" cy="14.5" rx="4" ry="3" transform="rotate(-30 19 14.5)" />
      </G>
      <Circle cx="12" cy="12" r="2.2" fill="#FFF5F7" />
    </Svg>
  );
}
