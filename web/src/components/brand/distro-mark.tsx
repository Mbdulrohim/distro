/**
 * The Distro monogram: a geometric "D" whose spine distributes into stacked
 * recipient rows — one source, many destinations. The mark is drawn in
 * `currentColor`, so it tracks the surrounding text color and works in both
 * themes without a variant. Size it with a className (`h-5 w-5`).
 */
export function DistroMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="30 27 69 74"
      fill="currentColor"
      className={className}
      role="img"
      aria-label="Distro"
    >
      <path
        fillRule="evenodd"
        d="M35 32 H62 A32 32 0 0 1 62 96 H35 Z M49 46 H60 A18 18 0 0 1 60 82 H49 Z"
      />
      <rect x="50" y="52" width="18" height="4.4" rx="2.2" />
      <rect x="50" y="61.8" width="24" height="4.4" rx="2.2" />
      <rect x="50" y="71.6" width="15" height="4.4" rx="2.2" />
    </svg>
  );
}
