import "./gl-matrix.js";

const { mat4, vec3: vec3_ } = glMatrix;

export const vec3 = vec3_;

export class WebGPURenderer {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    document.body.appendChild(this.canvas);
    this.adapter = null;
    this.device = null;
    this.context = null;
    this.presentationFormat = null;
  }

  async init() {
    this.adapter = await navigator.gpu.requestAdapter();
    this.device = await this.adapter.requestDevice();
    this.context = this.canvas.getContext('webgpu');
    this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.presentationFormat,
    });
  }

  render(scene, camera) {
    const device = this.device;

    const commandEncoder = device.createCommandEncoder();
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

    scene.meshes.forEach(mesh => {
      if (!mesh.pipeline) {
        mesh.pipeline = device.createRenderPipeline({
            layout: 'auto',
            vertex: {
              module: device.createShaderModule({
                code: mesh.material.vsSource,
              }),
              entryPoint: 'main',
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
              module: device.createShaderModule({
                code: mesh.material.fsSource,
              }),
              entryPoint: 'main',
              targets: [
                {
                  format: this.presentationFormat,
                },
              ],
            },
            primitive: {
              topology: 'line-list',
            },
        });
      }

      if (!mesh.vertexBuffer) {
          mesh.vertexBuffer = device.createBuffer({
            size: mesh.geometry.vertices.length * 4,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true,
          });
          new Float32Array(mesh.vertexBuffer.getMappedRange()).set(mesh.geometry.vertices);
          mesh.vertexBuffer.unmap();
      }

      if (!mesh.indexBuffer) {
          mesh.indexBuffer = device.createBuffer({
            size: mesh.geometry.indices.length * 4,
            usage: GPUBufferUsage.INDEX,
            mappedAtCreation: true,
          });
          new Uint32Array(mesh.indexBuffer.getMappedRange()).set(mesh.geometry.indices);
          mesh.indexBuffer.unmap();
      }

      const mvpMatrix = mat4.create();
      mat4.multiply(mvpMatrix, camera.projectionMatrix, camera.viewMatrix);
      mat4.multiply(mvpMatrix, mvpMatrix, mesh.modelMatrix);

      if (!mesh.uniformBuffer) {
        mesh.uniformBuffer = device.createBuffer({
            size: 64, // mat4x4<f32>
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
      }

      device.queue.writeBuffer(
        mesh.uniformBuffer,
        0,
        mvpMatrix.buffer,
        mvpMatrix.byteOffset,
        mvpMatrix.byteLength
      );


      if (!mesh.bindGroup) {
          mesh.bindGroup = device.createBindGroup({
            layout: mesh.pipeline.getBindGroupLayout(0),
            entries: [
              {
                binding: 0,
                resource: {
                  buffer: mesh.uniformBuffer,
                },
              },
            ],
          });
      }

      passEncoder.setPipeline(mesh.pipeline);
      passEncoder.setBindGroup(0, mesh.bindGroup);
      passEncoder.setVertexBuffer(0, mesh.vertexBuffer);
      passEncoder.setIndexBuffer(mesh.indexBuffer, 'uint32');
      passEncoder.drawIndexed(mesh.geometry.indices.length);
    });

    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);
  }
}

export class Scene {
  constructor() {
    this.meshes = [];
  }

  add(mesh) {
    this.meshes.push(mesh);
  }
}

export class PerspectiveCamera {
    constructor(fov, aspect, near, far) {
        this.projectionMatrix = mat4.create();
        mat4.perspective(this.projectionMatrix, fov, aspect, near, far);

        this.viewMatrix = mat4.create();
        this.position = vec3.create();
    }

    lookAt(target) {
        mat4.lookAt(this.viewMatrix, this.position, target, vec3.fromValues(0, 1, 0));
    }
}


export class Mesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.modelMatrix = mat4.create();
    this.pipeline = null;
    this.vertexBuffer = null;
    this.indexBuffer = null;
    this.uniformBuffer = null;
    this.bindGroup = null;
  }
}

export class TorusGeometry {
  constructor(radius, tube, radialSegments, tubularSegments) {
    this.vertices = [];
    this.indices = [];
    this._createTorus(radius, tube, radialSegments, tubularSegments);
  }

  _createTorus(radius, tube, radialSegments, tubularSegments) {
    const vertices = [];
    const indices = [];

    for (let j = 0; j <= radialSegments; j++) {
      for (let i = 0; i <= tubularSegments; i++) {
        const u = i / tubularSegments * Math.PI * 2;
        const v = j / radialSegments * Math.PI * 2;

        const x = (radius + tube * Math.cos(v)) * Math.cos(u);
        const y = (radius + tube * Math.cos(v)) * Math.sin(u);
        const z = tube * Math.sin(v);

        vertices.push(x, y, z);
      }
    }
    for (let j = 1; j <= radialSegments; j++) {
        for (let i = 1; i <= tubularSegments; i++) {
            const a = (tubularSegments + 1) * j + i - 1;
            const b = (tubularSegments + 1) * (j - 1) + i - 1;
            const c = (tubularSegments + 1) * (j - 1) + i;
            const d = (tubularSegments + 1) * j + i;

            indices.push(a, b);
            indices.push(b, c);
            indices.push(c, d);
            indices.push(d, a);

            indices.push(a, c);
            indices.push(b, d);
        }
    }

    this.vertices = new Float32Array(vertices);
    this.indices = new Uint32Array(indices);
  }
}

export class BasicMaterial {
  constructor() {
    this.vsSource = `
      @group(0) @binding(0) var<uniform> mvpMatrix : mat4x4<f32>;

      @vertex
      fn main(@location(0) position : vec3<f32>) -> @builtin(position) vec4<f32> {
        return mvpMatrix * vec4<f32>(position, 1.0);
      }
    `;

    this.fsSource = `
      @fragment
      fn main() -> @location(0) vec4<f32> {
        return vec4<f32>(1.0, 1.0, 0.0, 1.0);
      }
    `;
  }
}
