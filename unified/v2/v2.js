// Unified two-way VSL demo (v2).
// The two existing pages run unmodified in same-origin iframes:
//   ../s2t/index.html  sign -> text (camera, MediaPipe, recognizer)
//   ../../demo.html    text -> gloss -> SiGML -> CWASA avatar
// This page only injects CSS to hide their own chrome, observes their DOM
// (MutationObserver) and presses their existing buttons/inputs.
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const HISTORY_KEY = 'vsl_history_v1';
  const HELP_KEY = 'vsl_help_seen_v1';
  const MAX_TURNS = 200;
  const DEFAULTS = { conf: 0.7, margin: 0.3, pose: 'full', question: false };
  const fS = $('fS2T');
  const fT = $('fT2S');

  // ---------------------------------------------------------------- storage
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };

  // A stored turn has ONLY: side, text, status, at (+ conf for signer turns).
  function cleanTurn(t) {
    if (!t || (t.side !== 'signer' && t.side !== 'listener')) return null;
    if (typeof t.text !== 'string' || !t.text || typeof t.at !== 'number') return null;
    const out = { side: t.side, text: t.text, status: t.side === 'signer' ? 'confident' : 'signed', at: t.at };
    if (t.side === 'signer') out.conf = typeof t.conf === 'number' ? t.conf : null;
    return out;
  }
  function loadHistory() {
    try {
      const a = JSON.parse(store.get(HISTORY_KEY) || '[]');
      return Array.isArray(a) ? a.map(cleanTurn).filter(Boolean).slice(-MAX_TURNS) : [];
    } catch { return []; }
  }
  let history = loadHistory();
  const sessionUnsure = []; // shown in this session only: never stored, never exported
  const saveHistory = () => store.set(HISTORY_KEY, JSON.stringify(history));

  function addTurn(side, text, conf) {
    const t = cleanTurn({ side, text, conf: conf == null ? null : Math.round(conf * 100) / 100, at: Date.now() });
    if (!t) return;
    history.push(t);
    if (history.length > MAX_TURNS) history = history.slice(-MAX_TURNS);
    saveHistory();
    renderConversation();
  }

  // ---------------------------------------------------------------- conversation
  const pad2 = (n) => String(n).padStart(2, '0');
  const hhmm = (ms) => { const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
  const sideName = (side) => (side === 'signer' ? 'Người ký' : 'Người nghe');

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderConversation() {
    const list = $('convList');
    const turns = history.map((t) => ({ ...t })).concat(sessionUnsure.map((t) => ({ ...t, unsure: true })))
      .sort((a, b) => a.at - b.at);
    list.replaceChildren();
    $('convEmpty').hidden = turns.length > 0;
    for (const t of turns) {
      const li = el('li', `turn ${t.side}${t.unsure ? ' unsure' : ''}`);
      const b = el('div', 'bubble');
      const meta = el('div', 'bubble-meta');
      meta.append(el('span', 'who', sideName(t.side)));
      const time = el('time', null, hhmm(t.at));
      time.dateTime = new Date(t.at).toISOString();
      meta.append(time);
      const body = el('div', 'bubble-body');
      body.append(el('span', 'bubble-word', t.text));
      if (t.unsure) body.append(el('span', 'pill pill-unsure', 'chưa chắc — không ghi vào hội thoại'));
      else if (t.side === 'signer') body.append(el('span', 'pill pill-ok', 'chắc chắn'));
      else body.append(el('span', 'pill pill-signed', 'avatar đã ký'));
      b.append(meta, body);
      if (t.side === 'signer' && !t.unsure) {
        const again = el('button', 'btn-small', 'Cho avatar ký lại');
        again.type = 'button';
        again.setAttribute('aria-label', `Cho avatar ký lại từ ${t.text}`);
        again.addEventListener('click', () => signText(t.text.toLowerCase()));
        const wrap = el('div');
        wrap.append(again);
        b.append(wrap);
      }
      li.append(b);
      list.append(li);
    }
  }

  $('exportBtn').addEventListener('click', () => {
    const lines = history.map((t) => `${hhmm(t.at)}  ${sideName(t.side)}: ${t.text}`);
    const blob = new Blob([lines.join('\r\n') + (lines.length ? '\r\n' : '')], { type: 'text/plain;charset=utf-8' });
    const d = new Date();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hoi-thoai-vsl-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}.txt`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  });

  function setConfirm(open) {
    $('clearConfirm').hidden = !open;
    $('clearBtn').setAttribute('aria-expanded', String(open));
    if (open) $('clearNo').focus();
  }
  $('clearBtn').addEventListener('click', () => setConfirm($('clearConfirm').hidden));
  $('clearNo').addEventListener('click', () => { setConfirm(false); $('clearBtn').focus(); });
  $('clearYes').addEventListener('click', () => {
    history = [];
    sessionUnsure.length = 0;
    store.del(HISTORY_KEY);
    renderConversation();
    setConfirm(false);
    $('clearBtn').focus();
  });

  // ---------------------------------------------------------------- iframe helpers
  function injectCss(doc, css) {
    if (!doc || doc.getElementById('v2-injected')) return;
    const s = doc.createElement('style');
    s.id = 'v2-injected';
    s.textContent = css;
    doc.head.append(s);
  }
  function observe(node, fn, opts) {
    if (!node) return;
    new MutationObserver(fn).observe(node, opts || { childList: true, characterData: true, subtree: true });
    fn();
  }
  function onFrameReady(frame, fn) {
    let done = false;
    const run = () => {
      if (done) return;
      let doc = null;
      try { doc = frame.contentDocument; } catch { return; }
      if (!doc || doc.readyState !== 'complete' || doc.location.href === 'about:blank') return;
      done = true;
      fn(frame.contentWindow, doc);
    };
    frame.addEventListener('load', run);
    run();
  }
  // Fire an event in the iframe's own realm so its handlers see a normal event.
  function fire(win, node, type) { node.dispatchEvent(new win.Event(type, { bubbles: true })); }

  // ---------------------------------------------------------------- signer (s2t)
  const S2T_CSS = `
    html, body { height: 100%; margin: 0; overflow: hidden; background: #10181F; }
    main { display: block !important; max-width: none !important; margin: 0 !important; padding: 0 !important; height: 100%; }
    main > section:nth-of-type(2) { display: none !important; }
    main > section:first-of-type { height: 100%; }
    main > section:first-of-type > :not(.stage) { display: none !important; }
    .stage { aspect-ratio: auto !important; width: 100% !important; height: 100% !important; border-radius: 0 !important; }
  `;
  let sWin = null, sDoc = null;

  function camStatusText(raw) {
    const s = (raw || '').trim();
    if (!s) return { text: 'Chưa bật camera.', bad: false };
    if (s.startsWith('sẵn sàng')) {
      const m = s.match(/nguồn:\s*(.+)$/);
      return { text: `Sẵn sàng · nguồn mô hình: ${m ? m[1] : 'không rõ'}`, bad: false };
    }
    if (s === 'lỗi') return { text: 'Lỗi khi bật camera hoặc tải mô hình.', bad: true };
    return { text: s.charAt(0).toUpperCase() + s.slice(1), bad: false };
  }

  function showLast(word, pillText, pillCls, unsure) {
    $('lastWord').textContent = word;
    $('lastWord').classList.toggle('unsure', !!unsure);
    const p = $('lastPill');
    p.hidden = !pillText;
    p.textContent = pillText || '';
    p.className = `pill ${pillCls || ''}`;
  }

  function onRecognized() {
    const w = sDoc.getElementById('word');
    const text = (w.textContent || '').trim();
    if (!text || text === '—') return;
    const detail = (sDoc.getElementById('detail').textContent || '').trim();
    if (!w.classList.contains('unsure')) {
      const m = detail.match(/^độ tự tin (\d+)%/);
      addTurn('signer', text, m ? Number(m[1]) / 100 : null);
      showLast(text, 'chắc chắn · đã thêm vào hội thoại', 'pill-ok', false);
    } else {
      const m = detail.match(/gần nhất:\s*(.+?), độ tự tin/);
      const guess = m ? m[1] : 'chưa chắc';
      sessionUnsure.push({ side: 'signer', text: guess, at: Date.now() });
      renderConversation();
      showLast(guess, 'chưa chắc', 'pill-unsure', true);
    }
  }

  onFrameReady(fS, (win, doc) => {
    sWin = win; sDoc = doc;
    injectCss(doc, S2T_CSS);
    fS.classList.add('ready');
    const start = doc.getElementById('start');
    observe(start, () => { $('camBtn').disabled = start.disabled; }, { attributes: true, attributeFilter: ['disabled'] });
    observe(doc.getElementById('status'), () => {
      const s = camStatusText(doc.getElementById('status').textContent);
      $('camStatus').textContent = s.text;
      $('camStatus').classList.toggle('bad', s.bad);
    });
    observe(doc.getElementById('err'), () => { $('camErr').textContent = doc.getElementById('err').textContent; });
    // One mutation batch per recognition result (the page sets #word once per result).
    new MutationObserver(onRecognized).observe(doc.getElementById('word'), { childList: true, characterData: true, subtree: true });
    syncAdvancedFromS2T();
  });
  $('camBtn').addEventListener('click', () => { if (sDoc) sDoc.getElementById('start').click(); });

  // ---------------------------------------------------------------- listener (t2s)
  const T2S_CSS = `
    html, body { height: 100%; margin: 0; overflow: hidden; background: #E4EAEF !important; }
    main { max-width: none !important; margin: 0 !important; padding: 0 !important; height: 100%; }
    main > h1, main > .sub, .grid > section, aside > .card:not(:first-child) { display: none !important; }
    .grid { display: block !important; height: 100%; }
    aside { height: 100%; }
    aside > .card:first-child { height: 100%; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; background: transparent !important; }
    .avatar-stage { width: 100% !important; height: 100% !important; margin: 0 !important; border-radius: 0 !important; }
  `;
  let tWin = null, tDoc = null, pendingPlay = null, avState = '';

  function renderAvStatus() {
    if (!tDoc) return;
    const st = tDoc.getElementById('status');
    const warn = st && (st.classList.contains('warn') || st.classList.contains('bad')) ? st.textContent.trim() : '';
    let text = 'Đang tải avatar…';
    if (avState === 'sẵn sàng') text = 'Avatar sẵn sàng';
    else if (avState === 'đang ký') text = 'Avatar đang ký…';
    $('avStatus').textContent = warn ? `${text} · ${warn}` : text;
    $('avStatus').classList.toggle('bad', !!(st && st.classList.contains('bad')));
  }

  function onT2SEvent(e) {
    if (e.type === 'play') {
      pendingPlay = e.text;
      $('advGloss').textContent = tDoc.getElementById('gloss').textContent;
      $('advMissing').textContent = tDoc.getElementById('missing').textContent;
      $('advSigml').textContent = tDoc.getElementById('sigml').textContent;
    } else if (e.type === 'animactive' && pendingPlay != null) {
      // The avatar has really started signing: one listener turn per play.
      addTurn('listener', pendingPlay);
      pendingPlay = null;
    }
  }

  onFrameReady(fT, (win, doc) => {
    tWin = win; tDoc = doc;
    injectCss(doc, T2S_CSS);
    fT.classList.add('ready');
    // demo.js calls window.t2sReport(json) for every event; chain onto it (keeps any existing hook).
    const prev = win.t2sReport;
    win.t2sReport = function (json) {
      if (typeof prev === 'function') { try { prev.call(win, json); } catch { /* ignore */ } }
      try { onT2SEvent(JSON.parse(json)); } catch { /* ignore */ }
    };
    const play = doc.getElementById('playBtn');
    const stop = doc.getElementById('stopBtn');
    observe(play, () => {
      $('playBtn').disabled = play.disabled;
      document.querySelectorAll('[data-word]').forEach((b) => { b.disabled = play.disabled; });
    }, { attributes: true, attributeFilter: ['disabled'] });
    observe(stop, () => { $('stopBtn').disabled = stop.disabled; }, { attributes: true, attributeFilter: ['disabled'] });
    observe(doc.getElementById('mState'), () => { avState = doc.getElementById('mState').textContent.trim(); renderAvStatus(); });
    observe(doc.getElementById('status'), renderAvStatus, { childList: true, characterData: true, subtree: true, attributes: true });
    $('advQuestion').checked = doc.getElementById('questionToggle').checked;
  });

  function signText(text) {
    const t = (text || '').trim();
    if (!t) { $('avStatus').textContent = 'Hãy gõ một từ hoặc câu, hoặc bấm một từ gợi ý.'; $('sayText').focus(); return; }
    $('sayText').value = t;
    if (!tDoc) return;
    const play = tDoc.getElementById('playBtn');
    if (play.disabled) { $('avStatus').textContent = 'Avatar chưa sẵn sàng, thử lại sau giây lát.'; return; }
    tDoc.getElementById('inputText').value = t;
    play.click();
  }
  $('playBtn').addEventListener('click', () => signText($('sayText').value));
  $('stopBtn').addEventListener('click', () => { if (tDoc) tDoc.getElementById('stopBtn').click(); });
  $('sayText').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); signText($('sayText').value); }
  });
  document.querySelectorAll('[data-word]').forEach((b) => b.addEventListener('click', () => signText(b.dataset.word)));

  // ---------------------------------------------------------------- advanced drawer
  const fmt2 = (v) => Number(v).toFixed(2);
  function syncAdvancedFromS2T() {
    if (!sDoc) return;
    $('advConf').value = sDoc.getElementById('conf').value;
    $('advMargin').value = sDoc.getElementById('margin').value;
    $('advPose').value = sDoc.getElementById('posemodel').value;
    $('advConfV').textContent = fmt2($('advConf').value);
    $('advMarginV').textContent = fmt2($('advMargin').value);
  }
  function setS2TRange(id, value) {
    if (!sDoc) return;
    const input = sDoc.getElementById(id);
    input.value = value;
    fire(sWin, input, 'input'); // s2t's own oninput handler updates its recognizer options
  }
  function setPose(value) {
    if (!sDoc) return;
    const sel = sDoc.getElementById('posemodel');
    if (sel.value === value) return;
    sel.value = value;
    // Before the camera starts, the value is read at start; afterwards s2t reloads Pose on 'change'.
    if ((sDoc.getElementById('status').textContent || '').startsWith('sẵn sàng')) fire(sWin, sel, 'change');
  }
  $('advConf').addEventListener('input', (e) => { $('advConfV').textContent = fmt2(e.target.value); setS2TRange('conf', e.target.value); });
  $('advMargin').addEventListener('input', (e) => { $('advMarginV').textContent = fmt2(e.target.value); setS2TRange('margin', e.target.value); });
  $('advPose').addEventListener('change', (e) => setPose(e.target.value));
  $('advQuestion').addEventListener('change', (e) => { if (tDoc) tDoc.getElementById('questionToggle').checked = e.target.checked; });
  $('advReset').addEventListener('click', () => {
    $('advConf').value = DEFAULTS.conf; $('advConfV').textContent = fmt2(DEFAULTS.conf); setS2TRange('conf', DEFAULTS.conf);
    $('advMargin').value = DEFAULTS.margin; $('advMarginV').textContent = fmt2(DEFAULTS.margin); setS2TRange('margin', DEFAULTS.margin);
    $('advPose').value = DEFAULTS.pose; setPose(DEFAULTS.pose);
    $('advQuestion').checked = DEFAULTS.question; if (tDoc) tDoc.getElementById('questionToggle').checked = DEFAULTS.question;
  });

  function mediapipeSource() {
    const src = sWin && sWin.S2T_SOURCES;
    if (!src) return '—';
    const vals = Object.values(src).filter(Boolean);
    if (!vals.length) return 'chưa tải';
    const net = Object.entries(src).filter(([, v]) => v === 'mạng').map(([k]) => k);
    if (!net.length) return 'cục bộ';
    if (net.length === vals.length) return 'mạng';
    return `cục bộ + mạng (${net.join(', ')})`;
  }
  function refreshPerf() {
    if (sDoc) {
      $('perfFps').textContent = sDoc.getElementById('fps').textContent;
      $('perfLat').textContent = sDoc.getElementById('lat').textContent;
    }
    $('perfSrc').textContent = mediapipeSource();
    const m = tWin && tWin.T2S_METRICS;
    $('perfXslt').textContent = !m || !m.xslt ? '—' : m.xslt === 'native' ? 'gốc của trình duyệt' : m.xslt === 'polyfill' ? 'polyfill (xslt-polyfill 1.0.33)' : 'không có';
    $('perfLoad').textContent = m && m.loadMs != null ? `${(m.loadMs / 1000).toFixed(2)} s` : '—';
  }

  let perfTimer = null, drawerReturn = null;
  function setDrawer(open) {
    const d = $('drawer');
    d.classList.toggle('open', open);
    d.inert = !open;
    $('advBtn').setAttribute('aria-expanded', String(open));
    clearInterval(perfTimer);
    if (open) {
      syncAdvancedFromS2T();
      refreshPerf();
      perfTimer = setInterval(refreshPerf, 1000);
      drawerReturn = document.activeElement;
      $('drawerClose').focus();
    } else if (drawerReturn && drawerReturn.focus) {
      drawerReturn.focus();
    }
  }
  $('advBtn').addEventListener('click', () => setDrawer(!$('drawer').classList.contains('open')));
  $('drawerClose').addEventListener('click', () => setDrawer(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('drawer').classList.contains('open') && !$('help').open) setDrawer(false);
  });

  // ---------------------------------------------------------------- help dialog
  const help = $('help');
  help.addEventListener('close', () => { store.set(HELP_KEY, '1'); $('helpBtn').focus(); });
  $('helpBtn').addEventListener('click', () => { if (!help.open) help.showModal(); });
  if (store.get(HELP_KEY) !== '1') help.showModal();

  renderConversation();

  // Read-only hooks for automated checks (no behaviour depends on them).
  window.V2 = {
    history: () => history.map((t) => ({ ...t })),
    sessionUnsure: () => sessionUnsure.map((t) => ({ ...t })),
    exportText: () => history.map((t) => `${hhmm(t.at)}  ${sideName(t.side)}: ${t.text}`).join('\r\n'),
  };
})();
