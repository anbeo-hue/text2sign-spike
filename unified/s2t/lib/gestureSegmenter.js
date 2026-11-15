export const DEFAULT_SEG = { enterY: 0.15, exitY: 0.22, minActiveMs: 150, endHoldMs: 600, minSignMs: 500, maxSignMs: 8000, preRollMs: 250, tailMs: 100 };
const NF = 76 * 3;
export class GestureSegmenter {
    o;
    state = "idle";
    ring = [];
    seg = [];
    runStart = null;
    lastActive = 0;
    restStart = null;
    constructor(opts = {}) { this.o = { ...DEFAULT_SEG, ...opts }; }
    /** y cổ tay cao nhất của hai tay, hoặc null nếu mất toàn thân. */
    static wristY(f) {
        let any = false;
        for (let i = 0; i < 34 * 3; i++)
            if (f[i] !== 0) {
                any = true;
                break;
            }
        if (!any)
            return null;
        return Math.min(f[15 * 3 + 1], f[16 * 3 + 1]);
    }
    reset() { this.state = "idle"; this.ring = []; this.seg = []; this.runStart = null; this.restStart = null; }
    push(frame, tMs) {
        if (frame.length !== NF)
            throw new Error("khung phải có 76*3 giá trị");
        const y = GestureSegmenter.wristY(frame);
        const fr = { f: frame.slice(), t: tMs };
        const o = this.o;
        if (this.state === "locked") { // đang chờ hạ tay sau một cử chỉ quá dài
            if (y !== null && y >= o.exitY) {
                this.restStart ??= tMs;
                if (tMs - this.restStart >= o.endHoldMs)
                    this.reset();
            }
            else
                this.restStart = null;
            return null;
        }
        if (this.state === "idle") {
            this.ring.push(fr);
            while (this.ring.length && tMs - this.ring[0].t > o.preRollMs + o.minActiveMs + 200)
                this.ring.shift();
            if (y !== null && y < o.enterY) {
                this.runStart ??= tMs;
                if (tMs - this.runStart >= o.minActiveMs) {
                    this.seg = this.ring.filter((r) => r.t >= this.runStart - o.preRollMs);
                    this.state = "signing";
                    this.lastActive = tMs;
                    this.ring = [];
                    return { kind: "start", tMs: this.seg[0].t };
                }
            }
            else
                this.runStart = null;
            return null;
        }
        // signing
        this.seg.push(fr);
        if (y !== null && y < o.exitY)
            this.lastActive = tMs;
        if (tMs - this.seg[0].t > o.maxSignMs) {
            const d = tMs - this.seg[0].t;
            this.seg = [];
            this.state = "locked";
            this.restStart = null;
            return { kind: "discard", reason: "quá dài", durMs: d };
        }
        if (tMs - this.lastActive >= o.endHoldMs) {
            const keep = this.seg.filter((r) => r.t <= this.lastActive + o.tailMs);
            const start = keep[0].t, end = keep[keep.length - 1].t, dur = this.lastActive - start;
            this.seg = [];
            this.state = "idle";
            this.runStart = null;
            this.ring = [];
            if (dur < o.minSignMs)
                return { kind: "discard", reason: "quá ngắn", durMs: dur };
            const out = new Float32Array(keep.length * NF);
            keep.forEach((r, i) => out.set(r.f, i * NF));
            return { kind: "segment", frames: out, n: keep.length, startMs: start, endMs: end };
        }
        return null;
    }
}
