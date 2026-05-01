import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  Calendar,
  LocaleConfig,
  type DateData,
} from 'react-native-calendars';
import { LineChart } from 'react-native-chart-kit';
import {
  dateStringFromTimestamp,
  deleteHistoryEntry,
  deleteHistoryPhoto,
  formatTimeHM,
  loadHistory,
  type HistoryEntry,
} from '../../lib/history';
import { loadProfile, type UserProfile } from '../../lib/profile';
import { loadBaseline, type BaselineData } from '../../lib/baseline';
import { analyzePartsFromData } from '../../lib/partsAnalysis';
import {
  combinedHeartCount,
  smileFeedbackFromProb,
  youngScoreFromDiff,
} from '../../lib/smile';
import { colors, radius } from '../../lib/theme';
import { HeartRow } from '../../components/HeartRow';

LocaleConfig.locales.ja = {
  monthNames: [
    '1月',
    '2月',
    '3月',
    '4月',
    '5月',
    '6月',
    '7月',
    '8月',
    '9月',
    '10月',
    '11月',
    '12月',
  ],
  monthNamesShort: [
    '1月',
    '2月',
    '3月',
    '4月',
    '5月',
    '6月',
    '7月',
    '8月',
    '9月',
    '10月',
    '11月',
    '12月',
  ],
  dayNames: [
    '日曜日',
    '月曜日',
    '火曜日',
    '水曜日',
    '木曜日',
    '金曜日',
    '土曜日',
  ],
  dayNamesShort: ['日', '月', '火', '水', '木', '金', '土'],
  today: 'きょう',
};
LocaleConfig.defaultLocale = 'ja';

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonthFirstDay(ym: string): string {
  const parts = ym.split('-');
  const y = parseInt(parts[0]!, 10);
  const m = parseInt(parts[1]!, 10);
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return `${ny}-${String(nm).padStart(2, '0')}-01`;
}

// 結果画面と同じ算出: 若見え度 × 笑顔度の合算ハート数
function totalHeartsForEntry(
  entry: HistoryEntry,
  profile: UserProfile | null,
): number {
  const smile = smileFeedbackFromProb(entry.smileProb);
  const diff =
    profile != null ? profile.actualAge - Math.round(entry.faceAge) : null;
  const youngScore = diff != null ? youngScoreFromDiff(diff) : 3;
  return combinedHeartCount(youngScore, smile.filledHearts);
}

const screenWidth = Dimensions.get('window').width;
const chartWidth = screenWidth - 32;

const calendarTheme = {
  backgroundColor: colors.bgMain,
  calendarBackground: colors.bgMain,
  textSectionTitleColor: colors.primary,
  monthTextColor: colors.primaryDeep,
  todayTextColor: colors.primary,
  dayTextColor: colors.textDark,
  textDisabledColor: '#D8D8D8',
  arrowColor: colors.primary,
  selectedDayBackgroundColor: colors.primary,
  selectedDayTextColor: colors.white,
  textMonthFontWeight: '600' as const,
  textDayFontWeight: '400' as const,
};

export default function HistoryScreen() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [baseline, setBaseline] = useState<BaselineData | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    dateStringFromTimestamp(Date.now()),
  );
  const [modalImagePath, setModalImagePath] = useState<string | null>(null);
  const [flashDate, setFlashDate] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<string>(currentYearMonth());
  const flashAnim = useRef(new Animated.Value(0)).current;
  const lastFlashRef = useRef<string | null>(null);

  const { flash } = useLocalSearchParams<{ flash?: string }>();

  const refresh = useCallback(async () => {
    const [h, p, b] = await Promise.all([
      loadHistory(),
      loadProfile(),
      loadBaseline(),
    ]);
    setEntries(h);
    setProfile(p);
    setBaseline(b);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (typeof flash === 'string' && flash !== lastFlashRef.current) {
      lastFlashRef.current = flash;
      setSelectedDate(flash);
      setFlashDate(flash);
      flashAnim.setValue(0);
      Animated.sequence([
        Animated.timing(flashAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.delay(350),
        Animated.timing(flashAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => setFlashDate(null));
    }
  }, [flash, flashAnim]);

  // 日付キー → その日の全エントリ（新しい順）
  const entriesByDate = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    for (const e of entries) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => b.timestamp - a.timestamp);
    }
    return map;
  }, [entries]);

  // 日付キー → その日の最新エントリ（カレンダーのハート用）
  const latestByDate = useMemo(() => {
    const map = new Map<string, HistoryEntry>();
    for (const [date, arr] of entriesByDate.entries()) {
      if (arr[0]) map.set(date, arr[0]);
    }
    return map;
  }, [entriesByDate]);

  const selectedEntries = entriesByDate.get(selectedDate) ?? [];
  const todayStr = dateStringFromTimestamp(Date.now());
  const selectedIsToday = selectedDate === todayStr;

  const confirmDeleteEntry = useCallback(
    (entry: HistoryEntry) => {
      Alert.alert('この記録を削除', 'どのように削除しますか？', [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '写真だけ削除する',
          onPress: async () => {
            await deleteHistoryPhoto(entry.timestamp);
            refresh();
          },
        },
        {
          text: '記録をすべて削除する',
          style: 'destructive',
          onPress: async () => {
            await deleteHistoryEntry(entry.timestamp);
            refresh();
          },
        },
      ]);
    },
    [refresh],
  );

  const renderDay = useCallback(
    ({ date, state }: { date?: DateData; state?: string }) => {
      if (!date) return <View style={styles.dayCell} />;
      const entry = latestByDate.get(date.dateString);
      const isToday = state === 'today';
      const isSelected = date.dateString === selectedDate;
      const isDisabled = state === 'disabled';
      const isFlashing = date.dateString === flashDate;

      return (
        <TouchableOpacity
          style={[styles.dayCell, isSelected && styles.dayCellSelected]}
          onPress={() => setSelectedDate(date.dateString)}
          disabled={isDisabled}
        >
          {isFlashing && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.flashOverlay,
                {
                  opacity: flashAnim,
                  transform: [
                    {
                      scale: flashAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.6, 1.3],
                      }),
                    },
                  ],
                },
              ]}
            />
          )}
          <Text
            style={[
              styles.dayNum,
              isDisabled && styles.dayNumDisabled,
              isToday && styles.dayNumToday,
            ]}
          >
            {date.day}
          </Text>
          {entry && (
            <Text style={styles.dayHearts}>
              {'♥'.repeat(totalHeartsForEntry(entry, profile))}
            </Text>
          )}
        </TouchableOpacity>
      );
    },
    [latestByDate, selectedDate, flashDate, flashAnim, profile],
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>カレンダー</Text>

      <Calendar
        theme={calendarTheme}
        dayComponent={renderDay}
        hideExtraDays={false}
        firstDay={0}
        monthFormat="yyyy年 M月"
        onMonthChange={(d) => {
          const ym = `${d.year}-${String(d.month).padStart(2, '0')}`;
          setVisibleMonth(ym);
        }}
      />

      <View style={styles.detailBox}>
        <Text style={styles.detailDate}>{selectedDate}</Text>
        {selectedEntries.length === 0 ? (
          <Text style={styles.detailEmpty}>この日は記録がありません。</Text>
        ) : (
          selectedEntries.map((entry) => (
            <EntryCard
              key={entry.timestamp}
              entry={entry}
              profile={profile}
              baseline={baseline}
              onPressImage={() => setModalImagePath(entry.imagePath)}
              onDelete={() => confirmDeleteEntry(entry)}
            />
          ))
        )}
        {selectedIsToday && (
          <TouchableOpacity
            style={styles.retakeBtn}
            onPress={() => router.push('/')}
          >
            <Text style={styles.retakeBtnText}>
              {selectedEntries.length > 0
                ? 'きょうの記録を撮り直す'
                : 'きょうの記録をつける'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.chartTitle}>顔年齢の推移</Text>
      <FaceAgeChart entries={entries} visibleMonth={visibleMonth} />

      {entries.length === 0 && (
        <Text style={styles.emptyHint}>
          記録タブで撮影して「保存する」から追加できます。
        </Text>
      )}

      <Modal
        visible={modalImagePath != null && modalImagePath !== ''}
        transparent
        animationType="fade"
        onRequestClose={() => setModalImagePath(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalImagePath(null)}
        >
          {modalImagePath ? (
            <Image
              source={{ uri: `file://${modalImagePath}` }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          ) : null}
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setModalImagePath(null)}
          >
            <Text style={styles.modalCloseText}>×</Text>
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function FaceAgeChart({
  entries,
  visibleMonth,
}: {
  entries: HistoryEntry[];
  visibleMonth: string;
}) {
  const scrollRef = useRef<ScrollView>(null);

  const chart = useMemo(() => {
    if (entries.length === 0) return null;

    // 日ごとに最新1件だけ抽出、昇順（古い→新しい）にソート
    const byDate = new Map<string, HistoryEntry>();
    for (const e of entries) {
      const prev = byDate.get(e.date);
      if (!prev || prev.timestamp < e.timestamp) byDate.set(e.date, e);
    }
    const points = [...byDate.values()].sort(
      (a, b) => a.timestamp - b.timestamp,
    );
    if (points.length === 0) return null;

    const data = points.map((p) => Math.round(p.faceAge));
    const labels = points.map((p) => {
      const parts = p.date.split('-');
      return `${parseInt(parts[1]!, 10)}/${parseInt(parts[2]!, 10)}`;
    });

    // Y軸レンジ: min-2 〜 max+2 （透明な anchor dataset で強制）
    const minData = Math.min(...data);
    const maxData = Math.max(...data);
    const yMin = minData - 2;
    const yMax = maxData + 2;

    // 1画面あたり約7スロット。8件以上で横スクロール。
    const PER_SLOT = chartWidth / 7;
    const scrollable = points.length >= 8;
    const fullWidth = scrollable
      ? Math.round(PER_SLOT * points.length) + 40
      : chartWidth;

    return {
      points,
      data,
      labels,
      yMin,
      yMax,
      perSlot: PER_SLOT,
      fullWidth,
      scrollable,
    };
  }, [entries]);

  // 初回描画後に右端（最新）へスクロール（スクロール可能なときだけ）
  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    if (!chart || !chart.scrollable || didInitialScrollRef.current) return;
    didInitialScrollRef.current = true;
    const t = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
    }, 80);
    return () => clearTimeout(t);
  }, [chart]);

  // カレンダーの表示月が変わったら、その月の最初のデータ点へスクロール
  const didFirstMonthEffectRef = useRef(false);
  useEffect(() => {
    if (!chart || !chart.scrollable) return;
    if (!didFirstMonthEffectRef.current) {
      didFirstMonthEffectRef.current = true;
      return;
    }
    const monthStart = `${visibleMonth}-01`;
    const nextStart = nextMonthFirstDay(visibleMonth);
    const inMonthIdx = chart.points.findIndex(
      (p) => p.date >= monthStart && p.date < nextStart,
    );
    let target: number;
    if (inMonthIdx >= 0) {
      target = inMonthIdx * chart.perSlot;
    } else if ((chart.points[0]?.date ?? '') >= nextStart) {
      // 表示月が全データより過去 → 先頭へ
      target = 0;
    } else {
      // 表示月が全データより未来 → 末尾へ
      target = chart.fullWidth;
    }
    scrollRef.current?.scrollTo({ x: Math.max(0, target), animated: true });
  }, [visibleMonth, chart]);

  if (chart == null) {
    return <Text style={styles.chartEmpty}>まだ記録がありません。</Text>;
  }

  // データ1件のみ: 中央に1ドット表示、線なし
  if (chart.points.length === 1) {
    return (
      <View style={styles.singlePointBox}>
        <View style={styles.singlePointDot} />
        <Text style={styles.singlePointText}>
          {chart.labels[0]}: {chart.data[0]}歳
        </Text>
      </View>
    );
  }

  const anchorMin = new Array(chart.data.length).fill(chart.yMin);
  const anchorMax = new Array(chart.data.length).fill(chart.yMax);

  const chartEl = (
    <LineChart
      data={{
        labels: chart.labels,
        datasets: [
          {
            data: chart.data,
            color: (o = 1) => `rgba(255, 133, 162, ${o})`,
            strokeWidth: 2.5,
          },
          {
            data: anchorMin,
            color: () => 'rgba(0,0,0,0)',
            strokeWidth: 0,
            withDots: false,
          },
          {
            data: anchorMax,
            color: () => 'rgba(0,0,0,0)',
            strokeWidth: 0,
            withDots: false,
          },
        ],
      }}
      width={chart.fullWidth}
      height={220}
      chartConfig={{
        backgroundColor: colors.accent,
        backgroundGradientFrom: colors.accent,
        backgroundGradientTo: colors.accent,
        decimalPlaces: 0,
        color: (o = 1) => `rgba(255, 133, 162, ${o})`,
        labelColor: (o = 1) => `rgba(136, 136, 136, ${o})`,
        propsForDots: { r: '5', strokeWidth: '2', stroke: '#FF85A2', fill: '#FFFFFF' },
        propsForBackgroundLines: { stroke: 'rgba(176,112,144,0.15)' },
      }}
      segments={4}
      bezier={false}
      style={styles.chart}
      fromZero={false}
      verticalLabelRotation={0}
    />
  );

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      scrollEnabled={chart.scrollable}
      showsHorizontalScrollIndicator={chart.scrollable}
      style={styles.chartScroll}
    >
      {chartEl}
    </ScrollView>
  );
}

function EntryCard({
  entry,
  profile,
  baseline,
  onPressImage,
  onDelete,
}: {
  entry: HistoryEntry;
  profile: UserProfile | null;
  baseline: BaselineData | null;
  onPressImage: () => void;
  onDelete: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const smile = smileFeedbackFromProb(entry.smileProb);
  const diff =
    profile != null ? profile.actualAge - Math.round(entry.faceAge) : null;
  // 結果画面 (index.tsx) と同じデフォルト (3 = 中立) で算出
  const youngScore = diff != null ? youngScoreFromDiff(diff) : 3;
  const totalHearts = combinedHeartCount(youngScore, smile.filledHearts);
  const diffLabel =
    diff == null
      ? null
      : diff > 0
        ? `若見え度 +${diff}歳`
        : diff === 0
          ? '年齢相応の素敵な表情'
          : '笑顔で撮り直すと変わるかも！';

  const partItems = analyzePartsFromData(
    {
      smile: entry.smileProb,
      leftEye: entry.leftEyeOpen,
      rightEye: entry.rightEyeOpen,
    },
    baseline
      ? {
          smile: baseline.smilingProb,
          leftEye: baseline.leftEyeOpen,
          rightEye: baseline.rightEyeOpen,
        }
      : null,
  );

  return (
    <View style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <Text style={styles.entryTime}>撮影時刻: {formatTimeHM(entry.timestamp)}</Text>
        <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>削除</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.entryBody}>
        {entry.imagePath ? (
          <TouchableOpacity onPress={onPressImage} activeOpacity={0.8}>
            <Image
              source={{ uri: `file://${entry.imagePath}` }}
              style={styles.entryImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ) : (
          <View style={[styles.entryImage, styles.entryImagePlaceholder]}>
            <Text style={styles.entryImagePlaceholderText}>写真なし</Text>
          </View>
        )}
        <View style={styles.entryText}>
          <Text style={styles.entryLine}>
            顔年齢: {Math.round(entry.faceAge)}歳
          </Text>
          {diffLabel && <Text style={styles.entryDiff}>{diffLabel}</Text>}
          <View style={styles.entryHearts}>
            <Text style={styles.entryHeartsLabel}>笑顔度：</Text>
            <HeartRow filled={totalHearts} size={18} gap={3} />
          </View>
        </View>
      </View>

      {partItems.length > 0 && (
        <View>
          <TouchableOpacity
            style={styles.entryAccordionHeader}
            onPress={() => setDetailsOpen((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.entryAccordionHeaderText}>
              詳しくみる {detailsOpen ? '▼' : '▶'}
            </Text>
          </TouchableOpacity>
          {detailsOpen && (
            <View style={styles.entryAccordionBody}>
              {partItems.map((it) => (
                <View key={it.key} style={styles.entryPartItem}>
                  <Text style={styles.entryPartLabel}>{it.label}</Text>
                  <Text style={styles.entryPartComment}>{it.comment}</Text>
                  {it.comparison && (
                    <Text style={styles.entryPartComparison}>
                      {it.comparison}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgMain },
  content: { paddingTop: 56, paddingBottom: 48, paddingHorizontal: 16 },
  title: {
    color: colors.primaryDeep,
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 12,
  },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 6,
    paddingBottom: 4,
    minHeight: 46,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  dayCellSelected: { backgroundColor: colors.primaryLighter },
  dayNum: { color: colors.textDark, fontSize: 14 },
  dayNumDisabled: { color: '#D8D8D8' },
  dayNumToday: { color: colors.primary, fontWeight: '600' },
  dayHearts: {
    color: colors.primary,
    fontSize: 9,
    marginTop: 2,
    letterSpacing: -1,
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,133,162,0.55)',
  },
  detailBox: {
    backgroundColor: colors.primaryLightest,
    borderRadius: radius.lg,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.primaryLighter,
  },
  detailDate: {
    color: colors.primaryDeep,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  detailEmpty: { color: colors.textMid, fontSize: 14 },
  entryCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entryTime: { color: colors.textDark, fontSize: 13, fontWeight: '600' },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  deleteBtnText: { color: colors.textLight, fontSize: 12, fontWeight: '500' },
  entryBody: { flexDirection: 'row', gap: 12 },
  entryImage: {
    width: 90,
    height: 90,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    opacity: 0.95,
  },
  entryImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLightest,
  },
  entryImagePlaceholderText: { color: colors.textMid, fontSize: 11 },
  entryText: { flex: 1, justifyContent: 'center' },
  entryLine: { color: colors.textDark, fontSize: 14, marginBottom: 4 },
  entryDiff: {
    color: colors.primaryDeep,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  entryHearts: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  entryHeartsLabel: {
    color: colors.textDark,
    fontSize: 13,
    fontWeight: '500',
  },
  entryAccordionHeader: {
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  entryAccordionHeaderText: {
    color: colors.primaryDeep,
    fontSize: 13,
    fontWeight: '500',
  },
  entryAccordionBody: {
    backgroundColor: colors.primaryLightest,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.primaryLighter,
    gap: 8,
  },
  entryPartItem: { paddingVertical: 2 },
  entryPartLabel: {
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  entryPartComment: {
    color: colors.textDark,
    fontSize: 12,
    lineHeight: 18,
  },
  entryPartComparison: {
    color: colors.textMid,
    fontSize: 11,
    marginTop: 2,
  },
  retakeBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.pill,
    marginTop: 8,
    alignItems: 'center',
  },
  retakeBtnText: { color: colors.white, fontSize: 15, fontWeight: '500' },
  chartTitle: {
    color: colors.textDark,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
  },
  chart: { borderRadius: radius.lg },
  chartScroll: {
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
  },
  singlePointBox: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  singlePointDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.primaryLighter,
    marginBottom: 14,
  },
  singlePointText: { color: colors.textDark, fontSize: 14 },
  chartEmpty: {
    color: colors.textMid,
    fontSize: 13,
    padding: 16,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    textAlign: 'center',
  },
  emptyHint: {
    color: colors.textMid,
    fontSize: 13,
    marginTop: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalClose: {
    position: 'absolute',
    top: 48,
    right: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: { color: colors.white, fontSize: 28, fontWeight: '500' },
});
