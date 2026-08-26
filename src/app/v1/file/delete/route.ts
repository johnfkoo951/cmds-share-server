import { NextRequest, NextResponse } from 'next/server';
import { resolveToken, unauthorized, forbidden } from '@/lib/auth';
import { serviceClient, BUCKET, ShareRow } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const id = resolveToken(req);
  if (!id) return unauthorized();

  let filename = '';
  try {
    ({ filename } = await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (!filename || typeof filename !== 'string' || filename.includes('..')) {
    return NextResponse.json({ error: 'invalid filename' }, { status: 400 });
  }

  const db = serviceClient();
  const isNote = filename.endsWith('.html') && !filename.includes('/');

  // only the uploader (or an admin) may delete
  if (!id.admin) {
    if (isNote) {
      const shortId = filename.replace(/\.html$/, '');
      const { data: row } = await db
        .from('shares')
        .select('owner')
        .eq('short_id', shortId)
        .maybeSingle<Pick<ShareRow, 'owner'>>();
      if (row && row.owner !== id.owner) return forbidden();
    } else {
      const { data: asset } = await db
        .from('share_assets')
        .select('owner')
        .eq('path', filename)
        .maybeSingle<{ owner: string }>();
      if (asset && asset.owner !== id.owner) return forbidden();
    }
  }

  await db.storage.from(BUCKET).remove([filename]);

  if (isNote) {
    const shortId = filename.replace(/\.html$/, '');
    await db.from('shares').delete().eq('short_id', shortId);
  } else {
    await db.from('share_assets').delete().eq('path', filename);
  }

  return NextResponse.json({ success: true });
}
