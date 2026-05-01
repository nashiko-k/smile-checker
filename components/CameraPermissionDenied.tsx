import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '../lib/theme';

/**
 * カメラ権限が denied / restricted の場合の案内画面。
 * iOS では一度拒否されると再度ダイアログを出せないため、設定アプリへ誘導する。
 */
export function CameraPermissionDenied() {
  return (
    <View style={styles.center}>
      <View style={styles.card}>
        <Text style={styles.emoji}>📷</Text>
        <Text style={styles.title}>カメラの使用が許可されていません</Text>
        <Text style={styles.body}>
          カメラを使うには、端末の設定からカメラへのアクセスを許可してください。
        </Text>
      </View>
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => Linking.openSettings().catch(() => {})}
      >
        <Text style={styles.primaryBtnText}>設定を開く</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.bgMain,
  },
  card: {
    backgroundColor: colors.primaryLightest,
    borderRadius: radius.xl,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.primaryLighter,
  },
  emoji: { fontSize: 40, marginBottom: 12 },
  title: {
    color: colors.textDark,
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 10,
    textAlign: 'center',
  },
  body: {
    color: colors.textDark,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    minHeight: 48,
    borderRadius: radius.pill,
    minWidth: 220,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '500',
  },
});
