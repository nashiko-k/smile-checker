import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  Camera,
  runAtTargetFps,
  useCameraDevice,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useCameraPermissionStatus } from '../lib/cameraPermission';
import { CameraPermissionDenied } from '../components/CameraPermissionDenied';
import {
  useFaceDetector,
  type FrameFaceDetectionOptions,
} from 'react-native-vision-camera-face-detector';
import { Worklets, useSharedValue } from 'react-native-worklets-core';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { saveBaseline } from '../lib/baseline';
import { trimmedMedian } from '../lib/measure';
import { beautifyPhoto } from '../lib/beautify';
import { colors, radius } from '../lib/theme';

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

type Phase = 'intro' | 'idle' | 'countdown' | 'measuring' | 'result';

type CaptureResult = {
  photoPath: string;
  analysis: Analysis;
};

const MEASURE_DURATION_MS = 1250;
const MEASURE_TARGET_SAMPLES = 5;

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export default function BaselineScreen() {
  const device = useCameraDevice('front');
  const { status: permissionStatus, request: requestPermission } =
    useCameraPermissionStatus();
  const hasPermission = permissionStatus === 'granted';
  const cameraRef = useRef<Camera>(null);
  const samplesRef = useRef<Analysis[] | null>(null);

  const [phase, setPhase] = useState<Phase>('intro');
  const [countdown, setCountdown] = useState(3);
  const [measureProgress, setMeasureProgress] = useState(0);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (permissionStatus === 'not-determined') {
      requestPermission();
    }
  }, [permissionStatus, requestPermission]);

  const { detectFaces } = useFaceDetector(faceOptions);
  const ageModel = useTensorflowModel(
    require('../assets/models/age_model.tflite'),
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
    if (phase !== 'idle') return;
    if (ageModel.state !== 'loaded') {
      Alert.alert('準備中', '年齢モデルを読み込み中です');
      return;
    }
    if (!cameraRef.current) return;

    setPhase('countdown');
    for (let n = 3; n >= 1; n--) {
      setCountdown(n);
      await wait(800);
    }
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
      const samples = samplesRef.current ?? [];
      samplesRef.current = null;
      const valid = samples.filter(
        (s): s is Analysis & { age: number } => s.faceFound && s.age != null,
      );

      if (valid.length < 2) {
        Alert.alert(
          '顔を検出できませんでした',
          'もう一度、枠に顔を合わせて撮影してください',
        );
        setPhase('idle');
        return;
      }

      const analysis: Analysis = {
        faceFound: true,
        age: trimmedMedian(valid.map((s) => s.age)),
        smile: trimmedMedian(valid.map((s) => s.smile)),
        leftEye: trimmedMedian(valid.map((s) => s.leftEye)),
        rightEye: trimmedMedian(valid.map((s) => s.rightEye)),
      };

      // 表示・保存用に美肌処理（解析は元画像ベースで完了済み）
      const beautifiedUri = await beautifyPhoto(photo.path, photo.width);

      setResult({ photoPath: beautifiedUri, analysis });
      setPhase('result');
    } catch (e) {
      measuring.value = false;
      samplesRef.current = null;
      Alert.alert(
        '撮影失敗',
        e instanceof Error ? e.message : '不明なエラーが発生しました',
      );
      setPhase('idle');
    }
  }

  async function handleRetake() {
    setResult(null);
    setPhase('idle');
  }

  async function handleSave() {
    if (!result || saving) return;
    try {
      setSaving(true);
      await saveBaseline(
        {
          age: result.analysis.age!,
          smilingProb: result.analysis.smile,
          leftEyeOpen: result.analysis.leftEye,
          rightEyeOpen: result.analysis.rightEye,
        },
        result.photoPath,
      );
      Alert.alert('完了', '基準の顔を保存しました', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert(
        '保存失敗',
        e instanceof Error ? e.message : '不明なエラーが発生しました',
      );
    } finally {
      setSaving(false);
    }
  }

  if (permissionStatus === 'denied' || permissionStatus === 'restricted') {
    return <CameraPermissionDenied />;
  }
  if (!hasPermission) {
    return <View style={styles.center} />;
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>フロントカメラが見つかりません</Text>
      </View>
    );
  }

  if (phase === 'result' && result) {
    const age = result.analysis.age ?? 0;
    return (
      <View style={styles.resultContainer}>
        <Image
          source={{ uri: `file://${result.photoPath}` }}
          style={styles.resultImage}
          resizeMode="cover"
        />
        <View style={styles.resultWash} pointerEvents="none" />
        <View style={styles.resultContent}>
          <Text style={styles.resultTitle}>この顔を基準の顔にしますか？</Text>
          <View style={styles.resultRow}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>推定年齢</Text>
              <Text style={styles.metricValue}>{Math.round(age)}歳</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>笑顔度</Text>
              <Text style={styles.metricValue}>
                {(result.analysis.smile * 100).toFixed(0)}%
              </Text>
            </View>
          </View>
          <View style={styles.resultActions}>
            <TouchableOpacity
              style={[styles.outlinedBtn, styles.flex1]}
              onPress={handleRetake}
              disabled={saving}
            >
              <Text style={styles.outlinedBtnText}>撮り直す</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, styles.flex1]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryBtnText}>保存する</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const modelLoading = ageModel.state === 'loading';
  const modelError = ageModel.state === 'error' ? ageModel.error.message : null;
  const canCapture = phase === 'idle' && !modelLoading && modelError == null;

  if (phase === 'intro') {
    return (
      <View style={styles.introContainer}>
        <Text style={styles.introTitle}>基準となる顔を撮影しましょう</Text>
        <View style={styles.introCard}>
          <Text style={styles.introCardTitle}>基準の顔とは？</Text>
          <Text style={styles.introCardBody}>
            ふだんのリラックスした表情を記録します。
            毎日の撮影と比較することで、笑顔や表情の変化がわかるようになります。
          </Text>
          <Text style={styles.introTipsTitle}>撮影のコツ</Text>
          <Text style={styles.introTipsLine}>・リラックスした自然な表情で</Text>
          <Text style={styles.introTipsLine}>・できればノーメイクで</Text>
          <Text style={styles.introTipsLine}>
            ・毎回同じ場所・同じ明るさで撮ると比較しやすくなります
          </Text>
        </View>
        {modelLoading && (
          <Text style={styles.status}>年齢モデルを読み込み中...</Text>
        )}
        {modelError && (
          <Text style={styles.status}>モデル読込エラー: {modelError}</Text>
        )}
        <TouchableOpacity
          style={[styles.primaryBtn, modelLoading && styles.btnDisabled]}
          onPress={() => setPhase('idle')}
          disabled={modelLoading || modelError != null}
        >
          <Text style={styles.primaryBtnText}>撮影に進む</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={phase !== 'result'}
        photo={true}
        frameProcessor={frameProcessor}
        pixelFormat="yuv"
      />
      <View pointerEvents="none" style={styles.softFocus} />

      <View pointerEvents="none" style={styles.guideContainer}>
        <View style={styles.guideOval} />
      </View>

      {phase === 'countdown' && (
        <View pointerEvents="none" style={styles.countdownOverlay}>
          <Text style={styles.countdownHint}>
            リラックスした表情でお願いします
          </Text>
          <Text style={styles.countdownNumber}>{countdown}</Text>
        </View>
      )}

      {phase === 'measuring' && (
        <View pointerEvents="none" style={styles.countdownOverlay}>
          <Text style={styles.countdownHint}>
            測定中・リラックスした表情のままで
          </Text>
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

      {phase === 'idle' && (
        <View style={styles.shutterArea}>
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
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.bgMain,
  },
  introContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.bgMain,
  },
  introTitle: {
    color: colors.primaryDeep,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  introCard: {
    backgroundColor: colors.primaryLightest,
    borderRadius: radius.xl,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: colors.primaryLighter,
    width: '100%',
    maxWidth: 360,
    marginBottom: 24,
  },
  introCardTitle: {
    color: colors.primaryDeep,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  introCardBody: {
    color: colors.textDark,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  introTipsTitle: {
    color: colors.primaryDeep,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  introTipsLine: {
    color: colors.textDark,
    fontSize: 13,
    lineHeight: 20,
  },
  shutterArea: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
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
    borderColor: 'rgba(255,255,255,0.9)',
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
    color: colors.primaryDeep,
    fontSize: 13,
    backgroundColor: colors.primaryLightest,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },

  // 結果画面
  resultContainer: { flex: 1, backgroundColor: colors.bgMain },
  resultImage: { ...StyleSheet.absoluteFillObject },
  resultWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  resultContent: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 48,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultTitle: {
    color: colors.textDark,
    fontSize: 20,
    fontWeight: '500',
    textAlign: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 12,
  },
  metric: { alignItems: 'center' },
  metricLabel: { color: colors.textMid, fontSize: 13 },
  metricValue: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: '600',
    marginTop: 4,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
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
  flex1: { flex: 1, minWidth: 140 },

  msg: {
    color: colors.textDark,
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
});
