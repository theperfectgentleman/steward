"use client";

import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "./BottomSheet";
import { TouchButton } from "./TouchButton";
import { SegmentedControl } from "./SegmentedControl";

type TimelineGoal = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  progress: number;
};

type Props = {
  goal: TimelineGoal;
  canEdit: boolean;
  onSave: (goal: TimelineGoal) => Promise<void>;
};

function toDateInput(iso: string) {
  return iso.slice(0, 10);
}

export function TimelineEditor({ goal, canEdit, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(toDateInput(goal.startDate));
  const [endDate, setEndDate] = useState(toDateInput(goal.endDate));
  const [progress, setProgress] = useState(goal.progress);
  const [saving, setSaving] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStartDate(toDateInput(goal.startDate));
    setEndDate(toDateInput(goal.endDate));
    setProgress(goal.progress);
  }, [goal]);

  const handleProgressPointer = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setProgress(Math.round(ratio * 100));
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        ...goal,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        progress,
      });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => canEdit && setOpen(true)}
        disabled={!canEdit}
        className="w-full bg-white rounded-2xl border border-charcoal/10 p-5 space-y-3 text-left disabled:opacity-90"
      >
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-bold text-charcoal">{goal.title}</h3>
          <span className="text-sm font-semibold text-accent">{goal.progress}%</span>
        </div>
        <div className="h-4 rounded-full bg-primary/30 overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all"
            style={{ width: `${goal.progress}%` }}
          />
        </div>
        <p className="text-xs text-muted">
          {new Date(goal.startDate).toLocaleDateString()} —{" "}
          {new Date(goal.endDate).toLocaleDateString()}
          {canEdit && (
            <span className="text-accent font-semibold"> · Tap to adjust</span>
          )}
        </p>
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Adjust Timeline"
      >
        <div className="space-y-6">
          <p className="text-sm font-bold text-charcoal">{goal.title}</p>

          <div>
            <p className="text-sm font-semibold mb-3">Progress — drag the handle</p>
            <div
              ref={trackRef}
              className="relative h-4 rounded-full bg-primary/30 cursor-pointer touch-none"
              onPointerDown={(e) => {
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                handleProgressPointer(e.clientX);
              }}
              onPointerMove={(e) => {
                if (e.buttons === 1) handleProgressPointer(e.clientX);
              }}
            >
              <div
                className="absolute inset-y-0 left-0 bg-accent rounded-full"
                style={{ width: `${progress}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white border-4 border-accent shadow-md"
                style={{ left: `calc(${progress}% - 24px)` }}
                aria-hidden
              />
            </div>
            <p className="text-center text-lg font-bold text-accent mt-4">
              {progress}%
            </p>
            <div className="mt-3">
              <SegmentedControl
                options={[
                  { value: "0", label: "0%" },
                  { value: "25", label: "25%" },
                  { value: "50", label: "50%" },
                  { value: "75", label: "75%" },
                  { value: "100", label: "100%" },
                ]}
                value={String(Math.round(progress / 25) * 25)}
                onChange={(v) => setProgress(Number(v))}
              />
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-semibold">Start Date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-2 w-full input-touch px-4 rounded-xl border-2 border-charcoal/15 focus:border-primary outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold">End Date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-2 w-full input-touch px-4 rounded-xl border-2 border-charcoal/15 focus:border-primary outline-none"
            />
          </label>

          <TouchButton
            size="lg"
            className="w-full"
            disabled={saving || !startDate || !endDate}
            onClick={save}
          >
            {saving ? "Saving…" : "Save Timeline"}
          </TouchButton>
        </div>
      </BottomSheet>
    </>
  );
}
