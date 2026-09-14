import { NextRequest, NextResponse } from 'next/server';
import { resolveToken, unauthorized } from '@/lib/auth';
import { serviceClient, ShareRow } from '@/lib/supabase';

export const runtime = 'nodejs';

interface MemberSummary {
  owner: string;
  total: number;
  live: number;
  views: number;
  encrypted: number;
  lastUpdated: number;
}

export async function GET(req: NextRequest) {
  const id = await resolveToken(req);
  if (!id) return unauthorized();

  const vaultId = req.nextUrl.searchParams.get('vaultId');
  const db = serviceClient();

  let query = db.from('shares').select('*').order('updated_at', { ascending: false }).limit(500);
  if (vaultId) query = query.eq('vault_id', vaultId);
  // non-admins only ever see their own shares
  if (!id.admin) query = query.eq('owner', id.owner);

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
    // uploader attribution is an admin-only view
    ...(id.admin ? { owner: r.owner } : {}),
  }));

  // Team overview: per-member aggregates over EVERY share (not just the
  // viewer's). Titles/links stay scoped above; only counts leave here, so a
  // non-admin can see how the workspace is being used without seeing what.
  const { data: allRows } = await db
    .from('shares')
    .select('owner, view_count, encrypted, revoked, expires_at, updated_at')
    .limit(5000);
  const now = Date.now();
  const byOwner = new Map<string, MemberSummary>();
  for (const r of (allRows || []) as Pick<ShareRow, 'owner' | 'view_count' | 'encrypted' | 'revoked' | 'expires_at' | 'updated_at'>[]) {
    const key = r.owner || '';
    const m = byOwner.get(key) || { owner: key, total: 0, live: 0, views: 0, encrypted: 0, lastUpdated: 0 };
    m.total += 1;
    m.views += r.view_count;
    if (r.encrypted) m.encrypted += 1;
    const expired = r.expires_at ? new Date(r.expires_at).getTime() < now : false;
    if (!r.revoked && !expired) m.live += 1;
    m.lastUpdated = Math.max(m.lastUpdated, new Date(r.updated_at).getTime());
    byOwner.set(key, m);
  }
  const members = [...byOwner.values()].sort((a, b) => b.lastUpdated - a.lastUpdated);

  return NextResponse.json({
    notes,
    members,
    viewer: { owner: id.owner, admin: id.admin, tokenId: id.tokenId ?? null, source: id.source },
  });
}
