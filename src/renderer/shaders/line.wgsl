struct GlobalUniforms { viewProjectionMatrix: mat4x4<f32> };
@binding(0) @group(0) var<uniform> globalUniforms: GlobalUniforms;

struct Light {
  position: vec4<f32>,
  color: vec4<f32>,
};
struct SceneUniforms {
    viewMatrix: mat4x4<f32>,
    viewNormalMatrix: mat4x4<f32>,
    numLights: u32,
    lights: array<Light, 4>,
    cameraPosition: vec3<f32>,
    padding: f32,
};
@binding(1) @group(0) var<uniform> sceneUniforms: SceneUniforms;

struct PerObjectUniforms { 
  modelMatrix: mat4x4<f32>,
  color: vec4<f32>
};
@binding(0) @group(1) var<uniform> perObject: PerObjectUniforms;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) worldPosition: vec3<f32>,
  @location(1) vertexColor: vec4<f32>,
};

@vertex
fn vs_main(
    @location(0) pos: vec3<f32>,
    @location(1) color: vec4<f32>
) -> VertexOutput {
  var out: VertexOutput;
  let worldPos = (perObject.modelMatrix * vec4<f32>(pos, 1.0)).xyz;
  out.position = globalUniforms.viewProjectionMatrix * vec4<f32>(worldPos, 1.0);
  out.worldPosition = worldPos;
  out.vertexColor = color * perObject.color;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let distance = distance(in.worldPosition, sceneUniforms.cameraPosition);
  let fadeFactor = exp(-0.5 * distance);
  return vec4<f32>(in.vertexColor.rgb * fadeFactor, in.vertexColor.a);
}