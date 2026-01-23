import { NextRequest, NextResponse } from 'next/server';
import { resolveUsernameToWallet } from '@/lib/api-client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { error: 'Username parameter is required' },
        { status: 400 }
      );
    }

    const result = await resolveUsernameToWallet(username);

    if (!result.walletAddress) {
      return NextResponse.json(
        { error: `Could not resolve username "${username}" to a wallet address` },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in /api/resolve-username:', error);
    return NextResponse.json(
      { error: 'Failed to resolve username' },
      { status: 500 }
    );
  }
}
