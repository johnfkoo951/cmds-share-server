import { NextRequest, NextResponse } from 'next/server';

/**
 * Bearer-style token auth over HTTPS.
 * CMDS_API_TOKENS is a comma-separated list so each device/vault can hold its own token
 * and one can be revoked without rotating the rest.
 */
export function checkToken(req: NextRequest): boolean {
  const token = req.headers.get('x-cmds-token');
  if (!token) return false;
  const allowed = (process.env.CMDS_API_TOKENS || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  return allowed.includes(token);
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}
