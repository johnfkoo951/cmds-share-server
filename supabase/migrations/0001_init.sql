-- CMDS Share governance server — initial schema
create table shares (
  short_id     text primary key,
  title        text not null default '',
  encrypted    boolean not null default false,
  vault_id     text not null,
  size_bytes   bigint not null default 0,
  view_count   bigint not null default 0,
  expires_at   timestamptz,
  revoked      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index shares_vault_idx on shares (vault_id, updated_at desc);
create index shares_expires_idx on shares (expires_at) where expires_at is not null;

create table share_assets (
  path       text primary key,
  vault_id   text not null,
  created_at timestamptz not null default now()
);

alter table shares enable row level security;
alter table share_assets enable row level security;
-- no public policies: all access goes through route handlers with the service-role key

create or replace function increment_view(p_short_id text)
returns void language sql as
$$ update shares set view_count = view_count + 1 where short_id = p_short_id $$;
