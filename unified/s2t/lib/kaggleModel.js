const BODY_IDX = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
export function loadModel(man, bin) {
    const all = new Float32Array(bin); // little-endian (mọi trình duyệt phổ biến)
    const get = (n) => {
        const t = man.tensors.find((x) => x.name === n);
        if (!t)
            throw new Error("thiếu tensor " + n);
        return { a: all.subarray(t.offset, t.offset + t.length), shape: t.shape };
    };
    const layers = ["fc1", "fc2", "fc3"].map((n) => {
        const w = get(n + ".weight"), b = get(n + ".bias");
        return { w: w.a, b: b.a, nOut: w.shape[0], nIn: w.shape[1] };
    });
    const dim = man.T * 152;
    if (layers[0].nIn !== dim)
        throw new Error("kích thước đặc trưng không khớp");
    return { glosses: man.glosses, T: man.T, dim, zClip: man.z_clip, mu: get("mu").a, sd: get("sd").a, layers };
}
function roundHalfEven(x) {
    const f = Math.floor(x), d = x - f;
    if (d < 0.5)
        return f;
    if (d > 0.5)
        return f + 1;
    return f % 2 === 0 ? f : f + 1; // giống numpy.round
}
/** frames: Float32Array (nFrames*76*3). Trả về vector T*152, giống clip_features của Python. */
export function featuresFromClip(frames, nFrames, T) {
    const out = new Float32Array(T * 152);
    const step = T > 1 ? (nFrames - 1) / (T - 1) : 0; // numpy.linspace
    for (let t = 0; t < T; t++) {
        const pos = t === T - 1 ? nFrames - 1 : t * step;
        const fi = Math.min(nFrames - 1, Math.max(0, roundHalfEven(pos)));
        const base = fi * 76 * 3;
        let o = t * 152;
        for (const i of BODY_IDX) {
            out[o++] = frames[base + i * 3];
            out[o++] = frames[base + i * 3 + 1];
        }
        const flag = [0, 0];
        for (let side = 0; side < 2; side++) {
            let abs = 0;
            for (let k = 0; k < 21; k++) {
                const j = base + (34 + 2 * k + side) * 3;
                for (let c = 0; c < 3; c++) {
                    out[o++] = frames[j + c];
                    abs += Math.abs(frames[j + c]);
                }
            }
            flag[side] = abs > 0 ? 1 : 0;
        }
        out[o++] = flag[0];
        out[o++] = flag[1];
    }
    return out;
}
function linear(w, b, nOut, nIn, x, relu) {
    const y = new Float64Array(nOut);
    for (let i = 0; i < nOut; i++) {
        let s = b[i];
        const r = i * nIn;
        for (let j = 0; j < nIn; j++)
            s += w[r + j] * x[j];
        y[i] = relu && s < 0 ? 0 : s;
    }
    return y;
}
export function predictFromFeatures(m, feat) {
    const z = new Float64Array(m.dim);
    for (let i = 0; i < m.dim; i++)
        z[i] = Math.max(-m.zClip, Math.min(m.zClip, (feat[i] - m.mu[i]) / m.sd[i]));
    let h = z;
    m.layers.forEach((L, i) => { h = linear(L.w, L.b, L.nOut, L.nIn, h, i < 2); });
    const logits = Float32Array.from(h);
    let mx = -Infinity;
    for (const v of h)
        if (v > mx)
            mx = v;
    const probs = new Float32Array(h.length);
    let sum = 0;
    for (let i = 0; i < h.length; i++) {
        probs[i] = Math.exp(h[i] - mx);
        sum += probs[i];
    }
    let top = 0, second = -1;
    for (let i = 0; i < probs.length; i++) {
        probs[i] /= sum;
        if (probs[i] > probs[top])
            top = i;
    }
    for (let i = 0; i < probs.length; i++)
        if (i !== top && (second < 0 || probs[i] > probs[second]))
            second = i;
    return { logits, probs, top, gloss: m.glosses[top], conf: probs[top], margin: probs[top] - probs[second] };
}
export function predictClip(m, frames, nFrames) {
    return predictFromFeatures(m, featuresFromClip(frames, nFrames, m.T));
}
