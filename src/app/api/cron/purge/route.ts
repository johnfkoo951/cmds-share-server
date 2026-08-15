import { NextRequest, NextResponse } from 'next/server';
import { serviceClient, BUCKET, ShareRow } from '@/lib/supabase';

export const runtime = 'nodejs';

const GRACE_MS = 7 * 24 * 60 * 60 * 1000; // keep expired rows 7 days for the tombstone page

export async function GET(req: NextRequest) {
  // Vercel cron sends Authorization: Bearer ${CRON_SECRET} when the env var is set
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = serviceClient();
  const cutoff = new Date(Date.now() - GRACE_MS).toISOString();

  const { data: rows, error } = await db
    .from('shares')
    .select('short_id')
    .not('expires_at', 'is', null)
    .lt('expires_at', cutoff)
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const expired = (rows as Pick<ShareRow, 'short_id'>[]) || [];
  if (expired.length > 0) {
    await db.storage.from(BUCKET).remove(expired.map((r) => `${r.short_id}.html`));
    await db
      .from('shares')
      .delete()
      .in('short_id', expired.map((r) => r.short_id));
  }

  return NextResponse.json({ purged: expired.length });
}
