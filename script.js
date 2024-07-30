async function init() {
    if (!navigator.gpu)
        throw new Error("WebGPU not supported...");

    const canvas = document.querySelector("canvas");
    const adapter = await navigator.gpu.requestAdapter();

    if (!adapter)
        throw new Error("WebGPU Adapter not found...");

    const device = await adapter.requestDevice();
    const context = canvas.getContext("webgpu");
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device: device,
        format: canvasFormat
    });
    return { device, context, canvasFormat };
}

function createPipeline(device, format) {
    const vertexShaderCode = `
        @vertex
        fn main(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4<f32> {
            var pos = array<vec2<f32>, 6>(
                vec2<f32>(-1.0, -1.0),
                vec2<f32>(1.0, -1.0),
                vec2<f32>(-1.0, 1.0),
                vec2<f32>(-1.0, 1.0),
                vec2<f32>(1.0, -1.0),
                vec2<f32>(1.0, 1.0)
            );
            return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
        }`;

    const fragmentShaderCode = `
        @fragment
        fn main(@builtin(position) FragCoord : vec4<f32>) -> @location(0) vec4<f32> {
            let brightPurple = vec3<f32>(0.5255, 0.4275, 1.1);
            let darkPurple = vec3<f32>(0.0, 0.0, 0.5176); 
            let t = FragCoord.y / 480.0;
            let gradient = mix(brightPurple, darkPurple, t);
            
            let circleCenter = vec2<f32>(0.5, 0.5);
            let circleRadius = 0.2;
            let fragCoordNormalized = FragCoord.xy / vec2<f32>(480.0, 480.0);
            let dist = length(fragCoordNormalized - circleCenter);
            
            let circleColor = vec3<f32>(1.0, 0.8118, 0.3255);
            var color = vec4<f32>(0.0, 0.0, 0.0, 1.0);
            
            if (dist < circleRadius) {
                color = vec4<f32>(circleColor, 1.0);
            } else {
                color = vec4<f32>(gradient, 1.0);
            }
            return color;
        }`;

    const vertexModule = device.createShaderModule({ code: vertexShaderCode });
    const fragmentModule = device.createShaderModule({ code: fragmentShaderCode });

    return device.createRenderPipeline({
        vertex: {
            module: vertexModule,
            entryPoint: 'main',
        },
        fragment: {
            module: fragmentModule,
            entryPoint: 'main',
            targets: [{ format: format }],
        },
        primitive: {
            topology: 'triangle-list',
        },
        layout: device.createPipelineLayout({ bindGroupLayouts: [] }),
    });
}

async function render(device, context, pipeline) {
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
        colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            loadOp: "clear",
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            storeOp: "store"
        }]
    });

    pass.setPipeline(pipeline);
    pass.draw(6, 1, 0, 0);
    pass.end();

    device.queue.submit([encoder.finish()]);
}

async function main() {
    const { device, context, canvasFormat } = await init();

    const pipeline = createPipeline(device, canvasFormat);

    function frame() {
        render(device, context, pipeline);
        requestAnimationFrame(frame);
    }

    frame();
}

main().catch(console.error);
