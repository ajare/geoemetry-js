export const Winding = Object.freeze({ Clockwise: 'Clockwise', Anticlockwise: 'Anticlockwise', Collinear: 'Collinear' });

export class Vector2 {
  constructor(x = 0, y = 0) {
    if (typeof x === 'object' && x !== null) { this.x = Number(x.x ?? 0); this.y = Number(x.y ?? 0); }
    else { this.x = Number(x); this.y = Number(y); }
  }

  static get ZERO() { return new Vector2(0, 0); }
  static get ONE() { return new Vector2(1, 1); }
  static get UNIT_X() { return new Vector2(1, 0); }
  static get UNIT_Y() { return new Vector2(0, 1); }
  static from(value) { return value instanceof Vector2 ? value.clone() : new Vector2(value); }
  static fromAngle(angleDeg, winding = Winding.Anticlockwise) {
    const a = angleDeg * Math.PI / 180;
    return winding === Winding.Clockwise ? new Vector2(Math.sin(a), Math.cos(a)) : new Vector2(Math.cos(a), Math.sin(a));
  }

  clone() { return new Vector2(this.x, this.y); }
  set(x, y) { if (typeof x === 'object') { this.x = Number(x.x); this.y = Number(x.y); } else { this.x = Number(x); this.y = Number(y); } return this; }
  equals(v, eps = 0) { v = Vector2.from(v); return eps ? Math.abs(this.x - v.x) <= eps && Math.abs(this.y - v.y) <= eps : this.x === v.x && this.y === v.y; }
  add(v) { v = Vector2.from(v); return new Vector2(this.x + v.x, this.y + v.y); }
  sub(v) { v = Vector2.from(v); return new Vector2(this.x - v.x, this.y - v.y); }
  mul(v) { return typeof v === 'number' ? new Vector2(this.x * v, this.y * v) : new Vector2(this.x * v.x, this.y * v.y); }
  div(v) { return typeof v === 'number' ? new Vector2(this.x / v, this.y / v) : new Vector2(this.x / v.x, this.y / v.y); }
  neg() { return new Vector2(-this.x, -this.y); }
  dot(v) { v = Vector2.from(v); return this.x * v.x + this.y * v.y; }
  cross(v) { v = Vector2.from(v); return this.x * v.y - this.y * v.x; }
  lengthSq() { return this.x * this.x + this.y * this.y; }
  length() { return Math.hypot(this.x, this.y); }
  distanceTo(v) { return this.sub(v).length(); }
  distanceToSq(v) { return this.sub(v).lengthSq(); }
  normalize() { const l = this.length(); if (l > 0) { this.x /= l; this.y /= l; } return this; }
  normalised() { return this.clone().normalize(); }
  directionTo(v) { return Vector2.from(v).sub(this).normalised(); }
  perpendicular() { return new Vector2(-this.y, this.x); }
  lerp(v, t) { v = Vector2.from(v); return new Vector2(this.x + (v.x - this.x) * t, this.y + (v.y - this.y) * t); }
  invLerp(v, p) { v = Vector2.from(v); p = Vector2.from(p); const d = this.distanceTo(v); return d === 0 ? 0 : this.distanceTo(p) / d; }
  clockwiseAngle() { let a = Math.atan2(this.x, this.y) * 180 / Math.PI; return a < 0 ? a + 360 : a; }
  angleTo(v) { v = Vector2.from(v); const a = Math.atan2(this.cross(v), this.dot(v)) * 180 / Math.PI; return a; }
  minimumAngleTo(v) { const a = Math.abs(this.angleTo(v)); return a > 180 ? 360 - a : a; }
  rotated(deg) { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return new Vector2(this.x * c - this.y * s, this.x * s + this.y * c); }
  rotatedClockwise(deg) { return this.rotated(-deg); }
  rotateAround(origin, deg) { origin = Vector2.from(origin); return origin.add(this.sub(origin).rotated(deg)); }
  closestPointOnLine(a, b) { a = Vector2.from(a); b = Vector2.from(b); const ab = b.sub(a); const l2 = ab.lengthSq(); if (!l2) return a; const t = Math.max(0, Math.min(1, this.sub(a).dot(ab) / l2)); return a.lerp(b, t); }
  distanceToLine(a, b) { return this.distanceTo(this.closestPointOnLine(a, b)); }
  distanceToLineSq(a, b) { return this.distanceToSq(this.closestPointOnLine(a, b)); }
  toArray() { return [this.x, this.y]; }
  toJSON() { return { x: this.x, y: this.y }; }
}
