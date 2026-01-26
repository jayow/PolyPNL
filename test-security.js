/**
 * Security Testing & Stress Test Script
 * Tests all security features implemented in the application
 */

const BASE_URL = 'http://localhost:3000';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name) {
  log(`\n🧪 Testing: ${name}`, 'cyan');
}

function logPass(message) {
  log(`  ✅ ${message}`, 'green');
}

function logFail(message) {
  log(`  ❌ ${message}`, 'red');
}

function logWarn(message) {
  log(`  ⚠️  ${message}`, 'yellow');
}

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, options);
    let data;
    try {
      data = await response.json();
    } catch {
      data = { text: await response.text() };
    }
    return { status: response.status, data, headers: Object.fromEntries(response.headers.entries()) };
  } catch (error) {
    return { error: error.message };
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test 1: Rate Limiting
async function testRateLimiting() {
  logTest('Rate Limiting');
  
  const endpoint = `${BASE_URL}/api/pnl?wallet=0x1234567890123456789012345678901234567890`;
  const requests = [];
  
  // Make 15 requests rapidly (limit is 10/min)
  for (let i = 0; i < 15; i++) {
    requests.push(makeRequest(endpoint));
    await sleep(50); // Small delay between requests
  }
  
  const results = await Promise.all(requests);
  const successCount = results.filter(r => r.status === 200 || r.status === 400).length;
  const rateLimitedCount = results.filter(r => r.status === 429).length;
  
  if (rateLimitedCount > 0) {
    logPass(`Rate limiting working: ${rateLimitedCount} requests rate limited`);
    // Check for Retry-After header
    const rateLimited = results.find(r => r.status === 429);
    if (rateLimited?.headers['retry-after']) {
      logPass(`Retry-After header present: ${rateLimited.headers['retry-after']}s`);
    } else {
      logWarn('Retry-After header missing');
    }
  } else {
    logFail(`Rate limiting not working: ${successCount} requests succeeded, 0 rate limited`);
    logWarn('This might be because Redis is not configured or rate limit not reached');
  }
}

// Test 2: Input Validation
async function testInputValidation() {
  logTest('Input Validation');
  
  // Test invalid wallet address
  const invalidWallet = await makeRequest(`${BASE_URL}/api/pnl?wallet=invalid`);
  if (invalidWallet.status === 400) {
    logPass('Invalid wallet address rejected');
  } else {
    logFail(`Invalid wallet accepted: ${invalidWallet.status}`);
  }
  
  // Test missing wallet parameter
  const missingWallet = await makeRequest(`${BASE_URL}/api/pnl`);
  if (missingWallet.status === 400) {
    logPass('Missing wallet parameter rejected');
  } else {
    logFail(`Missing wallet accepted: ${missingWallet.status}`);
  }
  
  // Test invalid username
  const invalidUsername = await makeRequest(`${BASE_URL}/api/resolve-username?username=test@#$%`);
  if (invalidUsername.status === 400) {
    logPass('Invalid username format rejected');
  } else {
    logFail(`Invalid username accepted: ${invalidUsername.status}`);
  }
  
  // Test too long username
  const longUsername = await makeRequest(`${BASE_URL}/api/resolve-username?username=${'a'.repeat(100)}`);
  if (longUsername.status === 400) {
    logPass('Too long username rejected');
  } else {
    logFail(`Too long username accepted: ${longUsername.status}`);
  }
}

// Test 3: Image Proxy Security
async function testImageProxySecurity() {
  logTest('Image Proxy Security');
  
  // Test disallowed domain
  const disallowedDomain = await makeRequest(
    `${BASE_URL}/api/image-proxy?url=https://evil.com/image.png`
  );
  if (disallowedDomain.status === 403) {
    logPass('Disallowed domain rejected (403)');
  } else {
    logFail(`Disallowed domain not rejected: ${disallowedDomain.status}`);
  }
  
  // Test invalid URL format
  const invalidUrl = await makeRequest(`${BASE_URL}/api/image-proxy?url=not-a-url`);
  if (invalidUrl.status === 400) {
    logPass('Invalid URL format rejected');
  } else {
    logFail(`Invalid URL accepted: ${invalidUrl.status}`);
  }
  
  // Test missing URL parameter
  const missingUrl = await makeRequest(`${BASE_URL}/api/image-proxy`);
  if (missingUrl.status === 400) {
    logPass('Missing URL parameter rejected');
  } else {
    logFail(`Missing URL accepted: ${missingUrl.status}`);
  }
}

// Test 4: Screenshot API Security
async function testScreenshotAPISecurity() {
  logTest('Screenshot API Security');
  
  // Test missing HTML
  const missingHtml = await makeRequest(`${BASE_URL}/api/screenshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ width: 840, height: 472 }),
  });
  if (missingHtml.status === 400) {
    logPass('Missing HTML rejected');
  } else {
    logFail(`Missing HTML accepted: ${missingHtml.status}`);
  }
  
  // Test too large HTML (over 500KB)
  const largeHtml = await makeRequest(`${BASE_URL}/api/screenshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      html: '<div>' + 'x'.repeat(600 * 1024) + '</div>', // 600KB
      width: 840,
      height: 472,
    }),
  });
  if (largeHtml.status === 400) {
    logPass('Too large HTML rejected (500KB limit)');
  } else {
    logWarn(`Large HTML check: ${largeHtml.status} (might be validated by Zod)`);
  }
  
  // Test invalid dimensions
  const invalidDimensions = await makeRequest(`${BASE_URL}/api/screenshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      html: '<div>test</div>',
      width: 50, // Too small (min 100)
      height: 50,
    }),
  });
  if (invalidDimensions.status === 400) {
    logPass('Invalid dimensions rejected');
  } else {
    logFail(`Invalid dimensions accepted: ${invalidDimensions.status}`);
  }
}

// Test 5: Error Handling
async function testErrorHandling() {
  logTest('Error Handling');
  
  // Test that errors don't expose stack traces
  const errorResponse = await makeRequest(`${BASE_URL}/api/pnl?wallet=invalid`);
  
  if (errorResponse.data) {
    const hasStack = JSON.stringify(errorResponse.data).includes('stack') || 
                     JSON.stringify(errorResponse.data).includes('at ');
    if (!hasStack) {
      logPass('No stack traces in error responses');
    } else {
      logFail('Stack traces found in error response');
    }
    
    // Check for generic error messages
    if (errorResponse.data.error && typeof errorResponse.data.error === 'string') {
      logPass('Generic error messages returned');
    } else {
      logWarn('Error format might need review');
    }
  }
}

// Test 6: Health Check
async function testHealthCheck() {
  logTest('Health Check Endpoint');
  
  const health = await makeRequest(`${BASE_URL}/api/health`);
  if (health.status === 200 && health.data.status === 'ok') {
    logPass('Health check endpoint working');
    log(`  Status: ${health.data.status}`, 'blue');
    log(`  Environment: ${health.data.environment}`, 'blue');
  } else {
    logFail(`Health check failed: ${health.status}`);
  }
}

// Test 7: Stress Test - Concurrent Requests
async function stressTest() {
  logTest('Stress Test - Concurrent Requests');
  
  const concurrentRequests = 50;
  const endpoint = `${BASE_URL}/api/pnl?wallet=0x1234567890123456789012345678901234567890`;
  
  log(`  Making ${concurrentRequests} concurrent requests...`, 'yellow');
  
  const startTime = Date.now();
  const requests = Array(concurrentRequests).fill(null).map(() => makeRequest(endpoint));
  const results = await Promise.all(requests);
  const endTime = Date.now();
  
  const duration = endTime - startTime;
  const successCount = results.filter(r => r.status === 200 || r.status === 400).length;
  const rateLimitedCount = results.filter(r => r.status === 429).length;
  const errorCount = results.filter(r => r.error || (r.status >= 500)).length;
  
  log(`  Duration: ${duration}ms`, 'blue');
  log(`  Successful: ${successCount}`, 'green');
  log(`  Rate Limited: ${rateLimitedCount}`, 'yellow');
  log(`  Errors: ${errorCount}`, errorCount > 0 ? 'red' : 'green');
  
  if (rateLimitedCount > 0) {
    logPass('Rate limiting working under load');
  } else {
    logWarn('No rate limiting detected (might be disabled or limit not reached)');
  }
  
  if (errorCount === 0) {
    logPass('No server errors under stress');
  } else {
    logFail(`${errorCount} errors occurred under stress`);
  }
}

// Test 8: CORS Configuration
async function testCORS() {
  logTest('CORS Configuration');
  
  const corsResponse = await makeRequest(`${BASE_URL}/api/image-proxy?url=https://polymarket.com/test.png`, {
    headers: {
      'Origin': 'http://localhost:3000',
    },
  });
  
  if (corsResponse.headers['access-control-allow-origin']) {
    logPass('CORS headers present');
    log(`  Allowed Origin: ${corsResponse.headers['access-control-allow-origin']}`, 'blue');
  } else {
    logWarn('CORS headers not found (might be GET request)');
  }
}

// Main test runner
async function runAllTests() {
  log('\n🚀 Starting Security & Stress Tests\n', 'blue');
  log('=' .repeat(60), 'blue');
  
  try {
    // Check if server is running
    const healthCheck = await makeRequest(`${BASE_URL}/api/health`);
    if (healthCheck.error) {
      logFail(`Server not accessible at ${BASE_URL}`);
      log('Make sure the dev server is running: npm run dev', 'yellow');
      process.exit(1);
    }
    
    await testHealthCheck();
    await testInputValidation();
    await testImageProxySecurity();
    await testScreenshotAPISecurity();
    await testErrorHandling();
    await testCORS();
    await testRateLimiting();
    await stressTest();
    
    log('\n' + '='.repeat(60), 'blue');
    log('\n✅ All tests completed!\n', 'green');
    
  } catch (error) {
    logFail(`Test suite error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runAllTests();
