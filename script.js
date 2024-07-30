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
        fn main(@builtin(vertex_index) index : u32) -> @builtin(position) vec4<f32> {
            var pos = array<vec2<f32>, 6>(
                vec2<f32>(-1.0, -1.0),
                vec2<f32>(1.0, -1.0),
                vec2<f32>(-1.0, 1.0),
                vec2<f32>(-1.0, 1.0),
                vec2<f32>(1.0, -1.0),
                vec2<f32>(1.0, 1.0)
            );
            return vec4<f32>(pos[index], 0.0, 1.0);
        }`;

    const fragmentShaderCode = `
        @fragment
        fn main(@builtin(position) FragCoord : vec4<f32>) -> @location(0) vec4<f32> {
            let height = 480.0;
            let topBackgroundColor = vec3<f32>(0.5255, 0.4275, 1.0);
            let bottomBackgroundColor = vec3<f32>(0.0, 0.0, 0.5176);
            let topCircleColor = vec3<f32>(1.0, 0.8118, 0.3255);
            let bottomCircleColor = vec3<f32>(1.0, 0.0, 0.9882);
            let circleCenter = vec2<f32>(0.5, 0.5);
            let circleRadius = 0.375;
            var color = vec4<f32>(0.0, 0.0, 0.0, 1.0);
            
            let backgroundT = FragCoord.y / height;
            let gradientBackground = mix(topBackgroundColor, bottomBackgroundColor, backgroundT);

            let normalizedCoordinates = FragCoord.xy / vec2<f32>(height, height);
            let distance = length(normalizedCoordinates - circleCenter);

            if (distance < circleRadius) {
                let dynamicYield = min(50.0, FragCoord.y / 20.0);
                let circleT = FragCoord.y / height / 1.2;
                let gradientCircle = mix(topCircleColor, bottomCircleColor, circleT);
                if (FragCoord.y > (height / 2.5)) {
                    if (FragCoord.y % 42.0 > dynamicYield) {
                        color = vec4<f32>(gradientCircle, 1.0);
                    } else {
                        color = vec4<f32>(gradientBackground, 1.0);
                    }
                } else {
                    color = vec4<f32>(gradientCircle, 1.0);
                }
            } else {
                color = vec4<f32>(gradientBackground, 1.0);
            }
            return color;
        }`;

    return device.createRenderPipeline({
        vertex: {
            module: device.createShaderModule({ code: vertexShaderCode }),
            entryPoint: 'main',
        },
        fragment: {
            module: device.createShaderModule({ code: fragmentShaderCode }),
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
