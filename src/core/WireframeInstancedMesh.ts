import { BufferGeometry, BufferAttribute } from "./BufferGeometry"
import { Material } from "../materials/Material"
import { Object3D } from "./Object3D"
import { Matrix4 } from "../math/Matrix4"
import { Vector3 } from "../math/Vector3"
import { LineGlowMaterial } from "../materials/LineGlowMaterial"
import { Color } from "../math/Color"

export class WireframeInstancedMesh extends Object3D {
  public readonly isWireframeInstancedMesh: true = true
  public geometry: BufferGeometry
  public material: LineGlowMaterial
  public instanceMatrix: Float32Array
  public count: number

  constructor(geometry: BufferGeometry, material: LineGlowMaterial, count: number) {
    super()
    this.geometry = geometry
    this.material = material
    this.count = count
    this.instanceMatrix = new Float32Array(count * 16)
    
    // Инициализируем единичными матрицами
    for (let i = 0; i < count; i++) {
      const offset = i * 16
      this.instanceMatrix.set([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ], offset)
    }
    
    // Добавляем атрибут матриц инстансов в геометрию
    geometry.setAttribute('instanceMatrix', new BufferAttribute(this.instanceMatrix, 16))
  }

  public setMatrixAt(index: number, matrix: Matrix4): void {
    if (index >= this.count || index < 0) {
      throw new Error(`WireframeInstancedMesh.setMatrixAt: index ${index} out of range (0-${this.count-1})`)
    }
    
    const offset = index * 16
    this.instanceMatrix.set(matrix.elements, offset)
  }

  public setPositionAt(index: number, position: Vector3): void {
    if (index >= this.count || index < 0) {
      throw new Error(`WireframeInstancedMesh.setPositionAt: index ${index} out of range (0-${this.count-1})`)
    }
    
    const offset = index * 16 + 12
    this.instanceMatrix[offset] = position.x
    this.instanceMatrix[offset + 1] = position.y
    this.instanceMatrix[offset + 2] = position.z
  }
}