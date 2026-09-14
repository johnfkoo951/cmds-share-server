import { NextRequest, NextResponse } from 'next/server';
import { resolveToken, unauthorized, adminOnly, envTokens, TokenIdentity } from '@/lib/auth';
import { serviceClient } from '@/lib/supabase';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

/**
 * Guard against an admin locking themselves -- or everyone -- out of the
 * dashboard. Returns an error message when the change must be refused.
 *
 * Two rules:
 *  1. You cannot disable or delete the token you are holding right now. The
 *     request would succeed and the next one would fail, which reads as the
 *     server breaking rather than as a deliberate act.
 *  2. The last way in has to stay open. Env admins count here, because they
 *     still authenticate through the fallback path.
 */
async function lockoutReason(id: TokenIdentity, targetId: string, targetIsAdmin: boolean): Promise<string | null> {
  if (id.tokenId && id.tokenId === targetId) {
    return 'You cannot disable or delete the token you are signed in with. Use another admin token.';
  }
  if (!targetIsAdmin) return null;

  const { count } = await serviceClient()
    .from('api_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('admin', true)
    .eq('disabled', false);
  const envAdmins = envTokens().filter((e) => e.admin).length;
  if ((count ?? 0) + envAdmins <= 1) {
    return 'This is the last admin token. Issue another admin token before removing this one.';
  }
  return null;
}

/** Enable/disable a token, or edit its label. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const id = await resolveToken(req);
  if (!id) return unauthorized();
  if (!id.admin) return adminOnly();
  const { id: targetId } = await params;

  let body: { disabled?: boolean; owner?: string; note?: string; admin?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const db = serviceClient();
  const { data: current, error: readErr } = await db
    .from('api_tokens')
    .select('id, admin, disabled')
    .eq('id', targetId)
    .maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: 'token not found' }, { status: 404 });

  const losingAdminAccess =
    (body.disabled === true && !current.disabled) || (body.admin === false && current.admin);
  if (losingAdminAccess) {
    const reason = await lockoutReason(id, targetId, current.admin);
    if (reason) return NextResponse.json({ error: reason }, { status: 409 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.disabled === 'boolean') patch.disabled = body.disabled;
  if (typeof body.admin === 'boolean') patch.admin = body.admin;
  if (typeof body.owner === 'string' && body.owner.trim()) patch.owner = body.owner.trim();
  if (typeof body.note === 'string') patch.note = body.note.trim();
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  const { error } = await db.from('api_tokens').update(patch).eq('id', targetId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Delete a token outright. Shares uploaded with it are left untouched. */
export async function DELETE(req: NextRequest, { params }: Params) {
  const id = await resolveToken(req);
  if (!id) return unauthorized();
  if (!id.admin) return adminOnly();
  const { id: targetId } = await params;

  const db = serviceClient();
  const { data: current, error: readErr } = await db
    .from('api_tokens')
    .select('id, admin')
    .eq('id', targetId)
    .maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: 'token not found' }, { status: 404 });

  const reason = await lockoutReason(id, targetId, current.admin);
  if (reason) return NextResponse.json({ error: reason }, { status: 409 });

  const { error } = await db.from('api_tokens').delete().eq('id', targetId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
