import { Color } from '../math/Color';
import { Material, MaterialParameters } from './Material';

export interface TextMaterialParameters extends MaterialParameters {
	color?: number | Color;
}

export class TextMaterial extends Material {
	public readonly isTextMaterial: true = true;
	public color: Color;

	constructor(parameters: TextMaterialParameters = {}) {
		super(parameters);
		this.color = new Color(parameters.color ?? 0xffffff);
	}
}