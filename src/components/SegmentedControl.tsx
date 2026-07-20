"use client";

type SegmentedControlProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: SegmentedControlProps<T>) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Segmented control"
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`flex-1 min-w-[calc(50%-0.25rem)] touch-target rounded-lg px-3 py-2 text-sm font-semibold border transition-all active:scale-[0.98] ${
              selected
                ? "bg-primary border-primary text-white shadow-sm"
                : "bg-white border-charcoal/15 text-charcoal hover:border-charcoal/30"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
