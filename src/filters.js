import { BoundingBox, BoundingCircle } from './bounds.js';
import { Edge } from './topology.js';

export class Filter {
  constructor(meshOrPredicate = null) {
    this.mesh = typeof meshOrPredicate === 'function' ? null : meshOrPredicate;
    this.indices = new Set();
    this.predicate = typeof meshOrPredicate === 'function' ? meshOrPredicate : null;
  }
  matches(...args) { return this.predicate ? !!this.predicate(...args) : true; }
  getIndices() { return new Set(this.indices); }
  setIndices(indices) { this.indices = new Set(indices); return this; }
  addIndices(indices) { for (const i of indices) this.indices.add(i); return this; }
  removeIndices(indices) { for (const i of indices) this.indices.delete(i); return this; }
  filter(fn) { for (const i of [...this.indices]) if (!fn(i)) this.indices.delete(i); return this; }
  minElement(compare) { if (!this.indices.size) return this; let best = [...this.indices][0]; for (const i of this.indices) if (compare(i, best)) best = i; this.indices = new Set([best]); return this; }
  maxElement(compare) { return this.minElement((a, b) => compare(b, a)); }
}

export class VertexFilter extends Filter {
  static byAttribute(name, value) { return new VertexFilter(v => v.attributes?.[name] === value); }
  selectVertices(indices) { return this.setIndices(indices); }
  addVertices(indices) { return this.addIndices(indices); }
  selectEdgeVertices(edgeId) { return this.setIndices(this.mesh.getEdge(edgeId).vertices); }
  addEdgeVertices(edgeId) { return this.addIndices(this.mesh.getEdge(edgeId).vertices); }
  selectPolygonVertices(polyId) { return this.setIndices(this.mesh.getPolygon(polyId).getVertexIndexSet()); }
  addPolygonVertices(polyId) { return this.addIndices(this.mesh.getPolygon(polyId).getVertexIndexSet()); }
  selectInBounds(bounds) { const b = bounds instanceof BoundingCircle || bounds instanceof BoundingBox ? bounds : new BoundingBox(bounds); return this.setIndices([...this.mesh.vertices].filter(([, v]) => b.pointInside(v.position)).map(([id]) => id)); }
  minimumX() { return this.minElement((a, b) => this.mesh.getVertex(a).position.x < this.mesh.getVertex(b).position.x); }
  maximumX() { return this.minElement((a, b) => this.mesh.getVertex(a).position.x > this.mesh.getVertex(b).position.x); }
  minimumY() { return this.minElement((a, b) => this.mesh.getVertex(a).position.y < this.mesh.getVertex(b).position.y); }
  maximumY() { return this.minElement((a, b) => this.mesh.getVertex(a).position.y > this.mesh.getVertex(b).position.y); }
}

export class EdgeFilter extends Filter {
  static byConnectivity(connectivity) { return new EdgeFilter(e => e.connectivity === connectivity); }
  selectEdges(indices) { return this.setIndices(indices); }
  addEdges(indices) { return this.addIndices(indices); }
  selectPolygonEdges(polyId) { return this.setIndices(this.mesh.getPolygon(polyId).getEdgeIndexSet()); }
  addPolygonEdges(polyId) { return this.addIndices(this.mesh.getPolygon(polyId).getEdgeIndexSet()); }
  selectByConnectivity(type = Edge.Connectivity.External) { return this.setIndices(this.mesh.edgesByConnectivity(type)); }
  normalAngle(angle, tolerance) { return this.filter(i => Math.abs(this.mesh.getEdge(i).normal.clockwiseAngle() - angle) <= tolerance); }
  minimumCentreX() { return this.minElement((a, b) => this.mesh.getEdge(a).centre.x < this.mesh.getEdge(b).centre.x); }
  maximumCentreX() { return this.minElement((a, b) => this.mesh.getEdge(a).centre.x > this.mesh.getEdge(b).centre.x); }
  minimumCentreY() { return this.minElement((a, b) => this.mesh.getEdge(a).centre.y < this.mesh.getEdge(b).centre.y); }
  maximumCentreY() { return this.minElement((a, b) => this.mesh.getEdge(a).centre.y > this.mesh.getEdge(b).centre.y); }
}

export class PolygonFilter extends Filter {
  static byAttribute(name, value) { return new PolygonFilter(p => p.attributes?.[name] === value); }
  selectPolygons(indices) { return this.setIndices(indices); }
  addPolygons(indices) { return this.addIndices(indices); }
  selectInBounds(bounds) { const b = bounds instanceof BoundingCircle || bounds instanceof BoundingBox ? bounds : new BoundingBox(bounds); return this.setIndices([...this.mesh.polygons].filter(([, p]) => b.intersectsBox(p.bounds(this.mesh))).map(([id]) => id)); }
}

export const OperationStatus = Object.freeze({ Success: 'Success', Failed: 'Failed', Partial: 'Partial' });

export class MeshOperationOptions { constructor(options = {}) { Object.assign(this, options); } }
export class MeshOperationResults { constructor(status = OperationStatus.Success, messages = []) { this.status = status; this.messages = messages; } }
