import { NextRequest, NextResponse } from 'next/server';
import { serviceClient, BUCKET } from '@/lib/supabase';

export const runtime = 'nodejs';

const PATH_RE = /^(css\/[a-f0-9]{40}\.css|assets\/[a-f0-9]{40}\.[a-z0-9]{1,8})$/;

const MIME: Record<string, string> = {
  css: 'text/css; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const filename = path.join('/');
  if (!PATH_RE.test(filename)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const db = serviceClient();
  const { data: file, error } = await db.storage.from(BUCKET).download(filename);
  if (error || !file) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const ext = filename.split('.').pop() || '';
  return new NextResponse(await file.arrayBuffer(), {
    status: 200,
    headers: {
      'content-type': MIME[ext] || 'application/octet-stream',
      // content-addressed (sha1 in the name) → safe to cache forever
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
