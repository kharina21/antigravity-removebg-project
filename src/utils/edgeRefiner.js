/**
 * Edge Refinement utilities for background removal cutouts.
 * Removes background color fringes (defringe) and smooths out jagged edges (feathering).
 * Fits professional-grade specifications.
 */

/**
 * Refines the boundary edges of a transparent cutout canvas:
 * 1. Edge Decontamination (Defringing): Replaces semi-transparent edge colors with neighboring opaque colors.
 * 2. Alpha Feathering: Smooths the alpha transitions to avoid aliasing and pixelated cuts.
 */
export function refineCutout(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  
  if (w === 0 || h === 0) return;
  
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  
  // Copy pixels for referencing unchanged states
  const original = new Uint8ClampedArray(data);
  
  // --- STAGE 1: Edge Decontamination (Defringing) ---
  // Identifies pixels with partial transparency (borders) and overrides their colors
  // with neighboring solid foreground pixels. This removes original background bleed.
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const alpha = original[idx + 3];
      
      // Semi-transparent edge range
      if (alpha > 0 && alpha < 235) {
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        
        // Check 3x3 opaque neighbors
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nIdx = ((y + dy) * w + (x + dx)) * 4;
            const nAlpha = original[nIdx + 3];
            
            // Neighbor is mostly solid foreground
            if (nAlpha >= 235) {
              sumR += original[nIdx];
              sumG += original[nIdx + 1];
              sumB += original[nIdx + 2];
              count++;
            }
          }
        }
        
        if (count > 0) {
          data[idx] = sumR / count;
          data[idx + 1] = sumG / count;
          data[idx + 2] = sumB / count;
        }
      }
    }
  }
  
  // --- STAGE 2: Alpha Channel Feathering (Anti-Aliasing Blur) ---
  // Smooths out the alpha mask transitions to eliminate pixelation and jagged borders.
  const tempAlpha = new Uint8ClampedArray(w * h);
  for (let i = 0; i < data.length; i += 4) {
    tempAlpha[i / 4] = data[i + 3];
  }
  
  const smoothedAlpha = new Uint8ClampedArray(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const aVal = tempAlpha[idx];
      
      // Apply box blur ONLY to transitional pixels (the edges) to preserve sharp center mask boundaries
      if (aVal > 0 && aVal < 255) {
        let sum = 0, count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            sum += tempAlpha[idx + dy * w + dx];
            count++;
          }
        }
        smoothedAlpha[idx] = sum / count;
      } else {
        smoothedAlpha[idx] = aVal;
      }
    }
  }
  
  // Write back the smoothed alpha mask to the image data
  for (let i = 0; i < data.length; i += 4) {
    const idx = i / 4;
    if (tempAlpha[idx] > 0 && tempAlpha[idx] < 255) {
      data[i + 3] = smoothedAlpha[idx];
    }
  }
  
  ctx.putImageData(imgData, 0, 0);
}
