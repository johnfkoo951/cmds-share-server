import { NextRequest, NextResponse } from 'next/server';
import { checkToken, unauthorized } from '@/lib/auth';
import { serviceClient, BUCKET } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!checkToken(req)) return unauthorized();

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
  await db.storage.from(BUCKET).remove([filename]);

  if (filename.endsWith('.html') && !filename.includes('/')) {
    const shortId = filename.replace(/\.html$/, '');
    await db.from('shares').delete().eq('short_id', shortId);
  } else {
    await db.from('share_assets').delete().eq('path', filename);
  }

  return NextResponse.json({ success: true });
}
