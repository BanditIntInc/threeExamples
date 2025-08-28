import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { LoadingBar } from '../../utils/LoadingBar';
import { ShaderManager } from './shared/ShaderManager';
import { ThreeManager } from './shared/ThreeManager';

export class ThreeSceneA {
    public readonly message: string = "Interactive F16 Fighter Jet Flight Simulation. Experience realistic aerial movement with dynamic sky and atmospheric effects in this immersive Three.js demonstration.";
    
    private threeManager: ThreeManager;
    private f16Model: THREE.Group | null = null;
    private animationId: number | null = null;
    private loader: FBXLoader;
    
    // Flight parameters
    private flightPath: THREE.Vector3[] = [];
    private currentPathIndex: number = 0;
    private flightSpeed: number = 0.008;
    private bankAngle: number = 0;
    private previousRotationY: number = 0;
    private isLoaded: boolean = false;
    private keys: { [key: string]: boolean } = {};
    private manualControl: boolean = false;
    private loadingBar: LoadingBar | null = null;
    private isPaused: boolean = false;
    private pauseTimer: number = 0;
    private pauseDuration: number = 5000; // 5 seconds
    private infoOverlay: HTMLElement | null = null;
    private waypoints: { position: THREE.Vector3; info: { title: string; description: string; offset: { x: number; y: number } } }[] = [];
    private waypointVisited: boolean[] = [];
    private flightDistance: number = 0;
    private nextWaypointDistance: number = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.threeManager = ThreeManager.createStandardSetup(canvas);
        this.loader = new FBXLoader();
        
        this.createLoader();
        this.createSkyEnvironment();
        this.setupLighting();
        this.loadF16Model();
        this.createFlightPath();
        this.setupWaypoints();
        this.setupControls();
    }


    private createLoader(): void {
        this.loadingBar = new LoadingBar('Loading F16 Flight Simulation...');
    }

    public hideLoader(): void {
        if (this.loadingBar) {
            this.loadingBar.hide();
        }
    }

    private createSkyEnvironment(): void {
        // Load sky texture
        const textureLoader = new THREE.TextureLoader();
        const skyTexture = textureLoader.load(
            '/textures/Bumpy_Sky-Blue_01-1024x512.png',
            (texture) => {
                // Texture loaded successfully
                texture.mapping = THREE.EquirectangularReflectionMapping;
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                texture.needsUpdate = true;
            },
            undefined,
            (error) => {
                console.error('Error loading sky texture:', error);
            }
        );

        // Sky with texture using ShaderManager
        const skyGeometry = new THREE.SphereGeometry(1000, 64, 32);
        const skyMaterial = ShaderManager.createMaterial('skyEnvironment', {
            skyTexture: skyTexture
        });
        skyMaterial.side = THREE.BackSide;
        const skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
        this.threeManager.add(skyMesh);
        
        // Add ground terrain
        this.createGroundTerrain();
    }

    private setupLighting(): void {
        this.threeManager.setupStandardLighting();
    }


    private createGroundTerrain(): void {
        // Create large ground plane
        const groundSize = 2000;
        const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize, 100, 100);
        
        // Load terrain textures
        const textureLoader = new THREE.TextureLoader();
        
        // Load diffuse map
        const diffuseMap = textureLoader.load(
            '/textures/COLOR_MAP.png',
            (texture) => {
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                texture.repeat.set(1, 1);
                texture.generateMipmaps = true;
                texture.minFilter = THREE.LinearMipmapLinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.needsUpdate = true;
            },
            undefined,
            (error) => {
                console.error('Error loading diffuse map:', error);
            }
        );
        
        // Load normal map
        const normalMap = textureLoader.load(
            '/textures/normal.png',
            (texture) => {
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                texture.repeat.set(1, 1);
                texture.generateMipmaps = true;
                texture.minFilter = THREE.LinearMipmapLinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.needsUpdate = true;
            },
            undefined,
            (error) => {
                console.error('Error loading normal map:', error);
            }
        );
        
        // Create ground material with maps and displacement
        const groundMaterial = new THREE.MeshLambertMaterial({
            map: diffuseMap,
            normalMap: normalMap,
            normalScale: new THREE.Vector2(0.5, 0.5),
            displacementMap: normalMap,
            displacementScale: 25,
            color: 0x777777
        });
        
        // Create ground mesh
        const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
        groundMesh.rotation.x = -Math.PI / 2;
        groundMesh.position.y = -50;
        groundMesh.scale.set(1, 1, 1);
        groundMesh.receiveShadow = true;
        
        this.threeManager.add(groundMesh);
    }

    private loadF16Model(): void {
        // Simulate initial loading stages
        this.loadingBar?.updateProgress(10);
        
        // Fallback progress updates in case progress callback doesn't fire
        let currentProgress = 10;
        const progressTimer = setInterval(() => {
            if (!this.isLoaded && currentProgress < 85) {
                currentProgress += 2;
                this.loadingBar?.updateProgress(currentProgress);
            } else {
                clearInterval(progressTimer);
            }
        }, 200);
        
        this.loader.load(
            '/models/F16.fbx',
            (object) => {
                clearInterval(progressTimer);
                this.loadingBar?.updateProgress(90);
                this.f16Model = object;
                this.f16Model.scale.setScalar(0.01);
                this.f16Model.position.set(0, 20, 0);
                this.f16Model.rotation.y = Math.PI; // Turn around 180 degrees
                this.f16Model.castShadow = true;
                this.f16Model.receiveShadow = true;
                
                // Apply reflective material to F16
                this.f16Model.traverse((child: any) => {
                    if (child.isMesh) {
                        // Create reflective material based on existing material
                        const originalMaterial = child.material;
                        
                        if (originalMaterial) {
                            // Create new PBR material with reflectivity
                            const reflectiveMaterial = new THREE.MeshStandardMaterial({
                                map: originalMaterial.map,
                                normalMap: originalMaterial.normalMap,
                                roughness: 0.2,
                                metalness: 0.8,
                                envMapIntensity: 1.2,
                                color: originalMaterial.color || 0xeeeeee,
                                emissive: 0x111111,
                                emissiveIntensity: 0.1
                            });
                            
                            child.material = reflectiveMaterial;
                        } else {
                            // Fallback material for parts without materials
                            const defaultReflectiveMaterial = new THREE.MeshStandardMaterial({
                                roughness: 0.3,
                                metalness: 0.7,
                                color: 0xdddddd,
                                envMapIntensity: 1.0,
                                emissive: 0x111111,
                                emissiveIntensity: 0.1
                            });
                            
                            child.material = defaultReflectiveMaterial;
                        }
                        
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                this.threeManager.add(this.f16Model);
                
                // Complete loading
                this.loadingBar?.updateProgress(100);
                this.isLoaded = true;
                
                // Auto-hide loader after brief delay to show 100%
                setTimeout(() => {
                    this.hideLoader();
                }, 1000);
            },
            (progress) => {
                if (progress.total > 0) {
                    const loadProgress = 10 + (progress.loaded / progress.total * 80);
                    this.loadingBar?.updateProgress(Math.min(90, loadProgress));
                }
            },
            (error) => {
                clearInterval(progressTimer);
                console.error('Error loading F16 model:', error);
                this.loadingBar?.showError('Failed to Load F16 Model');
            }
        );
    }

    private createFlightPath(): void {
        const radius = 100;
        const height = 50;
        const points = 50;

        for (let i = 0; i < points; i++) {
            const angle = (i / points) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = height + Math.sin(angle * 3) * 20;
            this.flightPath.push(new THREE.Vector3(x, y, z));
        }
    }

    private setupControls(): void {
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
    }

    private setupWaypoints(): void {
        // Create 3 evenly spaced waypoints based on distance traveled
        this.waypoints = [
            {
                position: new THREE.Vector3(0, 0, 0), // Will be set based on distance
                info: {
                    title: "Advanced Radar System",
                    description: "The F-16's AN/APG-68 radar provides multi-mode capabilities including air-to-air tracking, ground mapping, and weather detection with a range exceeding 100 miles.",
                    offset: { x: 50, y: 150 }
                }
            },
            {
                position: new THREE.Vector3(0, 0, 0), // Will be set based on distance
                info: {
                    title: "External Fuel Tank",
                    description: "Wing-mounted 370-gallon external fuel tanks extend the F-16's operational range to over 2,000 miles, essential for long-range missions and ferry flights.",
                    offset: { x: 75, y: 180 }
                }
            },
            {
                position: new THREE.Vector3(0, 0, 0), // Will be set based on distance
                info: {
                    title: "Weapon Hardpoints",
                    description: "The F-16 features 11 hardpoints capable of carrying up to 17,000 pounds of mixed ordnance including air-to-air missiles, bombs, and electronic warfare pods.",
                    offset: { x: 100, y: 150 }
                }
            }
        ];
        
        // Initialize waypoint tracking
        this.waypointVisited = [false, false, false];
        this.flightDistance = 0;
        this.nextWaypointDistance = 100; // First waypoint at 100 units
    }

    private createInfoOverlay(info: { title: string; description: string; offset: { x: number; y: number } }): void {
        // Remove existing overlay
        this.removeInfoOverlay();

        // Create overlay element
        this.infoOverlay = document.createElement('div');
        this.infoOverlay.style.position = 'fixed';
        this.infoOverlay.style.top = '50%';
        this.infoOverlay.style.left = '50%';
        this.infoOverlay.style.transform = `translate(calc(-50% + ${info.offset.x}px), calc(-50% + ${info.offset.y}px))`;
        this.infoOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        this.infoOverlay.style.color = 'white';
        this.infoOverlay.style.padding = '20px';
        this.infoOverlay.style.borderRadius = '10px';
        this.infoOverlay.style.border = '2px solid #4A90E2';
        this.infoOverlay.style.maxWidth = '300px';
        this.infoOverlay.style.fontSize = '14px';
        this.infoOverlay.style.fontFamily = 'Arial, sans-serif';
        this.infoOverlay.style.zIndex = '1000';
        this.infoOverlay.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';
        
        // Add pointer arrow
        const arrow = document.createElement('div');
        arrow.style.position = 'absolute';
        arrow.style.width = '0';
        arrow.style.height = '0';
        arrow.style.borderLeft = '10px solid transparent';
        arrow.style.borderRight = '10px solid transparent';
        arrow.style.borderBottom = '15px solid #4A90E2';
        arrow.style.top = '-15px';
        arrow.style.left = '50%';
        arrow.style.transform = 'translateX(-50%)';
        
        this.infoOverlay.innerHTML = `
            <h3 style="margin: 0 0 10px 0; color: #4A90E2; font-size: 16px;">${info.title}</h3>
            <p style="margin: 0; line-height: 1.4;">${info.description}</p>
        `;
        
        this.infoOverlay.appendChild(arrow);
        document.body.appendChild(this.infoOverlay);
    }

    private removeInfoOverlay(): void {
        if (this.infoOverlay) {
            document.body.removeChild(this.infoOverlay);
            this.infoOverlay = null;
        }
    }

    private checkWaypointTrigger(): void {
        if (!this.f16Model || this.manualControl || this.isPaused) return;

        // Check if we've reached the next waypoint distance
        if (this.flightDistance >= this.nextWaypointDistance) {
            // Find the next unvisited waypoint
            for (let i = 0; i < this.waypoints.length; i++) {
                const waypoint = this.waypoints[i];
                if (!this.waypointVisited[i] && waypoint) {
                    this.waypointVisited[i] = true;
                    this.isPaused = true;
                    this.pauseTimer = Date.now();
                    this.createInfoOverlay(waypoint.info);
                    
                    // Set next waypoint distance (150 units apart)
                    this.nextWaypointDistance += 150;
                    break;
                }
            }
        }
    }

    private resetWaypoints(): void {
        // Reset waypoints when flight restarts (when F16 goes out of bounds)
        this.waypointVisited = [false, false, false];
        this.flightDistance = 0;
        this.nextWaypointDistance = 100;
    }

    private handlePause(): void {
        if (this.isPaused) {
            const elapsed = Date.now() - this.pauseTimer;
            if (elapsed >= this.pauseDuration) {
                this.isPaused = false;
                this.removeInfoOverlay();
            }
        }
    }

    private handleManualFlight(): void {
        if (!this.f16Model || !this.manualControl) return;

        const speed = 2;
        const turnSpeed = 0.05;
        
        if (this.keys['w'] || this.keys['arrowup']) {
            this.f16Model.translateZ(-speed);
        }
        if (this.keys['s'] || this.keys['arrowdown']) {
            this.f16Model.translateZ(speed);
        }
        if (this.keys['a'] || this.keys['arrowleft']) {
            this.f16Model.rotation.y += turnSpeed;
            this.bankAngle = THREE.MathUtils.lerp(this.bankAngle, -0.5, 0.1);
        }
        if (this.keys['d'] || this.keys['arrowright']) {
            this.f16Model.rotation.y -= turnSpeed;
            this.bankAngle = THREE.MathUtils.lerp(this.bankAngle, 0.5, 0.1);
        }
        if (this.keys['q']) {
            this.f16Model.position.y += speed * 0.5;
        }
        if (this.keys['e']) {
            this.f16Model.position.y -= speed * 0.5;
        }

        if (!this.keys['a'] && !this.keys['arrowleft'] && !this.keys['d'] && !this.keys['arrowright']) {
            this.bankAngle = THREE.MathUtils.lerp(this.bankAngle, 0, 0.05);
        }
        
        this.f16Model.rotation.z = this.bankAngle;
    }

    public animate(): void {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        if (this.f16Model && this.isLoaded) {
            // Handle pause system
            this.handlePause();
            
            if (this.manualControl) {
                this.handleManualFlight();
            } else if (!this.isPaused) {
                // Track flight distance
                this.flightDistance += 0.5;
                
                // Check for waypoint triggers
                this.checkWaypointTrigger();
                
                // Simple forward flight
                this.f16Model.translateZ(0.5);
                
                // Calculate turn rate for banking
                const currentRotationY = this.f16Model.rotation.y;
                const turnRate = currentRotationY - this.previousRotationY;
                this.previousRotationY = currentRotationY;
                
                // Keep it in bounds - turn around if too far
                const turnSpeed = 0.01;
                let isTurning = false;
                
                if (this.f16Model.position.z < -200) {
                    this.f16Model.rotation.y += turnSpeed;
                    isTurning = true;
                    this.resetWaypoints();
                } else if (this.f16Model.position.z > 200) {
                    this.f16Model.rotation.y += turnSpeed;
                    isTurning = true;
                    this.resetWaypoints();
                } else if (this.f16Model.position.x < -200) {
                    this.f16Model.rotation.y += turnSpeed;
                    isTurning = true;
                    this.resetWaypoints();
                } else if (this.f16Model.position.x > 200) {
                    this.f16Model.rotation.y += turnSpeed;
                    isTurning = true;
                    this.resetWaypoints();
                }
                
                // Apply banking based on turning
                if (isTurning) {
                    const targetBank = -turnSpeed * 60; // Banking angle proportional to turn rate (negative for correct direction)
                    this.bankAngle = THREE.MathUtils.lerp(this.bankAngle, targetBank, 0.1);
                } else {
                    // Return to level flight when not turning
                    this.bankAngle = THREE.MathUtils.lerp(this.bankAngle, 0, 0.05);
                }
                
                // Apply banking rotation
                this.f16Model.rotation.z = this.bankAngle;
            }
            
            // Update camera to follow F16 smoothly
            const cameraOffset = new THREE.Vector3(-30, 10, 30);
            const desiredCameraPosition = this.f16Model.position.clone().add(cameraOffset);
            this.threeManager.camera.position.lerp(desiredCameraPosition, 0.01);
            
            // Smooth camera lookAt
            const targetLookAt = this.f16Model.position.clone();
            const currentLookAt = new THREE.Vector3(0, 0, -1);
            currentLookAt.applyQuaternion(this.threeManager.camera.quaternion);
            currentLookAt.add(this.threeManager.camera.position);
            
            const smoothLookAt = currentLookAt.lerp(targetLookAt, 0.02);
            this.threeManager.camera.lookAt(smoothLookAt);
        }
        

        this.threeManager.render();
    }

    public resize(): void {
        this.threeManager.resize();
    }

    public dispose(): void {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Remove event listeners
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        
        // Clean up loader if still present - force hide immediately when disposing
        if (this.loadingBar) {
            this.loadingBar.dispose();
            this.loadingBar = null;
        }
        
        // Clean up info overlay
        this.removeInfoOverlay();
        
        this.threeManager.dispose();
    }

    private handleKeyDown = (event: KeyboardEvent) => {
        this.keys[event.key.toLowerCase()] = true;
        if (event.key.toLowerCase() === 'c') {
            this.manualControl = !this.manualControl;
        }
    };

    private handleKeyUp = (event: KeyboardEvent) => {
        this.keys[event.key.toLowerCase()] = false;
    };
}