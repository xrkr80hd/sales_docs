// Extended organization roles use server-managed auth metadata, leaving the existing profile-role constraint intact.
export const WORKSPACE_ROLES = ["user", "floor_manager", "sales_manager", "fni", "district_manager", "bdm", "admin"] as const;
export type WorkspaceRole = typeof WORKSPACE_ROLES[number];
export const ROLE_LABELS: Record<WorkspaceRole, string> = { user: "Consultant", floor_manager: "Floor Manager", sales_manager: "Sales Manager", fni: "F&I", district_manager: "District Manager", bdm: "BDM", admin: "Master Admin" };
export function validWorkspaceRole(value: unknown): value is WorkspaceRole { return typeof value === "string" && WORKSPACE_ROLES.includes(value as WorkspaceRole); }
export function profileRole(role: WorkspaceRole) { return role === "bdm" ? "user" : role === "floor_manager" ? "sales_manager" : role === "district_manager" ? "sales_manager" : role; }
