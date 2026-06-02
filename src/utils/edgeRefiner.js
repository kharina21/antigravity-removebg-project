/**
 * Advanced Edge Refinement utilities for background removal cutouts.
 * Matches professional-grade cutouts (like remove.bg) by removing dark backgrounds,
 * shadow halos, and pixelated outlines.
 */

/**
 * Refines the boundary edges of a transparent cutout canvas using a 4-stage pipeline:
 * 1. Mask Erosion (1-pixel): Shaves off the outermost pixels which contain background bleed/shadows.
 * 2. Alpha Threshold Clamping: Eliminates soft semi-transparent halos.
 * 3. 5x5 Weighted Defringing (Decontamination): Replaces edge colors with nearby solid foreground colors.
 * 4. Gentle Feathering: Restores smooth anti-aliased outlines.
 */
export function refineCutout(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  
  if (w === 0 || h === 0) return;
  
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  
  // --- STAGE 1: Mask Erosion (1-pixel) ---
  // Shrinks the alpha mask slightly to shave off the contaminated outer pixels.
  const originalAlpha = new Uint8ClampedArray(w * h);
  for (let i = 0; i < data.length; i += 4) {
    originalAlpha[i / 4] = data[i + 3];
  }
  
  const erodedAlpha = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const aVal = originalAlpha[idx];
      
      if (aVal > 0) {
        let minAlpha = aVal;
        const minY = Math.max(0, y - 1);
        const maxY = Math.min(h - 1, y + 1);
        const minX = Math.max(0, x - 1);
        const maxX = Math.min(w - 1, x + 1);
        
        for (let ny = minY; ny <= maxY; ny++) {
          for (let nx = minX; nx <= maxX; nx++) {
            const val = originalAlpha[ny * w + nx];
            if (val < minAlpha) {
              minAlpha = val;
            }
          }
        }
        erodedAlpha[idx] = minAlpha;
      } else {
        erodedAlpha[idx] = 0;
      }
    }
  }
  
  // Write eroded alpha back
  for (let i = 0; i < data.length; i += 4) {
    data[i + 3] = erodedAlpha[i / 4];
  }
  
  // --- STAGE 2: Alpha Threshold Clamping & Cleaning ---
  // Discards faint pixels/shadows and solidifies the core subject.
  const lowThreshold = 35;   // Below this is cut off (background shadows)
  const highThreshold = 230;  // Above this is solid foreground
  
  for (let i = 0; i < data.length; i += 4) {
    let alpha = data[i + 3];
    if (alpha < lowThreshold) {
      data[i + 3] = 0;
    } else if (alpha > highThreshold) {
      data[i + 3] = 255;
    } else {
      // Scale intermediate alpha values
      data[i + 3] = Math.round(((alpha - lowThreshold) / (highThreshold - lowThreshold)) * 255);
    }
  }
  
  // --- STAGE 3: Advanced Edge Decontamination (Defringing) ---
  // Replaces edge colors with colors of nearby solid foreground pixels.
  // Uses a 5x5 window (radius = 2) weighted by distance to cover wider halos.
  const workingCopy = new Uint8ClampedArray(data);
  const radius = 2;
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const alpha = workingCopy[idx + 3];
      
      // Process semi-transparent boundary pixels
      if (alpha > 0 && alpha < 255) {
        let sumR = 0, sumG = 0, sumB = 0;
        let totalWeight = 0;
        
        const minY = Math.max(0, y - radius);
        const maxY = Math.min(h - 1, y + radius);
        const minX = Math.max(0, x - radius);
        const maxX = Math.min(w - 1, x + radius);
        
        for (let ny = minY; ny <= maxY; ny++) {
          for (let nx = minX; nx <= maxX; nx++) {
            const nIdx = (ny * w + nx) * 4;
            const nAlpha = workingCopy[nIdx + 3];
            
            // Pull color from solid foreground pixels
            if (nAlpha >= 240) {
              const dx = nx - x;
              const dy = ny - y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 0.5;
              const weight = 1.0 / dist;
              
              sumR += workingCopy[nIdx] * weight;
              sumG += workingCopy[nIdx + 1] * weight;
              sumB += workingCopy[nIdx + 2] * weight;
              totalWeight += weight;
            }
          }
        }
        
        if (totalWeight > 0) {
          data[idx] = Math.round(sumR / totalWeight);
          data[idx + 1] = Math.round(sumG / totalWeight);
          data[idx + 2] = Math.round(sumB / totalWeight);
        }
      }
    }
  }
  
  // --- STAGE 4: Smooth Alpha Feathering (Anti-Aliasing Blur) ---
  // Box blur the final alpha channel of edge pixels to restore natural smoothness.
  const postDeconAlpha = new Uint8ClampedArray(w * h);
  for (let i = 0; i < data.length; i += 4) {
    postDeconAlpha[i / 4] = data[i + 3];
  }
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const aVal = postDeconAlpha[idx];
      
      if (aVal > 0 && aVal < 255) {
        let sum = 0, count = 0;
        
        const minY = Math.max(0, y - 1);
        const maxY = Math.min(h - 1, y + 1);
        const minX = Math.max(0, x - 1);
        const maxX = Math.min(w - 1, x + 1);
        
        for (let ny = minY; ny <= maxY; ny++) {
          for (let nx = minX; nx <= maxX; nx++) {
            sum += postDeconAlpha[ny * w + nx];
            count++;
          }
        }
        data[idx * 4 + 3] = Math.round(sum / count);
      }
    }
  }
  
  ctx.putImageData(imgData, 0, 0);
}
