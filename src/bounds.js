import { Vector2 } from './vector2.js';
import { MathsUtils } from './maths.js';

export class BoundingBox {
  constructor(position = Vector2.ZERO, size = Vector2.ZERO) {
    if (Array.isArray(position)) {
      const pts = position.map(Vector2.from);
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
      const min = new Vector2(Math.min(...xs), Math.min(...ys));
      const max = new Vector2(Math.max(...xs), Math.max(...ys));
      this.position = min; this.size = max.sub(min);
    } else { this.position = Vector2.from(position); this.size = Vector2.from(size); }
  }
  static fromExtents(min, max) { min = Vector2.from(min); max = Vector2.from(max); return new BoundingBox(min, max.sub(min)); }
  clone() { return new BoundingBox(this.position, this.size); }
  get min() { return this.position.clone(); }
  get max() { return this.position.add(this.size); }
  get centre() { return this.position.add(this.size.mul(0.5)); }
  get halfSize() { return this.size.mul(0.5); }
  get width() { return this.size.x; }
  get height() { return this.size.y; }
  setPosition(p) { this.position = Vector2.from(p); return this; }
  setSize(s) { this.size = Vector2.from(s); return this; }
  move(d) { this.position = this.position.add(d); return this; }
  expand(amount) { const a = typeof amount === 'number' ? new Vector2(amount, amount) : Vector2.from(amount); this.position = this.position.sub(a); this.size = this.size.add(a.mul(2)); return this; }
  pointInside(p) { p = Vector2.from(p); const min = this.min, max = this.max; return p.x >= min.x && p.y >= min.y && p.x <= max.x && p.y <= max.y; }
  intersectsBox(other) { other = other instanceof BoundingBox ? other : new BoundingBox(other); const a0 = this.min, a1 = this.max, b0 = other.min, b1 = other.max; return a0.x <= b1.x && a1.x >= b0.x && a0.y <= b1.y && a1.y >= b0.y; }
  intersectsCircle(circle) { return MathsUtils.boxIntersectsCircle(this.min, this.max, circle.position, circle.radius); }
  intersectsLine(a, b) { return MathsUtils.lineIntersectsBox(a, b, this.min, this.max) !== 'NotIntersecting'; }
  union(other) { other = other instanceof BoundingBox ? other : new BoundingBox(other); const min = new Vector2(Math.min(this.min.x, other.min.x), Math.min(this.min.y, other.min.y)); const max = new Vector2(Math.max(this.max.x, other.max.x), Math.max(this.max.y, other.max.y)); return BoundingBox.fromExtents(min, max); }
}

export class BoundingCircle {
  constructor(position = Vector2.ZERO, radius = 0) { this.position = Vector2.from(position); this.radius = Number(radius); }
  clone() { return new BoundingCircle(this.position, this.radius); }
  get min() { return new Vector2(this.position.x - this.radius, this.position.y - this.radius); }
  get max() { return new Vector2(this.position.x + this.radius, this.position.y + this.radius); }
  get bounds() { return BoundingBox.fromExtents(this.min, this.max); }
  setPosition(p) { this.position = Vector2.from(p); return this; }
  setRadius(r) { this.radius = Number(r); return this; }
  move(d) { this.position = this.position.add(d); return this; }
  pointInside(p) { return this.position.distanceToSq(p) <= this.radius * this.radius; }
  intersectsCircle(other) { return this.position.distanceToSq(other.position) <= (this.radius + other.radius) ** 2; }
  intersectsBox(box) { return box.intersectsCircle(this); }
  intersectsLine(a, b) { return MathsUtils.lineIntersectsCircle(a, b, this.position, this.radius) !== 'NotIntersecting'; }
}
