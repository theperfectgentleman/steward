export function toPermissionUser(user: {
  id: string;
  role: import("@/lib/types").UserRole;
  committeeMemberships: { committeeId: string; title: import("@/lib/types").CommitteeTitle }[];
  presbyteryMembership: { isHead: boolean } | null;
}): import("@/lib/types").PermissionUser {
  return {
    id: user.id,
    role: user.role,
    committeeMemberships: user.committeeMemberships,
    presbyteryMembership: user.presbyteryMembership,
  };
}
