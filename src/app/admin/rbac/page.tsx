"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { TouchButton } from "@/components/TouchButton";
import { FormSelect } from "@/components/FormSelect";
import { FORM_FIELD_CLASS } from "@/lib/form-field";
import { useApp } from "@/providers/AppProvider";
import type { ApprovalStackRole, ApprovalStackStep } from "@/lib/types";

const APPROVAL_ROLE_OPTIONS: { value: ApprovalStackRole; label: string }[] = [
  { value: "COMMITTEE_CHAIR", label: "Committee chair" },
  { value: "COMMITTEE_SECRETARY", label: "Committee secretary" },
  { value: "SUPERVISORY_SECRETARY", label: "Supervisory secretary" },
  { value: "SUPERVISORY_HEAD", label: "Supervisory head" },
];

const ROLE_DEFAULT_LABELS: Record<ApprovalStackRole, string> = {
  COMMITTEE_CHAIR: "Chair",
  COMMITTEE_SECRETARY: "Secretary",
  SUPERVISORY_SECRETARY: "Supervisory secretary",
  SUPERVISORY_HEAD: "Supervisory head",
  SUPERVISORY_TITLE: "Supervisory title",
};

function RbacConsole() {
  const { appSettings, refreshAppSettings } = useApp();
  const [templates, setTemplates] = useState<
    { id: string; key: string; name: string; capabilities: Record<string, boolean> }[]
  >([]);
  const [policies, setPolicies] = useState({
    allowCrossCommitteeRead: false,
    requireOversightOnSelfInitiated: true,
    allowSupervisoryAssignMembers: true,
    supervisoryLabel: "Supervisory Group",
    committeeLabel: "Committee",
  });
  const [approvalStack, setApprovalStack] = useState<ApprovalStackStep[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingStack, setSavingStack] = useState(false);

  useEffect(() => {
    if (appSettings) {
      setPolicies({
        allowCrossCommitteeRead: appSettings.allowCrossCommitteeRead,
        requireOversightOnSelfInitiated:
          appSettings.requireOversightOnSelfInitiated,
        allowSupervisoryAssignMembers:
          appSettings.allowSupervisoryAssignMembers,
        supervisoryLabel: appSettings.supervisoryLabel,
        committeeLabel: appSettings.committeeLabel,
      });
      setApprovalStack(
        Array.isArray(appSettings.approvalStack)
          ? [...appSettings.approvalStack].sort((a, b) => a.order - b.order)
          : [],
      );
    }
    fetch("/api/structure")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.roleTemplates) setTemplates(data.roleTemplates);
      })
      .catch(() => undefined);
  }, [appSettings]);

  const savePolicies = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policies),
      });
      refreshAppSettings();
    } finally {
      setSaving(false);
    }
  };

  const saveApprovalStack = async () => {
    setSavingStack(true);
    try {
      const normalized = approvalStack.map((step, index) => ({
        ...step,
        order: index + 1,
        label: step.label.trim() || ROLE_DEFAULT_LABELS[step.role],
      }));
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStack: normalized }),
      });
      setApprovalStack(normalized);
      refreshAppSettings();
    } finally {
      setSavingStack(false);
    }
  };

  const updateStep = (index: number, patch: Partial<ApprovalStackStep>) => {
    setApprovalStack((prev) =>
      prev.map((step, i) => {
        if (i !== index) return step;
        const next = { ...step, ...patch };
        if (patch.role && !patch.label) {
          next.label = ROLE_DEFAULT_LABELS[patch.role];
        }
        return next;
      }),
    );
  };

  const addStep = () => {
    setApprovalStack((prev) => [
      ...prev,
      {
        order: prev.length + 1,
        role: "COMMITTEE_CHAIR",
        label: ROLE_DEFAULT_LABELS.COMMITTEE_CHAIR,
      },
    ]);
  };

  const removeStep = (index: number) => {
    setApprovalStack((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((step, i) => ({ ...step, order: i + 1 })),
    );
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    setApprovalStack((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((step, i) => ({ ...step, order: i + 1 }));
    });
  };

  const toggleCapability = async (
    key: string,
    capability: string,
    value: boolean,
  ) => {
    const template = templates.find((t) => t.key === key);
    if (!template) return;
    const capabilities = { ...template.capabilities, [capability]: value };
    await fetch("/api/structure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_role_template",
        template: {
          key: template.key,
          name: template.name,
          capabilities,
        },
      }),
    });
    setTemplates((prev) =>
      prev.map((t) => (t.key === key ? { ...t, capabilities } : t)),
    );
  };

  const capabilityKeys = [
    "editTasks",
    "logMinutes",
    "approveMinutes",
    "invite",
    "submitReports",
    "updateAssignedTasks",
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-28">
      <div>
        <h1 className="text-2xl font-semibold text-ink">RBAC & policies</h1>
        <p className="mt-1 text-sm text-muted">
          Configure visibility, oversight, labels, approval stack, and role capabilities.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-surface-raised p-4 space-y-3">
        <h2 className="font-semibold">Organization policies</h2>
        <label className="flex items-center gap-3 min-h-12">
          <input
            type="checkbox"
            checked={policies.allowCrossCommitteeRead}
            onChange={(e) =>
              setPolicies((p) => ({
                ...p,
                allowCrossCommitteeRead: e.target.checked,
              }))
            }
          />
          Allow all members to read across committees
        </label>
        <label className="flex items-center gap-3 min-h-12">
          <input
            type="checkbox"
            checked={policies.requireOversightOnSelfInitiated}
            onChange={(e) =>
              setPolicies((p) => ({
                ...p,
                requireOversightOnSelfInitiated: e.target.checked,
              }))
            }
          />
          Require oversight on committee-initiated projects
        </label>
        <label className="flex items-center gap-3 min-h-12">
          <input
            type="checkbox"
            checked={policies.allowSupervisoryAssignMembers}
            onChange={(e) =>
              setPolicies((p) => ({
                ...p,
                allowSupervisoryAssignMembers: e.target.checked,
              }))
            }
          />
          Allow supervisory to assign committee members
        </label>
        <input
          className={FORM_FIELD_CLASS}
          value={policies.supervisoryLabel}
          onChange={(e) =>
            setPolicies((p) => ({ ...p, supervisoryLabel: e.target.value }))
          }
          placeholder="Supervisory label"
        />
        <input
          className={FORM_FIELD_CLASS}
          value={policies.committeeLabel}
          onChange={(e) =>
            setPolicies((p) => ({ ...p, committeeLabel: e.target.value }))
          }
          placeholder="Committee label"
        />
        <TouchButton onClick={savePolicies} disabled={saving}>
          Save policies
        </TouchButton>
      </section>

      <section className="rounded-2xl border border-border bg-surface-raised p-4 space-y-4">
        <div>
          <h2 className="font-semibold">Approval stack</h2>
          <p className="text-sm text-muted mt-1">
            Ordered steps required when an assignment is escalated for review.
          </p>
        </div>
        {approvalStack.length === 0 ? (
          <p className="text-sm text-muted">No steps yet. Add at least one role.</p>
        ) : (
          <ul className="space-y-3">
            {approvalStack.map((step, index) => (
              <li
                key={`${step.order}-${index}`}
                className="rounded-xl border border-border p-3 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Step {index + 1}
                  </span>
                  <div className="flex gap-2">
                    <TouchButton
                      variant="secondary"
                      disabled={index === 0}
                      onClick={() => moveStep(index, -1)}
                    >
                      Up
                    </TouchButton>
                    <TouchButton
                      variant="secondary"
                      disabled={index === approvalStack.length - 1}
                      onClick={() => moveStep(index, 1)}
                    >
                      Down
                    </TouchButton>
                    <TouchButton
                      variant="secondary"
                      onClick={() => removeStep(index)}
                    >
                      Remove
                    </TouchButton>
                  </div>
                </div>
                <FormSelect
                  value={step.role}
                  onChange={(e) =>
                    updateStep(index, {
                      role: e.target.value as ApprovalStackRole,
                    })
                  }
                >
                  {APPROVAL_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </FormSelect>
                <input
                  className={FORM_FIELD_CLASS}
                  value={step.label}
                  onChange={(e) => updateStep(index, { label: e.target.value })}
                  placeholder="Step label"
                />
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-3">
          <TouchButton variant="secondary" onClick={addStep}>
            Add step
          </TouchButton>
          <TouchButton onClick={saveApprovalStack} disabled={savingStack}>
            {savingStack ? "Saving…" : "Save approval stack"}
          </TouchButton>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface-raised p-4 space-y-4">
        <h2 className="font-semibold">Role capability matrix</h2>
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl border border-border p-3">
            <p className="font-medium">{t.name}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {capabilityKeys.map((cap) => (
                <label key={cap} className="flex items-center gap-2 text-sm min-h-10">
                  <input
                    type="checkbox"
                    checked={Boolean(t.capabilities?.[cap])}
                    onChange={(e) =>
                      toggleCapability(t.key, cap, e.target.checked)
                    }
                  />
                  {cap}
                </label>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

export default function RbacPage() {
  return (
    <AuthGate>
      <RbacConsole />
    </AuthGate>
  );
}
