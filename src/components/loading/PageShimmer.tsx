"use client";

type PageShimmerProps = {
  variant?: "page" | "list" | "cards" | "detail";
  lines?: number;
};

function ShimmerBar({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`shimmer rounded-xl bg-charcoal/8 ${className}`}
      aria-hidden
    />
  );
}

export function PageShimmer({
  variant = "page",
  lines = 4,
}: PageShimmerProps) {
  if (variant === "list") {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading">
        <ShimmerBar className="h-8 w-48" />
        <ShimmerBar className="h-4 w-64 max-w-full" />
        <div className="space-y-3 pt-2">
          {Array.from({ length: lines }).map((_, i) => (
            <ShimmerBar key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "cards") {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading">
        <div className="space-y-2">
          <ShimmerBar className="h-8 w-56" />
          <ShimmerBar className="h-4 w-72 max-w-full" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <ShimmerBar key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <ShimmerBar key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading">
        <ShimmerBar className="h-4 w-24" />
        <ShimmerBar className="h-9 w-2/3 max-w-md" />
        <ShimmerBar className="h-4 w-full max-w-lg" />
        <ShimmerBar className="h-40 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <ShimmerBar key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <ShimmerBar className="h-8 w-52" />
        <ShimmerBar className="h-4 w-80 max-w-full" />
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <ShimmerBar key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-16"
      aria-busy="true"
      aria-label={label}
    >
      <div className="logo-entrance h-12 w-12 rounded-full border-2 border-primary/25 border-t-primary" />
      <p className="text-sm font-medium text-muted">{label}</p>
    </div>
  );
}
