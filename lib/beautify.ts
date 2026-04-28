import * as FileSystem from 'expo-file-system';
import {
  ClipOp,
  ImageFormat,
  Skia,
  TileMode,
} from '@shopify/react-native-skia';

/**
 * 美肌処理パイプライン (Skia)
 * - 背景: 強めのガウシアンブラー
 * - 顔（中央楕円で近似）: 軽いガウシアンブラー
 * - 全体: 明るさ +α、彩度 ×1.05 のカラーマトリクス
 *
 * ML Kit の輪郭情報を取らない構成のため、顔領域は中央上寄り楕円で近似する。
 * （撮影時にユーザーが楕円ガイドに顔を合わせるため精度はほぼ実用範囲）。
 */
export async function beautifyPhoto(
  sourceUri: string,
  originalWidth: number | undefined,
): Promise<string> {
  if (!originalWidth || originalWidth < 200) return sourceUri;
  const src = sourceUri.startsWith('file://')
    ? sourceUri
    : `file://${sourceUri}`;

  try {
    const data = await Skia.Data.fromURI(src);
    if (!data) return sourceUri;
    const image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) return sourceUri;

    const w = image.width();
    const h = image.height();

    const surface = Skia.Surface.MakeOffscreen(w, h);
    if (!surface) return sourceUri;
    const canvas = surface.getCanvas();

    // 明るさ +0.065 / 彩度 1.055 のカラーマトリクス（4x5）
    const sat = 1.055;
    const brightness = 0.065;
    const lr = 0.2126,
      lg = 0.7152,
      lb = 0.0722;
    const m: number[] = [
      sat + (1 - sat) * lr,
      (1 - sat) * lg,
      (1 - sat) * lb,
      0,
      brightness,
      (1 - sat) * lr,
      sat + (1 - sat) * lg,
      (1 - sat) * lb,
      0,
      brightness,
      (1 - sat) * lr,
      (1 - sat) * lg,
      sat + (1 - sat) * lb,
      0,
      brightness,
      0,
      0,
      0,
      1,
      0,
    ];
    const colorFilter = Skia.ColorFilter.MakeMatrix(m);

    // 1. 背景：強めブラー + カラー補正で全面描画
    const bgBlur = Skia.ImageFilter.MakeBlur(10, 10, TileMode.Decal, null);
    const bgFilter = Skia.ImageFilter.MakeColorFilter(colorFilter, bgBlur);
    const bgPaint = Skia.Paint();
    bgPaint.setImageFilter(bgFilter);
    canvas.drawImage(image, 0, 0, bgPaint);

    // 2. 顔領域：中央楕円でクリップして軽いブラー + カラー補正で再描画
    const cx = w / 2;
    const cy = h * 0.45;
    const rx = w * 0.36;
    const ry = h * 0.44;
    const ellipsePath = Skia.Path.Make();
    ellipsePath.addOval({
      x: cx - rx,
      y: cy - ry,
      width: rx * 2,
      height: ry * 2,
    });

    canvas.save();
    canvas.clipPath(ellipsePath, ClipOp.Intersect, true);

    const skinBlur = Skia.ImageFilter.MakeBlur(4, 4, TileMode.Decal, null);
    const skinFilter = Skia.ImageFilter.MakeColorFilter(colorFilter, skinBlur);
    const skinPaint = Skia.Paint();
    skinPaint.setImageFilter(skinFilter);
    canvas.drawImage(image, 0, 0, skinPaint);
    canvas.restore();

    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    const base64 = snapshot.encodeToBase64(ImageFormat.JPEG, 90);

    const dest = `${FileSystem.cacheDirectory ?? ''}beautified_${Date.now()}.jpg`;
    await FileSystem.writeAsStringAsync(dest, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return dest;
  } catch {
    return sourceUri;
  }
}
