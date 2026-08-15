export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Pretendard Variable", Pretendard, sans-serif',
        padding: 24,
        textAlign: 'center',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://cmdspace.work/assets/logos/cmds-logo-round.png"
        alt="CMDSPACE"
        width={64}
        height={64}
        style={{ borderRadius: '50%' }}
      />
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>CMDS Share</h1>
      <p style={{ opacity: 0.65, fontSize: 15, maxWidth: 380, lineHeight: 1.6 }}>
        Instant note sharing for Obsidian, governed by CMDSPACE. Shared notes live at{' '}
        <code>share.cmdspace.work/&#123;id&#125;</code>.
      </p>
      <a
        href="https://cmdspace.work"
        style={{ color: '#134538', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}
      >
        cmdspace.work →
      </a>
    </main>
  );
}
