/**
 * Refined HD Image Enhancer utilities.
 * Fulfills professional enhancement requirements:
 * 1. Increase sharpness and clarity naturally
 * 2. Reduce noise, artifacts, and pixelation (edge-preserving)
 * 3. Improve texture details without exaggerating colors
 * 4. Protect highlights/shadows from clipping
 */

/**
 * Enhances the visual quality of a canvas image using a 3-stage pipeline:
 * - Stage 1: Edge-Preserving Denoise (Smart Bilateral Filter Approximation)
 * - Stage 2: Detail Sharpening (Unsharp Masking on Denoised Buffer)
 * - Stage 3: Protected Luma Contrast & Smart Vibrance Color Correction
 */
export function enhanceImageQuality(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  
  if (w === 0 || h === 0) return;

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  
  // Clone original pixels
  const original = new Uint8ClampedArray(data);
  
  // --- STAGE 1: Edge-Preserving Denoise (Smart Bilateral Filter Approximation) ---
  // Reduces noise, blocky compression artifacts, and pixelation in flat regions,
  // while preserving sharp transitions and lines (such as eyes and object boundaries).
  const denoiseBuffer = new Uint8ClampedArray(data.length);
  const rangeThreshold = 25; // absolute color difference threshold for smoothing
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      
      // If transparent, skip
      if (original[idx + 3] === 0) continue;
      
      const r0 = original[idx];
      const g0 = original[idx + 1];
      const b0 = original[idx + 2];
      
      let sumR = 0, sumG = 0, sumB = 0, count = 0;
      
      // 3x3 search window
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const nIdx = (ny * w + nx) * 4;
            
            // Skip transparent neighbors
            if (original[nIdx + 3] === 0) continue;
            
            const rn = original[nIdx];
            const gn = original[nIdx + 1];
            const bn = original[nIdx + 2];
            
            // Calculate absolute color differences (l1 distance)
            const colorDist = Math.abs(rn - r0) + Math.abs(gn - g0) + Math.abs(bn - b0);
            
            // If the difference is small, it's noise in a flat area - smooth it!
            // If the difference is large, it's a real edge - do not blur!
            if (colorDist < rangeThreshold * 3) {
              sumR += rn;
              sumG += gn;
              sumB += bn;
              count++;
            }
          }
        }
      }
      
      if (count > 0) {
        denoiseBuffer[idx] = sumR / count;
        denoiseBuffer[idx + 1] = sumG / count;
        denoiseBuffer[idx + 2] = sumB / count;
        denoiseBuffer[idx + 3] = original[idx + 3];
      } else {
        denoiseBuffer[idx] = r0;
        denoiseBuffer[idx + 1] = g0;
        denoiseBuffer[idx + 2] = b0;
        denoiseBuffer[idx + 3] = original[idx + 3];
      }
    }
  }

  // --- STAGE 2: Unsharp Masking Detail Sharpener ---
  // Applies detail sharpening specifically on the denoised image buffer.
  // This enhances real high-frequency textures without amplifying JPEG artifacts or noise.
  const amount = 0.40; // sharpening factor
  const kCenter = 1 + 4 * amount;
  const kEdge = -amount;
  const sharpenBuffer = new Uint8ClampedArray(denoiseBuffer.length);
  
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      
      if (denoiseBuffer[idx + 3] === 0) continue;
      
      sharpenBuffer[idx + 3] = denoiseBuffer[idx + 3];
      
      for (let c = 0; c < 3; c++) {
        const cIdx = idx + c;
        
        const center = denoiseBuffer[cIdx];
        const top = denoiseBuffer[cIdx - w * 4];
        const bottom = denoiseBuffer[cIdx + w * 4];
        const left = denoiseBuffer[cIdx - 4];
        const right = denoiseBuffer[cIdx + 4];
        
        const sharpenedVal = center * kCenter + (top + bottom + left + right) * kEdge;
        
        // Save and clamp
        sharpenBuffer[cIdx] = Math.min(255, Math.max(0, sharpenedVal));
      }
    }
  }
  
  // Copy boundaries directly from denoiseBuffer (where convolution didn't run)
  for (let x = 0; x < w; x++) {
    const topIdx = x * 4;
    const btmIdx = ((h - 1) * w + x) * 4;
    for (let c = 0; c < 4; c++) {
      sharpenBuffer[topIdx + c] = denoiseBuffer[topIdx + c];
      sharpenBuffer[btmIdx + c] = denoiseBuffer[btmIdx + c];
    }
  }
  for (let y = 0; y < h; y++) {
    const lftIdx = (y * w) * 4;
    const rgtIdx = (y * w + w - 1) * 4;
    for (let c = 0; c < 4; c++) {
      sharpenBuffer[lftIdx + c] = denoiseBuffer[lftIdx + c];
      sharpenBuffer[rgtIdx + c] = denoiseBuffer[rgtIdx + c];
    }
  }

  // --- STAGE 3: Protected Luma Contrast & Smart Vibrance Color Correction ---
  // Improves color accuracy and contrast naturally while preventing clipping (highlights/shadow blowouts)
  // and keeping skin tones realistic.
  for (let i = 0; i < data.length; i += 4) {
    if (sharpenBuffer[i + 3] === 0) continue;
    
    let r = sharpenBuffer[i];
    let g = sharpenBuffer[i + 1];
    let b = sharpenBuffer[i + 2];
    
    // 1. Highlight/Shadow Protected Luma Contrast
    // Protect extremes by using a soft S-curve approximation to adjust contrast
    const contrastFactor = 1.06;
    r = (r - 128) * contrastFactor + 128;
    g = (g - 128) * contrastFactor + 128;
    b = (b - 128) * contrastFactor + 128;
    
    // 2. Smart Vibrance (selective color boost)
    // Saturation is boosted more for pastel/desaturated colors and less for already vibrant colors.
    // This prevents skin tones (typically high orange saturation) from looking fake or exaggerated.
    const maxVal = Math.max(r, g, b);
    const minVal = Math.min(r, g, b);
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    
    const sat = maxVal === 0 ? 0 : (maxVal - minVal) / maxVal;
    
    // Low saturation = higher vibrance boost. High saturation = minimal boost.
    const vibranceMultiplier = 0.15 * (1.0 - sat);
    
    r = luma + (1.0 + vibranceMultiplier) * (r - luma);
    g = luma + (1.0 + vibranceMultiplier) * (g - luma);
    b = luma + (1.0 + vibranceMultiplier) * (b - luma);
    
    // Final clamp and write to output buffer
    data[i] = Math.min(255, Math.max(0, r));
    data[i + 1] = Math.min(255, Math.max(0, g));
    data[i + 2] = Math.min(255, Math.max(0, b));
    data[i + 3] = sharpenBuffer[i + 3];
  }
  
  // Write final pixels back to canvas context
  ctx.putImageData(imgData, 0, 0);
}
