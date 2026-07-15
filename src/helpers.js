import { Vector2 } from './vector2.js';

export class RegularPolygonCreationResult {
  constructor() { this.vertexIndices = []; this.edgeIndices = []; this.polygonIndex = null; }
}

export class MeshHelpers {
  static generatePolygonFromVertices(mesh, vertexPositions, result = new RegularPolygonCreationResult()) {
    const beforeV = new Set(mesh.vertices.keys());
    const beforeE = new Set(mesh.edges.keys());
    result.polygonIndex = mesh.addPolygon(vertexPositions);
    result.vertexIndices = [...mesh.vertices.keys()].filter(i => !beforeV.has(i));
    result.edgeIndices = [...mesh.edges.keys()].filter(i => !beforeE.has(i));
    return result;
  }
  static createRectangle(mesh, minExtent, maxExtent, result) {
    minExtent = Vector2.from(minExtent); maxExtent = Vector2.from(maxExtent);
    return MeshHelpers.generatePolygonFromVertices(mesh, [minExtent, new Vector2(maxExtent.x, minExtent.y), maxExtent, new Vector2(minExtent.x, maxExtent.y)], result);
  }
  static createRegularPolygon(mesh, centre, radius, sides, angle = 0, result) {
    centre = Vector2.from(centre);
    const pts = [];
    for (let i = 0; i < sides; i++) pts.push(centre.add(Vector2.fromAngle(angle + i * 360 / sides).mul(radius)));
    return MeshHelpers.generatePolygonFromVertices(mesh, pts, result);
  }
}
