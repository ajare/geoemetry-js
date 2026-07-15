import { Vector2 } from './vector2.js';
import { BoundingBox, BoundingCircle } from './bounds.js';

export class AccelerationGrid {
  constructor(offset, size, cellsX, cellsY, padding = 0.001) { this.offset = Vector2.from(offset); this.size = Vector2.from(size); this.cellsX = cellsX; this.cellsY = cellsY; this.padding = padding; this.cells = Array.from({ length: cellsX * cellsY }, () => new Set()); this.itemCells = new Map(); this.moveCount = 0; }
  get cellSize() { return new Vector2(this.size.x / this.cellsX, this.size.y / this.cellsY); }
  _idx(x, y) { return y * this.cellsX + x; }
  _range(bounds) { const min = bounds.min.sub(this.offset), max = bounds.max.sub(this.offset), cs = this.cellSize; return { x0: Math.max(0, Math.min(this.cellsX - 1, Math.floor(min.x / cs.x))), y0: Math.max(0, Math.min(this.cellsY - 1, Math.floor(min.y / cs.y))), x1: Math.max(0, Math.min(this.cellsX - 1, Math.floor(max.x / cs.x))), y1: Math.max(0, Math.min(this.cellsY - 1, Math.floor(max.y / cs.y))) }; }
  addItem(id, bounds) { bounds = bounds instanceof BoundingBox ? bounds : bounds instanceof BoundingCircle ? bounds.bounds : new BoundingBox(bounds); const r = this._range(bounds); const set = new Set(); for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) { const idx = this._idx(x, y); this.cells[idx].add(id); set.add(idx); } this.itemCells.set(id, set); return this; }
  removeItem(id) { const set = this.itemCells.get(id); if (!set) return false; for (const idx of set) this.cells[idx].delete(id); this.itemCells.delete(id); return true; }
  moveItem(id, bounds) { this.removeItem(id); this.addItem(id, bounds); this.moveCount++; return this; }
  clear() { for (const c of this.cells) c.clear(); this.itemCells.clear(); return this; }
  getCandidateItemsInBoundingArea(area) { const bounds = area instanceof BoundingCircle ? area.bounds : area instanceof BoundingBox ? area : new BoundingBox(area); const r = this._range(bounds); const out = new Set(); for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) for (const id of this.cells[this._idx(x, y)]) out.add(id); return out; }
}
