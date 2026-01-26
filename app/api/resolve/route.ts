import { NextRequest, NextResponse } from 'next/server';
import { resolveProxyWallet } from '@/lib/api-client';
import { resolveQuerySchema, validateQueryParams } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Validate query parameters using Zod
    let validatedParams;
    try {
      validatedParams = validateQueryParams(resolveQuerySchema, searchParams);
    } catch (validationError) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationError instanceof Error ? validationError.message : 'Invalid input'
        },
        { status: 400 }
      );
    }

    const result = await resolveProxyWallet(validatedParams.wallet);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in /api/resolve:', error);
    return NextResponse.json(
      { error: 'Failed to resolve proxy wallet' },
      { status: 500 }
    );
  }
}
