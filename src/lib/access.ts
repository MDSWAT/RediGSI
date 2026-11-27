import type { CollectionName } from "./types";

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
}
export const PUBLIC_ACCESS: AccessProfile = {
  userId: null,
  email: null,
  role: "public_viewer",
  scopes: [],
  canReview: false,
  canExport: false,
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
export const EXPORT_FIELDS: Record<CollectionName, string[]> = {
  communities: [
    "id",
    "name",
    "kind",
    "status",
    "classification",
    "country",
    "region",
    "county",
    "locality",
    "siruta",
    "population",
    "geometry",
    "locationAccuracy",
    "boundary",
  ],
  entrepreneurs: [
    "id",
    "business",
    "sector",
    "country",
    "region",
    "county",
    "locality",
    "siruta",
    "communityId",
    "lat",
    "lng",
    "approx",
  ],
  clients: [
    "id",
    "partner",
    "country",
    "region",
    "county",
    "locality",
    "siruta",
    "communityId",
    "amount",
    "year",
    "lat",
    "lng",
    "approx",
  ],
  localities: ["id", "siruta", "name", "country", "county", "lat", "lng"],
};
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
