const toPts = (a) => a.map((p) => [p.x, p.y, p.z]);
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function buildRawFrame(pose, hands) {
    const hs = hands.filter((h) => h && h.length === 21).slice(0, 2);
    let left = null, right = null;
    if (hs.length === 1) {
        const h = hs[0];
        // không có pose: người ký đứng trước camera không lật, tay trái của họ nằm bên phải ảnh (x lớn)
        const toLeft = pose ? d2(h[0], pose[15]) <= d2(h[0], pose[16]) : h[0].x > 0.5;
        if (toLeft)
            left = h;
        else
            right = h;
    }
    else if (hs.length === 2) {
        const [a, b] = hs;
        let aLeft;
        if (pose)
            aLeft = d2(a[0], pose[15]) + d2(b[0], pose[16]) <= d2(a[0], pose[16]) + d2(b[0], pose[15]);
        else
            aLeft = a[0].x > b[0].x;
        left = aLeft ? a : b;
        right = aLeft ? b : a;
    }
    return { pose: pose && pose.length >= 33 ? toPts(pose) : null, left: left ? toPts(left) : null, right: right ? toPts(right) : null };
}
