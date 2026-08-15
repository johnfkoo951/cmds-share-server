import { NextRequest } from 'next/server';
import { ShareRow } from './supabase';

/**
 * Governance policy knobs. Each function has a working default; the branch bodies
 * are deliberately small so policy changes stay one-screen reviews.
 */

/**
 * TODO(yohan) — contribution point 1: slug/collision policy.
 * The plugin generates the shortId; the server currently upserts (same id = overwrite).
 * Return 'reject' to 409 when an id exists but belongs to a DIFFERENT vault
 * (protects against cross-vault overwrite with a stolen token), or 'upsert' to always overwrite.
 */
export function collisionPolicy(existing: ShareRow | null, incomingVaultId: string): 'upsert' | 'reject' {
  if (existing && existing.vault_id !== incomingVaultId) return 'reject';
  return 'upsert';
}

/**
 * TODO(yohan) — contribution point 2: expiry semantics.
 * 'gone' → hard 410 page with no note information.
 * 'tombstone' → 410 page that still shows the note title, so the visitor knows what they missed.
 */
export function expiredPageMode(_row: ShareRow): 'gone' | 'tombstone' {
  return 'gone';
}

/**
 * TODO(yohan) — contribution point 3: view-count filter.
 * Default counts every GET. Options: skip known bot UAs, or dedupe per IP-hash per hour.
 */
export function shouldCountView(_req: NextRequest): boolean {
  return true;
}
