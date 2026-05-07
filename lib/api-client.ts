import { PolymarketPublicProfile, PolymarketTrade, NormalizedTrade, MarketMetadata, PolymarketClosedPosition, ClosedPosition, PolymarketOpenPosition, OpenPosition, NegRiskActivity, NegRiskActivityType } from '@/types';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';
const DATA_API_BASE = 'https://data-api.polymarket.com';
const DATA_API_V1_BASE = 'https://data-api.polymarket.com/v1';

// Request timeout in milliseconds (30 seconds)
const REQUEST_TIMEOUT = 30000;

// Simple in-memory cache for proxy wallet resolution and market metadata
const proxyWalletCache: Map<string, string | null> = new Map();
const marketMetadataCache: Map<string, MarketMetadata> = new Map();
let hasLoggedMarketFields = false;

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Fetch username and profile details for a wallet.
 *
 * Primary path: Gamma `/public-profile?address=...` — the supported API that
 * already returns username + profileImage. Most lookups should resolve here.
 *
 * Fallback path (when the API has no record yet, e.g. fresh wallets):
 * scrape polymarket.com/@<address>. The scraping path is fragile and only
 * runs when the structured API doesn't carry the data we need.
 *
 * @param address - Wallet address (can be EOA or proxy wallet)
 */
export async function fetchPolymarketUsername(address: string): Promise<{
  address: string;
  username: string | null;
  displayName: string | null;
  profileUrl: string;
  bio: string | null;
  avatarUrl: string | null;
}> {
  const normalizedAddress = address.toLowerCase().trim();
  const profileUrl = `https://polymarket.com/@${normalizedAddress}`;

  // Primary path — Gamma public-profile API.
  try {
    const apiResponse = await fetchWithTimeout(
      `${GAMMA_API_BASE}/public-profile?address=${encodeURIComponent(normalizedAddress)}`,
      { headers: { 'Accept': 'application/json' } },
      8000
    );
    if (apiResponse.ok) {
      const data: PolymarketPublicProfile & Record<string, any> = await apiResponse.json();
      const username = data?.username || data?.displayName || data?.name || null;
      const avatarUrl = data?.profileImage || null;
      const displayName = data?.displayName || data?.name || null;
      const bio = data?.bio || null;
      if (username || avatarUrl || displayName || bio) {
        console.log(`[fetchPolymarketUsername] Resolved via Gamma /public-profile for ${normalizedAddress} (username=${username})`);
        return {
          address: normalizedAddress,
          username,
          displayName,
          profileUrl,
          bio,
          avatarUrl,
        };
      }
    }
  } catch (apiError) {
    console.log(`[fetchPolymarketUsername] Gamma /public-profile lookup failed for ${normalizedAddress}; falling back to scrape:`, apiError);
  }

  try {
    console.log(`[fetchPolymarketUsername] Falling back to HTML scrape for: ${normalizedAddress}`);
    
    const response = await fetchWithTimeout(
      profileUrl,
      {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      },
      15000
    );

    const html = await response.text();
    
    if (!response.ok) {
      console.log(`[fetchPolymarketUsername] Profile page returned ${response.status}, but attempting to parse HTML anyway`);
      // Continue to try parsing HTML even on error status - sometimes error pages still contain useful data
    }
    const finalUrl = response.url;

    let username: string | null = null;
    let displayName: string | null = null;
    let bio: string | null = null;
    let avatarUrl: string | null = null;

    // Method 1: Check if URL was redirected to a username profile
    const urlMatch = finalUrl.match(/polymarket\.com\/@([a-zA-Z0-9_-]+)/);
    if (urlMatch && urlMatch[1] && urlMatch[1].toLowerCase() !== normalizedAddress) {
      username = urlMatch[1];
      console.log(`[fetchPolymarketUsername] Found username from URL redirect: ${username}`);
    }

    // Method 2: Extract from meta tags (Open Graph)
    const ogTitleMatch = html.match(/property=["']og:title["']\s+content=["']([^"']+)["']/i);
    const ogDescMatch = html.match(/property=["']og:description["']\s+content=["']([^"']+)["']/i);
    const ogImageMatch = html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i);
    
    // Method 3: Extract from regular meta tags
    const metaDescMatch = html.match(/name=["']description["']\s+content=["']([^"']+)["']/i);
    const metaTitleMatch = html.match(/name=["']title["']\s+content=["']([^"']+)["']/i);
    
    // Method 4: Extract from page title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);

    // Parse title/og:title for username (format: "@username - Polymarket" or "@username on Polymarket")
    const titleText = ogTitleMatch?.[1] || metaTitleMatch?.[1] || titleMatch?.[1] || '';
    
    if (titleText) {
      // Try to extract @username from title
      const atUsernameMatch = titleText.match(/@([a-zA-Z0-9_-]+)/);
      if (atUsernameMatch && atUsernameMatch[1]) {
        if (!username) {
          username = atUsernameMatch[1];
          console.log(`[fetchPolymarketUsername] Found username from title: ${username}`);
        }
        
        // Extract display name (everything before the @ or before " - Polymarket")
        const displayNameMatch = titleText.match(/^([^@-]+?)(?:\s*[@-]|$)/);
        if (displayNameMatch && displayNameMatch[1].trim()) {
          displayName = displayNameMatch[1].trim();
        }
      } else if (titleText && !titleText.includes(normalizedAddress)) {
        // If title doesn't contain the address, it might be a display name
        displayName = titleText.replace(/\s*[-|]\s*Polymarket.*$/i, '').trim();
      }
    }

    // Parse description for bio
    const descText = ogDescMatch?.[1] || metaDescMatch?.[1] || '';
    if (descText && descText.length > 0 && !descText.toLowerCase().includes('polymarket')) {
      bio = descText;
    }

    // Method 5: Try to extract from Next.js data (if present in HTML)
    // Polymarket uses Next.js, which often includes JSON data in <script> tags
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
    if (nextDataMatch && nextDataMatch[1]) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        
        // Navigate through the Next.js data structure to find user info
        const pageProps = nextData?.props?.pageProps;
        const userData = pageProps?.user || pageProps?.profile || pageProps?.data?.user || pageProps?.account;
        
        // Also check buildId and other common locations
        const allPossiblePaths = [
          pageProps?.user,
          pageProps?.profile,
          pageProps?.data?.user,
          pageProps?.account,
          pageProps?.userProfile,
          nextData?.query?.user,
          nextData?.query?.profile,
        ].filter(Boolean);
        
        // Search through all possible user data objects
        for (const data of allPossiblePaths) {
          if (data && typeof data === 'object') {
            if (!username && data.username) {
              username = data.username;
              console.log(`[fetchPolymarketUsername] Found username from Next.js data: ${username}`);
            }
            if (!displayName && (data.displayName || data.name)) {
              displayName = data.displayName || data.name;
            }
            if (!bio && data.bio) {
              bio = data.bio;
            }
            // Look for avatar in various field names
            const possibleAvatarFields = [
              data.avatarUrl,
              data.avatar,
              data.image,
              data.profileImage,
              data.picture,
              data.profilePicture,
              data.photo,
              data.profilePhoto,
              data.avatarImage,
            ].filter(Boolean);
            
            if (possibleAvatarFields.length > 0 && !possibleAvatarFields[0].includes('/api/og')) {
              avatarUrl = possibleAvatarFields[0];
              console.log(`[fetchPolymarketUsername] Found avatar from Next.js data: ${avatarUrl}`);
              break;
            }
          }
        }
      } catch (parseError) {
        console.log(`[fetchPolymarketUsername] Failed to parse Next.js data:`, parseError);
      }
    }

    // Method 6: Look for profile image in HTML img tags (common patterns)
    // Look for images with profile/avatar related classes or attributes
    if (!avatarUrl || avatarUrl.includes('/api/og')) {
      // Try to find img tags with profile-related patterns
      const imgPatterns = [
        /<img[^>]*class="[^"]*avatar[^"]*"[^>]*src=["']([^"']+)["']/i,
        /<img[^>]*class="[^"]*profile[^"]*"[^>]*src=["']([^"']+)["']/i,
        /<img[^>]*src=["']([^"']*avatar[^"']*)["']/i,
        /<img[^>]*src=["']([^"']*profile[^"']*)["']/i,
        /<img[^>]*alt=["'][^"']*profile[^"']*["'][^>]*src=["']([^"']+)["']/i,
      ];
      
      for (const pattern of imgPatterns) {
        const match = html.match(pattern);
        if (match && match[1] && !match[1].includes('/api/og')) {
          // Make sure it's a valid image URL
          if (match[1].startsWith('http') || match[1].startsWith('/') || match[1].startsWith('data:')) {
            avatarUrl = match[1].startsWith('http') ? match[1] : `https://polymarket.com${match[1]}`;
            console.log(`[fetchPolymarketUsername] Found avatar from HTML img tag: ${avatarUrl}`);
            break;
          }
        }
      }
    }

    // Method 7: Try to construct profile picture URL from username
    // Polymarket might have a standard URL pattern for profile pictures
    if (!avatarUrl && username) {
      // Try common profile picture URL patterns
      const possibleUrls = [
        `https://polymarket.com/api/user/${username}/avatar`,
        `https://polymarket.com/api/users/${username}/avatar`,
        `https://polymarket.com/api/profile/${username}/avatar`,
        `https://polymarket.com/avatars/${username}.jpg`,
        `https://polymarket.com/avatars/${username}.png`,
        `https://polymarket-upload.s3.us-east-2.amazonaws.com/avatars/${username}.jpg`,
        `https://polymarket-upload.s3.us-east-2.amazonaws.com/avatars/${username}.png`,
      ];
      
      // We can't test all URLs here, so we'll skip this for now
      // and rely on the API or OG image
    }

    // Method 8: Try to fetch actual profile image from OG endpoint
    // The OG endpoint generates a composite image, but we can try to extract the profile picture
    // Or use a standard profile picture URL pattern if we have the username
    if (!avatarUrl && username) {
      // Try common Polymarket profile picture URL patterns
      const possibleProfileUrls = [
        `https://polymarket.com/api/user/${username}/avatar`,
        `https://polymarket.com/api/users/${username}/avatar`,
        `https://polymarket.com/api/profile/${username}/avatar`,
      ];
      
      // We can't test all URLs synchronously, so we'll skip direct URL construction
      // and rely on the API or OG image
    }

    // Method 9: For now, skip OG composite images
    // The OG API endpoint generates a full Open Graph card (1200x630), not just the profile picture
    // We'll rely on the API's profileImage field which should contain the actual profile picture URL
    // If the API doesn't provide it, we'll return null rather than showing the composite OG card
    if (!avatarUrl && ogImageMatch?.[1]) {
      const ogImageUrl = ogImageMatch[1].replace(/&amp;/g, '&');
      if (ogImageUrl.includes('/api/og')) {
        // This is a composite OG image card, not the actual profile picture
        // Skip it - the API should provide the actual profileImage field
        console.log(`[fetchPolymarketUsername] Skipping OG composite image (not actual profile picture)`);
        avatarUrl = null;
      } else {
        // Non-OG image URL, use it
        avatarUrl = ogImageUrl;
        console.log(`[fetchPolymarketUsername] Using OG image: ${avatarUrl}`);
      }
    }

    console.log(`[fetchPolymarketUsername] Results for ${normalizedAddress}:`, {
      username,
      displayName,
      hasBio: !!bio,
      hasAvatar: !!avatarUrl,
    });

    return {
      address: normalizedAddress,
      username,
      displayName,
      profileUrl: username ? `https://polymarket.com/@${username}` : profileUrl,
      bio,
      avatarUrl,
    };
  } catch (error) {
    console.error(`[fetchPolymarketUsername] Error fetching profile for ${normalizedAddress}:`, error);
    return {
      address: normalizedAddress,
      username: null,
      displayName: null,
      profileUrl,
      bio: null,
      avatarUrl: null,
    };
  }
}

/**
 * Fetch profile image for a user by username or wallet address
 * This handles the full flow: username -> wallet address -> profile image
 */
export async function fetchProfileImageByUsername(usernameOrAddress: string): Promise<string | null> {
  try {
    let walletAddress = usernameOrAddress.toLowerCase().trim();
    
    // If it doesn't look like a wallet address (0x...), treat it as username and fetch the page
    if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
      console.log(`[fetchProfileImage] "${usernameOrAddress}" doesn't look like a wallet address, fetching profile page...`);
      
      const profileUrl = `https://polymarket.com/@${usernameOrAddress}`;
      const pageResponse = await fetchWithTimeout(profileUrl, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      }, 15000);
      
      if (!pageResponse.ok) {
        console.error(`[fetchProfileImage] Profile page returned ${pageResponse.status}`);
        return null;
      }
      
      const html = await pageResponse.text();
      
      // Extract wallet address from Next.js data
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
      if (nextDataMatch && nextDataMatch[1]) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          const pageProps = nextData?.props?.pageProps;
          
          // Try various locations for the wallet address
          const possibleAddresses = [
            pageProps?.address,
            pageProps?.wallet,
            pageProps?.user?.address,
            pageProps?.user?.wallet,
            pageProps?.profile?.address,
            pageProps?.profile?.wallet,
            pageProps?.profile?.proxyWallet,
            pageProps?.account?.address,
            pageProps?.data?.address,
            pageProps?.data?.wallet,
          ].filter(Boolean);
          
          if (possibleAddresses.length > 0) {
            walletAddress = possibleAddresses[0].toLowerCase();
            console.log(`[fetchProfileImage] Found wallet address from page: ${walletAddress}`);
          } else {
            console.error(`[fetchProfileImage] Could not find wallet address in Next.js data`);
            console.log(`[fetchProfileImage] Available pageProps keys:`, Object.keys(pageProps || {}));
            return null;
          }
        } catch (parseError) {
          console.error(`[fetchProfileImage] Failed to parse Next.js data:`, parseError);
          return null;
        }
      } else {
        console.error(`[fetchProfileImage] Could not find Next.js data in page`);
        return null;
      }
    }
    
    // Now fetch the profile image from API using wallet address
    console.log(`[fetchProfileImage] Fetching profile image for wallet: ${walletAddress}`);
    const apiUrl = `${GAMMA_API_BASE}/public-profile?address=${walletAddress}`;
    
    const apiResponse = await fetchWithTimeout(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    }, 10000);
    
    if (!apiResponse.ok) {
      console.error(`[fetchProfileImage] API returned ${apiResponse.status}`);
      return null;
    }
    
    const profileData = await apiResponse.json();
    const profileImage = profileData.profileImage || null;
    
    if (profileImage) {
      console.log(`[fetchProfileImage] Found profile image: ${profileImage}`);
    } else {
      console.log(`[fetchProfileImage] No profile image in API response`);
      console.log(`[fetchProfileImage] API response keys:`, Object.keys(profileData));
    }
    
    return profileImage;
    
  } catch (error) {
    console.error(`[fetchProfileImage] Error:`, error);
    return null;
  }
}

/**
 * Resolve username to wallet address
 * @param usernameOrAddress - Username (e.g., "username") or wallet address
 * @returns Wallet address if username is resolved, or original input if it's already a wallet
 */
export async function resolveUsernameToWallet(usernameOrAddress: string): Promise<{
  input: string;
  walletAddress: string | null;
  isUsername: boolean;
}> {
  const input = usernameOrAddress.trim();
  
  // Check if it's already a wallet address (starts with 0x and is 42 chars)
  if (input.startsWith('0x') && input.length === 42) {
    return {
      input,
      walletAddress: input.toLowerCase(),
      isUsername: false,
    };
  }
  
  // Treat as username - fetch profile page to get wallet address
  try {
    console.log(`[resolveUsernameToWallet] Resolving username: ${input}`);
    const profileUrl = `https://polymarket.com/@${input}`;
    const pageResponse = await fetchWithTimeout(profileUrl, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    }, 15000);
    
    if (!pageResponse.ok) {
      console.error(`[resolveUsernameToWallet] Profile page returned ${pageResponse.status}`);
      return {
        input,
        walletAddress: null,
        isUsername: true,
      };
    }
    
    const html = await pageResponse.text();
    
    // Extract wallet address from Next.js data
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
    if (nextDataMatch && nextDataMatch[1]) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const pageProps = nextData?.props?.pageProps;
        
        // Try various locations for the wallet address
        // Polymarket profile pages use: proxyAddress, baseAddress, primaryAddress
        const possibleAddresses = [
          pageProps?.proxyAddress,
          pageProps?.baseAddress,
          pageProps?.primaryAddress,
          pageProps?.address,
          pageProps?.wallet,
          pageProps?.user?.address,
          pageProps?.user?.wallet,
          pageProps?.profile?.address,
          pageProps?.profile?.wallet,
          pageProps?.profile?.proxyWallet,
          pageProps?.account?.address,
          pageProps?.data?.address,
          pageProps?.data?.wallet,
          nextData?.query?.address,
          nextData?.query?.wallet,
        ].filter(Boolean);
        
        if (possibleAddresses.length > 0) {
          const walletAddress = possibleAddresses[0].toLowerCase();
          console.log(`[resolveUsernameToWallet] Resolved username "${input}" to wallet: ${walletAddress}`);
          return {
            input,
            walletAddress,
            isUsername: true,
          };
        } else {
          console.error(`[resolveUsernameToWallet] Could not find wallet address in Next.js data`);
          return {
            input,
            walletAddress: null,
            isUsername: true,
          };
        }
      } catch (parseError) {
        console.error(`[resolveUsernameToWallet] Failed to parse Next.js data:`, parseError);
        return {
          input,
          walletAddress: null,
          isUsername: true,
        };
      }
    } else {
      console.error(`[resolveUsernameToWallet] Could not find Next.js data in page`);
      return {
        input,
        walletAddress: null,
        isUsername: true,
      };
    }
  } catch (error) {
    console.error(`[resolveUsernameToWallet] Error:`, error);
    return {
      input,
      walletAddress: null,
      isUsername: true,
    };
  }
}

/**
 * Resolve proxy wallet for a given wallet address
 */
export async function resolveProxyWallet(wallet: string): Promise<{
  inputWallet: string;
  userAddressUsed: string;
  proxyWalletFound: boolean;
  proxyWallet?: string;
  username?: string | null;
  profileImage?: string | null;
}> {
  const normalizedWallet = wallet.toLowerCase().trim();

  // Don't use cache - always fetch fresh profileImage from API

  // First, check if the input address already has closed positions
  // If it does, it's already a proxy wallet, use it directly
  try {
    const checkResponse = await fetchWithTimeout(
      `${DATA_API_V1_BASE}/closed-positions?user=${encodeURIComponent(normalizedWallet)}&limit=1`,
      {
        headers: {
          'Accept': 'application/json',
        },
      },
      10000
    );

    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      const positions = Array.isArray(checkData) ? checkData : [];
      
      if (positions.length > 0) {
        // Input address has closed positions, it's already a proxy wallet
        console.log(`[API] Input address already has closed positions, treating as proxy wallet: ${normalizedWallet}`);
        proxyWalletCache.set(normalizedWallet, null); // Cache that it's already a proxy
        const profileData = await fetchPolymarketUsername(normalizedWallet);
        const profileImage = await fetchProfileImageByUsername(normalizedWallet); // Fetch profile image from API
        return {
          inputWallet: wallet,
          userAddressUsed: normalizedWallet,
          proxyWalletFound: false, // Not "found" because it was already the proxy
          username: profileData.username,
          profileImage: profileImage,
        };
      }
    }
  } catch (checkError) {
    // Continue with normal resolution if check fails
    console.log(`[API] Check for existing proxy wallet failed, continuing with resolution...`);
  }

  try {
    console.log(`[API] Resolving proxy wallet for: ${normalizedWallet}`);
    // According to Polymarket docs: https://docs.polymarket.com/api-reference/profiles/get-public-profile-by-wallet-address
    // The endpoint uses 'address' parameter and returns 'profileImage' field
    const response = await fetchWithTimeout(
      `${GAMMA_API_BASE}/public-profile?address=${encodeURIComponent(normalizedWallet)}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      },
      10000 // 10 second timeout for proxy wallet resolution
    );

    // Extract profileImage from API response - parse response body first, regardless of status
    let profileImageFromResponse: string | null = null;
    let responseData: any = null;
    
    console.log(`[resolveProxyWallet] API call status: ${response.status} ${response.statusText}`);
    console.log(`[resolveProxyWallet] response.ok:`, response.ok);
    
    try {
      const responseText = await response.text();
      console.log(`[resolveProxyWallet] Response text length:`, responseText.length);
      console.log(`[resolveProxyWallet] Response text preview (first 200 chars):`, responseText.substring(0, 200));
      
      try {
        responseData = JSON.parse(responseText);
        console.log(`[resolveProxyWallet] Successfully parsed JSON`);
        console.log(`[resolveProxyWallet] Response keys:`, Object.keys(responseData));
        console.log(`[resolveProxyWallet] responseData.profileImage:`, responseData.profileImage);
        console.log(`[resolveProxyWallet] Full responseData:`, JSON.stringify(responseData, null, 2));
        // Directly extract profileImage from API response
        profileImageFromResponse = responseData.profileImage ?? null;
        console.log(`[resolveProxyWallet] Extracted profileImageFromResponse:`, profileImageFromResponse);
      } catch (parseError) {
        console.error(`[resolveProxyWallet] Failed to parse JSON:`, parseError);
        responseData = { error: responseText };
      }
    } catch (readError) {
      console.error(`[resolveProxyWallet] Failed to read response text:`, readError);
      responseData = { error: response.statusText };
    }

    if (!response.ok) {
      const errorData = responseData || { error: response.statusText };
      
      // 422 (Invalid address) or 404 (Not found) are expected for some wallets
      // Try alternative method: fetch a trade to get proxyWallet from the trade data
      if (response.status === 422 || response.status === 404) {
        console.log(`[API] Proxy wallet API returned ${response.status}, trying alternative method via trades API...`);
        
        try {
          // Try to get proxy wallet from closed-positions API - it includes proxyWallet in response
          const positionsResponse = await fetchWithTimeout(
            `${DATA_API_V1_BASE}/closed-positions?user=${encodeURIComponent(normalizedWallet)}&limit=1`,
            {
              headers: {
                'Accept': 'application/json',
              },
            },
            10000
          );

          if (positionsResponse.ok) {
            const positionsData = await positionsResponse.json();
            const positions = Array.isArray(positionsData) ? positionsData : [];
            
            if (positions.length > 0 && positions[0].proxyWallet) {
              const proxyWallet = positions[0].proxyWallet.toLowerCase();
              // Only use it if it's different from input (meaning it's actually a proxy)
              if (proxyWallet !== normalizedWallet) {
                console.log(`[API] Found proxy wallet via closed-positions API: ${proxyWallet}`);
                proxyWalletCache.set(normalizedWallet, proxyWallet);
                const profileData = await fetchPolymarketUsername(proxyWallet);
                return {
                  inputWallet: wallet,
                  userAddressUsed: proxyWallet,
                  proxyWalletFound: true,
                  proxyWallet: proxyWallet,
                  username: profileData.username,
                  profileImage: profileImageFromResponse || null,
                };
              }
            }
            
            // If positions exist but proxyWallet matches input, input might already be the proxy
            if (positions.length > 0) {
              console.log(`[API] Input wallet has closed positions, using as-is (may already be proxy wallet)`);
              proxyWalletCache.set(normalizedWallet, null);
              const profileData = await fetchPolymarketUsername(normalizedWallet);
              return {
                inputWallet: wallet,
                userAddressUsed: normalizedWallet,
                proxyWalletFound: false,
                username: profileData.username,
                profileImage: profileImageFromResponse || null,
              };
            }
          }
          
          // If closed-positions with EOA returns empty, try finding proxy wallets from trades
          // and check which one has closed positions (this is the actual user's proxy wallet)
          console.log(`[API] Closed-positions API returned empty for EOA, trying to find proxy via trades...`);
          
          // Also try trades API as fallback - collect all proxy wallets and prioritize most recent
          const tradesResponse = await fetchWithTimeout(
            `${DATA_API_BASE}/trades?maker=${encodeURIComponent(normalizedWallet)}&limit=100`,
            {
              headers: {
                'Accept': 'application/json',
              },
            },
            10000
          );

          if (tradesResponse.ok) {
            const tradesData = await tradesResponse.json();
            const trades = Array.isArray(tradesData) ? tradesData : (tradesData.trades || tradesData.data || []);
            
            if (trades.length > 0) {
              // Sort trades by timestamp (most recent first)
              const sortedTrades = [...trades].sort((a, b) => {
                const timeA = a.timestamp || a.createdAt || 0;
                const timeB = b.timestamp || b.createdAt || 0;
                return timeB - timeA; // Descending order
              });
              
              // Collect all proxy wallets from trades with their counts and most recent timestamp
              const proxyWalletInfo = new Map<string, { count: number; mostRecentTime: number }>();
              for (const trade of sortedTrades) {
                if (trade.proxyWallet) {
                  const pw = trade.proxyWallet.toLowerCase();
                  if (pw !== normalizedWallet) {
                    const tradeTime = trade.timestamp || trade.createdAt || 0;
                    if (!proxyWalletInfo.has(pw)) {
                      proxyWalletInfo.set(pw, { count: 0, mostRecentTime: tradeTime });
                    }
                    const info = proxyWalletInfo.get(pw)!;
                    info.count += 1;
                    if (tradeTime > info.mostRecentTime) {
                      info.mostRecentTime = tradeTime;
                    }
                  }
                }
              }
              
              if (proxyWalletInfo.size > 0) {
                // Check which proxy wallet has the most closed positions
                // This is the most reliable indicator of the active proxy wallet
                let bestProxy = '';
                let maxClosedPositions = -1;
                
                const proxyList = Array.from(proxyWalletInfo.keys());
                for (const pw of proxyList) {
                  try {
                    const verifyResponse = await fetchWithTimeout(
                      `${DATA_API_V1_BASE}/closed-positions?user=${encodeURIComponent(pw)}&limit=1000`,
                      {
                        headers: {
                          'Accept': 'application/json',
                        },
                      },
                      10000
                    );
                    
                    if (verifyResponse.ok) {
                      const verifyData = await verifyResponse.json();
                      const positionsCount = Array.isArray(verifyData) ? verifyData.length : 0;
                      if (positionsCount > maxClosedPositions) {
                        maxClosedPositions = positionsCount;
                        bestProxy = pw;
                      }
                    }
                  } catch (verifyError) {
                    // Skip this proxy if verification fails
                    continue;
                  }
                }
                
                if (bestProxy && maxClosedPositions > 0) {
                  // Found a proxy wallet with closed positions, use it
                  const info = proxyWalletInfo.get(bestProxy)!;
                  console.log(`[API] Found proxy wallet via trades API and verified with closed-positions: ${bestProxy} (${maxClosedPositions} closed positions, ${info.count} trades)`);
                  proxyWalletCache.set(normalizedWallet, bestProxy);
                  const profileData = await fetchPolymarketUsername(bestProxy);
                  return {
                    inputWallet: wallet,
                    userAddressUsed: bestProxy,
                    proxyWalletFound: true,
                    proxyWallet: bestProxy,
                    username: profileData.username,
                    profileImage: profileImageFromResponse || null,
                  };
                }
                
                // Fallback: prioritize proxy wallet from most recent trades, then by count
                let bestProxyByRecency = '';
                let bestScore = -1;
                for (const [pw, info] of proxyWalletInfo.entries()) {
                  // Score: most recent time (prioritize recent activity) * 1000 + count
                  const score = info.mostRecentTime * 1000 + info.count;
                  if (score > bestScore) {
                    bestScore = score;
                    bestProxyByRecency = pw;
                  }
                }
                
                if (bestProxyByRecency) {
                  const info = proxyWalletInfo.get(bestProxyByRecency)!;
                  console.log(`[API] Found proxy wallet via trades API (fallback to recency): ${bestProxyByRecency} (${info.count} trades, most recent: ${new Date(info.mostRecentTime * 1000).toISOString()})`);
                  proxyWalletCache.set(normalizedWallet, bestProxyByRecency);
                  const profileData = await fetchPolymarketUsername(bestProxyByRecency);
                  return {
                    inputWallet: wallet,
                    userAddressUsed: bestProxyByRecency,
                    proxyWalletFound: true,
                    proxyWallet: bestProxyByRecency,
                    username: profileData.username,
                    profileImage: profileImageFromResponse || null,
                  };
                }
              }
            }
          }
        } catch (apiError) {
          console.log(`[API] Alternative proxy wallet resolution failed:`, apiError);
        }

        // If alternative method also failed, fall back to using input wallet directly
        console.log(`[API] Could not resolve proxy wallet, using input wallet directly`);
        proxyWalletCache.set(normalizedWallet, null);
        const profileData = await fetchPolymarketUsername(normalizedWallet);
        return {
          inputWallet: wallet,
          userAddressUsed: normalizedWallet,
          proxyWalletFound: false,
          username: profileData.username,
          profileImage: profileImageFromResponse || null,
        };
      }
      
      console.error(`[API] Proxy wallet fetch failed: ${response.status} ${JSON.stringify(errorData)}`);
      // For other errors, still fall back to input wallet rather than throwing
      proxyWalletCache.set(normalizedWallet, null);
      const profileData = await fetchPolymarketUsername(normalizedWallet);
      return {
        inputWallet: wallet,
        userAddressUsed: normalizedWallet,
        proxyWalletFound: false,
        username: profileData.username,
        profileImage: profileImageFromResponse || null,
      };
    }

    // Success - API returned 200 OK, use already parsed response data
    const data: any = responseData;
    
    // Extract profileImage directly from API response - the API clearly returns it
    // The API returns: {"profileImage":"https://...", "name":"jayowtrades", ...}
    // So data.profileImage should be there
    const profileImage = data?.profileImage ?? profileImageFromResponse ?? null;
    
    // CRITICAL: If profileImage is null, log everything to debug
    if (!profileImage) {
      console.error(`[resolveProxyWallet] CRITICAL ERROR: profileImage is null!`);
      console.error(`[resolveProxyWallet] response.ok:`, response.ok);
      console.error(`[resolveProxyWallet] response.status:`, response.status);
      console.error(`[resolveProxyWallet] data exists:`, !!data);
      console.error(`[resolveProxyWallet] data.profileImage:`, data?.profileImage);
      console.error(`[resolveProxyWallet] profileImageFromResponse:`, profileImageFromResponse);
      console.error(`[resolveProxyWallet] Full data object:`, JSON.stringify(data, null, 2));
    }
    console.log(`[resolveProxyWallet] Success path - data.profileImage:`, data?.profileImage);
    console.log(`[resolveProxyWallet] Success path - profileImageFromResponse:`, profileImageFromResponse);
    console.log(`[resolveProxyWallet] Success path - final profileImage:`, profileImage);
    const username = data.name || data.pseudonym || null;
    const proxyWallet = data.proxyWallet?.toLowerCase() || null;
    
    proxyWalletCache.set(normalizedWallet, proxyWallet);
    const userAddress = proxyWallet || normalizedWallet;
    
    let htmlUsername = null;
    if (!username) {
      const profileData = await fetchPolymarketUsername(userAddress);
      htmlUsername = profileData.username;
    }

    console.log(`[resolveProxyWallet] Final return - profileImage:`, profileImage);
    return {
      inputWallet: wallet,
      userAddressUsed: userAddress,
      proxyWalletFound: !!proxyWallet,
      proxyWallet: proxyWallet || undefined,
      username: username || htmlUsername,
      profileImage: profileImage,
    };
  } catch (error) {
    console.error('Error resolving proxy wallet:', error);
    // Fallback to input wallet on error
    proxyWalletCache.set(normalizedWallet, null);
    const profileData = await fetchPolymarketUsername(normalizedWallet);
    return {
      inputWallet: wallet,
      userAddressUsed: normalizedWallet,
      proxyWalletFound: false,
      username: profileData.username,
      profileImage: null,
    };
  }
}

/**
 * Updated resolveProxyWallet function that uses the enhanced username fetching
 */
export async function resolveProxyWalletWithUsername(wallet: string): Promise<{
  inputWallet: string;
  userAddressUsed: string;
  proxyWalletFound: boolean;
  proxyWallet?: string;
  username?: string | null;
  displayName?: string | null;
  profileUrl?: string;
  bio?: string | null;
  profileImage?: string | null;
}> {
  // First, resolve the proxy wallet using existing logic
  const proxyResult = await resolveProxyWallet(wallet);
  
  // Then fetch username for the final address
  const addressToFetch = proxyResult.userAddressUsed;
  const profileData = await fetchPolymarketUsername(addressToFetch);
  
  return {
    ...proxyResult,
    username: profileData.username,
    displayName: profileData.displayName,
    profileUrl: profileData.profileUrl,
    bio: profileData.bio,
    profileImage: proxyResult.profileImage,
  };
}

/**
 * Fetch ALL activity for a wallet, walking the same date-window strategy as
 * fetchAllTrades to escape the 1000-offset cap. Used by the cash-flow ledger
 * to get a complete history (TRADE + SPLIT + MERGE + REDEEM + CONVERSION +
 * REWARD + MAKER_REBATE + REFERRAL_REWARD).
 */
export async function fetchAllUserActivity(
  userAddress: string,
  options: {
    type?: string[];
    side?: 'BUY' | 'SELL';
  } = {}
): Promise<Array<{ timestamp: number; conditionId: string; type: string; [key: string]: any }>> {
  const all: any[] = [];
  const seenHashes = new Set<string>();
  let endTimestampMs: number | undefined = undefined;

  for (let windowIdx = 0; windowIdx < MAX_TRADE_WINDOWS; windowIdx++) {
    const window = await fetchUserActivity(userAddress, {
      type: options.type,
      side: options.side,
      sortBy: 'TIMESTAMP',
      sortDirection: 'DESC',
      limit: TRADES_WINDOW_CAP,
      // Pass end as a Unix-seconds string; activity API accepts numeric
      // end/start filters when present, otherwise ignores them silently.
      end: endTimestampMs != null ? Math.floor(endTimestampMs / 1000) : undefined,
    });

    if (window.length === 0) break;

    let newCount = 0;
    let earliestMs = Number.POSITIVE_INFINITY;
    for (const a of window) {
      // Dedup by transactionHash + type + asset (best signal we have).
      const key = `${a.transactionHash || ''}:${a.type}:${a.asset || ''}:${a.timestamp}`;
      if (seenHashes.has(key)) continue;
      seenHashes.add(key);
      all.push(a);
      newCount++;
      const tsMs = typeof a.timestamp === 'number'
        ? (a.timestamp < 1e12 ? a.timestamp * 1000 : a.timestamp)
        : new Date(a.timestamp).getTime();
      if (Number.isFinite(tsMs) && tsMs < earliestMs) earliestMs = tsMs;
    }

    // Cap not hit -> no more older history to fetch.
    if (window.length < TRADES_WINDOW_CAP) break;
    if (newCount === 0) break;
    if (!Number.isFinite(earliestMs)) break;

    // Step end cursor 1s past the earliest record so we don't refetch it.
    endTimestampMs = earliestMs - 1000;
    console.log(`[API] Activity window ${windowIdx + 1} saturated (${window.length}); walking back to end=${endTimestampMs}`);
  }

  // Sort ascending by timestamp for downstream replay.
  all.sort((a, b) => {
    const ta = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime() / 1000;
    const tb = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime() / 1000;
    return ta - tb;
  });

  console.log(`[API] Total activity fetched: ${all.length}`);
  return all;
}

export async function fetchUserActivity(
  userAddress: string,
  options: {
    type?: string[];
    side?: 'BUY' | 'SELL';
    sortBy?: 'TIMESTAMP' | 'TOKENS' | 'CASH';
    sortDirection?: 'ASC' | 'DESC';
    limit?: number;
    end?: number;   // Unix seconds
    start?: number; // Unix seconds
  } = {}
): Promise<Array<{
  timestamp: number;
  conditionId: string;
  outcome: string;
  outcomeIndex?: number;
  side?: 'BUY' | 'SELL';
  type: string;
  [key: string]: any;
}>> {
  const allActivities: any[] = [];
  let offset = 0;
  const pageSize = Math.min(options.limit || 100, 500); // API max is 500
  // Polymarket API hard caps offset at 1000 (Aug 26, 2025 changelog).
  // With pageSize=500, that means at most 3 calls (offsets 0, 500, 1000) ~ 1500 records.
  const maxOffset = 1000;

  console.log(`[API] Fetching user activity for: ${userAddress}`, options);

  while (offset <= maxOffset && (!options.limit || allActivities.length < options.limit)) {
    try {
      const params = new URLSearchParams({
        user: userAddress.toLowerCase(),
        limit: pageSize.toString(),
        offset: offset.toString(),
        sortBy: options.sortBy || 'TIMESTAMP',
        sortDirection: options.sortDirection || 'ASC',
      });

      // Only add type filter if provided and not empty
      // If no type filter, API should return all activity types
      if (options.type && options.type.length > 0) {
        options.type.forEach(t => params.append('type', t));
      }
      // If no type specified, don't add type parameter - fetch all types

      if (options.side) {
        params.append('side', options.side);
      }

      if (typeof options.end === 'number' && Number.isFinite(options.end)) {
        params.append('end', options.end.toString());
      }
      if (typeof options.start === 'number' && Number.isFinite(options.start)) {
        params.append('start', options.start.toString());
      }

      console.log(`[API] Fetching activity offset ${offset} for user: ${userAddress}`);
      
      const response = await fetchWithTimeout(
        `${DATA_API_BASE}/activity?${params.toString()}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        },
        15000 // 15 second timeout per page
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error(`[API] Activity fetch failed (offset ${offset}): ${response.status} ${errorText}`);
        
        // If we have some activities, return them; otherwise throw
        if (allActivities.length === 0) {
          throw new Error(`Failed to fetch user activity: ${response.status} ${errorText}`);
        }
        break;
      }

      const data: any[] = await response.json();
      console.log(`[API] Found ${data.length} activities at offset ${offset}`);

      if (!Array.isArray(data) || data.length === 0) {
        break;
      }

      // Add activities to result
      for (const activity of data) {
        allActivities.push(activity);
      }

      // If we got fewer than pageSize, we've reached the end
      if (data.length < pageSize) {
        break;
      }

      offset += pageSize;

      // Check if we've reached the limit
      if (options.limit && allActivities.length >= options.limit) {
        break;
      }

      // If next iteration would exceed the API offset cap, log and stop.
      if (offset > maxOffset) {
        console.warn(`[API] Hit Polymarket /activity offset cap (${maxOffset}); stopping after ${allActivities.length} records. To fetch older activity, narrow the query.`);
        break;
      }
    } catch (error) {
      console.error(`[API] Error fetching activity at offset ${offset}:`, error);
      if (allActivities.length === 0) {
        throw error;
      }
      break;
    }
  }

  console.log(`[API] Total activities fetched: ${allActivities.length}`);
  return allActivities;
}
/**
 * Polymarket caps a single /trades query at 1500 records (limit=500 * 3 pages).
 * For active wallets we walk further back in time using the `end` cursor.
 */
const TRADES_WINDOW_CAP = 1500;
const MAX_TRADE_WINDOWS = 10; // up to ~15,000 trades

async function fetchTradesWindow(
  userAddress: string,
  startDate?: string,
  endDate?: string
): Promise<PolymarketTrade[]> {
  const allTrades: PolymarketTrade[] = [];
  let page = 1;
  // Polymarket /trades caps limit at 500 and offset at 1000 (Aug 26, 2025 changelog).
  // pageSize 500 + maxPages 3 keeps us within both caps (offsets 0, 500, 1000) ~ 1500 trades.
  const pageSize = 500;
  const maxPages = 3;
  const seenIds = new Set<string>();
  let useMakerParam = false; // Track which parameter format works
  let consecutiveEmptyPages = 0; // Track consecutive pages with no new trades

  while (page <= maxPages) {
    try {
      let params: URLSearchParams;
      
      if (useMakerParam) {
        // Use maker parameter with offset-based pagination
        const offset = (page - 1) * pageSize;
        params = new URLSearchParams({
          maker: userAddress.toLowerCase(),
          limit: pageSize.toString(),
          offset: offset.toString(),
        });
      } else {
        // Try 'user' parameter first with page-based pagination
        params = new URLSearchParams({
          user: userAddress.toLowerCase(),
          page: page.toString(),
          pageSize: pageSize.toString(),
        });

        if (startDate) {
          params.append('start', startDate);
        }
        if (endDate) {
          params.append('end', endDate);
        }
      }

      console.log(`[API] Fetching trades page ${page} for user: ${userAddress} (using ${useMakerParam ? 'maker' : 'user'} param)`);
      
      // Use shorter timeout per page to avoid getting stuck (15 seconds per page)
      const pageTimeout = 15000;
      
      let response = await fetchWithTimeout(
        `${DATA_API_BASE}/trades?${params.toString()}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        },
        pageTimeout
      );

      // If 'user' parameter doesn't work on first page, try 'maker' parameter
      if (!response.ok && page === 1 && !useMakerParam) {
        console.log(`[API] 'user' parameter failed (${response.status}), trying 'maker' parameter...`);
        useMakerParam = true;
        const offset = 0;
        params = new URLSearchParams({
          maker: userAddress.toLowerCase(),
          limit: pageSize.toString(),
          offset: offset.toString(),
        });
        response = await fetchWithTimeout(
          `${DATA_API_BASE}/trades?${params.toString()}`,
          {
            headers: {
              'Accept': 'application/json',
            },
          },
          pageTimeout
        );
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error(`[API] Trades fetch failed (page ${page}): ${response.status} ${errorText}`);
        throw new Error(`Failed to fetch trades: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log(`[API] Trades page ${page} response type:`, Array.isArray(data) ? 'array' : typeof data, 'keys:', Object.keys(data || {}));
      
      // Handle different possible response formats
      let trades: PolymarketTrade[] = [];
      
      if (Array.isArray(data)) {
        trades = data;
      } else if (data.trades && Array.isArray(data.trades)) {
        trades = data.trades;
      } else if (data.data && Array.isArray(data.data)) {
        trades = data.data;
      } else if (data.results && Array.isArray(data.results)) {
        trades = data.results;
      } else {
        // Log unexpected response format for debugging
        console.warn(`[API] Unexpected trades response format on page ${page}:`, {
          type: typeof data,
          keys: Object.keys(data || {}),
          sample: JSON.stringify(data).substring(0, 200),
        });
      }

      console.log(`[API] Found ${trades.length} trades on page ${page}`);

      if (trades.length === 0) {
        console.log(`[API] No more trades found, stopping pagination`);
        break;
      }

      // Deduplicate and add trades
      let newTradesCount = 0;
      for (const trade of trades) {
        const tradeId = trade.id || trade.hash || `${trade.timestamp}-${trade.user}-${trade.size}`;
        if (!seenIds.has(tradeId)) {
          seenIds.add(tradeId);
          allTrades.push(trade);
          newTradesCount++;
        }
      }

      console.log(`[API] Added ${newTradesCount} new trades (${trades.length - newTradesCount} duplicates)`);

      // Safety check: If all trades were duplicates, we might be stuck in a loop
      if (newTradesCount === 0 && trades.length > 0) {
        console.log(`[API] All trades on page ${page} were duplicates, stopping pagination`);
        break;
      }

      // Check if there are more pages
      if (trades.length < pageSize) {
        console.log(`[API] Got less than pageSize (${trades.length} < ${pageSize}), stopping pagination`);
        break;
      }

      // Safety check: If we've reached max pages (Polymarket /trades offset cap)
      if (page >= maxPages) {
        console.warn(`[API] Hit Polymarket /trades offset cap after ${allTrades.length} trades. To fetch older trades, narrow the date range.`);
        break;
      }

      page++;
    } catch (error) {
      console.error(`Error fetching trades page ${page}:`, error);
      // Don't break on error if we have some trades - return what we have
      if (allTrades.length === 0) {
        throw error; // If we have no trades at all, throw the error
      }
      console.log(`[API] Error on page ${page}, returning ${allTrades.length} trades collected so far`);
      break;
    }
  }

  console.log(`[API] Completed fetching trades window: ${allTrades.length} trades from ${page - 1} pages`);

  // Sort by timestamp ascending
  allTrades.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return allTrades;
}

/**
 * Fetch all trades for a wallet, walking the API's offset-capped windows by
 * stepping the `end` cursor backward when a window saturates. Each window
 * yields up to TRADES_WINDOW_CAP records (1500); we walk up to MAX_TRADE_WINDOWS
 * of them.
 */
export async function fetchAllTrades(
  userAddress: string,
  startDate?: string,
  endDate?: string
): Promise<PolymarketTrade[]> {
  const allTrades: PolymarketTrade[] = [];
  const seenIds = new Set<string>();
  let currentEnd = endDate;
  const startMs = startDate ? new Date(startDate).getTime() : -Infinity;

  for (let windowIdx = 0; windowIdx < MAX_TRADE_WINDOWS; windowIdx++) {
    const windowTrades = await fetchTradesWindow(userAddress, startDate, currentEnd);
    if (windowTrades.length === 0) break;

    let newCount = 0;
    let earliestMs = Number.POSITIVE_INFINITY;
    for (const trade of windowTrades) {
      const id = trade.id || trade.hash || `${trade.timestamp}-${trade.user}-${trade.size}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        allTrades.push(trade);
        newCount++;
      }
      const ts = new Date(trade.timestamp).getTime();
      if (Number.isFinite(ts) && ts < earliestMs) earliestMs = ts;
    }

    // If the window didn't fill, there's nothing older — done.
    if (windowTrades.length < TRADES_WINDOW_CAP) break;
    // If everything we got was a duplicate of the previous window, the
    // boundary cursor isn't advancing — stop to avoid an infinite loop.
    if (newCount === 0) break;
    if (!Number.isFinite(earliestMs)) break;

    // Step `end` back by 1 second past the earliest record to avoid refetching
    // the boundary trade. The +/-1s slop is fine because /trades dedupes by id.
    const nextEndMs = earliestMs - 1000;
    if (nextEndMs <= startMs) break;
    currentEnd = new Date(nextEndMs).toISOString();
    console.log(`[API] Trade window ${windowIdx + 1} saturated (${windowTrades.length}); walking back to end=${currentEnd}`);
  }

  // Re-sort the merged set since concatenated windows may interleave.
  allTrades.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  console.log(`[API] Completed fetching trades: ${allTrades.length} total across ${MAX_TRADE_WINDOWS} max windows`);
  return allTrades;
}

export function normalizeTrade(trade: PolymarketTrade, userAddress: string): NormalizedTrade {
  // Extract conditionId from various possible fields
  const conditionId = trade.conditionId || 
                     trade.condition_id || 
                     trade.market?.conditionId ||
                     trade.tokenId?.split(':')[0] ||
                     'unknown';

  // Extract outcome from various possible fields
  const outcome = trade.outcome || 
                 trade.tokenId?.split(':')[1] ||
                 trade.asset?.outcome ||
                 '0';

  // Extract price and size
  const price = typeof trade.price === 'number' ? trade.price : parseFloat(String(trade.price || '0'));
  const size = typeof trade.size === 'number' ? trade.size : parseFloat(String(trade.size || '0'));

  // Calculate notional
  const notional = price * size;

  // Extract fees
  const fees = typeof trade.fees === 'number' ? trade.fees : parseFloat(String(trade.fees || '0'));

  // Determine side
  const side: 'BUY' | 'SELL' = trade.side?.toUpperCase() === 'SELL' ? 'SELL' : 'BUY';

  // Get trade ID
  const trade_id = trade.id || trade.hash || `${trade.timestamp}-${userAddress}-${size}`;

  return {
    trade_id,
    timestamp: trade.timestamp,
    user: userAddress,
    conditionId,
    outcome,
    side,
    price,
    size,
    notional,
    fees,
    eventTitle: trade.eventTitle,
    marketTitle: trade.marketTitle,
    outcomeName: trade.outcomeName,
    eventSlug: trade.eventSlug,
    slug: trade.slug,
    icon: trade.icon,
  };
}
export async function fetchMarketMetadata(
  conditionId: string,
  outcome?: string,
  slug?: string
): Promise<MarketMetadata> {
  const cacheKey = `${conditionId}:${outcome || ''}`;

  if (marketMetadataCache.has(cacheKey)) {
    return marketMetadataCache.get(cacheKey)!;
  }

  try {
    // Try to fetch market info from Gamma API.
    // Polymarket flipped the default of GET /markets `closed` to `false` on Apr 9, 2026,
    // so resolved markets are excluded unless we explicitly pass closed=true. Query
    // closed=true first (most positions in PnL flows are settled), then fall back to
    // closed=false for open markets.
    let data: any = null;

    // Validate that a returned market actually matches what we asked for.
    // Polymarket's /markets?conditionId=... filter is currently broken
    // (returns 20 unrelated markets ignoring the filter). Without this
    // check we'd silently ingest random metadata and mislabel positions.
    const matchesRequest = (market: any): boolean => {
      if (!market) return false;
      const cid = (market.conditionId || '').toLowerCase();
      const wanted = conditionId.toLowerCase();
      if (cid && cid === wanted) return true;
      if (slug && market.slug && market.slug.toLowerCase() === slug.toLowerCase()) return true;
      return false;
    };

    const tryFetch = async (baseUrl: string, opts: { validate?: boolean } = {}): Promise<any | null> => {
      for (const closedFlag of ['true', 'false']) {
        const url = `${baseUrl}&closed=${closedFlag}`;
        try {
          const res = await fetchWithTimeout(url, {
            headers: { 'Accept': 'application/json' },
          }, 10000);
          if (!res.ok) continue;
          const body = await res.json();
          if (!Array.isArray(body) || body.length === 0) {
            if (body && !opts.validate) return body;
            continue;
          }
          if (opts.validate) {
            // The /markets endpoint sometimes ignores the filter and returns
            // unrelated markets. Only accept results where at least the first
            // entry actually matches the conditionId or slug we asked for.
            const match = body.find(matchesRequest);
            if (match) return [match];
            continue;
          }
          return body;
        } catch {
          // Try next closedFlag
        }
      }
      return null;
    };

    if (slug) {
      // Slug-based lookup is reliable on Gamma — accept the first result.
      data = await tryFetch(`${GAMMA_API_BASE}/markets?slug=${encodeURIComponent(slug)}`);
      if (!data) {
        console.log(`[fetchMarketMetadata] Slug lookup empty for ${slug}, trying conditionId...`);
      }
    }

    if (!data) {
      // conditionId filter is unreliable upstream; insist on validation.
      data = await tryFetch(`${GAMMA_API_BASE}/markets?conditionId=${encodeURIComponent(conditionId)}`, { validate: true });
      if (!data) {
        console.log(`[fetchMarketMetadata] conditionId lookup did not return a matching market for ${conditionId}`);
      }
    }

    if (data) {
      
      // Handle different response formats
      let market: any = null;
      if (Array.isArray(data) && data.length > 0) {
        market = data[0];
      } else if (data.market) {
        market = data.market;
      } else if (data.data) {
        market = data.data;
      } else if (data) {
        // Sometimes the response is the market object directly
        market = data;
      }
      
      // The API returns markets with events array, not a single event object
      // Normalize to have event as the first event in the events array
      if (market && market.events && Array.isArray(market.events) && market.events.length > 0 && !market.event) {
        market.event = market.events[0];
      }

      if (market) {
        // Debug: Log all available fields to understand the structure (only for first few)
        const isFirstFew = !hasLoggedMarketFields;
        if (isFirstFew) {
          hasLoggedMarketFields = true;
          console.log(`[fetchMarketMetadata] Market fields for ${conditionId}:`, Object.keys(market));
          if (market.event) {
            console.log(`[fetchMarketMetadata] Event fields:`, Object.keys(market.event));
            console.log(`[fetchMarketMetadata] Event sample:`, JSON.stringify(market.event).substring(0, 500));
          }
          // Check for tag-related fields
          const allKeys = Object.keys(market);
          const tagRelatedKeys = allKeys.filter(k => k.toLowerCase().includes('tag') || k.toLowerCase().includes('categor'));
          console.log(`[fetchMarketMetadata] Tag/category related keys:`, tagRelatedKeys);
          
          // Also check event keys for tags
          if (market.event || (market.events && market.events.length > 0)) {
            const event = market.event || market.events[0];
            const eventKeys = Object.keys(event);
            const eventTagKeys = eventKeys.filter(k => k.toLowerCase().includes('tag') || k.toLowerCase().includes('categor'));
            console.log(`[fetchMarketMetadata] Event tag/category related keys:`, eventTagKeys);
            console.log(`[fetchMarketMetadata] Event object (first 1500 chars):`, JSON.stringify(event).substring(0, 1500));
          }
          
          console.log(`[fetchMarketMetadata] Full market sample (first 2000 chars):`, JSON.stringify(market).substring(0, 2000));
        }
        
        // Extract category/tag information from various possible fields
        // Based on Polymarket API docs: https://docs.polymarket.com/api-reference/tags
        // Markets may have tagIds, or we may need to query tags separately
        let category: string | undefined;
        let tags: string[] | undefined;
        
        // First, check if market has tagIds directly
        const tagIds = market.tagIds || market.tag_ids || market.event?.tagIds || market.event?.tag_ids;
        if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
          // Fetch tag details for each tagId
          try {
            const tagPromises = tagIds.map((tagId: string | number) => 
              fetchWithTimeout(`${GAMMA_API_BASE}/tags/${tagId}`, {
                headers: { 'Accept': 'application/json' },
              }, 5000)
                .then(res => res.ok ? res.json() : null)
                .catch(() => null)
            );
            const tagResults = await Promise.all(tagPromises);
            const validTags = tagResults.filter(Boolean);
            
            if (validTags.length > 0) {
              // Use tag labels as tags array
              tags = validTags.map((tag: any) => tag.label || tag.slug).filter(Boolean);
              // Use first tag's label as category
              category = validTags[0]?.label || validTags[0]?.slug;
            }
          } catch (tagError) {
            console.log(`[fetchMarketMetadata] Failed to fetch tags for ${conditionId}:`, tagError);
          }
        }
        
        // If no tags from market tagIds, try to fetch via event slug
        if (!tags || tags.length === 0) {
          const events = market.events || (market.event ? [market.event] : []);
          console.log(`[fetchMarketMetadata] Checking events for tags. Events array length: ${events.length}`);
          if (events.length > 0) {
            const event = events[0];
            const eventSlug = event.slug || event.ticker || market.eventSlug;
            console.log(`[fetchMarketMetadata] Extracted event slug: ${eventSlug} (from event.slug=${event.slug}, event.ticker=${event.ticker}, market.eventSlug=${market.eventSlug})`);
            
            // First, check if the event object already has tags (from market response)
            // This is the key insight from polymarket-dashboard: events have tags array!
            if (event.tags && Array.isArray(event.tags) && event.tags.length > 0) {
              console.log(`[fetchMarketMetadata] Found tags in event object from market response`);
              const eventTags: string[] = [];
              
              // Extract tag labels (same logic as polymarket-dashboard)
              for (const tag of event.tags) {
                if (typeof tag === 'object' && tag.label) {
                  const label = tag.label.trim();
                  if (label && label.length > 0 && label !== 'NONE' && label.toLowerCase() !== 'none') {
                    eventTags.push(label);
                  }
                } else if (typeof tag === 'string' && tag.trim()) {
                  const label = tag.trim();
                  if (label && label !== 'NONE' && label.toLowerCase() !== 'none') {
                    eventTags.push(label);
                  }
                }
              }
              
              if (eventTags.length > 0) {
                tags = eventTags;
                category = eventTags[0]; // First tag is the category
                console.log(`[fetchMarketMetadata] Extracted tags from event object:`, tags);
              }
            }
            
            // If no tags in event object, try fetching from events API endpoint
            if ((!tags || tags.length === 0) && eventSlug) {
              try {
                console.log(`[fetchMarketMetadata] Attempting to fetch event tags via event slug: ${eventSlug}`);
                // Try multiple event API endpoint formats
                let eventResponse: Response | null = null;
                const eventEndpoints = [
                  `${GAMMA_API_BASE}/events?slug=${encodeURIComponent(eventSlug)}`,
                  `${GAMMA_API_BASE}/events/${encodeURIComponent(eventSlug)}`,
                ];
                
                for (const endpoint of eventEndpoints) {
                  try {
                    console.log(`[fetchMarketMetadata] Trying event endpoint: ${endpoint}`);
                    eventResponse = await fetchWithTimeout(endpoint, {
                      headers: { 'Accept': 'application/json' },
                    }, 5000);
                    if (eventResponse.ok) {
                      console.log(`[fetchMarketMetadata] Event API success with endpoint: ${endpoint}`);
                      break;
                    } else {
                      console.log(`[fetchMarketMetadata] Event API returned ${eventResponse.status} for ${endpoint}`);
                    }
                  } catch (e: any) {
                    console.log(`[fetchMarketMetadata] Event API endpoint failed: ${endpoint}`, e?.message || e);
                    eventResponse = null;
                  }
                }
                
                if (!eventResponse || !eventResponse.ok) {
                  console.log(`[fetchMarketMetadata] All event API endpoints failed for slug: ${eventSlug}`);
                } else if (eventResponse.ok) {
                  const eventData = await eventResponse.json();
                  const eventObj = Array.isArray(eventData) ? (eventData.length > 0 ? eventData[0] : null) : eventData;
                  
                  if (eventObj) {
                    // Check if event has tagIds
                    const eventTagIds = eventObj.tagIds || eventObj.tag_ids || eventObj.tags;
                    
                    if (eventTagIds && Array.isArray(eventTagIds) && eventTagIds.length > 0) {
                      console.log(`[fetchMarketMetadata] Found ${eventTagIds.length} tagIds in event:`, eventTagIds);
                      // Fetch tag details
                      const tagPromises = eventTagIds.map((tagId: string | number) => 
                        fetchWithTimeout(`${GAMMA_API_BASE}/tags/${tagId}`, {
                          headers: { 'Accept': 'application/json' },
                        }, 5000)
                          .then(res => res.ok ? res.json() : null)
                          .catch(() => null)
                      );
                      const tagResults = await Promise.all(tagPromises);
                      const validTags = tagResults.filter(Boolean);
                      
                      if (validTags.length > 0) {
                        tags = validTags.map((tag: any) => tag.label || tag.slug).filter(Boolean);
                        category = validTags[0]?.label || validTags[0]?.slug;
                        console.log(`[fetchMarketMetadata] Fetched tags from event:`, tags);
                      }
                    }
                    
                    // Check if event has tags directly (not tagIds) - this is the key!
                    // Based on polymarket-dashboard: events have tags array with { id, label, slug } objects
                    if (eventObj && eventObj.tags && Array.isArray(eventObj.tags) && eventObj.tags.length > 0) {
                      console.log(`[fetchMarketMetadata] Found tags array in event API response:`, eventObj.tags);
                      const eventTags: string[] = [];
                      
                      // Extract tag labels (same logic as polymarket-dashboard)
                      for (const tag of eventObj.tags) {
                        if (typeof tag === 'object' && tag.label) {
                          const label = tag.label.trim();
                          if (label && label.length > 0 && label !== 'NONE' && label.toLowerCase() !== 'none') {
                            eventTags.push(label);
                          }
                        } else if (typeof tag === 'string' && tag.trim()) {
                          const label = tag.trim();
                          if (label && label !== 'NONE' && label.toLowerCase() !== 'none') {
                            eventTags.push(label);
                          }
                        }
                      }
                      
                      if (eventTags.length > 0) {
                        tags = eventTags;
                        category = eventTags[0]; // First tag is the category
                        console.log(`[fetchMarketMetadata] Extracted tags from event API:`, tags);
                      }
                    }
                  }
                } else {
                  console.log(`[fetchMarketMetadata] Event API returned ${eventResponse.status} for slug: ${eventSlug}`);
                }
              } catch (eventError) {
                console.log(`[fetchMarketMetadata] Failed to fetch event tags for ${eventSlug}:`, eventError);
              }
            }
            
            // If still no tags, try to extract from series
            if (!tags || tags.length === 0) {
              const series = event.series || [];
              
              // Use series title as category if available
              if (series.length > 0) {
                const seriesTitle = series[0].title || series[0].slug;
                if (seriesTitle) {
                  category = seriesTitle;
                  tags = series.map((s: any) => s.title || s.slug).filter(Boolean);
                }
              }
            }
          }
        }
        
        // Debug: Log what we found
        if (isFirstFew) {
          const events = market.events || (market.event ? [market.event] : []);
          if (events.length > 0) {
            const event = events[0];
            const series = event.series || [];
            console.log(`[fetchMarketMetadata] Market has tagIds:`, tagIds);
            console.log(`[fetchMarketMetadata] Event has ${series.length} series:`, series.map((s: any) => s.title || s.slug));
          }
        }
        
        // Fallback: Try different possible field names for category
        if (!category) {
          category = market.category || 
                     market.group || 
                     market.marketType || 
                     market.type ||
                     market.event?.category ||
                     market.event?.group ||
                     market.event?.type ||
                     market.event?.marketType ||
                     undefined;
        }
        
        // Fallback: Try different possible field names for tags
        if (!tags || tags.length === 0) {
          if (market.tags && Array.isArray(market.tags) && market.tags.length > 0) {
            tags = market.tags;
          } else if (market.groups && Array.isArray(market.groups) && market.groups.length > 0) {
            tags = market.groups;
          } else if (market.categories && Array.isArray(market.categories) && market.categories.length > 0) {
            tags = market.categories;
          } else if (market.event?.tags && Array.isArray(market.event.tags) && market.event.tags.length > 0) {
            tags = market.event.tags;
          } else if (market.event?.groups && Array.isArray(market.event.groups) && market.event.groups.length > 0) {
            tags = market.event.groups;
          } else if (market.event?.categories && Array.isArray(market.event.categories) && market.event.categories.length > 0) {
            tags = market.event.categories;
          } else if (category) {
            // If we have a category but no tags array, use category as single tag
            tags = [category];
          }
        }
        
        // Debug: Log what we extracted (only for first few)
        if (isFirstFew) {
          console.log(`[fetchMarketMetadata] Extracted for ${conditionId}: category=${category}, tags=${JSON.stringify(tags)}`);
        }
        
        const negRisk = market.negRisk === true || market.event?.negRisk === true || market.events?.[0]?.negRisk === true || undefined;

        // groupItemTitle is the short candidate / threshold label for NegRisk
        // sub-markets ("64–66M", "Donald Trump"). Polymarket sets it on each
        // market within a multi-outcome event. Far better than the long
        // marketTitle question for display.
        const groupItemTitle = (market.groupItemTitle || '').toString().trim() || undefined;

        const metadata: MarketMetadata = {
          eventTitle: market.event?.title || market.events?.[0]?.title || market.eventTitle,
          marketTitle: market.question || market.title || market.marketTitle,
          outcomeName: outcome ? market.outcomes?.[parseInt(outcome)]?.name : undefined,
          category,
          tags,
          negRisk,
          groupItemTitle,
        };

        marketMetadataCache.set(cacheKey, metadata);
        return metadata;
      } else {
        console.log(`[fetchMarketMetadata] No market found in response for ${conditionId}`);
      }
    } else {
      console.log(`[fetchMarketMetadata] No market found for ${conditionId} in either closed or open markets`);
    }
  } catch (error) {
    console.error(`Error fetching market metadata for ${conditionId}:`, error);
  }

  // Return empty metadata on error
  const emptyMetadata: MarketMetadata = {};
  marketMetadataCache.set(cacheKey, emptyMetadata);
  return emptyMetadata;
}
export async function enrichTradesWithMetadata(trades: NormalizedTrade[]): Promise<NormalizedTrade[]> {
  // Group trades by conditionId to batch metadata fetching
  const conditionIds = new Set(trades.map(t => t.conditionId));

  // Fetch metadata for all unique conditionIds
  const metadataPromises = Array.from(conditionIds).map(conditionId =>
    fetchMarketMetadata(conditionId)
  );

  const metadataArray = await Promise.all(metadataPromises);
  const metadataMap = new Map<string, MarketMetadata>();

  let index = 0;
  for (const conditionId of conditionIds) {
    metadataMap.set(conditionId, metadataArray[index]);
    index++;
  }

  // Enrich trades with metadata
  return trades.map(trade => {
    const metadata = metadataMap.get(trade.conditionId);
    if (metadata) {
      return {
        ...trade,
        eventTitle: trade.eventTitle || metadata.eventTitle,
        marketTitle: trade.marketTitle || metadata.marketTitle,
        outcomeName: trade.outcomeName || metadata.outcomeName,
        category: trade.category || metadata.category,
        tags: trade.tags || metadata.tags,
      };
    }
    return trade;
  });
}
/**
 * Fetch the user's open positions from Polymarket's Data API.
 * Returns each currently-held position with current price, unrealized PnL,
 * and accrued realized PnL on that position.
 *
 * Endpoint: GET https://data-api.polymarket.com/positions?user=<addr>
 */
export async function fetchOpenPositions(userAddress: string): Promise<OpenPosition[]> {
  const allPositions: OpenPosition[] = [];
  let offset = 0;
  const pageSize = 500;
  const maxOffset = 1000; // Polymarket data-api offset cap (Aug 26, 2025)
  const seenAssets = new Set<string>();

  console.log(`[API] Fetching open positions for: ${userAddress}`);

  while (offset <= maxOffset) {
    try {
      const params = new URLSearchParams({
        user: userAddress.toLowerCase(),
        limit: pageSize.toString(),
        offset: offset.toString(),
        sortBy: 'CURRENT',
        sortDirection: 'DESC',
      });

      const response = await fetchWithTimeout(
        `${DATA_API_BASE}/positions?${params.toString()}`,
        { headers: { 'Accept': 'application/json' } },
        15000
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        if (allPositions.length === 0) {
          throw new Error(`Failed to fetch open positions: ${response.status} ${errorText}`);
        }
        console.warn(`[API] /positions failed at offset ${offset}: ${response.status}`);
        break;
      }

      const data: PolymarketOpenPosition[] = await response.json();
      if (!Array.isArray(data) || data.length === 0) break;

      for (const pos of data) {
        // Some entries can come back with size 0 (fully closed). Skip those.
        if (!pos || !pos.conditionId || (pos.size ?? 0) === 0) continue;

        const dedupKey = `${pos.conditionId}:${pos.asset}`;
        if (seenAssets.has(dedupKey)) continue;
        seenAssets.add(dedupKey);

        const outcome = pos.outcome || pos.asset?.split(':')?.[1] || '0';
        const side: 'Long YES' | 'Long NO' = pos.outcomeIndex === 0 ? 'Long YES' : 'Long NO';

        allPositions.push({
          conditionId: pos.conditionId,
          asset: pos.asset,
          outcome,
          outcomeName: pos.outcome,
          side,
          marketTitle: pos.title,
          eventSlug: pos.eventSlug,
          slug: pos.slug,
          icon: pos.icon,
          size: pos.size,
          avgPrice: pos.avgPrice,
          currentPrice: pos.curPrice,
          initialValue: pos.initialValue,
          currentValue: pos.currentValue,
          unrealizedPnL: pos.cashPnl,
          unrealizedPnLPercent: pos.percentPnl,
          realizedPnL: pos.realizedPnl,
          redeemable: pos.redeemable,
          mergeable: pos.mergeable,
          endDate: pos.endDate,
          negRisk: pos.negRisk,
          groupItemTitle: undefined, // Filled later from /markets metadata if present
        });
      }

      if (data.length < pageSize) break;
      offset += pageSize;
    } catch (error) {
      console.error(`[API] Error fetching open positions at offset ${offset}:`, error);
      if (allPositions.length === 0) throw error;
      break;
    }
  }

  console.log(`[API] Total open positions fetched: ${allPositions.length}`);
  return allPositions;
}

/**
 * Fetch NegRiskAdapter / CTF conditional-token operations for a wallet:
 * CONVERSION (NegRisk NO->YES+USDC), REDEEM (post-resolution settlement),
 * SPLIT (mint YES+NO from collateral), MERGE (burn YES+NO -> collateral).
 *
 * These don't appear in the /trades feed and are critical context for
 * PnL on NegRisk events.
 */
export async function fetchUserConversionActivities(
  userAddress: string,
  types: NegRiskActivityType[] = ['CONVERSION', 'REDEEM']
): Promise<NegRiskActivity[]> {
  // Reuse the standard activity fetcher; it already respects the post-Aug-2025
  // 1000 offset cap. A single sweep is enough for any realistic wallet.
  const raw = await fetchUserActivity(userAddress, {
    type: types,
    sortBy: 'TIMESTAMP',
    sortDirection: 'DESC',
    limit: 500,
  });

  return raw
    .map((r): NegRiskActivity | null => {
      const t = (r.type || '').toUpperCase() as NegRiskActivityType;
      if (!t || !['CONVERSION', 'REDEEM', 'SPLIT', 'MERGE'].includes(t)) return null;
      const ts = typeof r.timestamp === 'number'
        ? new Date(r.timestamp * 1000).toISOString()
        : (r.timestamp || new Date().toISOString());
      return {
        type: t,
        timestamp: ts,
        conditionId: r.conditionId,
        eventTitle: r.eventSlug || r.title,
        marketTitle: r.title,
        asset: r.asset,
        size: typeof r.size === 'number' ? r.size : undefined,
        usdcAmount: typeof r.usdcSize === 'number' ? r.usdcSize
                    : typeof r.usdcAmount === 'number' ? r.usdcAmount
                    : undefined,
        raw: r,
      };
    })
    .filter((x): x is NegRiskActivity => x !== null);
}

export async function fetchClosedPositions(
  userAddress: string,
  startDate?: string,
  endDate?: string,
  limit: number = 10000 // Increased default limit to capture more positions
): Promise<ClosedPosition[]> {
  const allPositions: ClosedPosition[] = [];
  let offset = 0;
  const pageSize = 50; // API max is 50 per page
  const maxOffset = 100000; // API max offset
  const seenIds = new Set<string>();

  console.log(`[API] Fetching closed positions for user: ${userAddress}`);

  while (offset < maxOffset && allPositions.length < limit) {
    try {
      const params = new URLSearchParams({
        user: userAddress.toLowerCase(),
        limit: pageSize.toString(),
        offset: offset.toString(),
        sortBy: 'TIMESTAMP',
        sortDirection: 'DESC',
      });

      // Note: The API doesn't support date filtering directly, but we can filter client-side

      console.log(`[API] Fetching closed positions offset ${offset} for user: ${userAddress}`);
      
      const response = await fetchWithTimeout(
        `${DATA_API_V1_BASE}/closed-positions?${params.toString()}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        },
        15000 // 15 second timeout per page
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error(`[API] Closed positions fetch failed (offset ${offset}): ${response.status} ${errorText}`);
        
        // If we have some positions, return them; otherwise throw
        if (allPositions.length === 0) {
          throw new Error(`Failed to fetch closed positions: ${response.status} ${errorText}`);
        }
        break;
      }

      const data: PolymarketClosedPosition[] = await response.json();
      console.log(`[API] Found ${data.length} closed positions at offset ${offset}`);
      
      // Debug: Log sample position to see what fields are available
      if (offset === 0 && data.length > 0) {
        console.log(`[API] Sample position fields:`, Object.keys(data[0]));
        console.log(`[API] Sample position category/tags:`, {
          category: data[0].category,
          tags: data[0].tags,
          hasCategory: !!data[0].category,
          hasTags: !!data[0].tags,
        });
      }

      if (data.length === 0) {
        console.log(`[API] No more closed positions found, stopping pagination`);
        break;
      }

      // Convert Polymarket API format to our ClosedPosition format
      for (const pos of data) {
        // Create a unique key for deduplication
        const positionKey = `${pos.conditionId}-${pos.asset}-${pos.timestamp}`;
        if (seenIds.has(positionKey)) {
          continue;
        }
        seenIds.add(positionKey);

        // Convert timestamp from Unix seconds to ISO string
        const closedAt = new Date(pos.timestamp * 1000).toISOString();
        
        // Extract outcome from asset or use outcome field
        const outcome = pos.outcome || pos.asset.split(':')[1] || '0';
        
        // Determine side based on outcomeIndex (0 = Yes, 1 = No)
        // If outcomeIndex is 0, it's Long YES; if 1, it's Long NO
        const side: 'Long YES' | 'Long NO' = pos.outcomeIndex === 0 
          ? 'Long YES' 
          : 'Long NO';

        // Calculate realized PnL percentage
        const costBasis = pos.avgPrice * pos.totalBought;
        const realizedPnLPercent = costBasis > 0 
          ? (pos.realizedPnl / costBasis) * 100 
          : 0;

        const closedPosition: ClosedPosition = {
          conditionId: pos.conditionId,
          outcome: outcome,
          eventTitle: pos.eventSlug || (pos.title ? pos.title.split(' - ')[0] : undefined),
          marketTitle: pos.title || pos.slug || '',
          outcomeName: pos.outcome || outcome,
          side: side,
          openedAt: closedAt, // API doesn't provide open time, use close time as approximation
          closedAt: closedAt,
          entryVWAP: pos.avgPrice,
          exitVWAP: pos.curPrice,
          size: pos.totalBought,
          realizedPnL: pos.realizedPnl,
          realizedPnLPercent: realizedPnLPercent,
          tradesCount: 1, // API doesn't provide trade count, default to 1
          eventSlug: pos.eventSlug,
          slug: pos.slug,
          icon: pos.icon,
          // Don't use category/tags from closed-positions API - will be fetched from markets API
          category: undefined,
          tags: undefined,
          negRisk: pos.negRisk,
          groupItemTitle: undefined, // Filled from markets metadata
        };

        // Filter by date range if provided (client-side filtering)
        if (startDate || endDate) {
          const closeDate = new Date(pos.timestamp * 1000);
          if (startDate && closeDate < new Date(startDate)) {
            continue;
          }
          if (endDate && closeDate > new Date(endDate)) {
            continue;
          }
        }

        allPositions.push(closedPosition);
      }

      // Check if there are more pages
      if (data.length < pageSize) {
        console.log(`[API] Got less than pageSize (${data.length} < ${pageSize}), stopping pagination`);
        break;
      }

      offset += pageSize;
      
      // Safety check to prevent infinite loops
      if (allPositions.length >= limit) {
        console.log(`[API] Reached limit (${limit} positions), stopping pagination`);
        break;
      }
    } catch (error) {
      console.error(`Error fetching closed positions at offset ${offset}:`, error);
      // Return what we have so far if we have any positions
      if (allPositions.length === 0) {
        throw error;
      }
      break;
    }
  }

  console.log(`[API] Completed fetching closed positions: ${allPositions.length} total positions`);

  // Sort by timestamp descending (most recent first)
  allPositions.sort((a, b) => {
    const dateA = new Date(a.closedAt || a.openedAt).getTime();
    const dateB = new Date(b.closedAt || b.openedAt).getTime();
    return dateB - dateA;
  });

  return allPositions;
}
