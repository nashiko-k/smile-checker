#!/usr/bin/env node
// 1024x1024 のアプリアイコンを生成して assets/icon.png に書き出す。
// components/BrandMark.tsx の SVG をそのまま 5倍スケールして中央配置、
// 背景はピンクの縦グラデーション（#FFE0E8 → #FF85A2）。

import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFE0E8"/>
      <stop offset="100%" stop-color="#FF85A2"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>

  <!-- BrandMark (140x140 viewBox) を 5x スケールして中央 (162, 162) に配置 -->
  <g transform="translate(162, 162) scale(5)">
    <circle cx="70" cy="70" r="70" fill="#FF85A2"/>
    <rect x="34" y="48" width="72" height="52" rx="10" fill="#FFFFFF"/>
    <rect x="56" y="42" width="28" height="10" rx="3" fill="#FFFFFF"/>
    <circle cx="70" cy="74" r="16" fill="#FFE0E8"/>
    <circle cx="70" cy="74" r="9" fill="#FF85A2"/>
    <circle cx="93" cy="58" r="3" fill="#FFC1D0"/>
    <circle cx="100" cy="98" r="14" fill="#FFE89A" stroke="#FFFFFF" stroke-width="3"/>
    <circle cx="95" cy="95" r="1.6" fill="#5A3E2B"/>
    <circle cx="105" cy="95" r="1.6" fill="#5A3E2B"/>
    <path d="M93 100 Q100 107 107 100" stroke="#5A3E2B" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  </g>
</svg>
`.trim();

const outDir = resolve(projectRoot, 'assets');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, 'icon.png');

await sharp(Buffer.from(svg))
  .flatten({ background: '#FFE0E8' }) // アルファを破棄して完全不透明に
  .png({ compressionLevel: 9 })
  .toFile(outPath);

console.log(`✓ Wrote ${outPath}`);
