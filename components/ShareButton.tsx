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
    setIsGenerating(false);
    setImageUrl(null);
    generateImage();
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
        
        setCustomBackground(fittedDataUrl);
        setUploadError(null);
        
        if (showModal && !isGenerating) {
          setTimeout(() => {
            setIsGenerating(true);
            setImageUrl(null);
            generateImage();
          }, 100);
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
    
    if (showModal && !isGenerating) {
      // Give React time to update ShareCard with null background
      setTimeout(() => {
        setIsGenerating(true);
        setImageUrl(null);
        generateImage();
      }, 100);
    }
  };

  const generateImage = async () => {
    setIsGenerating(true);
    setError(null);
    
    await document.fonts.ready;
    
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => requestAnimationFrame(resolve));

    const element = document.getElementById(`share-card-${position.conditionId}`);
    if (!element) {
      setIsGenerating(false);
      return;
    }

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

    try {
      // Don't override the background - ShareCard already handles it via the customBackground prop
      // Just ensure the background image is loaded before capture
      const bgStyle = window.getComputedStyle(element as HTMLElement);
      const bgImage = bgStyle.backgroundImage;
      
      if (bgImage && bgImage !== 'none' && bgImage.includes('url')) {
        // Extract URL from backgroundImage style
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
        
        const isLocalImage = originalSrc.startsWith('/') && !originalSrc.startsWith('//');
        if (isLocalImage) {
          continue;
        }
        
        if (!img.dataset.originalSrc) {
          img.dataset.originalSrc = originalSrc;
        }
        
        if (!originalSrc.includes('/api/image-proxy')) {
          try {
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
            console.warn('Failed to proxy image:', originalSrc);
          }
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const dataUrl = await toPng(element as HTMLElement, {
        backgroundColor: '#0B0F14',
        pixelRatio: 2,
        cacheBust: true,
        width: SHARE_W,
        height: SHARE_H,
      });
      
      // Restore original image sources
      for (const img of imageElements) {
        if (img.dataset.originalSrc) {
          img.src = img.dataset.originalSrc;
        }
      }

      // Convert PNG to JPEG
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
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
    if (showModal && !isGenerating) {
      setIsGenerating(true);
      setImageUrl(null);
      generateImage();
    }
  };

  const handleCopyImage = async () => {
    if (!imageUrl) return;
    
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageUrl;
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          ctx.drawImage(img, 0, 0);
          
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Failed to convert image to blob'));
              return;
            }
            
            if (!window.ClipboardItem) {
              reject(new Error('ClipboardItem API is not supported in this browser'));
              return;
            }
            
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
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
          alert('Clipboard access denied. Please allow clipboard permissions in your browser settings.');
        } else if (err.message.includes('image/jpeg')) {
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
              <ShareCard 
                id={`share-card-${position.conditionId}`}
                position={position} 
                showDollarPnL={showDollarPnL}
                debug={process.env.NODE_ENV === 'development'}
                customBackground={customBackground}
              />
              
              {isGenerating && (
                <div className="flex flex-col items-center justify-center absolute inset-0 bg-hyper-bg/80 backdrop-blur-sm z-10">
                  <div className="w-8 h-8 border-2 border-hyper-accent border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm text-hyper-textSecondary">Generating image...</p>
                </div>
              )}
              
              {!isGenerating && imageUrl && (
                <img 
                  src={imageUrl} 
                  alt="Share preview" 
                  className="absolute inset-0 w-full h-full object-contain rounded pointer-events-none opacity-0"
                  style={{ display: 'none' }}
                />
              )}
              
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