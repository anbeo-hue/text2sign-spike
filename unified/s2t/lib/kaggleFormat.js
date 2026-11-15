export const HAND_ORDER = [0, 8, 7, 6, 5, 12, 11, 10, 9, 16, 15, 14, 13, 20, 19, 18, 17, 4, 3, 2, 1];
export const N_POINTS = 76;
const NECK = 33, LSHO = 11, RSHO = 12, LHIP = 23, RHIP = 24, NOSE = 0;
const ANCHORS = [NOSE, LSHO, RSHO, LHIP, RHIP, NECK];
const BOX_SCALE = 1.6;
function bodyNorm(o) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const i of ANCHORS) {
        const x = o[i * 3], y = o[i * 3 + 1];
        if (x !== 0) {
            if (x < minX)
                minX = x;
            if (x > maxX)
                maxX = x;
        }
        if (y !== 0) {
            if (y < minY)
                minY = y;
            if (y > maxY)
                maxY = y;
        }
    }
    if (minX === Infinity || minY === Infinity)
        return;
    const dx = (maxX - minX) * BOX_SCALE, dy = (maxY - minY) * BOX_SCALE;
    if (!(dx > 0) || !(dy > 0))
        return;
    const bx = (maxX + minX) / 2 - dx / 2, by = (maxY + minY) / 2 - dy / 2;
    for (let i = 0; i < 34; i++) {
        const x = o[i * 3], y = o[i * 3 + 1];
        if (x === 0 && y === 0)
            continue;
        o[i * 3] = (x - bx) / dx - 0.5;
        o[i * 3 + 1] = (y - by) / dy - 0.5;
    }
}
function handNorm(o, side) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let k = 0; k < 21; k++) {
        const j = 34 + 2 * k + side, x = o[j * 3], y = o[j * 3 + 1];
        if (x !== 0) {
            if (x < minX)
                minX = x;
            if (x > maxX)
                maxX = x;
        }
        if (y !== 0) {
            if (y < minY)
                minY = y;
            if (y > maxY)
                maxY = y;
        }
    }
    if (minX === Infinity || minY === Infinity)
        return;
    const dx = maxX - minX, dy = maxY - minY;
    if (!(dx > 0) || !(dy > 0))
        return;
    for (let k = 0; k < 21; k++) {
        const j = 34 + 2 * k + side, x = o[j * 3], y = o[j * 3 + 1];
        if (x === 0 && y === 0)
            continue;
        o[j * 3] = (x - minX) / dx - 0.5;
        o[j * 3 + 1] = (y - minY) / dy - 0.5;
    }
}
/** Một khung -> Float64Array(76*3) (chưa ép Float32, để test so sánh chính xác). */
export function frameToKaggle64(f) {
    const o = new Float64Array(N_POINTS * 3);
    if (f.pose) {
        for (let i = 0; i < 33; i++)
            for (let c = 0; c < 3; c++)
                o[i * 3 + c] = f.pose[i][c] ?? 0;
        for (let c = 0; c < 3; c++)
            o[NECK * 3 + c] = (o[LSHO * 3 + c] + o[RSHO * 3 + c]) / 2;
    }
    const hands = [f.left, f.right];
    for (let side = 0; side < 2; side++) {
        const h = hands[side];
        if (!h)
            continue;
        for (let k = 0; k < 21; k++)
            for (let c = 0; c < 3; c++)
                o[(34 + 2 * k + side) * 3 + c] = h[HAND_ORDER[k]][c] ?? 0;
    }
    bodyNorm(o);
    handNorm(o, 0);
    handNorm(o, 1);
    return o;
}
/** Nhiều khung -> Float32Array(T*76*3), giống mảng (T,76,3) của .npy. */
export function framesToKaggle(frames) {
    const out = new Float32Array(frames.length * N_POINTS * 3);
    frames.forEach((f, t) => out.set(frameToKaggle64(f), t * N_POINTS * 3));
    return out;
}
