"use client";

import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { FORM_FIELD_CLASS } from "@/lib/form-field";
import { PeoplePicker } from "./PeoplePicker";

type PeoplePickerFieldProps = {
  mode?: "single" | "multi";
  committeeId?: string | null;
  excludeIds?: string[];
  /** Display label when empty */
  placeholder?: string;
  /** Currently selected user ids (multi) or single id as one-element array */
  selectedIds?: string[];
  /** Optional map for showing names without waiting for directory */
  nameById?: Record<string, string>;
  title?: string;
  disabled?: boolean;
  className?: string;
  onConfirm: (
    userIds: string[],
    people: { id: string; name: string }[],
  ) => void;
};

export function PeoplePickerField({
  mode = "multi",
  committeeId,
  excludeIds = [],
  placeholder = "Select people…",
  selectedIds = [],
  nameById = {},
  title,
  disabled,
  className = "",
  onConfirm,
}: PeoplePickerFieldProps) {
  const [open, setOpen] = useState(false);

  const label =
    selectedIds.length === 0
      ? placeholder
      : selectedIds.length === 1
        ? nameById[selectedIds[0]] ?? "1 person selected"
        : `${selectedIds.length} people selected`;

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`${FORM_FIELD_CLASS} flex items-center justify-between text-left ${
          selectedIds.length === 0 ? "text-muted" : ""
        } ${className}`}
      >
        <span className="truncate">{label}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted" />
      </button>
      <PeoplePicker
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        mode={mode}
        committeeId={committeeId}
        excludeIds={excludeIds}
        value={selectedIds}
        onConfirm={(ids, people) => {
          onConfirm(ids, people);
          setOpen(false);
        }}
      />
    </>
  );
}
