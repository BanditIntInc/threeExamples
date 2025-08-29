import React, { useEffect, useRef, useState } from 'react';
import { ThreeSceneB } from './threeSceneB';
import { ProductConfiguratorUI } from './components/ProductConfiguratorUI';
import { logger } from '../../utils/logger';

interface ThreeSceneBComponentProps {
    isActive: boolean;
}

export const ThreeSceneBComponent: React.FC<ThreeSceneBComponentProps> = ({ isActive }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sceneRef = useRef<ThreeSceneB | null>(null);
    const [currentMaterial, setCurrentMaterial] = useState('metal');
    const [currentColor, setCurrentColor] = useState('#cccccc');
    const [availableMaterials, setAvailableMaterials] = useState<string[]>([]);
    const [autoRotateEnabled, setAutoRotateEnabled] = useState(true);

    useEffect(() => {
        if (canvasRef.current && isActive && !sceneRef.current) {
            // Initialize the scene
            sceneRef.current = new ThreeSceneB(canvasRef.current);
            
            // Small delay to ensure materials are fully initialized
            setTimeout(() => {
                if (sceneRef.current) {
                    setAvailableMaterials(sceneRef.current.getMaterialNames());
                    setCurrentColor(sceneRef.current.getCurrentColor());
                }
            }, 100);
            
            // Start animation loop
            sceneRef.current.animate();

            // Handle window resize
            const handleResize = () => {
                if (sceneRef.current) {
                    sceneRef.current.resize();
                }
            };

            window.addEventListener('resize', handleResize);

            return () => {
                window.removeEventListener('resize', handleResize);
                if (sceneRef.current) {
                    sceneRef.current.dispose();
                    sceneRef.current = null;
                }
            };
        }

        // Cleanup when not active
        if (!isActive && sceneRef.current) {
            sceneRef.current.dispose();
            sceneRef.current = null;
        }
    }, [isActive]);

    const handleMaterialChange = (material: string) => {
        if (sceneRef.current) {
            sceneRef.current.changeMaterial(material);
            setCurrentMaterial(material);
        }
    };

    const handleColorChange = (color: string) => {
        if (sceneRef.current) {
            sceneRef.current.changeColor(color);
            setCurrentColor(color);
        }
    };

    const handleExportPNG = () => {
        if (sceneRef.current) {
            sceneRef.current.exportPNG();
        }
    };

    const handleLoadModel = async (file: File) => {
        if (sceneRef.current && file) {
            logger.info(`🔄 Starting to load file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`, 'ThreeSceneBComponent');
            
            try {
                // Validate file type
                const extension = file.name.toLowerCase().split('.').pop();
                const supportedFormats = ['gltf', 'glb', 'fbx', 'obj'];
                
                if (!extension || !supportedFormats.includes(extension)) {
                    throw new Error(`Unsupported file format. Supported formats: ${supportedFormats.join(', ').toUpperCase()}`);
                }

                // Check file size (limit to 50MB to prevent browser crashes)
                if (file.size > 50 * 1024 * 1024) {
                    throw new Error('File too large. Please use files smaller than 50MB.');
                }

                // Create object URL for the file
                const url = URL.createObjectURL(file);
                
                try {
                    await sceneRef.current.loadModel(url, file.name);
                    logger.info(`✅ Successfully loaded: ${file.name}`, 'ThreeSceneBComponent');
                } finally {
                    // Clean up the object URL after loading (whether success or failure)
                    URL.revokeObjectURL(url);
                }
            } catch (error) {
                logger.error('❌ Error loading model', 'ThreeSceneBComponent');
                logger.debug(error, 'ThreeSceneBComponent');
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                alert(`Failed to load ${file.name}:\n\n${errorMessage}\n\nPlease check the console for more details.`);
            }
        }
    };


    const handleToggleAutoRotate = () => {
        if (sceneRef.current) {
            const newState = sceneRef.current.toggleAutoRotate();
            setAutoRotateEnabled(newState);
        }
    };

    if (!isActive) return null;

    return (
        <div style={{ 
            position: 'relative', 
            width: '100%', 
            height: '100%',
            overflow: 'hidden'
        }}>
            <canvas 
                ref={canvasRef}
                style={{ 
                    display: 'block',
                    width: '100%',
                    height: '100%'
                }}
            />
            
            {sceneRef.current && (
                <ProductConfiguratorUI
                    availableMaterials={availableMaterials}
                    currentMaterial={currentMaterial}
                    currentColor={currentColor}
                    onMaterialChange={handleMaterialChange}
                    onColorChange={handleColorChange}
                    onExportPNG={handleExportPNG}
                    onLoadModel={handleLoadModel}
                    autoRotateEnabled={autoRotateEnabled}
                    onToggleAutoRotate={handleToggleAutoRotate}
                />
            )}
        </div>
    );
};