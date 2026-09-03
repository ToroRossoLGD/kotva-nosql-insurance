const fs = require('fs');
const path = require('path');

const root = __dirname;
const source = fs.readFileSync(path.join(root, 'DOKUMENTACIJA_KOTVA.txt'), 'utf8');
const sourceLines = source.split(/\r?\n/);
const lines = [];
let skipProfessorQuestions = false;

for (const line of sourceLines) {
  const trimmed = line.trim();
  if (/^25\.\s+MOGUĆA PITANJA PROFESORA$/i.test(trimmed)) {
    skipProfessorQuestions = true;
    continue;
  }
  if (skipProfessorQuestions && /^26\.\s+PLAN PREZENTACIJE$/i.test(trimmed)) {
    skipProfessorQuestions = false;
  }
  if (!skipProfessorQuestions) lines.push(line);
}
const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const headings = [];

for (let i = 0; i < lines.length - 1; i++) {
  if (/^[-=]{3,}$/.test(lines[i + 1].trim()) && /^\d+\./.test(lines[i].trim())) headings.push(lines[i].trim());
}

const codeLike = (line) => {
  const s = line.trim();
  return /^(FOR |FILTER |SORT |RETURN |LET |COLLECT |AGGREGATE |LIMIT |SEARCH |IN 1\.\.|GRAPH |OPTIONS |docker |cd C:\\|GET \/api\/|POST \/api\/|http:\/\/localhost|O\(|_key:|_id:|_rev:|clients --|Shard |Leader|Follower|\{|\}|\[|\]|\")/.test(s) || s.includes(' -> ') || s.includes('──');
};

let body = '';
for (let i = 0; i < lines.length; i++) {
  const raw = lines[i];
  const s = raw.trim();
  if (i + 1 < lines.length && /^[-=]{3,}$/.test(lines[i + 1].trim())) {
    if (!s.startsWith('KOTVA -') && !s.startsWith('KRAJ DOKUMENTACIJE')) {
      const level = /^\d+\.\s/.test(s) ? 'h1' : 'h2';
      body += `<${level}>${esc(s)}</${level}>`;
    }
    i++;
    continue;
  }
  if (!s || /^={3,}$/.test(s)) continue;
  if (/^\d+\.\d+\.\s/.test(s)) body += `<h2>${esc(s)}</h2>`;
  else if (s.startsWith('- ')) body += `<ul><li>${esc(s.slice(2))}</li></ul>`;
  else if (codeLike(raw)) body += `<pre>${esc(raw)}</pre>`;
  else body += `<p>${esc(s)}</p>`;
}

const toc = headings.map(h => `<li>${esc(h.replace(/^\d+\.\s*/, ''))}</li>`).join('');
const html = `<!doctype html><html lang="sr"><head><meta charset="utf-8"><title>Kotva - NoSQL dokumentacija</title><style>
@page{size:A4;margin:20mm 18mm 18mm}@page:first{margin:0}*{box-sizing:border-box}body{margin:0;color:#17232d;font-family:Arial,sans-serif;font-size:10.5pt;line-height:1.42}p{margin:0 0 7pt}h1{font-size:17pt;color:#102d46;margin:20pt 0 9pt;break-after:avoid;border-bottom:1px solid #d9e1e6;padding-bottom:4pt}h2{font-size:13pt;color:#173d5a;margin:14pt 0 7pt;break-after:avoid}ul{margin:0 0 4pt 18pt;padding:0}li{margin:0 0 3pt}pre{font:8.7pt/1.35 Consolas,monospace;color:#102d46;background:#f3f6f8;border-left:4px solid #ff6b35;margin:3pt 0;padding:5pt 8pt;white-space:pre-wrap;break-inside:avoid}.cover{height:297mm;background:#102d46;color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:25mm}.kicker{color:#ff8b62;font-weight:700;letter-spacing:.18em;font-size:11pt}.cover h1{border:0;color:white;font-size:36pt;margin:18pt 0 5pt}.cover .sub{font-size:17pt;color:#c5d3dd;max-width:150mm}.rule{width:60mm;height:6px;background:#ff6b35;margin:28pt}.tech{font-weight:700;letter-spacing:.04em}.date{color:#a9bdca;margin-top:9pt}.toc{break-after:page;padding-top:5mm}.toc ol{columns:2;column-gap:12mm;padding-left:18pt}.toc li{margin:0 0 7pt;color:#173d5a;break-inside:avoid}.content{counter-reset:page}.footer{position:fixed;bottom:-12mm;left:0;right:0;text-align:center;color:#75838d;font-size:8pt}.section-note{background:#fff2ed;border-left:4px solid #ff6b35;padding:8pt}.cover,.toc{page-break-after:always}
</style></head><body><section class="cover"><div class="kicker">NOSQL PROJEKAT</div><h1>KOTVA</h1><div class="sub">Informacioni sistem za osiguravajuće društvo</div><div class="rule"></div><div class="tech">Node.js · Express · ArangoDB · Chart.js</div><div class="date">Kompletna dokumentacija projekta · Avgust 2026.</div></section><section class="toc"><h1>Sadržaj</h1><ol>${toc}</ol></section><main class="content">${body}</main><div class="footer">Kotva · NoSQL dokumentacija · ArangoDB</div></body></html>`;

fs.writeFileSync(path.join(root, 'DOKUMENTACIJA_KOTVA.html'), html, 'utf8');
console.log('DOKUMENTACIJA_KOTVA.html');
