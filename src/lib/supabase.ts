import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const BUCKET = 'share-files';

let client: SupabaseClient | null = null;

export function serviceClient(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured');
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export interface ShareRow {
  short_id: string;
  title: string;
  encrypted: boolean;
  vault_id: string;
  size_bytes: number;
  view_count: number;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
  updated_at: string;
}
