import type { TaskStatus } from "@/lib/types";

export type TaskForProgress = {
  id: string;
  status: TaskStatus;
  parentId: string | null;
};

export type EventProgress = {
  progress: number;
  doneCount: number;
  totalCount: number;
};

/** Leaf tasks only: parents with subtasks are excluded; standalone parents count. */
export function computeEventProgress(tasks: TaskForProgress[]): EventProgress {
  if (tasks.length === 0) {
    return { progress: 0, doneCount: 0, totalCount: 0 };
  }

  const parentIdsWithChildren = new Set(
    tasks
      .filter((t) => t.parentId)
      .map((t) => t.parentId as string),
  );

  const leafTasks = tasks.filter(
    (t) => !parentIdsWithChildren.has(t.id),
  );

  if (leafTasks.length === 0) {
    return { progress: 0, doneCount: 0, totalCount: 0 };
  }

  const doneCount = leafTasks.filter((t) => t.status === "DONE").length;
  const totalCount = leafTasks.length;
  const progress = Math.round((doneCount / totalCount) * 100);

  return { progress, doneCount, totalCount };
}
