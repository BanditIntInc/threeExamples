import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ThreeManager } from './shared/ThreeManager';
import { LoadingBar } from '../../utils/LoadingBar';
import { logger } from '../../utils/logger';

export class ThreeSceneB {
    public readonly message: string = "Interactive product configurator with real-time material switching. Load glTF+Draco compressed models, customize materials, and export high-quality PNG renders.";
    
    private threeManager: ThreeManager;
    private currentModel!: THREE.Group;
    private animationId: number | null = null;
    private loadingBar: LoadingBar | null = null;
    private availableMaterials: Map<string, THREE.Material> = new Map();
    private gltfLoader: GLTFLoader = new GLTFLoader();
    private fbxLoader: FBXLoader = new FBXLoader();
    private objLoader: OBJLoader = new OBJLoader();
    private dracoLoader: DRACOLoader = new DRACOLoader();
    private rgbeLoader: RGBELoader = new RGBELoader();
    private textureLoader: THREE.TextureLoader = new THREE.TextureLoader();
    private environmentMap: THREE.Texture | null = null;
    private controls: OrbitControls | null = null;
    private currentColor: string = '#cccccc';

    constructor(canvas: HTMLCanvasElement) {
        this.threeManager = ThreeManager.createStandardSetup(canvas);
        
        this.createLoader();
        this.setupLoaders();
        this.init();
        this.setupMaterials();
        this.loadEnvironment();
        this.loadDefaultModel();
        this.setupCamera();
        this.setupControls();
        this.completeLoading();
    }


    private createLoader(): void {
        this.loadingBar = new LoadingBar('Loading Product Configurator...');
        this.loadingBar.updateProgress(10);
    }

    private setupLoaders(): void {
        this.loadingBar?.updateProgress(20);
        
        // Setup DRACO loader for compressed geometry
        this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        
        // Setup GLTF loader with DRACO support
        this.gltfLoader.setDRACOLoader(this.dracoLoader);
        
        // FBX and OBJ loaders are already initialized, no additional setup needed
        
        this.loadingBar?.updateProgress(30);
    }

    public hideLoader(): void {
        if (this.loadingBar) {
            this.loadingBar.hide();
        }
    }

    private init(): void {
        // ThreeManager handles basic setup, just need to update background
        // Note: createStandardSetup already sets background to 0x1a1a2e
        this.loadingBar?.updateProgress(40);
    }


    private setupMaterials(): void {
        this.loadingBar?.updateProgress(50);
        
        // Load wood texture
        const woodTexture = this.textureLoader.load('/textures/brown-wood.jpg');
        woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping;
        woodTexture.repeat.set(2, 2);
        
        // Create material library with enhanced PBR materials
        this.availableMaterials.set('metal', new THREE.MeshStandardMaterial({
            color: new THREE.Color(this.currentColor),
            metalness: 0.9,
            roughness: 0.1,
            envMapIntensity: 1.0
        }));
        
        this.availableMaterials.set('plastic', new THREE.MeshStandardMaterial({
            color: new THREE.Color(this.currentColor),
            metalness: 0.0,
            roughness: 0.8,
            envMapIntensity: 0.3
        }));
        
        this.availableMaterials.set('glass', new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(this.currentColor),
            metalness: 0.0,
            roughness: 0.0,
            transparent: true,
            opacity: 0.1,
            transmission: 0.9,
            ior: 1.5,
            thickness: 0.5,
            envMapIntensity: 1.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.0
        }));
        
        this.availableMaterials.set('wood', new THREE.MeshStandardMaterial({
            color: new THREE.Color(this.currentColor).multiplyScalar(0.7), // Darken color for wood
            map: woodTexture,
            metalness: 0.0,
            roughness: 0.9,
            envMapIntensity: 0.2
        }));
    }

    private async loadEnvironment(): Promise<void> {
        try {
            // Load HDR environment map for realistic lighting
            const hdrTextureUrl = 'https://threejs.org/examples/textures/equirectangular/venice_sunset_1k.hdr';
            this.environmentMap = await this.rgbeLoader.loadAsync(hdrTextureUrl);
            this.environmentMap.mapping = THREE.EquirectangularReflectionMapping;
            
            // Set as scene environment for lighting/reflections but hide background
            this.threeManager.scene.environment = this.environmentMap;
            // Keep background null to hide environment from camera while preserving reflections
            this.threeManager.scene.background = null;
            
        } catch (error) {
            logger.warn('Failed to load HDR environment, using fallback lighting', 'ThreeSceneB');
            logger.debug(error, 'ThreeSceneB');
            // Fallback to basic lighting if HDR fails
            this.setupBasicLighting();
        }
    }

    private setupBasicLighting(): void {
        // Fallback lighting if HDR environment fails
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.threeManager.scene.add(ambientLight);
        
        const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight1.position.set(10, 10, 5);
        this.threeManager.scene.add(directionalLight1);
        
        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight2.position.set(-5, 3, -5);
        this.threeManager.scene.add(directionalLight2);
    }

    private async loadDefaultModel(): Promise<void> {
        this.loadingBar?.updateProgress(60, 'Loading default model...');
        
        try {
            // Load the Table_Bell.fbx as the default model
            await this.loadModel('/models/Table_Bell.fbx', 'Table_Bell.fbx', false);
            this.loadingBar?.updateProgress(70);
            
        } catch (error) {
            logger.error('Error loading default Table_Bell model', 'ThreeSceneB');
            logger.debug(error, 'ThreeSceneB');
            logger.info('Falling back to cube geometry...', 'ThreeSceneB');
            
            // Fallback to simple cube with default material
            const geometry = new THREE.BoxGeometry(2, 2, 2);
            const defaultMaterial = this.availableMaterials.get('metal')!;
            this.currentModel = new THREE.Group();
            this.currentModel.add(new THREE.Mesh(geometry, defaultMaterial));
            this.threeManager.add(this.currentModel);
            
            this.loadingBar?.updateProgress(70);
        }
    }

    private setupCamera(): void {
        // Reset camera to a clean state - closer initial position
        this.threeManager.camera.position.set(0, 0, 3.5);
        this.threeManager.camera.lookAt(0, 0, 0);
        this.threeManager.camera.up.set(0, 1, 0);
    }

    private setupControls(): void {
        // Setup orbit controls for interactive camera movement
        this.controls = new OrbitControls(this.threeManager.camera, this.threeManager.renderer.domElement);
        
        // Configure controls
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        
        // Set distance limits
        this.controls.minDistance = 1;
        this.controls.maxDistance = 8;
        
        // Set vertical angle limits
        this.controls.maxPolarAngle = Math.PI / 2;
        
        // Auto-rotate slowly
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 1.0;
    }

    private resetCameraForModel(): void {
        if (!this.currentModel || !this.controls) return;

        // Calculate the model's bounding box to frame it properly
        const box = new THREE.Box3().setFromObject(this.currentModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        logger.debug(`📷 Framing model - Center: ${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}`, 'ThreeSceneB');
        logger.debug(`📷 Model size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`, 'ThreeSceneB');

        // Set controls target to the model center (should be close to origin due to our centering)
        this.controls.target.copy(center);
        
        // Position camera at a good distance to view the model
        const distance = maxDim * 1.8; // 1.8x the model size for closer framing
        this.threeManager.camera.position.set(
            center.x + distance,
            center.y + distance * 0.5,
            center.z + distance
        );
        
        // Make sure camera is looking at the model
        this.threeManager.camera.lookAt(center);
        
        // Update control distance limits based on model size
        this.controls.minDistance = maxDim * 0.3;
        this.controls.maxDistance = maxDim * 5;
        
        // Update controls
        this.controls.update();
        
        logger.debug(`📷 Camera positioned at: ${this.threeManager.camera.position.x.toFixed(2)}, ${this.threeManager.camera.position.y.toFixed(2)}, ${this.threeManager.camera.position.z.toFixed(2)}`, 'ThreeSceneB');
        logger.debug(`📷 Camera looking at: ${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}`, 'ThreeSceneB');
    }


    private completeLoading(): void {
        this.loadingBar?.updateProgress(100);
        
        // Auto-hide loader after brief delay to show 100%
        setTimeout(() => {
            this.hideLoader();
        }, 1000);
    }

    public animate(): void {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        // Update controls for smooth camera movement
        if (this.controls) {
            this.controls.update();
        }
        
        this.threeManager.render();
    }

    // Public methods for material switching and color changing
    public changeMaterial(materialName: string): void {
        const material = this.availableMaterials.get(materialName);
        if (material && this.currentModel) {
            this.currentModel.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.material = material;
                }
            });
        }
    }

    public changeColor(hexColor: string): void {
        this.currentColor = hexColor;
        const color = new THREE.Color(hexColor);
        
        // Update all materials with the new color
        this.availableMaterials.forEach((material, name) => {
            if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
                if (name === 'wood') {
                    // For wood, darken the color to maintain wood appearance
                    material.color.copy(color.clone().multiplyScalar(0.7));
                } else {
                    material.color.copy(color);
                }
                material.needsUpdate = true;
            }
        });
    }

    public getCurrentColor(): string {
        return this.currentColor;
    }

    public toggleAutoRotate(): boolean {
        if (this.controls) {
            this.controls.autoRotate = !this.controls.autoRotate;
            logger.info(`🔄 Auto-rotation ${this.controls.autoRotate ? 'enabled' : 'disabled'}`, 'ThreeSceneB');
            return this.controls.autoRotate;
        }
        return false;
    }

    public getAutoRotateState(): boolean {
        return this.controls?.autoRotate || false;
    }

    // Helper method to fix FBX materials with missing textures
    private fixFBXMaterials(object: THREE.Object3D): void {
        let fixedMaterials = 0;
        let totalMeshes = 0;
        
        object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                totalMeshes++;
                
                if (child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    
                    materials.forEach((material, index) => {
                        if (material instanceof THREE.MeshLambertMaterial || 
                            material instanceof THREE.MeshPhongMaterial ||
                            material instanceof THREE.MeshBasicMaterial ||
                            material instanceof THREE.MeshStandardMaterial) {
                            
                            let needsFixing = false;
                            
                            // Clear problematic texture references that might cause loading issues
                            if (material.map && !material.map.image) {
                                material.map = null;
                                needsFixing = true;
                            }
                            
                            // Only handle normalMap and bumpMap for materials that support them
                            if (material instanceof THREE.MeshPhongMaterial || material instanceof THREE.MeshStandardMaterial) {
                                if ((material as THREE.MeshPhongMaterial | THREE.MeshStandardMaterial).normalMap && 
                                    !(material as THREE.MeshPhongMaterial | THREE.MeshStandardMaterial).normalMap!.image) {
                                    (material as THREE.MeshPhongMaterial | THREE.MeshStandardMaterial).normalMap = null;
                                    needsFixing = true;
                                }
                            }
                            
                            if (material instanceof THREE.MeshPhongMaterial) {
                                if (material.bumpMap && !material.bumpMap.image) {
                                    material.bumpMap = null;
                                    needsFixing = true;
                                }
                            }
                            
                            // Set reasonable defaults for FBX materials
                            if (material instanceof THREE.MeshLambertMaterial || material instanceof THREE.MeshPhongMaterial) {
                                // Ensure material has a visible color
                                if (material.color.getHex() === 0x000000) {
                                    material.color.setHex(0xcccccc);
                                    needsFixing = true;
                                }
                            }
                            
                            // Make sure material is not transparent by accident
                            if (material.transparent && material.opacity > 0.95) {
                                material.transparent = false;
                                material.opacity = 1.0;
                                needsFixing = true;
                            }
                            
                            if (needsFixing) {
                                material.needsUpdate = true;
                                fixedMaterials++;
                                logger.debug(`🛠️ Fixed material on mesh "${child.name || 'unnamed'}" (material ${index})`, 'ThreeSceneB');
                            }
                        }
                    });
                } else {
                    // Mesh has no material, apply default
                    logger.debug(`⚠️ Mesh "${child.name || 'unnamed'}" has no material, applying default`, 'ThreeSceneB');
                    child.material = this.availableMaterials.get('metal')!.clone();
                    fixedMaterials++;
                }
            }
        });
        
        logger.info(`🛠️ Fixed FBX materials: ${fixedMaterials} materials fixed across ${totalMeshes} meshes`, 'ThreeSceneB');
    }

    // Helper method to apply current material to the loaded model
    private applyCurrentMaterialToModel(): void {
        if (!this.currentModel) return;
        
        // Get current material (default to metal if none selected)
        const materialName = 'metal'; // Default material
        const material = this.availableMaterials.get(materialName);
        
        if (material) {
            let meshCount = 0;
            this.currentModel.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.material = material;
                    meshCount++;
                    logger.debug(`🎨 Applied ${materialName} material to mesh: ${child.name || 'unnamed'}`, 'ThreeSceneB');
                }
            });
            logger.info(`🎨 Applied materials to ${meshCount} meshes`, 'ThreeSceneB');
        }
    }


    public getMaterialNames(): string[] {
        return Array.from(this.availableMaterials.keys());
    }

    // PNG Export functionality
    public exportPNG(): void {
        if (this.threeManager) {
            // Render the scene
            this.threeManager.render();
            
            // Get the canvas and create download link
            const canvas = this.threeManager.renderer.domElement;
            const link = document.createElement('a');
            link.download = 'product-render.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        }
    }

    // Unified model loading method for multiple formats
    public async loadModel(url: string, filename?: string, showLoadingBar: boolean = true): Promise<void> {
        const extension = filename ? 
            filename.toLowerCase().split('.').pop() : 
            url.toLowerCase().split('.').pop();

        const modelName = filename || url.split('/').pop() || 'unknown';
        logger.info(`📦 Loading: ${modelName} (${extension?.toUpperCase()})`, 'ThreeSceneB');

        try {
            // Show loading indicator
            if (showLoadingBar && this.loadingBar) {
                this.loadingBar.show();
                this.loadingBar.updateProgress(0, `Loading ${modelName}...`);
            }

            if (this.currentModel) {
                this.threeManager.remove(this.currentModel);
            }

            let loadedObject: THREE.Object3D;

            // Update loading progress
            if (showLoadingBar && this.loadingBar) {
                this.loadingBar.updateProgress(30, `Loading ${extension?.toUpperCase()} file...`);
            }

            switch (extension) {
                case 'gltf':
                case 'glb':
                    const gltf = await this.gltfLoader.loadAsync(url);
                    loadedObject = gltf.scene;
                    break;
                
                case 'fbx':
                    loadedObject = await this.fbxLoader.loadAsync(url);
                    // Clear any missing textures from FBX materials
                    this.fixFBXMaterials(loadedObject);
                    break;
                
                case 'obj':
                    loadedObject = await this.objLoader.loadAsync(url);
                    break;
                
                default:
                    throw new Error(`Unsupported file format: ${extension}`);
            }

            // Update progress
            if (showLoadingBar && this.loadingBar) {
                this.loadingBar.updateProgress(60, 'Processing model...');
            }

            // Create a group to hold the loaded model
            this.currentModel = new THREE.Group();
            this.currentModel.add(loadedObject);
            
            // Calculate dimensions and apply smart scaling
            const box = new THREE.Box3().setFromObject(this.currentModel);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            
            logger.debug(`📐 Original size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`, 'ThreeSceneB');
            logger.debug(`📍 Original center: ${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}`, 'ThreeSceneB');
            logger.debug(`📏 Max dimension: ${maxDim.toFixed(2)}`, 'ThreeSceneB');
            
            // Ensure we have valid dimensions
            if (maxDim === 0 || !isFinite(maxDim)) {
                logger.warn('⚠️ Model has invalid dimensions, using default scale and centering', 'ThreeSceneB');
                this.currentModel.scale.setScalar(1);
                this.currentModel.position.set(0, 0, 0);
            } else {
                // Use a reasonable target size for better visibility
                const targetSize = 3;
                const scale = targetSize / maxDim;

                logger.debug(`⚖️ Calculated scale: ${scale.toFixed(6)}`, 'ThreeSceneB');
                logger.debug(`✅ Target size will be: ${(size.x * scale).toFixed(2)} x ${(size.y * scale).toFixed(2)} x ${(size.z * scale).toFixed(2)}`, 'ThreeSceneB');
                logger.debug(`🎯 Target size: ${targetSize} units`, 'ThreeSceneB');
                
                // Apply scale first
                this.currentModel.scale.setScalar(scale);
                
                // Recalculate the bounding box after scaling
                const scaledBox = new THREE.Box3().setFromObject(this.currentModel);
                const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
                
                logger.debug(`📍 Scaled center before centering: ${scaledCenter.x.toFixed(2)}, ${scaledCenter.y.toFixed(2)}, ${scaledCenter.z.toFixed(2)}`, 'ThreeSceneB');
                
                // Center the scaled model at origin
                this.currentModel.position.set(-scaledCenter.x, -scaledCenter.y, -scaledCenter.z);
                
                logger.debug(`📍 Final position: ${this.currentModel.position.x.toFixed(2)}, ${this.currentModel.position.y.toFixed(2)}, ${this.currentModel.position.z.toFixed(2)}`, 'ThreeSceneB');
            }
            
            // Update progress
            if (showLoadingBar && this.loadingBar) {
                this.loadingBar.updateProgress(80, 'Applying materials...');
            }

            // Apply current material to all meshes in the loaded model
            this.applyCurrentMaterialToModel();
            
            // Add to scene
            this.threeManager.add(this.currentModel);
            
            // Ensure model is visible
            this.currentModel.visible = true;
            
            // Reset camera and controls to properly frame the new model
            this.resetCameraForModel();
            
            logger.info(`✅ Model added to scene with ${this.currentModel.children.length} child objects`, 'ThreeSceneB');
            
            // Debug: Log scene objects
            logger.debug(`🔍 Scene objects after loading: ${this.threeManager.scene.children.length}`, 'ThreeSceneB');
            logger.debug(`🔍 Current model position: ${this.currentModel.position.x.toFixed(2)}, ${this.currentModel.position.y.toFixed(2)}, ${this.currentModel.position.z.toFixed(2)}`, 'ThreeSceneB');
            logger.debug(`🔍 Current model scale: ${this.currentModel.scale.x.toFixed(6)}`, 'ThreeSceneB');
            logger.debug(`🔍 Current model visible: ${this.currentModel.visible}`, 'ThreeSceneB');
            
            // Debug: Check if model has geometry and materials
            let totalVertices = 0;
            let meshCount = 0;
            this.currentModel.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    meshCount++;
                    if (child.geometry) {
                        const vertices = child.geometry.attributes.position?.count || 0;
                        totalVertices += vertices;
                        logger.debug(`🔍 Mesh "${child.name || 'unnamed'}" has ${vertices} vertices, material: ${child.material?.type || 'none'}`, 'ThreeSceneB');
                        
                        // Ensure mesh has a material
                        if (!child.material) {
                            logger.debug(`⚠️ Applying default material to mesh without material`, 'ThreeSceneB');
                            child.material = this.availableMaterials.get('metal')!;
                        }
                    }
                }
            });
            logger.info(`🔍 Total vertices in model: ${totalVertices} across ${meshCount} meshes`, 'ThreeSceneB');
            
            // Complete loading
            if (showLoadingBar && this.loadingBar) {
                this.loadingBar.updateProgress(100, 'Model loaded successfully!');
                setTimeout(() => {
                    this.loadingBar?.hide();
                }, 1000);
            }
            
        } catch (error) {
            logger.error(`❌ Error loading ${extension?.toUpperCase()} model`, 'ThreeSceneB');
            logger.debug(error, 'ThreeSceneB');
            
            // Hide loading bar and show error
            if (showLoadingBar && this.loadingBar) {
                this.loadingBar.hide();
            }
            
            throw new Error(`Failed to load ${extension?.toUpperCase()} model: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }


    public resize(): void {
        this.threeManager.resize();
        
        // Update controls after resize
        if (this.controls) {
            this.controls.update();
        }
    }

    public dispose(): void {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Clean up controls
        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
        }
        
        // Clean up loader if still present
        if (this.loadingBar) {
            this.loadingBar.dispose();
            this.loadingBar = null;
        }
        
        this.threeManager.dispose();
    }
}