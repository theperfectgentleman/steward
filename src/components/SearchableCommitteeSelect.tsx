"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { FORM_FIELD_WITH_ICON_CLASS } from "@/lib/form-field";

export type CommitteeOption = {
  id: string;
  name: string;
  charterLetter: string;
};

function formatCommittee(c: CommitteeOption) {
  return `${c.charterLetter.toUpperCase()}) ${c.name}`;
}

function matchesQuery(c: CommitteeOption, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    c.name.toLowerCase().includes(q) ||
    c.charterLetter.toLowerCase().includes(q)
  );
}

export function SearchableCommitteeSelect({
  committees,
  value,
  onChange,
  placeholder = "Search committees…",
  emptyLabel = "Select committee",
  id,
  disabled,
  allowEmpty = false,
  className = "",
}: {
  committees: CommitteeOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  id?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
  className?: string;
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => committees.find((c) => c.id === value) ?? null,
    [committees, value],
  );

  const filtered = useMemo(
    () => committees.filter((c) => matchesQuery(c, query)),
    [committees, query],
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const displayValue = open ? query : selected ? formatCommittee(selected) : "";

  const pick = (committeeId: string) => {
    onChange(committeeId);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleFocus = () => {
    if (disabled) return;
    setOpen(true);
    if (selected) {
      setQuery("");
    }
  };

  const handleChange = (next: string) => {
    setQuery(next);
    setOpen(true);
    if (!next.trim() && allowEmpty) {
      onChange("");
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={`${inputId}-listbox`}
          disabled={disabled}
          value={displayValue}
          placeholder={selected || open ? placeholder : emptyLabel}
          onFocus={handleFocus}
          onChange={(e) => handleChange(e.target.value)}
          className={`${FORM_FIELD_WITH_ICON_CLASS} ${className}`}
        />
        <ChevronDown
          className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </div>

      {open && !disabled && (
        <ul
          id={`${inputId}-listbox`}
          role="listbox"
          className="absolute z-50 mt-1.5 max-h-60 w-full overflow-y-auto rounded-xl border border-charcoal/10 bg-white py-1 shadow-lg"
        >
          {allowEmpty && !query.trim() && (
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick("")}
                className={`w-full px-3.5 py-2.5 text-left text-sm transition-colors ${
                  !value
                    ? "bg-primary/10 text-charcoal font-semibold"
                    : "text-muted hover:bg-slate-50 hover:text-charcoal"
                }`}
              >
                {emptyLabel}
              </button>
            </li>
          )}
          {filtered.length === 0 ? (
            <li className="px-3.5 py-3 text-sm text-muted">No committees match.</li>
          ) : (
            filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === c.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(c.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-sm transition-colors ${
                    value === c.id
                      ? "bg-primary/10 text-charcoal font-semibold"
                      : "text-charcoal hover:bg-slate-50"
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-[11px] font-bold uppercase text-accent">
                    {c.charterLetter}
                  </span>
                  <span className="truncate">{c.name}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
