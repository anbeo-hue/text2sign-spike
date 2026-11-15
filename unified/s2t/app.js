import { loadModel } from "./lib/kaggleModel.js";
import { SignRecognizer, DEFAULT_RECO } from "./lib/signRecognizer.js";
import { GestureSegmenter } from "./lib/gestureSegmenter.js";
import { frameToKaggle64 } from "./lib/kaggleFormat.js";
import { buildRawFrame } from "./lib/liveAdapter.js";

const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35";
const HAND_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";
const poseUrl = (v) => `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${v}/float16/latest/pose_landmarker_${v}.task`;
// Offline copies (see vendor/mediapipe/MANIFEST.txt). Tried first; the network URLs above are the fallback.
const LOCAL = "vendor/mediapipe";
const LOCAL_HAND = `${LOCAL}/models/hand_landmarker.task`;
const localPose = (v) => `${LOCAL}/models/pose_landmarker_${v}.task`;
const LOCAL_WASM_FILES = ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_nosimd_internal.js", "vision_wasm_nosimd_internal.wasm"];
// Where each part actually came from: "cục bộ" | "mạng". Exposed for checks.
const sources = window.S2T_SOURCES = { "thư viện": null, wasm: null, pose: null, hand: null };
const SRC_LOCAL = "cục bộ", SRC_NET = "mạng";
function sourceLabel() {
  const parts = Object.entries(sources).filter(([, v]) => v);
  const net = parts.filter(([, v]) => v === SRC_NET).map(([k]) => k);
  if (!net.length) return `nguồn: ${SRC_LOCAL}`;
  if (net.length === parts.length) return `nguồn: ${SRC_NET}`;
  return `nguồn: ${SRC_LOCAL} + ${SRC_NET} (${SRC_NET}: ${net.join(", ")})`;
}
const readyText = () => `sẵn sàng · ${sourceLabel()}`;

async function localOk(paths) {
  try {
    const rs = await Promise.all(paths.map((p) => fetch(p, { method: "HEAD", cache: "no-store" })));
    return rs.every((r) => r.ok);
  } catch { return false; }
}
async function loadVisionBundle() {
  try { const m = await import(`./${LOCAL}/vision_bundle.mjs`); sources["thư viện"] = SRC_LOCAL; return m; }
  catch (e) { console.warn("vision_bundle cục bộ lỗi, dùng mạng:", e); }
  const m = await import(`${MP}/vision_bundle.mjs`); sources["thư viện"] = SRC_NET; return m;
}
async function makeFileset(preferLocal) {
  if (preferLocal && await localOk(LOCAL_WASM_FILES.map((f) => `${LOCAL}/wasm/${f}`))) {
    sources.wasm = SRC_LOCAL;
    return mp.FilesetResolver.forVisionTasks(new URL(`${LOCAL}/wasm`, location.href).href);
  }
  if (preferLocal) console.warn("wasm cục bộ thiếu, dùng mạng");
  sources.wasm = SRC_NET;
  return mp.FilesetResolver.forVisionTasks(`${MP}/wasm`);
}
// Local model first, then the network URL. If everything fails while the wasm is local, retry once with the network wasm.
async function makeLandmarkerWithFallback(key, Cls, localUrl, netUrl, extra) {
  const tryModels = async () => {
    try { const r = await makeLandmarker(Cls, localUrl, extra); sources[key] = SRC_LOCAL; return r; }
    catch (e) { console.warn(`${key}: mô hình cục bộ lỗi, dùng mạng:`, e); }
    const r = await makeLandmarker(Cls, netUrl, extra); sources[key] = SRC_NET; return r;
  };
  try { return await tryModels(); }
  catch (e) {
    if (sources.wasm !== SRC_LOCAL) throw e;
    console.warn(`${key}: lỗi với wasm cục bộ, thử wasm mạng:`, e);
    fileset = await makeFileset(false);
    return tryModels();
  }
}
const $ = (id) => document.getElementById(id);
const opts = { ...DEFAULT_RECO };
let model, reco, pose, hand, fileset, mp, running = false, signing = false, lastTs = 0, lastVideoTime = -1;
const lat = []; const stamps = [];

// Network failures (MediaPipe bundle from jsDelivr, .task models from Google Storage) get a plain message.
const NET_MSG = "Không tải được MediaPipe hoặc mô hình Pose. Trang này cần kết nối Internet (cdn.jsdelivr.net và storage.googleapis.com). Kiểm tra mạng rồi bấm lại.";
function setErr(e) {
  if (!e) { $("err").textContent = ""; return; } // clearing: no console.error("")
  const text = String(e && e.message ? e.message : e);
  const isNet = /Failed to fetch|dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(text);
  $("err").textContent = isNet ? `${NET_MSG}\n(chi tiết: ${text})` : text;
  console.error(e);
}
function syncSliders() { $("vc").textContent = opts.minConf.toFixed(2); $("vm").textContent = opts.minMargin.toFixed(2); }
$("conf").value = opts.minConf; $("margin").value = opts.minMargin; syncSliders();
$("conf").oninput = (e) => { opts.minConf = +e.target.value; syncSliders(); };
$("margin").oninput = (e) => { opts.minMargin = +e.target.value; syncSliders(); };

async function makeLandmarker(Cls, url, extra) {
  for (const delegate of ["GPU", "CPU"]) {
    try { return await Cls.createFromOptions(fileset, { baseOptions: { modelAssetPath: url, delegate }, runningMode: "VIDEO", ...extra }); }
    catch (e) { console.warn("delegate", delegate, "lỗi:", e); if (delegate === "CPU") throw e; }
  }
}
async function initPose() {
  if (pose) pose.close();
  const v = $("posemodel").value;
  pose = await makeLandmarkerWithFallback("pose", mp.PoseLandmarker, localPose(v), poseUrl(v), { numPoses: 1 });
}
$("posemodel").onchange = async () => { $("status").textContent = "đang đổi mô hình Pose…"; try { await initPose(); $("status").textContent = readyText(); } catch (e) { setErr(e); } };

$("start").onclick = async () => {
  $("start").disabled = true; setErr("");
  try {
    $("status").textContent = "đang tải mô hình nhận diện…";
    const man = await (await fetch("model/weights.json")).json();
    model = loadModel(man, await (await fetch("model/weights.bin")).arrayBuffer());
    reco = new SignRecognizer(model, opts);
    $("status").textContent = "đang tải MediaPipe (cục bộ trước, mạng dự phòng)…";
    mp = await loadVisionBundle();
    fileset = await makeFileset(true);
    await initPose(); hand = await makeLandmarkerWithFallback("hand", mp.HandLandmarker, LOCAL_HAND, HAND_URL, { numHands: 2 });
    $("status").textContent = "đang mở camera…";
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false });
    const v = $("video"); v.srcObject = stream; await v.play();
    running = true; $("status").textContent = readyText(); requestAnimationFrame(loop);
  } catch (e) { setErr(e); $("status").textContent = "lỗi"; $("start").disabled = false; }
};

function draw(raw) {
  const v = $("video"), c = $("overlay"); if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight; }
  const g = c.getContext("2d"); g.clearRect(0, 0, c.width, c.height);
  const dot = (p, col, r) => { g.fillStyle = col; g.beginPath(); g.arc(p[0] * c.width, p[1] * c.height, r, 0, 7); g.fill(); };
  if (raw.pose) { dot(raw.pose[15], "#fff", 6); dot(raw.pose[16], "#fff", 6); }
  if (raw.left) raw.left.forEach((p) => dot(p, "#4aa3ff", 3));
  if (raw.right) raw.right.forEach((p) => dot(p, "#ffa94a", 3));
}

function loop() {
  if (!running) return;
  const v = $("video");
  if (v.readyState >= 2 && v.currentTime !== lastVideoTime) {
    lastVideoTime = v.currentTime;
    const t0 = performance.now(); let ts = Math.floor(t0); if (ts <= lastTs) ts = lastTs + 1; lastTs = ts;
    try {
      const pr = pose.detectForVideo(v, ts), hr = hand.detectForVideo(v, ts);
      const raw = buildRawFrame(pr.landmarks && pr.landmarks[0] ? pr.landmarks[0] : null, hr.landmarks || []);
      const f = Float32Array.from(frameToKaggle64(raw));
      draw(raw);
      const y = GestureSegmenter.wristY(f); $("wy").textContent = y === null ? "mất người" : y.toFixed(2);
      const e = reco.push(f, ts); if (e) onEvent(e);
      lat.push(performance.now() - t0); stamps.push(t0); if (lat.length > 30) { lat.shift(); stamps.shift(); }
      if (stamps.length > 5) { $("fps").textContent = (1000 * (stamps.length - 1) / (stamps[stamps.length - 1] - stamps[0])).toFixed(0); $("lat").textContent = (lat.reduce((a, b) => a + b, 0) / lat.length).toFixed(0); }
    } catch (err) { setErr(err); running = false; return; }
  }
  requestAnimationFrame(loop);
}

function setSigning(on) { signing = on; $("rec").textContent = on ? "đang ghi cử chỉ" : "đang nghỉ"; $("rec").classList.toggle("on", on); }
function onEvent(e) {
  if (e.type === "start") { setSigning(true); return; }
  setSigning(false);
  if (e.type === "discard") { $("detail").textContent = `bỏ một cử chỉ (${e.reason})`; return; }
  const pct = (p) => (100 * p).toFixed(0) + "%";
  const w = $("word"); w.textContent = e.accepted ? e.gloss : "chưa chắc"; w.classList.toggle("unsure", !e.accepted);
  $("detail").textContent = `${e.accepted ? "độ tự tin" : `gần nhất: ${e.gloss}, độ tự tin`} ${pct(e.conf)} · chênh ${pct(e.margin)} · ${e.frames} khung, ${(e.durMs / 1000).toFixed(1)} s`;
  $("top3").innerHTML = e.top3.map((t) => `<div class="bar"><span>${t.gloss}</span><i style="width:${Math.round(150 * t.p)}px"></i><span>${pct(t.p)}</span></div>`).join("");
  const li = document.createElement("li"); li.className = e.accepted ? "ok" : "no";
  li.textContent = `${new Date().toLocaleTimeString("vi-VN")} — ${e.accepted ? e.gloss : "chưa chắc (" + e.gloss + ")"} ${pct(e.conf)}`;
  $("hist").prepend(li); while ($("hist").children.length > 30) $("hist").lastChild.remove();
}
