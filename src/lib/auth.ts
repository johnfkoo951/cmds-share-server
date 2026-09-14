import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse, after } from 'next/server';
import { serviceClient } from '@/lib/supabase';

/**
 * Bearer-style token auth over HTTPS.
 *
 * Tokens live in the `api_tokens` table and are issued from the dashboard. Only
 * a sha256 hash is stored, so the raw value exists exactly once -- in the hands
 * of the member it was issued to.
 *
 * The legacy CMDS_API_TOKENS env var still resolves, as a fallback, so members
 * issued a token before this table existed keep working with no redeploy and no
 * change on their side. An env entry is a comma-separated "name:token" list; a
 * name ending in "*" marks an admin (sees and manages every share, others are
 * scoped to their own), and a bare "token" with no name resolves as an
 * anonymous admin. Adopting an env token from the dashboard copies it into the
 * table under the same secret, after which the env entry can be dropped.
 */
export interface TokenIdentity {
  owner: string;
  admin: boolean;
  /** Present only for database-backed tokens; env fallbacks have no row. */
  tokenId?: string;
  source: 'db' | 'env';
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex');
}

export function generateToken(): string {
  // 48 hex characters, matching the length of the tokens issued before this table.
  return randomBytes(24).toString('hex');
}

export function tokenHint(token: string): string {
  return token.trim().slice(-4);
}

/** Parsed view of CMDS_API_TOKENS, used for fallback auth and for adoption. */
export function envTokens(): { owner: string; admin: boolean; token: string }[] {
  const out: { owner: string; admin: boolean; token: string }[] = [];
  for (const raw of (process.env.CMDS_API_TOKENS || '').split(',')) {
    const entry = raw.trim();
    if (!entry) continue;
    const sep = entry.indexOf(':');
    if (sep === -1) {
      out.push({ owner: '', admin: true, token: entry });
      continue;
    }
    const name = entry.slice(0, sep).trim();
    const token = entry.slice(sep + 1).trim();
    if (!token) continue;
    const admin = name.endsWith('*');
    out.push({ owner: admin ? name.slice(0, -1).trim() : name, admin, token });
  }
  return out;
}

export async function resolveToken(req: NextRequest): Promise<TokenIdentity | null> {
  const token = req.headers.get('x-cmds-token');
  if (!token) return null;
  const hash = hashToken(token);

  // Issued tokens win over env entries, so adopting a token and then disabling
  // it actually locks the holder out even while the env var still lists it.
  try {
    const { data } = await serviceClient()
      .from('api_tokens')
      .select('id, owner, admin, disabled')
      .eq('token_hash', hash)
      .maybeSingle();
    if (data) {
      if (data.disabled) return null;
      // Accounting must not delay the response, and must not race the handler's
      // own writes, so it runs once the response has been sent.
      after(async () => {
        try {
          await serviceClient().rpc('touch_token', { p_id: data.id });
        } catch {
          /* usage stats are best-effort; never fail a request over them */
        }
      });
      return { owner: data.owner, admin: data.admin, tokenId: data.id, source: 'db' };
    }
  } catch {
    // Database unreachable: fall through to the env var rather than locking
    // everyone out of a service whose storage is already degraded.
  }

  for (const e of envTokens()) {
    if (e.token === token.trim()) return { owner: e.owner, admin: e.admin, source: 'env' };
  }
  return null;
}

export async function checkToken(req: NextRequest): Promise<boolean> {
  return (await resolveToken(req)) !== null;
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

export function forbidden(): NextResponse {
  return NextResponse.json({ error: 'forbidden: not the owner of this share' }, { status: 403 });
}

export function adminOnly(): NextResponse {
  return NextResponse.json({ error: 'forbidden: admin only' }, { status: 403 });
}
