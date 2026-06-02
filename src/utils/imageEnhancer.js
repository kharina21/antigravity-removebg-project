/**
 * HD Image Enhancer utilities.
 * Performs unsharp mask convolution sharpening and color contrast enhancements.
 */

/**
 * Enhances the visual quality of a canvas image:
 * 1. Sharpening (unsharp mask convolution)
 * 2. Color saturation and contrast boosting
 */
export function enhanceImageQuality(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  
  if (w === 0 || h === 0) return;

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  
  // 1. Sharpen Convolution Filter
  // Clone current pixels to avoid using modified values during filter neighbors calculation
  const original = new Uint8ClampedArray(data);
  const amount = 0.35; // sharpening intensity
  const kCenter = 1 + 4 * amount;
  const kEdge = -amount;
  
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      
      // Skip fully transparent pixels
      if (original[idx + 3] === 0) continue;
      
      // Convolute RGB channels
      for (let c = 0; c < 3; c++) {
        const cIdx = idx + c;
        
        const center = original[cIdx];
        const top = original[cIdx - w * 4];
        const bottom = original[cIdx + w * 4];
        const left = original[cIdx - 4];
        const right = original[cIdx + 4];
        
        const val = center * kCenter + (top + bottom + left + right) * kEdge;
        data[cIdx] = Math.min(255, Math.max(0, val));
      }
    }
  }
  
  // 2. Color Contrast, Exposure and Saturation Adjustments
  const contrast = 1.08;      // 8% contrast boost
  const brightness = 1.02;    // 2% exposure boost
  const saturation = 1.08;    // 8% color pop boost
  
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue; // ignore transparency
    
    let r = data[i];
    let g = data[i+1];
    let b = data[i+2];
    
    // Contrast (around midtone 128)
    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;
    
    // Brightness
    r *= brightness;
    g *= brightness;
    b *= brightness;
    
    // Saturation
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = gray + saturation * (r - gray);
    g = gray + saturation * (g - gray);
    b = gray + saturation * (b - gray);
    
    // Write back and clamp
    data[i] = Math.min(255, Math.max(0, r));
    data[i+1] = Math.min(255, Math.max(0, g));
    data[i+2] = Math.min(255, Math.max(0, b));
  }
  
  // Render back to canvas
  ctx.putImageData(imgData, 0, 0);
}
