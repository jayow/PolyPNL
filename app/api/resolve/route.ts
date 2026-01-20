import { NextRequest, NextResponse } from 'next/server';
import { resolveProxyWallet } from '@/lib/api-client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet parameter is required' },
        { status: 400 }
      );
    }

    const result = await resolveProxyWallet(wallet);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in /api/resolve:', error);
    return NextResponse.json(
      { error: 'Failed to resolve proxy wallet' },
      { status: 500 }
    );
  }
}
