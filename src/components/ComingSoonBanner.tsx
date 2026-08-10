export function ComingSoonBanner({
  message,
  className = "",
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-charcoal ${className}`}
      role="status"
    >
      {message}
    </div>
  );
}
