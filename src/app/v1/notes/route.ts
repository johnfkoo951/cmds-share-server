import { NextRequest, NextResponse } from 'next/server';
import { checkToken, unauthorized } from '@/lib/auth';
import { serviceClient, ShareRow } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!checkToken(req)) return unauthorized();

  const vaultId = req.nextUrl.searchParams.get('vaultId');
  const db = serviceClient();

  let query = db.from('shares').select('*').order('updated_at', { ascending: false }).limit(500);
  if (vaultId) query = query.eq('vault_id', vaultId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const notes = (data as ShareRow[]).map((r) => ({
    shortId: r.short_id,
    title: r.title,
    encrypted: r.encrypted,
    viewCount: r.view_count,
    expiresAt: r.expires_at ? new Date(r.expires_at).getTime() : undefined,
    revoked: r.revoked,
    sizeBytes: r.size_bytes,
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
  }));

  return NextResponse.json({ notes });
}
