import { Vector2, Winding } from './vector2.js';

export const LineIntersectionType = Object.freeze({ NotIntersecting: 'NotIntersecting', Intersecting: 'Intersecting', DoublyIntersecting: 'DoublyIntersecting', Inside: 'Inside' });
export const Side = Object.freeze({ Left: 'Left', Right: 'Right', On: 'On' });

export class LineHit {
  constructor(time = -1, position = Vector2.ZERO, normal = Vector2.ZERO, touching = false, flags = 0) { this.time = time; this.position = Vector2.from(position); this.normal = Vector2.from(normal); this.touching = touching; this.flags = flags; }
}
LineHit.Flags = Object.freeze({ None: 0, HitEnters: 1, HitExits: 2 });

export class MathsUtils {
  static Epsilon = 1e-5;
  static degrees(r) { return r * 180 / Math.PI; }
  static radians(d) { return d * Math.PI / 180; }
  static valueSign(v, eps = MathsUtils.Epsilon) { return v > eps ? 1 : (v < -eps ? -1 : 0); }
  static pointSideOnLine(p, a, b) { p = Vector2.from(p); a = Vector2.from(a); b = Vector2.from(b); const c = b.sub(a).cross(p.sub(a)); const s = MathsUtils.valueSign(c); return s > 0 ? Side.Left : (s < 0 ? Side.Right : Side.On); }
  static pointsWinding(points) { const area = MathsUtils.convexPolygonArea(points); return area > 0 ? Winding.Anticlockwise : (area < 0 ? Winding.Clockwise : Winding.Collinear); }
  static convexPolygonArea(points) { let a = 0; const p = points.map(Vector2.from); for (let i = 0; i < p.length; i++) a += p[i].cross(p[(i + 1) % p.length]); return a / 2; }
  static polygonIsConvex(points) { const p = points.map(Vector2.from); if (p.length < 3) return false; let sign = 0; for (let i = 0; i < p.length; i++) { const c = p[(i + 1) % p.length].sub(p[i]).cross(p[(i + 2) % p.length].sub(p[(i + 1) % p.length])); const s = MathsUtils.valueSign(c); if (s && sign && s !== sign) return false; if (s) sign = s; } return true; }
  static pointInTriangle(p, a, b, c) { p = Vector2.from(p); a = Vector2.from(a); b = Vector2.from(b); c = Vector2.from(c); const s1 = MathsUtils.pointSideOnLine(p, a, b), s2 = MathsUtils.pointSideOnLine(p, b, c), s3 = MathsUtils.pointSideOnLine(p, c, a); return !(s1 === Side.Left || s2 === Side.Left || s3 === Side.Left) || !(s1 === Side.Right || s2 === Side.Right || s3 === Side.Right); }
  static pointInPolygon(point, points) { const p = Vector2.from(point), poly = points.map(Vector2.from); let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const pi = poly[i], pj = poly[j]; if (((pi.y > p.y) !== (pj.y > p.y)) && (p.x < (pj.x - pi.x) * (p.y - pi.y) / (pj.y - pi.y) + pi.x)) inside = !inside; } return inside; }
  static boxIntersectsCircle(min, max, c, r) { min = Vector2.from(min); max = Vector2.from(max); c = Vector2.from(c); const x = Math.max(min.x, Math.min(c.x, max.x)); const y = Math.max(min.y, Math.min(c.y, max.y)); return c.distanceToSq(new Vector2(x, y)) <= r * r; }
  static lineLineIntersection(a, b, c, d, hit = null) { a = Vector2.from(a); b = Vector2.from(b); c = Vector2.from(c); d = Vector2.from(d); const r = b.sub(a), s = d.sub(c); const den = r.cross(s); const qp = c.sub(a); if (Math.abs(den) < MathsUtils.Epsilon) return LineIntersectionType.NotIntersecting; const t = qp.cross(s) / den; const u = qp.cross(r) / den; if (t >= -MathsUtils.Epsilon && t <= 1 + MathsUtils.Epsilon && u >= -MathsUtils.Epsilon && u <= 1 + MathsUtils.Epsilon) { if (hit) { hit.time = t; hit.position = a.add(r.mul(t)); hit.normal = s.perpendicular().normalised(); hit.touching = t <= MathsUtils.Epsilon || t >= 1 - MathsUtils.Epsilon; } return LineIntersectionType.Intersecting; } return LineIntersectionType.NotIntersecting; }
  static lineIntersectsLine(a, b, c, d) { return MathsUtils.lineLineIntersection(a, b, c, d); }
  static lineIntersectsBox(a, b, min, max) { min = Vector2.from(min); max = Vector2.from(max); const corners = [min, new Vector2(max.x, min.y), max, new Vector2(min.x, max.y)]; if (MathsUtils.pointInBox(a, min, max) || MathsUtils.pointInBox(b, min, max)) return LineIntersectionType.Inside; for (let i = 0; i < 4; i++) if (MathsUtils.lineLineIntersection(a, b, corners[i], corners[(i + 1) % 4]) !== LineIntersectionType.NotIntersecting) return LineIntersectionType.Intersecting; return LineIntersectionType.NotIntersecting; }
  static pointInBox(p, min, max) { p = Vector2.from(p); min = Vector2.from(min); max = Vector2.from(max); return p.x >= min.x && p.x <= max.x && p.y >= min.y && p.y <= max.y; }
  static lineIntersectsCircle(a, b, c, r) { a = Vector2.from(a); b = Vector2.from(b); c = Vector2.from(c); return c.distanceToLineSq(a, b) <= r * r ? LineIntersectionType.Intersecting : LineIntersectionType.NotIntersecting; }
  static getPolygonBounds(points) { const xs = points.map(p => p.x), ys = points.map(p => p.y); return { min: new Vector2(Math.min(...xs), Math.min(...ys)), max: new Vector2(Math.max(...xs), Math.max(...ys)) }; }
  static convexHull(points) {
    const pts = points.map(Vector2.from).sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
    if (pts.length <= 1) return pts;
    const cross = (o, a, b) => a.sub(o).cross(b.sub(o));
    const lower = [];
    for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= MathsUtils.Epsilon) lower.pop(); lower.push(p); }
    const upper = [];
    for (let i = pts.length - 1; i >= 0; --i) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= MathsUtils.Epsilon) upper.pop(); upper.push(p); }
    upper.pop(); lower.pop(); return lower.concat(upper);
  }
  static polygonsIntersect(a, b) {
    a = a.map(Vector2.from); b = b.map(Vector2.from);
    for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) if (MathsUtils.lineLineIntersection(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length]) !== LineIntersectionType.NotIntersecting) return true;
    return MathsUtils.pointInPolygon(a[0], b) || MathsUtils.pointInPolygon(b[0], a);
  }
  static clipPolygonAgainstPolygon(subject, clipper) {
    let output = subject.map(Vector2.from);
    const clip = clipper.map(Vector2.from);
    const ccw = MathsUtils.convexPolygonArea(clip) >= 0;
    const inside = (p, a, b) => ccw ? b.sub(a).cross(p.sub(a)) >= -MathsUtils.Epsilon : b.sub(a).cross(p.sub(a)) <= MathsUtils.Epsilon;
    const intersection = (s, e, a, b) => { const hit = new LineHit(); return MathsUtils.lineLineIntersection(s, e, a, b, hit) === LineIntersectionType.NotIntersecting ? e : hit.position; };
    for (let i = 0; i < clip.length && output.length; i++) {
      const a = clip[i], b = clip[(i + 1) % clip.length], input = output; output = [];
      for (let j = 0; j < input.length; j++) {
        const s = input[(j + input.length - 1) % input.length], e = input[j];
        if (inside(e, a, b)) { if (!inside(s, a, b)) output.push(intersection(s, e, a, b)); output.push(e); }
        else if (inside(s, a, b)) output.push(intersection(s, e, a, b));
      }
    }
    return output;
  }
}
