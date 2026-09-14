import { NextRequest, NextResponse } from 'next/server';
import { resolveToken, unauthorized } from '@/lib/auth';
import { serviceClient, BUCKET, ShareRow } from '@/lib/supabase';
import { collisionPolicy } from '@/lib/policy';

export const runtime = 'nodejs';

const MAX_BYTES = 20_000_000; // 20 MB per file
const FILENAME_RE = /^([a-z0-9]{4,32}\.html|css\/[a-f0-9]{40}\.css|assets\/[a-f0-9]{40}\.[a-z0-9]{1,8})$/;

function decodeTitle(header: string | null): string {
  if (!header) return '';
  try {
    return Buffer.from(header, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

export async function POST(req: NextRequest) {
  const id = await resolveToken(req);
  if (!id) return unauthorized();

  const filename = req.headers.get('x-cmds-filename') || '';
  if (!FILENAME_RE.test(filename)) {
    return NextResponse.json({ error: 'invalid filename' }, { status: 400 });
  }

  const body = Buffer.from(await req.arrayBuffer());
  if (body.length === 0) return NextResponse.json({ error: 'empty body' }, { status: 400 });
  if (body.length > MAX_BYTES) return NextResponse.json({ error: 'file too large' }, { status: 413 });

  const vaultId = req.headers.get('x-cmds-vault-id') || 'unknown';
  const contentType = req.headers.get('content-type') || 'application/octet-stream';
  const db = serviceClient();

  const isNote = filename.endsWith('.html') && !filename.includes('/');
  if (isNote) {
    const shortId = filename.replace(/\.html$/, '');
    const { data: existing } = await db
      .from('shares')
      .select('*')
      .eq('short_id', shortId)
      .maybeSingle<ShareRow>();

    if (collisionPolicy(existing ?? null, vaultId) === 'reject') {
      return NextResponse.json({ error: 'short_id already in use' }, { status: 409 });
    }

    const expiresHeader = req.headers.get('x-cmds-expires-at');
    const expiresAt = expiresHeader ? new Date(Number(expiresHeader)).toISOString() : null;

    const { error: rowError } = await db.from('shares').upsert({
      short_id: shortId,
      title: decodeTitle(req.headers.get('x-cmds-title')),
      encrypted: req.headers.get('x-cmds-encrypted') === '1',
      vault_id: vaultId,
      owner: id.owner,
      size_bytes: body.length,
      expires_at: expiresAt,
      revoked: false, // re-sharing un-revokes
      updated_at: new Date().toISOString(),
    });
    if (rowError) return NextResponse.json({ error: rowError.message }, { status: 500 });
  } else {
    await db.from('share_assets').upsert({ path: filename, vault_id: vaultId, owner: id.owner });
  }

  const { error: storageError } = await db.storage
    .from(BUCKET)
    .upload(filename, body, { contentType, upsert: true });
  if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 });

  const base = process.env.PUBLIC_BASE_URL || 'https://share.cmdspace.work';
  const url = isNote ? `${base}/${filename.replace(/\.html$/, '')}` : `${base}/f/${filename}`;
  return NextResponse.json({ filename, url });
}
