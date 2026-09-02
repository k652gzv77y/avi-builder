import { NextRequest, NextResponse } from 'next/server';
import { noCache } from '@/lib/api-response';
import { purgeTags } from '@/lib/services/cacheService';

/**
 * Vercel Cache Invalidation Endpoint
 *
 * Handles cache tag invalidation for published pages
 */

export async function POST(request: NextRequest) {
  try {
    const { tags } = await request.json();

    if (!Array.isArray(tags)) {
      return noCache(
        { error: 'Tags must be an array' },
        400
      );
    }

    await purgeTags(tags);

    return noCache({
      success: true,
      invalidated: tags,
    });
  } catch (error) {
    console.error('Cache invalidation error:', error);

    return noCache(
      { error: 'Failed to invalidate cache' },
      500
    );
  }
}
