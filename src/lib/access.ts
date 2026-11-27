
export type Role =
  "public_viewer" | "authorized_viewer" | "gis_editor" | "administrator";
export type WorkspaceModule = "map" | "analytics" | "data" | "administration";
export interface GeographicScope {
  country: string;
  region?: string;
  county?: string;
  municipality?: string;
  communityId?: string;
}
export interface AccessProfile {
  userId: string | null;
  email: string | null;
  role: Role;
  scopes: GeographicScope[];
  canReview: boolean;
  canExport: boolean;
  exportGroups?: ExportGroup[];
}
/** Sensitive export fields, granted per member. Mirrors redi_export_data in the database. */
export type ExportGroup = "precise_location" | "financial" | "business_identity";
export const EXPORT_GROUP_LABELS: Record<ExportGroup, string> = {
  precise_location: "Locație exactă (coordonate, geometrii)",
  financial: "Date financiare (sume, monedă)",
  business_identity: "Denumiri de afaceri și parteneri",
};
export const EXPORT_GROUPS = Object.keys(EXPORT_GROUP_LABELS) as ExportGroup[];
export const PUBLIC_ACCESS: AccessProfile = {
  userId: null,
  email: null,
  role: "public_viewer",
  scopes: [],
  canReview: false,
  canExport: false,
  exportGroups: [],
};
export const ROLE_LABELS: Record<Role, string> = {
  public_viewer: "Vizitator public",
  authorized_viewer: "Vizualizator autorizat",
  gis_editor: "Editor GIS",
  administrator: "Administrator",
};
export const canEdit = (a: AccessProfile) =>
  a.role === "gis_editor" || a.role === "administrator";
export const isAdmin = (a: AccessProfile) => a.role === "administrator";
export const canReview = (a: AccessProfile) =>
  isAdmin(a) || (canEdit(a) && a.canReview);
export const canExport = (a: AccessProfile) =>
  a.role !== "public_viewer" && a.canExport;
export const visibleModules = (a: AccessProfile): WorkspaceModule[] => [
  "map",
  "analytics",
  ...(a.role !== "public_viewer" ? ["data" as const] : []),
  ...(canReview(a) || isAdmin(a) ? ["administration" as const] : []),
];
export const PROPOSAL_LABELS = {
  submitted: "Trimisă",
  pending_review: "În așteptarea revizuirii",
  under_validation: "În validare",
  approved: "Aprobată",
  rejected: "Respinsă",
  published: "Publicată",
};
export type ProposalStatus = keyof typeof PROPOSAL_LABELS;
export interface Proposal {
  id: string;
  status: ProposalStatus;
  data: Record<string, unknown>;
  submitted_at: string;
  updated_at: string;
  review_note: string | null;
  published_record_id: string | null;
}
export function allowedTransitions(
  status: ProposalStatus,
  admin: boolean,
): ProposalStatus[] {
  if (status === "submitted") return ["pending_review"];
  if (status === "pending_review") return ["under_validation"];
  if (status === "under_validation" && admin) return ["approved", "rejected"];
  if (status === "approved" && admin) return ["published"];
  return [];
}
