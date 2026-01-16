import { Scene } from "../scenes/Scene"
import { ViewPoint } from "../core/ViewPoint"
import { Mesh } from "../core/Mesh"
import { Object3D } from "../core/Object3D"
import { BufferGeometry } from "../core/BufferGeometry"
import { MeshBasicMaterial } from "../materials/MeshBasicMaterial"
import { MeshLambertMaterial } from "../materials/MeshLambertMaterial"
import { Matrix4 } from "../math/Matrix4"
import { LineSegments } from "../objects/LineSegments"
import { LineBasicMaterial } from "../materials/LineBasicMaterial"
import { Light } from "../lights/Light"
import { Vector3 } from "../math/Vector3"
import { Text } from "../objects/Text";
import { TextMaterial } from "../materials/TextMaterial";

import meshShaderCode from "./shaders/mesh.wgsl" with { type: "text" }
import lineShaderCode from "./shaders/line.wgsl" with { type: "text" }
import textShaderCode from "./shaders/text.wgsl" with { type: "text" }

// --- Константы для uniform-буферов ---
const UNIFORM_ALIGNMENT = 256
const MAX_RENDERABLES = 1000
const MAX_LIGHTS = 4 // Максимальное количество источников света

// Размер данных для одного объекта: mat4x4 (64) + mat4x4 (64) + vec4 (16)
const PER_OBJECT_DATA_SIZE = Math.ceil((64 + 64 + 16) / UNIFORM_ALIGNMENT) * UNIFORM_ALIGNMENT

// --- Размеры и смещения для данных сцены ---
const SCENE_UNIFORMS_SIZE = 272
const LIGHT_STRUCT_SIZE = 32

// --- Вспомогательные интерфейсы ---
interface GeometryBuffers {
  positionBuffer: GPUBuffer
  normalBuffer?: GPUBuffer
  indexBuffer?: GPUBuffer
  colorBuffer?: GPUBuffer
}

interface RenderItem {
  type: "mesh" | "line" | "text-stencil" | "text-cover"
  object: Mesh | LineSegments | Text
  worldMatrix: Matrix4
}

interface LightItem {
  light: Light
  worldMatrix: Matrix4
}

export class WebGPURenderer {
  private device: GPUDevice | null = null
  private context: GPUCanvasContext | null = null
  private presentationFormat: GPUTextureFormat | null = null
  private meshPipeline: GPURenderPipeline | null = null
  private linePipeline: GPURenderPipeline | null = null
  private textStencilPipeline: GPURenderPipeline | null = null
  private textCoverPipeline: GPURenderPipeline | null = null

  // --- Глобальные ресурсы ---
  private globalUniformBuffer: GPUBuffer | null = null
  private sceneUniformBuffer: GPUBuffer | null = null // Для освещения
  private globalBindGroup: GPUBindGroup | null = null

  // --- Ресурсы для каждого объекта ---
  private perObjectUniformBuffer: GPUBuffer | null = null
  private perObjectBindGroup: GPUBindGroup | null = null
  private geometryCache: Map<BufferGeometry, GeometryBuffers> = new Map()

  private depthTexture: GPUTexture | null = null
  private multisampleTexture: GPUTexture | null = null
  private sampleCount = 4 // MSAA
  private pixelRatio = 1

  public canvas: HTMLCanvasElement | null = null

  public async init(): Promise<void> {
    if (!navigator.gpu) throw new Error("WebGPU не поддерживается.")
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) throw new Error("Не удалось получить WebGPU адаптер.")

    this.device = await adapter.requestDevice()
    this.canvas = document.createElement("canvas")
    this.context = this.canvas.getContext("webgpu")
    if (!this.context) throw new Error("Не удалось получить WebGPU контекст.")

    this.presentationFormat = navigator.gpu.getPreferredCanvasFormat()
    this.context.configure({
      device: this.device,
      format: this.presentationFormat,
    })

    await this.setupPipelines()
  }

  private async setupPipelines(): Promise<void> {
    if (!this.device || !this.presentationFormat) return

    this.globalUniformBuffer = this.device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    this.sceneUniformBuffer = this.device.createBuffer({
      size: SCENE_UNIFORMS_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    this.perObjectUniformBuffer = this.device.createBuffer({
      size: MAX_RENDERABLES * PER_OBJECT_DATA_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const globalBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "uniform" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    })

    this.globalBindGroup = this.device.createBindGroup({
      layout: globalBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.globalUniformBuffer } },
        { binding: 1, resource: { buffer: this.sceneUniformBuffer } },
      ],
    })

    const perObjectBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform", hasDynamicOffset: true },
        },
      ],
    })

    this.perObjectBindGroup = this.device.createBindGroup({
      layout: perObjectBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.perObjectUniformBuffer,
            size: PER_OBJECT_DATA_SIZE,
          },
        },
      ],
    })

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [globalBindGroupLayout, perObjectBindGroupLayout],
    })

    // --- Shader Modules ---
    const meshShaderModule = this.device.createShaderModule({
      code: meshShaderCode,
    })

    const lineShaderModule = this.device.createShaderModule({
      code: lineShaderCode,
    })

    const textShaderModule = this.device.createShaderModule({
      code: textShaderCode,
    })

    // --- Pipeline для Meshes ---
    this.meshPipeline = await this.device.createRenderPipelineAsync({
      layout: pipelineLayout,
      vertex: {
        module: meshShaderModule,
        entryPoint: "vs_main",
        buffers: [
          { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }] },
          { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: "float32x3" }] },
        ],
      },
      fragment: {
        module: meshShaderModule,
        entryPoint: "fs_main",
        targets: [{ format: this.presentationFormat }],
      },
      primitive: { topology: "triangle-list", cullMode: "back" },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus-stencil8",
      },
      multisample: { count: this.sampleCount },
    })

    // --- Pipeline для Lines ---
    this.linePipeline = await this.device.createRenderPipelineAsync({
      layout: pipelineLayout,
      vertex: {
        module: lineShaderModule,
        entryPoint: "vs_main",
        buffers: [
          { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }] },
          { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: "float32x3" }] },
        ],
      },
      fragment: {
        module: lineShaderModule,
        entryPoint: "fs_main",
        targets: [{ format: this.presentationFormat }],
      },
      primitive: { topology: "line-list" },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus-stencil8",
      },
      multisample: { count: this.sampleCount },
    })

    // --- Pipelines для Text ---
    this.textStencilPipeline = await this.device.createRenderPipelineAsync({
      layout: pipelineLayout,
      vertex: {
        module: textShaderModule,
        entryPoint: "vs_main",
        buffers: [{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }] }],
      },
      fragment: {
        module: textShaderModule,
        entryPoint: "fs_stencil",
        targets: [{ format: this.presentationFormat, writeMask: 0 }],
      },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: "always",
        format: "depth24plus-stencil8",
        stencilFront: { compare: "always", failOp: "keep", depthFailOp: "keep", passOp: "increment-wrap" },
        stencilBack: { compare: "always", failOp: "keep", depthFailOp: "keep", passOp: "decrement-wrap" },
      },
      multisample: { count: this.sampleCount },
    })

    this.textCoverPipeline = await this.device.createRenderPipelineAsync({
      layout: pipelineLayout,
      vertex: {
        module: textShaderModule,
        entryPoint: "vs_main",
        buffers: [{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }] }],
      },
      fragment: {
        module: textShaderModule,
        entryPoint: "fs_cover",
        targets: [{ format: this.presentationFormat }],
      },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: "always",
        format: "depth24plus-stencil8",
        stencilFront: { compare: "not-equal", failOp: "keep", depthFailOp: "keep", passOp: "keep" },
        stencilBack: { compare: "not-equal", failOp: "keep", depthFailOp: "keep", passOp: "keep" },
      },
      multisample: { count: this.sampleCount },
    })
  }

  public setPixelRatio(value: number): void {
    this.pixelRatio = value
  }

  public setSize(width: number, height: number): void {
    if (this.canvas) {
      this.canvas.width = Math.floor(width * this.pixelRatio)
      this.canvas.height = Math.floor(height * this.pixelRatio)
    }
  }

  public render(scene: Scene, viewPoint: ViewPoint): void {
    if (
      !this.device ||
      !this.context ||
      !this.meshPipeline ||
      !this.linePipeline ||
      !this.textStencilPipeline ||
      !this.textCoverPipeline ||
      !this.globalUniformBuffer ||
      !this.canvas
    )
      return

    this.updateTextures()

    const commandEncoder = this.device.createCommandEncoder()
    const textureView = this.context.getCurrentTexture().createView()

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: this.multisampleTexture!.createView(),
          resolveTarget: textureView,
          loadOp: "clear",
          storeOp: "store",
          clearValue: {
            r: scene.background.r,
            g: scene.background.g,
            b: scene.background.b,
            a: 1.0,
          },
        },
      ],
      depthStencilAttachment: {
        view: this.depthTexture!.createView(),
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
        stencilClearValue: 0,
        stencilLoadOp: "clear",
        stencilStoreOp: "store",
      },
    }

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)

    const vpMatrix = new Matrix4().multiplyMatrices(viewPoint.projectionMatrix, viewPoint.viewMatrix)

    this.device.queue.writeBuffer(this.globalUniformBuffer, 0, new Float32Array(vpMatrix.elements))

    const renderList: RenderItem[] = []
    const lightList: LightItem[] = []

    this.collectSceneObjects(scene, new Matrix4(), renderList, lightList)

    this.updateSceneUniforms(lightList, viewPoint.viewMatrix)

    passEncoder.setBindGroup(0, this.globalBindGroup!)

    // --- Сортировка списка рендеринга для минимизации смены конвейера ---
    const pipelineOrder: { [key: string]: number } = {
      mesh: 0, // Сначала непрозрачные объекты
      line: 1, // Затем линии
      "text-stencil": 2, // Затем трафарет для текста
      "text-cover": 3, // В конце заливка текста
    }

    // Мы должны сохранить оригинальный индекс для правильного смещения в uniform-буфере
    const indexedRenderList = renderList.map((item, index) => ({ item, originalIndex: index }))
    indexedRenderList.sort((a, b) => pipelineOrder[a.item.type] - pipelineOrder[b.item.type])

    let currentPipeline: GPURenderPipeline | null = null

    for (const { item, originalIndex } of indexedRenderList) {
      let pipeline: GPURenderPipeline | null = null

      // Определяем, какой конвейер нужен для текущего объекта
      switch (item.type) {
        case "mesh":
          pipeline = this.meshPipeline
          break
        case "line":
          pipeline = this.linePipeline
          break
        case "text-stencil":
          pipeline = this.textStencilPipeline
          break
        case "text-cover":
          pipeline = this.textCoverPipeline
          break
      }

      // Меняем конвейер только если он отличается от текущего
      if (pipeline && pipeline !== currentPipeline) {
        passEncoder.setPipeline(pipeline)
        currentPipeline = pipeline
      }

      // Выполняем соответствующий вызов отрисовки
      switch (item.type) {
        case "mesh":
          this.renderMesh(passEncoder, item.object as Mesh, item.worldMatrix, originalIndex)
          break
        case "line":
          this.renderLines(passEncoder, item.object as LineSegments, item.worldMatrix, originalIndex)
          break
        case "text-stencil":
          passEncoder.setStencilReference(0)
          this.renderTextPass(passEncoder, item.object as Text, item.worldMatrix, originalIndex, true)
          break
        case "text-cover":
          passEncoder.setStencilReference(0)
          this.renderTextPass(passEncoder, item.object as Text, item.worldMatrix, originalIndex, false)
          break
      }
    }

    passEncoder.end()

    this.device.queue.submit([commandEncoder.finish()])
  }

  private collectSceneObjects(
    object: Object3D,
    parentWorldMatrix: Matrix4,
    renderList: RenderItem[],
    lights: LightItem[]
  ): void {
    if (!object.visible) return

    const worldMatrix = new Matrix4().multiplyMatrices(parentWorldMatrix, object.modelMatrix)

    if (object instanceof Mesh) {
      renderList.push({ type: "mesh", object, worldMatrix })
    } else if (object instanceof LineSegments) {
      renderList.push({ type: "line", object, worldMatrix })
    } else if (object instanceof Text) {
      renderList.push({ type: "text-stencil", object, worldMatrix })
      renderList.push({ type: "text-cover", object, worldMatrix })
    } else if (object instanceof Light) lights.push({ light: object, worldMatrix })

    for (const child of object.children) {
      this.collectSceneObjects(child, worldMatrix, renderList, lights)
    }
  }

  private updateSceneUniforms(lights: LightItem[], viewMatrix: Matrix4): void {
    if (!this.device || !this.sceneUniformBuffer) return

    const sceneData = new ArrayBuffer(SCENE_UNIFORMS_SIZE)
    const float32View = new Float32Array(sceneData)
    const uint32View = new Uint32Array(sceneData)

    const viewNormalMatrix = new Matrix4().copy(viewMatrix).invert().transpose()

    float32View.set(viewMatrix.elements, 0)
    float32View.set(viewNormalMatrix.elements, 16)
    uint32View[32] = Math.min(lights.length, MAX_LIGHTS)

    const lightsArrayOffset = 36

    for (let i = 0; i < uint32View[32]; i++) {
      const lightItem = lights[i]
      const light = lightItem.light
      const worldLightPos = new Vector3(
        lightItem.worldMatrix.elements[12],
        lightItem.worldMatrix.elements[13],
        lightItem.worldMatrix.elements[14]
      )
      const viewLightPos = worldLightPos.applyMatrix4(viewMatrix)

      const currentLightOffset = lightsArrayOffset + i * (LIGHT_STRUCT_SIZE / 4)

      float32View.set([viewLightPos.x, viewLightPos.y, viewLightPos.z, 1.0], currentLightOffset)

      float32View.set([light.color.r, light.color.g, light.color.b, light.intensity], currentLightOffset + 4)
    }

    this.device.queue.writeBuffer(this.sceneUniformBuffer, 0, sceneData)
  }

  private getOrCreateGeometryBuffers(geometry: BufferGeometry): GeometryBuffers {
    if (this.geometryCache.has(geometry)) return this.geometryCache.get(geometry)!

    if (!this.device) throw new Error("Device not initialized")

    const positionBuffer = this.device.createBuffer({
      size: (geometry.attributes.position.array.byteLength + 3) & ~3,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    })
    new Float32Array(positionBuffer.getMappedRange()).set(geometry.attributes.position.array)
    positionBuffer.unmap()

    let normalBuffer: GPUBuffer | undefined
    if (geometry.attributes.normal) {
      normalBuffer = this.device.createBuffer({
        size: (geometry.attributes.normal.array.byteLength + 3) & ~3,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      })
      new Float32Array(normalBuffer.getMappedRange()).set(geometry.attributes.normal.array)
      normalBuffer.unmap()
    }

    let colorBuffer: GPUBuffer | undefined
    if (geometry.attributes.color) {
      colorBuffer = this.device.createBuffer({
        size: (geometry.attributes.color.array.byteLength + 3) & ~3,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      })
      new Float32Array(colorBuffer.getMappedRange()).set(geometry.attributes.color.array)
      colorBuffer.unmap()
    }

    let indexBuffer: GPUBuffer | undefined
    if (geometry.index) {
      const TypedArray = geometry.index.array.constructor as typeof Uint16Array | typeof Uint32Array
      indexBuffer = this.device.createBuffer({
        size: (geometry.index.array.byteLength + 3) & ~3,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      })
      new TypedArray(indexBuffer.getMappedRange()).set(geometry.index.array)
      indexBuffer.unmap()
    }

    const buffers: GeometryBuffers = {
      positionBuffer,
      normalBuffer,
      colorBuffer,
      indexBuffer,
    }

    this.geometryCache.set(geometry, buffers)
    return buffers
  }

  private renderMesh(passEncoder: GPURenderPassEncoder, mesh: Mesh, worldMatrix: Matrix4, renderIndex: number): void {
    if (!this.device || !this.perObjectUniformBuffer || !this.perObjectBindGroup) return

    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    if (!material.visible) return

    const dynamicOffset = renderIndex * PER_OBJECT_DATA_SIZE
    const objectData = new Float32Array(PER_OBJECT_DATA_SIZE / 4)

    const normalMatrix = new Matrix4().copy(worldMatrix).invert().transpose()
    objectData.set(worldMatrix.elements, 0) // modelMatrix
    objectData.set(normalMatrix.elements, 16) // normalMatrix

    if (material instanceof MeshBasicMaterial || material instanceof MeshLambertMaterial) {
      objectData.set(material.color.toArray(), 32)
    }

    this.device.queue.writeBuffer(this.perObjectUniformBuffer, dynamicOffset, objectData)

    passEncoder.setBindGroup(1, this.perObjectBindGroup, [dynamicOffset])

    const { positionBuffer, normalBuffer, indexBuffer } = this.getOrCreateGeometryBuffers(mesh.geometry)

    passEncoder.setVertexBuffer(0, positionBuffer)
    if (normalBuffer) {
      passEncoder.setVertexBuffer(1, normalBuffer)
    }

    if (indexBuffer) {
      const indexFormat = mesh.geometry.index!.array.length > 65535 ? "uint32" : "uint16"
      passEncoder.setIndexBuffer(indexBuffer, indexFormat)
      passEncoder.drawIndexed(mesh.geometry.index!.count)
    } else {
      passEncoder.draw(mesh.geometry.attributes.position.count)
    }
  }

  private renderLines(
    passEncoder: GPURenderPassEncoder,
    lines: LineSegments,
    worldMatrix: Matrix4,
    renderIndex: number
  ): void {
    if (!this.device || !this.perObjectUniformBuffer || !this.perObjectBindGroup) return

    if (!(lines.material instanceof LineBasicMaterial) || !lines.material.visible) return

    const dynamicOffset = renderIndex * PER_OBJECT_DATA_SIZE
    const objectData = new Float32Array(PER_OBJECT_DATA_SIZE / 4)
    objectData.set(worldMatrix.elements, 0)

    this.device.queue.writeBuffer(this.perObjectUniformBuffer, dynamicOffset, objectData)

    passEncoder.setBindGroup(1, this.perObjectBindGroup, [dynamicOffset])

    const { positionBuffer, colorBuffer } = this.getOrCreateGeometryBuffers(lines.geometry)

    passEncoder.setVertexBuffer(0, positionBuffer)
    if (colorBuffer) passEncoder.setVertexBuffer(1, colorBuffer)

    passEncoder.draw(lines.geometry.attributes.position.count)
  }

  private renderTextPass(
    passEncoder: GPURenderPassEncoder,
    text: Text,
    worldMatrix: Matrix4,
    renderIndex: number,
    isStencil: boolean
  ): void {
    if (!this.device || !this.perObjectUniformBuffer || !this.perObjectBindGroup) return

    const geometry = isStencil ? text.stencilGeometry : text.coverGeometry
    if (!geometry.index) return

    const dynamicOffset = renderIndex * PER_OBJECT_DATA_SIZE
    const objectData = new Float32Array(PER_OBJECT_DATA_SIZE / 4)
    objectData.set(worldMatrix.elements, 0)
    if (!isStencil) {
objectData.set((text.material as TextMaterial).color.toArray(), 32);
    }

    this.device.queue.writeBuffer(this.perObjectUniformBuffer, dynamicOffset, objectData)
    passEncoder.setBindGroup(1, this.perObjectBindGroup, [dynamicOffset])

    const { positionBuffer, indexBuffer } = this.getOrCreateGeometryBuffers(geometry)
    passEncoder.setVertexBuffer(0, positionBuffer)

    const indexFormat = geometry.index.array instanceof Uint32Array ? "uint32" : "uint16"
    passEncoder.setIndexBuffer(indexBuffer!, indexFormat)

    passEncoder.drawIndexed(geometry.index.count)
  }

  private updateTextures(): void {
    if (!this.device || !this.canvas || !this.presentationFormat) return

    const needsResize =
      !this.depthTexture ||
      this.depthTexture.width !== this.canvas.width ||
      this.depthTexture.height !== this.canvas.height

    if (needsResize) {
      if (this.depthTexture) this.depthTexture.destroy()
      if (this.multisampleTexture) this.multisampleTexture.destroy()

      const size = { width: this.canvas.width, height: this.canvas.height }
      this.depthTexture = this.device.createTexture({
        size,
        format: "depth24plus-stencil8",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        sampleCount: this.sampleCount,
      })
      this.multisampleTexture = this.device.createTexture({
        size,
        format: this.presentationFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        sampleCount: this.sampleCount,
      })
    }
  }
}
