import { prisma } from "@/lib/prisma";

export const APP_SETTINGS_ID = "default";

export type AppSettingsSnapshot = {
  committeeBudgetsEnabled: boolean;
};

export async function getAppSettings(): Promise<AppSettingsSnapshot> {
  const row = await prisma.appSettings.upsert({
    where: { id: APP_SETTINGS_ID },
    create: { id: APP_SETTINGS_ID },
    update: {},
    select: { committeeBudgetsEnabled: true },
  });
  return { committeeBudgetsEnabled: row.committeeBudgetsEnabled };
}

export async function updateAppSettings(
  data: Partial<AppSettingsSnapshot>,
): Promise<AppSettingsSnapshot> {
  const row = await prisma.appSettings.upsert({
    where: { id: APP_SETTINGS_ID },
    create: {
      id: APP_SETTINGS_ID,
      committeeBudgetsEnabled: data.committeeBudgetsEnabled ?? false,
    },
    update: {
      ...(data.committeeBudgetsEnabled !== undefined && {
        committeeBudgetsEnabled: data.committeeBudgetsEnabled,
      }),
    },
    select: { committeeBudgetsEnabled: true },
  });
  return { committeeBudgetsEnabled: row.committeeBudgetsEnabled };
}
