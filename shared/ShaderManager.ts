import * as THREE from 'three';

export interface ShaderDefinition {
    vertexShader: string;
    fragmentShader: string;
    uniforms: { [key: string]: THREE.IUniform };
}

export class ShaderManager {
    private static shaders: Map<string, ShaderDefinition> = new Map();
    private static initialized: boolean = false;

    /**
     * Initialize all shaders - called once to load all available shaders
     */
    public static init(): void {
        if (this.initialized) return;

        // Sky Environment Shader
        this.shaders.set('skyEnvironment', {
            vertexShader: `
                varying vec3 vWorldPosition;
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D skyTexture;
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                varying vec2 vUv;
                void main() {
                    // Sample the sky texture
                    vec4 textureColor = texture2D(skyTexture, vUv);
                    
                    // Calculate gradient for blending
                    float h = normalize(vWorldPosition + offset).y;
                    float gradientFactor = max(pow(max(h, 0.0), exponent), 0.0);
                    vec3 gradientColor = mix(bottomColor, topColor, gradientFactor);
                    
                    // Blend texture with gradient
                    vec3 finalColor = mix(gradientColor, textureColor.rgb, 0.7);
                    
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,
            uniforms: {
                skyTexture: { value: null },
                topColor: { value: new THREE.Color(0x0077ff) },
                bottomColor: { value: new THREE.Color(0xffffff) },
                offset: { value: 400 },
                exponent: { value: 0.6 }
            }
        });

        // Cloud Shader (if needed in future)
        this.shaders.set('clouds', {
            vertexShader: `
                varying vec3 vPosition;
                varying vec3 vNormal;
                varying vec3 vWorldPosition;
                
                void main() {
                    vPosition = position;
                    vNormal = normal;
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 cameraPosition;
                varying vec3 vPosition;
                varying vec3 vNormal;
                varying vec3 vWorldPosition;
                
                void main() {
                    // Distance from center for radial fade
                    float distanceFromCenter = length(vPosition) / 25.0;
                    
                    // Fresnel effect for edge fading
                    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
                    float fresnel = 1.0 - abs(dot(normalize(vNormal), viewDirection));
                    fresnel = pow(fresnel, 1.5);
                    
                    // Simple noise
                    float noise = sin(vPosition.x * 0.2) * sin(vPosition.y * 0.2) * sin(vPosition.z * 0.2);
                    noise = noise * 0.2 + 0.8;
                    
                    // Combine for alpha
                    float alpha = (1.0 - distanceFromCenter) * fresnel * noise * 0.8;
                    alpha = max(0.0, alpha);
                    
                    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
                }
            `,
            uniforms: {
                cameraPosition: { value: new THREE.Vector3() }
            }
        });

        // Basic Terrain Shader (if needed)
        this.shaders.set('terrain', {
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vNormal;
                void main() {
                    vUv = uv;
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D diffuseMap;
                uniform sampler2D normalMap;
                uniform vec3 lightDirection;
                varying vec2 vUv;
                varying vec3 vNormal;
                
                void main() {
                    vec4 diffuse = texture2D(diffuseMap, vUv);
                    vec3 normal = normalize(vNormal);
                    
                    float NdotL = max(dot(normal, normalize(lightDirection)), 0.0);
                    vec3 color = diffuse.rgb * (0.3 + 0.7 * NdotL);
                    
                    gl_FragColor = vec4(color, diffuse.a);
                }
            `,
            uniforms: {
                diffuseMap: { value: null },
                normalMap: { value: null },
                lightDirection: { value: new THREE.Vector3(1, 1, 1) }
            }
        });

        // Shield Shader with Fresnel Effect
        this.shaders.set('shield', {
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vViewPosition = mvPosition.xyz;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform float opacity;
                uniform vec3 color;
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                
                void main() {
                    // Calculate view direction (camera is at origin in view space)
                    vec3 viewDirection = normalize(-vViewPosition);
                    
                    // Fresnel effect - transparent when facing camera, opaque at edges
                    float fresnel = abs(dot(viewDirection, normalize(vNormal)));
                    
                    // Create rim lighting effect - only edges are visible
                    float rim = 1.0 - fresnel;
                    float alpha = pow(rim, 4.0) * opacity;
                    
                    // Discard fragments that are too transparent to avoid depth issues
                    if (alpha < 0.01) discard;
                    
                    gl_FragColor = vec4(color, alpha);
                }
            `,
            uniforms: {
                opacity: { value: 0.5 },
                color: { value: new THREE.Color(0x00aaff) }
            }
        });

        this.initialized = true;
    }

    /**
     * Find a shader by name
     * @param name - The name of the shader to retrieve
     * @returns ShaderDefinition or throws error if not found
     */
    public static find(name: string): ShaderDefinition {
        if (!this.initialized) {
            this.init();
        }

        const shader = this.shaders.get(name);
        if (!shader) {
            throw new Error(`Shader '${name}' not found. Available shaders: ${Array.from(this.shaders.keys()).join(', ')}`);
        }

        // Return a deep copy to avoid modifying the original
        return {
            vertexShader: shader.vertexShader,
            fragmentShader: shader.fragmentShader,
            uniforms: this.cloneUniforms(shader.uniforms)
        };
    }

    /**
     * Create a THREE.ShaderMaterial from a shader definition
     * @param name - The name of the shader
     * @param overrideUniforms - Optional uniforms to override defaults
     * @returns THREE.ShaderMaterial
     */
    public static createMaterial(name: string, overrideUniforms?: { [key: string]: any }): THREE.ShaderMaterial {
        const shaderDef = this.find(name);
        
        // Merge override uniforms if provided
        if (overrideUniforms) {
            for (const key in overrideUniforms) {
                if (shaderDef.uniforms[key]) {
                    shaderDef.uniforms[key].value = overrideUniforms[key];
                }
            }
        }

        return new THREE.ShaderMaterial({
            vertexShader: shaderDef.vertexShader,
            fragmentShader: shaderDef.fragmentShader,
            uniforms: shaderDef.uniforms,
            side: THREE.DoubleSide,
            transparent: true
        });
    }

    /**
     * Get list of available shader names
     */
    public static getAvailableShaders(): string[] {
        if (!this.initialized) {
            this.init();
        }
        return Array.from(this.shaders.keys());
    }

    /**
     * Add a custom shader at runtime
     */
    public static addShader(name: string, definition: ShaderDefinition): void {
        if (!this.initialized) {
            this.init();
        }
        this.shaders.set(name, definition);
    }

    /**
     * Deep clone uniforms to avoid reference issues
     */
    private static cloneUniforms(uniforms: { [key: string]: THREE.IUniform }): { [key: string]: THREE.IUniform } {
        const cloned: { [key: string]: THREE.IUniform } = {};
        

        for (const key in uniforms) {
            const uniform = uniforms[key];
            if(uniform){
                if (uniform.value instanceof THREE.Color) {
                    cloned[key] = { value: uniform.value.clone() };
                } else if (uniform.value instanceof THREE.Vector2) {
                    cloned[key] = { value: uniform.value.clone() };
                } else if (uniform.value instanceof THREE.Vector3) {
                    cloned[key] = { value: uniform.value.clone() };
                } else {
                    cloned[key] = { value: uniform.value };
                }
            }
        }
        
        return cloned;
    }
}