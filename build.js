/* 빌드: src/의 CSS와 JS를 인라인해 배포용 단일 HTML(planning_reward.html) 생성
   사용법: node build.js */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const OUT = path.join(__dirname, 'planning_reward.html');

let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');

// 1) CSS 인라인
html = html.replace(
  /<link rel="stylesheet" href="styles\.css">/,
  () => '<style>\n' + fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8') + '</style>'
);

// 2) <script src> 순서대로 수집 후 하나의 <script>로 인라인
const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
if (!srcs.length) { console.error('스크립트 태그를 찾지 못했습니다'); process.exit(1); }

const bundle = srcs
  .map(s => '/* ===== ' + s + ' ===== */\n' + fs.readFileSync(path.join(SRC, s), 'utf8'))
  .join('\n');

let first = true;
html = html.replace(/<script src="[^"]+"><\/script>\n?/g, () => {
  if (first) { first = false; return '<script>\n' + bundle + '</script>\n'; }
  return '';
});

fs.writeFileSync(OUT, html);
console.log('빌드 완료 →', OUT, '(' + srcs.length + '개 모듈, ' + (html.length / 1024).toFixed(1) + 'KB)');
