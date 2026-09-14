'use client';

import { useState } from 'react';

export interface TokenInfo {
  id: string;
  owner: string;
  hint: string;
  admin: boolean;
  disabled: boolean;
  note: string;
  createdAt: number;
  createdBy: string;
  lastUsedAt: number | null;
  useCount: number;
}

interface LegacyToken {
  owner: string;
  admin: boolean;
  hint: string;
}

export interface TokensPayload {
  tokens: TokenInfo[];
  legacy: LegacyToken[];
}

interface Props {
  api: (path: string, init?: RequestInit) => Promise<Response>;
  showToast: (msg: string) => void;
  /** Row id of the token this browser is signed in with, when it has one. */
  viewerTokenId: string | null;
  /** Share counts per member, so a token can be read against real activity. */
  shareCounts: Map<string, number>;
  /** Fetched by the parent when this tab is opened -- null while in flight. */
  data: TokensPayload | null;
  error: string;
  reload: () => Promise<void>;
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtLastUsed(ts: number | null): string {
  if (!ts) return 'never';
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(ts);
}

export default function TokensPanel({
  api, showToast, viewerTokenId, shareCounts, data, error, reload,
}: Props) {
  const [busy, setBusy] = useState('');
  const [name, setName] = useState('');
  const [asAdmin, setAsAdmin] = useState(false);
  // The one and only time the raw secret exists outside the member's hands.
  const [issued, setIssued] = useState<{ owner: string; token: string } | null>(null);

  const issue = async () => {
    const owner = name.trim();
    if (!owner) return;
    setBusy('issue');
    const res = await api('/v1/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner, admin: asAdmin }),
    });
    setBusy('');
    const body = await res.json().catch(() => ({} as Record<string, string>));
    if (!res.ok) return showToast(body.error || 'Could not issue token');
    setIssued({ owner, token: body.token });
    setName('');
    setAsAdmin(false);
    void reload();
  };

  const patch = async (t: TokenInfo, changes: Record<string, unknown>, okMsg: string) => {
    setBusy(t.id);
    const res = await api(`/v1/tokens/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });
    setBusy('');
    const body = await res.json().catch(() => ({} as Record<string, string>));
    if (!res.ok) return showToast(body.error || 'Failed');
    showToast(okMsg);
    void reload();
  };

  const remove = async (t: TokenInfo) => {
    const shares = shareCounts.get(t.owner) ?? 0;
    const warning = shares
      ? `\n\n${t.owner} has ${shares} shared note${shares === 1 ? '' : 's'}. Those stay online — delete them separately if you want them gone.`
      : '';
    if (!confirm(`Delete ${t.owner}'s token (••••${t.hint})?\nThey will lose access immediately.${warning}`)) return;
    setBusy(t.id);
    const res = await api(`/v1/tokens/${t.id}`, { method: 'DELETE' });
    setBusy('');
    const body = await res.json().catch(() => ({} as Record<string, string>));
    if (!res.ok) return showToast(body.error || 'Delete failed');
    showToast('Token deleted');
    void reload();
  };

  const adopt = async (l: LegacyToken) => {
    setBusy('legacy-' + l.hint);
    const res = await api('/v1/tokens/adopt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner: l.owner, hint: l.hint }),
    });
    setBusy('');
    const body = await res.json().catch(() => ({} as Record<string, string>));
    if (!res.ok) return showToast(body.error || 'Could not adopt');
    showToast('Adopted — the member keeps the same token');
    void reload();
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Token copied');
  };

  if (error) return <div className="card"><p className="muted">{error}</p></div>;
  if (!data) return <div className="card"><p className="muted">Loading members…</p></div>;
  const { tokens, legacy } = data;

  return (
    <>
      {issued && (
        <div className="card secret-card">
          <div className="secret-head">
            Token for <b>{issued.owner}</b> — copy it now
          </div>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
            Only the hash is stored, so this is the last time it can be shown. If it is lost,
            delete the token and issue a new one.
          </p>
          <div className="secret-value">
            <code>{issued.token}</code>
            <button className="btn btn-primary" onClick={() => copy(issued.token)}>Copy</button>
          </div>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>
            Send it to {issued.owner} and have them paste it into the CMDS Share plugin&apos;s
            <b> API token</b> field.
          </p>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => setIssued(null)}>Done</button>
        </div>
      )}

      <div className="card">
        <div className="toolbar">
          <span className="muted" style={{ fontSize: 12.5 }}>
            Issue a token per member — each share is attributed to whoever uploaded it
          </span>
          <div className="btns">
            <button className="btn" onClick={() => void reload()}>Refresh</button>
          </div>
        </div>

        <div className="issue-row">
          <input
            className="input"
            placeholder="Member name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && issue()}
          />
          <label className="check">
            <input type="checkbox" checked={asAdmin} onChange={e => setAsAdmin(e.target.checked)} />
            Admin
          </label>
          <button className="btn btn-primary" disabled={busy === 'issue' || !name.trim()} onClick={issue}>
            {busy === 'issue' ? 'Issuing…' : 'Issue token'}
          </button>
        </div>
        {asAdmin && (
          <p className="muted" style={{ fontSize: 12.5, marginTop: -2, marginBottom: 10 }}>
            An admin sees and manages every member&apos;s shares, and can issue and revoke tokens.
          </p>
        )}

        <div className="token-row head">
          <span>Member</span><span>Token</span><span>Status</span>
          <span className="num hide-sm">Shares</span><span className="hide-sm">Last used</span><span />
        </div>

        {tokens.length === 0 && (
          <p className="muted" style={{ padding: '1.2rem 0.4rem' }}>
            No tokens issued yet.{legacy.length > 0 && ' The env tokens below still work.'}
          </p>
        )}

        {tokens.map(t => {
          const isMine = t.id === viewerTokenId;
          return (
            <div className="token-row" key={t.id}>
              <span className="name">
                {t.owner}
                {t.admin && <span className="pill pill-live">admin</span>}
                {isMine && <span className="pill pill-owner">you</span>}
              </span>
              <span className="mono">••••{t.hint}</span>
              <span>
                {t.disabled
                  ? <span className="pill pill-revoked">disabled</span>
                  : t.lastUsedAt
                    ? <span className="pill pill-live">active</span>
                    : <span className="pill pill-expired">unused</span>}
              </span>
              <span className="num hide-sm">{shareCounts.get(t.owner) ?? 0}</span>
              <span className="hide-sm" style={{ color: 'var(--fg-faint)', fontSize: 12.5 }}>
                {fmtLastUsed(t.lastUsedAt)}
                {t.useCount > 0 && ` · ${t.useCount} calls`}
              </span>
              <span className="btns">
                <button
                  className="btn"
                  disabled={busy === t.id}
                  onClick={() => patch(t, { disabled: !t.disabled }, t.disabled ? 'Token enabled' : 'Token disabled')}
                >
                  {t.disabled ? 'Enable' : 'Disable'}
                </button>
                <button className="btn btn-danger" disabled={busy === t.id} onClick={() => remove(t)}>Delete</button>
              </span>
            </div>
          );
        })}
      </div>

      {legacy.length > 0 && (
        <div className="card">
          <div className="toolbar">
            <span className="muted" style={{ fontSize: 12.5 }}>
              Tokens from the <code>CMDS_API_TOKENS</code> environment variable. They still work,
              but cannot be tracked or disabled from here until adopted.
            </span>
          </div>
          {legacy.map(l => (
            <div className="token-row" key={l.hint + l.owner}>
              <span className="name">
                {l.owner || 'unattributed'}
                {l.admin && <span className="pill pill-live">admin</span>}
                <span className="pill pill-expired">env</span>
              </span>
              <span className="mono">••••{l.hint}</span>
              <span className="muted" style={{ fontSize: 12.5 }}>not tracked</span>
              <span className="num hide-sm">{shareCounts.get(l.owner) ?? 0}</span>
              <span className="hide-sm" />
              <span className="btns">
                <button className="btn" disabled={busy === 'legacy-' + l.hint} onClick={() => adopt(l)}>
                  Adopt
                </button>
              </span>
            </div>
          ))}
          <p className="muted" style={{ fontSize: 12.5, paddingTop: 10 }}>
            Adopting keeps the same secret, so nobody has to change their plugin settings.
            Once every entry is adopted you can clear <code>CMDS_API_TOKENS</code> and redeploy.
          </p>
        </div>
      )}
    </>
  );
}
