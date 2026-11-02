/**
 * Utility to apply watermark (text or logo) to an image file or URL using HTML5 Canvas.
 */
export interface WatermarkConfig {
  type: 'NONE' | 'TEXT' | 'LOGO';
  text?: string;
  logoUrl?: string;
  position: 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT' | 'CENTER';
  opacity: number; // 0 to 1
  fontSize?: number; // default ~24
}

export async function applyWatermarkToImage(
  imageUrl: string,
  config: WatermarkConfig
): Promise<string> {
  if (config.type === 'NONE') return imageUrl;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageUrl);
          return;
        }

        // Draw original image
        ctx.drawImage(img, 0, 0);

        ctx.globalAlpha = Math.max(0.1, Math.min(1, config.opacity ?? 0.6));

        const margin = Math.max(20, Math.round(canvas.width * 0.03));
        const baseFontSize = Math.max(16, Math.round(canvas.width * 0.035));

        if (config.type === 'TEXT' && config.text) {
          ctx.font = `bold ${baseFontSize}px sans-serif`;
          ctx.fillStyle = '#FFFFFF';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;

          const textWidth = ctx.measureText(config.text).width;
          let x = margin;
          let y = margin + baseFontSize;

          switch (config.position) {
            case 'TOP_LEFT':
              x = margin;
              y = margin + baseFontSize;
              break;
            case 'TOP_RIGHT':
              x = canvas.width - textWidth - margin;
              y = margin + baseFontSize;
              break;
            case 'BOTTOM_LEFT':
              x = margin;
              y = canvas.height - margin;
              break;
            case 'BOTTOM_RIGHT':
              x = canvas.width - textWidth - margin;
              y = canvas.height - margin;
              break;
            case 'CENTER':
              x = (canvas.width - textWidth) / 2;
              y = canvas.height / 2;
              break;
          }

          ctx.fillText(config.text, x, y);
        } else if (config.type === 'LOGO' && config.logoUrl) {
          const logo = new Image();
          logo.crossOrigin = 'anonymous';
          await new Promise<void>((resLogo) => {
            logo.onload = () => resLogo();
            logo.onerror = () => resLogo();
            logo.src = config.logoUrl!;
          });

          if (logo.complete && logo.naturalWidth > 0) {
            const logoWidth = Math.max(60, Math.round(canvas.width * 0.18));
            const aspect = logo.naturalHeight / logo.naturalWidth;
            const logoHeight = logoWidth * aspect;

            let x = margin;
            let y = margin;

            switch (config.position) {
              case 'TOP_LEFT':
                x = margin;
                y = margin;
                break;
              case 'TOP_RIGHT':
                x = canvas.width - logoWidth - margin;
                y = margin;
                break;
              case 'BOTTOM_LEFT':
                x = margin;
                y = canvas.height - logoHeight - margin;
                break;
              case 'BOTTOM_RIGHT':
                x = canvas.width - logoWidth - margin;
                y = canvas.height - logoHeight - margin;
                break;
              case 'CENTER':
                x = (canvas.width - logoWidth) / 2;
                y = (canvas.height - logoHeight) / 2;
                break;
            }

            ctx.drawImage(logo, x, y, logoWidth, logoHeight);
          }
        }

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob));
          } else {
            resolve(imageUrl);
          }
        }, 'image/jpeg', 0.92);
      } catch (err) {
        console.warn('Watermark failed, using original image:', err);
        resolve(imageUrl);
      }
    };
    img.onerror = () => resolve(imageUrl);
    img.src = imageUrl;
  });
}