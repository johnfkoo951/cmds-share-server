/**
 * Minimal v4.3-styled standalone HTML pages for public error states.
 * CMDS Green #134538 (light) / CMDS Pink #E985A2 (dark), SF Pro/Pretendard stack.
 */

const LOGO = 'https://cmdspace.work/assets/logos/cmds-logo-round.png';

function shell(title: string, heading: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} — CMDS Share</title>
<link rel="icon" href="${LOGO}">
<style>
:root{--bg:#fbfbfa;--fg:#0a0d0b;--muted:#4a544f;--accent:#134538;--line:#e6e8e6}
@media(prefers-color-scheme:dark){:root{--bg:#06080a;--fg:#f2f4f3;--muted:#9aa39d;--accent:#e985a2;--line:#1a231f}}
*{margin:0;box-sizing:border-box}
body{background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Pretendard Variable",Pretendard,"Apple SD Gothic Neo",sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
main{max-width:420px;text-align:center}
img{width:56px;height:56px;border-radius:50%;margin-bottom:24px}
h1{font-size:22px;font-weight:700;letter-spacing:-.02em;margin-bottom:12px}
p{color:var(--muted);font-size:15px;line-height:1.6}
a{color:var(--accent);text-decoration:none;font-weight:600}
a:hover{text-decoration:underline}
footer{margin-top:40px;padding-top:20px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}
</style>
</head>
<body>
<main>
<img src="${LOGO}" alt="CMDSPACE">
<h1>${heading}</h1>
<p>${body}</p>
<footer>Shared via <a href="https://cmdspace.work">CMDS Share</a></footer>
</main>
</body>
</html>`;
}

export function notFoundPage(): string {
  return shell('Not Found', '노트를 찾을 수 없습니다', 'This shared note does not exist or the link is incorrect.');
}

export function gonePage(reason: 'expired' | 'revoked', title?: string): string {
  const heading = reason === 'expired' ? '만료된 공유입니다' : '공유가 취소되었습니다';
  const detail =
    reason === 'expired'
      ? 'This shared note has expired and is no longer available.'
      : 'The author has revoked access to this shared note.';
  const body = title ? `<strong>${escapeHtml(title)}</strong><br>${detail}` : detail;
  return shell('Gone', heading, body);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
