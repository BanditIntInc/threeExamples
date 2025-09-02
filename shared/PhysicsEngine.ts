import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { logger } from '../../../utils/logger';

export interface PhysicsBody {
    rigidBody: RAPIER.RigidBody;
    mesh: THREE.Mesh;
    id: number;
}

export class PhysicsEngine {
    private world: RAPIER.World | null = null;
    private bodies: Map<number, PhysicsBody> = new Map();
    private nextBodyId = 0;
    private initialized = false;

    public async init(): Promise<void> {
        if (this.initialized) return;

        try {
            await RAPIER.init();
            
            // Create physics world with reduced gravity for space-like hadron collider
            const gravity = new RAPIER.Vector3(0.0, -2.0, 0.0); // Much less than Earth gravity
            this.world = new RAPIER.World(gravity);
            
            this.initialized = true;
            logger.info('Rapier Physics engine initialized', 'PhysicsEngine');
        } catch (error) {
            logger.error('Failed to initialize physics engine:', error instanceof Error ? error.message : String(error));
            throw error;
        }
    }

    public addStaticBox(mesh: THREE.Mesh, position: THREE.Vector3, size: THREE.Vector3): number {
        if (!this.world || !this.initialized) {
            throw new Error('Physics engine not initialized');
        }

        // Create rigid body descriptor for static box
        const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(position.x, position.y, position.z);
        
        const rigidBody = this.world.createRigidBody(rigidBodyDesc);

        // Create box collider
        const colliderDesc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2);
        this.world.createCollider(colliderDesc, rigidBody);

        const id = this.nextBodyId++;
        this.bodies.set(id, { rigidBody, mesh, id });

        logger.debug(`Created static box physics body ${id}`, 'PhysicsEngine');
        return id;
    }

    public addDynamicSphere(mesh: THREE.Mesh, position: THREE.Vector3, radius: number, mass: number = 1.0, restitution: number = 0.8): number {
        if (!this.world || !this.initialized) {
            throw new Error('Physics engine not initialized');
        }

        // Create rigid body descriptor for dynamic sphere
        const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(position.x, position.y, position.z);
        
        const rigidBody = this.world.createRigidBody(rigidBodyDesc);

        // Create sphere collider with mass and restitution
        const colliderDesc = RAPIER.ColliderDesc.ball(radius)
            .setMass(mass)
            .setRestitution(restitution)
            .setFriction(0.3); // Add some friction
        
        this.world.createCollider(colliderDesc, rigidBody);

        const id = this.nextBodyId++;
        this.bodies.set(id, { rigidBody, mesh, id });

        logger.debug(`Created dynamic sphere physics body ${id} (r=${radius}, m=${mass})`, 'PhysicsEngine');
        return id;
    }

    public setVelocity(bodyId: number, velocity: THREE.Vector3): void {
        const body = this.bodies.get(bodyId);
        if (!body) {
            logger.warn(`Physics body ${bodyId} not found`, 'PhysicsEngine');
            return;
        }

        body.rigidBody.setLinvel(new RAPIER.Vector3(velocity.x, velocity.y, velocity.z), true);
    }

    public setPosition(bodyId: number, position: THREE.Vector3): void {
        const body = this.bodies.get(bodyId);
        if (!body) {
            logger.warn(`Physics body ${bodyId} not found`, 'PhysicsEngine');
            return;
        }

        body.rigidBody.setTranslation(new RAPIER.Vector3(position.x, position.y, position.z), true);
    }

    public setAngularVelocity(bodyId: number, angularVelocity: THREE.Vector3): void {
        const body = this.bodies.get(bodyId);
        if (!body) {
            logger.warn(`Physics body ${bodyId} not found`, 'PhysicsEngine');
            return;
        }

        body.rigidBody.setAngvel(new RAPIER.Vector3(angularVelocity.x, angularVelocity.y, angularVelocity.z), true);
    }

    public step(deltaTime: number): void {
        if (!this.world || !this.initialized) return;

        // Step the physics simulation
        this.world.step();

        // Sync physics positions to Three.js meshes
        let movingBodies = 0;
        this.bodies.forEach((body) => {
            const position = body.rigidBody.translation();
            const rotation = body.rigidBody.rotation();
            const velocity = body.rigidBody.linvel();

            // Update mesh position and rotation
            body.mesh.position.set(position.x, position.y, position.z);
            body.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

            // Count moving bodies for debugging
            if (velocity.x !== 0 || velocity.y !== 0 || velocity.z !== 0) {
                movingBodies++;
            }
        });

        // Physics debug logging removed for performance
    }

    public removeBody(bodyId: number): void {
        const body = this.bodies.get(bodyId);
        if (!body || !this.world) return;

        this.world.removeRigidBody(body.rigidBody);
        this.bodies.delete(bodyId);
        
        logger.debug(`Removed physics body ${bodyId}`, 'PhysicsEngine');
    }

    public clearAllBodies(): void {
        this.bodies.forEach((_, bodyId) => {
            this.removeBody(bodyId);
        });
    }

    public getVelocity(bodyId: number): THREE.Vector3 | null {
        const body = this.bodies.get(bodyId);
        if (!body) return null;

        const velocity = body.rigidBody.linvel();
        return new THREE.Vector3(velocity.x, velocity.y, velocity.z);
    }

    public getPosition(bodyId: number): THREE.Vector3 | null {
        const body = this.bodies.get(bodyId);
        if (!body) return null;

        const position = body.rigidBody.translation();
        return new THREE.Vector3(position.x, position.y, position.z);
    }

    public addImpulse(bodyId: number, impulse: THREE.Vector3): void {
        const body = this.bodies.get(bodyId);
        if (!body) return;

        body.rigidBody.applyImpulse(new RAPIER.Vector3(impulse.x, impulse.y, impulse.z), true);
    }

    public dispose(): void {
        if (this.world) {
            this.clearAllBodies();
            this.world.free();
            this.world = null;
        }
        this.initialized = false;
        logger.info('Physics engine disposed', 'PhysicsEngine');
    }
}