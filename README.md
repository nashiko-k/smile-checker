# 笑顔チェッカー / 外見年齢チェッカー (smile-checker)

Expo + TypeScript + expo-router。
顔検出は `react-native-vision-camera` + `react-native-vision-camera-face-detector`、
年齢推定は `react-native-fast-tflite` で端末内 TensorFlow Lite 推論。

## 前提

- Node.js 20+
- Xcode / Android Studio（dev client ビルド用）
- **Expo Go では動きません**。VisionCamera のフレームプロセッサ + ML Kit + TFLite ネイティブモジュールが必要なため、dev client を使います。

## セットアップ

```bash
npm install
npx expo prebuild --clean       # iOS/Android ネイティブを再生成（plugin 追加後は必須）
npm run ios                     # 実機 / シミュレータ
# または
npm run android
```

起動後、フロントカメラ映像の上に「推定年齢: ○○歳」「笑顔度: ○○%」が並んで表示されます。

## 年齢推定モデル

- ファイル: `assets/models/age_model.tflite`
- 出典: [shubham0204/Age-Gender_Estimation_TF-Android](https://github.com/shubham0204/Age-Gender_Estimation_TF-Android) の
  `app/src/main/assets/model_age_nonq.tflite`（UTKFace で学習済み、非量子化版）
- 入力: `1 × 200 × 200 × 3` RGB float32 (0.0–1.0)
- 出力: `1 × 1` float32、0–1 の正規化年齢。`× 116` で推定年齢 (歳)
- MAE 約 2.4 歳（学習元リポジトリの報告値）

推論は端末内で完結しており、カメラ画像はネットワーク送信されません。

## 技術選定メモ

- `expo-face-detector` は廃止されているため不採用。
- `expo-camera` はフレーム単位の smilingProbability 取得手段が弱いため不採用。
- `react-native-vision-camera` v4 + `react-native-vision-camera-face-detector`（ML Kit ラッパ）を採用。
- TFLite 推論は `react-native-fast-tflite@1.6.1`（JSI ベース、ワークレット内 `runSync` 可）を採用。
- フレーム→200×200 RGB Float32 変換は `vision-camera-resize-plugin`。ML Kit で取得した顔 bounds を `crop` に渡し、顔領域だけ切り出してからリサイズ。
- 推論は `runAtTargetFps(3)` で間引き。フレーム処理自体は通常 FPS、年齢推論だけ秒数回。
- Bundle ID / package: `com.nashiko.smilechecker`
- minSdkVersion 26（VisionCamera 要件）

## トラブルシュート

- **`Cannot find vision-camera-resize-plugin!`**: ネイティブリンクが効いていません。`npx expo prebuild --clean && npm run ios`（or `android`）で再ビルドしてください。
- **年齢が 0 または固定値**: 顔検出が走っていない / bounds が極端に小さい可能性があります。画面上に「検出した顔: 1」と出ているか確認。
- **アプリ起動時に `.tflite` が読めない**: `metro.config.js` に `tflite` が `assetExts` に含まれていること、`assets/models/age_model.tflite` が存在することを確認。
