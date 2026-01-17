import { Object3D } from "../../core/Object3D";
import { Mesh } from "../../core/Mesh";
import { LineSegments } from "../../objects/LineSegments";
import { Text } from "../../objects/Text";
import { Light } from "../../lights/Light";
import { Matrix4 } from "../../math/Matrix4";

export interface RenderItem {
    type: "mesh" | "line" | "text-stencil" | "text-cover";
    object: Mesh | LineSegments | Text;
    worldMatrix: Matrix4;
}

export interface LightItem {
    light: Light;
    worldMatrix: Matrix4;
}

export function collectSceneObjects(
    object: Object3D,
    parentWorldMatrix: Matrix4,
    renderList: RenderItem[],
    lights: LightItem[]
): void {
    if (!object.visible) return;

    const worldMatrix = new Matrix4().multiplyMatrices(parentWorldMatrix, object.modelMatrix);

    if (object instanceof Mesh) {
        renderList.push({ type: "mesh", object, worldMatrix });
    } else if (object instanceof LineSegments) {
        renderList.push({ type: "line", object, worldMatrix });
    } else if (object instanceof Text) {
        renderList.push({ type: "text-stencil", object, worldMatrix });
        renderList.push({ type: "text-cover", object, worldMatrix });
    } else if (object instanceof Light) {
        lights.push({ light: object, worldMatrix });
    }

    for (const child of object.children) {
        collectSceneObjects(child, worldMatrix, renderList, lights);
    }
}
