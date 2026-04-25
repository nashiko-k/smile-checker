export type SmileFeedback = {
  level: number;
  filledHearts: number;
  hearts: string;
  message: string;
  sparkle: boolean;
};

export function smileFeedbackFromProb(prob: number): SmileFeedback {
  const clamped = Math.max(0, Math.min(1, prob));
  const level = Math.min(10, Math.floor(clamped * 10) + 1);

  let filledHearts: number;
  let message: string;
  if (level >= 10) {
    filledHearts = 5;
    message = '最高の笑顔です！';
  } else if (level >= 8) {
    filledHearts = 4;
    message = 'いい笑顔です！';
  } else if (level >= 6) {
    filledHearts = 3;
    message = '素敵な表情です';
  } else if (level >= 4) {
    filledHearts = 2;
    message = 'リラックスモードですね';
  } else {
    filledHearts = 1;
    message = 'ゆっくり深呼吸して、もう一枚いかがですか？';
  }

  const hearts = '❤️'.repeat(filledHearts) + '🤍'.repeat(5 - filledHearts);

  return { level, filledHearts, hearts, message, sparkle: level >= 10 };
}

// 若見え度を1〜5の整数にする。5が最も若見え、1は実年齢より上。
export function youngScoreFromDiff(diff: number): number {
  if (diff >= 7) return 5;
  if (diff >= 4) return 4;
  if (diff >= 1) return 3;
  if (diff === 0) return 2;
  return 1;
}

// 若見え度(1-5) と 笑顔ハート数(1-5) の平均を四捨五入し 1-5 に丸める。
export function combinedHeartCount(
  youngScore: number,
  smileHearts: number,
): number {
  const avg = (youngScore + smileHearts) / 2;
  return Math.min(5, Math.max(1, Math.round(avg)));
}

export function heartsString(filled: number): string {
  const f = Math.min(5, Math.max(0, filled));
  return '❤️'.repeat(f) + '🤍'.repeat(5 - f);
}

// 若見え度(1-5) × 笑顔度(1-5, filledHearts) の組み合わせメッセージ。
// すべてポジティブなトーン。あとから配列に追加するだけで増やせる。
const COMBINED_MESSAGES: Record<string, string[]> = {
  '5_5': [
    '驚きの若見え＆最高の笑顔！無敵です！',
    'パーフェクト！今日のあなたは輝いてます！',
    '若々しさも笑顔も100点満点！',
  ],
  '5_4': [
    '若々しさといい笑顔のダブルコンボ！',
    '溢れる若さとステキな笑顔が素晴らしい！',
  ],
  '5_3': [
    '年齢を感じさせない爽やかな表情です',
    'フレッシュで心地よい雰囲気があります',
  ],
  '5_2': [
    '若々しくリラックスした大人の余裕',
    '落ち着いた若さが魅力的です',
  ],
  '5_1': [
    '若々しさが際立っています。あとは深呼吸をひとつ',
    'フレッシュな印象です。もう一枚いってみますか？',
  ],
  '4_5': [
    '若々しくて最高の笑顔、まぶしい！',
    '弾けるような若さと笑顔が素敵です！',
  ],
  '4_4': [
    '若々しくていい笑顔、とてもステキです！',
    'とても魅力的な表情です！',
  ],
  '4_3': [
    '若さが見える穏やかな良い表情です',
    '爽やかで感じのいい雰囲気ですね',
  ],
  '4_2': [
    '若々しく落ち着いた印象です',
    'ナチュラルで若さがにじむ表情',
  ],
  '4_1': [
    '若々しい印象。ゆっくり一息ついて次の一枚へ',
    'フレッシュさが伝わります。もう一度いかがですか？',
  ],
  '3_5': [
    'ちょっと若見え＆最高の笑顔がまぶしい！',
    '若さ漂う素晴らしい笑顔です！',
  ],
  '3_4': [
    '若々しさといい笑顔、いい組み合わせ！',
    '明るく元気な印象の一枚です',
  ],
  '3_3': [
    'バランスの取れた爽やかな表情です',
    '自然体で感じのいい雰囲気',
  ],
  '3_2': [
    '落ち着いた若々しさが見えます',
    'ナチュラルで心地よい表情',
  ],
  '3_1': [
    '若々しさが感じられます。深呼吸してもう一枚？',
    '穏やかな印象です。もう一度いきましょう',
  ],
  '2_5': [
    '年齢相応の最高の笑顔、説得力があります！',
    '素敵な笑顔が輝いています！',
  ],
  '2_4': [
    '年齢にふさわしいいい笑顔です！',
    '大人の魅力ある笑顔ですね',
  ],
  '2_3': [
    '年齢相応の落ち着いた素敵な表情',
    '大人の雰囲気が魅力的です',
  ],
  '2_2': [
    '自然体で年齢相応の穏やかな表情',
    '落ち着いた大人の雰囲気です',
  ],
  '2_1': [
    '年齢相応の落ち着いた一枚。深呼吸してもう一度？',
    '穏やかな表情です。もう一枚いかがでしょう',
  ],
  '1_5': [
    '深みのある表情と最高の笑顔の組み合わせ！',
    '人生経験が光る素敵な笑顔です！',
  ],
  '1_4': [
    '味のある表情といい笑顔、魅力的です！',
    '経験が感じられるいい表情ですね',
  ],
  '1_3': [
    '大人の深みがある落ち着いた表情です',
    '味わい深い雰囲気が出ています',
  ],
  '1_2': [
    '落ち着いた大人の魅力があります',
    '深みのある自然な表情です',
  ],
  '1_1': [
    '味わい深い表情です。笑顔でもう一枚撮ってみませんか？',
    '落ち着いた雰囲気。笑顔の一枚もぜひ！',
  ],
};

export function getCombinedFeedback(
  youngScore: number,
  smileLevel: number,
): string {
  const key = `${youngScore}_${smileLevel}`;
  const messages = COMBINED_MESSAGES[key];
  if (!messages || messages.length === 0) return '';
  const idx = Math.floor(Math.random() * messages.length);
  return messages[idx] ?? '';
}
