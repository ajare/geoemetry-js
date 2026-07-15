export class BridgeEdgesOptions {
  static Type = Object.freeze({ Straight: 'Straight', Curved: 'Curved' });
  static SqueezeType = Object.freeze({ None: 'None', Straight: 'Straight', Curved: 'Curved' });

  constructor({
    type = BridgeEdgesOptions.Type.Straight,
    squeezeType = BridgeEdgesOptions.SqueezeType.None,
    squeezeAmount = 0.0,
    steps = 1,
    merge = false,
    tightness = 0.551915,
  } = {}) {
    this.type = type;
    this.squeezeType = squeezeType;
    this.squeezeAmount = squeezeAmount;
    this.steps = steps;
    this.merge = merge;
    this.tightness = tightness;
  }
}
export class WeldEdgesOptions { constructor(options = {}) { Object.assign(this, options); } }
export class ExtrudePolygonOptions {
  constructor({
    cornerType = 'Square',
    mergePolygons = false,
    chamfer = 0.0,
    separateExtrusions = false,
    removeCollinearVertices = false,
    createSidePolygons = true,
    createEndPolygon = true,
    separate = separateExtrusions,
  } = {}) {
    this.cornerType = cornerType;
    this.mergePolygons = mergePolygons;
    this.chamfer = chamfer;
    this.separateExtrusions = separateExtrusions;
    this.removeCollinearVertices = removeCollinearVertices;

    // Backwards-compatible JS aliases used by earlier examples.
    this.createSidePolygons = createSidePolygons;
    this.createEndPolygon = createEndPolygon;
    this.separate = separate;
  }
}
export class ExtrudeVertexOptions { constructor({ type = 'Normal' } = {}) { this.type = type; } }

class Result { constructor(values = {}) { Object.assign(this, values); } }
export class ExtrudeVertexResult extends Result {}
export class ExtrudePolygonResult extends Result {}
export class BridgeEdgesResult extends Result {}
export class WeldEdgesResult extends Result {}
export class SplitEdgeResult extends Result {}
export class SetEdgeLengthResult extends Result {}
export class MergePolygonsResult extends Result {}
export class SplitPolygonResult extends Result {}
export class SlicePolygonResult extends Result {}
export class CutPolygonResult extends Result {}
export class RemoveVertexResult extends Result {}
export class SnipVertexResult extends Result {}
export class ChamferVertexResult extends Result {}
