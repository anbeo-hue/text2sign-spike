// demo.html controller: text -> gloss -> SiGML -> CWASA avatar.
// Uses only the public CWASA API (init, playSiGMLText, stopSiGML, addHook).
import { buildLexicon } from './lexicon.js';
import { textToSiGML } from './pipeline.js';

const PACK_URL = 'data/pack/demo_pack.json';
const $ = (id) => document.getElementById(id);
const state = { pack: null, lex: null, initStart: 0, ready: false, fpsRun: null, signing: false, run: null };
// Read-only metrics for manual checks and automation (no polling needed: see T2S_METRICS.events).
const metrics = window.T2S_METRICS = { xslt: null, polyfillReadyMs: null, loadMs: null, runs: [], events: [] };
function emit(type, data) {
  const e = { type, t: performance.now(), ...data };
  metrics.events.push(e);
  // Optional push channel for CDP Runtime.addBinding (avoids periodic Runtime.evaluate).
  if (typeof window.t2sReport === 'function') { try { window.t2sReport(JSON.stringify(e)); } catch { /* ignore */ } }
}

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
// mode: 'native' | 'polyfill' | 'none'
function xsltState() {
  const x = window.T2S_XSLT || {};
  const forcedNote = x.forced ? ' — ÉP bằng ?xslt=polyfill' : '';
  if (x.forced && x.hadNative && !x.nativeRemoved) {
    return { ok: x.native, mode: 'native', label: 'native (KHÔNG xóa được XSLTProcessor gốc, chế độ ép thất bại)' };
  }
  if (x.native) return { ok: true, mode: 'native', label: 'native (trình duyệt)' };
  const isPoly = typeof XSLTProcessor !== 'undefined'
    && typeof XSLTProcessor.prototype.isPolyfill === 'function';
  if (isPoly) return { ok: true, mode: 'polyfill', label: `polyfill xslt-polyfill@1.0.33${forcedNote}` };
  if (x.polyfillError) return { ok: false, mode: 'none', label: `không có; tải polyfill lỗi (${x.polyfillSrc})${forcedNote}` };
  return { ok: false, mode: 'none', label: `không có${forcedNote}` };
}

// The polyfill's transform throws until its Wasm module is ready, so CWASA must not start before.
async function waitPolyfill(xs) {
  if (xs.mode !== 'polyfill') return true;
  const t0 = window.T2S_XSLT?.t0 ?? 0;
  try {
    // 1.0.33: xsltPolyfillReady is a FUNCTION returning a Promise (README of later versions says "promise").
    const r = window.xsltPolyfillReady;
    await (typeof r === 'function' ? r() : r);
    metrics.polyfillReadyMs = performance.now() - t0;
    log(`polyfill XSLT sẵn sàng sau ${(metrics.polyfillReadyMs / 1000).toFixed(2)} s (tính từ đầu trang)`);
    return true;
  } catch (e) {
    setStatus(`Polyfill XSLT nạp Wasm lỗi: ${e}`, 'bad');
    return false;
  }
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
    metrics.loadMs = ms;
    emit('avatarready', { loadMs: ms });
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
  CWASA.addHook('avatarsign', (evt) => {
    if (!state.run) return;
    state.run.avatarsign++;
    const s = evt.msg && evt.msg.s;
    if (s != null) state.run.signIdx.add(String(s));
  }, 0);
  CWASA.addHook('animactive', () => {
    state.signing = true;
    state.fpsRun = { n: 0, sum: 0, min: Infinity, max: -Infinity, t0: performance.now() };
    text('mState', 'đang ký');
    emit('animactive', {});
  });
  CWASA.addHook('animidle', () => {
    if (state.signing && state.fpsRun) {
      const r = state.fpsRun;
      const durS = (performance.now() - r.t0) / 1000;
      const dur = durS.toFixed(1);
      text('mFpsRun', r.n
        ? `TB ${(r.sum / r.n).toFixed(1)} · min ${r.min.toFixed(1)} · max ${r.max.toFixed(1)} (${r.n} mẫu, ${dur} s)`
        : `không có mẫu FPS (${dur} s)`);
      const run = state.run;
      if (run) {
        const rec = {
          text: run.text, hnsSent: run.hnsSent, avatarsign: run.avatarsign, signIdx: run.signIdx.size,
          fpsMean: r.n ? r.sum / r.n : null, fpsMin: r.n ? r.min : null, fpsMax: r.n ? r.max : null,
          fpsSamples: r.n, durS, xslt: metrics.xslt,
        };
        metrics.runs.push(rec);
        text('mSigns', `gửi ${rec.hnsSent} hns_sign · avatarsign ${rec.avatarsign} sự kiện (${rec.signIdx} chỉ số s khác nhau)`);
        emit('run', rec);
        state.run = null;
      }
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
  const hnsSent = (r.sigml.match(/<hns_sign\b/g) || []).length;
  state.run = { text: input, hnsSent, avatarsign: 0, signIdx: new Set() };
  text('mSigns', `gửi ${hnsSent} hns_sign · đang chờ avatar…`);
  emit('play', { text: input, hnsSent });
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
metrics.xslt = xs.mode;
text('mXslt', xs.label);
document.documentElement.dataset.xslt = xs.mode;
emit('xslt', { mode: xs.mode, label: xs.label });
if (!xs.ok) setStatus('Trình duyệt không có XSLTProcessor và polyfill không nạp được (xem README).', 'warn');
loadPack();
waitPolyfill(xs).then((ok) => {
  if (ok) initCWASA();
});
