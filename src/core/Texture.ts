export class Texture {
  public readonly isTexture = true
  public image: ImageBitmap
  public gpuTexture: GPUTexture | null = null
  public needsUpdate = true
  public sampler: GPUSampler | null = null

  constructor(image: ImageBitmap) {
    this.image = image
  }
}