export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`logo${compact ? ' logo-compact' : ''}`}>
      <span className="logo-mark" aria-hidden>
        <svg viewBox="0 0 64 64">
          <path
            d="M14 22h36a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6H40l-4-5h-8l-4 5H14a6 6 0 0 1-6-6V28a6 6 0 0 1 6-6z"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path d="M19 30v8M15 34h8" stroke="var(--classic)" strokeWidth="4" strokeLinecap="round" />
          <circle cx="43" cy="31" r="2.6" fill="var(--warn)" />
          <circle cx="48" cy="36" r="2.6" fill="var(--accent)" />
        </svg>
      </span>
      <span className="logo-text">
        <span className="logo-top">House of Gaming</span>
        <span className="logo-main">
          LAN<span className="logo-dash">//</span>VOTE
        </span>
      </span>
    </div>
  );
}
