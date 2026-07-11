"use client";

import Image from "next/image";
import logoTransparent from "@/assets/steward_icon_transparent_bg.png";
import logoSolid from "@/assets/steward_icon.png";

type BrandLogoProps = {
  size?: number;
  variant?: "transparent" | "solid";
  className?: string;
  priority?: boolean;
  /** One-shot classy spin-in on mount (for load / auth screens). */
  entrance?: boolean;
};

export function BrandLogo({
  size = 40,
  variant = "transparent",
  className = "",
  priority = false,
  entrance = false,
}: BrandLogoProps) {
  const src = variant === "solid" ? logoSolid : logoTransparent;
  return (
    <Image
      src={src}
      alt="Steward"
      width={size}
      height={size}
      className={`object-contain ${entrance ? "logo-entrance" : ""} ${className}`.trim()}
      priority={priority}
      style={entrance ? { borderRadius: "50%" } : undefined}
    />
  );
}
