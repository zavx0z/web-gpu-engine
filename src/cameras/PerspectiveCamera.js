import { vec3, mat4 } from 'gl-matrix';

export class PerspectiveCamera {
  constructor(fov, aspect, near, far) {
    this.fov = fov;
    this.aspect = aspect;
    this.near = near;
    this.far = far;

    this.position = vec3.create();
    this.viewMatrix = mat4.create();
    this.projectionMatrix = mat4.create();

    this.updateProjectionMatrix();
  }

  updateProjectionMatrix() {
    mat4.perspective(this.projectionMatrix, this.fov, this.aspect, this.near, this.far);
  }

  lookAt(target) {
    mat4.lookAt(this.viewMatrix, this.position, target, [0, 1, 0]);
  }
}