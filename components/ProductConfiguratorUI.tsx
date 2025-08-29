import React, { useState } from 'react';
import './ProductConfiguratorUI.css';

interface ProductConfiguratorUIProps {
    availableMaterials: string[];
    currentMaterial: string;
    currentColor: string;
    onMaterialChange: (material: string) => void;
    onColorChange: (color: string) => void;
    onExportPNG: () => void;
    onLoadModel?: (file: File) => void;
    autoRotateEnabled?: boolean;
    onToggleAutoRotate?: () => void;
}

export const ProductConfiguratorUI: React.FC<ProductConfiguratorUIProps> = ({
    availableMaterials,
    currentMaterial,
    currentColor,
    onMaterialChange,
    onColorChange,
    onExportPNG,
    onLoadModel,
    autoRotateEnabled = true,
    onToggleAutoRotate
}) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && onLoadModel) {
            onLoadModel(file);
        }
    };

    return (
        <div className="product-configurator-ui">
            <div className="configurator-header">
                <h3>Product Configurator</h3>
                <button 
                    className="expand-toggle"
                    onClick={() => setIsExpanded(!isExpanded)}
                    aria-label={isExpanded ? "Collapse controls" : "Expand controls"}
                >
                    {isExpanded ? '▼' : '▶'}
                </button>
            </div>
            
            {isExpanded && (
                <div className="configurator-content">
                    {/* Material Selection */}
                    <div className="control-section">
                        <label className="control-label">Material</label>
                        <div className="material-grid">
                            {availableMaterials.map((material) => (
                                <button
                                    key={material}
                                    className={`material-button ${currentMaterial === material ? 'active' : ''}`}
                                    onClick={() => onMaterialChange(material)}
                                >
                                    <div className={`material-preview ${material.toLowerCase()}`}></div>
                                    <span>{material}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Color Selection */}
                    <div className="control-section">
                        <label className="control-label">Color</label>
                        <div className="color-controls">
                            <input 
                                type="color" 
                                value={currentColor}
                                onChange={(e) => onColorChange(e.target.value)}
                                className="color-picker"
                            />
                            <div className="color-presets">
                                {['#ffffff', '#cccccc', '#888888', '#333333', '#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff'].map((color) => (
                                    <button
                                        key={color}
                                        className={`color-preset ${currentColor === color ? 'active' : ''}`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => onColorChange(color)}
                                        title={color}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Model Loading */}
                    <div className="control-section">
                        <label className="control-label">Load Model</label>
                        <div className="file-upload-container">
                            <input
                                type="file"
                                id="model-upload"
                                accept=".gltf,.glb,.fbx,.obj"
                                onChange={handleFileUpload}
                                className="file-input"
                            />
                            <label htmlFor="model-upload" className="file-upload-button">
                                <span>📁</span>
                                Load Model
                            </label>
                            <div className="supported-formats">
                                <small>Supports: glTF, GLB, FBX, OBJ</small>
                            </div>
                        </div>
                    </div>

                    {/* Camera Controls */}
                    <div className="control-section">
                        <label className="control-label">Camera</label>
                        {onToggleAutoRotate && (
                            <button 
                                className={`control-button ${autoRotateEnabled ? 'active' : ''}`}
                                onClick={onToggleAutoRotate}
                            >
                                <span>{autoRotateEnabled ? '🔄' : '⏸️'}</span>
                                Auto-Rotate {autoRotateEnabled ? 'ON' : 'OFF'}
                            </button>
                        )}
                    </div>

                    {/* Export */}
                    <div className="control-section">
                        <label className="control-label">Export</label>
                        <button 
                            className="export-button"
                            onClick={onExportPNG}
                        >
                            <span>📷</span>
                            Export PNG
                        </button>
                    </div>

                    {/* Instructions */}
                    <div className="control-section">
                        <div className="instructions">
                            <p>🖱️ Drag to orbit</p>
                            <p>🔍 Scroll to zoom</p>
                            <p>{autoRotateEnabled ? '🔄 Auto-rotation ON' : '⏸️ Auto-rotation OFF'}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};