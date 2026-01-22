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

  const handleShare = () => {
    setShowModal(true);
    setCopySuccess(false);
    setUploadError(null);
    setIsGenerating(false);
    setImageUrl(null);
    // Use the pre-rendered hidden element - it should already be ready
    // Just need a small delay for modal to show, then capture immediately
    setTimeout(() => {
      generateImage();
    }, 100);
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
        
        // Regenerate the image with the new background
        // Hidden element will update automatically, just need a moment for React
        setTimeout(() => {
          setIsGenerating(true);
          setImageUrl(null);
          generateImage();
        }, 200);
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

  const handleRemoveBackground = () => {
    setCustomBackground(null);
    setUploadError(null);
    if (showModal) {
      setTimeout(() => {
        setIsGenerating(true);
        setImageUrl(null);
        generateImage();
      }, 200);
    }
  };

  const generateImage = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      setImageUrl(null);

      // Wait for fonts to be ready
      await document.fonts.ready;
      
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // Wait for component to mount and be in DOM
      // Use the pre-rendered hidden element (should already be ready)
      let element = document.getElementById('share-card-summary-hidden');
      
      // If hidden element not found, fall back to visible one (shouldn't happen)
      if (!element) {
        element = document.getElementById('share-card-summary');
      }
      
      if (!element) {
        throw new Error('Share card element not found');
      }

      // Since we're using a pre-rendered element, we just need a small wait
      // for any recent background changes to apply
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
      const imageElements = Array.from(element.querySelectorAll('img')) as HTMLImageElement[];
      
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
            img.src = base64;
          }
        } catch (e) {
          console.warn('Failed to convert image to base64:', originalSrc);
        }
      }
      
      // Wait for images to be converted and DOM to update
      // Since element is pre-rendered, images should already be loaded
      await new Promise(resolve => setTimeout(resolve, 200));
      await new Promise(resolve => requestAnimationFrame(resolve));

      // Ensure canvas is ready (should already be ready since it's pre-rendered)
      const canvas = element.querySelector('canvas') as HTMLCanvasElement;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Quick check - canvas should already be ready, but verify
          const hasReadySignal = canvas.getAttribute('data-canvas-ready') === 'true';
          if (hasReadySignal && canvas.width === 600 && canvas.height === 240) {
            // Force canvas to flush
            ctx.getImageData(0, 0, 1, 1);
            await new Promise(resolve => requestAnimationFrame(resolve));
          } else {
            // If not ready, wait a bit (shouldn't happen with pre-rendered element)
            await new Promise(resolve => setTimeout(resolve, 300));
            await new Promise(resolve => requestAnimationFrame(resolve));
          }
        }
      }

      // Final quick check - pre-rendered element should already be ready
      // Just ensure fonts are loaded
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(resolve));

      // Generate image
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
      {/* Pre-render ShareCardSummary in the background (hidden) so it's always ready */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', visibility: 'hidden', pointerEvents: 'none' }}>
        <ShareCardSummary
          id="share-card-summary-hidden"
          summary={summary}
          positions={positions}
          username={resolveResult?.username}
          profileImage={resolveResult?.profileImage}
          wallet={resolveResult?.userAddressUsed || wallet}
          customBackground={customBackground}
        />
      </div>

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
              <div className="mb-4 flex justify-center">
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
