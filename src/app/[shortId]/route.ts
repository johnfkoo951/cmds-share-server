import { NextRequest, NextResponse } from 'next/server';
import { serviceClient, BUCKET, ShareRow } from '@/lib/supabase';
import { notFoundPage, gonePage } from '@/lib/pages';
import { expiredPageMode, shouldCountView } from '@/lib/policy';

export const runtime = 'nodejs';

const HTML_HEADERS = { 'content-type': 'text/html; charset=utf-8' };

export async function GET(req: NextRequest, ctx: { params: Promise<{ shortId: string }> }) {
  const { shortId } = await ctx.params;
  if (!/^[a-z0-9]{4,32}$/.test(shortId)) {
    return new NextResponse(notFoundPage(), { status: 404, headers: HTML_HEADERS });
  }

  const db = serviceClient();
  const { data: row } = await db
    .from('shares')
    .select('*')
    .eq('short_id', shortId)
    .maybeSingle<ShareRow>();

  if (!row) {
    return new NextResponse(notFoundPage(), { status: 404, headers: HTML_HEADERS });
  }
  if (row.revoked) {
    return new NextResponse(gonePage('revoked'), { status: 410, headers: HTML_HEADERS });
  }
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    const title = expiredPageMode(row) === 'tombstone' ? row.title : undefined;
    return new NextResponse(gonePage('expired', title), { status: 410, headers: HTML_HEADERS });
  }

  const { data: file, error } = await db.storage.from(BUCKET).download(`${shortId}.html`);
  if (error || !file) {
    return new NextResponse(notFoundPage(), { status: 404, headers: HTML_HEADERS });
  }

  if (shouldCountView(req)) {
    // fire-and-forget: never block the page on the counter
    db.rpc('increment_view', { p_short_id: shortId }).then(
      () => {},
      () => {}
    );
  }

  return new NextResponse(await file.arrayBuffer(), {
    status: 200,
    headers: {
      ...HTML_HEADERS,
      // must not cache: revocation and view counting depend on hitting this handler
      'cache-control': 'private, no-cache',
    },
  });
}
