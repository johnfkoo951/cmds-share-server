import { NextRequest, NextResponse } from 'next/server';
import { resolveToken, unauthorized, adminOnly, generateToken, hashToken, tokenHint, envTokens } from '@/lib/auth';
import { serviceClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export interface TokenRow {
  id: string;
  owner: string;
  token_hint: string;
  admin: boolean;
  disabled: boolean;
  note: string;
  created_at: string;
  created_by: string;
  last_used_at: string | null;
  use_count: number;
}

/** List issued tokens, plus any env entries that have not been adopted yet. */
export async function GET(req: NextRequest) {
  const id = await resolveToken(req);
  if (!id) return unauthorized();
  if (!id.admin) return adminOnly();

  const db = serviceClient();
  const { data, error } = await db
    .from('api_tokens')
    .select('id, owner, token_hint, admin, disabled, note, created_at, created_by, last_used_at, use_count')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []) as TokenRow[];
  const adopted = new Set(rows.map((r) => r.token_hint + '|' + r.owner));
  // Env entries are listed so the admin can see every credential that still
  // opens this server, not just the ones issued from here.
  const legacy = envTokens()
    .filter((e) => !adopted.has(tokenHint(e.token) + '|' + e.owner))
    .map((e) => ({ owner: e.owner, admin: e.admin, hint: tokenHint(e.token) }));

  return NextResponse.json({
    tokens: rows.map((r) => ({
      id: r.id,
      owner: r.owner,
      hint: r.token_hint,
      admin: r.admin,
      disabled: r.disabled,
      note: r.note,
      createdAt: new Date(r.created_at).getTime(),
      createdBy: r.created_by,
      lastUsedAt: r.last_used_at ? new Date(r.last_used_at).getTime() : null,
      useCount: Number(r.use_count),
    })),
    legacy,
    viewer: { owner: id.owner, admin: id.admin, tokenId: id.tokenId ?? null, source: id.source },
  });
}

/** Issue a new token. The raw secret is returned here and nowhere else. */
export async function POST(req: NextRequest) {
  const id = await resolveToken(req);
  if (!id) return unauthorized();
  if (!id.admin) return adminOnly();

  let body: { owner?: string; admin?: boolean; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const owner = (body.owner || '').trim();
  if (!owner) return NextResponse.json({ error: 'owner is required' }, { status: 400 });
  if (owner.includes(',') || owner.includes(':')) {
    // Those two characters delimit the env format; refusing them keeps a name
    // from meaning one thing in the table and another in CMDS_API_TOKENS.
    return NextResponse.json({ error: 'owner cannot contain "," or ":"' }, { status: 400 });
  }

  const token = generateToken();
  const { data, error } = await serviceClient()
    .from('api_tokens')
    .insert({
      owner,
      token_hash: hashToken(token),
      token_hint: tokenHint(token),
      admin: !!body.admin,
      note: (body.note || '').trim(),
      created_by: id.owner,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id, owner, admin: !!body.admin, token }, { status: 201 });
}
