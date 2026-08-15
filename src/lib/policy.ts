import { NextRequest } from 'next/server';
import { ShareRow } from './supabase';

/**
 * Governance policy knobs, decided 2026-08 (yohan):
 *  ① collision: vault-protected upsert  ② expiry: title tombstone  ③ views: skip bot UAs
 * Each branch is deliberately small so future policy changes stay one-screen reviews.
 */

/**
 * Same vault re-uploading an id = re-share (overwrite, link preserved).
 * A different vault claiming an existing id gets a 409 — a leaked token
 * can't silently replace another vault's published note.
 */
export function collisionPolicy(existing: ShareRow | null, incomingVaultId: string): 'upsert' | 'reject' {
  if (existing && existing.vault_id !== incomingVaultId) return 'reject';
  return 'upsert';
}

/**
 * Expired shares show a 410 page that still names the note, so a visitor
 * knows what they missed and can ask the author to re-share.
 * (Content itself is already unreachable; the cron hard-deletes after the grace period.)
 */
export function expiredPageMode(_row: ShareRow): 'gone' | 'tombstone' {
  return 'tombstone';
}

const BOT_UA = /bot|crawler|spider|crawling|preview|facebookexternalhit|slurp|scrape|kakaotalk-scrap|slack|discord|telegram|whatsapp|curl|wget|python-requests|headless/i;

/**
 * Link-preview crawlers (KakaoTalk, Slack, Discord, search bots) fetch every
 * shared URL the moment it's pasted — without this filter, view counts measure
 * messenger usage, not readers.
 */
export function shouldCountView(req: NextRequest): boolean {
  const ua = req.headers.get('user-agent') || '';
  if (!ua) return false;
  return !BOT_UA.test(ua);
}
