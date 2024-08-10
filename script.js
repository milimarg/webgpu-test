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
        fn computeSDFSphere(p : vec3<f32>, o : vec3<f32>, s : f32) -> f32 {
            return length(p - o) - s;
        }
        
        fn computeSDFRectangle(p : vec3<f32>, o : vec3<f32>, b : vec3<f32>) -> f32 {
            let q : vec3<f32> = abs(p - o) - b;
            return length(max(q, vec3<f32>(0.0, 0.0, 0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
        }
        
        fn computeBackgroundColor(y : f32, height : f32, topColor : vec3<f32>, bottomColor : vec3<f32>) -> vec4<f32> {
            let backgroundT = y / height;
            let gradientBackground = mix(topColor, bottomColor, backgroundT);
            return vec4<f32>(gradientBackground, 1.0);
        }

        @fragment
        fn main(@builtin(position) FragCoord : vec4<f32>) -> @location(0) vec4<f32> {
            const height = 480.0;

            const topBackgroundColor = vec3<f32>(0.5255, 0.4275, 1.0);
            const bottomBackgroundColor = vec3<f32>(0.0, 0.0, 0.5176);
            const topCircleColor = vec3<f32>(1.0, 0.8118, 0.3255);
            const bottomCircleColor = vec3<f32>(1.0, 0.0, 0.9882);

            const circleCenter = vec3<f32>(0.5, 0.5, 0.0);
            const circleRadius = 0.375;
            const rectangleCenters = array<vec3<f32>, 5>(vec3<f32>(0.0, 0.45, 0.0),
                                                         vec3<f32>(0.0, 0.5, 0.0),
                                                         vec3<f32>(0.0, 0.57, 0.0),
                                                         vec3<f32>(0.0, 0.66, 0.0),
                                                         vec3<f32>(0.0, 0.75, 0.0));
            const rectangleHalfSizes = array<vec3<f32>, 5>(vec3<f32>(1.0, 0.007, 1.0),
                                                           vec3<f32>(1.0, 0.01, 1.0),
                                                           vec3<f32>(1.0, 0.015, 1.0),
                                                           vec3<f32>(1.0, 0.02, 1.0),
                                                           vec3<f32>(1.0, 0.03, 1.0));
            
            let normalizedCoordinates = FragCoord.xyz / vec3<f32>(height, height, 1.0);

            var dist = computeSDFSphere(normalizedCoordinates, circleCenter, circleRadius);

            for (var i: u32 = 0u; i < 5; i = i + 1u) {
                dist = max(dist, -computeSDFRectangle(normalizedCoordinates, rectangleCenters[i], rectangleHalfSizes[i]));
            }

            let backgroundColor = computeBackgroundColor(FragCoord.y, height, topBackgroundColor, bottomBackgroundColor);
            let circleColor = computeBackgroundColor(FragCoord.y, height, topCircleColor, bottomCircleColor);

            var color = backgroundColor;
            if (dist < 0.0) {
                color = circleColor;
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
