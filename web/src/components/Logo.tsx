/** A ballot box with a pen cross, next to the plain wordmark. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`logo${compact ? ' logo-compact' : ''}`}>
      <svg className="logo-mark" viewBox="0 0 64 64" aria-hidden>
        <rect x="4" y="4" width="56" height="56" rx="2" fill="var(--sheet)" stroke="var(--ink)" strokeWidth="6" />
        <path
          d="M15 16c9.5 9.4 19 19.6 34 33M48 15C38.6 23.7 28.4 34.4 16 49"
          fill="none"
          stroke="var(--pen)"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </svg>
      <span className="logo-text">
        <span className="logo-top">House of Gaming</span>
        <span className="logo-main">LAN-Wahl</span>
      </span>
    </div>
  );
}
