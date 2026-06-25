export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="py-16 px-6 border-t border-[var(--color-ink-muted)]/15">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--color-ink-muted)]">
        <div className="flex items-center gap-3">
          <span className="font-[family-name:var(--font-caveat)] text-base text-[var(--color-ink-soft)]">
            made with too much time
          </span>
          <span>·</span>
          <span>denver, {year}</span>
        </div>
        <div className="text-[10px] tracking-wide uppercase">
          no fees · no commitment · operators not actually standing by
        </div>
      </div>
    </footer>
  );
}
