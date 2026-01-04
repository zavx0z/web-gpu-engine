import { Line } from "./Line"

/**
 * Набор отрезков, соединяющих пары вершин.
 * @see https://threejs.org/docs/#api/en/objects/LineSegments
 */
export class LineSegments extends Line {
	public readonly isLineSegments: true = true
	public type = "LineSegments"
}
