import { Vector2 } from './vector2.js';
import { BoundingBox } from './bounds.js';
import { Vertex, Edge, DirectedEdge, Polygon } from './topology.js';
import { UserAttributes } from './attributes.js';

export class GeometryError extends Error {}

export class Mesh {
  constructor() {
    this.vertices = new Map();
    this.edges = new Map();
    this.polygons = new Map();
    this._edgeLookup = new Map();
    this._nextVertexId = 0;
    this._nextEdgeId = 0;
    this._nextPolygonId = 0;
    this.callbacks = new Map();
    this.attributes = {};
    this.vertexAttributes = new UserAttributes();
    this.edgeAttributes = new UserAttributes();
    this.polygonAttributes = new UserAttributes();
    this.polygonVertexAttributes = new UserAttributes();
  }

  clone() { const m = new Mesh(); for (const [i, v] of this.vertices) m.vertices.set(i, v.clone()); for (const [i, e] of this.edges) m.edges.set(i, e.clone()); for (const [i, p] of this.polygons) m.polygons.set(i, p.clone()); m._nextVertexId = this._nextVertexId; m._nextEdgeId = this._nextEdgeId; m._nextPolygonId = this._nextPolygonId; m._rebuildEdgeLookup(); return m; }
  clear() { this.vertices.clear(); this.edges.clear(); this.polygons.clear(); this._edgeLookup.clear(); return this; }
  _edgeKey(a, b) { return a < b ? `${a}:${b}` : `${b}:${a}`; }
  _rebuildEdgeLookup() { this._edgeLookup.clear(); for (const [i, e] of this.edges) this._edgeLookup.set(this._edgeKey(e.vertices[0], e.vertices[1]), i); }
  _emit(type, payload) { for (const cb of this.callbacks.values()) cb?.[type]?.(payload, this); }
  on(id, callbacks) { this.callbacks.set(id, callbacks); return this; }
  off(id) { this.callbacks.delete(id); return this; }

  addVertex(position) { const id = this._nextVertexId++; const v = position instanceof Vertex ? position.clone() : new Vertex(Vector2.from(position), id); v.id = v.publicId = v.attributeIndex = id; this.vertices.set(id, v); this._emit('vertexAdded', { id, vertex: v }); return id; }
  getVertex(id) { return this.vertices.get(id); }
  get numVertices() { return this.vertices.size; }
  getNumVertices() { return this.vertices.size; }
  getFirstVertexIndex() { return this.vertices.keys().next().value ?? null; }
  getNextVertexIndex(id) { const keys = [...this.vertices.keys()]; return keys[keys.indexOf(id) + 1] ?? null; }
  vertexIndexIterationFinished(id) { return id == null; }
  removeVertex(id) { const v = this.vertices.get(id); if (!v) return false; for (const e of [...v.edges]) this.removeEdge(e); this.vertices.delete(id); this._emit('vertexRemoved', { id }); return true; }
  moveVertex(id, position) { const v = this.vertices.get(id); if (!v) throw new GeometryError(`Vertex ${id} does not exist`); v.position = Vector2.from(position); for (const e of v.edges) this.edges.get(e)?.update(this); for (const p of this.polygons.values()) if (p.vertexIndices().includes(id)) p.invalidate(); this._emit('vertexMoved', { id, vertex: v }); return this; }

  findEdge(v0, v1) { return this._edgeLookup.get(this._edgeKey(v0, v1)); }
  addEdge(v0, v1) { if (v0 instanceof Edge) [v0, v1] = v0.vertices; const existing = this.findEdge(v0, v1); if (existing !== undefined) return existing; if (!this.vertices.has(v0) || !this.vertices.has(v1)) throw new GeometryError('Cannot create edge with missing vertex'); const id = this._nextEdgeId++; const e = new Edge(v0, v1, id).update(this); this.edges.set(id, e); this._edgeLookup.set(this._edgeKey(v0, v1), id); this.vertices.get(v0).edges.add(id); this.vertices.get(v1).edges.add(id); this._emit('edgeAdded', { id, edge: e }); return id; }
  getEdge(id) { return this.edges.get(id); }
  getNumEdges() { return this.edges.size; }
  getFirstEdgeIndex() { return this.edges.keys().next().value ?? null; }
  getNextEdgeIndex(id) { const keys = [...this.edges.keys()]; return keys[keys.indexOf(id) + 1] ?? null; }
  edgeIndexIterationFinished(id) { return id == null; }
  getEdgeIndexByVertices(a, b) { return this.findEdge(a, b) ?? -1; }
  getEdgeIndexByOrderedVertices(a, b) { const id = this.findEdge(a, b); if (id == null) return -1; const e = this.edges.get(id); return e.vertices[0] === a && e.vertices[1] === b ? id : -1; }
  removeEdge(id) {
    const e = this.edges.get(id);
    if (!e) return false;

    if (e.polygons.size === 2) {
      const [polyAId, polyBId] = [...e.polygons];
      const polyA = this.polygons.get(polyAId);
      const polyB = this.polygons.get(polyBId);
      if (!polyA || !polyB) return false;

      const edgeAIndex = polyA.edges.findIndex((de) => de.edge === id);
      const edgeBIndex = polyB.edges.findIndex((de) => de.edge === id);
      if (edgeAIndex < 0 || edgeBIndex < 0) return false;

      const pathAroundWithoutEdge = (polygon, edgeIndex) => {
        const path = [];
        for (let i = 1; i < polygon.edges.length; ++i) {
          const de = polygon.edges[(edgeIndex + i) % polygon.edges.length];
          if (i === 1) path.push(de.v0);
          path.push(de.v1);
        }
        return path;
      };

      const pathA = pathAroundWithoutEdge(polyA, edgeAIndex);
      let pathB = pathAroundWithoutEdge(polyB, edgeBIndex);
      if (pathA[pathA.length - 1] !== pathB[0]) {
        pathB = [...pathB].reverse();
      }
      if (pathA[pathA.length - 1] !== pathB[0]) return false;

      let mergedVertexIds = pathA.concat(pathB.slice(1, -1));
      mergedVertexIds = mergedVertexIds.filter((vertexId, index) => index === 0 || vertexId !== mergedVertexIds[index - 1]);
      if (mergedVertexIds.length > 1 && mergedVertexIds[0] === mergedVertexIds[mergedVertexIds.length - 1]) {
        mergedVertexIds.pop();
      }
      if (mergedVertexIds.length < 3) return false;

      const mergedPositions = mergedVertexIds.map((vertexId) => this.vertices.get(vertexId).position.clone());
      this.removePolygon(polyAId, { removeOrphanEdges: true });
      this.removePolygon(polyBId, { removeOrphanEdges: true });
      this.addPolygon(mergedPositions);
      return true;
    }

    if (e.polygons.size) {
      const polygonIds = [...e.polygons];
      for (const polygonId of polygonIds) {
        const polygon = this.polygons.get(polygonId);
        if (!polygon) continue;
        if (polygon.edges.length <= 3) return false;
      }

      for (const polygonId of polygonIds) {
        const polygon = this.polygons.get(polygonId);
        const edgeIndex = polygon.edges.findIndex((de) => de.edge === id);
        if (edgeIndex < 0) continue;

        const prevIndex = (edgeIndex + polygon.edges.length - 1) % polygon.edges.length;
        const directedEdge = polygon.edges[edgeIndex];
        const prevDirectedEdge = polygon.edges[prevIndex];
        const oldPrevEdgeId = prevDirectedEdge.edge;

        this.edges.get(oldPrevEdgeId)?.polygons.delete(polygonId);

        const replacementEdgeId = this.addEdge(prevDirectedEdge.v0, directedEdge.v1);
        this.edges.get(replacementEdgeId).polygons.add(polygonId);
        polygon.edges[prevIndex] = new DirectedEdge(replacementEdgeId, prevDirectedEdge.v0, directedEdge.v1);
        polygon.edges.splice(edgeIndex, 1);
        polygon.invalidate();

        const oldPrevEdge = this.edges.get(oldPrevEdgeId);
        if (oldPrevEdge && oldPrevEdge.polygons.size === 0 && oldPrevEdgeId !== replacementEdgeId) {
          this.vertices.get(oldPrevEdge.vertices[0])?.edges.delete(oldPrevEdgeId);
          this.vertices.get(oldPrevEdge.vertices[1])?.edges.delete(oldPrevEdgeId);
          this._edgeLookup.delete(this._edgeKey(oldPrevEdge.vertices[0], oldPrevEdge.vertices[1]));
          this.edges.delete(oldPrevEdgeId);
          this._emit('edgeRemoved', { id: oldPrevEdgeId });
        }
      }
    }

    const refreshed = this.edges.get(id);
    if (!refreshed) return true;
    if (refreshed.polygons.size) throw new GeometryError('Cannot remove an edge referenced by polygons');
    this.vertices.get(refreshed.vertices[0])?.edges.delete(id);
    this.vertices.get(refreshed.vertices[1])?.edges.delete(id);
    this._edgeLookup.delete(this._edgeKey(refreshed.vertices[0], refreshed.vertices[1]));
    this.edges.delete(id);
    this._emit('edgeRemoved', { id });
    return true;
  }

  addPolygon(pointsOrVertexIds) {
    const vertexIds = pointsOrVertexIds.map(p => Number.isInteger(p) ? p : this.addVertex(p));
    if (vertexIds.length < 3) throw new GeometryError('A polygon requires at least three vertices');
    const directed = [];
    for (let i = 0; i < vertexIds.length; i++) {
      const v0 = vertexIds[i], v1 = vertexIds[(i + 1) % vertexIds.length];
      const edgeId = this.addEdge(v0, v1);
      directed.push(new DirectedEdge(edgeId, v0, v1));
    }
    const id = this._nextPolygonId++;
    const p = new Polygon(directed, id);
    this.polygons.set(id, p);
    for (const de of directed) this.edges.get(de.edge).polygons.add(id);
    this._emit('polygonAdded', { id, polygon: p });
    return id;
  }

  removePolygon(id, { removeOrphanEdges = false } = {}) { const p = this.polygons.get(id); if (!p) return false; for (const de of p.edges) this.edges.get(de.edge)?.polygons.delete(id); this.polygons.delete(id); if (removeOrphanEdges) for (const [eid, e] of [...this.edges]) if (!e.polygons.size) this.removeEdge(eid); this._emit('polygonRemoved', { id }); return true; }
  addHole(polygonId, holePolygonId) { const p = this.polygons.get(polygonId); if (!p || !this.polygons.has(holePolygonId)) throw new GeometryError('Invalid polygon or hole id'); p.holes.push(holePolygonId); this.polygons.get(holePolygonId).convertToHole(); p.invalidate(); return this; }
  addHoleToPolygon(polygonId, holePolygonId) { return this.addHole(polygonId, holePolygonId); }
  removeHoleFromPolygon(polygonId, holePolygonId) { const p = this.polygons.get(polygonId); if (!p) return false; p.holes = p.holes.filter(h => h !== holePolygonId); this.polygons.get(holePolygonId)?.convertFromHole(); p.invalidate(); return true; }
  removeHolesFromPolygon(polygonId) { const p = this.polygons.get(polygonId); if (!p) return false; for (const h of p.holes) this.polygons.get(h)?.convertFromHole(); p.holes = []; p.invalidate(); return true; }
  getPolygon(id) { return this.polygons.get(id); }
  getNumPolygons() { return this.polygons.size; }
  getFirstPolygonIndex() { return this.polygons.keys().next().value ?? null; }
  getNextPolygonIndex(id) { const keys = [...this.polygons.keys()]; return keys[keys.indexOf(id) + 1] ?? null; }
  polygonIndexIterationFinished(id) { return id == null; }

  get extents() { if (!this.vertices.size) return new BoundingBox(); return new BoundingBox([...this.vertices.values()].map(v => v.position)); }
  getExtents() { return { min: this.extents.min, max: this.extents.max }; }
  getVertexPositions(ids = [...this.vertices.keys()]) { return ids.map(id => this.vertices.get(id).position.clone()); }
  getPolygonVertices(id) { const p = this.polygons.get(id); if (!p) throw new GeometryError(`Polygon ${id} does not exist`); return p.vertices(this); }
  triangulatePolygon(id) { const p = this.polygons.get(id); if (!p) throw new GeometryError(`Polygon ${id} does not exist`); return p.triangulate(this); }
  containingPolygon(point) { for (const [id, p] of this.polygons) if (p.pointInside(this, point)) return id; return null; }
  edgesByConnectivity(connectivity) { return [...this.edges].filter(([, e]) => e.connectivity === connectivity).map(([id]) => id); }
  getEdgeIndicesByConnectivity(connectivity) { return this.edgesByConnectivity(connectivity); }
  setVertexUserData(id, data) { this.vertexAttributes.setUserData(id, data); }
  getVertexUserData(id) { return this.vertexAttributes.getUserData(id); }
  setEdgeUserData(id, data) { this.edgeAttributes.setUserData(id, data); }
  getEdgeUserData(id) { return this.edgeAttributes.getUserData(id); }
  setPolygonUserData(id, data) { this.polygonAttributes.setUserData(id, data); }
  getPolygonUserData(id) { return this.polygonAttributes.getUserData(id); }
  getVertexUvAttribute(id, textureIndex = 0) { return this.vertexAttributes.getUv(id, textureIndex); }
  getVertexRgbaAttribute(id) { return this.vertexAttributes.getRgba(id); }
  getEdgeRgbaAttribute(id) { return this.edgeAttributes.getRgba(id); }
  getPolygonRgbaAttribute(id) { return this.polygonAttributes.getRgba(id); }

  removeVertices(ids) { for (const id of ids) this.removeVertex(id); return this; }
  removePolygons(ids, options) { for (const id of ids) this.removePolygon(id, options); return this; }
  moveVertexBy(id, delta) { const v = this.getVertex(id); return this.moveVertex(id, v.position.add(delta)); }
  moveVertices(ids, delta) { for (const id of ids) this.moveVertexBy(id, delta); return this; }
  moveEdge(edgeId, delta) { const e = this.getEdge(edgeId); this.moveVertices(e.vertices, delta); return this; }
  moveEdges(edgeIds, delta) { const verts = new Set(); for (const id of edgeIds) for (const v of this.getEdge(id).vertices) verts.add(v); return this.moveVertices(verts, delta); }
  movePolygon(polygonId, delta) { return this.moveVertices(this.getPolygon(polygonId).getVertexIndexSet(), delta); }
  movePolygons(polygonIds, delta) { const verts = new Set(); for (const id of polygonIds) for (const v of this.getPolygon(id).getVertexIndexSet()) verts.add(v); return this.moveVertices(verts, delta); }
  recentrePolygon(polygonId, centre) { const box = new BoundingBox(this.getPolygonVertices(polygonId)); return this.movePolygon(polygonId, Vector2.from(centre).sub(box.centre)); }
  setEdgeLength(edgeId, length) { const e = this.getEdge(edgeId); const a = this.getVertex(e.vertices[0]).position; return this.moveVertex(e.vertices[1], a.add(e.direction.mul(length))); }
  addFilledHoleToPolygon(polygonId, holeId) { const verts = this.getPolygon(holeId).vertexIndices().map(v => this.getVertex(v).position.clone()); const filled = this.addPolygon(verts); this.addHoleToPolygon(polygonId, holeId); return filled; }
  getPolygonsByVertex(vertexId) { return [...this.polygons].filter(([, p]) => p.usesVertex(vertexId)).map(([id]) => id); }
  getPolygonsByEdge(edgeId) { return [...(this.getEdge(edgeId)?.polygons ?? [])]; }
  compact() { return this.clone(); }

  toJSON() { return { vertices: [...this.vertices].map(([id, v]) => ({ id, position: v.position, attributes: v.attributes })), edges: [...this.edges].map(([id, e]) => ({ id, vertices: e.vertices, attributes: e.attributes })), polygons: [...this.polygons].map(([id, p]) => ({ id, edges: p.edges, holes: p.holes, hole: p.hole, attributes: p.attributes })) }; }
}
