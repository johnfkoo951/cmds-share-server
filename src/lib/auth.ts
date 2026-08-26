import { NextRequest, NextResponse } from 'next/server';

/**
 * Bearer-style token auth over HTTPS.
 *
 * CMDS_API_TOKENS is a comma-separated list of "name:token" entries so every
 * upload is attributed to a person and one token can be revoked without
 * rotating the rest. A name ending in "*" marks an admin (sees and manages
 * every share; others are scoped to their own). A bare legacy "token" entry
 * (no name) resolves as an anonymous admin for backward compatibility.
 */
export interface TokenIdentity {
  owner: string;
  admin: boolean;
}

export function resolveToken(req: NextRequest): TokenIdentity | null {
  const token = req.headers.get('x-cmds-token');
  if (!token) return null;
  for (const raw of (process.env.CMDS_API_TOKENS || '').split(',')) {
    const entry = raw.trim();
    if (!entry) continue;
    const sep = entry.indexOf(':');
    if (sep === -1) {
      if (entry === token) return { owner: '', admin: true };
      continue;
    }
    if (entry.slice(sep + 1).trim() !== token) continue;
    const name = entry.slice(0, sep).trim();
    const admin = name.endsWith('*');
    return { owner: admin ? name.slice(0, -1).trim() : name, admin };
  }
  return null;
}

export function checkToken(req: NextRequest): boolean {
  return resolveToken(req) !== null;
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

export function forbidden(): NextResponse {
  return NextResponse.json({ error: 'forbidden: not the owner of this share' }, { status: 403 });
}
