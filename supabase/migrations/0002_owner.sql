-- Per-token ownership: every share/asset records who uploaded it.
-- Owner names come from the server's CMDS_API_TOKENS "name:token" entries.
alter table shares add column if not exists owner text not null default '';
create index if not exists shares_owner_idx on shares (owner, updated_at desc);
alter table share_assets add column if not exists owner text not null default '';
