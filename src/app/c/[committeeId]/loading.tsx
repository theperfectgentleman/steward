import { PageShimmer } from "@/components/loading/PageShimmer";

export default function CommitteeLoading() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="shimmer h-10 w-24 shrink-0 rounded-xl bg-charcoal/8"
            aria-hidden
          />
        ))}
      </div>
      <PageShimmer variant="list" lines={5} />
    </div>
  );
}
