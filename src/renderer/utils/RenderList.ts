import { Object3D } from "../../core/Object3D"
import { Mesh } from "../../core/Mesh"
import { InstancedMesh } from "../../core/InstancedMesh"
import { LineSegments } from "../../objects/LineSegments"
import { Text } from "../../objects/Text"
import { Light } from "../../lights/Light"
import { Matrix4 } from "../../math/Matrix4"
import { SkinnedMesh } from "../../core/SkinnedMesh"
import { WireframeInstancedMesh } from "../../core/WireframeInstancedMesh";

export interface RenderItem {
  type: "static-mesh" | "skinned-mesh" | "instanced-mesh" | "instanced-line" | "line" | "text-stencil" | "text-cover"
  object: Mesh | InstancedMesh | SkinnedMesh | LineSegments | Text | WireframeInstancedMesh
  worldMatrix: Matrix4
}

export interface LightItem {
  light: Light
  worldMatrix: Matrix4
}

export function collectSceneObjects(
  object: Object3D,
  renderList: RenderItem[],
  lights: LightItem[]
): void {
  if (!object.visible) return

  const worldMatrix = object.matrixWorld;

  if (object instanceof InstancedMesh) {
    renderList.push({ type: "instanced-mesh", object, worldMatrix })
  } else if (object instanceof WireframeInstancedMesh) {
    renderList.push({ type: "instanced-line", object, worldMatrix })
  } else if (object instanceof SkinnedMesh) {
    renderList.push({ type: "skinned-mesh", object, worldMatrix })
  } else if (object instanceof Mesh) {
    renderList.push({ type: "static-mesh", object, worldMatrix })
  } else if (object instanceof LineSegments) {
    renderList.push({ type: "line", object, worldMatrix })
  } else if (object instanceof Text) {
    renderList.push({ type: "text-stencil", object, worldMatrix })
    renderList.push({ type: "text-cover", object, worldMatrix })
  } else if (object instanceof Light) {
    lights.push({ light: object, worldMatrix })
  }

  for (const child of object.children) {
    collectSceneObjects(child, renderList, lights);
  }
}
