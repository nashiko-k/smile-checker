import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link, router, useFocusEffect } from 'expo-router';
import {
  Camera,
  runAtTargetFps,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import {
  useFaceDetector,
  type FrameFaceDetectionOptions,
} from 'react-native-vision-camera-face-detector';
import { Worklets, useSharedValue } from 'react-native-worklets-core';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { loadBaseline, type BaselineData } from '../../lib/baseline';
import {
  addHistoryEntry,
  dateStringFromTimestamp,
  loadHistory,
} from '../../lib/history';
import { loadProfile, type UserProfile } from '../../lib/profile';
import {
  combinedHeartCount,
  getCombinedFeedback,
  smileFeedbackFromProb,
  youngScoreFromDiff,
} from '../../lib/smile';
import { trimmedMedian } from '../../lib/measure';
import { beautifyPhoto } from '../../lib/beautify';
import { incrementCaptureCount, shouldShowInterstitial } from '../../lib/ads';
import { maybeShowInterstitial } from '../../lib/interstitial';
import { colors, radius } from '../../lib/theme';
import { BrandMark } from '../../components/BrandMark';
import { HeartRow } from '../../components/HeartRow';
import { ResultBackgroundWash } from '../../components/ResultBackgroundWash';

const AGE_INPUT_SIZE = 200;
const AGE_SCALE = 116;

const faceOptions: FrameFaceDetectionOptions = {
  performanceMode: 'fast',
  classificationMode: 'all',
  landmarkMode: 'none',
  contourMode: 'none',
  trackingEnabled: false,
};

type Analysis = {
  faceFound: boolean;
  age: number | null;
  smile: number;
  leftEye: number;
  rightEye: number;
};

type Phase = 'standby' | 'countdown' | 'measuring' | 'result';

type CheckResult = {
  photoPath: string;
  analysis: Analysis;
  combinedMessage: string;
};

const MEASURE_DURATION_MS = 2000;
const MEASURE_TARGET_SAMPLES = 8;

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export default function CheckScreen() {
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef<Camera>(null);
  const samplesRef = useRef<Analysis[] | null>(null);

  const [phase, setPhase] = useState<Phase>('standby');
  const captureSessionRef = useRef(0);
  const [countdown, setCountdown] = useState(3);
  const [measureProgress, setMeasureProgress] = useState(0);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [baseline, setBaseline] = useState<BaselineData | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [setupLoaded, setSetupLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      // タブに戻るたびにスタンバイへリセット。進行中の撮影セッションは無効化。
      captureSessionRef.current++;
      setPhase('standby');
      setResult(null);
      setSaved(false);
      Promise.all([loadBaseline(), loadProfile()]).then(([b, p]) => {
        if (active) {
          setBaseline(b);
          setProfile(p);
          setSetupLoaded(true);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const { detectFaces } = useFaceDetector(faceOptions);
  const ageModel = useTensorflowModel(
    require('../../assets/models/age_model.tflite'),
  );
  const model = ageModel.state === 'loaded' ? ageModel.model : undefined;
  const { resize } = useResizePlugin();

  const measuring = useSharedValue(false);

  const deliverSample = useMemo(
    () =>
      Worklets.createRunOnJS((sample: Analysis) => {
        if (samplesRef.current) {
          samplesRef.current.push(sample);
          setMeasureProgress(
            Math.min(1, samplesRef.current.length / MEASURE_TARGET_SAMPLES),
          );
        }
      }),
    [],
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (!measuring.value) return;

      runAtTargetFps(4, () => {
        'worklet';
        const faces = detectFaces(frame);
        if (faces.length === 0) {
          deliverSample({
            faceFound: false,
            age: null,
            smile: 0,
            leftEye: 0,
            rightEye: 0,
          });
          return;
        }

        let top = faces[0];
        for (const f of faces) {
          if ((f.smilingProbability ?? -1) > (top.smilingProbability ?? -1)) {
            top = f;
          }
        }

        let predictedAge: number | null = null;
        if (model != null) {
          const b = top.bounds;
          const x = Math.max(0, Math.floor(b.x));
          const y = Math.max(0, Math.floor(b.y));
          const w = Math.min(frame.width - x, Math.floor(b.width));
          const h = Math.min(frame.height - y, Math.floor(b.height));
          if (w >= 20 && h >= 20) {
            const input = resize(frame, {
              crop: { x, y, width: w, height: h },
              scale: { width: AGE_INPUT_SIZE, height: AGE_INPUT_SIZE },
              pixelFormat: 'rgb',
              dataType: 'float32',
            });
            const output = model.runSync([input]);
            const normalized = output[0]?.[0];
            if (typeof normalized === 'number' && Number.isFinite(normalized)) {
              predictedAge = normalized * AGE_SCALE;
            }
          }
        }

        deliverSample({
          faceFound: true,
          age: predictedAge,
          smile: top.smilingProbability ?? 0,
          leftEye: top.leftEyeOpenProbability ?? 0,
          rightEye: top.rightEyeOpenProbability ?? 0,
        });
      });
    },
    [detectFaces, model, resize, deliverSample, measuring],
  );

  async function handleCapture() {
    if (phase !== 'standby') return;
    if (ageModel.state !== 'loaded') {
      Alert.alert('準備中', '年齢モデルを読み込み中です');
      return;
    }
    if (!cameraRef.current) return;

    const session = ++captureSessionRef.current;
    const isCurrent = () => captureSessionRef.current === session;

    setPhase('countdown');
    for (let n = 3; n >= 1; n--) {
      if (!isCurrent()) return;
      setCountdown(n);
      await wait(800);
    }
    if (!isCurrent()) return;

    setPhase('measuring');
    setMeasureProgress(0);
    samplesRef.current = [];
    measuring.value = true;

    try {
      const [photo] = await Promise.all([
        cameraRef.current.takePhoto({ flash: 'off' }),
        wait(MEASURE_DURATION_MS),
      ]);
      measuring.value = false;
      if (!isCurrent()) {
        samplesRef.current = null;
        return;
      }

      const samples = samplesRef.current ?? [];
      samplesRef.current = null;
      const valid = samples.filter(
        (s): s is Analysis & { age: number } =>
          s.faceFound && s.age != null,
      );

      if (valid.length < 2) {
        Alert.alert(
          '顔を検出できませんでした',
          'もう一度、枠に顔を合わせて撮影してください',
        );
        setPhase('standby');
        return;
      }

      const finalAge = trimmedMedian(valid.map((s) => s.age));
      const finalSmile = trimmedMedian(valid.map((s) => s.smile));
      const finalLeftEye = trimmedMedian(valid.map((s) => s.leftEye));
      const finalRightEye = trimmedMedian(valid.map((s) => s.rightEye));

      const analysis: Analysis = {
        faceFound: true,
        age: finalAge,
        smile: finalSmile,
        leftEye: finalLeftEye,
        rightEye: finalRightEye,
      };

      // 表示・保存用に美肌処理を適用（解析は元画像ベースで完了済み）
      const beautifiedUri = await beautifyPhoto(photo.path, photo.width);

      const faceAge = Math.round(finalAge);
      const actualAge = profile?.actualAge;
      // 実年齢未設定なら youngScore=3（中立）として組み合わせメッセージを抽選
      const ys =
        actualAge != null ? youngScoreFromDiff(actualAge - faceAge) : 3;
      const smile = smileFeedbackFromProb(finalSmile);
      const combinedMessage = getCombinedFeedback(ys, smile.filledHearts);

      setResult({ photoPath: beautifiedUri, analysis, combinedMessage });
      setSaved(false);
      setPhase('result');
    } catch (e) {
      measuring.value = false;
      samplesRef.current = null;
      if (!isCurrent()) return;
      Alert.alert(
        '撮影失敗',
        e instanceof Error ? e.message : '不明なエラーが発生しました',
      );
      setPhase('standby');
    }
  }

  async function handleRetake() {
    captureSessionRef.current++;
    setResult(null);
    setSaved(false);
    setPhase('standby');
  }

  async function performSave() {
    if (!result) return;
    try {
      const smile = smileFeedbackFromProb(result.analysis.smile);
      const entry = await addHistoryEntry(
        {
          faceAge: result.analysis.age!,
          smileProb: result.analysis.smile,
          smileLevel: smile.level,
        },
        result.photoPath,
      );
      setResult(null);
      setPhase('standby');
      setSaved(false);

      // 撮影回数 +1。10回ごとにインタースティシャル広告を試みる（読み込み済みなら表示）。
      const count = await incrementCaptureCount();
      if (shouldShowInterstitial(count)) {
        await maybeShowInterstitial();
      }

      router.push({ pathname: '/history', params: { flash: entry.date } });
    } catch (e) {
      setSaved(false);
      Alert.alert(
        '保存失敗',
        e instanceof Error ? e.message : '不明なエラーが発生しました',
      );
    }
  }

  async function handleSaveHistory() {
    if (!result || saved) return;
    setSaved(true);
    try {
      const todayStr = dateStringFromTimestamp(Date.now());
      const existing = await loadHistory();
      const hasToday = existing.some((e) => e.date === todayStr);
      if (!hasToday) {
        await performSave();
        return;
      }
      // アラート中はボタンを押せるよう解放
      setSaved(false);
      Alert.alert('本日はすでに記録があります', undefined, [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '追加で保存する',
          onPress: () => {
            setSaved(true);
            performSave();
          },
        },
      ]);
    } catch (e) {
      setSaved(false);
      Alert.alert(
        '保存失敗',
        e instanceof Error ? e.message : '不明なエラーが発生しました',
      );
    }
  }

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>カメラの許可が必要です</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>許可する</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>フロントカメラが見つかりません</Text>
      </View>
    );
  }

  if (setupLoaded && !baseline) {
    return (
      <View style={styles.center}>
        <View style={styles.setupCard}>
          <Text style={styles.setupEmoji}>🌸</Text>
          <Text style={styles.setupTitle}>基準の顔とは？</Text>
          <Text style={styles.setupBody}>
            ふだんのリラックスした表情を記録します。
            {'\n'}毎日の撮影と比較することで、笑顔や表情の変化がわかるようになります。
            {'\n'}ノーメイク・自然光・正面で撮るのがおすすめです。
          </Text>
        </View>
        <Link href="/baseline" asChild>
          <TouchableOpacity style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>基準の顔を撮影する</Text>
          </TouchableOpacity>
        </Link>
      </View>
    );
  }

  if (phase === 'result' && result) {
    const faceAge = Math.round(result.analysis.age ?? 0);
    const actualAge = profile?.actualAge ?? null;
    const diff = actualAge != null ? actualAge - faceAge : null;
    const smile = smileFeedbackFromProb(result.analysis.smile);
    // 実年齢未設定なら youngScore=3（中立）
    const youngScore = diff != null ? youngScoreFromDiff(diff) : 3;
    const totalHearts = combinedHeartCount(youngScore, smile.filledHearts);

    const positiveDiff = diff != null && diff > 0;
    const zeroDiff = diff != null && diff === 0;
    const negativeDiff = diff != null && diff < 0;

    return (
      <View style={styles.resultContainer}>
        <ResultBackgroundWash />
        <View style={styles.resultBody}>
          <View style={styles.factBlock}>
            <Text style={styles.factLabel}>きょうの顔年齢は</Text>
            <View style={styles.factAgeRow}>
              <Text style={styles.factAge}>{faceAge}</Text>
              <Text style={styles.factAgeUnit}>歳 です</Text>
            </View>
          </View>

          {positiveDiff && (
            <View style={styles.diffPill}>
              <Text style={styles.diffPillText}>若見え度 +{diff}歳</Text>
            </View>
          )}
          {zeroDiff && (
            <View style={[styles.diffPill, styles.diffPillNeutral]}>
              <Text style={styles.diffPillText}>年齢相応の素敵な表情です</Text>
            </View>
          )}
          {negativeDiff && (
            <View style={[styles.diffPill, styles.diffPillHint]}>
              <Text style={styles.diffPillText}>
                笑顔で撮り直すと変わるかも！
              </Text>
            </View>
          )}

          <HeartRow filled={totalHearts} size={36} gap={6} />

          {result.combinedMessage.length > 0 && (
            <Text style={styles.combinedMessage}>
              {result.combinedMessage}
            </Text>
          )}
        </View>

        <View style={styles.resultActions}>
          <TouchableOpacity
            style={[styles.outlinedBtn, styles.actionBtn]}
            onPress={handleRetake}
          >
            <Text style={styles.outlinedBtnText}>もう一度</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              styles.actionBtn,
              saved && styles.btnDisabled,
            ]}
            onPress={handleSaveHistory}
            disabled={saved}
          >
            <Text style={styles.primaryBtnText}>
              {saved ? '保存中...' : '保存する'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const modelLoading = ageModel.state === 'loading';
  const modelError = ageModel.state === 'error' ? ageModel.error.message : null;
  const canCapture =
    phase === 'standby' && !modelLoading && modelError == null;

  return (
    <View style={styles.container}>
      {/* Camera は常時マウント。isActive で制御して cameraRef を保つ */}
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={phase === 'countdown' || phase === 'measuring'}
        photo={true}
        frameProcessor={frameProcessor}
        pixelFormat="yuv"
      />

      {(phase === 'countdown' || phase === 'measuring') && (
        <>
          <View pointerEvents="none" style={styles.softFocus} />
          <View pointerEvents="none" style={styles.guideContainer}>
            <View style={styles.guideOval} />
          </View>
        </>
      )}

      {phase === 'countdown' && (
        <View pointerEvents="none" style={styles.countdownOverlay}>
          <Text style={styles.countdownHint}>笑顔を作ってください！</Text>
          <Text style={styles.countdownNumber}>{countdown}</Text>
        </View>
      )}

      {phase === 'measuring' && (
        <View pointerEvents="none" style={styles.countdownOverlay}>
          <Text style={styles.countdownHint}>測定中・表情はそのままで</Text>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.round(measureProgress * 100)}%` },
              ]}
            />
          </View>
        </View>
      )}

      {phase === 'standby' && (
        <View style={styles.standbyOverlay}>
          <View style={styles.standbyCard}>
            <View style={styles.standbyMark}>
              <BrandMark size={88} />
            </View>
            <Text style={styles.standbyTitle}>
              きょうの顔年齢、何歳かな？
            </Text>
            <Text style={styles.standbySub}>撮影して確認しましょう</Text>
          </View>
          {modelLoading && (
            <Text style={styles.status}>年齢モデルを読み込み中...</Text>
          )}
          {modelError && (
            <Text style={styles.status}>モデル読込エラー: {modelError}</Text>
          )}
          <TouchableOpacity
            style={[styles.primaryBtn, !canCapture && styles.btnDisabled]}
            onPress={handleCapture}
            disabled={!canCapture}
          >
            <Text style={styles.primaryBtnText}>撮影する</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgMain },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.bgMain,
  },

  // 撮影スタンバイ
  standbyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bgMain,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  standbyCard: {
    backgroundColor: colors.primaryLightest,
    borderRadius: radius.xl,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    marginBottom: 36,
    borderWidth: 1,
    borderColor: colors.primaryLighter,
  },
  standbyMark: { marginBottom: 22 },
  standbyTitle: {
    color: colors.textDark,
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 6,
  },
  standbySub: {
    color: colors.textMid,
    fontSize: 13,
    textAlign: 'center',
  },

  // セットアップ未完了画面
  setupCard: {
    backgroundColor: colors.primaryLightest,
    borderRadius: radius.xl,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.primaryLighter,
  },
  setupEmoji: { fontSize: 40, marginBottom: 12 },
  setupTitle: {
    color: colors.textDark,
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 8,
  },
  setupSub: {
    color: colors.textMid,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  setupBody: {
    color: colors.textDark,
    fontSize: 13,
    textAlign: 'left',
    lineHeight: 22,
  },

  // ボタン (ベース高さ ~48px / フォント 16)
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
  outlinedBtn: {
    borderWidth: 1.5,
    borderColor: colors.buttonBorder,
    backgroundColor: colors.white,
    paddingHorizontal: 24,
    paddingVertical: 14,
    minHeight: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlinedBtnText: {
    color: colors.primaryDeep,
    fontSize: 16,
    fontWeight: '500',
  },
  btnDisabled: { opacity: 0.5 },
  actionBtn: {
    flex: 1,
    minWidth: 140,
  },

  // カウントダウン / 撮影中
  softFocus: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  guideContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideOval: {
    width: 260,
    height: 340,
    borderRadius: 170,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  countdownHint: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 16,
  },
  countdownNumber: {
    color: colors.white,
    fontSize: 88,
    fontWeight: '500',
  },
  progressBarBg: {
    width: 220,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
    marginTop: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  status: {
    color: colors.textLight,
    fontSize: 13,
    backgroundColor: colors.primaryLightest,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    marginBottom: 12,
  },

  // 結果画面（白背景・写真は表示しない）
  resultContainer: {
    flex: 1,
    backgroundColor: colors.bgMain,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 32,
  },
  resultBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  factBlock: { alignItems: 'center' },
  factLabel: { color: colors.textMid, fontSize: 14, fontWeight: '400' },
  factAgeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  factAge: {
    color: colors.primary,
    fontSize: 56,
    fontWeight: '500',
    lineHeight: 60,
  },
  factAgeUnit: {
    color: colors.textDark,
    fontSize: 18,
    fontWeight: '400',
    marginLeft: 6,
    marginBottom: 10,
  },
  diffPill: {
    backgroundColor: colors.primaryLighter,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: radius.pill,
    alignSelf: 'center',
  },
  diffPillNeutral: { backgroundColor: colors.primaryLightest },
  diffPillHint: { backgroundColor: colors.accent },
  diffPillText: {
    color: colors.primaryDeep,
    fontSize: 16,
    fontWeight: '500',
  },
  combinedMessage: {
    color: colors.textDark,
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  msg: {
    color: colors.textDark,
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  disclaimer: {
    color: colors.textMid,
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginTop: 4,
  },
});
