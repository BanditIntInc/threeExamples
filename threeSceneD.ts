import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { LoadingBar } from '../../utils/LoadingBar';
import { ThreeManager } from './shared/ThreeManager';
import { logger } from '../../utils/logger';
import { LotteryAnalyzer } from './helpers/LotteryAnalyzer';

interface LotteryData {
    draw_date: string;
    winning_numbers: string;
    multiplier: string;
}

export class ThreeSceneD {
    public readonly message: string = "Advanced lottery ball visualization with real-time Powerball data integration. Features dynamic canvas-based texture generation for numbers, interactive frequency analysis wheel, and procedural dartboard texturing. Click lottery balls to explore historical frequency data with smooth wheel rotation animations.";
    
    private threeManager: ThreeManager;
    private lotteryBalls: THREE.Mesh[] = [];
    private pointLight!: THREE.PointLight;
    private animationId: number | null = null;
    private loadingBar: LoadingBar | null = null;
    private isLoaded: boolean = false;
    private time: number = 0;
    private rgbeLoader: RGBELoader = new RGBELoader();
    private environmentMap: THREE.Texture | null = null;

    // Lottery data
    private currentNumbers: number[] = [0, 0, 0, 0, 0, 0];
    private drawDate: string = '';
    private multiplier: string = '1';

    // Analysis and frequency display
    private lotteryAnalyzer: LotteryAnalyzer = new LotteryAnalyzer();
    private frequencyWheel: THREE.Group | null = null;
    private wheelBuckets: Map<number, THREE.Group> = new Map();
    private currentWheelRotation: number = 0;
    private wheelNumbers: number[] = [];
    private selectedNumberForFrequency: number | null = null;
    private showFrequencyMode: boolean = true;
    private keyboardListener: ((event: KeyboardEvent) => void) | null = null;
    
    // Dartboard pointer
    private dartboardPointer: THREE.Mesh | null = null;
    private wheelRadius: number = 6; // Store wheel radius for pointer positioning

    // UI Elements
    private uiContainer: HTMLElement | null = null;
    private arrowKeysContainer: HTMLElement | null = null;
    private frequencyAnalysisContainer: HTMLElement | null = null;
    
    // 3D Text Elements
    private powerballLogo: THREE.Mesh | null = null;
    private dateText: THREE.Mesh | null = null;
    private powerPlayText: THREE.Mesh | null = null;
    
    // Raycasting for ball interaction
    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private mouse: THREE.Vector2 = new THREE.Vector2();
    private clickListener: ((event: MouseEvent) => void) | null = null;

    constructor(canvas: HTMLCanvasElement) {
        this.threeManager = ThreeManager.createStandardSetup(canvas);
        
        this.createLoader();
        this.init();
        this.setupCamera();
        this.initialize();
        
        logger.info('ThreeSceneD - Lottery Ball Viewer initialized', 'ThreeSceneD');
    }

    private async initialize(): Promise<void> {
        await this.loadEnvironment();
        this.setupLighting();
        this.createLotteryBalls();
        this.create3DTexts(); // Create 3D text elements
        this.setupBallInteraction(); // Setup raycasting for ball clicks
        
        // Set default numbers first to ensure all balls show numbers
        this.currentNumbers = [13, 47, 52, 64, 67, 25];
        this.updateBallNumbers();
        this.update3DTexts(); // Update with default data
        
        this.createUI();
        await this.fetchLotteryData(); // This will update with real data if available
        await this.analyzeAndDisplayFrequencies(); // Analyze historical data for frequency display
        this.completeLoading();
    }

    private createLoader(): void {
        this.loadingBar = new LoadingBar('Loading Lottery Ball Viewer...');
        this.loadingBar.updateProgress(10);
    }

    public hideLoader(): void {
        if (this.loadingBar) {
            this.loadingBar.hide();
        }
    }

    private init(): void {
        // Set up the scene environment with lottery theme
        this.threeManager.scene.background = new THREE.Color(0x1a1a2e);
        this.threeManager.scene.fog = new THREE.Fog(0x1a1a2e, 8, 20);
        
        this.loadingBar?.updateProgress(20);
        logger.debug('Lottery scene environment initialized', 'ThreeSceneD');
    }

    private createLotteryBalls(): void {
        logger.debug('Creating lottery balls', 'ThreeSceneD');
        
        const ballRadius = 0.4;
        const geometry = new THREE.SphereGeometry(ballRadius, 32, 32);
        
        // Create 6 lottery balls in an arc formation
        for (let i = 0; i < 6; i++) {
            // Create material - first 5 white, last one red with enhanced reflections
            const isRedBall = i === 5;
            const material = new THREE.MeshStandardMaterial({
                color: isRedBall ? 0xff4444 : 0xffffff,
                metalness: 0.1, // Slight metallic property for better reflections
                roughness: 0.3, // Smoother surface for more reflections
                envMapIntensity: 2.0, // Much stronger environment reflections
                // clearcoat: 0.8, // Add clearcoat for glossy lottery ball finish - removed due to TS error
                // clearcoatRoughness: 0.1
            });

            const ball = new THREE.Mesh(geometry, material);

            // Position balls in a straight line toward top of viewport
            const spacing = 1.0; // Distance between ball centers
            ball.position.x = (i - 2.5) * spacing; // Center the line at x=0
            ball.position.y = 2.5; // Move balls even higher in viewport
            ball.position.z = 0;
            
            // Set consistent rotation for all balls to face camera properly
            ball.rotation.x = 0;
            ball.rotation.y = -Math.PI / 2; // Face toward camera
            ball.rotation.z = 0;

            // Store initial position for gentle floating animation only
            ball.userData = {
                initialX: ball.position.x,
                initialY: ball.position.y,
                initialZ: ball.position.z,
                bobOffset: Math.random() * Math.PI * 2
            };

            this.lotteryBalls.push(ball);
            this.threeManager.add(ball);
        }

        // Create glass shelf for balls to sit on
        this.createGlassShelf();

        this.loadingBar?.updateProgress(40);
        logger.debug('Lottery balls created', 'ThreeSceneD');
    }

    private createGlassShelf(): void {
        logger.debug('Creating glass shelf for lottery balls', 'ThreeSceneD');
        
        // Create main glass shelf geometry - thicker for more visibility
        const shelfWidth = 7; // Wide enough for all 6 balls plus margins
        const shelfHeight = 0.3; // Thicker shelf for better visibility
        const shelfDepth = 1.2; // Deep enough to support balls
        
        // Create main shelf
        const shelfGeometry = new THREE.BoxGeometry(shelfWidth, shelfHeight, shelfDepth);
        
        // Create highly reflective glass material
        const glassMaterial = new THREE.MeshStandardMaterial({
            color: 0xf0f8ff, // Very light blue tint for visibility
            transparent: true,
            opacity: 0.3, // Slightly more transparent to show reflections better
            roughness: 0.02, // Ultra-smooth glass for maximum reflections
            metalness: 0.0,
            envMapIntensity: 3.5, // Very strong environment reflections
            // transmission: 0.8, // Higher transmission for glass effect - removed due to TS error
            // thickness: 0.3,
            // clearcoat: 1.0, // Maximum clearcoat for glass-like finish
            // clearcoatRoughness: 0.0, // Perfect clearcoat reflections
            // ior: 1.5 // Index of refraction for realistic glass
        });
        
        const shelf = new THREE.Mesh(shelfGeometry, glassMaterial);
        shelf.position.x = 0;
        shelf.position.y = 2.0; // Position below raised balls (balls at y=2.5, radius=0.4)
        shelf.position.z = 0;
        
        this.threeManager.add(shelf);
        
        // Add beveled edges for realism
        this.createShelfBevels(shelfWidth, shelfHeight, shelfDepth, glassMaterial);
        
        logger.debug('Glass shelf with beveled edges created', 'ThreeSceneD');
    }

    private createShelfBevels(shelfWidth: number, shelfHeight: number, shelfDepth: number, glassMaterial: THREE.Material): void {
        // Create beveled edge strips
        const bevelSize = 0.05;
        
        // Front and back bevels
        const frontBevelGeometry = new THREE.BoxGeometry(shelfWidth, bevelSize, bevelSize);
        const backBevelGeometry = new THREE.BoxGeometry(shelfWidth, bevelSize, bevelSize);
        
        const frontBevel = new THREE.Mesh(frontBevelGeometry, glassMaterial);
        frontBevel.position.set(0, 2.0 + shelfHeight/2 + bevelSize/2, shelfDepth/2 + bevelSize/2);
        
        const backBevel = new THREE.Mesh(backBevelGeometry, glassMaterial);
        backBevel.position.set(0, 2.0 + shelfHeight/2 + bevelSize/2, -shelfDepth/2 - bevelSize/2);
        
        // Left and right bevels
        const sideBevelGeometry = new THREE.BoxGeometry(bevelSize, bevelSize, shelfDepth);
        
        const leftBevel = new THREE.Mesh(sideBevelGeometry, glassMaterial);
        leftBevel.position.set(-shelfWidth/2 - bevelSize/2, 2.0 + shelfHeight/2 + bevelSize/2, 0);
        
        const rightBevel = new THREE.Mesh(sideBevelGeometry, glassMaterial);
        rightBevel.position.set(shelfWidth/2 + bevelSize/2, 2.0 + shelfHeight/2 + bevelSize/2, 0);
        
        // Add corner bevels for more realism
        const cornerBevelGeometry = new THREE.BoxGeometry(bevelSize, bevelSize, bevelSize);
        
        const corners = [
            [-shelfWidth/2 - bevelSize/2, 2.0 + shelfHeight/2 + bevelSize/2, shelfDepth/2 + bevelSize/2],
            [shelfWidth/2 + bevelSize/2, 2.0 + shelfHeight/2 + bevelSize/2, shelfDepth/2 + bevelSize/2],
            [-shelfWidth/2 - bevelSize/2, 2.0 + shelfHeight/2 + bevelSize/2, -shelfDepth/2 - bevelSize/2],
            [shelfWidth/2 + bevelSize/2, 2.0 + shelfHeight/2 + bevelSize/2, -shelfDepth/2 - bevelSize/2]
        ];
        
        corners.forEach(([x, y, z]) => {
            const cornerBevel = new THREE.Mesh(cornerBevelGeometry, glassMaterial);
            cornerBevel.position.set(x!, y!, z!);
            this.threeManager.add(cornerBevel);
        });
        
        this.threeManager.add(frontBevel);
        this.threeManager.add(backBevel);
        this.threeManager.add(leftBevel);
        this.threeManager.add(rightBevel);
    }

    private createFrequencyWheel(): void {
        logger.debug('Creating roulette-style frequency wheel', 'ThreeSceneD');
        
        // Clear existing wheel
        if (this.frequencyWheel) {
            this.threeManager.scene.remove(this.frequencyWheel);
        }
        this.wheelBuckets.clear();
        
        // Create main wheel group
        this.frequencyWheel = new THREE.Group();
        this.frequencyWheel.position.set(0, -1, -2); // Below and behind main display
        
        // Get all possible numbers for white balls (1-69) and create buckets
        this.wheelNumbers = Array.from({length: 69}, (_, i) => i + 1);
        const bucketCount = this.wheelNumbers.length;
        const angleStep = (Math.PI * 2) / bucketCount;
        
        // Create wheel base (large circular platform) with high tessellation
        const wheelRadius = 6;
        const wheelBaseGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.1, bucketCount); // Match bucket count for alignment
        const dartboardTexture = this.createDartboardTexture(wheelRadius, bucketCount);
        const wheelBaseMaterial = new THREE.MeshStandardMaterial({
            map: dartboardTexture,
            metalness: 0.1,
            roughness: 0.6,
            envMapIntensity: 2.0
        });
        const wheelBase = new THREE.Mesh(wheelBaseGeometry, wheelBaseMaterial);
        wheelBase.position.y = 0;
        this.frequencyWheel.add(wheelBase);
        
        this.wheelNumbers.forEach((number, index) => {
            // Offset the angle by half a segment to center cubes in dartboard segments
            // Add 17 positions to align cubes with dartboard numbers
            const cubeOffset = 17 * angleStep;
            const angle = index * angleStep + (angleStep / 2) + cubeOffset;
            const bucketRadius = wheelRadius - 1.0; // More space from edge
            
            // Create bucket group
            const bucket = new THREE.Group();
            const x = Math.cos(angle) * bucketRadius;
            const z = Math.sin(angle) * bucketRadius;
            bucket.position.set(x, 0, z); // Position bucket at disk level
            
            // Calculate forward vector from wheel center to cube position
            const centerToPosition = new THREE.Vector3(x, 0, z).normalize();
            // Calculate the rotation needed to make the cube face toward the center (camera)
            // We want the cube's front face (-Z in local space) to point toward center
            const targetDirection = centerToPosition.clone().negate(); // Point toward center
            
            // Use lookAt to orient the bucket toward the center
            const lookAtTarget = new THREE.Vector3().addVectors(
                bucket.position, 
                targetDirection
            );
            bucket.lookAt(lookAtTarget);
            
            // Create bucket base as cube with number texture on all sides
            const bucketGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
            const numberTexture = this.createNumberTexture(number, false);
            const bucketMaterial = new THREE.MeshStandardMaterial({
                map: numberTexture,
                color: 0x666666,
                metalness: 0.2,
                roughness: 0.6,
                envMapIntensity: 1.5
            });
            const bucketMesh = new THREE.Mesh(bucketGeometry, bucketMaterial);
            // Position cube so its bottom face touches the disk top surface
            // Disk height = 0.1, disk center at Y=0, so disk top is at Y=0.05
            // Cube height = 0.3, so cube center should be at Y = 0.05 + 0.15 = 0.2
            bucketMesh.position.y = 0.2; 
            bucket.add(bucketMesh);
            
            this.wheelBuckets.set(number, bucket);
            this.frequencyWheel?.add(bucket);
        });
        
        // Make wheel visible by default
        this.frequencyWheel.visible = true;
        
        this.threeManager.add(this.frequencyWheel);
        this.createDartboardPointer();
        this.setupKeyboardControls();
        
        logger.debug(`Created frequency wheel with ${bucketCount} numbered buckets and dartboard base`, 'ThreeSceneD');
    }
    
    private createDartboardPointer(): void {
        logger.debug('Creating dartboard pointer', 'ThreeSceneD');
        
        // Create triangular pointer geometry - even larger for visibility
        const pointerGeometry = new THREE.ConeGeometry(0.2, 0.8, 3); // Much larger triangular cone
        const pointerMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000, // Bright red for maximum visibility
            metalness: 0.3,
            roughness: 0.4,
            envMapIntensity: 1.5,
            emissive: 0x330000, // Red glow
            emissiveIntensity: 0.3
        });
        
        this.dartboardPointer = new THREE.Mesh(pointerGeometry, pointerMaterial);
        
        // Position will be set by updatePointerPosition()
        this.dartboardPointer.position.y = 0; // Will be updated
        this.dartboardPointer.rotation.z = Math.PI / 2; // Rotate to point horizontally inward
        
        // Position at camera-closest point of dartboard edge
        this.updatePointerPosition();
        
        // Add pointer to scene directly, not to wheel group, so it stays fixed relative to camera
        this.threeManager.add(this.dartboardPointer);
        
        logger.debug('Dartboard pointer created and positioned', 'ThreeSceneD');
    }
    
    private updatePointerPosition(): void {
        if (!this.dartboardPointer || !this.frequencyWheel) return;
        
        // Get camera position and wheel position
        const cameraPosition = this.threeManager.camera.position.clone();
        const wheelWorldPosition = new THREE.Vector3();
        this.frequencyWheel.getWorldPosition(wheelWorldPosition);
        
        // Calculate direction from wheel center to camera (projected to XZ plane)
        const directionToCamera = new THREE.Vector3(
            cameraPosition.x - wheelWorldPosition.x,
            0, // Keep on wheel plane
            cameraPosition.z - wheelWorldPosition.z
        ).normalize();
        
        // Position pointer EXACTLY on the dartboard edge (wheelRadius = 6)
        const pointerDistance = this.wheelRadius - 0.1; // Just inside the wheel edge
        
        // Set absolute world position relative to wheel center
        this.dartboardPointer.position.set(
            wheelWorldPosition.x + directionToCamera.x * pointerDistance,
            wheelWorldPosition.y + 0.1, // Just above wheel surface for visibility
            wheelWorldPosition.z + directionToCamera.z * pointerDistance
        );
        
        // Rotate pointer to point toward the wheel center
        const angleToCenter = Math.atan2(-directionToCamera.z, -directionToCamera.x);
        this.dartboardPointer.rotation.y = angleToCenter;
        this.dartboardPointer.rotation.z = Math.PI / 2; // Keep pointing horizontally inward
        
        logger.debug(`Pointer positioned ON dartboard edge at: ${this.dartboardPointer.position.x.toFixed(2)}, ${this.dartboardPointer.position.y.toFixed(2)}, ${this.dartboardPointer.position.z.toFixed(2)}`, 'ThreeSceneD');
    }

    private createNumberLabel(number: number, isRedBall: boolean): THREE.Mesh {
        // Create canvas for number label - larger and higher resolution
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        
        if (context) {
            // Enable high quality rendering
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';
            
            // Transparent background - don't fill the canvas
            context.clearRect(0, 0, 128, 128);
            
            // White text with black outline for visibility on any background
            context.font = 'bold 48px "Roboto Condensed", Arial';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            
            // Draw black stroke outline first
            context.strokeStyle = '#000000';
            context.lineWidth = 3;
            context.strokeText(number.toString(), 64, 64);
            
            // Draw white fill text
            context.fillStyle = '#ffffff';
            context.fillText(number.toString(), 64, 64);
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        const labelGeometry = new THREE.PlaneGeometry(0.6, 0.6); // Bigger label
        const labelMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            transparent: true,
            envMapIntensity: 1.5
        });
        
        return new THREE.Mesh(labelGeometry, labelMaterial);
    }

    private createDartboardTexture(radius: number, segmentCount: number): THREE.CanvasTexture {
        // Create high-resolution canvas for dartboard
        const canvas = document.createElement('canvas');
        const size = 1024;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        
        if (context) {
            const centerX = size / 2;
            const centerY = size / 2;
            const maxRadius = size / 2 - 10; // Leave some margin
            
            // Enable high quality rendering
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';
            
            // Fill background
            context.fillStyle = '#1a1a1a';
            context.fillRect(0, 0, size, size);
            
            // Draw dartboard segments
            const angleStep = (Math.PI * 2) / segmentCount;
            
            for (let i = 0; i < segmentCount; i++) {
                // Offset by 17 positions to align with wheel rotation
                const offset = 17 * angleStep;
                const startAngle = i * angleStep - Math.PI / 2 + offset;
                const endAngle = (i + 1) * angleStep - Math.PI / 2 + offset;
                
                // Alternate colors for visibility
                const isEven = i % 2 === 0;
                context.fillStyle = isEven ? '#2a2a2a' : '#404040';
                
                // Draw segment
                context.beginPath();
                context.moveTo(centerX, centerY);
                context.arc(centerX, centerY, maxRadius, startAngle, endAngle);
                context.closePath();
                context.fill();
                
                // Draw segment border
                context.strokeStyle = '#666666';
                context.lineWidth = 1;
                context.stroke();
                
                // Draw number closer to outer edge to avoid cube obstruction
                const number = i + 1;
                const textAngle = startAngle + angleStep / 2;
                const textRadius = maxRadius * 0.95; // Moved much closer to edge
                const textX = centerX + Math.cos(textAngle) * textRadius;
                const textY = centerY + Math.sin(textAngle) * textRadius;
                
                context.save();
                context.translate(textX, textY);
                // Flip all numbers 180 degrees to make them readable
                const rotationAngle = textAngle + Math.PI / 2 + Math.PI;
                context.rotate(rotationAngle);
                context.fillStyle = '#ffffff';
                context.font = 'bold 14px Arial'; // Slightly smaller to fit at edge
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillText(number.toString(), 0, 0);
                context.restore();
            }
            
            // Draw center circle
            context.beginPath();
            context.arc(centerX, centerY, 20, 0, Math.PI * 2);
            context.fillStyle = '#666666';
            context.fill();
            context.strokeStyle = '#888888';
            context.lineWidth = 2;
            context.stroke();
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.generateMipmaps = false;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        
        return texture;
    }

    private createNumberTexture(number: number, isRedBall: boolean): THREE.CanvasTexture {
        // Create canvas for cube texture
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        
        if (context) {
            // Enable high quality rendering
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';
            
            // Dark background for cube face
            context.fillStyle = isRedBall ? '#ff0000' : '#333333';
            context.fillRect(0, 0, 128, 128);
            
            // Add subtle border
            context.strokeStyle = '#777777';
            context.lineWidth = 3;
            context.strokeRect(0, 0, 128, 128);
            
            // White text with good contrast
            context.font = 'bold 56px "Roboto Condensed", Arial';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillStyle = '#ffffff';
            context.fillText(number.toString(), 64, 64);
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.generateMipmaps = false;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        
        return texture;
    }

    private setupKeyboardControls(): void {
        // Remove existing listener if it exists
        if (this.keyboardListener) {
            document.removeEventListener('keydown', this.keyboardListener);
        }
        
        this.keyboardListener = (event: KeyboardEvent) => {
            logger.debug(`Key pressed: ${event.key}, frequency mode: ${this.showFrequencyMode}, wheel exists: ${!!this.frequencyWheel}`, 'ThreeSceneD');
            
            if (!this.showFrequencyMode || !this.frequencyWheel) {
                logger.debug('Arrow key ignored - frequency mode disabled or wheel not ready', 'ThreeSceneD');
                return;
            }
            
            switch (event.key) {
                case 'ArrowLeft':
                    event.preventDefault();
                    logger.debug('Arrow Left pressed - rotating wheel left', 'ThreeSceneD');
                    this.rotateWheelToNextNumber(-1);
                    break;
                case 'ArrowRight':
                    event.preventDefault();
                    logger.debug('Arrow Right pressed - rotating wheel right', 'ThreeSceneD');
                    this.rotateWheelToNextNumber(1);
                    break;
            }
        };
        
        document.addEventListener('keydown', this.keyboardListener);
        logger.info('Keyboard controls for wheel rotation setup and active', 'ThreeSceneD');
    }

    private rotateWheelToNextNumber(direction: number): void {
        if (!this.frequencyWheel || this.wheelNumbers.length === 0) {
            logger.warn('Cannot rotate wheel - wheel or numbers not available', 'ThreeSceneD');
            return;
        }
        
        const currentIndex = Math.round(this.currentWheelRotation / (Math.PI * 2 / this.wheelNumbers.length));
        const nextIndex = (currentIndex + direction + this.wheelNumbers.length) % this.wheelNumbers.length;
        const targetRotation = (nextIndex * Math.PI * 2) / this.wheelNumbers.length;
        
        logger.debug(`Rotating wheel from index ${currentIndex} to ${nextIndex} (direction: ${direction})`, 'ThreeSceneD');
        
        // Smooth rotation animation
        this.animateWheelRotation(targetRotation);
        
        const selectedNumber = this.wheelNumbers[nextIndex];
        if (selectedNumber !== undefined) {
            this.displayFrequencyForNumber(selectedNumber, false);
        }
        
        logger.info(`Rotated wheel to number ${selectedNumber} (index: ${nextIndex})`, 'ThreeSceneD');
    }

    private animateWheelRotation(targetRotation: number): void {
        if (!this.frequencyWheel) return;
        
        const startRotation = this.currentWheelRotation;
        const rotationDiff = targetRotation - startRotation;
        const animationDuration = 300; // ms
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / animationDuration, 1);
            
            // Smooth easing function
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            
            this.currentWheelRotation = startRotation + rotationDiff * easedProgress;
            this.frequencyWheel!.rotation.y = this.currentWheelRotation;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Pointer stays fixed at camera-closest position
                // No need to update as it doesn't rotate with wheel
            }
        };
        
        animate();
    }

    private async analyzeAndDisplayFrequencies(): Promise<void> {
        try {
            logger.info('Fetching historical data for frequency analysis', 'ThreeSceneD');
            
            // Fetch more historical data for analysis
            const historicalData = await this.lotteryAnalyzer.fetchHistoricalData(200);
            
            if (historicalData.length > 0) {
                // Analyze the data
                this.lotteryAnalyzer.analyzeData(historicalData);
                
                // Create frequency wheel if not already created
                if (!this.frequencyWheel) {
                    this.createFrequencyWheel();
                }
                
                // Fill all wheel buckets with frequency balls
                this.fillAllWheelBuckets();
                
                logger.info(`Analyzed ${historicalData.length} historical draws`, 'ThreeSceneD');
            }
        } catch (error) {
            logger.error(`Error in frequency analysis: ${error}`, 'ThreeSceneD');
        }
    }

    private displayFrequencyForNumber(number: number, isRedBall: boolean = false): void {
        if (!this.showFrequencyMode) return;
        
        const frequency = this.lotteryAnalyzer.getFrequencyForNumber(number, isRedBall);
        logger.info(`Number ${number} ${isRedBall ? '(Powerball)' : '(White ball)'} has appeared ${frequency} times`, 'ThreeSceneD');
        
        this.selectedNumberForFrequency = number;
        this.updateUI();
    }

    private fillAllWheelBuckets(): void {
        logger.debug('Filling all wheel buckets with frequency balls', 'ThreeSceneD');
        
        this.wheelBuckets.forEach((bucket, number) => {
            this.fillWheelBucketWithFrequencyBalls(bucket, number);
        });
    }

    private fillWheelBucketWithFrequencyBalls(bucket: THREE.Group, number: number): void {
        // Clear existing frequency balls from bucket
        const existingBalls = bucket.children.filter(child => child.userData.isFrequencyBall);
        existingBalls.forEach(ball => bucket.remove(ball));
        
        const frequency = this.lotteryAnalyzer.getFrequencyForNumber(number, false);
        if (frequency === 0) return;
        
        // Add frequency balls - smaller and stacked
        const maxBallsToShow = Math.min(frequency, 15); // Cap for visual clarity
        const ballRadius = 0.04;
        
        for (let i = 0; i < maxBallsToShow; i++) {
            const ballGeometry = new THREE.SphereGeometry(ballRadius, 12, 12);
            const ballMaterial = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                metalness: 0.1,
                roughness: 0.3,
                envMapIntensity: 1.8
            });
            
            const frequencyBall = new THREE.Mesh(ballGeometry, ballMaterial);
            
            // Arrange balls in depth (toward/away from camera) so they're all visible
            const layer = Math.floor(i / 4); // 4 balls per layer
            const positionInLayer = i % 4;
            
            // Create a 2x2 grid pattern for each layer, arranged in depth
            const gridX = (positionInLayer % 2) * ballRadius * 1.8;
            const gridZ = Math.floor(positionInLayer / 2) * ballRadius * 1.8;
            
            // Center the grid and arrange in depth, positioned above the cube base
            frequencyBall.position.x = gridX - ballRadius * 0.9; // Center horizontally
            frequencyBall.position.z = gridZ - ballRadius * 0.9; // Centered depth arrangement
            frequencyBall.position.y = 0.35 + layer * ballRadius * 3.2; // Start above cube top
            
            frequencyBall.userData.isFrequencyBall = true;
            bucket.add(frequencyBall);
        }
        
        logger.debug(`Added ${maxBallsToShow} balls to wheel bucket ${number} (frequency: ${frequency})`, 'ThreeSceneD');
    }

    private setupCamera(): void {
        this.threeManager.camera.position.set(0, 2, 6);
        this.threeManager.camera.lookAt(0, 0, 0);
        
        this.loadingBar?.updateProgress(50);
        logger.debug('Camera positioned for lottery ball viewing', 'ThreeSceneD');
    }

    private async loadEnvironment(): Promise<void> {
        try {
            logger.debug('Loading HDR environment for lottery ball lighting', 'ThreeSceneD');
            
            // Load HDR environment map for realistic lighting
            const hdrTextureUrl = 'https://threejs.org/examples/textures/equirectangular/venice_sunset_1k.hdr';
            this.environmentMap = await this.rgbeLoader.loadAsync(hdrTextureUrl);
            this.environmentMap.mapping = THREE.EquirectangularReflectionMapping;
            
            // Set as scene environment for lighting/reflections
            this.threeManager.scene.environment = this.environmentMap;
            
            this.loadingBar?.updateProgress(35);
            logger.debug('HDR environment loaded successfully', 'ThreeSceneD');
            
        } catch (error) {
            logger.warn('Failed to load HDR environment, using fallback lighting', 'ThreeSceneD');
            logger.debug(error, 'ThreeSceneD');
            // Fallback to basic lighting if HDR fails - setupLighting will handle this
        }
    }

    private setupLighting(): void {
        logger.debug('Setting up lottery scene lighting', 'ThreeSceneD');
        
        // Reduce ambient light to let environment map dominate
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        this.threeManager.add(ambientLight);
        
        // Add main point light for ball illumination with enhanced shadows
        this.pointLight = new THREE.PointLight(0xffffff, 1.5, 100);
        this.pointLight.position.set(0, 4, 4);
        this.pointLight.castShadow = true;
        this.pointLight.shadow.mapSize.width = 2048;
        this.pointLight.shadow.mapSize.height = 2048;
        this.pointLight.shadow.camera.near = 0.1;
        this.pointLight.shadow.camera.far = 25;
        this.threeManager.add(this.pointLight);
        
        // Add rim lighting to enhance reflections
        const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
        rimLight.position.set(2, 3, -2);
        this.threeManager.add(rimLight);
        
        // Add fill light from opposite side
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
        fillLight.position.set(-2, 2, 3);
        this.threeManager.add(fillLight);
        
        // Add subtle colored accent for visual interest
        const accentLight = new THREE.PointLight(0x88bbff, 0.4, 50);
        accentLight.position.set(-3, 1, 2);
        this.threeManager.add(accentLight);
        
        // Enable renderer settings for better reflections
        this.threeManager.renderer.shadowMap.enabled = true;
        this.threeManager.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        this.loadingBar?.updateProgress(60);
        logger.debug('Enhanced lighting system complete', 'ThreeSceneD');
    }

    private createUI(): void {
        // Create main UI container (top left)
        this.uiContainer = document.createElement('div');
        this.uiContainer.style.cssText = `
            position: absolute;
            top: 20px;
            left: 20px;
            color: white;
            font-family: Arial, sans-serif;
            background: rgba(0, 0, 0, 0.7);
            padding: 15px;
            border-radius: 8px;
            z-index: 100;
            font-size: 14px;
            text-align: center;
        `;

        // Create arrow keys instruction container (bottom right)
        this.arrowKeysContainer = document.createElement('div');
        this.arrowKeysContainer.style.cssText = `
            position: absolute;
            bottom: 20px;
            right: 20px;
            color: white;
            font-family: Arial, sans-serif;
            background: rgba(0, 0, 0, 0.7);
            padding: 10px;
            border-radius: 8px;
            z-index: 100;
            font-size: 12px;
        `;
        this.arrowKeysContainer.innerHTML = 'Use ← → arrow keys to rotate wheel';

        // Create frequency analysis container (bottom left)
        this.frequencyAnalysisContainer = document.createElement('div');
        this.frequencyAnalysisContainer.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 20px;
            color: white;
            font-family: Arial, sans-serif;
            background: rgba(0, 0, 0, 0.7);
            padding: 10px;
            border-radius: 8px;
            z-index: 100;
            font-size: 12px;
            max-width: 250px;
        `;

        document.body.appendChild(this.uiContainer);
        document.body.appendChild(this.arrowKeysContainer);
        document.body.appendChild(this.frequencyAnalysisContainer);
        this.updateUI();

        this.loadingBar?.updateProgress(70);
        logger.debug('Lottery UI created', 'ThreeSceneD');
    }

    private updateUI(): void {
        if (!this.uiContainer) return;

        const formattedDate = this.formatDate(this.drawDate);
        
        // Clean UI with no instruction text
        this.uiContainer.innerHTML = ``;
        
        // Update frequency analysis container (bottom left)
        if (this.frequencyAnalysisContainer) {
            const frequencyInfo = this.selectedNumberForFrequency 
                ? `<div>
                    <strong style="color: #ffcc00;">Frequency Analysis</strong><br>
                    <div style="margin-top: 8px; font-size: 11px;">
                        Number <strong>${this.selectedNumberForFrequency}</strong> has appeared <strong>${this.lotteryAnalyzer.getFrequencyForNumber(this.selectedNumberForFrequency)}</strong> times in recent draws
                    </div>
                   </div>`
                : `<div style="color: #ccc; font-size: 11px;">Click a number above to see frequency analysis</div>`;
            
            if (this.frequencyAnalysisContainer) {
                this.frequencyAnalysisContainer.innerHTML = frequencyInfo;
            }
        }
        
        // No longer exposing UI methods as we use raycasting now
    }
    

    private formatDate(dateString: string): string {
        if (!dateString) return '';

        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric'
        });
    }

    private async fetchLotteryData(): Promise<void> {
        try {
            logger.info('Fetching latest Powerball data', 'ThreeSceneD');

            // Fetch latest Powerball result from NY data API
            const response = await fetch('https://data.ny.gov/resource/d6yy-54nr.json?$order=draw_date DESC&$limit=1');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: LotteryData[] = await response.json();

            if (data && data.length > 0) {
                const latest = data[0];
                if (latest) {
                    this.drawDate = latest.draw_date;
                    this.multiplier = latest.multiplier;

                    // Parse winning numbers
                    const numbers = latest.winning_numbers.split(' ').map(num => parseInt(num));
                    if (numbers.length >= 6) {
                        this.currentNumbers = numbers;
                        this.updateBallNumbers();
                        this.updateUI();
                    }

                    logger.info(`Lottery data loaded successfully ${this.currentNumbers}`, 'ThreeSceneD');
                }
            } else {
                // Update 3D text with default data if no API data
                this.update3DTexts();
            }
        } catch (error) {
            logger.error(`Error fetching lottery data: ${error}`, 'ThreeSceneD');
            // Use default/demo numbers
            this.currentNumbers = [13, 47, 52, 64, 67, 25];
            this.drawDate = new Date().toISOString();
            this.multiplier = '2';
            this.updateBallNumbers();
            this.update3DTexts();
            this.updateUI();
        }

        this.loadingBar?.updateProgress(80);
    }

    private updateBallNumbers(): void {
        logger.debug(`Updating ball numbers: ${this.currentNumbers}`, 'ThreeSceneD');
        
        // Create number textures on the balls
        for (let i = 0; i < this.lotteryBalls.length && i < this.currentNumbers.length; i++) {
            const ball = this.lotteryBalls[i];
            const number = this.currentNumbers[i];

            if (!ball || number === undefined) continue;

            // Create high-resolution canvas for number texture
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const context = canvas.getContext('2d');

            if (context) {
                const isRedBall = i === 5;
                
                // Enable high-quality rendering
                context.imageSmoothingEnabled = true;
                context.imageSmoothingQuality = 'high';
                
                // Fill canvas with pure colors
                context.fillStyle = isRedBall ? '#FF0000' : '#FFFFFF';  // 100% pure red or white
                context.fillRect(0, 0, 512, 512);

                // Ensure maximum opacity and no interference
                context.globalAlpha = 1.0;
                context.shadowColor = 'transparent';
                context.shadowBlur = 0;
                context.shadowOffsetX = 0;
                context.shadowOffsetY = 0;
                
                const text = number.toString();
                context.font = 'bold condensed 120px "Roboto Condensed", Arial';
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                
                if (isRedBall) {
                    // For red ball: 100% pure white text on 100% red background
                    context.fillStyle = '#FFFFFF';  // Pure white
                    context.strokeStyle = '#FFFFFF';  // Pure white
                    context.lineWidth = 4;
                    context.globalCompositeOperation = 'source-over';  // Ensure no blending
                    context.fillText(text, 256, 256);
                    context.strokeText(text, 256, 256);
                } else {
                    // For white balls: 100% black text on white background
                    context.fillStyle = '#000000';  // Pure black
                    context.strokeStyle = '#000000';  // Pure black
                    context.lineWidth = 2;
                    context.globalCompositeOperation = 'source-over';
                    context.fillText(text, 256, 256);
                    context.strokeText(text, 256, 256);
                }

                // Create texture with high-quality settings
                const texture = new THREE.CanvasTexture(canvas);
                texture.needsUpdate = true;
                texture.generateMipmaps = false;
                texture.magFilter = THREE.LinearFilter;
                texture.minFilter = THREE.LinearFilter;
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                
                const material = ball.material as THREE.MeshStandardMaterial;
                material.map = texture;
                material.needsUpdate = true;
                
                // Set material color to white so it doesn't interfere with texture colors
                material.color.setHex(0xffffff);
                
                logger.debug(`Applied number ${number} to ball ${i} (${isRedBall ? 'red' : 'white'})`, 'ThreeSceneD');
            }
        }

        logger.debug('Ball numbers updated', 'ThreeSceneD');
        
        // Update 3D text elements with new data
        this.update3DTexts();
    }
    
    private create3DTexts(): void {
        logger.debug('Creating 3D text elements for scene', 'ThreeSceneD');
        
        // Create Powerball logo above the balls - 6x larger
        this.powerballLogo = this.create3DTextMesh('POWERBALL®', {
            size: 1.8, // 6x larger (was 0.3, then 0.9)
            height: 0.3, // 6x larger (was 0.05, then 0.15)
            position: { x: 0, y: 3.5, z: 0 },
            color: 0xff0000,
            metalness: 0.8,
            roughness: 0.2
        });
        this.threeManager.add(this.powerballLogo);
        
        // Create placeholder for combined date and power play text (will be updated with real data)
        this.dateText = this.create3DTextMesh('Loading...', {
            size: 0.9, // 6x larger (was 0.15, then 0.45)
            height: 0.12, // 6x larger (was 0.02, then 0.06)
            position: { x: 0, y: 1.2, z: 0 },
            color: 0xffffff,
            metalness: 0.1,
            roughness: 0.8
        });
        this.threeManager.add(this.dateText);
        
        // Power play text will be combined with date text, so no separate text needed
        this.powerPlayText = null;
        
        logger.debug('3D text elements created', 'ThreeSceneD');
    }
    
    private create3DTextMesh(text: string, options: {
        size: number;
        height: number;
        position: { x: number; y: number; z: number };
        color: number;
        metalness: number;
        roughness: number;
    }): THREE.Mesh {
        // Create canvas for text texture
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 256;
        const context = canvas.getContext('2d');
        
        if (context) {
            // High quality text rendering
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';
            
            // Clear background
            context.clearRect(0, 0, canvas.width, canvas.height);
            
            // Set font and alignment
            context.font = 'bold 80px Arial';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            
            // Draw text with outline for visibility
            context.strokeStyle = '#000000';
            context.lineWidth = 4;
            context.strokeText(text, canvas.width / 2, canvas.height / 2);
            
            context.fillStyle = '#ffffff';
            context.fillText(text, canvas.width / 2, canvas.height / 2);
        }
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.generateMipmaps = false;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        
        // Create plane geometry for text
        const aspect = canvas.width / canvas.height;
        const geometry = new THREE.PlaneGeometry(options.size * aspect, options.size);
        
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            transparent: true,
            color: options.color,
            metalness: options.metalness,
            roughness: options.roughness,
            envMapIntensity: 2.0
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(options.position.x, options.position.y, options.position.z);
        
        return mesh;
    }
    
    private update3DTexts(): void {
        // Update combined date and power play text on same line
        if (this.dateText) {
            const formattedDate = this.formatDate(this.drawDate) || new Date().toLocaleDateString();
            const combinedText = `${formattedDate}  •  Power Play: ${this.multiplier}x`;
            const newDateMesh = this.create3DTextMesh(combinedText, {
                size: 0.9, // 6x larger (was 0.15, then 0.45)
                height: 0.12, // 6x larger (was 0.02, then 0.06)
                position: { x: 0, y: 1.2, z: 0 },
                color: 0xffffff,
                metalness: 0.1,
                roughness: 0.8
            });
            
            this.threeManager.scene.remove(this.dateText);
            this.dateText.geometry.dispose();
            if (this.dateText.material) {
                const mat = this.dateText.material as THREE.MeshStandardMaterial;
                if (mat.map) mat.map.dispose();
                mat.dispose();
            }
            
            this.dateText = newDateMesh;
            this.threeManager.add(this.dateText);
        }
        
        // Power play text is now combined with date text, so no separate update needed
        
        logger.debug('3D text elements updated', 'ThreeSceneD');
    }
    
    private setupBallInteraction(): void {
        logger.debug('Setting up ball interaction with raycasting', 'ThreeSceneD');
        
        // Remove existing listener if it exists
        if (this.clickListener) {
            this.threeManager.renderer.domElement.removeEventListener('click', this.clickListener);
        }
        
        this.clickListener = (event: MouseEvent) => {
            // Calculate mouse position in normalized device coordinates (-1 to +1)
            const rect = this.threeManager.renderer.domElement.getBoundingClientRect();
            this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            // Update the raycaster with camera and mouse position
            this.raycaster.setFromCamera(this.mouse, this.threeManager.camera);
            
            // Check for intersections with lottery balls
            const intersects = this.raycaster.intersectObjects(this.lotteryBalls);
            
            if (intersects.length > 0) {
                // Find which ball was clicked
                const clickedBall = intersects[0]?.object as THREE.Mesh;
                const ballIndex = this.lotteryBalls.indexOf(clickedBall);
                
                if (ballIndex !== -1 && ballIndex < this.currentNumbers.length) {
                    const clickedNumber = this.currentNumbers[ballIndex];
                    const isRedBall = ballIndex === 5;
                    
                    logger.info(`Clicked ${isRedBall ? 'red' : 'white'} ball with number ${clickedNumber}`, 'ThreeSceneD');
                    
                    // Show frequency analysis
                    if (clickedNumber !== undefined) {
                        this.displayFrequencyForNumber(clickedNumber, isRedBall);
                    }
                    
                    // Rotate wheel to the clicked number (for all balls if number exists on wheel)
                    if (this.frequencyWheel && clickedNumber !== undefined && this.wheelNumbers.includes(clickedNumber)) {
                        this.rotateWheelToNumber(clickedNumber);
                    }
                }
            }
        };
        
        // Add click listener to canvas
        this.threeManager.renderer.domElement.addEventListener('click', this.clickListener);
        
        logger.info('Ball interaction setup complete - click balls to see frequency analysis', 'ThreeSceneD');
    }
    
    private rotateWheelToNumber(targetNumber: number): void {
        if (!this.frequencyWheel || !this.showFrequencyMode) {
            logger.debug('Cannot rotate wheel - wheel not available or frequency mode disabled', 'ThreeSceneD');
            return;
        }
        
        // Find the index of the target number in the wheel
        const targetIndex = this.wheelNumbers.indexOf(targetNumber);
        if (targetIndex === -1) {
            logger.warn(`Number ${targetNumber} not found in wheel numbers`, 'ThreeSceneD');
            return;
        }
        
        // Calculate where the pointer is pointing (camera direction)
        const cameraPosition = this.threeManager.camera.position.clone();
        const wheelWorldPosition = new THREE.Vector3();
        this.frequencyWheel.getWorldPosition(wheelWorldPosition);
        
        const directionToCamera = new THREE.Vector3(
            cameraPosition.x - wheelWorldPosition.x,
            0,
            cameraPosition.z - wheelWorldPosition.z
        ).normalize();
        
        // Calculate the angle where the pointer is pointing
        const pointerAngle = Math.atan2(directionToCamera.z, directionToCamera.x);
        
        // Calculate where the target number currently is
        const angleStep = (Math.PI * 2) / this.wheelNumbers.length;
        // Add 34-position offset to fix off-by-one alignment issue
        const dartboardOffset = 34 * angleStep;
        const currentNumberAngle = targetIndex * angleStep - Math.PI / 2 + (angleStep / 2) + dartboardOffset;
        
        // Calculate how much to rotate to align target number with pointer
        // Reverse the direction - rotate the number TO the pointer position
        const targetRotation = currentNumberAngle - pointerAngle;
        
        logger.debug(`Rotating wheel to align number ${targetNumber} (index ${targetIndex}) with pointer at angle ${(pointerAngle * 180 / Math.PI).toFixed(1)}°`, 'ThreeSceneD');
        
        // Smooth rotation animation
        this.animateWheelRotation(targetRotation);
        
        // Update pointer position immediately since it's now fixed to camera position
        this.updatePointerPosition();
    }

    private completeLoading(): void {
        // Complete loading
        this.loadingBar?.updateProgress(100);
        this.isLoaded = true;
        
        // Auto-hide loader after brief delay
        setTimeout(() => {
            this.hideLoader();
        }, 1500);
        
        logger.info('ThreeSceneD lottery ball viewer loaded successfully', 'ThreeSceneD');
    }

    public animate(): void {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        if (this.isLoaded && this.lotteryBalls.length > 0) {
            this.time += 0.016;
            
            // Keep lottery balls stationary in line
            this.lotteryBalls.forEach((ball, index) => {
                const userData = ball.userData;

                // Keep balls in fixed positions and rotation
                ball.position.x = userData.initialX;
                ball.position.y = userData.initialY;
                ball.position.z = userData.initialZ;

                // Maintain consistent rotation (no random rotations)
                ball.rotation.x = 0;
                ball.rotation.y = -Math.PI / 2;
                ball.rotation.z = 0;
            });
            
            // Animate main light in a slow orbit
            this.pointLight.position.x = Math.cos(this.time * 0.3) * 2;
            this.pointLight.position.z = Math.sin(this.time * 0.3) * 2 + 4;
        }
        
        // Frequency wheel cubes are now pre-oriented using vector math to face toward center
        
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

        // Clean up keyboard listener
        if (this.keyboardListener) {
            document.removeEventListener('keydown', this.keyboardListener);
            this.keyboardListener = null;
        }
        
        // Clean up click listener
        if (this.clickListener) {
            this.threeManager.renderer.domElement.removeEventListener('click', this.clickListener);
            this.clickListener = null;
        }

        // Clean up UI containers
        if (this.uiContainer && this.uiContainer.parentNode) {
            this.uiContainer.parentNode.removeChild(this.uiContainer);
        }
        if (this.arrowKeysContainer && this.arrowKeysContainer.parentNode) {
            this.arrowKeysContainer.parentNode.removeChild(this.arrowKeysContainer);
        }
        if (this.frequencyAnalysisContainer && this.frequencyAnalysisContainer.parentNode) {
            this.frequencyAnalysisContainer.parentNode.removeChild(this.frequencyAnalysisContainer);
        }

        // Dispose of 3D resources
        this.lotteryBalls.forEach(ball => {
            if (ball.geometry) ball.geometry.dispose();
            if (ball.material) {
                const material = ball.material as THREE.MeshStandardMaterial;
                if (material.map) material.map.dispose();
                material.dispose();
            }
        });
        
        // Dispose of 3D text elements
        [this.powerballLogo, this.dateText].forEach(textMesh => {
            if (textMesh) {
                textMesh.geometry.dispose();
                if (textMesh.material) {
                    const mat = textMesh.material as THREE.MeshStandardMaterial;
                    if (mat.map) mat.map.dispose();
                    mat.dispose();
                }
            }
        });
        
        // Dispose of dartboard pointer
        if (this.dartboardPointer) {
            this.dartboardPointer.geometry.dispose();
            if (this.dartboardPointer.material) {
                const mat = this.dartboardPointer.material as THREE.MeshStandardMaterial;
                mat.dispose();
            }
        }

        this.threeManager.renderer.dispose();
        logger.info('ThreeSceneD lottery viewer disposed', 'ThreeSceneD');
    }
}