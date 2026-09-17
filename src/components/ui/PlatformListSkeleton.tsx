export function PlatformListSkeleton({
  title,
  eyebrow,
}: {
  title: string;
  eyebrow: string;
}) {
  return (
    <main className="platform-page" aria-busy="true" aria-label="加载中">
      <header className="platform-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
      </header>
      <section className="pattern-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="pattern-card animate-pulse border border-[#eadfce] bg-[#fffaf3]/80"
          >
            <div className="pattern-preview min-h-32 bg-[#eadfce]/60" />
            <div className="pattern-card-body pattern-card-body--padded space-y-2 p-3">
              <div className="h-4 w-2/3 rounded bg-[#eadfce]" />
              <div className="h-3 w-1/2 rounded bg-[#eadfce]/80" />
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
