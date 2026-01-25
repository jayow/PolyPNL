import { z } from 'zod';

/**
 * Validation schemas for API routes
 * All user inputs should be validated using these schemas
 */

/**
 * Ethereum wallet address validation
 * Format: 0x followed by 40 hexadecimal characters
 */
export const walletAddressSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^0x[a-f0-9]{40}$/, 'Invalid wallet address format. Must be 0x followed by 40 hexadecimal characters.')
  .length(42, 'Wallet address must be exactly 42 characters');

/**
 * Polymarket username validation
 * Format: alphanumeric, underscores, hyphens, 1-50 characters
 */
export const usernameSchema = z
  .string()
  .trim()
  .min(1, 'Username cannot be empty')
  .max(50, 'Username cannot exceed 50 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')
  .transform((val) => val.toLowerCase()); // Normalize to lowercase

/**
 * URL validation with optional domain allowlist
 */
export const createUrlSchema = (allowedDomains?: string[]) => {
  let schema = z.string().url('Invalid URL format');
  
  if (allowedDomains && allowedDomains.length > 0) {
    schema = schema.refine(
      (url) => {
        try {
          const urlObj = new URL(url);
          return allowedDomains.some(domain => 
            urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
          );
        } catch {
          return false;
        }
      },
      {
        message: `URL must be from an allowed domain: ${allowedDomains.join(', ')}`,
      }
    );
  }
  
  return schema;
};

/**
 * Base URL schema (no domain restrictions)
 * Used for image-proxy with domain validation done separately
 */
export const urlSchema = z.string().url('Invalid URL format');

/**
 * Screenshot API request validation
 */
export const screenshotRequestSchema = z.object({
  html: z
    .string()
    .min(1, 'HTML content is required')
    .max(500 * 1024, 'HTML content cannot exceed 500KB'), // 500KB limit
  width: z
    .number()
    .int('Width must be an integer')
    .min(100, 'Width must be at least 100px')
    .max(5000, 'Width cannot exceed 5000px')
    .optional()
    .default(840),
  height: z
    .number()
    .int('Height must be an integer')
    .min(100, 'Height must be at least 100px')
    .max(5000, 'Height cannot exceed 5000px')
    .optional()
    .default(472),
});

/**
 * PnL API query parameters validation
 */
export const pnlQuerySchema = z.object({
  wallet: z
    .string()
    .min(1, 'Wallet parameter is required')
    .refine(
      (val) => {
        // Accept either wallet address or username
        const trimmed = val.trim().toLowerCase();
        // Check if it's a wallet address
        if (trimmed.startsWith('0x') && trimmed.length === 42) {
          return walletAddressSchema.safeParse(trimmed).success;
        }
        // Otherwise treat as username
        return usernameSchema.safeParse(trimmed).success;
      },
      {
        message: 'Wallet must be a valid wallet address (0x...) or username',
      }
    ),
  method: z.enum(['fifo', 'avg']).optional().default('fifo'),
});

/**
 * Activities API query parameters validation
 */
export const activitiesQuerySchema = z.object({
  user: walletAddressSchema,
  conditionId: z.string().min(1, 'conditionId is required'),
  outcome: z.string().min(1, 'outcome is required'),
  openedAt: z.string().datetime('Invalid openedAt date format').optional(),
  closedAt: z.string().datetime('Invalid closedAt date format').optional(),
});

/**
 * Trades API query parameters validation
 */
export const tradesQuerySchema = z.object({
  wallet: walletAddressSchema,
  start: z.string().datetime('Invalid start date format').optional(),
  end: z.string().datetime('Invalid end date format').optional(),
});

/**
 * Resolve API query parameters validation
 */
export const resolveQuerySchema = z.object({
  wallet: walletAddressSchema,
});

/**
 * Resolve username API query parameters validation
 */
export const resolveUsernameQuerySchema = z.object({
  username: usernameSchema,
});

/**
 * Image proxy query parameters validation
 * Note: Domain validation is done separately in the route handler
 */
export const imageProxyQuerySchema = z.object({
  url: urlSchema,
});

/**
 * Helper function to validate and parse query parameters
 */
export function validateQueryParams<T extends z.ZodTypeAny>(
  schema: T,
  searchParams: URLSearchParams
): z.infer<T> {
  const params: Record<string, string | undefined> = {};
  
  // Convert URLSearchParams to object
  for (const [key, value] of searchParams.entries()) {
    params[key] = value || undefined;
  }
  
  const result = schema.safeParse(params);
  
  if (!result.success) {
    throw new Error(
      `Validation failed: ${result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
    );
  }
  
  return result.data;
}

/**
 * Helper function to validate request body
 */
export function validateRequestBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown
): z.infer<T> {
  const result = schema.safeParse(body);
  
  if (!result.success) {
    throw new Error(
      `Validation failed: ${result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
    );
  }
  
  return result.data;
}
