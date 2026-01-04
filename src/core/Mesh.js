import { mat4 } from 'gl-matrix';

export class Mesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.isMesh = true;

    this.modelMatrix = mat4.create();
  }
}