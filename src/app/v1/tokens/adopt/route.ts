import { NextRequest, NextResponse } from 'next/server';
import { resolveToken, unauthorized, adminOnly, hashToken, tokenHint, envTokens } from '@/lib/auth';
import { serviceClient } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * Copy a CMDS_API_TOKENS entry into the table under the same secret.
 *
 * The member keeps the token they already pasted into the plugin -- nothing to
 * re-send, nothing to reconfigure -- but the credential gains usage tracking
 * and can be disabled or deleted from the dashboard. Once every entry is
 * adopted, CMDS_API_TOKENS can be emptied on the next deploy.
 */
export async function POST(req: NextRequest) {
  const id = await resolveToken(req);
  if (!id) return unauthorized();
  if (!id.admin) return adminOnly();

  let body: { owner?: string; hint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const owner = (body.owner || '').trim();
  const hint = (body.hint || '').trim();
  // Owner alone is ambiguous for the unnamed legacy admin entry, so the hint
  // from the listing pins down exactly which env token is meant.
  const entry = envTokens().find((e) => e.owner === owner && (!hint || tokenHint(e.token) === hint));
  if (!entry) return NextResponse.json({ error: 'no matching env token' }, { status: 404 });

  const { error } = await serviceClient()
    .from('api_tokens')
    .insert({
      owner: entry.owner || 'unattributed',
      token_hash: hashToken(entry.token),
      token_hint: tokenHint(entry.token),
      admin: entry.admin,
      note: 'adopted from CMDS_API_TOKENS',
      created_by: id.owner,
    });
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'already adopted' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
