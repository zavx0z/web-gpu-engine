const { mat4, vec3 } = glMatrix;

async function main() {
  const canvas = document.createElement('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();

  const context = canvas.getContext('webgpu');
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
  });

  const vsSource = `
    @group(0) @binding(0) var<uniform> mvpMatrix : mat4x4<f32>;

    @vertex
    fn main(@location(0) position : vec3<f32>) -> @builtin(position) vec4<f32> {
      return mvpMatrix * vec4<f32>(position, 1.0);
    }
  `;

  const fsSource = `
    @fragment
    fn main() -> @location(0) vec4<f32> {
      return vec4<f32>(1.0, 1.0, 0.0, 1.0);
    }
  `;

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: device.createShaderModule({
        code: vsSource,
      }),
      entryPoint: 'main',
      buffers: [
        {
          arrayStride: 12,
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
        code: fsSource,
      }),
      entryPoint: 'main',
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

  function createTorus(radius, tube, radialSegments, tubularSegments) {
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


    return { vertices, indices };
  }

  const torusData = createTorus(0.5, 0.2, 32, 16);

  const vertexBuffer = device.createBuffer({
    size: torusData.vertices.length * 4,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(vertexBuffer.getMappedRange()).set(torusData.vertices);
  vertexBuffer.unmap();

  const indexBuffer = device.createBuffer({
    size: torusData.indices.length * 4,
    usage: GPUBufferUsage.INDEX,
    mappedAtCreation: true,
  });
  new Uint32Array(indexBuffer.getMappedRange()).set(torusData.indices);
  indexBuffer.unmap();

  const uniformBuffer = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uniformBuffer,
        },
      },
    ],
  });

  function getMvpMatrix() {
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, (2 * Math.PI) / 5, canvas.width / canvas.height, 0.1, 100.0);

    const viewMatrix = mat4.create();
    mat4.lookAt(viewMatrix, vec3.fromValues(0, 0, 2), vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));

    const modelMatrix = mat4.create();

    const mvpMatrix = mat4.create();
    mat4.multiply(mvpMatrix, projectionMatrix, viewMatrix);
    mat4.multiply(mvpMatrix, mvpMatrix, modelMatrix);

    return mvpMatrix;
  }

  function frame() {
    const mvpMatrix = getMvpMatrix();
    device.queue.writeBuffer(
      uniformBuffer,
      0,
      mvpMatrix.buffer,
      mvpMatrix.byteOffset,
      mvpMatrix.byteLength
    );

    const commandEncoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();

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
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.setVertexBuffer(0, vertexBuffer);
    passEncoder.setIndexBuffer(indexBuffer, 'uint32');
    passEncoder.drawIndexed(torusData.indices.length);
    passEncoder.end();

    device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

main();