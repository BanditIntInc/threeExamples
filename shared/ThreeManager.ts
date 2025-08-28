import * as THREE from 'three';

export interface ThreeManagerConfig {
    canvas: HTMLCanvasElement;
    camera?: {
        fov?: number;
        near?: number;
        far?: number;
        position?: THREE.Vector3;
        lookAt?: THREE.Vector3;
    };
    renderer?: {
        antialias?: boolean;
        clearColor?: number;
        alpha?: number;
        shadows?: boolean;
        shadowType?: THREE.ShadowMapType;
        toneMapping?: THREE.ToneMapping;
        toneMappingExposure?: number;
        colorSpace?: string;
    };
    scene?: {
        background?: THREE.Color;
        fog?: {
            color: number;
            near: number;
            far: number;
        };
    };
}

export interface LightConfig {
    type: 'ambient' | 'directional' | 'hemisphere' | 'point' | 'spot';
    color: number;
    intensity: number;
    position?: THREE.Vector3;
    castShadow?: boolean;
    shadowMapSize?: number;
    shadowCamera?: {
        left?: number;
        right?: number;
        top?: number;
        bottom?: number;
        near?: number;
        far?: number;
    };
    groundColor?: number; // For hemisphere lights
}

export class ThreeManager {
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public renderer: THREE.WebGLRenderer;
    public clock: THREE.Clock;
    private lights: THREE.Light[] = [];

    constructor(config: ThreeManagerConfig) {
        this.scene = this.createScene(config.scene);
        this.camera = this.createCamera(config.camera);
        this.renderer = this.createRenderer(config.canvas, config.renderer);
        this.clock = new THREE.Clock();
    }

    /**
     * Create and configure the scene
     */
    private createScene(sceneConfig?: ThreeManagerConfig['scene']): THREE.Scene {
        const scene = new THREE.Scene();
        
        if (sceneConfig?.background) {
            scene.background = sceneConfig.background;
        }

        if (sceneConfig?.fog) {
            scene.fog = new THREE.Fog(
                sceneConfig.fog.color,
                sceneConfig.fog.near,
                sceneConfig.fog.far
            );
        }

        return scene;
    }

    /**
     * Create and configure the camera
     */
    private createCamera(cameraConfig?: ThreeManagerConfig['camera']): THREE.PerspectiveCamera {
        const camera = new THREE.PerspectiveCamera(
            cameraConfig?.fov || 75,
            window.innerWidth / window.innerHeight,
            cameraConfig?.near || 0.1,
            cameraConfig?.far || 2000
        );

        if (cameraConfig?.position) {
            camera.position.copy(cameraConfig.position);
        }

        if (cameraConfig?.lookAt) {
            camera.lookAt(cameraConfig.lookAt);
        }

        return camera;
    }

    /**
     * Create and configure the renderer
     */
    private createRenderer(canvas: HTMLCanvasElement, rendererConfig?: ThreeManagerConfig['renderer']): THREE.WebGLRenderer {
        const renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: rendererConfig?.antialias !== false
        });

        renderer.setSize(window.innerWidth, window.innerHeight);
        
        if (rendererConfig?.clearColor !== undefined) {
            renderer.setClearColor(rendererConfig.clearColor, rendererConfig.alpha || 1);
        }

        if (rendererConfig?.shadows !== false) {
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = rendererConfig?.shadowType || THREE.PCFSoftShadowMap;
        }

        if (rendererConfig?.toneMapping) {
            renderer.toneMapping = rendererConfig.toneMapping;
        }

        if (rendererConfig?.toneMappingExposure) {
            renderer.toneMappingExposure = rendererConfig.toneMappingExposure;
        }

        if (rendererConfig?.colorSpace) {
            renderer.outputColorSpace = rendererConfig.colorSpace;
        }

        return renderer;
    }

    /**
     * Add a light to the scene with configuration
     */
    public addLight(config: LightConfig): THREE.Light {
        let light: THREE.Light;

        switch (config.type) {
            case 'ambient':
                light = new THREE.AmbientLight(config.color, config.intensity);
                break;

            case 'directional':
                light = new THREE.DirectionalLight(config.color, config.intensity);
                if (config.position) {
                    light.position.copy(config.position);
                }
                if (config.castShadow) {
                    light.castShadow = true;
                    if (light.shadow) {
                        const shadowMapSize = config.shadowMapSize || 2048;
                        light.shadow.mapSize.width = shadowMapSize;
                        light.shadow.mapSize.height = shadowMapSize;
                        
                        if (config.shadowCamera && light.shadow.camera) {
                            const cam = light.shadow.camera as THREE.OrthographicCamera;
                            cam.left = config.shadowCamera.left || -500;
                            cam.right = config.shadowCamera.right || 500;
                            cam.top = config.shadowCamera.top || 500;
                            cam.bottom = config.shadowCamera.bottom || -500;
                            cam.near = config.shadowCamera.near || 0.5;
                            cam.far = config.shadowCamera.far || 1000;
                        }
                    }
                }
                break;

            case 'hemisphere':
                light = new THREE.HemisphereLight(
                    config.color,
                    config.groundColor || 0x444444,
                    config.intensity
                );
                if (config.position) {
                    light.position.copy(config.position);
                }
                break;

            case 'point':
                light = new THREE.PointLight(config.color, config.intensity);
                if (config.position) {
                    light.position.copy(config.position);
                }
                if (config.castShadow) {
                    light.castShadow = true;
                    if (light.shadow) {
                        const shadowMapSize = config.shadowMapSize || 1024;
                        light.shadow.mapSize.width = shadowMapSize;
                        light.shadow.mapSize.height = shadowMapSize;
                    }
                }
                break;

            case 'spot':
                light = new THREE.SpotLight(config.color, config.intensity);
                if (config.position) {
                    light.position.copy(config.position);
                }
                if (config.castShadow) {
                    light.castShadow = true;
                    if (light.shadow) {
                        const shadowMapSize = config.shadowMapSize || 1024;
                        light.shadow.mapSize.width = shadowMapSize;
                        light.shadow.mapSize.height = shadowMapSize;
                    }
                }
                break;

            default:
                throw new Error(`Unsupported light type: ${config.type}`);
        }

        this.lights.push(light);
        this.scene.add(light);
        return light;
    }

    /**
     * Add multiple lights at once
     */
    public addLights(configs: LightConfig[]): THREE.Light[] {
        return configs.map(config => this.addLight(config));
    }

    /**
     * Setup standard lighting configuration for outdoor scenes
     */
    public setupStandardLighting(): void {
        // Enhanced ambient light for global illumination
        this.addLight({
            type: 'ambient',
            color: 0x87CEEB,
            intensity: 0.6
        });

        // Main directional light (sun)
        this.addLight({
            type: 'directional',
            color: 0xfff8dc,
            intensity: 1.5,
            position: new THREE.Vector3(10, 20, 5),
            castShadow: true,
            shadowMapSize: 4096,
            shadowCamera: {
                left: -500,
                right: 500,
                top: 500,
                bottom: -500,
                near: 0.5,
                far: 1000
            }
        });

        // Add hemisphere light for sky bounce lighting
        this.addLight({
            type: 'hemisphere',
            color: 0x87CEEB,
            groundColor: 0x8B7355,
            intensity: 0.4,
            position: new THREE.Vector3(0, 50, 0)
        });

        // Add rim lighting from opposite direction
        this.addLight({
            type: 'directional',
            color: 0x4A90E2,
            intensity: 0.3,
            position: new THREE.Vector3(-5, 5, -5)
        });
    }

    /**
     * Handle window resize
     */
    public resize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    /**
     * Render the scene
     */
    public render(): void {
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Get delta time from clock
     */
    public getDelta(): number {
        return this.clock.getDelta();
    }

    /**
     * Get elapsed time from clock
     */
    public getElapsedTime(): number {
        return this.clock.getElapsedTime();
    }

    /**
     * Add an object to the scene
     */
    public add(object: THREE.Object3D): void {
        this.scene.add(object);
    }

    /**
     * Remove an object from the scene
     */
    public remove(object: THREE.Object3D): void {
        this.scene.remove(object);
    }

    /**
     * Get all lights in the scene
     */
    public getLights(): THREE.Light[] {
        return [...this.lights];
    }

    /**
     * Remove all lights from the scene
     */
    public clearLights(): void {
        this.lights.forEach(light => this.scene.remove(light));
        this.lights = [];
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.renderer.dispose();
        this.clearLights();
    }

    /**
     * Static factory method for quick setup
     */
    public static createStandardSetup(canvas: HTMLCanvasElement): ThreeManager {
        return new ThreeManager({
            canvas,
            camera: {
                fov: 75,
                near: 0.1,
                far: 2000,
                position: new THREE.Vector3(-30, 30, 50),
                lookAt: new THREE.Vector3(0, 20, 0)
            },
            renderer: {
                antialias: true,
                clearColor: 0x000000,
                alpha: 1,
                shadows: true,
                shadowType: THREE.PCFSoftShadowMap,
                toneMapping: THREE.ACESFilmicToneMapping,
                toneMappingExposure: 1.2,
                colorSpace: THREE.SRGBColorSpace
            },
            scene: {
                background: new THREE.Color(0x1a1a2e),
                fog: {
                    color: 0x80A4E2,
                    near: 100,
                    far: 600
                }
            }
        });
    }
}