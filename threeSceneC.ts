import * as THREE from 'three';
import { LoadingBar } from '../../utils/LoadingBar';
import { ThreeManager } from './shared/ThreeManager';
import { logger } from '../../utils/logger';
import { PhysicsEngine } from './shared/PhysicsEngine';

export class ThreeSceneC {
    public readonly message: string = "Hadron Collider Simulation - Watch atomic particles collide at high energies, creating spectacular physics interactions with realistic particle decay and energy trails.";
    
    private threeManager: ThreeManager;
    private physicsEngine: PhysicsEngine;
    private floorGrid!: THREE.GridHelper;
    private backGrid!: THREE.GridHelper;
    private atoms: THREE.Mesh[] = [];
    private particles: THREE.Mesh[] = []; // Visual effect particles from collisions
    private particleVelocities: THREE.Vector3[] = []; // Velocities for visual effect particles
    private trails: THREE.Line[] = [];
    private animationId: number | null = null;
    private loadingBar: LoadingBar | null = null;
    private isLoaded: boolean = false;
    private physicsInitialized: boolean = false;
    
    // Trail system
    private atomTrailHistory: THREE.Vector3[][] = [];
    private maxTrailLength: number = 30;
    
    // Physics bodies tracking
    private atomPhysicsIds: number[] = [];
    private floorPhysicsId: number | null = null;
    private wallPhysicsIds: number[] = [];
    
    // Physics simulation properties
    private collisionPhase: 'setup' | 'firing' | 'physics' | 'cleanup' = 'setup';
    private phaseStartTime: number = 0;
    private readonly phaseDurations = {
        setup: 500,     // 0.5 seconds to setup physics
        firing: 0,      // Skip firing phase - particles get velocity immediately
        physics: 8000,  // 8 seconds for collision physics (longer since no firing phase)
        cleanup: 1000   // 1 second to clear and reset
    };
    private currentCycleNumber: number = 0;
    private clock: THREE.Clock = new THREE.Clock();

    constructor(canvas: HTMLCanvasElement) {
        this.threeManager = ThreeManager.createStandardSetup(canvas);
        this.physicsEngine = new PhysicsEngine();
        
        this.createLoader();
        this.initAsync();
        
        logger.info('Hadron Collider Simulation initialization started', 'ThreeSceneC');
    }

    private async initAsync(): Promise<void> {
        try {
            await this.init();
            this.createGrids();
            this.createPhysicsWalls();
            this.setupLighting();
            this.setupCamera();
            this.startCollisionSequence();
        } catch (error) {
            logger.error('Failed to initialize physics simulation:', error instanceof Error ? error.message : String(error));
        }
    }

    private createLoader(): void {
        this.loadingBar = new LoadingBar('Loading Hadron Collider Simulation...');
        this.loadingBar.updateProgress(10);
    }

    public hideLoader(): void {
        if (this.loadingBar) {
            this.loadingBar.hide();
        }
    }

    private async init(): Promise<void> {
        // Set up physics simulation environment
        this.threeManager.scene.background = new THREE.Color(0x111111); // Slightly lighter for better contrast
        this.threeManager.scene.fog = new THREE.Fog(0x111111, 20, 100);
        
        this.loadingBar?.updateProgress(15);
        
        // Initialize physics engine
        await this.physicsEngine.init();
        this.physicsInitialized = true;
        
        this.loadingBar?.updateProgress(30);
        logger.debug('Physics engine and environment initialized', 'ThreeSceneC');
    }

    private createGrids(): void {
        logger.debug('Creating collision chamber grids', 'ThreeSceneC');
        
        // Floor grid
        this.floorGrid = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
        this.floorGrid.position.y = -5;
        this.threeManager.add(this.floorGrid);
        
        // Back wall grid
        this.backGrid = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
        this.backGrid.rotation.x = Math.PI / 2;
        this.backGrid.position.z = -10;
        this.threeManager.add(this.backGrid);
        
        this.loadingBar?.updateProgress(40);
        logger.debug('Collision chamber grids created', 'ThreeSceneC');
    }

    private createPhysicsWalls(): void {
        if (!this.physicsInitialized) return;

        logger.debug('Creating physics collision boundaries', 'ThreeSceneC');

        // Create invisible collision boundaries (floor and walls)
        const floorGeometry = new THREE.BoxGeometry(40, 1, 40);
        const wallMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x333333, 
            transparent: true, 
            opacity: 0 // Invisible but physical
        });
        
        // Floor
        const floor = new THREE.Mesh(floorGeometry, wallMaterial);
        floor.position.set(0, -5.5, 0);
        this.threeManager.add(floor);
        this.floorPhysicsId = this.physicsEngine.addStaticBox(
            floor, 
            new THREE.Vector3(0, -5.5, 0), 
            new THREE.Vector3(40, 1, 40)
        );

        // Back wall
        const backWallGeometry = new THREE.BoxGeometry(40, 20, 1);
        const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
        backWall.position.set(0, 0, -10.5);
        this.threeManager.add(backWall);
        this.wallPhysicsIds.push(this.physicsEngine.addStaticBox(
            backWall, 
            new THREE.Vector3(0, 0, -10.5), 
            new THREE.Vector3(40, 20, 1)
        ));

        // Side walls
        const sideWallGeometry = new THREE.BoxGeometry(1, 20, 20);
        
        const leftWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
        leftWall.position.set(-20, 0, 0);
        this.threeManager.add(leftWall);
        this.wallPhysicsIds.push(this.physicsEngine.addStaticBox(
            leftWall, 
            new THREE.Vector3(-20, 0, 0), 
            new THREE.Vector3(1, 20, 20)
        ));

        const rightWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
        rightWall.position.set(20, 0, 0);
        this.threeManager.add(rightWall);
        this.wallPhysicsIds.push(this.physicsEngine.addStaticBox(
            rightWall, 
            new THREE.Vector3(20, 0, 0), 
            new THREE.Vector3(1, 20, 20)
        ));

        this.loadingBar?.updateProgress(50);
        logger.debug('Physics collision boundaries created', 'ThreeSceneC');
    }

    // createAtoms() method removed - replaced by setupRandomParticles() with physics integration

    private setupLighting(): void {
        logger.debug('Setting up collision chamber lighting', 'ThreeSceneC');
        
        // Add ambient light for overall illumination
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.threeManager.add(ambientLight);
        
        // Add directional lights to illuminate particles
        const light1 = new THREE.DirectionalLight(0xffffff, 0.8);
        light1.position.set(5, 5, 5);
        this.threeManager.add(light1);
        
        const light2 = new THREE.DirectionalLight(0x4444ff, 0.4);
        light2.position.set(-5, 2, 3);
        this.threeManager.add(light2);
        
        this.loadingBar?.updateProgress(70);
        logger.debug('Collision chamber lighting setup complete', 'ThreeSceneC');
    }

    private setupCamera(): void {
        this.threeManager.camera.position.set(0, 2, 12);
        this.threeManager.camera.lookAt(0, 0, 0);
        
        logger.info(`Camera positioned at (0, 2, 12) looking at (0, 0, 0)`, 'ThreeSceneC');
        
        this.loadingBar?.updateProgress(85);
        logger.debug('Camera positioned for collision observation', 'ThreeSceneC');
    }

    private startCollisionSequence(): void {
        // Complete loading
        this.loadingBar?.updateProgress(100);
        this.isLoaded = true;
        
        // Auto-hide loader after brief delay to show 100%
        setTimeout(() => {
            this.hideLoader();
        }, 1000);
        
        // Start continuous collision cycle - ensure physics is ready
        const startCycle = () => {
            if (this.physicsInitialized) {
                this.beginNewCycle();
                logger.info('Continuous hadron collision sequence initiated', 'ThreeSceneC');
            } else {
                logger.debug('Waiting for physics initialization...', 'ThreeSceneC');
                setTimeout(startCycle, 500); // Check again in 500ms
            }
        };
        
        setTimeout(startCycle, 2000);
    }

    private beginNewCycle(): void {
        this.currentCycleNumber++;
        this.collisionPhase = 'setup';
        this.phaseStartTime = Date.now();
        
        logger.info(`Starting collision cycle #${this.currentCycleNumber}`, 'ThreeSceneC');
        
        // Clear any existing collision particles
        this.clearCollisionParticles();
        
        // Generate random particle configuration for this cycle
        this.setupRandomParticles();
    }

    private setupRandomParticles(): void {
        logger.debug(`setupRandomParticles called, physicsInitialized: ${this.physicsInitialized}`, 'ThreeSceneC');
        
        if (!this.physicsInitialized) {
            logger.warn('Physics not initialized, skipping particle setup', 'ThreeSceneC');
            return;
        }

        // Clear existing physics bodies and atoms
        this.atomPhysicsIds.forEach(id => this.physicsEngine.removeBody(id));
        this.atoms.forEach(atom => this.threeManager.scene.remove(atom));
        this.atoms = [];
        this.atomPhysicsIds = [];
        
        // Randomly choose number of particles (8-16, ensuring 4+ per side)
        const particleCount = Math.floor(Math.random() * 9) + 8;
        logger.debug(`Creating ${particleCount} particles`, 'ThreeSceneC');
        
        // Available particle types
        const particleTypes = [
            { size: 0.3, color: 0xff4444, name: 'Proton' },
            { size: 0.25, color: 0x4444ff, name: 'Neutron' },
            { size: 0.15, color: 0x44ff44, name: 'Electron' },
            { size: 0.4, color: 0xffff44, name: 'Heavy Ion' },
            { size: 0.2, color: 0xff44ff, name: 'Muon' },
            { size: 0.35, color: 0x44ffff, name: 'Alpha Particle' }
        ];
        
        // Initialize trail tracking arrays
        this.atomTrailHistory = [];
        
        // Ensure balanced sides - split particles evenly
        const leftSideCount = Math.ceil(particleCount / 2);
        const rightSideCount = particleCount - leftSideCount;
        
        // Choose collision point for all particles to target
        const collisionPoint = new THREE.Vector3(
            (Math.random() - 0.5) * 2.0, // Random center area
            (Math.random() - 0.5) * 2.0,
            (Math.random() - 0.5) * 2.0
        );
        logger.info(`Collision point set at (${collisionPoint.x.toFixed(2)}, ${collisionPoint.y.toFixed(2)}, ${collisionPoint.z.toFixed(2)})`, 'ThreeSceneC');
        
        // Create left side particles with physics bodies
        for (let i = 0; i < leftSideCount; i++) {
            const type = particleTypes[Math.floor(Math.random() * particleTypes.length)];

            if(type === undefined)
                return;
            
            const geometry = new THREE.SphereGeometry(type.size, 12, 8);
            const material = new THREE.MeshPhongMaterial({ 
                color: type.color,
                emissive: type.color,
                emissiveIntensity: 0.4, // Increased from 0.2 for better visibility
                shininess: 100
            });
            
            const atom = new THREE.Mesh(geometry, material);
            
            // Position on left side with better spacing - center around origin
            const position = new THREE.Vector3(
                -6 + (Math.random() - 0.5) * 2,  // X: -7 to -5
                (Math.random() - 0.5) * 4,       // Y: -2 to +2 (centered on 0)
                (Math.random() - 0.5) * 4        // Z: -2 to +2 (centered on 0)
            );
            
            atom.position.copy(position);
            this.atoms.push(atom);
            this.threeManager.add(atom);
            this.atomTrailHistory.push([atom.position.clone()]);
            
            // Create physics body with realistic mass based on particle type
            const mass = Math.pow(type.size, 3) * 10; // Volume-based mass
            const physicsId = this.physicsEngine.addDynamicSphere(
                atom, 
                position, 
                type.size, 
                mass, 
                0.9 // High restitution for bouncy collisions
            );
            this.atomPhysicsIds.push(physicsId);
            
            // Calculate initial velocity toward collision point
            const direction = collisionPoint.clone().sub(position).normalize();
            const speed = 6.0 + Math.random() * 4.0; // 6-10 units/sec
            const initialVelocity = direction.multiplyScalar(speed);
            
            // Apply initial velocity immediately
            this.physicsEngine.setVelocity(physicsId, initialVelocity);
            
            // Debug logging simplified for performance
        }
        
        // Create right side particles with physics bodies
        for (let i = 0; i < rightSideCount; i++) {
            const type = particleTypes[Math.floor(Math.random() * particleTypes.length)];

            if(type === undefined)
                return;
            
            const geometry = new THREE.SphereGeometry(type.size, 12, 8);
            const material = new THREE.MeshPhongMaterial({ 
                color: type.color,
                emissive: type.color,
                emissiveIntensity: 0.4, // Increased from 0.2 for better visibility
                shininess: 100
            });
            
            const atom = new THREE.Mesh(geometry, material);
            
            // Position on right side with better spacing - center around origin
            const position = new THREE.Vector3(
                6 + (Math.random() - 0.5) * 2,   // X: +5 to +7
                (Math.random() - 0.5) * 4,       // Y: -2 to +2 (centered on 0)
                (Math.random() - 0.5) * 4        // Z: -2 to +2 (centered on 0)
            );
            
            atom.position.copy(position);
            this.atoms.push(atom);
            this.threeManager.add(atom);
            this.atomTrailHistory.push([atom.position.clone()]);
            
            // Create physics body with realistic mass
            const mass = Math.pow(type.size, 3) * 10;
            const physicsId = this.physicsEngine.addDynamicSphere(
                atom, 
                position, 
                type.size, 
                mass, 
                0.9
            );
            this.atomPhysicsIds.push(physicsId);
            
            // Calculate initial velocity toward collision point
            const direction = collisionPoint.clone().sub(position).normalize();
            const speed = 6.0 + Math.random() * 4.0; // 6-10 units/sec
            const initialVelocity = direction.multiplyScalar(speed);
            
            // Apply initial velocity immediately
            this.physicsEngine.setVelocity(physicsId, initialVelocity);
            
            // Debug logging simplified for performance
        }
        
        logger.info(`Setup complete: ${particleCount} particles (${leftSideCount} left, ${rightSideCount} right) with ${this.atomPhysicsIds.length} physics bodies`, 'ThreeSceneC');
        
        // Debug logging cleaned up - particles working correctly
    }

    // Note: isPositionOverlapping is no longer needed as physics engine handles positioning automatically

    private updateTrails(): void {
        // Update trail history for each atom
        for (let i = 0; i < this.atoms.length; i++) {
            const atom = this.atoms[i];
            const trailHistory = this.atomTrailHistory[i];

            if(trailHistory === undefined || atom === undefined)
                return;
            
            // Add current position to trail history
            trailHistory.push(atom.position.clone());
            
            // Limit trail length
            if (trailHistory.length > this.maxTrailLength) {
                trailHistory.shift();
            }
        }
        
        // Remove existing trails
        this.trails.forEach(trail => {
            this.threeManager.scene.remove(trail);
        });
        this.trails = [];
        
        // Create new trail geometry for each particle
        for (let i = 0; i < this.atoms.length; i++) {
            const trailHistory = this.atomTrailHistory[i];

            if(trailHistory === undefined)
                return;
            
            if (trailHistory.length > 1) {
                const atom = this.atoms[i];
                if(atom === undefined)
                    return;

                const atomMaterial = atom.material as THREE.MeshPhongMaterial;
                
                if (atomMaterial) {
                    // Create trail geometry
                const trailGeometry = new THREE.BufferGeometry();
                const positions = [];
                const colors = [];
                
                for (let j = 0; j < trailHistory.length; j++) {
                    const pos = trailHistory[j];

                    if(pos === undefined)
                        return;

                    positions.push(pos.x, pos.y, pos.z);
                    
                    // Fade color based on position in trail (older = more faded)
                    const alpha = j / (trailHistory.length - 1);
                    const color = new THREE.Color(atomMaterial.color);
                    color.multiplyScalar(alpha * 0.8); // Fade trail
                    colors.push(color.r, color.g, color.b);
                }
                
                trailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                trailGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
                
                // Create trail material
                const trailMaterial = new THREE.LineBasicMaterial({
                    vertexColors: true,
                    transparent: true,
                    opacity: 0.6,
                    linewidth: 2
                });
                
                // Create trail line
                const trail = new THREE.Line(trailGeometry, trailMaterial);
                this.trails.push(trail);
                this.threeManager.add(trail);
                }
            }
        }
    }

    private clearTrails(): void {
        // Remove all trails from scene
        this.trails.forEach(trail => {
            this.threeManager.scene.remove(trail);
        });
        this.trails = [];
        this.atomTrailHistory = [];
    }

    private updatePhysics(): void {
        if (!this.isLoaded || !this.physicsInitialized) return;
        
        // Step the physics engine
        const deltaTime = this.clock.getDelta();
        this.physicsEngine.step(deltaTime);
        
        const currentTime = Date.now();
        const phaseElapsed = currentTime - this.phaseStartTime;
        const currentPhaseDuration = this.phaseDurations[this.collisionPhase];
        
        // Check if current phase is complete
        if (phaseElapsed >= currentPhaseDuration) {
            this.advancePhase();
            return;
        }
        
        // Execute phase-specific logic
        switch (this.collisionPhase) {
            case 'setup':
                this.updateSetupPhase();
                break;
            case 'firing':
                this.updateFiringPhase(phaseElapsed / currentPhaseDuration);
                break;
            case 'physics':
                this.updatePhysicsPhase();
                break;
            case 'cleanup':
                this.updateCleanupPhase();
                break;
        }
        
        // Always update visual rotation and trails
        this.atoms.forEach(atom => {
            atom.rotation.x += 0.02;
            atom.rotation.y += 0.01;
        });
        
        // Update trails during active phases
        if (this.collisionPhase === 'firing' || this.collisionPhase === 'physics') {
            this.updateTrails();
        }
    }

    private advancePhase(): void {
        switch (this.collisionPhase) {
            case 'setup':
                this.collisionPhase = 'physics'; // Skip firing phase - go directly to physics
                logger.debug('Phase: Setup → Physics (firing skipped)', 'ThreeSceneC');
                break;
            case 'firing':
                // This phase is now skipped, but keeping for backward compatibility
                this.collisionPhase = 'physics';
                logger.debug('Phase: Firing → Physics', 'ThreeSceneC');
                break;
            case 'physics':
                this.collisionPhase = 'cleanup';
                logger.debug('Phase: Physics → Cleanup', 'ThreeSceneC');
                break;
            case 'cleanup':
                this.beginNewCycle();
                return; // beginNewCycle sets the phase, so return early
        }
        
        this.phaseStartTime = Date.now();
    }

    private updateSetupPhase(): void {
        // Particles are stationary during setup - just visual effects
        // Could add particle glow or preparation effects here
    }

    // setupFiringVelocities() method removed - particles now get initial velocity immediately when created

    private updateFiringPhase(progress: number): void {
        // Physics engine handles movement automatically
        // Could add visual effects for firing phase here
        if (progress > 0.5) {
            // Add some particle effects or energy buildup visualization
        }
    }

    private updatePhysicsPhase(): void {
        // Physics engine handles all collisions automatically
        // Add particle effects for high-energy collisions
        this.createCollisionParticleEffects();
        
        // Update collision particles (visual effects)
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            const velocity = this.particleVelocities[i];
            
            if (particle && velocity) {
                particle.position.add(velocity);
                
                // Fade out particles over time
                const material = particle.material as THREE.MeshBasicMaterial;
                if (material) {
                    material.opacity *= 0.995;
                    
                    // Remove faded particles
                    if (material.opacity < 0.1) {
                        this.threeManager.scene.remove(particle);
                        this.particles.splice(i, 1);
                        this.particleVelocities.splice(i, 1);
                    }
                }
            }
        }
    }

    private updateCleanupPhase(): void {
        // Fade out all particles gradually
        this.atoms.forEach(atom => {
            const material = atom.material as THREE.MeshPhongMaterial;
            if (material) {
                material.opacity = Math.max(0, material.opacity - 0.05);
                material.transparent = true;
            }
        });
        
        this.particles.forEach(particle => {
            const material = particle.material as THREE.MeshBasicMaterial;
            if (material) {
                material.opacity = Math.max(0, material.opacity - 0.1);
            }
        });
    }

    private clearCollisionParticles(): void {
        // Remove all collision particles
        this.particles.forEach(particle => {
            this.threeManager.scene.remove(particle);
        });
        this.particles = [];
        this.particleVelocities = [];
        
        // Clear trails
        this.clearTrails();
        
        // Reset atom materials to full opacity
        this.atoms.forEach(atom => {
            const material = atom.material as THREE.MeshPhongMaterial;
            if (material) {
                material.opacity = 1.0;
                material.transparent = false;
            }
        });
    }

    private createCollisionParticleEffects(): void {
        // Create visual particle effects at high-speed collision points
        // This method could monitor velocity changes to detect collisions
        for (let i = 0; i < this.atomPhysicsIds.length; i++) {
            const physicsId = this.atomPhysicsIds[i];

            if(physicsId === undefined)
                return;

            const velocity = this.physicsEngine.getVelocity(physicsId);
            
            if (velocity && velocity.length() > 5.0) {
                // High-speed particle, might be involved in collision
                const position = this.physicsEngine.getPosition(physicsId);
                if (position && Math.random() < 0.1) { // 10% chance per frame
                    this.createCollisionEffect(position, position.clone().add(velocity.normalize()));
                }
            }
        }
    }

    // Note: handleCollision method is no longer needed as Rapier Physics handles all collision physics automatically

    private createCollisionEffect(pos1: THREE.Vector3, pos2: THREE.Vector3): void {
        const collisionCenter = pos1.clone().add(pos2).multiplyScalar(0.5);
        
        // Create small particles representing collision products
        for (let i = 0; i < 8; i++) {
            const geometry = new THREE.SphereGeometry(0.05, 8, 6);
            const material = new THREE.MeshBasicMaterial({ 
                color: Math.random() * 0xffffff,
                transparent: true,
                opacity: 0.8
            });
            
            const particle = new THREE.Mesh(geometry, material);
            particle.position.copy(collisionCenter);
            
            // Random velocity for scatter effect
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2
            );
            
            this.particles.push(particle);
            this.particleVelocities.push(velocity);
            this.threeManager.add(particle);
        }
    }

    public animate(): void {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        // Animation loop debug logging removed since it's working
        
        if (this.isLoaded) {
            // Update continuous collision physics
            this.updatePhysics();
            
            // Rotate camera slightly for dynamic view
            const time = Date.now() * 0.0005;
            this.threeManager.camera.position.x = Math.sin(time) * 2;
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
        
        // Clean up physics engine
        if (this.physicsEngine) {
            this.physicsEngine.dispose();
        }
        
        // Clean up continuous collision cycle
        this.collisionPhase = 'setup';
        this.clearTrails();
        this.atoms = [];
        this.particles = [];
        this.trails = [];
        this.particleVelocities = [];
        this.atomTrailHistory = [];
        this.atomPhysicsIds = [];
        this.wallPhysicsIds = [];
        this.floorPhysicsId = null;
        
        // Clean up loader if still present
        if (this.loadingBar) {
            this.loadingBar.dispose();
            this.loadingBar = null;
        }
        
        this.threeManager.dispose();
        logger.info('Physics-based Hadron Collider Simulation disposed successfully', 'ThreeSceneC');
    }
}