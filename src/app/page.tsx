'use client';

import { useCallback, useEffect, useState } from 'react';

const LOGO = 'https://cmdspace.work/assets/logos/cmds-logo-round.png';
const TOKEN_KEY = 'cmds-admin-token';

interface RemoteNote {
  shortId: string;
  title: string;
  encrypted: boolean;
  viewCount: number;
  expiresAt?: number;
  revoked: boolean;
  sizeBytes: number;
  createdAt: number;
  updatedAt: number;
  owner?: string;
}

interface Viewer {
  owner: string;
  admin: boolean;
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtSize(bytes: number): string {
  if (bytes >= 1_000_000) return (bytes / 1_000_000).toFixed(1) + ' MB';
  if (bytes >= 1_000) return Math.round(bytes / 1_000) + ' KB';
  return bytes + ' B';
}

function statusOf(n: RemoteNote): 'live' | 'revoked' | 'expired' {
  if (n.revoked) return 'revoked';
  if (n.expiresAt && n.expiresAt < Date.now()) return 'expired';
  return 'live';
}

export default function Dashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [notes, setNotes] = useState<RemoteNote[] | null>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    try { setToken(localStorage.getItem(TOKEN_KEY)); } catch {}
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  };

  const api = useCallback(
    (path: string, init: RequestInit = {}) =>
      fetch(path, { ...init, headers: { ...(init.headers || {}), 'x-cmds-token': token || '' } }),
    [token]
  );

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    const res = await api('/v1/notes');
    if (res.status === 401) {
      setError('Token rejected. Check the token and try again.');
      setNotes(null);
      return;
    }
    if (!res.ok) {
      setError(`Server error (${res.status})`);
      return;
    }
    const data = await res.json();
    setNotes(data.notes || []);
    setViewer(data.viewer || null);
  }, [api, token]);

  useEffect(() => { load(); }, [load]);

  const saveToken = () => {
    const t = tokenInput.trim();
    if (!t) return;
    try { localStorage.setItem(TOKEN_KEY, t); } catch {}
    setToken(t);
  };

  const signOut = () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
    setToken(null);
    setNotes(null);
    setViewer(null);
    setTokenInput('');
  };

  const copyLink = (n: RemoteNote) => {
    navigator.clipboard.writeText(`${location.origin}/${n.shortId}`);
    showToast('Link copied');
  };

  const toggleRevoke = async (n: RemoteNote) => {
    setBusy(n.shortId);
    const res = await api('/v1/notes/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shortId: n.shortId, revoked: !n.revoked }),
    });
    setBusy('');
    if (res.ok) {
      showToast(n.revoked ? 'Access restored' : 'Access revoked');
      load();
    } else showToast('Failed');
  };

  const remove = async (n: RemoteNote) => {
    if (!confirm(`Delete "${n.title || n.shortId}" permanently?\nThe link will stop working.`)) return;
    setBusy(n.shortId);
    const res = await api('/v1/file/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: `${n.shortId}.html` }),
    });
    setBusy('');
    if (res.ok) {
      showToast('Deleted');
      load();
    } else showToast('Delete failed');
  };

  const stats = notes
    ? {
        total: notes.length,
        views: notes.reduce((s, n) => s + n.viewCount, 0),
        live: notes.filter(n => statusOf(n) === 'live').length,
        encrypted: notes.filter(n => n.encrypted).length,
      }
    : null;

  return (
    <main className="wrap">
      <div className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt="CMDSPACE" />
        <div>
          <h1>CMDS Share</h1>
          <div className="sub">Instant note sharing for Obsidian — governed by CMDSPACE</div>
        </div>
      </div>

      {!token && (
        <div className="card" style={{ maxWidth: 460 }}>
          <p className="muted" style={{ marginBottom: 14 }}>
            This is the share dashboard. Paste your API token to manage your shared notes —
            the same token configured in the CMDS Share plugin settings.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              type="password"
              placeholder="API token"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveToken()}
            />
            <button className="btn btn-primary" onClick={saveToken}>Open</button>
          </div>
          <p className="muted" style={{ marginTop: 16, fontSize: 12.5 }}>
            No token? The CMDSPACE-hosted server is invite-only —{' '}
            <a href="https://github.com/johnfkoo951/cmds-share#hosting-options" target="_blank" rel="noopener">
              see hosting options
            </a>{' '}
            for self-hosting and other backends.
          </p>
        </div>
      )}

      {token && error && (
        <div className="card">
          <p className="muted">{error}</p>
          <button className="btn" style={{ marginTop: 10 }} onClick={signOut}>Enter a different token</button>
        </div>
      )}

      {token && notes && (
        <>
          <div className="stat-row">
            <div className="stat"><b>{stats!.total}</b><span>Shared notes</span></div>
            <div className="stat"><b>{stats!.views}</b><span>Total views</span></div>
            <div className="stat"><b>{stats!.live}</b><span>Live</span></div>
            <div className="stat"><b>{stats!.encrypted}</b><span>Encrypted</span></div>
          </div>

          <div className="card">
            <div className="toolbar">
              <span className="muted" style={{ fontSize: 12.5 }}>
                {viewer?.owner ? (viewer.admin ? `${viewer.owner} (admin — all uploaders shown)` : `${viewer.owner} — your shares only`) : 'Sorted by last update'}
                {' · encrypted notes can only be read with their original key link'}
              </span>
              <div className="btns">
                <button className="btn" onClick={load}>Refresh</button>
                <button className="btn" onClick={signOut}>Sign out</button>
              </div>
            </div>

            {notes.length === 0 && (
              <p className="muted" style={{ padding: '1.2rem 0.4rem' }}>
                No shared notes yet. Share one from Obsidian with the CMDS Share plugin.
              </p>
            )}

            {notes.map(n => {
              const st = statusOf(n);
              return (
                <div className="share-item" key={n.shortId}>
                  <div className="share-main">
                    <div className="share-title">
                      <a href={`/${n.shortId}`} target="_blank" rel="noopener">
                        {n.title || n.shortId}
                      </a>{' '}
                      {st === 'live' && <span className="pill pill-live">live</span>}
                      {st === 'revoked' && <span className="pill pill-revoked">revoked</span>}
                      {st === 'expired' && <span className="pill pill-expired">expired</span>}
                      {n.encrypted && <span className="pill pill-encrypted">e2e</span>}
                      {n.owner != null && <span className="pill pill-owner">{n.owner || 'unattributed'}</span>}
                    </div>
                    <div className="share-meta">
                      /{n.shortId} · {n.viewCount} views · {fmtSize(n.sizeBytes)} · updated {fmtDate(n.updatedAt)}
                      {n.expiresAt ? ` · expires ${fmtDate(n.expiresAt)}` : ''}
                    </div>
                  </div>
                  <button className="btn" onClick={() => copyLink(n)}>Copy link</button>
                  <button className="btn" disabled={busy === n.shortId} onClick={() => toggleRevoke(n)}>
                    {n.revoked ? 'Restore' : 'Revoke'}
                  </button>
                  <button className="btn btn-danger" disabled={busy === n.shortId} onClick={() => remove(n)}>
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="footer">
        <a href="https://github.com/johnfkoo951/cmds-share" target="_blank" rel="noopener">CMDS Share plugin</a>
        {' · '}
        <a href="https://cmdspace.work" target="_blank" rel="noopener">cmdspace.work</a>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
