import { mat4 } from 'gl-matrix';

export class WebGPURenderer {
  constructor() {
    this.adapter = null;
    this.device = null;
    this.context = null;
    this.pipeline = null;
  }

  async init() {
    if (!navigator.gpu) {
      throw new Error('WebGPU not supported on this browser.');
    }

    this.adapter = await navigator.gpu.requestAdapter();
    if (!this.adapter) {
      throw new Error('No appropriate GPUAdapter found.');
    }

    this.device = await this.adapter.requestDevice();

    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);

    this.context = canvas.getContext('webgpu');
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: presentationFormat,
    });

    const shaderModule = this.device.createShaderModule({
      code: `
        struct Uniforms {
          modelViewProjectionMatrix : mat4x4<f32>,
        };
        @binding(0) @group(0) var<uniform> uniforms : Uniforms;

        struct VertexOutput {
          @builtin(position) Position : vec4<f32>,
        };

        @vertex
        fn vertex_main(@location(0) position : vec4<f32>) -> VertexOutput {
          var output : VertexOutput;
          output.Position = uniforms.modelViewProjectionMatrix * position;
          return output;
        }

        @fragment
        fn fragment_main() -> @location(0) vec4<f32> {
          return vec4<f32>(1.0, 1.0, 1.0, 1.0);
        }
      `,
    });

    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vertex_main',
        buffers: [
          {
            arrayStride: 12, // 3 * 4 bytes
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: 'float32x3',
              },
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragment_main',
        targets: [
          {
            format: presentationFormat,
          },
        ],
      },
      primitive: {
        topology: 'line-list',
      },
    });
  }

  render(scene, camera) {
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPassDescriptor = {
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(this.pipeline);

    scene.children.forEach(object => {
      if (object.isMesh) {
        const vertexBuffer = this.device.createBuffer({
          size: object.geometry.vertices.byteLength,
          usage: GPUBufferUsage.VERTEX,
          mappedAtCreation: true,
        });
        new Float32Array(vertexBuffer.getMappedRange()).set(object.geometry.vertices);
        vertexBuffer.unmap();

        const indexBuffer = this.device.createBuffer({
          size: object.geometry.indices.byteLength,
          usage: GPUBufferUsage.INDEX,
          mappedAtCreation: true,
        });
        new Uint16Array(indexBuffer.getMappedRange()).set(object.geometry.indices);
        indexBuffer.unmap();

        const mvpMatrix = mat4.create();
        const modelViewMatrix = mat4.create();
        mat4.multiply(modelViewMatrix, camera.viewMatrix, object.modelMatrix);
        mat4.multiply(mvpMatrix, camera.projectionMatrix, modelViewMatrix);

        const uniformBuffer = this.device.createBuffer({
          size: 64, // mat4x4<f32>
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.device.queue.writeBuffer(
          uniformBuffer,
          0,
          mvpMatrix.buffer,
          mvpMatrix.byteOffset,
          mvpMatrix.byteLength
        );

        const uniformBindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: uniformBuffer },
                },
            ],
        });

        passEncoder.setBindGroup(0, uniformBindGroup);
        passEncoder.setVertexBuffer(0, vertexBuffer);
        passEncoder.setIndexBuffer(indexBuffer, 'uint16');
        passEncoder.drawIndexed(object.geometry.indices.length, 1, 0, 0, 0);
      }
    });

    passEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }
}