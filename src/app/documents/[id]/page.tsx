"use client";

import { use } from "react";
import { DocumentStudioView } from "@/components/views/DocumentStudioView";

export default function DocumentStudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <DocumentStudioView id={id} />;
}
