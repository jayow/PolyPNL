# Security Documentation

This document outlines the security features and best practices implemented in Poly PNL.

## Security Features

### 1. Input Validation
All API routes use Zod schemas for input validation:
- **Wallet addresses**: Validated format `0x` + 40 hex characters
- **Usernames**: Alphanumeric, underscore, hyphen only, max 50 chars
- **URLs**: Valid URL format validation
- **HTML content**: Max 500KB, validated dimensions (100-5000px)
- **Dates**: ISO datetime format validation

### 2. Rate Limiting
Rate limiting is implemented using Upstash Redis:
- `/api/pnl`: 10 requests/minute
- `/api/screenshot`: 5 requests/minute
- `/api/image-proxy`: 20 requests/minute
- `/api/resolve-username`: 15 requests/minute
- Other endpoints: 30 requests/minute

**Note**: Rate limiting requires Upstash Redis configuration. In development without Redis, requests are allowed with warnings.

### 3. Image Proxy Security
- **Domain allowlist**: Only allowed domains can be proxied
  - `polymarket.com`
  - `cdn.polymarket.com`
  - `polymarket-upload.s3.us-east-2.amazonaws.com`
- **Size limits**: Maximum 5MB per image
- **Content validation**: Validates image format by Content-Type and magic bytes
- **CORS**: Configurable origin (via `ALLOWED_ORIGIN` environment variable)

### 4. Screenshot API Security
- **HTML size limit**: Maximum 500KB
- **HTML sanitization**: Uses DOMPurify to remove script tags and event handlers
- **Request queuing**: Maximum 3 concurrent Puppeteer instances
- **Queue timeout**: 30 seconds
- **Error handling**: Generic error messages, detailed logs server-side only

### 5. Logging
- **Sensitive data sanitization**: Wallet addresses and URLs are redacted from logs
- **Environment-aware**: Detailed logs in development, minimal logs in production
- **Log levels**: error, warn, info, debug

### 6. Error Handling
- **Generic errors**: Client-facing error messages are generic
- **Error codes**: Structured error codes for client handling
- **No stack traces**: Stack traces never exposed to clients
- **Server-side logging**: Detailed errors logged server-side only

## Environment Variables

### Required for Production
- `UPSTASH_REDIS_REST_URL`: Upstash Redis REST URL (for rate limiting)
- `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis REST token
- `ALLOWED_ORIGIN`: CORS allowed origin (e.g., `https://yourdomain.com`)

### Optional
- `NODE_ENV`: Environment mode (`development` or `production`)

## Security Best Practices

1. **Never log sensitive data**: Wallet addresses, tokens, and secrets are automatically sanitized
2. **Validate all inputs**: Use Zod schemas for all user inputs
3. **Rate limit aggressively**: Resource-intensive endpoints have lower limits
4. **Sanitize HTML**: All HTML content is sanitized before processing
5. **Use HTTPS**: Always use HTTPS in production
6. **Monitor logs**: Regularly review logs for suspicious activity
7. **Keep dependencies updated**: Regularly update npm packages for security patches

## API Security

### Rate Limiting
Rate limits are enforced per IP address. When exceeded, API returns:
- HTTP 429 status
- `Retry-After` header with seconds until reset
- `X-RateLimit-Reset` header with timestamp

### Input Validation
Invalid inputs return:
- HTTP 400 status
- Structured error message
- Validation details (in development only)

### Error Responses
All errors return generic messages:
```json
{
  "error": "Error description",
  "code": "ERROR_CODE"
}
```

## Monitoring

### Health Check Endpoint
`GET /api/health` - Returns service health status:
- Service status
- External API connectivity
- Uptime information

Useful for load balancer health checks and monitoring.

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly. Do not open public issues for security vulnerabilities.

## Security Updates

This document is updated as security features are added or modified. Last updated: January 2026.
