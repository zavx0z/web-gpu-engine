import { BufferAttribute, BufferGeometry } from "../core/BufferGeometry"
import { Vector3 } from "../math/Vector3"

interface BoxGeometryParameters {
  width?: number
  height?: number
  depth?: number
  widthSegments?: number
  heightSegments?: number
  depthSegments?: number
}

export class BoxGeometry extends BufferGeometry {
  constructor(parameters: BoxGeometryParameters = {}) {
    super()
    const {
      width = 1,
      height = 1,
      depth = 1,
      widthSegments = 1,
      heightSegments = 1,
      depthSegments = 1
    } = parameters

    const widthHalf = width / 2
    const heightHalf = height / 2
    const depthHalf = depth / 2

    const gridX = Math.floor(widthSegments)
    const gridY = Math.floor(heightSegments)
    const gridZ = Math.floor(depthSegments)

    const vertices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    let vertexCounter = 0

    const buildPlane = (
      u: number, v: number, w: number,
      udir: number, vdir: number,
      width: number, height: number, depth: number,
      gridX: number, gridY: number
    ) => {
      const segmentWidth = width / gridX
      const segmentHeight = height / gridY

      const widthHalf = width / 2
      const heightHalf = height / 2
      const depthHalf = depth / 2

      const vector = new Vector3()

      for (let iy = 0; iy <= gridY; iy++) {
        const y = iy * segmentHeight - heightHalf
        for (let ix = 0; ix <= gridX; ix++) {
          const x = ix * segmentWidth - widthHalf

          vector.set(u, v, w)
          vector.multiplyScalar(depthHalf)
          if (u !== 0) vector.x += x * udir;
          if (v !== 0) vector.y += y * vdir;
          if (w !== 0) vector.z += x * udir + y * vdir; // This logic seems complex, let's simplify based on standard box construction

          // A simpler, more standard way to build planes for a box
          const tempVec = new Vector3();
          if (u === 1 || u === -1) { // +/- X
            tempVec.set(depthHalf * u, y, x);
          } else if (v === 1 || v === -1) { // +/- Y
            tempVec.set(x, depthHalf * v, y);
          } else { // +/- Z
            tempVec.set(x, y, depthHalf * w);
          }
          vertices.push(tempVec.x, tempVec.y, tempVec.z);

          normals.push(u, v, w)

          uvs.push(ix / gridX)
          uvs.push(1 - (iy / gridY))
        }
      }

      for (let iy = 0; iy < gridY; iy++) {
        for (let ix = 0; ix < gridX; ix++) {
          const a = vertexCounter + ix + (gridX + 1) * iy
          const b = vertexCounter + ix + (gridX + 1) * (iy + 1)
          const c = vertexCounter + (ix + 1) + (gridX + 1) * (iy + 1)
          const d = vertexCounter + (ix + 1) + (gridX + 1) * iy

          indices.push(a, b, d)
          indices.push(b, c, d)
        }
      }

      vertexCounter += (gridX + 1) * (gridY + 1)
    }

    buildPlane(1, 0, 0, 1, 1, depth, height, width, gridZ, gridY); // right
    buildPlane(-1, 0, 0, -1, 1, depth, height, -width, gridZ, gridY); // left
    buildPlane(0, 1, 0, 1, -1, width, depth, height, gridX, gridZ); // top
    buildPlane(0, -1, 0, 1, 1, width, depth, -height, gridX, gridZ); // bottom
    buildPlane(0, 0, 1, 1, 1, width, height, depth, gridX, gridY); // front
    buildPlane(0, 0, -1, -1, 1, width, height, -depth, gridX, gridY); // back

    this.setIndex(new BufferAttribute(new Uint16Array(indices), 1))
    this.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3))
    this.setAttribute("normal", new BufferAttribute(new Float32Array(normals), 3))
    this.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2))
  }
}