import { Matrix4 } from "../math/Matrix4";
import { Object3D } from "../core/Object3D";

export class Skeleton {
  public bones: Object3D[] = [];
  public boneInverses: Matrix4[] = [];
  public boneMatrices: Float32Array;

  constructor(bones: Object3D[] = [], boneInverses: Matrix4[] = []) {
    this.bones = bones;
    this.boneInverses = boneInverses;
    this.boneMatrices = new Float32Array(bones.length * 16);
  }

  private getGlobalMatrix(object: Object3D): Matrix4 {
    const matrices: Matrix4[] = [];
    let current: Object3D | null = object;
    while (current) {
        matrices.push(current.modelMatrix);
        current = current.parent;
    }
    const globalMatrix = new Matrix4().identity();
    for (let i = matrices.length - 1; i >= 0; i--) {
        globalMatrix.multiply(matrices[i]);
    }
    return globalMatrix;
  }

  public update(): void {
    for (let i = 0; i < this.bones.length; i++) {
      const bone = this.bones[i];
      const globalMatrix = this.getGlobalMatrix(bone);
      // Рассчитываем матрицу для скиннинга
      const matrix = new Matrix4().multiplyMatrices(globalMatrix, this.boneInverses[i]);
      this.boneMatrices.set(matrix.elements, i * 16);
    }
  }
}