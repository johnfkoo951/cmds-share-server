-- Member API tokens, managed from the dashboard instead of the CMDS_API_TOKENS env var.
--
-- Tokens are stored as a sha256 hash: a database leak must not hand out working
-- credentials. The raw value is shown once, at issue time, and never again --
-- a lost token is reissued, not recovered. `token_hint` keeps the last 4
-- characters so a row can still be matched against a token someone is holding.
create table if not exists api_tokens (
  id           uuid primary key default gen_random_uuid(),
  owner        text not null,
  token_hash   text not null unique,
  token_hint   text not null default '',
  admin        boolean not null default false,
  disabled     boolean not null default false,
  note         text not null default '',
  created_at   timestamptz not null default now(),
  created_by   text not null default '',
  last_used_at timestamptz,
  use_count    bigint not null default 0
);

create index if not exists api_tokens_owner_idx on api_tokens (owner);

alter table api_tokens enable row level security;
-- no public policies: every read/write goes through route handlers holding the
-- service-role key, exactly like `shares`.

-- Usage accounting runs after the response is sent, so it must be atomic on its
-- own rather than a read-modify-write from the handler.
create or replace function touch_token(p_id uuid)
returns void language sql as
$$ update api_tokens
     set last_used_at = now(), use_count = use_count + 1
   where id = p_id $$;
