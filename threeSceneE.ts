import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { ThreeManager } from './shared/ThreeManager';
import { ShaderManager } from './shared/ShaderManager';
import { logger } from '../../utils/logger';

interface Asteroid {
    mesh: THREE.Object3D;
    velocity: THREE.Vector3;
    angularVelocity: THREE.Vector3;
    size: number;
}

interface Bullet {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
}

enum GameState {
    TITLE_SCREEN,
    PLAYING,
    GAME_OVER
}

export class ThreeSceneE {
    public readonly message: string = "BLASTEROIDS! - 3D Asteroids with shields and super shots!";
    
    private threeManager: ThreeManager;
    private ship!: THREE.Group;
    private asteroids: Asteroid[] = [];
    private bullets: Bullet[] = [];
    private stars!: THREE.Points;
    private animationId: number | null = null;
    private asteroidModel: THREE.Group | null = null;
    private asteroidTextures: {[key: string]: THREE.Texture} = {};
    private font: Font | null = null;
    
    // Game state
    private gameState: GameState = GameState.TITLE_SCREEN;
    private titleElements: THREE.Mesh[] = [];
    private showingTitle: boolean = false;
    
    // Game state
    private shipVelocity: THREE.Vector3 = new THREE.Vector3();
    private shipRotation: number = 0;
    private keys: { [key: string]: boolean } = {};
    private score: number = 0;
    private lives: number = 3;
    private level: number = 1;
    private lastShotTime: number = 0;
    private shields: number = 3;
    private maxShields: number = 3;
    private shieldMesh: THREE.Mesh | null = null;
    
    // Super shot system
    private chargeStartTime: number = 0;
    private isCharging: boolean = false;
    private maxChargeTime: number = 2000; // 2 seconds for full charge
    
    // Game constants
    private readonly SHIP_ACCELERATION = 0.2;
    private readonly SHIP_MAX_SPEED = 8;
    private readonly SHIP_DRAG = 0.98;
    private readonly SHIP_ROTATION_SPEED = 0.1;
    private readonly BULLET_SPEED = 2.5;
    private readonly BULLET_LIFE = 60;
    private readonly SHOT_COOLDOWN = 200; // milliseconds
    private readonly WORLD_SIZE = 120;

    constructor(canvas: HTMLCanvasElement) {
        this.threeManager = new ThreeManager({
            canvas,
            camera: {
                fov: 60,
                near: 0.1,
                far: 1000,
                position: new THREE.Vector3(0, 25, 15),
                lookAt: new THREE.Vector3(0, 0, 0)
            },
            renderer: {
                antialias: true,
                clearColor: 0x000011,
                alpha: 1,
                shadows: true,
                shadowType: THREE.PCFSoftShadowMap,
                toneMapping: THREE.ACESFilmicToneMapping,
                toneMappingExposure: 1.2
            },
            scene: {
                background: new THREE.Color(0x000011)
            }
        });
        
        this.init();
        this.createStars();
        this.loadFont();
        this.loadAsteroidModel();
        this.setupControls();
    }

    private init(): void {
        // Add lighting
        this.threeManager.addLight({
            type: 'ambient',
            color: 0x404040,
            intensity: 0.3
        });
        
        this.threeManager.addLight({
            type: 'directional',
            color: 0xffffff,
            intensity: 0.8,
            position: new THREE.Vector3(10, 20, 5),
            castShadow: true,
            shadowMapSize: 2048
        });
    }

    private async loadShip(): Promise<void> {
        const loader = new FBXLoader();
        const textureLoader = new THREE.TextureLoader();
        
        try {
            // Load all textures
            const textures = await this.loadShipTextures(textureLoader);
            
            const fbxModel = await new Promise<THREE.Group>((resolve, reject) => {
                loader.load(
                    '/models/Fighter_03.fbx',
                    (object) => resolve(object),
                    (progress) => logger.debug(`Loading ship model: ${(progress.loaded / progress.total * 100)}%`, 'ThreeSceneE'),
                    (error) => reject(error)
                );
            });
            
            this.ship = new THREE.Group();
            
            // Scale and position the FBX model (2/3 smaller)
            fbxModel.scale.setScalar(0.003); // Even smaller
            fbxModel.position.set(0, 0, 0); // Put ship back in shield center
            fbxModel.rotation.y = 0; // Face forward
            
            // Apply textures and enhance materials for all meshes
            fbxModel.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.renderOrder = 1; // Render ship in front of shield
                    
                    // Apply appropriate material based on mesh name
                    this.applyShipMaterial(child, textures);
                }
            });
            
            // Add thruster flames (keep original thruster system)
            const thrusterGroup = new THREE.Group();
            for (let i = 0; i < 3; i++) {
                const angle = (i * Math.PI * 2) / 3;
                const thrusterGeometry = new THREE.ConeGeometry(0.15, 0.8, 6);
                const thrusterMaterial = new THREE.MeshBasicMaterial({ 
                    color: i === 0 ? 0xff6600 : 0xff3300,
                    transparent: true,
                    opacity: 0.9
                });
                const thrusterMesh = new THREE.Mesh(thrusterGeometry, thrusterMaterial);
                thrusterMesh.rotation.x = -Math.PI / 2;
                thrusterMesh.position.x = Math.cos(angle) * 0.4;
                thrusterMesh.position.y = Math.sin(angle) * 0.4;
                thrusterMesh.position.z = -1.6;
                thrusterGroup.add(thrusterMesh);
            }
            thrusterGroup.visible = false;
            
            this.ship.add(fbxModel);
            this.ship.add(thrusterGroup);
            this.ship.position.set(0, 0.5, 0);
            
            // Create shield
            this.createShield();
            
            this.threeManager.add(this.ship);
            
            // Now create asteroids after ship is loaded
            this.createAsteroids();
            
        } catch (error) {
            logger.error('Failed to load ship model: ' + error, 'ThreeSceneE');
            // Fallback to original ship geometry
            this.createFallbackShip();
            this.createAsteroids();
        }
    }
    
    private createFallbackShip(): void {
        this.ship = new THREE.Group();
        
        // Original ship geometry as fallback
        const shipGeometry = new THREE.ConeGeometry(0.8, 2.5, 3);
        const shipMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x888888,
            shininess: 100,
            specular: 0x222222
        });
        const shipMesh = new THREE.Mesh(shipGeometry, shipMaterial);
        shipMesh.rotation.x = Math.PI / 2;
        shipMesh.castShadow = true;
        shipMesh.receiveShadow = true;
        
        const thrusterGroup = new THREE.Group();
        for (let i = 0; i < 3; i++) {
            const angle = (i * Math.PI * 2) / 3;
            const thrusterGeometry = new THREE.ConeGeometry(0.15, 0.8, 6);
            const thrusterMaterial = new THREE.MeshBasicMaterial({ 
                color: i === 0 ? 0xff6600 : 0xff3300,
                transparent: true,
                opacity: 0.9
            });
            const thrusterMesh = new THREE.Mesh(thrusterGeometry, thrusterMaterial);
            thrusterMesh.rotation.x = -Math.PI / 2;
            thrusterMesh.position.x = Math.cos(angle) * 0.4;
            thrusterMesh.position.y = Math.sin(angle) * 0.4;
            thrusterMesh.position.z = -1.6;
            thrusterGroup.add(thrusterMesh);
        }
        thrusterGroup.visible = false;
        
        this.ship.add(shipMesh);
        this.ship.add(thrusterGroup);
        this.ship.position.set(0, 0.5, 0);
        
        // Create shield for fallback ship too
        this.createShield();
        
        this.threeManager.add(this.ship);
    }
    
    private async loadShipTextures(textureLoader: THREE.TextureLoader): Promise<{[key: string]: {[key: string]: THREE.Texture}}> {
        const basePath = '/src/assets/Unity_5_Textures/';
        const materials = ['Body', 'Blue_Lights', 'Rear_Lights', 'White_Lights', 'Windows'];
        const textureTypes = ['AlbedoTransparency', 'Normal', 'MetallicSmoothness', 'AO', 'Emission'];
        
        const textures: {[key: string]: {[key: string]: THREE.Texture}} = {};
        
        for (const material of materials) {
            textures[material] = {};
            
            for (const textureType of textureTypes) {
                const filename = `Fighter_03_${material}_${textureType}.png`;
                const path = basePath + filename;
                
                try {
                    const texture = await new Promise<THREE.Texture>((resolve, reject) => {
                        textureLoader.load(
                            path,
                            (tex) => {
                                tex.wrapS = THREE.RepeatWrapping;
                                tex.wrapT = THREE.RepeatWrapping;
                                tex.flipY = false;
                                if (textureType === 'Normal') {
                                    tex.colorSpace = THREE.LinearSRGBColorSpace;
                                }
                                resolve(tex);
                            },
                            undefined,
                            (error) => {
                                logger.warn(`Failed to load texture: ${path} - ${error}`, 'ThreeSceneE');
                                reject(error);
                            }
                        );
                    });
                    
                    textures[material][textureType] = texture;
                } catch (error) {
                    logger.warn(`Skipping texture: ${filename}`, 'ThreeSceneE');
                }
            }
        }
        
        return textures;
    }
    
    private applyShipMaterial(mesh: THREE.Mesh, textures: {[key: string]: {[key: string]: THREE.Texture}}): void {
        const meshName = mesh.name.toLowerCase();
        
        // Determine material type based on mesh name
        let materialType = 'Body'; // default
        
        if (meshName.includes('blue') || meshName.includes('light') && meshName.includes('blue')) {
            materialType = 'Blue_Lights';
        } else if (meshName.includes('rear') || meshName.includes('back')) {
            materialType = 'Rear_Lights';
        } else if (meshName.includes('white') || meshName.includes('light') && meshName.includes('white')) {
            materialType = 'White_Lights';
        } else if (meshName.includes('window') || meshName.includes('glass') || meshName.includes('cockpit')) {
            materialType = 'Windows';
        }
        
        const materialTextures = textures[materialType];
        if (!materialTextures) {
            logger.warn(`No textures found for material type: ${materialType}`, 'ThreeSceneE');
            return;
        }
        
        // Create PBR material with all available textures
        const material = new THREE.MeshStandardMaterial({
            name: `Fighter_${materialType}`,
            map: materialTextures.AlbedoTransparency || null,
            normalMap: materialTextures.Normal || null,
            metalnessMap: materialTextures.MetallicSmoothness || null,
            roughnessMap: materialTextures.MetallicSmoothness || null,
            aoMap: materialTextures.AO || null,
            emissiveMap: materialTextures.Emission || null,
        });
        
        // Configure material properties
        if (materialTextures.AlbedoTransparency) {
            material.transparent = true;
            material.alphaTest = 0.1;
        }
        
        if (materialTextures.Emission) {
            material.emissive = new THREE.Color(0x222222);
            material.emissiveIntensity = 1.0;
        }
        
        if (materialTextures.MetallicSmoothness) {
            material.metalness = 1.0;
            material.roughness = 0.1;
        } else {
            material.metalness = 0.2;
            material.roughness = 0.8;
        }
        
        // Special handling for different material types
        if (materialType === 'Windows') {
            material.transparent = true;
            material.opacity = 0.8;
            // transmission and ior not available on MeshStandardMaterial
            material.metalness = 0.1;
            material.roughness = 0.1;
        } else if (materialType.includes('Lights')) {
            material.emissive = new THREE.Color(0x004488);
            material.emissiveIntensity = 2.0;
        }
        
        mesh.material = material;
    }
    
    private createShield(): void {
        const shieldGeometry = new THREE.SphereGeometry(3, 32, 16);
        
        // Use ShaderManager to create the shield material
        const shieldMaterial = ShaderManager.createMaterial('shield', {
            opacity: 0.5,
            color: new THREE.Color(0x00aaff)
        });
        
        // Override specific material properties
        shieldMaterial.side = THREE.DoubleSide;
        shieldMaterial.blending = THREE.AdditiveBlending;
        
        this.shieldMesh = new THREE.Mesh(shieldGeometry, shieldMaterial);
        this.shieldMesh.visible = this.shields > 0;
        this.shieldMesh.position.set(0, 0, 0); // Shield back at center with ship
        this.shieldMesh.renderOrder = -1; // Render shield behind ship
        
        this.ship.add(this.shieldMesh);
    }
    
    private updateShieldVisual(): void {
        if (!this.shieldMesh) return;
        
        this.shieldMesh.visible = this.shields > 0;
        
        if (this.shields > 0) {
            const material = this.shieldMesh.material as THREE.ShaderMaterial;
            
            // Shield opacity based on remaining shields
            let baseOpacity = 0.3 + (this.shields / this.maxShields) * 0.4;
            
            // Shield color based on health
            if (material.uniforms['color']) {
                if (this.shields === 3) {
                    material.uniforms['color'].value.setHex(0x00aaff); // Blue - full
                } else if (this.shields === 2) {
                    material.uniforms['color'].value.setHex(0xffaa00); // Orange - damaged
                } else {
                    material.uniforms['color'].value.setHex(0xff4400); // Red - critical
                }
            }
            
            // Pulse effect when low on shields
            if (this.shields === 1) {
                const time = Date.now() * 0.008;
                baseOpacity = 0.5 + Math.sin(time) * 0.3;
            }
            
            if (material.uniforms['opacity']) {
                material.uniforms['opacity'].value = baseOpacity;
            }
        }
    }
    
    private async loadAsteroidModel(): Promise<void> {
        const loader = new FBXLoader();
        const textureLoader = new THREE.TextureLoader();
        
        try {
            // Load asteroid textures
            await this.loadAsteroidTextures(textureLoader);
            
            // Load asteroid FBX model
            this.asteroidModel = await new Promise<THREE.Group>((resolve, reject) => {
                loader.load(
                    '/models/Asteroid_1e.fbx',
                    (object) => resolve(object),
                    (progress) => logger.debug(`Loading asteroid model: ${(progress.loaded / progress.total * 100)}%`, 'ThreeSceneE'),
                    (error) => reject(error)
                );
            });
            
            // Apply textures to the asteroid model
            this.asteroidModel.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    this.applyAsteroidMaterial(child);
                }
            });
            
            logger.info('Asteroid model loaded successfully', 'ThreeSceneE');
        } catch (error) {
            logger.error('Failed to load asteroid model: ' + error, 'ThreeSceneE');
        }
    }
    
    private async loadAsteroidTextures(textureLoader: THREE.TextureLoader): Promise<void> {
        const basePath = '/src/assets/Asteroid_1e_FBX/2K/';
        const textureFiles = {
            color: 'Asteroid1e_Color_2K.png',
            normal: 'Asteroid1e_NormalOpenGL_2K.png', // Using OpenGL version
            metalness: 'Asteroid1e_Metalness_2K.png',
            roughness: 'Asteroid1e_Roughness_2K.png',
            ao: 'Asteroid1e_AO_2K.png',
            displacement: 'Asteroid1e_Displacement_2K.png'
        };
        
        for (const [type, filename] of Object.entries(textureFiles)) {
            try {
                const texture = await new Promise<THREE.Texture>((resolve, reject) => {
                    textureLoader.load(
                        basePath + filename,
                        (tex) => {
                            tex.wrapS = THREE.RepeatWrapping;
                            tex.wrapT = THREE.RepeatWrapping;
                            tex.flipY = false;
                            if (type === 'normal') {
                                tex.colorSpace = THREE.LinearSRGBColorSpace;
                            }
                            resolve(tex);
                        },
                        undefined,
                        (error) => reject(error)
                    );
                });
                
                this.asteroidTextures[type] = texture;
            } catch (error) {
                logger.warn(`Failed to load asteroid texture: ${filename} - ${error}`, 'ThreeSceneE');
            }
        }
    }
    
    private applyAsteroidMaterial(mesh: THREE.Mesh): void {
        const material = new THREE.MeshStandardMaterial({
            name: 'Asteroid_Material',
            map: this.asteroidTextures.color || null,
            normalMap: this.asteroidTextures.normal || null,
            metalnessMap: this.asteroidTextures.metalness || null,
            roughnessMap: this.asteroidTextures.roughness || null,
            aoMap: this.asteroidTextures.ao || null,
            displacementMap: this.asteroidTextures.displacement || null,
            displacementScale: 0.1,
            metalness: 0.1,
            roughness: 0.9
        });
        
        mesh.material = material;
    }
    
    private createAsteroids(): void {
        const asteroidCount = 5 + this.level * 2;
        
        for (let i = 0; i < asteroidCount; i++) {
            this.createAsteroid(3); // Large asteroids
        }
    }
    
    private createAsteroid(size: number): void {
        if (!this.asteroidModel) {
            logger.warn('Asteroid model not loaded, skipping asteroid creation', 'ThreeSceneE');
            return;
        }
        
        // Clone the asteroid model
        const asteroidClone = this.asteroidModel.clone();
        
        // Scale based on size (1 = small, 2 = medium, 3 = large) - tiny scale
        const scaleMultiplier = size * 0.005;
        asteroidClone.scale.setScalar(scaleMultiplier);
        
        // Random rotation
        asteroidClone.rotation.x = Math.random() * Math.PI * 2;
        asteroidClone.rotation.y = Math.random() * Math.PI * 2;
        asteroidClone.rotation.z = Math.random() * Math.PI * 2;
        
        // Random position (avoid ship area)
        let x, z;
        do {
            x = (Math.random() - 0.5) * this.WORLD_SIZE * 0.6;
            z = (Math.random() - 0.5) * this.WORLD_SIZE * 0.6;
        } while (Math.sqrt(x * x + z * z) < 15);
        
        asteroidClone.position.set(x, Math.random() * 2 - 1, z);
        
        // Ensure all meshes in the clone have materials applied
        asteroidClone.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (!child.material || !child.material.map) {
                    this.applyAsteroidMaterial(child);
                }
            }
        });
        
        const asteroid: Asteroid = {
            mesh: asteroidClone,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                0,
                (Math.random() - 0.5) * 0.5
            ),
            angularVelocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.015,
                (Math.random() - 0.5) * 0.015,
                (Math.random() - 0.5) * 0.015
            ),
            size
        };
        
        this.asteroids.push(asteroid);
        this.threeManager.add(asteroidClone);
    }
    
    private setupControls(): void {
        window.addEventListener('keydown', (event) => {
            this.keys[event.code.toLowerCase()] = true;
            
            // Handle title screen
            if (this.gameState === GameState.TITLE_SCREEN && event.code === 'Space') {
                this.startGame();
                event.preventDefault();
            }
        });
        
        window.addEventListener('keyup', (event) => {
            this.keys[event.code.toLowerCase()] = false;
        });
    }
    
    private startGame(): void {
        this.gameState = GameState.PLAYING;
        
        // Hide title screen
        if (this.titleElements.length > 0) {
            this.titleElements.forEach(element => {
                this.threeManager.scene.remove(element);
                if (element.geometry) element.geometry.dispose();
                if (element.material) {
                    if (Array.isArray(element.material)) {
                        element.material.forEach(mat => mat.dispose());
                    } else {
                        element.material.dispose();
                    }
                }
            });
            this.titleElements = [];
        }
        this.showingTitle = false;
        
        // Load and start the game
        this.loadShip();
    }

    private createStars(): void {
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 3000;
        
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);
        
        for (let i = 0; i < starCount; i++) {
            // Much wider and more random distribution
            const i3 = i * 3;
            
            // Create spherical distribution instead of cubic
            const radius = 80 + Math.random() * 120; // Distance from center
            const theta = Math.random() * Math.PI * 2; // Azimuth
            const phi = Math.acos(2 * Math.random() - 1); // Polar angle for uniform sphere distribution
            
            positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = radius * Math.cos(phi);
            
            // Random star colors (white, blue-white, yellow-white)
            const colorVariation = Math.random();
            if (colorVariation < 0.7) {
                // White stars
                colors[i3] = 1;
                colors[i3 + 1] = 1;
                colors[i3 + 2] = 1;
            } else if (colorVariation < 0.85) {
                // Blue-white stars
                colors[i3] = 0.8;
                colors[i3 + 1] = 0.9;
                colors[i3 + 2] = 1;
            } else {
                // Yellow-white stars
                colors[i3] = 1;
                colors[i3 + 1] = 0.9;
                colors[i3 + 2] = 0.7;
            }
            
            // Random star sizes
            sizes[i] = Math.random() * 0.8 + 0.2;
        }
        
        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const starMaterial = new THREE.PointsMaterial({
            size: 1.5,
            transparent: true,
            opacity: 0.9,
            vertexColors: true,
            sizeAttenuation: false
        });
        
        this.stars = new THREE.Points(starGeometry, starMaterial);
        this.threeManager.add(this.stars);
    }
    
    private async loadFont(): Promise<void> {
        const loader = new FontLoader();
        
        try {
            this.font = await new Promise<Font>((resolve, reject) => {
                loader.load(
                    'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json',
                    (font) => resolve(font),
                    undefined,
                    (error) => reject(error)
                );
            });
            
            // Create title screen once font is loaded
            this.createTitleScreen();
        } catch (error) {
            logger.error('Failed to load font: ' + error, 'ThreeSceneE');
            // Fallback to canvas-based text if font loading fails
            this.createFallbackTitleScreen();
        }
    }

    private createTitleScreen(): void {
        if (!this.font) {
            logger.warn('Font not loaded, using fallback title screen', 'ThreeSceneE');
            this.createFallbackTitleScreen();
            return;
        }

        // Remove existing title elements
        if (this.titleElements.length > 0) {
            this.titleElements.forEach(element => {
                this.threeManager.scene.remove(element);
                if (element.geometry) element.geometry.dispose();
                if (element.material) {
                    if (Array.isArray(element.material)) {
                        element.material.forEach(mat => mat.dispose());
                    } else {
                        element.material.dispose();
                    }
                }
            });
            this.titleElements = [];
        }

        // Create "BLASTEROIDS!" title using 3D text geometry
        const titleMesh = this.create3DTextGeometry('BLASTEROIDS!', {
            size: 3,
            depth: 0.5,
            position: { x: 0, y: 5, z: 0 },
            color: 0x00aaff,
            emissiveColor: 0x002244
        });
        this.threeManager.scene.add(titleMesh);
        this.titleElements.push(titleMesh);

        // Create "Press Spacebar to Start" subtitle
        const subtitleMesh = this.create3DTextGeometry('PRESS SPACEBAR TO START', {
            size: 1,
            depth: 0.2,
            position: { x: 0, y: 0, z: 0 },
            color: 0xffffff,
            emissiveColor: 0x111111
        });
        this.threeManager.scene.add(subtitleMesh);
        this.titleElements.push(subtitleMesh);

        this.showingTitle = true;
    }

    private create3DTextGeometry(text: string, options: {
        size: number;
        depth: number;
        position: { x: number; y: number; z: number };
        color: number;
        emissiveColor: number;
    }): THREE.Mesh {
        if (!this.font) {
            throw new Error('Font not loaded');
        }

        const textGeometry = new TextGeometry(text, {
            font: this.font,
            size: options.size,
            depth: options.depth,
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 0.1,
            bevelSize: 0.05,
            bevelOffset: 0,
            bevelSegments: 5
        });

        // Center the text geometry
        textGeometry.computeBoundingBox();
        const centerOffsetX = textGeometry.boundingBox ? 
            -0.5 * (textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x) : 0;
        const centerOffsetY = textGeometry.boundingBox ? 
            -0.5 * (textGeometry.boundingBox.max.y - textGeometry.boundingBox.min.y) : 0;

        textGeometry.translate(centerOffsetX, centerOffsetY, 0);

        const material = new THREE.MeshStandardMaterial({
            color: options.color,
            emissive: options.emissiveColor,
            emissiveIntensity: 0.3,
            metalness: 0.4,
            roughness: 0.2
        });

        const mesh = new THREE.Mesh(textGeometry, material);
        mesh.position.set(options.position.x, options.position.y, options.position.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        return mesh;
    }

    private createFallbackTitleScreen(): void {
        // Fallback to canvas-based text if 3D text fails
        logger.info('Using fallback canvas-based title screen', 'ThreeSceneE');
        
        // Remove existing title elements
        if (this.titleElements.length > 0) {
            this.titleElements.forEach(element => {
                this.threeManager.scene.remove(element);
                if (element.geometry) element.geometry.dispose();
                if (element.material) {
                    if (Array.isArray(element.material)) {
                        element.material.forEach(mat => mat.dispose());
                    } else {
                        element.material.dispose();
                    }
                }
            });
            this.titleElements = [];
        }

        // Create simple geometric title
        const titleGroup = new THREE.Group();
        
        const titleMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x00aaff,
            emissive: 0x002244,
            emissiveIntensity: 0.3
        });
        
        const titleGeometry = new THREE.BoxGeometry(18, 3, 0.5);
        const titleMesh = new THREE.Mesh(titleGeometry, titleMaterial);
        titleMesh.position.set(0, 5, 0);
        titleGroup.add(titleMesh);
        
        const subtitleMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            emissive: 0x111111,
            emissiveIntensity: 0.2
        });
        
        const subtitleGeometry = new THREE.BoxGeometry(15, 1, 0.2);
        const subtitleMesh = new THREE.Mesh(subtitleGeometry, subtitleMaterial);
        subtitleMesh.position.set(0, 0, 0);
        titleGroup.add(subtitleMesh);
        
        this.threeManager.scene.add(titleGroup);
        this.titleElements.push(titleMesh, subtitleMesh);
        this.showingTitle = true;
    }


    private shoot(isSuper: boolean = false): void {
        const currentTime = Date.now();
        if (this.bullets.length < 4 && currentTime - this.lastShotTime > this.SHOT_COOLDOWN) {
            this.lastShotTime = currentTime;
            
            // Super shot or regular shot
            let bulletGeometry: THREE.BufferGeometry;
            let bulletMaterial: THREE.MeshBasicMaterial;
            let glowGeometry: THREE.SphereGeometry;
            let glowMaterial: THREE.MeshBasicMaterial;
            let bulletSpeed = this.BULLET_SPEED;
            
            if (isSuper) {
                // Super shot - larger and more powerful
                bulletGeometry = new THREE.CapsuleGeometry(0.25, 1.2, 6, 12);
                bulletMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0xff6600,
                    transparent: true,
                    opacity: 1.0
                });
                
                glowGeometry = new THREE.SphereGeometry(0.5, 12, 12);
                glowMaterial = new THREE.MeshBasicMaterial({
                    color: 0xff6600,
                    transparent: true,
                    opacity: 0.6
                });
                
                bulletSpeed = this.BULLET_SPEED * 1.5;
            } else {
                // Regular shot
                bulletGeometry = new THREE.CapsuleGeometry(0.12, 0.6, 4, 8);
                bulletMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0x00ffff,
                    transparent: true,
                    opacity: 1.0
                });
                
                glowGeometry = new THREE.SphereGeometry(0.25, 8, 8);
                glowMaterial = new THREE.MeshBasicMaterial({
                    color: 0x00ffff,
                    transparent: true,
                    opacity: 0.4
                });
            }
            
            const bulletMesh = new THREE.Mesh(bulletGeometry, bulletMaterial);
            const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
            bulletMesh.add(glowMesh);
            
            // Position bullet at ship nose
            const shipForward = new THREE.Vector3(0, 0, 1.2);
            shipForward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.shipRotation);
            bulletMesh.position.copy(this.ship.position);
            bulletMesh.position.add(shipForward);
            bulletMesh.position.y = this.ship.position.y;
            
            // Calculate firing direction based on ship rotation
            const direction = new THREE.Vector3(0, 0, 1);
            direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.shipRotation);
            
            // Orient bullet to match direction
            bulletMesh.lookAt(
                bulletMesh.position.x + direction.x,
                bulletMesh.position.y,
                bulletMesh.position.z + direction.z
            );
            bulletMesh.rotateX(Math.PI / 2);
            
            const bullet: Bullet = {
                mesh: bulletMesh,
                velocity: direction.multiplyScalar(bulletSpeed),
                life: isSuper ? this.BULLET_LIFE * 2 : this.BULLET_LIFE
            };
            
            // Store bullet type for collision detection
            (bullet as any).isSuper = isSuper;
            
            this.bullets.push(bullet);
            this.threeManager.add(bulletMesh);
        }
    }
    
    private updateShip(): void {
        if (!this.ship) return;
        
        // Find thruster group (should be the last child)
        const thrusterGroup = this.ship.children[this.ship.children.length - 1];
        if (thrusterGroup) {
            thrusterGroup.visible = false;
        }
        
        // Rotation
        if (this.keys['keya'] || this.keys['arrowleft']) {
            this.shipRotation += this.SHIP_ROTATION_SPEED;
        }
        if (this.keys['keyd'] || this.keys['arrowright']) {
            this.shipRotation -= this.SHIP_ROTATION_SPEED;
        }
        
        // Thrust
        if (this.keys['keyw'] || this.keys['arrowup']) {
            const thrust = new THREE.Vector3(0, 0, this.SHIP_ACCELERATION);
            thrust.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.shipRotation);
            this.shipVelocity.add(thrust);
            if (thrusterGroup) {
                thrusterGroup.visible = true;
            }
        }
        
        // Limit speed
        if (this.shipVelocity.length() > this.SHIP_MAX_SPEED) {
            this.shipVelocity.normalize().multiplyScalar(this.SHIP_MAX_SPEED);
        }
        
        // Apply drag
        this.shipVelocity.multiplyScalar(this.SHIP_DRAG);
        
        // Update position
        this.ship.position.add(this.shipVelocity);
        this.ship.rotation.y = this.shipRotation;
        
        // Wrap around world
        this.wrapPosition(this.ship.position);
        
        // Handle charging system
        if (this.keys['space']) {
            if (!this.isCharging) {
                // Start charging
                this.isCharging = true;
                this.chargeStartTime = Date.now();
            }
        } else {
            if (this.isCharging) {
                // Release shot
                const chargeTime = Date.now() - this.chargeStartTime;
                const isSuper = chargeTime >= this.maxChargeTime;
                this.shoot(isSuper);
                this.isCharging = false;
            }
        }
        
        // Update shield visual
        this.updateShieldVisual();
    }
    
    private updateAsteroids(): void {
        this.asteroids.forEach(asteroid => {
            asteroid.mesh.position.add(asteroid.velocity);
            asteroid.mesh.rotation.x += asteroid.angularVelocity.x;
            asteroid.mesh.rotation.y += asteroid.angularVelocity.y;
            asteroid.mesh.rotation.z += asteroid.angularVelocity.z;
            
            this.wrapPosition(asteroid.mesh.position);
        });
    }
    
    private updateBullets(): void {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            if (!bullet) continue;
            
            bullet.mesh.position.add(bullet.velocity);
            bullet.life--;
            
            this.wrapPosition(bullet.mesh.position);
            
            if (bullet.life <= 0) {
                this.threeManager.remove(bullet.mesh);
                this.bullets.splice(i, 1);
            }
        }
    }
    
    private wrapPosition(position: THREE.Vector3): void {
        const halfSize = this.WORLD_SIZE / 2;
        
        if (position.x > halfSize) position.x = -halfSize;
        if (position.x < -halfSize) position.x = halfSize;
        if (position.z > halfSize) position.z = -halfSize;
        if (position.z < -halfSize) position.z = halfSize;
    }
    
    public animate(): void {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        // Always update stars
        this.stars.rotation.y += 0.0005;
        this.stars.rotation.x += 0.0003;
        
        // Update title screen animation
        if (this.gameState === GameState.TITLE_SCREEN && this.titleElements.length > 0) {
            const time = Date.now() * 0.001;
            
            // Animate title text
            if (this.titleElements[0]) {
                this.titleElements[0].rotation.y = Math.sin(time * 0.5) * 0.1;
            }
            
            // Pulse instruction text
            if (this.titleElements[1]) {
                const material = this.titleElements[1].material as THREE.MeshStandardMaterial;
                material.opacity = 0.5 + Math.sin(time * 3) * 0.3;
            }
        }
        
        // Only update game elements when playing
        if (this.gameState === GameState.PLAYING) {
            this.updateShip();
            this.updateAsteroids();
            this.updateBullets();
            this.checkCollisions();
        }
        
        this.threeManager.render();
    }
    
    private checkCollisions(): void {
        // Bullet-Asteroid collisions
        for (let b = this.bullets.length - 1; b >= 0; b--) {
            const bullet = this.bullets[b];
            if (!bullet) continue;
            
            for (let a = this.asteroids.length - 1; a >= 0; a--) {
                const asteroid = this.asteroids[a];
                if (!asteroid) continue;
                
                const distance = bullet.mesh.position.distanceTo(asteroid.mesh.position);
                
                if (distance < asteroid.size * 0.5 + 1.0) {
                    // Bullet hit asteroid - create explosion effect
                    this.createExplosion(asteroid.mesh.position.clone());
                    
                    this.threeManager.remove(bullet.mesh);
                    this.bullets.splice(b, 1);
                    
                    // Super shots destroy all sizes, regular shots work normally
                    const isSuper = (bullet as any).isSuper;
                    if (isSuper) {
                        // Super shot destroys asteroid completely without fragments
                        this.threeManager.remove(asteroid.mesh);
                        this.asteroids.splice(a, 1);
                        this.score += asteroid.size * 200; // Double points for super shot
                    } else {
                        this.destroyAsteroid(a);
                        this.score += asteroid.size * 100;
                    }
                    break;
                }
            }
        }
        
        // Ship-Asteroid collisions
        this.asteroids.forEach(asteroid => {
            const distance = this.ship.position.distanceTo(asteroid.mesh.position);
            if (distance < asteroid.size * 0.5 + 2.0) {
                this.createExplosion(this.ship.position.clone());
                this.playerHit();
            }
        });
        
        // Asteroid-Asteroid collisions
        this.checkAsteroidCollisions();
        
        // Check if all asteroids destroyed
        if (this.asteroids.length === 0) {
            this.nextLevel();
        }
    }
    
    private checkAsteroidCollisions(): void {
        for (let i = 0; i < this.asteroids.length; i++) {
            for (let j = i + 1; j < this.asteroids.length; j++) {
                const asteroid1 = this.asteroids[i];
                const asteroid2 = this.asteroids[j];
                
                if (!asteroid1 || !asteroid2) continue;
                
                const distance = asteroid1.mesh.position.distanceTo(asteroid2.mesh.position);
                const minDistance = (asteroid1.size * 0.5 + asteroid2.size * 0.5) * 0.8;
                
                if (distance < minDistance) {
                    // Collision detected - apply physics
                    this.handleAsteroidCollision(asteroid1, asteroid2);
                }
            }
        }
    }
    
    private handleAsteroidCollision(asteroid1: Asteroid, asteroid2: Asteroid): void {
        // Calculate collision normal
        const collisionNormal = new THREE.Vector3()
            .subVectors(asteroid2.mesh.position, asteroid1.mesh.position)
            .normalize();
        
        // Get relative velocity
        const relativeVelocity = new THREE.Vector3()
            .subVectors(asteroid1.velocity, asteroid2.velocity);
        
        // Calculate relative velocity in collision normal direction
        const velAlongNormal = relativeVelocity.dot(collisionNormal);
        
        // Do not resolve if velocities are separating
        if (velAlongNormal > 0) return;
        
        // Calculate restitution (bounciness)
        const restitution = 0.6;
        
        // Calculate impulse scalar
        let impulse = -(1 + restitution) * velAlongNormal;
        const totalMass = asteroid1.size + asteroid2.size;
        impulse /= totalMass;
        
        // Apply impulse
        const impulseVector = collisionNormal.clone().multiplyScalar(impulse);
        
        // Update velocities based on mass (size)
        const mass1 = asteroid1.size;
        const mass2 = asteroid2.size;
        
        asteroid1.velocity.add(impulseVector.clone().multiplyScalar(mass2));
        asteroid2.velocity.sub(impulseVector.clone().multiplyScalar(mass1));
        
        // Add some angular momentum from collision
        const angularImpulse = 0.01;
        asteroid1.angularVelocity.add(new THREE.Vector3(
            (Math.random() - 0.5) * angularImpulse,
            (Math.random() - 0.5) * angularImpulse,
            (Math.random() - 0.5) * angularImpulse
        ));
        
        asteroid2.angularVelocity.add(new THREE.Vector3(
            (Math.random() - 0.5) * angularImpulse,
            (Math.random() - 0.5) * angularImpulse,
            (Math.random() - 0.5) * angularImpulse
        ));
        
        // Separate overlapping asteroids
        const separation = (asteroid1.size * 0.5 + asteroid2.size * 0.5) * 0.8 - 
                          asteroid1.mesh.position.distanceTo(asteroid2.mesh.position);
        
        if (separation > 0) {
            const separationVector = collisionNormal.clone().multiplyScalar(separation * 0.5);
            asteroid1.mesh.position.sub(separationVector);
            asteroid2.mesh.position.add(separationVector);
        }
    }
    
    private destroyAsteroid(index: number): void {
        const asteroid = this.asteroids[index];
        if (!asteroid) return;
        
        this.threeManager.remove(asteroid.mesh);
        
        // Split large asteroids into smaller ones
        if (asteroid.size > 1) {
            const newSize = asteroid.size - 1;
            const numFragments = 2;
            
            for (let i = 0; i < numFragments; i++) {
                const fragment = this.createAsteroidAt(
                    asteroid.mesh.position.clone(),
                    newSize
                );
                
                // Add random velocity to fragments
                const angle = (Math.PI * 2 * i) / numFragments + Math.random();
                fragment.velocity = new THREE.Vector3(
                    Math.cos(angle) * 1.5,
                    0,
                    Math.sin(angle) * 1.5
                );
                
                this.asteroids.push(fragment);
            }
        }
        
        this.asteroids.splice(index, 1);
    }
    
    private createAsteroidAt(position: THREE.Vector3, size: number): Asteroid {
        if (!this.asteroidModel) {
            logger.warn('Asteroid model not loaded, creating fallback asteroid', 'ThreeSceneE');
            // Fallback to simple geometry if model not loaded
            const geometry = new THREE.IcosahedronGeometry(size * 0.7, 1);
            const material = new THREE.MeshStandardMaterial({ color: 0x666666 });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position);
            
            const asteroid: Asteroid = {
                mesh,
                velocity: new THREE.Vector3(),
                angularVelocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.015,
                    (Math.random() - 0.5) * 0.015,
                    (Math.random() - 0.5) * 0.015
                ),
                size
            };
            
            this.threeManager.add(mesh);
            return asteroid;
        }
        
        // Clone the asteroid model
        const asteroidClone = this.asteroidModel.clone();
        
        // Scale based on size - tiny scale
        const scaleMultiplier = size * 0.005;
        asteroidClone.scale.setScalar(scaleMultiplier);
        
        // Random rotation
        asteroidClone.rotation.x = Math.random() * Math.PI * 2;
        asteroidClone.rotation.y = Math.random() * Math.PI * 2;
        asteroidClone.rotation.z = Math.random() * Math.PI * 2;
        
        asteroidClone.position.copy(position);
        
        // Ensure all meshes in the clone have materials applied
        asteroidClone.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (!child.material || !child.material.map) {
                    this.applyAsteroidMaterial(child);
                }
            }
        });
        
        const asteroid: Asteroid = {
            mesh: asteroidClone,
            velocity: new THREE.Vector3(),
            angularVelocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.015,
                (Math.random() - 0.5) * 0.015,
                (Math.random() - 0.5) * 0.015
            ),
            size
        };
        
        this.threeManager.add(asteroidClone);
        return asteroid;
    }
    
    private createExplosion(position: THREE.Vector3): void {
        // Create explosion particles
        const particleCount = 15;
        const particles: THREE.Mesh[] = [];
        
        for (let i = 0; i < particleCount; i++) {
            const particleGeometry = new THREE.SphereGeometry(0.1, 4, 4);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0xff6600 : 0xffaa00,
                transparent: true,
                opacity: 1
            });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            
            particle.position.copy(position);
            particle.position.add(new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ));
            
            particles.push(particle);
            this.threeManager.add(particle);
        }
        
        // Animate explosion particles
        let explosionTimer = 0;
        const animateExplosion = () => {
            explosionTimer++;
            
            particles.forEach((particle, index) => {
                // Move particles outward
                const direction = new THREE.Vector3()
                    .subVectors(particle.position, position)
                    .normalize()
                    .multiplyScalar(0.5);
                particle.position.add(direction);
                
                // Fade out
                const material = particle.material as THREE.MeshBasicMaterial;
                material.opacity = Math.max(0, 1 - explosionTimer / 30);
                
                // Remove when faded
                if (material.opacity <= 0) {
                    this.threeManager.remove(particle);
                    particles.splice(index, 1);
                }
            });
            
            if (particles.length > 0 && explosionTimer < 30) {
                requestAnimationFrame(animateExplosion);
            }
        };
        
        animateExplosion();
    }
    
    private playerHit(): void {
        if (this.shields > 0) {
            // Shields absorb the hit
            this.shields--;
            this.updateShieldVisual();
            
            // Create shield impact effect
            if (this.shieldMesh) {
                const material = this.shieldMesh.material as THREE.ShaderMaterial;
                if (material.uniforms['opacity']) {
                    material.uniforms['opacity'].value = 1.0; // Flash brighter on hit
                }
                setTimeout(() => {
                    if (this.shieldMesh) {
                        this.updateShieldVisual(); // Return to normal
                    }
                }, 200);
            }
        } else {
            // No shields - lose a life
            this.lives--;
            
            if (this.lives <= 0) {
                this.gameOver();
            } else {
                this.respawnPlayer();
            }
        }
    }
    
    private respawnPlayer(): void {
        // Reset ship position and velocity
        this.ship.position.set(0, 0, 0);
        this.shipVelocity.set(0, 0, 0);
        this.shipRotation = 0;
        
        // Reset shields when respawning
        this.shields = this.maxShields;
        this.updateShieldVisual();
    }
    
    private nextLevel(): void {
        this.level++;
        this.createAsteroids();
    }
    
    private gameOver(): void {
        // Reset game
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        
        // Clear all objects
        this.bullets.forEach(bullet => this.threeManager.remove(bullet.mesh));
        this.bullets = [];
        
        this.asteroids.forEach(asteroid => this.threeManager.remove(asteroid.mesh));
        this.asteroids = [];
        
        // Respawn
        this.respawnPlayer();
        this.createAsteroids();
    }

    public resize(): void {
        this.threeManager.resize();
    }

    public getGameInfo(): { score: number; lives: number; level: number; shields: number; isCharging: boolean; chargeProgress: number } {
        const chargeProgress = this.isCharging ? 
            Math.min((Date.now() - this.chargeStartTime) / this.maxChargeTime, 1) : 0;
            
        return {
            score: this.score,
            lives: this.lives,
            level: this.level,
            shields: this.shields,
            isCharging: this.isCharging,
            chargeProgress
        };
    }
    
    public dispose(): void {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Remove event listeners
        window.removeEventListener('keydown', (event) => {
            this.keys[event.code.toLowerCase()] = true;
        });
        
        window.removeEventListener('keyup', (event) => {
            this.keys[event.code.toLowerCase()] = false;
        });
        
        this.threeManager.dispose();
    }
}