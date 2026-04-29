export type PartsInput = {
  smile?: number;
  leftEye?: number;
  rightEye?: number;
  yawAngle?: number;
};

export type PartsBaseline = {
  smile?: number;
  leftEye?: number;
  rightEye?: number;
};

export type PartItem = {
  key: string;
  label: string;
  comment: string;
  comparison?: string;
};

function eyeComment(avg: number): string {
  if (avg > 0.85) return 'パッチリと開いた目元、生き生きとした印象です';
  if (avg > 0.65) return '自然で穏やかな目元です';
  if (avg > 0.4) return '優しく落ち着いた目元の印象です';
  return '伏し目がちで物静かな雰囲気です';
}

function mouthComment(smile: number): string {
  if (smile > 0.7) return '満面の素敵な笑顔！口角がしっかり上がっています';
  if (smile > 0.4) return '柔らかい微笑みが感じられます';
  if (smile > 0.2) return '控えめな表情で大人っぽい印象です';
  return '凛とした落ち着いた表情です';
}

function balanceComment(diff: number): string {
  if (diff < 0.05) return '左右がきれいに整った美しいバランスです';
  if (diff < 0.15) return '自然なバランスの取れた表情です';
  return '個性的でチャーミングな表情の動きがあります';
}

function angleComment(abs: number): string {
  if (abs < 5) return 'まっすぐカメラを見ていてとても自然です';
  if (abs < 15) return '少し角度がついてニュアンスのある表情です';
  return '横顔気味で雰囲気のある一枚です';
}

export function analyzePartsFromData(
  data: PartsInput,
  baseline?: PartsBaseline | null,
): PartItem[] {
  const items: PartItem[] = [];

  if (data.leftEye != null && data.rightEye != null) {
    const avg = (data.leftEye + data.rightEye) / 2;
    let comparison: string | undefined;
    if (baseline?.leftEye != null && baseline?.rightEye != null) {
      const bAvg = (baseline.leftEye + baseline.rightEye) / 2;
      const d = avg - bAvg;
      if (d > 0.1) comparison = 'いつもよりぱっちりした目元です';
      else if (d < -0.1) comparison = 'いつもより少し落ち着いた目元です';
      else comparison = 'いつもどおりの目元バランスです';
    }
    items.push({
      key: 'eyes',
      label: '目元',
      comment: eyeComment(avg),
      comparison,
    });
  }

  if (data.smile != null) {
    let comparison: string | undefined;
    if (baseline?.smile != null) {
      const d = data.smile - baseline.smile;
      if (d > 0.1) comparison = 'いつもより笑顔の度合いが高めです';
      else if (d < -0.1) comparison = 'いつもよりリラックスした表情です';
      else comparison = 'いつもどおりの口元です';
    }
    items.push({
      key: 'mouth',
      label: '口元',
      comment: mouthComment(data.smile),
      comparison,
    });
  }

  if (data.leftEye != null && data.rightEye != null) {
    const diff = Math.abs(data.leftEye - data.rightEye);
    items.push({
      key: 'balance',
      label: '表情バランス',
      comment: balanceComment(diff),
    });
  }

  if (data.yawAngle != null) {
    items.push({
      key: 'angle',
      label: '顔の角度',
      comment: angleComment(Math.abs(data.yawAngle)),
    });
  }

  return items;
}
