// demo.html controller: text -> gloss -> SiGML -> CWASA avatar.
// Uses only the public CWASA API (init, playSiGMLText, stopSiGML, addHook).
import { buildLexicon } from './lexicon.js';
import { textToSiGML } from './pipeline.js';

const PACK_URL = 'data/pack/demo_pack.json';
const $ = (id) => document.getElementById(id);
const state = { pack: null, lex: null, initStart: 0, ready: false, fpsRun: null, signing: false };

function log(msg) {
  const li = document.createElement('li');
  li.textContent = `${(performance.now() / 1000).toFixed(1)}s ${msg}`;
  $('log').prepend(li);
  while ($('log').children.length > 60) $('log').lastChild.remove();
}
function setStatus(msg, kind = '') {
  $('status').textContent = msg;
  $('status').className = `status ${kind}`;
  log(msg);
}
const text = (id, v) => { $(id).textContent = v === '' || v == null ? '–' : v; };

// ------------------------------------------------------------------ XSLT check
function xsltState() {
  const x = window.T2S_XSLT || {};
  if (x.native) return { ok: true, label: 'có sẵn (native)' };
  if (typeof XSLTProcessor !== 'undefined') return { ok: true, label: 'qua polyfill' };
  return { ok: false, label: x.polyfillError ? 'không có; polyfill chưa tải (xem README)' : 'không có' };
}

// ------------------------------------------------------------------ CWASA
function initCWASA() {
  if (typeof CWASA === 'undefined') {
    setStatus('Không nạp được jas/loc2025/cwa/allcsa.js (kiểm tra đường dẫn / máy chủ).', 'bad');
    return;
  }
  const pageDir = new URL('./', location.href).href;
  const jasBase = new URL('jas/loc2025/', location.href).href;

  CWASA.addHook('status', (evt) => { if (evt.msg) log(`CWASA: ${evt.msg}`); });
  CWASA.addHook('avatarloading', () => log('avatar đang nạp'));
  CWASA.addHook('avatarloaded', (evt) => {
    if (evt.msg === null) setStatus('Nạp avatar thất bại (xem console).', 'bad');
  });
  CWASA.addHook('avatarready', () => {
    if (state.ready) return;
    state.ready = true;
    const ms = performance.now() - state.initStart;
    text('mLoad', `${(ms / 1000).toFixed(2)} s (từ CWASA.init đến avatarready)`);
    text('mState', 'sẵn sàng');
    setStatus('Avatar sẵn sàng.', 'ok');
    updateButtons();
  });
  CWASA.addHook('avatarfps', (evt) => {
    const fps = Number(evt.msg);
    if (!Number.isFinite(fps)) return;
    text('mFps', fps.toFixed(1));
    if (state.signing && state.fpsRun) {
      state.fpsRun.n++; state.fpsRun.sum += fps;
      state.fpsRun.min = Math.min(state.fpsRun.min, fps);
      state.fpsRun.max = Math.max(state.fpsRun.max, fps);
    }
  }, 0);
  CWASA.addHook('animactive', () => {
    state.signing = true;
    state.fpsRun = { n: 0, sum: 0, min: Infinity, max: -Infinity, t0: performance.now() };
    text('mState', 'đang ký');
  });
  CWASA.addHook('animidle', () => {
    if (state.signing && state.fpsRun) {
      const r = state.fpsRun;
      const dur = ((performance.now() - r.t0) / 1000).toFixed(1);
      text('mFpsRun', r.n
        ? `TB ${(r.sum / r.n).toFixed(1)} · min ${r.min.toFixed(1)} · max ${r.max.toFixed(1)} (${r.n} mẫu, ${dur} s)`
        : `không có mẫu FPS (${dur} s)`);
    }
    state.signing = false;
    text('mState', state.ready ? 'sẵn sàng' : '–');
  });
  CWASA.addHook('sigmlloaded', (evt) => {
    if (evt.msg === null) setStatus('CWASA không tạo được chuyển động từ SiGML (xem log/console).', 'warn');
  });

  state.initStart = performance.now();
  try {
    const p = CWASA.init({ jasBase, useClientConfig: true, clientBase: pageDir });
    if (p && typeof p.then === 'function') {
      p.then(() => log('CWASA.init xong cấu hình'), (e) => setStatus(`CWASA.init lỗi: ${e}`, 'bad'));
    }
    setStatus('Đang nạp avatar…');
  } catch (e) {
    setStatus(`CWASA.init lỗi: ${e}`, 'bad');
  }
}

// ------------------------------------------------------------------ pack
async function loadPack() {
  try {
    const res = await fetch(PACK_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.pack = await res.json();
  } catch (e) {
    setStatus(`Không nạp được ${PACK_URL} (${e.message}). Chạy: python tools/build_pack.py`, 'bad');
    $('demoSelect').innerHTML = '<option>Chưa có gói demo</option>';
    return;
  }
  state.lex = buildLexicon(Object.keys(state.pack.signs), state.pack.synonyms);
  const sel = $('demoSelect');
  sel.innerHTML = '';
  const first = document.createElement('option');
  first.value = ''; first.textContent = `— chọn 1 trong ${state.pack.sentences.length} câu —`;
  sel.append(first);
  state.pack.sentences.forEach((s, i) => {
    const o = document.createElement('option');
    o.value = String(i); o.textContent = s.source;
    sel.append(o);
  });
  sel.disabled = false;
  log(`gói demo: ${state.pack.meta.signs} ký hiệu, ${state.pack.sentences.length} câu`);
  updateButtons();
}

function updateButtons() {
  $('playBtn').disabled = !(state.lex && state.ready);
  $('stopBtn').disabled = !state.ready;
}

// ------------------------------------------------------------------ UI
function renderLookups(r) {
  const box = $('lookups');
  box.innerHTML = '';
  const signedTokens = new Set(r.signed.map((s) => s.token));
  for (const l of r.lookups) {
    const kind = l.kind === 'missing' || !signedTokens.has(l.token) ? 'missing' : l.kind;
    const chip = document.createElement('span');
    chip.className = `chip ${kind}`;
    chip.textContent = l.token;
    const note = { exact: '', synonym: ` → ${l.entry}`, plain: ` ≈ ${l.entry} (chưa chắc)`, missing: '' }[kind];
    if (note) { const sm = document.createElement('small'); sm.textContent = note; chip.append(sm); }
    box.append(chip);
  }
  if (!r.lookups.length) box.textContent = '–';
}

function run() {
  const input = $('inputText').value.trim();
  if (!input || !state.lex) return;
  const r = textToSiGML(input, state.lex, state.pack.signs, { enableQuestion: $('questionToggle').checked });
  text('segmented', r.segmented.join(' '));
  text('gloss', r.gloss);
  renderLookups(r);
  text('missing', r.missing.length ? `${r.missing.length}: ${r.missing.join(', ')}` : 'không');
  text('uncertain', r.uncertain.length ? r.uncertain.map((u) => `${u.token} ≈ ${u.entry}`).join(', ') : 'không');
  text('applied', r.applied.length ? r.applied.map((a) => `${a.group}/${a.rule}: ${a.detail}`).join(' · ') : 'không');
  $('sigml').textContent = r.sigml || '(trống)';
  if (!r.sigml) { setStatus('Không có ký hiệu nào để ký.', 'warn'); return; }
  if (!xsltState().ok) setStatus('Trình duyệt không có XSLTProcessor: CWASA có thể không chuyển được SiGML.', 'warn');
  const msg = CWASA.playSiGMLText(r.sigml, 0);
  setStatus(`Gửi ${r.signed.length} ký hiệu tới avatar (${msg}).`);
}

$('demoSelect').addEventListener('change', (e) => {
  const s = state.pack?.sentences[Number(e.target.value)];
  if (e.target.value === '' || !s) return;
  $('inputText').value = s.source;
  text('reference', s.reference);
});
$('inputText').addEventListener('input', () => text('reference', ''));
$('playBtn').addEventListener('click', run);
$('stopBtn').addEventListener('click', () => { if (typeof CWASA !== 'undefined') CWASA.stopSiGML(0); });

const xs = xsltState();
text('mXslt', xs.label);
if (!xs.ok) setStatus('Trình duyệt không có XSLTProcessor và chưa có polyfill (xem README).', 'warn');
initCWASA();
loadPack();
