'use client';

import { useState } from 'react';
import { ClosedPosition } from '@/types';
import ShareCard, { SHARE_W, SHARE_H } from './ShareCard';
import { toPng } from 'html-to-image';

interface ShareButtonProps {
  position: ClosedPosition;
}

export default function ShareButton({ position }: ShareButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showDollarPnL, setShowDollarPnL] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [customBackground, setCustomBackground] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleShare = () => {
    setShowModal(true);
    setCopySuccess(false);
    setUploadError(null);
    // Show ShareCard immediately (like hover - instant render)
    // Generate image in background
    setIsGenerating(false);
    setImageUrl(null);
    // Reset custom background when opening new share (optional - remove if you want to persist)
    // setCustomBackground(null);
    // Start image generation async, but don't block UI
    generateImage();
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      setUploadError('Please upload an image file');
      return;
    }

    // Load and fit image to 16:9 ratio
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

        // Calculate target dimensions (use ShareCard dimensions for consistency)
        const targetWidth = SHARE_W;
        const targetHeight = SHARE_H;

        // Create canvas to crop/scale image to 16:9
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

        // Crop to fit 16:9 ratio (center crop)
        if (sourceRatio > targetRatio) {
          // Image is wider than 16:9 - crop width
          sourceWidth = height * targetRatio;
          sourceX = (width - sourceWidth) / 2;
        } else {
          // Image is taller than 16:9 - crop height
          sourceHeight = width / targetRatio;
          sourceY = (height - sourceHeight) / 2;
        }

        // Draw the cropped/scaled image
        ctx.drawImage(
          img,
          sourceX, sourceY, sourceWidth, sourceHeight,
          0, 0, targetWidth, targetHeight
        );

        // Convert to data URL
        const fittedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        
        // Set as background
        setCustomBackground(fittedDataUrl);
        setUploadError(null);
        
        // Regenerate image with new background
        if (showModal && !isGenerating) {
          setIsGenerating(true);
          setImageUrl(null);
          generateImage();
        }
      };

      img.onerror = () => {
        setUploadError('Failed to load image. Please try another file.');
      };
    };

    reader.onerror = () => {
      setUploadError('Failed to read file. Please try again.');
    };

    reader.readAsDataURL(file);
  };

  const handleRemoveBackground = () => {
    setCustomBackground(null);
    setUploadError(null);
    
    // Regenerate image with default background
    if (showModal && !isGenerating) {
      setIsGenerating(true);
      setImageUrl(null);
      generateImage();
    }
  };

  const generateImage = async () => {
    // Show loading state only when we start the actual capture
    setIsGenerating(true);
    setError(null);
    
    // Wait for fonts to be ready
    await document.fonts.ready;
    
    // Wait for next frame to ensure layout is complete
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => requestAnimationFrame(resolve));

    const element = document.getElementById(`share-card-${position.conditionId}`);
    if (!element) {
      setIsGenerating(false);
      return;
    }

    // Wait for any images to load first
    const images = element.querySelectorAll('img');
    const imagePromises = Array.from(images).map((img) => {
      if (img.complete && img.naturalWidth > 0) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          resolve(); // Continue even if image fails to load
        }, 2000);
        
        img.onload = () => {
          clearTimeout(timeout);
          resolve();
        };
        img.onerror = () => {
          clearTimeout(timeout);
          resolve(); // Continue even if image fails to load
        };
      });
    });

    await Promise.all(imagePromises);
    
    // One more frame to ensure everything is rendered
    await new Promise(resolve => requestAnimationFrame(resolve));

    try {
      // Convert external images to base64 via proxy to avoid CORS issues
      const images = Array.from(element.querySelectorAll('img')) as HTMLImageElement[];
      
      for (const img of images) {
        const originalSrc = img.src;
        
        // Skip if already base64 or blank
        if (originalSrc.startsWith('data:') || !originalSrc || originalSrc === window.location.href) {
          continue;
        }
        
        // Store original src
        if (!img.dataset.originalSrc) {
          img.dataset.originalSrc = originalSrc;
        }
        
        // Check if image is from external domain (not our proxy)
        if (!originalSrc.includes('/api/image-proxy')) {
          try {
            // Convert via proxy
            const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(originalSrc)}`;
            const response = await fetch(proxyUrl);
            
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
            // If proxy fails, fallback will show
            console.warn('Failed to proxy image:', originalSrc);
          }
        }
      }
      
      // Wait for images to render after conversion
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Simply capture the visible ShareCard element as-is using html-to-image
      const dataUrl = await toPng(element as HTMLElement, {
        backgroundColor: '#0B0F14',
        pixelRatio: 2,
        cacheBust: true,
        width: SHARE_W,
        height: SHARE_H,
      });
      
      // Restore original image sources
      for (const img of images) {
        if (img.dataset.originalSrc) {
          img.src = img.dataset.originalSrc;
        }
      }

      // Convert PNG to JPEG
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = SHARE_W * 2;
          canvas.height = SHARE_H * 2;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, SHARE_W * 2, SHARE_H * 2);
            const jpegUrl = canvas.toDataURL('image/jpeg', 0.9);
            setImageUrl(jpegUrl);
            setIsGenerating(false);
            resolve(null);
          } else {
            setImageUrl(dataUrl);
            setIsGenerating(false);
            resolve(null);
          }
        };
        img.onerror = () => {
          setImageUrl(dataUrl);
          setIsGenerating(false);
          resolve(null);
        };
      });
    } catch (error) {
      console.error('Error generating image:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate screenshot');
      setIsGenerating(false);
    }
  };

  const handleToggleDollarPnL = (show: boolean) => {
    setShowDollarPnL(show);
    // Regenerate image when toggle changes
    if (showModal && !isGenerating) {
      setIsGenerating(true);
      setImageUrl(null);
      generateImage();
    }
  };

  const handleCopyImage = async () => {
    if (!imageUrl) return;
    
    try {
      // ClipboardItem API doesn't support image/jpeg, so convert to PNG
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Allow CORS if needed
      img.src = imageUrl;
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          // Convert to PNG using canvas
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          // Draw the image onto canvas
          ctx.drawImage(img, 0, 0);
          
          // Convert canvas to PNG blob
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Failed to convert image to blob'));
              return;
            }
            
            // Check if ClipboardItem is supported
            if (!window.ClipboardItem) {
              reject(new Error('ClipboardItem API is not supported in this browser'));
              return;
            }
            
            // Use PNG for clipboard (widely supported, unlike JPEG)
            const clipboardItem = new ClipboardItem({ 
              'image/png': blob 
            });
            
            navigator.clipboard.write([clipboardItem])
              .then(() => {
                console.log('Image copied to clipboard successfully');
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000);
                resolve();
              })
              .catch((writeErr) => {
                console.error('Clipboard write error:', writeErr);
                reject(writeErr);
              });
          }, 'image/png');
        };
        img.onerror = (error) => {
          console.error('Image load error:', error);
          reject(new Error('Failed to load image for clipboard'));
        };
      });
    } catch (err) {
      console.error('Failed to copy image:', err);
      
      // Handle specific errors
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
          alert('Clipboard access denied. Please allow clipboard permissions in your browser settings.');
        } else if (err.message.includes('image/jpeg')) {
          // This shouldn't happen with our new code, but handle it anyway
          alert('Clipboard does not support JPEG. Please try refreshing the page and try again.');
        } else {
          alert(`Failed to copy image: ${err.message}. Please try downloading instead.`);
        }
      } else {
        alert('Failed to copy image. Please try downloading instead.');
      }
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `poly-pnl-${position.marketTitle?.slice(0, 20).replace(/[^a-z0-9]/gi, '-') || 'trade'}-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <button
        onClick={handleShare}
        className="p-1.5 hover:bg-hyper-panelHover rounded transition-colors"
        title="Share trade"
      >
        <svg 
          className="w-4 h-4 text-hyper-textSecondary hover:text-hyper-accent transition-colors" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      </button>

      {showModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="bg-hyper-panel border border-hyper-border rounded-lg w-full overflow-hidden"
            style={{
              maxWidth: 'clamp(900px, 90vw, 920px)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-hyper-border">
              <h3 className="text-lg font-semibold text-hyper-textPrimary">Share Trade</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-hyper-textSecondary hover:text-hyper-textPrimary transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Preview */}
            <div 
              className="flex items-center justify-center bg-hyper-bg relative overflow-hidden"
              style={{ 
                padding: '16px',
                minHeight: `${SHARE_H + 32}px`,
              }}
            >
              {/* ShareCard for both preview and export - same node, capture directly */}
              <ShareCard 
                id={`share-card-${position.conditionId}`}
                position={position} 
                showDollarPnL={showDollarPnL}
                debug={process.env.NODE_ENV === 'development'}
                customBackground={customBackground}
              />
              
              {/* Show ShareCard immediately - numbers appear instantly like hover */}
              {/* Only show loading overlay when actually generating export image */}
              {isGenerating && (
                <div className="flex flex-col items-center justify-center absolute inset-0 bg-hyper-bg/80 backdrop-blur-sm z-10">
                  <div className="w-8 h-8 border-2 border-hyper-accent border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm text-hyper-textSecondary">Generating image...</p>
                </div>
              )}
              
              {/* Show generated image when ready (optional - ShareCard is already visible) */}
              {!isGenerating && imageUrl && (
                <img 
                  src={imageUrl} 
                  alt="Share preview" 
                  className="absolute inset-0 w-full h-full object-contain rounded pointer-events-none opacity-0"
                  style={{ display: 'none' }}
                />
              )}
              
              {/* Show error message if generation failed */}
              {error && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded text-sm z-20">
                  {error}
                </div>
              )}
            </div>

            {/* Background Upload Section */}
            <div className="px-4 py-3 border-t border-hyper-border">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-hyper-textSecondary">Custom Background</label>
                {customBackground && (
                  <button
                    onClick={handleRemoveBackground}
                    className="text-xs text-hyper-textSecondary hover:text-hyper-textPrimary transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBackgroundUpload}
                    className="hidden"
                  />
                  <span className="text-xs px-3 py-2 bg-hyper-panelHover hover:bg-hyper-border border border-hyper-border rounded text-hyper-textPrimary transition-colors inline-block">
                    {customBackground ? 'Change Background' : 'Upload Background'}
                  </span>
                </label>
                <p className="text-xs text-hyper-textSecondary">
                  Image will be automatically fitted to 16:9 ratio
                </p>
                {uploadError && (
                  <p className="text-xs text-red-400">{uploadError}</p>
                )}
              </div>
            </div>

            {/* Toggle and Actions */}
            <div className="flex items-center justify-between p-4 border-t border-hyper-border">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDollarPnL}
                  onChange={(e) => {
                    handleToggleDollarPnL(e.target.checked);
                  }}
                  className="w-4 h-4 rounded border-hyper-border text-hyper-accent focus:ring-hyper-accent"
                />
                <span className="text-sm text-hyper-textSecondary">Show P&L Amount</span>
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCopyImage}
                  disabled={!imageUrl || isGenerating}
                  className="px-4 py-2 bg-hyper-panelHover hover:bg-hyper-border border border-hyper-border rounded text-sm font-medium text-hyper-textPrimary transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative"
                >
                  {copySuccess ? 'Image copied!' : 'Copy Image'}
                </button>
                <button
                  onClick={handleDownload}
                  disabled={!imageUrl || isGenerating}
                  className="px-4 py-2 bg-hyper-accent hover:bg-hyper-accent/90 rounded text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
