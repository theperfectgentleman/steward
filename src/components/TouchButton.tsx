"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type TouchButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "lg";
  children: ReactNode;
};

const variants = {
  primary: "bg-primary text-white font-semibold hover:bg-primary-dark",
  secondary: "bg-accent text-white font-semibold hover:opacity-90",
  ghost: "bg-white text-charcoal border-2 border-charcoal/10 hover:border-charcoal/20",
  danger: "bg-charcoal text-white font-semibold hover:opacity-90",
};

const sizes = {
  md: "min-h-10 px-4 py-2 text-sm rounded-lg",
  lg: "min-h-12 px-5 py-2.5 text-base rounded-xl",
};

export function TouchButton({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: TouchButtonProps) {
  return (
    <button
      type="button"
      className={`touch-target inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
