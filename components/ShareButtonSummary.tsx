'use client';

import { useState } from 'react';
import { PositionSummary, ClosedPosition, ProxyWalletResponse } from '@/types';
import ShareCardSummary from './ShareCardSummary';
import { SHARE_W, SHARE_H } from './ShareCard';
import { toPng } from 'html-to-image';

interface ShareButtonSummaryProps {
  summary: PositionSummary;
  positions: ClosedPosition[];
  wallet: string;
  resolveResult: ProxyWalletResponse | null;
}

export default function ShareButtonSummary({ summary, positions, wallet, resolveResult }: ShareButtonSummaryProps) {
  const [showModal, setShowModal] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [customBackground, setCustomBackground] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string>('');

  const handleShare = () => {
    setShowModal(true);
    setCopySuccess(false);
    setUploadError(null);
    setIsGenerating(false);
    setImageUrl(null);
    // DON'T generate immediately - let user trigger it
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please upload an image file');
      return;
    }

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      img.src = dataUrl;

      img.onload = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        const sourceRatio = width / height;
        const targetRatio = 16 / 9;

        const targetWidth = SHARE_W;
        const targetHeight = SHARE_H;

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          setUploadError('Failed to process image. Please try again.');
          return;
        }

        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth = width;
        let sourceHeight = height;

        if (sourceRatio > targetRatio) {
          sourceWidth = height * targetRatio;
          sourceX = (width - sourceWidth) / 2;
        } else {
          sourceHeight = width / targetRatio;
          sourceY = (height - sourceHeight) / 2;
        }

        ctx.drawImage(
          img,
          sourceX, sourceY, sourceWidth, sourceHeight,
          0, 0, targetWidth, targetHeight
        );

        const fittedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        
        console.log('[ShareButtonSummary] Setting custom background:', fittedDataUrl.substring(0, 50) + '...');
        setCustomBackground(fittedDataUrl);
        setUploadError(null);
        
        // Background updated - user can click "Generate Image" when ready
        setImageUrl(null);
      };

      img.onerror = () => {
        setUploadError('Failed to load image. Please try again.');
      };
    };

    reader.onerror = () => {
      setUploadError('Failed to read image file. Please try again.');
    };

    reader.readAsDataURL(file);
  };

  const handleBackgroundUrl = async () => {
    if (!backgroundUrl.trim()) {
      setUploadError('Please enter an image URL');
      return;
    }

    // Validate URL format
    try {
      new URL(backgroundUrl.trim());
    } catch {
      setUploadError('Invalid URL format');
      return;
    }

    setUploadError(null);
    
    try {
      // Use image-proxy to fetch the image (handles CORS and security)
      const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(backgroundUrl.trim())}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error('Failed to fetch image from URL');
      }

      const blob = await response.blob();
      
      // Convert blob to data URL and process like file upload
      // We'll verify it's an image by trying to load it, not just checking blob.type
      // (some servers return incorrect content-types like "binary/data" for images)
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const img = new Image();
        img.src = dataUrl;

        img.onload = () => {
          // Successfully loaded as image - verify it has valid dimensions
          if (img.naturalWidth === 0 || img.naturalHeight === 0) {
            setUploadError('URL does not point to a valid image');
            return;
          }
          const width = img.naturalWidth;
          const height = img.naturalHeight;
          const sourceRatio = width / height;
          const targetRatio = 16 / 9;

          const targetWidth = SHARE_W;
          const targetHeight = SHARE_H;

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            setUploadError('Failed to process image. Please try again.');
            return;
          }

          let sourceX = 0;
          let sourceY = 0;
          let sourceWidth = width;
          let sourceHeight = height;

          if (sourceRatio > targetRatio) {
            sourceWidth = height * targetRatio;
            sourceX = (width - sourceWidth) / 2;
          } else {
            sourceHeight = width / targetRatio;
            sourceY = (height - sourceHeight) / 2;
          }

          ctx.drawImage(
            img,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, targetWidth, targetHeight
          );

          const fittedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
          
          console.log('[ShareButtonSummary] Setting custom background from URL:', fittedDataUrl.substring(0, 50) + '...');
          setCustomBackground(fittedDataUrl);
          setUploadError(null);
          setBackgroundUrl('');
          
          // Background updated - user can click "Generate Image" when ready
          setImageUrl(null);
        };

        img.onerror = () => {
          // If blob type check failed, give a more specific error
          if (!blob.type.startsWith('image/')) {
            setUploadError('URL does not point to an image. The server returned: ' + (blob.type || 'unknown type'));
          } else {
            setUploadError('Failed to load image from URL. Please check the URL is valid.');
          }
        };
      };

      reader.onerror = () => {
        setUploadError('Failed to read image from URL. Please try again.');
      };

      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error loading image from URL:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to load image from URL');
    }
  };

  const handleRemoveBackground = () => {
    setCustomBackground(null);
    setUploadError(null);
    setBackgroundUrl('');
    setImageUrl(null);
  };

  const generateImage = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      setImageUrl(null);

      // CRITICAL: Wait for modal AND layout to fully settle
      // CSS layout (flexbox, positioning, etc.) takes a moment to compute final positions
      await document.fonts.ready;
      await new Promise(resolve => setTimeout(resolve, 800)); // Increased from 300ms to 800ms for layout to settle
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => requestAnimationFrame(resolve)); // Extra frame to ensure we're past multiple layout cycles
      
      const element = document.getElementById('share-card-summary');
      
      if (!element) {
        throw new Error('Share card element not found - modal may not be open');
      }

      // CRITICAL: Wait for canvas to be ready AND painted
      const canvas = element.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) {
        throw new Error('Canvas element not found');
      }
      
      // Wait for canvas ready signal with timeout
      let canvasReadyAttempts = 0;
      const maxCanvasAttempts = 30;
      while (canvas.getAttribute('data-canvas-ready') !== 'true' && canvasReadyAttempts < maxCanvasAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        canvasReadyAttempts++;
      }
      
      if (canvas.getAttribute('data-canvas-ready') !== 'true') {
        throw new Error('Canvas failed to render - try again');
      }
      
      // EXTRA WAIT: Even after ready signal, wait for actual paint
      // The ready signal is set immediately after drawLineGraph() completes,
      // but the browser may not have painted those pixels to the screen yet
      await new Promise(resolve => setTimeout(resolve, 200));
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // Validate canvas has actual content (not blank)
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const hasContent = imageData.data.some((pixel, index) => {
          if ((index + 1) % 4 === 0) {
            return pixel > 0;
          }
          return false;
        });
        
        if (!hasContent) {
          throw new Error('Canvas is blank - graph not rendered. Please try again.');
        }
        
        // Force canvas to flush
        ctx.getImageData(0, 0, 1, 1);
        await new Promise(resolve => requestAnimationFrame(resolve));
      }

      // ALSO wait for tooltips to be ready
      // Tooltips only render when tooltipsReady is true, so we need to wait for them to appear in DOM
      let tooltipReadyAttempts = 0;
      const maxTooltipAttempts = 30;
      while (tooltipReadyAttempts < maxTooltipAttempts) {
        // Check if tooltip divs exist in the DOM (they only render when tooltipsReady is true)
        // Find tooltips by their text content
        const allDivs = element.querySelectorAll('div');
        const tooltips: HTMLElement[] = [];
        allDivs.forEach(div => {
          if (div.textContent?.includes('Best trade') || div.textContent?.includes('Worst trade')) {
            // Check if this div has positioning styles (is a tooltip)
            const style = window.getComputedStyle(div);
            if (style.position === 'absolute') {
              tooltips.push(div as HTMLElement);
            }
          }
        });
        
        // Tooltips are rendered when they exist in DOM
        if (tooltips.length > 0) {
          // Check if they have actual positions set (not default/zero)
          const firstTooltip = tooltips[0];
          const rect = firstTooltip.getBoundingClientRect();
          const hasPosition = rect.left > 0 && rect.top > 0;
          if (hasPosition) {
            // Tooltips are rendered and positioned correctly
            break;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        tooltipReadyAttempts++;
      }

      // Extra wait after tooltips appear to ensure they're painted
      await new Promise(resolve => setTimeout(resolve, 200));
      await new Promise(resolve => requestAnimationFrame(resolve));

      // Ensure background image is loaded
      const bgStyle = window.getComputedStyle(element as HTMLElement);
      const bgImage = bgStyle.backgroundImage;
      
      if (bgImage && bgImage !== 'none' && bgImage.includes('url')) {
        const urlMatch = bgImage.match(/url\(['"]?(.+?)['"]?\)/);
        if (urlMatch && urlMatch[1]) {
          const bgUrl = urlMatch[1];
          
          // If it's a regular URL (not base64), preload it
          if (!bgUrl.startsWith('data:')) {
            try {
              const bgImg = new Image();
              bgImg.crossOrigin = 'anonymous';
              bgImg.src = bgUrl;
              
              await new Promise<void>((resolve) => {
                const timeout = setTimeout(() => resolve(), 3000);
                bgImg.onload = () => {
                  clearTimeout(timeout);
                  resolve();
                };
                bgImg.onerror = () => {
                  clearTimeout(timeout);
                  resolve();
                };
              });
            } catch (e) {
              console.warn('Failed to preload background:', e);
            }
          }
        }
      }

      // Wait for all images to load
      const images = element.querySelectorAll('img');
      const imagePromises = Array.from(images).map((img) => {
        if (img.complete && img.naturalWidth > 0) {
          return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            resolve();
          }, 2000);
          
          img.onload = () => {
            clearTimeout(timeout);
            resolve();
          };
          img.onerror = () => {
            clearTimeout(timeout);
            resolve();
          };
        });
      });

      await Promise.all(imagePromises);
      
      await new Promise(resolve => requestAnimationFrame(resolve));

      // Convert external images to base64 via proxy
      // CRITICAL: Convert in parallel but wait for each to fully load after conversion
      const imageElements = Array.from(element.querySelectorAll('img')) as HTMLImageElement[];
      const imageConversionPromises: Promise<void>[] = [];
      
      for (const img of imageElements) {
        if (img.style.display === 'none' || !img.complete || img.naturalWidth === 0) {
          continue;
        }
        
        const originalSrc = img.src;
        
        if (originalSrc.startsWith('data:') || !originalSrc || originalSrc === window.location.href) {
          continue;
        }
        
        const isLocalImage = originalSrc.startsWith('/') && !originalSrc.startsWith('//') && !originalSrc.includes('/api/image-proxy');
        if (isLocalImage) {
          continue;
        }
        
        if (!img.dataset.originalSrc) {
          img.dataset.originalSrc = originalSrc;
        }
        
        // Convert all external images (including proxied ones) to base64
        const conversionPromise = (async () => {
          try {
            let fetchUrl = originalSrc;
            
            // If it's already a proxy URL, use it directly; otherwise, create a proxy URL
            if (!originalSrc.includes('/api/image-proxy')) {
              fetchUrl = `/api/image-proxy?url=${encodeURIComponent(originalSrc)}`;
            }
            
            const response = await fetch(fetchUrl);
            
            if (response.ok) {
              const blob = await response.blob();
              const reader = new FileReader();
              const base64 = await new Promise<string>((resolve, reject) => {
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              
              // Set base64 and wait for image to load
              await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                  reject(new Error('Image load timeout'));
                }, 5000);
                
                img.onload = () => {
                  clearTimeout(timeout);
                  // Verify image actually loaded
                  if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
                    resolve();
                  } else {
                    reject(new Error('Image loaded but invalid dimensions'));
                  }
                };
                
                img.onerror = () => {
                  clearTimeout(timeout);
                  reject(new Error('Image failed to load'));
                };
                
                img.src = base64;
              });
            }
          } catch (e) {
            console.warn('Failed to convert image to base64:', originalSrc, e);
            // Don't throw - continue with other images
          }
        })();
        
        imageConversionPromises.push(conversionPromise);
      }
      
      // Wait for ALL images to be converted and loaded
      await Promise.all(imageConversionPromises);
      
      // Extra wait to ensure all images are fully rendered in DOM
      await new Promise(resolve => setTimeout(resolve, 500));
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // Final verification: Check all images are loaded
      const allImages = element.querySelectorAll('img');
      const allLoaded = Array.from(allImages).every(img => {
        if (img.style.display === 'none') return true;
        return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
      });
      
      if (!allLoaded) {
        console.warn('Some images may not be fully loaded before capture');
        // Wait a bit more
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Final canvas validation before generating image
      const finalCanvas = element.querySelector('canvas') as HTMLCanvasElement;
      if (finalCanvas) {
        const finalCtx = finalCanvas.getContext('2d');
        if (finalCtx) {
          const finalImageData = finalCtx.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
          const hasFinalContent = finalImageData.data.some((pixel, index) => {
            if ((index + 1) % 4 === 0) {
              return pixel > 0;
            }
            return false;
          });
          
          if (!hasFinalContent) {
            throw new Error('Canvas content lost during image conversion');
          }
        }
      }

      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(resolve));

      // Generate image with enhanced options for better image capture
      const dataUrl = await toPng(element as HTMLElement, {
        backgroundColor: '#0B0F14',
        pixelRatio: 2,
        cacheBust: true,
        width: SHARE_W,
        height: SHARE_H,
        skipAutoScale: true,
        quality: 1.0,
      });

      // Restore original image sources
      for (const img of imageElements) {
        if (img.dataset.originalSrc) {
          img.src = img.dataset.originalSrc;
        }
      }

      setImageUrl(dataUrl);
      setIsGenerating(false);
    } catch (err) {
      console.error('Error generating image:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate image');
      setIsGenerating(false);
    }
  };

  const handleCopyImage = async () => {
    if (!imageUrl) return;

    try {
      // Convert data URL to blob and directly to PNG for clipboard
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      // Convert to PNG blob for clipboard compatibility
      const img = new Image();
      img.src = imageUrl;
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Failed to create canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0);
          canvas.toBlob((pngBlob) => {
            if (pngBlob) {
              navigator.clipboard.write([
                new ClipboardItem({ 'image/png': pngBlob })
              ]).then(() => {
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000);
                resolve(null);
              }).catch((err) => {
                console.error('Failed to copy to clipboard:', err);
                // Fallback: try with the original blob
                if (blob.type === 'image/png' || blob.type === 'image/jpeg') {
                  navigator.clipboard.write([
                    new ClipboardItem({ [blob.type]: blob })
                  ]).then(() => {
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 2000);
                    resolve(null);
                  }).catch(reject);
                } else {
                  reject(err);
                }
              });
            } else {
              reject(new Error('Failed to convert to PNG'));
            }
          }, 'image/png');
        };
        img.onerror = reject;
      });
    } catch (err) {
      console.error('Failed to copy image:', err);
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.download = `pnl-summary-${wallet.slice(0, 8)}.png`;
    link.href = imageUrl;
    link.click();
  };

  return (
    <>
      <div 
        onClick={handleShare}
        className="bg-hyper-panel border border-hyper-border rounded py-3 px-3 flex flex-col items-center justify-center h-full cursor-pointer hover:bg-hyper-panelHover transition-colors"
      >
        <div className="text-lg text-hyper-accent tracking-wide mb-2">Share</div>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-hyper-accent">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
          <polyline points="16 6 12 2 8 6"></polyline>
          <line x1="12" y1="2" x2="12" y2="15"></line>
        </svg>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-hyper-panel border border-hyper-border rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-hyper-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-hyper-textPrimary">Share PnL Summary</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setImageUrl(null);
                  setCopySuccess(false);
                  setError(null);
                }}
                className="text-hyper-textSecondary hover:text-hyper-textPrimary"
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              {/* Share Card Preview */}
              <div className="mb-4 flex justify-center" style={{ minHeight: `${SHARE_H}px` }}>
                <ShareCardSummary
                  id="share-card-summary"
                  summary={summary}
                  positions={positions}
                  username={resolveResult?.username}
                  profileImage={resolveResult?.profileImage}
                  wallet={resolveResult?.userAddressUsed || wallet}
                  customBackground={customBackground}
                />
              </div>

              {/* Background Upload */}
              <div className="mb-4">
                <label className="block text-sm text-hyper-textSecondary mb-2">
                  Custom Background (16:9 ratio recommended)
                </label>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBackgroundUpload}
                      className="hidden"
                      id="background-upload-summary"
                    />
                    <label
                      htmlFor="background-upload-summary"
                      className="px-4 py-2 bg-hyper-panelHover border border-hyper-border rounded cursor-pointer hover:bg-hyper-panelHover/80 text-sm text-hyper-textPrimary"
                    >
                      Upload Background
                    </label>
                    {customBackground && (
                      <button
                        onClick={handleRemoveBackground}
                        className="px-4 py-2 bg-hyper-panelHover border border-hyper-border rounded hover:bg-hyper-panelHover/80 text-sm text-hyper-textPrimary"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={backgroundUrl}
                      onChange={(e) => setBackgroundUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleBackgroundUrl();
                        }
                      }}
                      placeholder="Or paste image URL here..."
                      className="flex-1 px-3 py-2 bg-hyper-panel border border-hyper-border rounded text-sm text-hyper-textPrimary placeholder-hyper-textSecondary focus:outline-none focus:border-hyper-accent"
                    />
                    <button
                      onClick={handleBackgroundUrl}
                      className="px-4 py-2 bg-hyper-panelHover border border-hyper-border rounded hover:bg-hyper-panelHover/80 text-sm text-hyper-textPrimary"
                    >
                      Load URL
                    </button>
                  </div>
                </div>
                {uploadError && (
                  <div className="mt-2 text-sm text-hyper-negative">{uploadError}</div>
                )}
              </div>

              {/* Actions */}
              {error && (
                <div className="mb-4 p-3 bg-hyper-negative/20 border border-hyper-negative rounded text-sm text-hyper-negative">
                  {error}
                </div>
              )}

              {isGenerating && (
                <div className="mb-4 text-sm text-hyper-textSecondary text-center">
                  Generating image...
                </div>
              )}

              {/* Show Generate button if no image yet */}
              {!imageUrl && !isGenerating && (
                <button
                  onClick={generateImage}
                  className="w-full px-4 py-2 bg-hyper-accent hover:bg-hyper-accent/80 rounded text-white font-semibold"
                >
                  Generate Image
                </button>
              )}

              {/* Show Copy/Download once image is ready */}
              {imageUrl && (
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyImage}
                    className="flex-1 px-4 py-2 bg-hyper-accent hover:bg-hyper-accent/80 rounded text-white font-semibold"
                  >
                    {copySuccess ? '✓ Copied!' : 'Copy Image'}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex-1 px-4 py-2 bg-hyper-panelHover border border-hyper-border rounded hover:bg-hyper-panelHover/80 text-hyper-textPrimary font-semibold"
                  >
                    Download
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
