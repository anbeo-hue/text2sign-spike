/** Ghép: khung Kaggle -> cắt cử chỉ -> mạng -> ngưỡng tự tin. Chưa nối camera; đầu vào là từng khung đã đổi sang 76 điểm. */
import { GestureSegmenter } from "./gestureSegmenter.js";
import { predictClip } from "./kaggleModel.js";
// Ngưỡng chọn trên tập VAL của Kaggle (conf>=0.7, margin>=0.3: val đúng 100% ở 85% số clip). Camera thật có thể cần chỉnh.
export const DEFAULT_RECO = { minConf: 0.7, minMargin: 0.3 };
export class SignRecognizer {
    seg;
    model;
    opt;
    constructor(model, opt = DEFAULT_RECO) { this.model = model; this.opt = opt; this.seg = new GestureSegmenter(opt.seg); }
    reset() { this.seg.reset(); }
    push(frame, tMs) {
        const e = this.seg.push(frame, tMs);
        if (!e)
            return null;
        if (e.kind === "start")
            return { type: "start" };
        if (e.kind === "discard")
            return { type: "discard", reason: e.reason };
        const p = predictClip(this.model, e.frames, e.n);
        const order = Array.from(p.probs.keys()).sort((a, b) => p.probs[b] - p.probs[a]).slice(0, 3);
        return { type: "word", accepted: p.conf >= this.opt.minConf && p.margin >= this.opt.minMargin, gloss: p.gloss, conf: p.conf, margin: p.margin,
            top3: order.map((i) => ({ gloss: this.model.glosses[i], p: p.probs[i] })), durMs: e.endMs - e.startMs, frames: e.n };
    }
}
