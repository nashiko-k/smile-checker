#!/usr/bin/env node
// App Store 用スクリーンショット (iPhone 6.5" / 1284x2778) を 4 枚生成する。
// 各画像は 「ピンクグラデ背景 + キャッチコピー + アプリ風モック」 の構成。
// 出力: assets/screenshots/01-standby.png 〜 04-calendar.png
//
// 使い方:
//   npm install --no-save sharp
//   node scripts/generate-screenshots.mjs

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error(
    "sharp が見つかりません。まず `npm install --no-save sharp` を実行してください。",
  );
  process.exit(1);
}
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const outDir = resolve(projectRoot, 'assets/screenshots');
mkdirSync(outDir, { recursive: true });

// ─────────────────────────────────────────────
// 共通定数
// ─────────────────────────────────────────────
const W = 1284;
const H = 2778;
const PINK_TOP = '#FFE0E8';
const PINK_BOT = '#FF85A2';
const PINK = '#FF85A2';
const PINK_DEEP = '#C95C7A';
const PINK_LIGHTEST = '#FFF4F7';
const PINK_LIGHTER = '#FFD4DF';
const TEXT_DARK = '#3D2B33';
const TEXT_MID = '#8A7079';
const WHITE = '#FFFFFF';
const ACCENT = '#FFF1F5';

const FONT =
  "'Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic',Helvetica,Arial,sans-serif";

// ─────────────────────────────────────────────
// SVG 部品
// ─────────────────────────────────────────────
function bg() {
  return `
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${PINK_TOP}"/>
        <stop offset="100%" stop-color="${PINK_BOT}"/>
      </linearGradient>
      <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="14" stdDeviation="22" flood-color="#000" flood-opacity="0.18"/>
      </filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
  `;
}

function caption(line1, line2 = '') {
  const y1 = 280;
  const y2 = y1 + 130;
  return `
    <text x="${W / 2}" y="${y1}" text-anchor="middle"
          font-family="${FONT}" font-size="100" font-weight="800" fill="${WHITE}"
          style="paint-order:stroke;stroke:rgba(0,0,0,0.12);stroke-width:3px;">
      ${line1}
    </text>
    ${
      line2
        ? `<text x="${W / 2}" y="${y2}" text-anchor="middle"
              font-family="${FONT}" font-size="64" font-weight="600" fill="${WHITE}"
              style="paint-order:stroke;stroke:rgba(0,0,0,0.10);stroke-width:2px;">
          ${line2}
        </text>`
        : ''
    }
  `;
}

function card(x, y, w, h, fill = WHITE, radius = 56) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="${fill}" filter="url(#cardShadow)"/>`;
}

function brandMark(cx, cy, size) {
  // BrandMark 風: ピンク丸 + 中に笑顔顔
  const r = size / 2;
  const eyeY = cy - r * 0.15;
  const eyeOff = r * 0.32;
  const eyeR = r * 0.08;
  const mouthR = r * 0.4;
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${PINK}"/>
    <circle cx="${cx - eyeOff}" cy="${eyeY}" r="${eyeR}" fill="${WHITE}"/>
    <circle cx="${cx + eyeOff}" cy="${eyeY}" r="${eyeR}" fill="${WHITE}"/>
    <path d="M ${cx - mouthR} ${cy + r * 0.05} Q ${cx} ${cy + r * 0.55}, ${cx + mouthR} ${cy + r * 0.05}"
          stroke="${WHITE}" stroke-width="${r * 0.13}" stroke-linecap="round" fill="none"/>
  `;
}

function hearts(cx, cy, filled, total = 5, size = 60, gap = 14) {
  const totalW = total * size + (total - 1) * gap;
  const startX = cx - totalW / 2;
  let s = '';
  for (let i = 0; i < total; i++) {
    const x = startX + i * (size + gap) + size / 2;
    const fill = i < filled ? PINK : '#F4D7DF';
    s += heart(x, cy, size, fill);
  }
  return s;
}

function heart(cx, cy, size, fill) {
  const s = size / 32;
  // 32x32 ベースのハートパス
  const path = `M16,28 C16,28 4,20 4,12 C4,7 8,4 12,4 C14,4 15,5 16,7 C17,5 18,4 20,4 C24,4 28,7 28,12 C28,20 16,28 16,28 Z`;
  return `<g transform="translate(${cx - size / 2},${cy - size / 2}) scale(${s})"><path d="${path}" fill="${fill}"/></g>`;
}

function pill(cx, cy, w, h, fill, text, textColor = WHITE, fontSize = 44) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" ry="${h / 2}" fill="${fill}"/>
    <text x="${cx}" y="${cy + fontSize * 0.36}" text-anchor="middle"
          font-family="${FONT}" font-size="${fontSize}" font-weight="700" fill="${textColor}">${text}</text>
  `;
}

// ─────────────────────────────────────────────
// 画像1: スタンバイ
// ─────────────────────────────────────────────
function screen1() {
  const cardX = 110;
  const cardY = 740;
  const cardW = W - cardX * 2;
  const cardH = 1500;
  const cx = W / 2;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${bg()}
  ${caption('あなたの顔、', '何歳に見える？')}
  ${card(cardX, cardY, cardW, cardH, WHITE)}
  ${card(cardX + 70, cardY + 110, cardW - 140, 760, PINK_LIGHTEST, 48)}
  ${brandMark(cx, cardY + 380, 280)}
  <text x="${cx}" y="${cardY + 660}" text-anchor="middle" font-family="${FONT}" font-size="58" font-weight="700" fill="${TEXT_DARK}">きょうの顔年齢、</text>
  <text x="${cx}" y="${cardY + 740}" text-anchor="middle" font-family="${FONT}" font-size="58" font-weight="700" fill="${TEXT_DARK}">何歳かな？</text>
  <text x="${cx}" y="${cardY + 820}" text-anchor="middle" font-family="${FONT}" font-size="40" font-weight="500" fill="${TEXT_MID}">撮影して確認しましょう</text>

  ${pill(cx, cardY + 1180, 540, 130, PINK, '撮影する')}
</svg>`;
}

// ─────────────────────────────────────────────
// 画像2: 結果
// ─────────────────────────────────────────────
function screen2() {
  const cardX = 110;
  const cardY = 700;
  const cardW = W - cardX * 2;
  const cardH = 1700;
  const cx = W / 2;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${bg()}
  ${caption('AIが顔年齢を判定')}
  ${card(cardX, cardY, cardW, cardH, WHITE)}

  <text x="${cx}" y="${cardY + 220}" text-anchor="middle" font-family="${FONT}" font-size="58" font-weight="500" fill="${TEXT_MID}">きょうの顔年齢は</text>
  <text x="${cx - 90}" y="${cardY + 460}" text-anchor="middle" font-family="${FONT}" font-size="280" font-weight="700" fill="${PINK}">28</text>
  <text x="${cx + 170}" y="${cardY + 460}" text-anchor="start" font-family="${FONT}" font-size="80" font-weight="500" fill="${TEXT_DARK}">歳 です</text>

  ${pill(cx, cardY + 660, 560, 120, PINK_LIGHTER, '若見え度 +5歳', PINK_DEEP, 50)}

  ${hearts(cx, cardY + 880, 4, 5, 90, 22)}

  <text x="${cx}" y="${cardY + 1140}" text-anchor="middle" font-family="${FONT}" font-size="48" font-weight="500" fill="${TEXT_DARK}">若々しくていい笑顔、</text>
  <text x="${cx}" y="${cardY + 1210}" text-anchor="middle" font-family="${FONT}" font-size="48" font-weight="500" fill="${TEXT_DARK}">とてもステキです！</text>

  <g>
    ${pill(cx - 250, cardY + 1480, 400, 120, WHITE, 'もう一度', PINK_DEEP, 44)}
    <rect x="${cx - 450}" y="${cardY + 1420}" width="400" height="120" rx="60" ry="60" fill="${WHITE}" stroke="${PINK_LIGHTER}" stroke-width="3"/>
    <text x="${cx - 250}" y="${cardY + 1496}" text-anchor="middle" font-family="${FONT}" font-size="44" font-weight="700" fill="${PINK_DEEP}">もう一度</text>
    ${pill(cx + 250, cardY + 1480, 400, 120, PINK, '保存する')}
  </g>
</svg>`;
}

// ─────────────────────────────────────────────
// 画像3: パーツ別フィードバック
// ─────────────────────────────────────────────
function screen3() {
  const cardX = 110;
  const cardY = 660;
  const cardW = W - cardX * 2;
  const cardH = 1900;
  const cx = W / 2;

  const items = [
    { label: '目元', body: 'パッチリと開いた目元、', sub: '生き生きとした印象です' },
    { label: '口元', body: '満面の素敵な笑顔！', sub: '口角がしっかり上がっています' },
    { label: '表情バランス', body: '左右がきれいに整った', sub: '美しいバランスです' },
    { label: '顔の角度', body: 'まっすぐカメラを見ていて', sub: 'とても自然です' },
  ];

  let body = '';
  let y = cardY + 320;
  const itemW = cardW - 200;
  const itemX = cardX + 100;
  const itemH = 280;
  for (const it of items) {
    body += `
      <rect x="${itemX}" y="${y}" width="${itemW}" height="${itemH}" rx="40" ry="40" fill="${PINK_LIGHTEST}" stroke="${PINK_LIGHTER}" stroke-width="2"/>
      <text x="${itemX + 50}" y="${y + 90}" font-family="${FONT}" font-size="48" font-weight="700" fill="${PINK_DEEP}">${it.label}</text>
      <text x="${itemX + 50}" y="${y + 170}" font-family="${FONT}" font-size="42" font-weight="500" fill="${TEXT_DARK}">${it.body}</text>
      <text x="${itemX + 50}" y="${y + 230}" font-family="${FONT}" font-size="42" font-weight="500" fill="${TEXT_DARK}">${it.sub}</text>
    `;
    y += itemH + 40;
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${bg()}
  ${caption('パーツ別に詳しく分析')}
  ${card(cardX, cardY, cardW, cardH, WHITE)}
  <text x="${cx}" y="${cardY + 180}" text-anchor="middle" font-family="${FONT}" font-size="58" font-weight="700" fill="${PINK_DEEP}">詳しくみる ▼</text>
  ${body}
</svg>`;
}

// ─────────────────────────────────────────────
// 画像4: カレンダー
// ─────────────────────────────────────────────
function screen4() {
  const cardX = 80;
  const cardY = 660;
  const cardW = W - cardX * 2;
  const cardH = 1980;
  const cx = W / 2;

  // カレンダー: 7列 x 5行
  const calX = cardX + 50;
  const calY = cardY + 240;
  const calW = cardW - 100;
  const colW = calW / 7;
  const rowH = 140;
  const days = ['日', '月', '火', '水', '木', '金', '土'];

  let cal = '';
  // 月名
  cal += `<text x="${cx}" y="${cardY + 130}" text-anchor="middle" font-family="${FONT}" font-size="60" font-weight="700" fill="${PINK_DEEP}">2026年 5月</text>`;
  // 曜日ヘッダ
  for (let i = 0; i < 7; i++) {
    const x = calX + i * colW + colW / 2;
    cal += `<text x="${x}" y="${calY - 20}" text-anchor="middle" font-family="${FONT}" font-size="34" font-weight="600" fill="${PINK}">${days[i]}</text>`;
  }
  // 日付グリッド (1〜31, 5月1日が金曜想定)
  const startCol = 5; // 金
  const totalDays = 31;
  // 撮影記録ありの日と♥数
  const recorded = {
    1: 4, 2: 3, 4: 5, 5: 4, 7: 3,
    9: 4, 11: 5, 12: 5, 14: 3, 16: 4,
    18: 5, 19: 4, 21: 3, 23: 4, 25: 5,
    27: 5, 28: 4, 30: 3,
  };
  for (let d = 1; d <= totalDays; d++) {
    const idx = startCol + (d - 1);
    const row = Math.floor(idx / 7);
    const col = idx % 7;
    const x = calX + col * colW;
    const y = calY + row * rowH;
    const cellCx = x + colW / 2;
    const cellCy = y + 30;
    const r = recorded[d];
    if (d === 15) {
      cal += `<rect x="${x + 6}" y="${y + 4}" width="${colW - 12}" height="${rowH - 12}" rx="20" ry="20" fill="${PINK_LIGHTER}"/>`;
    }
    cal += `<text x="${cellCx}" y="${cellCy + 18}" text-anchor="middle" font-family="${FONT}" font-size="36" font-weight="500" fill="${TEXT_DARK}">${d}</text>`;
    if (r) {
      cal += `<text x="${cellCx}" y="${cellCy + 70}" text-anchor="middle" font-family="${FONT}" font-size="22" font-weight="700" fill="${PINK}" letter-spacing="-2">${'♥'.repeat(r)}</text>`;
    }
  }

  // 推移グラフ風
  const chartX = cardX + 50;
  const chartY = cardY + 1400;
  const chartW = cardW - 100;
  const chartH = 460;
  let chart = `<rect x="${chartX}" y="${chartY}" width="${chartW}" height="${chartH}" rx="40" ry="40" fill="${ACCENT}"/>`;
  chart += `<text x="${chartX + 30}" y="${chartY - 20}" font-family="${FONT}" font-size="40" font-weight="700" fill="${TEXT_DARK}">顔年齢の推移</text>`;
  // ライン
  const points = [
    [0.05, 0.6], [0.18, 0.55], [0.30, 0.45], [0.42, 0.5],
    [0.55, 0.35], [0.68, 0.4], [0.80, 0.28], [0.93, 0.32],
  ];
  let path = '';
  points.forEach(([px, py], i) => {
    const x = chartX + chartW * px;
    const y = chartY + chartH * py + 60;
    path += (i === 0 ? 'M' : 'L') + x + ',' + y + ' ';
  });
  chart += `<path d="${path}" fill="none" stroke="${PINK}" stroke-width="6"/>`;
  points.forEach(([px, py]) => {
    const x = chartX + chartW * px;
    const y = chartY + chartH * py + 60;
    chart += `<circle cx="${x}" cy="${y}" r="12" fill="${WHITE}" stroke="${PINK}" stroke-width="5"/>`;
  });

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${bg()}
  ${caption('毎日の変化を記録')}
  ${card(cardX, cardY, cardW, cardH, WHITE)}
  ${cal}
  ${chart}
</svg>`;
}

// ─────────────────────────────────────────────
// 出力
// ─────────────────────────────────────────────
const screens = [
  ['01-standby.png', screen1()],
  ['02-result.png', screen2()],
  ['03-parts.png', screen3()],
  ['04-calendar.png', screen4()],
];

for (const [name, svg] of screens) {
  const dest = resolve(outDir, name);
  await sharp(Buffer.from(svg)).png().toFile(dest);
  console.log(`✓ ${dest}`);
}

console.log('\nDone. Output:', outDir);
