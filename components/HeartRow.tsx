import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../lib/theme';

const HEART_PATH =
  'M12 21 C 6 17 2 13 2 8.5 C 2 5.5 4.5 3 7.5 3 C 9.5 3 11 4 12 5.5 C 13 4 14.5 3 16.5 3 C 19.5 3 22 5.5 22 8.5 C 22 13 18 17 12 21 Z';

function HeartFill({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={HEART_PATH} fill={colors.primary} />
    </Svg>
  );
}

function HeartOut({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={HEART_PATH}
        fill="none"
        stroke={colors.buttonBorder}
        strokeWidth={1.6}
      />
    </Svg>
  );
}

export function HeartRow({
  filled = 5,
  total = 5,
  size = 32,
  gap = 4,
}: {
  filled?: number;
  total?: number;
  size?: number;
  gap?: number;
}) {
  const items = [];
  for (let i = 0; i < total; i++) {
    items.push(
      <View
        key={i}
        style={{ marginRight: i < total - 1 ? gap : 0 }}
      >
        {i < filled ? <HeartFill size={size} /> : <HeartOut size={size} />}
      </View>,
    );
  }
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {items}
    </View>
  );
}
