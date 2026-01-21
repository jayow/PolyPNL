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

  const handleShare = () => {
    setShowModal(true);
    // Show ShareCard immediately (like hover - instant render)
    // Generate image in background
    setIsGenerating(false);
    setImageUrl(null);
    // Start image generation async, but don't block UI
    generateImage();
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
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const item = new ClipboardItem({ 'image/jpeg': blob });
      await navigator.clipboard.write([item]);
      // You could show a toast notification here
    } catch (err) {
      console.error('Failed to copy image:', err);
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
                  className="px-4 py-2 bg-hyper-panelHover hover:bg-hyper-border border border-hyper-border rounded text-sm font-medium text-hyper-textPrimary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Copy Image
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
