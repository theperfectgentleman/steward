/** Client-side helpers for multi-device document presence. */

export type DeviceKind = "Phone" | "Tablet" | "Laptop";

export type PresenceConnection = {
  /** Yjs awareness client id (unique per tab/connection) */
  clientId: string;
  userId: string;
  name: string;
  color: string;
  device: DeviceKind;
};

export type PresencePerson = {
  userId: string;
  name: string;
  color: string;
  devices: DeviceKind[];
  connectionCount: number;
  isSelf: boolean;
};

export function detectDeviceKind(): DeviceKind {
  if (typeof navigator === "undefined") return "Laptop";
  const ua = navigator.userAgent || "";
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return "Tablet";
  if (/Mobi|Android.*Mobile|iPhone|iPod|webOS|BlackBerry|IEMobile/i.test(ua)) {
    return "Phone";
  }
  return "Laptop";
}

export function colorForUserId(userId: string): string {
  const colors = [
    "#0d9488",
    "#2563eb",
    "#c2410c",
    "#7c3aed",
    "#db2777",
    "#059669",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash + userId.charCodeAt(i) * 17) % colors.length;
  }
  return colors[hash]!;
}

/** Collapse multiple tabs/devices for the same account into one person. */
export function collapsePresenceByUser(
  connections: PresenceConnection[],
  selfUserId: string,
): PresencePerson[] {
  const map = new Map<string, PresencePerson>();
  for (const c of connections) {
    const existing = map.get(c.userId);
    if (!existing) {
      map.set(c.userId, {
        userId: c.userId,
        name: c.name,
        color: c.color || colorForUserId(c.userId),
        devices: [c.device],
        connectionCount: 1,
        isSelf: c.userId === selfUserId,
      });
      continue;
    }
    existing.connectionCount += 1;
    if (!existing.devices.includes(c.device)) {
      existing.devices.push(c.device);
    }
  }
  // Self first, then others by name
  return Array.from(map.values()).sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function formatPresenceSummary(
  people: PresencePerson[],
  opts?: { excludeSelfFromCount?: boolean },
): string {
  const excludeSelf = opts?.excludeSelfFromCount !== false;
  const others = people.filter((p) => !p.isSelf);
  const self = people.find((p) => p.isSelf);

  if (people.length === 0) return "";

  if (excludeSelf) {
    if (others.length === 0) {
      if (self && self.connectionCount > 1) {
        return `You · ${self.devices.join(" + ")}`;
      }
      return self ? "Just you" : "";
    }
    const names = others.map((p) => p.name.split(" ")[0]!).slice(0, 3);
    const more = others.length > 3 ? ` +${others.length - 3}` : "";
    if (self && self.connectionCount > 1) {
      return `You (${self.devices.join("+")}) + ${names.join(", ")}${more}`;
    }
    return `You + ${names.join(", ")}${more}`;
  }

  return people
    .map((p) =>
      p.isSelf
        ? p.connectionCount > 1
          ? `You (${p.devices.join("+")})`
          : "You"
        : p.name.split(" ")[0],
    )
    .join(", ");
}

export function caretLabel(name: string, device: DeviceKind): string {
  const first = name.trim().split(/\s+/)[0] || name;
  return `${first} · ${device}`;
}
