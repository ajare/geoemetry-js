export const UserAttributePolygonColourType = Object.freeze({ None: 'None', Rgba: 'Rgba', Texture: 'Texture' });

export class UserAttributesBase {
  setUserData(index, data) {}
  getUserData(index) { return undefined; }
  setUv(index, textureIndex, u, v) {}
  getUv(index, textureIndex = 0) { return { u: 0, v: 0 }; }
  setRgba(index, r, g, b, a = 1) {}
  getRgba(index) { return { r: 1, g: 1, b: 1, a: 1 }; }
  clone() { return new UserAttributesBase(); }
}

export class UserAttributes extends UserAttributesBase {
  constructor() { super(); this.userData = new Map(); this.uv = new Map(); this.rgba = new Map(); }
  _uvKey(index, textureIndex) { return `${index}:${textureIndex}`; }
  setUserData(index, data) { this.userData.set(index, data); return this; }
  getUserData(index) { return this.userData.get(index); }
  setUv(index, textureIndex, u, v) { this.uv.set(this._uvKey(index, textureIndex), { u, v }); return this; }
  getUv(index, textureIndex = 0) { return this.uv.get(this._uvKey(index, textureIndex)) ?? { u: 0, v: 0 }; }
  setRgba(index, r, g, b, a = 1) { this.rgba.set(index, { r, g, b, a }); return this; }
  getRgba(index) { return this.rgba.get(index) ?? { r: 1, g: 1, b: 1, a: 1 }; }
  clone() { const a = new UserAttributes(); a.userData = new Map(this.userData); a.uv = new Map(this.uv); a.rgba = new Map(this.rgba); return a; }
}

export class UserAttributesFactory { create() { return new UserAttributes(); } }

export class MeshPropertyCollection {
  constructor() { this.items = []; }
  clear() { this.items.length = 0; return this; }
  get size() { return this.items.length; }
  set(index, value) { this.items[index] = value; return this; }
  get(index) { return this.items[index]; }
  toJSON() { return this.items; }
  static fromJSON(data = []) { const c = new MeshPropertyCollection(); c.items = [...data]; return c; }
}
