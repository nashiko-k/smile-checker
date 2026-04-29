import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import {
  clearBaseline,
  loadBaseline,
  type BaselineData,
} from '../../lib/baseline';
import {
  clearProfile,
  loadProfile,
  saveProfile,
  type UserProfile,
} from '../../lib/profile';
import { colors, radius } from '../../lib/theme';

export default function SettingsScreen() {
  const [baseline, setBaseline] = useState<BaselineData | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ageInput, setAgeInput] = useState('');
  const [savingAge, setSavingAge] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const refresh = useCallback(async () => {
    const [b, p] = await Promise.all([loadBaseline(), loadProfile()]);
    setBaseline(b);
    setProfile(p);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (profile && !ageInput) {
      setAgeInput(String(profile.actualAge));
    }
  }, [profile, ageInput]);

  const onSaveAge = async () => {
    const n = Number(ageInput);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 120) {
      Alert.alert('入力エラー', '1〜120の整数を入力してください');
      return;
    }
    try {
      setSavingAge(true);
      Keyboard.dismiss();
      const next = await saveProfile(n);
      setProfile(next);
      Alert.alert('保存しました');
    } catch (e) {
      Alert.alert(
        '保存失敗',
        e instanceof Error ? e.message : '不明なエラーが発生しました',
      );
    } finally {
      setSavingAge(false);
    }
  };

  const confirmClearProfile = () => {
    Alert.alert(
      '実年齢を削除',
      '若見え度の表示が止まります。よろしいですか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            await clearProfile();
            setProfile(null);
            setAgeInput('');
          },
        },
      ],
    );
  };

  const confirmClearBaseline = () => {
    Alert.alert('基準の顔を削除', '本当に削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await clearBaseline();
          refresh();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>設定</Text>

      {/* 実年齢アコーディオン */}
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => setProfileOpen((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={styles.accordionTitle}>
            若見え度を使う（実年齢の設定）
          </Text>
          <Text style={styles.accordionArrow}>{profileOpen ? '▼' : '▶'}</Text>
        </TouchableOpacity>
        {profileOpen && (
          <View style={styles.accordionBody}>
            {profile ? (
              <>
                <Text style={styles.cardBody}>
                  設定済み: {profile.actualAge}歳（
                  {new Date(profile.updatedAt).toLocaleDateString('ja-JP')}
                  更新）
                </Text>
                <TouchableOpacity
                  style={styles.inlineDanger}
                  onPress={confirmClearProfile}
                >
                  <Text style={styles.inlineDangerText}>削除</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.cardBody}>
                  実年齢を設定すると若見え度が表示されます。
                </Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    value={ageInput}
                    onChangeText={setAgeInput}
                    keyboardType="number-pad"
                    placeholder="例: 35"
                    placeholderTextColor={colors.textMid}
                    maxLength={3}
                    returnKeyType="done"
                    onSubmitEditing={onSaveAge}
                  />
                  <Text style={styles.inputSuffix}>歳</Text>
                  <TouchableOpacity
                    style={[styles.btnSmall, savingAge && styles.btnDisabled]}
                    onPress={onSaveAge}
                    disabled={savingAge}
                  >
                    <Text style={styles.btnSmallText}>保存</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}
      </View>

      {/* 基準の顔 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>基準の顔</Text>
        {baseline ? (
          <>
            <Text style={styles.cardBody}>
              保存済み: {new Date(baseline.timestamp).toLocaleString('ja-JP')}
            </Text>
            <Text style={styles.cardBody}>
              基準年齢: {Math.round(baseline.age)}歳 / 笑顔度{' '}
              {(baseline.smilingProb * 100).toFixed(0)}%
            </Text>
          </>
        ) : (
          <Text style={styles.cardBody}>まだ撮影されていません。</Text>
        )}
      </View>

      <Link href="/baseline" asChild>
        <TouchableOpacity style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>
            {baseline ? '基準の顔を撮り直す' : '基準の顔を撮影する'}
          </Text>
        </TouchableOpacity>
      </Link>

      {baseline && (
        <TouchableOpacity
          style={styles.dangerBtn}
          onPress={confirmClearBaseline}
        >
          <Text style={styles.dangerBtnText}>基準の顔を削除</Text>
        </TouchableOpacity>
      )}

      {/* 測定のしくみ */}
      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>測定のしくみ</Text>
        <Text style={styles.infoCardBody}>
          このアプリでは撮影時に複数フレームを連続解析し、
          中央値から顔年齢を算出しています。
          1回の撮影で安定した結果が得られるよう工夫しています。
        </Text>
      </View>

      <Text style={styles.disclaimer}>
        本アプリの年齢・表情の判定はAIによる推定であり、
        実際の年齢や医学的な評価を示すものではありません。
        結果はあくまでエンターテインメントとしてお楽しみください。
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgMain },
  content: { padding: 20, paddingTop: 56, paddingBottom: 48 },
  title: {
    color: colors.primaryDeep,
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardTitle: {
    color: colors.primaryDeep,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardBody: { color: colors.textDark, fontSize: 14, marginBottom: 4 },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accordionTitle: {
    color: colors.primaryDeep,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  accordionArrow: {
    color: colors.primary,
    fontSize: 12,
    marginLeft: 8,
  },
  accordionBody: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  inlineDanger: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.error,
  },
  inlineDangerText: { color: colors.error, fontSize: 13, fontWeight: '500' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 8,
  },
  input: {
    backgroundColor: colors.primaryLightest,
    color: colors.textDark,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryLighter,
    fontSize: 18,
    minWidth: 90,
    textAlign: 'center',
  },
  inputSuffix: { color: colors.textDark, fontSize: 16 },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '500' },
  btnSmall: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.pill,
    marginLeft: 'auto',
  },
  btnSmallText: { color: colors.white, fontSize: 14, fontWeight: '500' },
  dangerBtn: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.error,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  dangerBtnText: { color: colors.error, fontSize: 15, fontWeight: '500' },
  btnDisabled: { opacity: 0.5 },
  infoCard: {
    backgroundColor: colors.primaryLightest,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.primaryLighter,
    marginTop: 12,
  },
  infoCardTitle: {
    color: colors.primaryDeep,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  infoCardBody: {
    color: colors.textDark,
    fontSize: 12,
    lineHeight: 18,
  },
  disclaimer: {
    color: colors.textMid,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 24,
    paddingHorizontal: 4,
  },
});
