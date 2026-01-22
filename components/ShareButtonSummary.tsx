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
    // Wait for modal to render before generating image
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
        setTimeout(() => {
          setIsGenerating(true);
          setImageUrl(null);
          generateImage();
        }, 100);
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
      }, 100);
    }
  };

  const generateImage = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      setImageUrl(null);

      // Wait for the element to be rendered
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      let element = document.getElementById('share-card-summary');
      if (!element) {
        // Try waiting a bit more
        await new Promise(resolve => setTimeout(resolve, 100));
        element = document.getElementById('share-card-summary');
      }
      
      if (!element) {
        throw new Error('Share card element not found');
      }

      // Don't override the background - ShareCardSummary already handles it via the customBackground prop
      // Just ensure the default background is loaded if needed
      if (!customBackground) {
        // Preload default background to ensure it's ready for capture
        const bgImg = new Image();
        bgImg.crossOrigin = 'anonymous';
        bgImg.src = '/bg.png';
        
        await new Promise((resolve, reject) => {
          bgImg.onload = resolve;
          bgImg.onerror = reject;
        });
      }

      // Convert images to base64 before capture
      const images = element.querySelectorAll('img');
      const imagePromises = Array.from(images).map(async (img) => {
        if (img.src.startsWith('http') && !img.src.includes('data:')) {
          try {
            const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(img.src)}`;
            const response = await fetch(proxyUrl);
            const blob = await response.blob();
            const reader = new FileReader();
            return new Promise<string>((resolve) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => resolve(img.src);
              reader.readAsDataURL(blob);
            });
          } catch (err) {
            console.warn('Failed to convert image to base64:', err);
            return img.src;
          }
        }
        return img.src;
      });

      await Promise.all(imagePromises);

      // Generate image
      const dataUrl = await toPng(element, {
        quality: 1.0,
        pixelRatio: 2,
        width: SHARE_W,
        height: SHARE_H,
        cacheBust: true,
      });

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
      // Convert data URL to blob
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      // Convert JPEG to PNG for clipboard compatibility
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
              }).catch(reject);
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
        <div className="text-lg text-hyper-textSecondary tracking-wide mb-2">Share</div>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-hyper-textSecondary">
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
