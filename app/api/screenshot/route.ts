import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { screenshotRequestSchema, validateRequestBody } from '@/lib/validation';

/**
 * Server-side screenshot API using Puppeteer
 * This provides pixel-perfect screenshots that match browser rendering exactly
 */

// Use Node.js runtime for Puppeteer (required for file system access)
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    console.log('[Screenshot API] Request received');
    let body;
    try {
      body = await request.json();
    } catch (e) {
      console.error('[Screenshot API] Failed to parse JSON:', e);
      return NextResponse.json(
        { error: 'Invalid JSON in request body', details: e instanceof Error ? e.message : 'Unknown error' },
        { status: 400 }
      );
    }
    
    // Validate request body using Zod
    let validatedBody;
    try {
      validatedBody = validateRequestBody(screenshotRequestSchema, body);
    } catch (validationError) {
      console.error('[Screenshot API] Validation failed:', validationError);
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationError instanceof Error ? validationError.message : 'Invalid input'
        },
        { status: 400 }
      );
    }

    const { html, width, height } = validatedBody;

    console.log('[Screenshot API] HTML length:', html.length, 'Width:', width, 'Height:', height);

    // Dynamic import of puppeteer (only load when needed)
    let puppeteer;
    try {
      puppeteer = await import('puppeteer');
      console.log('[Screenshot API] Puppeteer imported successfully');
    } catch (importError) {
      console.error('[Screenshot API] Failed to import puppeteer:', importError);
      return NextResponse.json(
        { 
          error: 'Failed to load Puppeteer', 
          details: importError instanceof Error ? importError.message : 'Unknown error',
          hint: 'Make sure puppeteer is installed: npm install puppeteer'
        },
        { status: 500 }
      );
    }
    
    console.log('[Screenshot API] Launching Puppeteer...');
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      });
      console.log('[Screenshot API] Puppeteer launched successfully');
    } catch (launchError) {
      console.error('[Screenshot API] Failed to launch Puppeteer:', launchError);
      throw new Error(`Failed to launch browser: ${launchError instanceof Error ? launchError.message : 'Unknown error'}`);
    }

    try {
      console.log('[Screenshot API] Creating new page...');
      const page = await browser.newPage();
      
      // Set viewport to exact ShareCard dimensions with retina quality
      await page.setViewport({
        width: width,
        height: height,
        deviceScaleFactor: 2, // Retina quality
      });

      // Try to read the compiled Tailwind CSS
      let tailwindCss = '';
      try {
        // Try multiple possible paths for the CSS file
        const possiblePaths = [
          join(process.cwd(), '.next/static/css/app/layout.css'),
          join(process.cwd(), 'app/globals.css'),
        ];
        
        let cssLoaded = false;
        for (const cssPath of possiblePaths) {
          try {
            tailwindCss = readFileSync(cssPath, 'utf-8');
            console.log('[Screenshot API] Loaded CSS from:', cssPath);
            cssLoaded = true;
            break;
          } catch (e) {
            // Try next path
          }
        }
        
        if (!cssLoaded) {
          throw new Error('Could not find CSS file in any expected location');
        }
      } catch (e) {
        console.warn('[Screenshot API] Could not load Tailwind CSS, using fallback:', e);
        // Fallback: include basic Tailwind utilities that we know are used
        // Note: Tailwind arbitrary values need proper escaping
        tailwindCss = `
          .text-\\[\\#E6EDF6\\] { color: #E6EDF6 !important; }
          .text-\\[\\#8B949E\\] { color: #8B949E !important; }
          .text-\\[\\#00D26A\\] { color: #00D26A !important; }
          .text-\\[\\#FF4444\\] { color: #FF4444 !important; }
          .bg-\\[\\#0B0F14\\] { background-color: #0B0F14 !important; }
          .bg-\\[\\#00D26A\\]\\/20 { background-color: rgba(0, 210, 106, 0.2) !important; }
          .bg-\\[\\#FF4444\\]\\/20 { background-color: rgba(255, 68, 68, 0.2) !important; }
          .font-semibold { font-weight: 600; }
          .font-bold { font-weight: 700; }
          .relative { position: relative; }
          .flex { display: flex; }
          .items-center { align-items: center; }
          .justify-center { justify-content: center; }
          .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
          .py-0\\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
          .rounded { border-radius: 0.25rem; }
          .mb-0\\.5 { margin-bottom: 0.125rem; }
        `;
      }
      
      // Debug: log HTML and CSS info
      console.log('[Screenshot API] HTML length:', html.length);
      console.log('[Screenshot API] CSS length:', tailwindCss.length);

      // Create a complete HTML document with styles
      // Ensure the root element has proper dimensions
      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              html, body {
                width: ${width}px;
                height: ${height}px;
                overflow: hidden;
                background: #0B0F14;
                display: block;
              }
              body > * {
                width: ${width}px;
                height: ${height}px;
                display: block;
              }
              ${tailwindCss}
            </style>
          </head>
          <body>
            ${html}
          </body>
        </html>
      `;

      console.log('[Screenshot API] Setting page content...');
      console.log('[Screenshot API] HTML preview (first 1000 chars):', fullHtml.substring(0, 1000));
      console.log('[Screenshot API] HTML total length:', fullHtml.length);
      
      // Set the HTML content
      await page.setContent(fullHtml, {
        waitUntil: 'networkidle0', // Wait for all resources to load
      });
      
      // Verify content was loaded and check what's visible
      const pageInfo = await page.evaluate(() => {
        const body = document.body;
        const firstChild = body.firstElementChild;
        const computed = firstChild ? window.getComputedStyle(firstChild) : null;
        return {
          bodyHTML: body.innerHTML.substring(0, 500),
          bodyHTMLLength: body.innerHTML.length,
          firstChildTag: firstChild?.tagName,
          firstChildText: firstChild?.textContent?.substring(0, 100),
          firstChildDisplay: computed?.display,
          firstChildWidth: computed?.width,
          firstChildHeight: computed?.height,
          firstChildColor: computed?.color,
          firstChildBgColor: computed?.backgroundColor,
          visibleElements: Array.from(body.querySelectorAll('*')).filter(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0;
          }).length,
          totalElements: body.querySelectorAll('*').length,
        };
      });
      
      console.log('[Screenshot API] Page info after load:', JSON.stringify(pageInfo, null, 2));
      
      if (pageInfo.bodyHTMLLength < 100) {
        console.error('[Screenshot API] Body content is too short!', pageInfo.bodyHTML);
      }
      
      if (pageInfo.visibleElements === 0) {
        console.error('[Screenshot API] No visible elements found!');
      }
      
      if (pageInfo.firstChildWidth === '0px' || pageInfo.firstChildHeight === '0px') {
        console.error('[Screenshot API] First child has zero dimensions!', {
          width: pageInfo.firstChildWidth,
          height: pageInfo.firstChildHeight,
          display: pageInfo.firstChildDisplay
        });
      }

      console.log('[Screenshot API] Waiting for fonts...');
      // Wait for fonts to load
      await page.evaluateHandle(() => document.fonts.ready);

      console.log('[Screenshot API] Waiting for images...');
      // Wait a bit more for any images to load (using Promise instead of deprecated waitForTimeout)
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('[Screenshot API] Taking screenshot...');
      
      // Try to screenshot the body element directly
      const bodyElement = await page.$('body');
      let screenshot;
      
      if (bodyElement) {
        console.log('[Screenshot API] Taking screenshot of body element');
        screenshot = await bodyElement.screenshot({
          type: 'jpeg',
          quality: 90,
        });
      } else {
        console.log('[Screenshot API] Body element not found, using page screenshot with clip');
        // Fallback to page screenshot with clip
        screenshot = await page.screenshot({
          type: 'jpeg',
          quality: 90,
          clip: {
            x: 0,
            y: 0,
            width: width,
            height: height,
          },
        });
      }

      console.log('[Screenshot API] Screenshot taken, closing browser...');
      await browser.close();

      // Convert to base64 data URL
      const base64 = Buffer.from(screenshot).toString('base64');
      const dataUrl = `data:image/jpeg;base64,${base64}`;

      console.log('[Screenshot API] Success! Returning image URL');
      return NextResponse.json({ imageUrl: dataUrl });
    } catch (error) {
      console.error('[Screenshot API] Error during screenshot:', error);
      await browser.close();
      throw error;
    }
  } catch (error) {
    console.error('Error in /api/screenshot:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate screenshot', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
