"use client";

import type { InputHTMLAttributes } from "react";
import { useRef } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { FORM_FIELD_CLASS } from "@/lib/form-field";
import {
  formatDate,
  formatDateTime,
  toInputDateValue,
  toInputDateTimeValue,
} from "@/lib/dates";

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value"> & {
  type?: "date" | "datetime-local";
  value: string;
};

export function DateInput({
  className = "",
  type = "date",
  value,
  placeholder,
  onClick,
  ...props
}: DateInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const el = ref.current;
    if (!el || el.disabled) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  };

  const display =
    type === "datetime-local"
      ? value
        ? formatDateTime(value)
        : ""
      : value
        ? formatDate(value)
        : "";

  const placeholderText =
    (placeholder as string | undefined) ??
    (type === "datetime-local" ? "Select date & time" : "Select date");

  const fieldClass = className || FORM_FIELD_CLASS;

  return (
    <div className="relative">
      <input
        ref={ref}
        type={type}
        value={value}
        {...props}
        onClick={(e) => {
          openPicker();
          onClick?.(e);
        }}
        className={`date-input-field cursor-pointer text-transparent pr-10 ${fieldClass}`}
      />
      <span
        className={`pointer-events-none absolute inset-y-0 left-4 flex items-center text-base ${
          display ? "text-charcoal" : "text-muted"
        }`}
        aria-hidden
      >
        {display || placeholderText}
      </span>
      {type === "date" ? (
        <Calendar className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      ) : (
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      )}
    </div>
  );
}

export { toInputDateValue, toInputDateTimeValue };
