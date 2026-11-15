// Sentence suggestion for the sign -> text side (optional, off until configured).
// The recogniser only outputs isolated words. This module asks an OpenAI-compatible
// chat endpoint to join them into ONE short Vietnamese sentence, then checks the
// answer: every recognised word must still be there, in order, and any extra
// syllable must be a function word from ALLOWED. Anything else (no config, network
// error, timeout, bad answer) falls back to the raw word sequence.
// The result is a Vietnamese-language suggestion, NOT a VSL-grammar translation.
(function (root) {
  'use strict';

  const MAX_WORDS = 12;
  const TIMEOUT_MS = 12000;
  let RETRY_WAIT_MS = 1200;
  // Function words the model may add. Content words are never allowed.
  const ALLOWED = ['là', 'đang', 'đã', 'sẽ', 'của', 'và', 'với', 'ở', 'thì', 'rồi', 'không', 'ạ', 'nhé', 'à', 'cho', 'một', 'rất', 'cũng', 'vì', 'nên', 'nhưng'];

  const SYSTEM_PROMPT = [
    'Bạn nhận một chuỗi từ tiếng Việt do hệ thống nhận diện ký hiệu tạo ra, theo đúng thứ tự người ký.',
    'Nhiệm vụ: viết thành MỘT câu tiếng Việt ngắn, tự nhiên.',
    'Quy tắc:',
    '- Giữ nguyên tất cả các từ đã cho, đúng thứ tự. Không thêm danh từ, động từ, tính từ mới.',
    `- Chỉ được thêm các từ sau: ${ALLOWED.join(', ')}.`,
    '- Nếu chuỗi từ vô nghĩa hoặc mâu thuẫn, chỉ trả lại các từ nối bằng dấu cách, không đoán.',
    '- Chỉ trả về câu, không giải thích, không dấu ngoặc kép.',
  ].join('\n');

  const norm = (s) => String(s).normalize('NFC').toLowerCase();
  // Syllables only: letters (with Vietnamese diacritics) and digits; punctuation is dropped.
  const syllables = (s) => norm(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

  function rawJoin(words) {
    return words.map((w) => String(w).trim()).filter(Boolean).join(' ');
  }

  function buildMessages(words) {
    return [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Chuỗi từ: ${words.join(', ')}` },
    ];
  }

  // Returns { ok: true } or { ok: false, reason }.
  function validate(words, sentence) {
    if (typeof sentence !== 'string') return { ok: false, reason: 'câu trả lời trống' };
    const text = sentence.trim();
    if (!text) return { ok: false, reason: 'câu trả lời trống' };
    if (text.length > 200 || /[\r\n]/.test(text)) return { ok: false, reason: 'câu trả lời quá dài' };
    const out = syllables(text);
    const used = new Array(out.length).fill(false);
    let from = 0;
    for (const w of words) {
      const ws = syllables(w);
      if (!ws.length) continue;
      let at = -1;
      for (let i = from; i + ws.length <= out.length; i++) {
        if (ws.every((s, k) => out[i + k] === s)) { at = i; break; }
      }
      if (at < 0) return { ok: false, reason: `thiếu hoặc đổi thứ tự từ "${w}"` };
      for (let k = 0; k < ws.length; k++) used[at + k] = true;
      from = at + ws.length;
    }
    const allowed = new Set(ALLOWED.map(norm));
    const extra = out.filter((s, i) => !used[i] && !allowed.has(s));
    if (extra.length) return { ok: false, reason: `thêm từ ngoài danh sách cho phép: ${extra.join(', ')}` };
    return { ok: true };
  }

  async function callApi(cfg, body, fetchImpl, signal) {
    const res = await fetchImpl(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify(body),
      signal,
    });
    return res;
  }

  // Always resolves. { text, source: 'ai' | 'raw', reason? }
  async function compose(words, cfg, fetchImpl) {
    const list = (words || []).map((w) => String(w).trim()).filter(Boolean).slice(0, MAX_WORDS);
    const raw = rawJoin(list);
    const fallback = (reason) => ({ text: raw, source: 'raw', reason });
    if (!list.length) return fallback('chưa có từ nào');
    if (list.length < 2) return fallback('chỉ có một từ');
    if (!cfg || !cfg.endpoint || !cfg.model || !cfg.key) return fallback('chưa cấu hình AI');
    const f = fetchImpl || (typeof fetch === 'function' ? fetch.bind(root) : null);
    if (!f) return fallback('trình duyệt không có fetch');
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), TIMEOUT_MS) : null;
    try {
      // reasoning_effort 'low': a thinking model answers this tiny task faster.
      const body = { model: cfg.model, messages: buildMessages(list), temperature: 0.2, reasoning_effort: 'low' };
      let res = await callApi(cfg, body, f, ctl && ctl.signal);
      if (res.status === 400) {
        // Some models reject temperature or reasoning_effort: retry once with the bare request.
        delete body.temperature;
        delete body.reasoning_effort;
        res = await callApi(cfg, body, f, ctl && ctl.signal);
      }
      if ([429, 500, 502, 503].includes(res.status)) {
        // Busy or overloaded service: wait a moment and try once more (still inside the 8 s limit).
        await new Promise((r) => setTimeout(r, RETRY_WAIT_MS));
        res = await callApi(cfg, body, f, ctl && ctl.signal);
      }
      if (!res.ok) return fallback(`dịch vụ AI trả lỗi ${res.status}${res.status === 503 || res.status === 429 ? ' (đang quá tải hoặc hết lượt, thử lại sau hoặc đổi mô hình)' : ''}`);
      const data = await res.json();
      const msg = data && data.choices && data.choices[0] && data.choices[0].message;
      const text = msg && typeof msg.content === 'string' ? msg.content.trim().replace(/^["“]|["”]$/g, '') : '';
      const v = validate(list, text);
      if (!v.ok) return fallback(`AI trả lời không hợp lệ (${v.reason})`);
      return { text, source: 'ai' };
    } catch (e) {
      return fallback(e && e.name === 'AbortError' ? `AI không trả lời kịp (quá ${TIMEOUT_MS / 1000} giây)` : 'không gọi được dịch vụ AI');
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  root.VSLSentence = { setRetryWaitMs(ms) { RETRY_WAIT_MS = ms; }, MAX_WORDS, TIMEOUT_MS, ALLOWED, SYSTEM_PROMPT, rawJoin, buildMessages, validate, compose };
})(typeof window !== 'undefined' ? window : globalThis);
