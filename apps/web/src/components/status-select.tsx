"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { patchFeature } from "@/lib/api-client";
import { Select } from "@/components/ui/select";
import { statusLabel, statusOptions } from "@/lib/feature-helpers";

/** Inline status mover: only legal workflow transitions are offered. */
export function StatusSelect({
  specId,
  status,
  className,
}: {
  specId: string;
  status: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Select
      value={status}
      disabled={pending}
      className={className}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          await patchFeature(specId, { status: next });
          router.refresh();
        });
      }}
    >
      {statusOptions(status).map((s) => (
        <option key={s} value={s}>
          {statusLabel(s)}
        </option>
      ))}
    </Select>
  );
}
