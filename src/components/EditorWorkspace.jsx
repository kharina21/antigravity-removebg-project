import React, { useState, useEffect, useRef } from 'react';
import { 
  Palette, Crop, Brush, ArrowLeft, Undo2, Redo2, 
  RotateCcw, RotateCw, FlipHorizontal, Maximize2, Eraser, Download, Sparkles 
} from 'lucide-react';
import Cropper from 'cropperjs';
import { CanvasEditor } from '../utils/canvasEditor';

// Curated minimalist colors and gradients (not too colorful, modern)
const PRESET_COLORS = [
  '#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0',
  '#0f172a', '#1e293b', '#334155', '#475569',
  '#fee2e2', '#dbeafe', '#d1fae5', '#fef3c7'
];

const PRESET_GRADIENTS = [
  { name: 'Warm Mist', style: 'linear-gradient(135deg, #e6e9f0 0%, #eef1f5 100%)' },
  { name: 'Cool Steel', style: 'linear-gradient(135deg, #cfd9df 0%, #e2ebf0 100%)' },
  { name: 'Sky Muted', style: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)' },
  { name: 'Soft Sage', style: 'linear-gradient(135deg, #fdfbf7 0%, #e1eec3 100%)' },
  { name: 'Midnight', style: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)' },
  { name: 'Charcoal', style: 'linear-gradient(135deg, #141e30 0%, #243b55 100%)' }
];

export default function EditorWorkspace({ 
  t, 
  initialOriginalImage, 
  initialCutoutImage, 
  onBack 
}) {
  // Image states (can be modified by crop)
  const [originalImage, setOriginalImage] = useState(initialOriginalImage);
  const [cutoutImage, setCutoutImage] = useState(initialCutoutImage);

  // Toolbar state
  const [activeTool, setActiveTool] = useState('bg'); // 'bg', 'crop', 'brush'
  
  // Background Customizer states
  const [bgMode, setBgMode] = useState('transparent'); // 'transparent', 'color', 'gradient'
  const [bgSolidColor, setBgSolidColor] = useState('#ffffff');
  const [bgGradient, setBgGradient] = useState(PRESET_GRADIENTS[0].style);

  // Brush settings
  const [brushMode, setBrushMode] = useState('erase'); // 'erase', 'restore'
  const [brushSize, setBrushSize] = useState(20);
  const [brushHardness, setBrushHardness] = useState(50);
  const [brushPos, setBrushPos] = useState({ x: 0, y: 0, visible: false });

  // Export settings
  const [exportFormat, setExportFormat] = useState('image/png');
  const [exportQuality, setExportQuality] = useState(90);
  const [exportName, setExportName] = useState('aura-cut-result');

  // History states
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Slider state
  const [sliderPercent, setSliderPercent] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const [canvasDataUrl, setCanvasDataUrl] = useState('');

  // HD Enhancer states
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showEnhanceToast, setShowEnhanceToast] = useState(false);

  // Refs
  const canvasRef = useRef(null);
  const canvasEditorRef = useRef(null);

  const handleEnhanceImage = () => {
    if (!canvasEditorRef.current) return;
    setIsEnhancing(true);
    setTimeout(() => {
      try {
        canvasEditorRef.current.enhance();
        setCanvasDataUrl(canvasRef.current.toDataURL());
        setShowEnhanceToast(true);
        setTimeout(() => setShowEnhanceToast(false), 3000);
      } catch (err) {
        console.error('Enhancement failed:', err);
      } finally {
        setIsEnhancing(false);
      }
    }, 300);
  };
  const cropperImgRef = useRef(null);
  const [cropperInstance, setCropperInstance] = useState(null);
  const sliderContainerRef = useRef(null);

  // Helper to compute aspect ratio from image or canvas dimensions
  const getAspectRatio = () => {
    if (!originalImage) return 'auto';
    const w = originalImage.naturalWidth || originalImage.width || 0;
    const h = originalImage.naturalHeight || originalImage.height || 0;
    return w && h ? `${w}/${h}` : 'auto';
  };

  // 1. Initialize CanvasEditor
  useEffect(() => {
    if (canvasRef.current && !canvasEditorRef.current) {
      const editor = new CanvasEditor(canvasRef.current);
      editor.onHistoryChange = (state) => {
        setCanUndo(state.canUndo);
        setCanRedo(state.canRedo);
        setCanvasDataUrl(canvasRef.current.toDataURL());
      };
      canvasEditorRef.current = editor;
    }
    
    return () => {
      if (canvasEditorRef.current) {
        canvasEditorRef.current.destroy();
        canvasEditorRef.current = null;
      }
    };
  }, []);

  // 2. Load images into CanvasEditor
  useEffect(() => {
    if (canvasEditorRef.current && originalImage && cutoutImage) {
      canvasEditorRef.current.init(originalImage, cutoutImage);
      setCanvasDataUrl(canvasRef.current.toDataURL());
    }
  }, [originalImage, cutoutImage]);

  // 3. Update brush settings in CanvasEditor
  useEffect(() => {
    if (canvasEditorRef.current) {
      canvasEditorRef.current.brushMode = brushMode;
      canvasEditorRef.current.brushSize = brushSize;
      canvasEditorRef.current.brushHardness = brushHardness;
    }
  }, [brushMode, brushSize, brushHardness]);

  // 4. Initialize Cropper.js when activeTool is 'crop'
  useEffect(() => {
    let cropper = null;
    if (activeTool === 'crop' && cropperImgRef.current && canvasRef.current) {
      cropperImgRef.current.src = canvasRef.current.toDataURL();
      cropper = new Cropper(cropperImgRef.current, {
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 1,
        restore: false,
        modal: true,
        guides: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
      });
      setCropperInstance(cropper);
    }
    return () => {
      if (cropper) {
        cropper.destroy();
        setCropperInstance(null);
      }
    };
  }, [activeTool]);

  // 5. Handle slider mouse/touch tracking
  const handleSliderMove = (clientX) => {
    if (!sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const positionX = clientX - rect.left;
    let percentage = (positionX / rect.width) * 100;
    if (percentage < 0) percentage = 0;
    if (percentage > 100) percentage = 100;
    setSliderPercent(percentage);
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleTouchStart = (e) => {
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      handleSliderMove(e.clientX);
    };

    const handleTouchMove = (e) => {
      if (!isResizing) return;
      if (e.touches && e.touches[0]) {
        handleSliderMove(e.touches[0].clientX);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isResizing]);

  // 6. Handle Brush Indicator Position
  const handleCanvasMouseMove = (e) => {
    if (activeTool !== 'brush' || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    
    const x = e.clientX - canvasRect.left;
    const y = e.clientY - canvasRect.top;

    if (x >= 0 && x <= canvasRect.width && y >= 0 && y <= canvasRect.height) {
      setBrushPos({
        x: e.clientX - canvasRect.left + (canvasRef.current.parentElement.getBoundingClientRect().left - canvasRect.left), 
        y: e.clientY - canvasRect.top + (canvasRef.current.parentElement.getBoundingClientRect().top - canvasRect.top),
        visible: true
      });
    } else {
      setBrushPos(prev => ({ ...prev, visible: false }));
    }
  };

  const handleCanvasMouseLeave = () => {
    setBrushPos(prev => ({ ...prev, visible: false }));
  };

  // 7. Crop Actions
  const handleCropCancel = () => {
    setActiveTool('bg');
  };

  const handleCropApply = () => {
    if (!cropperInstance || !canvasEditorRef.current) return;
    const cropData = cropperInstance.getData(true);
    
    const cropCanvasHelper = (srcCanvas) => {
      const destCanvas = document.createElement('canvas');
      destCanvas.width = cropData.width;
      destCanvas.height = cropData.height;
      const destCtx = destCanvas.getContext('2d');
      
      destCtx.save();
      destCtx.translate(cropData.width / 2, cropData.height / 2);
      
      if (cropData.rotate) {
        destCtx.rotate((cropData.rotate * Math.PI) / 180);
      }
      if (cropData.scaleX || cropData.scaleY) {
        destCtx.scale(cropData.scaleX || 1, cropData.scaleY || 1);
      }
      
      destCtx.drawImage(
        srcCanvas,
        cropData.x, cropData.y, cropData.width, cropData.height,
        -cropData.width / 2, -cropData.height / 2, cropData.width, cropData.height
      );
      destCtx.restore();
      return destCanvas;
    };

    const croppedOriginal = cropCanvasHelper(canvasEditorRef.current.originalCanvas);
    const croppedRemoved = cropCanvasHelper(canvasEditorRef.current.removedCanvas);
    const croppedEdited = cropCanvasHelper(canvasEditorRef.current.canvas);

    setOriginalImage(croppedOriginal);
    setCutoutImage(croppedRemoved);

    canvasEditorRef.current.init(croppedOriginal, croppedRemoved);
    canvasEditorRef.current.ctx.clearRect(0, 0, canvasEditorRef.current.width, canvasEditorRef.current.height);
    canvasEditorRef.current.ctx.drawImage(croppedEdited, 0, 0);
    canvasEditorRef.current.saveHistoryState();

    setActiveTool('bg');
  };

  // 8. Download / Export logic
  const handleDownload = () => {
    if (!canvasEditorRef.current) return;
    
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvasEditorRef.current.width;
    exportCanvas.height = canvasEditorRef.current.height;
    const exportCtx = exportCanvas.getContext('2d');
    
    // Draw background
    if (bgMode === 'color' || exportFormat === 'image/jpeg') {
      exportCtx.fillStyle = bgMode === 'color' ? bgSolidColor : '#ffffff';
      exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    } else if (bgMode === 'gradient') {
      const grad = exportCtx.createLinearGradient(0, 0, exportCanvas.width, exportCanvas.height);
      const match = PRESET_GRADIENTS.find(g => g.style === bgGradient);
      
      if (match) {
        if (match.name === 'Warm Mist') {
          grad.addColorStop(0, '#e6e9f0'); grad.addColorStop(1, '#eef1f5');
        } else if (match.name === 'Cool Steel') {
          grad.addColorStop(0, '#cfd9df'); grad.addColorStop(1, '#e2ebf0');
        } else if (match.name === 'Sky Muted') {
          grad.addColorStop(0, '#e0c3fc'); grad.addColorStop(1, '#8ec5fc');
        } else if (match.name === 'Soft Sage') {
          grad.addColorStop(0, '#fdfbf7'); grad.addColorStop(1, '#e1eec3');
        } else if (match.name === 'Midnight') {
          grad.addColorStop(0, '#2c3e50'); grad.addColorStop(1, '#3498db');
        } else if (match.name === 'Charcoal') {
          grad.addColorStop(0, '#141e30'); grad.addColorStop(1, '#243b55');
        }
      } else {
        grad.addColorStop(0, '#e6e9f0');
        grad.addColorStop(1, '#eef1f5');
      }
      exportCtx.fillStyle = grad;
      exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    }

    // Overlay edited cutout image
    exportCtx.drawImage(canvasEditorRef.current.canvas, 0, 0);

    // Download trigger
    exportCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      let ext = 'png';
      if (exportFormat === 'image/jpeg') ext = 'jpg';
      else if (exportFormat === 'image/webp') ext = 'webp';
      
      link.download = `${exportName}.${ext}`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
    }, exportFormat, exportQuality / 100);
  };

  // Helper styles
  const getCanvasWrapperStyle = () => {
    if (bgMode === 'color') return { backgroundColor: bgSolidColor };
    if (bgMode === 'gradient') return { background: bgGradient };
    return {};
  };

  // Brush size scaling for visual indicator
  const getBrushIndicatorStyle = () => {
    if (!canvasRef.current) return { display: 'none' };
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const scaleFactor = canvasRect.width / canvasEditorRef.current.width;
    const indicatorSize = brushSize * scaleFactor;
    return {
      width: `${indicatorSize}px`,
      height: `${indicatorSize}px`,
      left: `${brushPos.x}px`,
      top: `${brushPos.y}px`,
      display: brushPos.visible ? 'block' : 'none'
    };
  };

  return (
    <section className="flex-1 flex flex-col md:flex-row h-[calc(100vh-61px)] w-full">
      {/* Left Sidebar Toolbar - styled with daisyUI */}
      <div className="flex flex-row md:flex-col items-center justify-center md:justify-start gap-4 p-4 border-b md:border-b-0 md:border-r border-base-300 bg-base-100 w-full md:w-20 min-h-0">
        <button 
          className={`btn btn-ghost flex flex-col h-16 w-16 gap-1 normal-case ${activeTool === 'bg' ? 'btn-active text-primary bg-base-300' : 'text-base-content/75'}`}
          onClick={() => setActiveTool('bg')}
          title={t('tool_bg')}
        >
          <Palette className="w-5 h-5" />
          <span className="text-[10px] font-medium">{t('tool_bg')}</span>
        </button>
        <button 
          className={`btn btn-ghost flex flex-col h-16 w-16 gap-1 normal-case ${activeTool === 'crop' ? 'btn-active text-primary bg-base-300' : 'text-base-content/75'}`}
          onClick={() => setActiveTool('crop')}
          title={t('tool_crop')}
        >
          <Crop className="w-5 h-5" />
          <span className="text-[10px] font-medium">{t('tool_crop')}</span>
        </button>
        <button 
          className={`btn btn-ghost flex flex-col h-16 w-16 gap-1 normal-case ${activeTool === 'brush' ? 'btn-active text-primary bg-base-300' : 'text-base-content/75'}`}
          onClick={() => setActiveTool('brush')}
          title={t('tool_brush')}
        >
          <Brush className="w-5 h-5" />
          <span className="text-[10px] font-medium">{t('tool_brush')}</span>
        </button>
      </div>

      {/* Center Viewport */}
      <div className="flex-1 flex flex-col bg-base-300/40 p-4 relative min-h-0">
        <div className="flex justify-between items-center mb-4">
          <button className="btn btn-ghost btn-sm gap-2 normal-case" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
            <span>{t('btn_back')}</span>
          </button>
          
          <div className="flex gap-2 items-center">
            {/* HD Enhance button */}
            <button 
              className="btn btn-sm btn-primary gap-2 normal-case shadow-md text-primary-content hover:scale-105 active:scale-95 transition-all duration-150"
              onClick={handleEnhanceImage}
              disabled={isEnhancing}
            >
              <Sparkles className="w-4 h-4 text-primary-content" />
              <span>{t('btn_enhance')}</span>
            </button>

            {activeTool === 'brush' && (
              <div className="flex gap-2">
                <button 
                  className="btn btn-circle btn-sm btn-ghost border border-base-300" 
                  disabled={!canUndo} 
                  onClick={() => canvasEditorRef.current?.undo()}
                  title="Undo"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button 
                  className="btn btn-circle btn-sm btn-ghost border border-base-300" 
                  disabled={!canRedo} 
                  onClick={() => canvasEditorRef.current?.redo()}
                  title="Redo"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Canvas Working Space */}
        <div 
          className={`flex-1 flex items-center justify-center rounded-2xl border border-base-300 relative overflow-hidden bg-base-200/50 shadow-inner ${
            bgMode === 'transparent' ? 'bg-transparent-grid' : ''
          }`}
          style={getCanvasWrapperStyle()}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
        >
          {/* HD Enhancement Spinner Overlay */}
          {isEnhancing && (
            <div className="absolute inset-0 bg-base-300/70 backdrop-blur-sm z-40 flex flex-col items-center justify-center gap-4 animate-fade-in">
              <span className="loading loading-spinner loading-lg text-primary"></span>
              <span className="text-sm font-semibold tracking-wide text-base-content/85">{t('enhancing_loading')}</span>
            </div>
          )}

          {/* Success Toast */}
          {showEnhanceToast && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
              <div className="alert alert-success shadow-lg border border-success-content/10 py-2.5 px-4 rounded-xl text-xs font-semibold">
                <span>✨ {t('enhance_success')}</span>
              </div>
            </div>
          )}
          {/* 1. Comparison Slider (active in BG mode) */}
          {activeTool === 'bg' && (
            <div className="comparison-slider-container w-full h-full flex items-center justify-center" ref={sliderContainerRef}>
              <div 
                className="slider-container-fixed" 
                style={{ 
                  aspectRatio: getAspectRatio(),
                  maxWidth: '100%',
                  maxHeight: '100%',
                  width: 'auto',
                  height: 'auto'
                }}
              >
                <div className="comparison-slider-inner w-full h-full relative">
                  {/* Before Image (Original) - clipped to the right half */}
                  <img 
                    src={originalImage?.src} 
                    className="w-full h-full object-contain pointer-events-none select-none" 
                    style={{
                      clipPath: `inset(0 0 0 ${sliderPercent}%)`
                    }}
                    alt="Before" 
                  />
                  
                  {/* After Image (Clipped overlay) - clipped to the left half */}
                  <img 
                    src={canvasDataUrl} 
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-10" 
                    style={{ 
                      clipPath: `inset(0 ${100 - sliderPercent}% 0 0)` 
                    }}
                    alt="After" 
                  />

                  {/* Slider Drag Bar Handle */}
                  <div 
                    className="slider-handle" 
                    style={{ left: `${sliderPercent}%` }}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                  >
                    <div className="handle-button">◀▶</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Manual Brush canvas */}
          <canvas 
            id="editorCanvas" 
            ref={canvasRef}
            className={activeTool !== 'brush' ? 'hidden-canvas' : ''}
          ></canvas>

          {/* 3. Cropper viewport */}
          <div className={`cropper-container-wrapper ${activeTool !== 'crop' ? 'hidden' : ''}`}>
            <img ref={cropperImgRef} src={null} alt="Cropper target" />
          </div>

          {/* 4. Brush visual Aid indicator */}
          {activeTool === 'brush' && (
            <div className="brush-indicator" style={getBrushIndicatorStyle()}></div>
          )}
        </div>
      </div>

      {/* Right Sidebar Controls - using daisyUI cards & inputs */}
      <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-base-300 bg-base-200 flex flex-col justify-between min-h-0">
        
        {/* Scrollable Control Panel Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* BG Customize Panel */}
          {activeTool === 'bg' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-lg font-bold mb-1">{t('panel_bg_title')}</h3>
                <p className="text-xs text-base-content/60">{t('panel_bg_desc')}</p>
              </div>
              
              {/* Join-segmented button layout */}
              <div className="join w-full">
                <button 
                  className={`join-item btn btn-xs flex-1 ${bgMode === 'transparent' ? 'btn-active btn-primary' : 'btn-outline border-base-300'}`}
                  onClick={() => setBgMode('transparent')}
                >
                  {t('bg_transparent')}
                </button>
                <button 
                  className={`join-item btn btn-xs flex-1 ${bgMode === 'color' ? 'btn-active btn-primary' : 'btn-outline border-base-300'}`}
                  onClick={() => setBgMode('color')}
                >
                  {t('bg_color')}
                </button>
                <button 
                  className={`join-item btn btn-xs flex-1 ${bgMode === 'gradient' ? 'btn-active btn-primary' : 'btn-outline border-base-300'}`}
                  onClick={() => setBgMode('gradient')}
                >
                  {t('bg_gradient')}
                </button>
              </div>

              {/* Color subpanel */}
              {bgMode === 'color' && (
                <div className="space-y-4">
                  <h4 className="text-[10px] uppercase font-bold tracking-wider text-base-content/50">{t('preset_colors')}</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESET_COLORS.map(color => (
                      <button 
                        key={color}
                        className={`w-8 h-8 rounded-full border-2 cursor-pointer transition-transform duration-150 hover:scale-105 active:scale-95 ${bgSolidColor === color ? 'border-primary scale-110 shadow-md' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setBgSolidColor(color)}
                      ></button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between bg-base-300/40 p-3 rounded-lg border border-base-300">
                    <span className="text-xs text-base-content/70">{t('custom_color')}</span>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color" 
                        value={bgSolidColor}
                        className="w-7 h-7 rounded-full border-none cursor-pointer bg-transparent"
                        onChange={(e) => setBgSolidColor(e.target.value)}
                      />
                      <span className="text-xs font-mono font-bold">{bgSolidColor.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Gradient subpanel */}
              {bgMode === 'gradient' && (
                <div className="space-y-4">
                  <h4 className="text-[10px] uppercase font-bold tracking-wider text-base-content/50">{t('preset_gradients')}</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESET_GRADIENTS.map(gradient => (
                      <button 
                        key={gradient.name}
                        className={`w-8 h-8 rounded-full border-2 cursor-pointer transition-transform duration-150 hover:scale-105 active:scale-95 ${bgGradient === gradient.style ? 'border-primary scale-110 shadow-md' : 'border-transparent'}`}
                        style={{ background: gradient.style }}
                        onClick={() => setBgGradient(gradient.style)}
                        title={gradient.name}
                      ></button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Crop Panel */}
          {activeTool === 'crop' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold mb-1">{t('panel_crop_title')}</h3>
                <p className="text-xs text-base-content/60">{t('panel_crop_desc')}</p>
              </div>
              
              <div className="flex flex-col gap-2">
                <button 
                  className="btn btn-sm btn-outline border-base-300 justify-start gap-3 w-full normal-case"
                  onClick={() => cropperInstance?.setAspectRatio(NaN)}
                >
                  <Maximize2 className="w-4 h-4" />
                  <span>{t('ratio_free')}</span>
                </button>
                
                <button 
                  className="btn btn-sm btn-outline border-base-300 justify-start gap-3 w-full normal-case"
                  onClick={() => cropperInstance?.setAspectRatio(1)}
                >
                  <span className="ratio-box ratio-1-1"></span>
                  <span>1:1 (Square)</span>
                </button>
                
                <button 
                  className="btn btn-sm btn-outline border-base-300 justify-start gap-3 w-full normal-case"
                  onClick={() => cropperInstance?.setAspectRatio(9/16)}
                >
                  <span className="ratio-box ratio-9-16"></span>
                  <span>9:16 (Story)</span>
                </button>
                
                <button 
                  className="btn btn-sm btn-outline border-base-300 justify-start gap-3 w-full normal-case"
                  onClick={() => cropperInstance?.setAspectRatio(16/9)}
                >
                  <span className="ratio-box ratio-16-9"></span>
                  <span>16:9 (Landscape)</span>
                </button>
                
                <button 
                  className="btn btn-sm btn-outline border-base-300 justify-start gap-3 w-full normal-case"
                  onClick={() => cropperInstance?.setAspectRatio(4/5)}
                >
                  <span className="ratio-box ratio-4-5"></span>
                  <span>4:5 (Portrait)</span>
                </button>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-base-content/75">{t('rotate_title')}</h4>
                <div className="flex gap-2">
                  <button className="btn btn-sm btn-outline border-base-300 flex-1" onClick={() => cropperInstance?.rotate(-90)}>
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button className="btn btn-sm btn-outline border-base-300 flex-1" onClick={() => cropperInstance?.rotate(90)}>
                    <RotateCw className="w-4 h-4" />
                  </button>
                  <button className="btn btn-sm btn-outline border-base-300 flex-1" onClick={() => {
                    if (cropperInstance) {
                      const data = cropperInstance.getData();
                      cropperInstance.scaleX(data.scaleX === -1 ? 1 : -1);
                    }
                  }}>
                    <FlipHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-base-300">
                <button className="btn btn-sm btn-outline flex-1 normal-case" onClick={handleCropCancel}>{t('btn_cancel')}</button>
                <button className="btn btn-sm btn-primary flex-1 normal-case" onClick={handleCropApply}>{t('btn_apply')}</button>
              </div>
            </div>
          )}

          {/* Brush Panel */}
          {activeTool === 'brush' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold mb-1">{t('panel_brush_title')}</h3>
                <p className="text-xs text-base-content/60">{t('panel_brush_desc')}</p>
              </div>
              
              <div className="join w-full bg-base-300/40 p-1 rounded-lg border border-base-300">
                <button 
                  className={`join-item btn btn-xs flex-1 border-none ${brushMode === 'erase' ? 'btn-active bg-base-100 shadow-sm text-base-content' : 'btn-ghost'}`}
                  onClick={() => setBrushMode('erase')}
                >
                  <Eraser className="w-3.5 h-3.5 mr-1.5" />
                  {t('brush_erase')}
                </button>
                <button 
                  className={`join-item btn btn-xs flex-1 border-none ${brushMode === 'restore' ? 'btn-active bg-base-100 shadow-sm text-base-content' : 'btn-ghost'}`}
                  onClick={() => setBrushMode('restore')}
                >
                  <Brush className="w-3.5 h-3.5 mr-1.5" />
                  {t('brush_restore')}
                </button>
              </div>

              {/* Range sliders - daisyUI styled */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-base-content/75">
                  <span>{t('brush_size')}</span>
                  <span className="font-mono font-semibold">{brushSize}px</span>
                </div>
                <input 
                  type="range" 
                  min="2" 
                  max="100" 
                  value={brushSize} 
                  className="range range-primary range-xs"
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-base-content/75">
                  <span>{t('brush_hardness')}</span>
                  <span className="font-mono font-semibold">{brushHardness}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={brushHardness} 
                  className="range range-primary range-xs"
                  onChange={(e) => setBrushHardness(parseInt(e.target.value))}
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-base-300">
                <button className="btn btn-sm btn-outline flex-1 normal-case" onClick={() => canvasEditorRef.current?.reset()}>{t('btn_reset')}</button>
                <button className="btn btn-sm btn-primary flex-1 normal-case" onClick={() => setActiveTool('bg')}>{t('btn_save')}</button>
              </div>
            </div>
          )}

        </div>

        {/* Export Settings Footer (Right Sidebar Footer) */}
        <div className="p-6 border-t border-base-300 bg-base-300/30 space-y-4">
          <h4 className="text-[10px] uppercase font-bold tracking-wider text-base-content/50">{t('export_settings')}</h4>
          
          <div className="space-y-3">
            <div className="form-control w-full">
              <label className="label py-1"><span className="label-text text-xs">{t('export_format')}</span></label>
              <select 
                value={exportFormat} 
                className="select select-bordered select-sm w-full"
                onChange={(e) => setExportFormat(e.target.value)}
              >
                <option value="image/png">PNG ({t('bg_transparent')})</option>
                <option value="image/jpeg">JPEG (White background)</option>
                <option value="image/webp">WEBP (Optimized)</option>
              </select>
            </div>
            
            {(exportFormat === 'image/jpeg' || exportFormat === 'image/webp') && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-base-content/75 py-1">
                  <span>{t('export_quality')}</span>
                  <span className="font-mono font-semibold">{exportQuality}%</span>
                </div>
                <input 
                  type="range" 
                  min="10" 
                  max="100" 
                  value={exportQuality} 
                  className="range range-primary range-xs"
                  onChange={(e) => setExportQuality(parseInt(e.target.value))}
                />
              </div>
            )}

            <div className="form-control w-full">
              <label className="label py-1"><span className="label-text text-xs">{t('export_name')}</span></label>
              <input 
                type="text" 
                value={exportName}
                className="input input-bordered input-sm w-full"
                onChange={(e) => setExportName(e.target.value)}
              />
            </div>
          </div>

          <button className="btn btn-primary w-full gap-2 mt-2 normal-case" onClick={handleDownload}>
            <Download className="w-4 h-4" />
            <span>{t('btn_download')}</span>
          </button>
        </div>

      </div>
    </section>
  );
}
