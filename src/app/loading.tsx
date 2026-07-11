import { PageShimmer } from "@/components/loading/PageShimmer";

export default function Loading() {
  return (
    <div className="px-4 py-5 lg:px-6 lg:py-6 max-w-[1600px] mx-auto w-full">
      <PageShimmer variant="cards" />
    </div>
  );
}
