/**
 * AURA CUT - Advanced Canvas Editor
 * Handles manual brush operations (Erase/Restore) using offscreen masking.
 */
export class CanvasEditor {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        
        // Canvas dimensions & image buffers
        this.width = 0;
        this.height = 0;
        
        // Offscreen buffers for processing
        this.originalCanvas = document.createElement('canvas');
        this.originalCtx = this.originalCanvas.getContext('2d');
        
        this.removedCanvas = document.createElement('canvas');
        this.removedCtx = this.removedCanvas.getContext('2d');
        
        // Stroke buffers
        this.strokeStartCanvas = document.createElement('canvas');
        this.strokeStartCtx = this.strokeStartCanvas.getContext('2d');
        
        this.drawingMaskCanvas = document.createElement('canvas');
        this.drawingMaskCtx = this.drawingMaskCanvas.getContext('2d');
        
        this.tempRestoreCanvas = document.createElement('canvas');
        this.tempRestoreCtx = this.tempRestoreCanvas.getContext('2d');
        
        // Editing state
        this.brushSize = 20;
        this.brushHardness = 50; // 0 to 100
        this.brushMode = 'erase'; // 'erase' or 'restore'
        this.isDrawing = false;
        this.points = [];
        
        // History stacks
        this.historyStack = [];
        this.historyIndex = -1;
        this.maxHistory = 20;
        
        // Callback when history states change (to enable/disable undo/redo buttons)
        this.onHistoryChange = null;
        
        // Event handlers
        this.setupEvents();
    }

    /**
     * Initialize canvas with the original image and background-removed image
     */
    init(originalImg, cutoutImg) {
        this.width = cutoutImg.naturalWidth || cutoutImg.width;
        this.height = cutoutImg.naturalHeight || cutoutImg.height;
        
        if (this.width === 0 || this.height === 0) return;

        // Set main canvas dimensions
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        // Set all buffer dimensions
        const canvases = [
            this.originalCanvas, 
            this.removedCanvas, 
            this.strokeStartCanvas, 
            this.drawingMaskCanvas, 
            this.tempRestoreCanvas
        ];
        
        canvases.forEach(c => {
            c.width = this.width;
            c.height = this.height;
        });
        
        // Draw original and removed images into buffers
        this.originalCtx.clearRect(0, 0, this.width, this.height);
        this.originalCtx.drawImage(originalImg, 0, 0, this.width, this.height);
        
        this.removedCtx.clearRect(0, 0, this.width, this.height);
        this.removedCtx.drawImage(cutoutImg, 0, 0, this.width, this.height);
        
        // Draw initial state onto main canvas
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.drawImage(cutoutImg, 0, 0, this.width, this.height);
        
        // Reset history stack
        this.historyStack = [];
        this.historyIndex = -1;
        this.saveHistoryState();
        
        this.isDrawing = false;
        this.points = [];
    }

    /**
     * Get the relative coordinates on the canvas
     */
    getMousePos(evt) {
        const rect = this.canvas.getBoundingClientRect();
        
        // Standardize mouse coordinates whether touch or click
        let clientX = evt.clientX;
        let clientY = evt.clientY;
        
        if (evt.touches && evt.touches.length > 0) {
            clientX = evt.touches[0].clientX;
            clientY = evt.touches[0].clientY;
        }
        
        const scaleX = this.width / rect.width;
        const scaleY = this.height / rect.height;
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    /**
     * Setup interaction events (mouse and touch)
     */
    setupEvents() {
        this.startDrawingHandler = (e) => {
            if (this.width === 0) return; // Not initialized
            e.preventDefault();
            this.isDrawing = true;
            this.points = [];
            
            // Capture start state of stroke
            this.strokeStartCtx.clearRect(0, 0, this.width, this.height);
            this.strokeStartCtx.drawImage(this.canvas, 0, 0);
            
            const pos = this.getMousePos(e);
            this.points.push(pos);
            this.drawStroke();
        };

        this.drawHandler = (e) => {
            if (!this.isDrawing) return;
            e.preventDefault();
            
            const pos = this.getMousePos(e);
            this.points.push(pos);
            this.drawStroke();
        };

        this.stopDrawingHandler = (e) => {
            if (!this.isDrawing) return;
            e.preventDefault();
            this.isDrawing = false;
            
            // Finalize drawing into main canvas
            this.points = [];
            this.saveHistoryState();
        };

        // Desktop Events
        this.canvas.addEventListener('mousedown', this.startDrawingHandler);
        this.canvas.addEventListener('mousemove', this.drawHandler);
        window.addEventListener('mouseup', this.stopDrawingHandler);

        // Touch Events for Mobile compatibility
        this.canvas.addEventListener('touchstart', this.startDrawingHandler, { passive: false });
        this.canvas.addEventListener('touchmove', this.drawHandler, { passive: false });
        window.addEventListener('touchend', this.stopDrawingHandler);
    }

    /**
     * Clean up event listeners to prevent memory leaks in React
     */
    destroy() {
        this.canvas.removeEventListener('mousedown', this.startDrawingHandler);
        this.canvas.removeEventListener('mousemove', this.drawHandler);
        window.removeEventListener('mouseup', this.stopDrawingHandler);

        this.canvas.removeEventListener('touchstart', this.startDrawingHandler);
        this.canvas.removeEventListener('touchmove', this.drawHandler);
        window.removeEventListener('touchend', this.stopDrawingHandler);
    }

    /**
     * Redraw the stroke path on the offscreen mask, and apply mask to canvas
     */
    drawStroke() {
        if (this.points.length === 0) return;

        // 1. Clear drawing mask
        this.drawingMaskCtx.clearRect(0, 0, this.width, this.height);
        
        // 2. Draw brush strokes onto mask canvas
        this.drawingMaskCtx.beginPath();
        
        if (this.points.length === 1) {
            // Draw a dot if clicked and didn't move
            const p = this.points[0];
            this.drawingMaskCtx.arc(p.x, p.y, this.brushSize / 2, 0, Math.PI * 2);
            this.drawingMaskCtx.fillStyle = 'black';
            
            // Apply hardness to dot via radial gradient if hardness < 100
            if (this.brushHardness < 100) {
                const grad = this.drawingMaskCtx.createRadialGradient(
                    p.x, p.y, (this.brushSize / 2) * (this.brushHardness / 100),
                    p.x, p.y, this.brushSize / 2
                );
                grad.addColorStop(0, 'black');
                grad.addColorStop(1, 'transparent');
                this.drawingMaskCtx.fillStyle = grad;
            }
            this.drawingMaskCtx.fill();
        } else {
            // Draw smooth continuous lines
            this.drawingMaskCtx.moveTo(this.points[0].x, this.points[0].y);
            
            // Quadratic curve drawing for smoother paths
            for (let i = 1; i < this.points.length - 1; i++) {
                const xc = (this.points[i].x + this.points[i + 1].x) / 2;
                const yc = (this.points[i].y + this.points[i + 1].y) / 2;
                this.drawingMaskCtx.quadraticCurveTo(this.points[i].x, this.points[i].y, xc, yc);
            }
            
            // Connect to final point
            const last = this.points[this.points.length - 1];
            this.drawingMaskCtx.lineTo(last.x, last.y);
            
            // Style brush paths
            this.drawingMaskCtx.lineWidth = this.brushSize;
            this.drawingMaskCtx.lineCap = 'round';
            this.drawingMaskCtx.lineJoin = 'round';
            
            if (this.brushHardness < 100) {
                // Apply soft shadow blur to line strokes to mimic brush feathering
                this.drawingMaskCtx.shadowBlur = (this.brushSize / 2) * (1 - this.brushHardness / 100);
                this.drawingMaskCtx.shadowColor = 'black';
                this.drawingMaskCtx.strokeStyle = 'black';
            } else {
                this.drawingMaskCtx.shadowBlur = 0;
                this.drawingMaskCtx.strokeStyle = 'black';
            }
            
            this.drawingMaskCtx.stroke();
        }

        // 3. Composite mask with background original/transparent image
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.drawImage(this.strokeStartCanvas, 0, 0); // Restore start state

        if (this.brushMode === 'erase') {
            // Erase: destination-out transparency composite
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.drawImage(this.drawingMaskCanvas, 0, 0);
            this.ctx.globalCompositeOperation = 'source-over'; // Reset
        } else {
            // Restore: Draw original image masked by strokeMask
            this.tempRestoreCtx.clearRect(0, 0, this.width, this.height);
            this.tempRestoreCtx.drawImage(this.drawingMaskCanvas, 0, 0);
            
            this.tempRestoreCtx.globalCompositeOperation = 'source-in';
            this.tempRestoreCtx.drawImage(this.originalCanvas, 0, 0);
            this.tempRestoreCtx.globalCompositeOperation = 'source-over'; // Reset
            
            // Draw restored content onto main canvas
            this.ctx.drawImage(this.tempRestoreCanvas, 0, 0);
        }
    }

    /**
     * History stack management (Undo / Redo)
     */
    saveHistoryState() {
        // Truncate future states if undoing and then applying new actions
        if (this.historyIndex < this.historyStack.length - 1) {
            this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
        }
        
        // Fetch current canvas state as ImageData
        const state = this.ctx.getImageData(0, 0, this.width, this.height);
        this.historyStack.push(state);
        
        // Cap max history stack size
        if (this.historyStack.length > this.maxHistory) {
            this.historyStack.shift();
        }
        
        this.historyIndex = this.historyStack.length - 1;
        this.triggerHistoryCallback();
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const state = this.historyStack[this.historyIndex];
            this.ctx.putImageData(state, 0, 0);
            this.triggerHistoryCallback();
        }
    }

    redo() {
        if (this.historyIndex < this.historyStack.length - 1) {
            this.historyIndex++;
            const state = this.historyStack[this.historyIndex];
            this.ctx.putImageData(state, 0, 0);
            this.triggerHistoryCallback();
        }
    }

    canUndo() {
        return this.historyIndex > 0;
    }

    canRedo() {
        return this.historyIndex < this.historyStack.length - 1;
    }

    triggerHistoryCallback() {
        if (typeof this.onHistoryChange === 'function') {
            this.onHistoryChange({
                canUndo: this.canUndo(),
                canRedo: this.canRedo()
            });
        }
    }

    /**
     * Helper to return canvas as a high-quality data URL or Blob
     */
    getBlob(format = 'image/png', quality = 0.9) {
        return new Promise((resolve) => {
            this.canvas.toBlob((blob) => {
                resolve(blob);
            }, format, quality);
        });
    }

    /**
     * Reset canvas to initial cutout image
     */
    reset() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.drawImage(this.removedCanvas, 0, 0);
        this.saveHistoryState();
    }
}
