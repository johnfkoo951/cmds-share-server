import { NextRequest, NextResponse } from 'next/server';
import { checkToken, unauthorized } from '@/lib/auth';
import { serviceClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!checkToken(req)) return unauthorized();

  let shortId = '';
  let revoked = true;
  try {
    const body = await req.json();
    shortId = body.shortId;
    revoked = body.revoked !== false;
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (!shortId || typeof shortId !== 'string') {
    return NextResponse.json({ error: 'shortId required' }, { status: 400 });
  }

  const db = serviceClient();
  const { error } = await db
    .from('shares')
    .update({ revoked, updated_at: new Date().toISOString() })
    .eq('short_id', shortId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, shortId, revoked });
}
