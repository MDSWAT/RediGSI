"use client";
import { useCallback, useEffect, useState } from "react";
import {
  allowedTransitions,
  canReview,
  isAdmin,
  PROPOSAL_LABELS,
  ROLE_LABELS,
  type AccessProfile,
  type GeographicScope,
  type Proposal,
  type ProposalStatus,
  type Role,
} from "@/lib/access";
import {
  COLLECTION_LABELS,
  COUNTRY_LABELS,
  type CollectionName,
} from "@/lib/types";
import type { Geometry } from "geojson";
interface Member {
  userId: string;
  email: string;
  role: Role;
  active: boolean;
  scopes: GeographicScope[];
  canReview: boolean;
  canExport: boolean;
}
interface Audit {
  id: string;
  occurred_at: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
}
interface Version extends Audit {
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
}
interface Deleted {
  id: string;
  collection: CollectionName;
  name: string;
  deletedAt: string;
}
type Section = "proposals" | "members" | "audit" | "deleted";
const date = (s: string) => new Date(s).toLocaleString("ro-RO");
async function request(url: string, method = "GET", body?: unknown) {
  const r = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "Operația a eșuat.");
  return data;
}
export default function AdministrationWorkspace({
  access,
  onExplore,
  onChanged,
}: {
  access: AccessProfile;
  onExplore: (geometry: Geometry) => void;
  onChanged: () => void;
}) {
  const [section, setSection] = useState<Section>("proposals");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [deleted, setDeleted] = useState<Deleted[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState("");
  const [note, setNote] = useState("");
  const [publicVisibility, setPublicVisibility] = useState(false);
  const [shareGeometry, setShareGeometry] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [member, setMember] = useState<Member>();
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next: Proposal[] = canReview(access)
        ? await request("/api/proposals")
        : [];
      setProposals(next);
      if (isAdmin(access)) {
        const data = await request("/api/admin");
        setMembers(data.members);
        setAudit(data.audit);
        setDeleted(data.deleted);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [access]);
  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => {
      if (alive) void reload();
    });
    return () => {
      alive = false;
    };
  }, [reload]);
  const proposal = proposals.find((p) => p.id === selected);
  const filtered = proposals.filter((p) => !filter || p.status === filter);
  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await action();
      setNotice(message);
      await reload();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="module-workspace">
      <div className="module-title">
        <div>
          <h2>Administrare</h2>
          <p>Validare, acces teritorial și evidența operațiilor.</p>
        </div>
        <button disabled={loading || busy} onClick={() => void reload()}>
          Reîncarcă
        </button>
      </div>
      <div
        className="workspace-tabs"
        role="tablist"
        aria-label="Secțiuni administrare"
      >
        {(
          [
            ["proposals", "Propuneri"],
            ...(isAdmin(access)
              ? [
                  ["members", "Utilizatori"],
                  ["audit", "Jurnal"],
                  ["deleted", "Restaurare"],
                ]
              : []),
          ] as [Section, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={section === id}
            onClick={() => {
              setSection(id);
              setNotice("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="ok" role="status">
          {notice}
        </p>
      )}
      {loading && (
        <p className="muted small" role="status">
          Se încarcă…
        </p>
      )}
      {section === "proposals" && (
        <>
          <div className="module-filter">
            <label>
              Etapă
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">Toate etapele</option>
                {Object.entries(PROPOSAL_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <p className="muted small">
              Trimitere → revizuire → validare → aprobare → publicare
            </p>
          </div>
          <div className="review-layout">
            <div className="proposal-list">
              {!loading && !filtered.length && (
                <p className="module-empty">
                  Nu există propuneri în această selecție.
                </p>
              )}
              {filtered.map((p) => (
                <button
                  key={p.id}
                  className={p.id === selected ? "selected" : ""}
                  onClick={() => {
                    setSelected(p.id);
                    setNote(p.review_note ?? "");
                    setPublicVisibility(false);
                    setShareGeometry(false);
                    setPrivacy(false);
                  }}
                >
                  <b>{String(p.data.name)}</b>
                  <span>
                    {String(p.data.locality ?? p.data.county ?? "")} ·{" "}
                    {COUNTRY_LABELS[String(p.data.country)] ??
                      String(p.data.country)}
                  </span>
                  <span className={`badge proposal-${p.status}`}>
                    {PROPOSAL_LABELS[p.status]}
                  </span>
                  <time dateTime={p.submitted_at}>{date(p.submitted_at)}</time>
                </button>
              ))}
            </div>
            {proposal ? (
              <article className="proposal-detail">
                <h3>{String(proposal.data.name)}</h3>
                <p className="muted small">Referință {proposal.id}</p>
                <dl className="detail-grid">
                  {[
                    "country",
                    "county",
                    "locality",
                    "classification",
                    "population",
                    "notes",
                    "supportingInformation",
                  ]
                    .filter(
                      (k) =>
                        proposal.data[k] != null && proposal.data[k] !== "",
                    )
                    .map((k) => (
                      <div key={k}>
                        <dt>
                          {
                            (
                              {
                                country: "Țară",
                                county: "Județ / regiune",
                                locality: "Localitate",
                                classification: "Clasificare",
                                population: "Populație propusă",
                                notes: "Descriere",
                                supportingInformation:
                                  "Informații de susținere",
                              } as Record<string, string>
                            )[k]
                          }
                        </dt>
                        <dd>{String(proposal.data[k])}</dd>
                      </div>
                    ))}
                </dl>
                <button
                  onClick={() => onExplore(proposal.data.geometry as Geometry)}
                >
                  Verifică geometria pe hartă
                </button>
                <p className="muted small">
                  Etapa: {PROPOSAL_LABELS[proposal.status]} · actualizată{" "}
                  {date(proposal.updated_at)}
                </p>
                {!!allowedTransitions(proposal.status, isAdmin(access))
                  .length && (
                  <>
                    <label>
                      Observații de verificare
                      <textarea
                        rows={3}
                        maxLength={4000}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Motiv obligatoriu la respingere"
                      />
                    </label>
                    {proposal.status === "approved" && (
                      <fieldset className="publication-options">
                        <legend>Evaluarea publicării</legend>
                        <label className="check-filter consent-field">
                          <input
                            type="checkbox"
                            checked={privacy}
                            onChange={(e) => setPrivacy(e.target.checked)}
                          />
                          Am verificat riscurile de confidențialitate și
                          informațiile din propunere.
                        </label>
                        <label className="check-filter consent-field">
                          <input
                            type="checkbox"
                            checked={publicVisibility}
                            onChange={(e) => {
                              setPublicVisibility(e.target.checked);
                              if (!e.target.checked) setShareGeometry(false);
                            }}
                          />
                          Permite vizualizarea informațiilor de bază fără
                          autentificare.
                        </label>
                        <label className="check-filter consent-field">
                          <input
                            type="checkbox"
                            disabled={!publicVisibility}
                            checked={shareGeometry}
                            onChange={(e) => setShareGeometry(e.target.checked)}
                          />
                          Publică și geometria exactă, după evaluarea
                          riscurilor.
                        </label>
                        <p className="muted small">
                          Implicit, înregistrarea publicată rămâne
                          restricționată. Notele și informațiile de susținere nu
                          apar în proiecția publică.
                        </p>
                      </fieldset>
                    )}
                    <div className="btn-row">
                      {allowedTransitions(proposal.status, isAdmin(access)).map(
                        (status) => (
                          <button
                            key={status}
                            disabled={
                              busy ||
                              (status === "published" && !privacy) ||
                              (status === "rejected" && note.trim().length < 5)
                            }
                            className={
                              status === "rejected" ? "danger" : "primary"
                            }
                            onClick={() =>
                              void run(
                                () =>
                                  request("/api/proposals", "PATCH", {
                                    id: proposal.id,
                                    status,
                                    expected: proposal.status,
                                    note,
                                    public: publicVisibility,
                                    shareGeometry,
                                    privacyReviewed: privacy,
                                  }),
                                "Propunerea a fost actualizată.",
                              )
                            }
                          >
                            {
                              (
                                {
                                  pending_review: "Începe revizuirea",
                                  under_validation: "Trimite în validare",
                                  approved: "Aprobă",
                                  rejected: "Respinge",
                                  published: "Publică în registru",
                                } as Partial<Record<ProposalStatus, string>>
                              )[status]
                            }
                          </button>
                        ),
                      )}
                    </div>
                  </>
                )}
                {proposal.status === "under_validation" && !isAdmin(access) && (
                  <p className="preview">
                    Aprobarea și publicarea necesită un administrator.
                  </p>
                )}
              </article>
            ) : (
              <p className="module-empty">
                Selectează o propunere pentru a verifica informațiile și etapa
                de validare.
              </p>
            )}
          </div>
        </>
      )}
      {section === "members" && isAdmin(access) && (
        <>
          <p className="muted small">
            Sunt afișate conturile existente în Supabase Auth. Conturile fără
            rol atribuit rămân vizitatori publici. Nu se trimit invitații
            automat.
          </p>
          <div className="member-layout">
            <div className="member-list">
              {members.map((m) => (
                <button
                  key={m.userId}
                  onClick={() =>
                    setMember({ ...m, scopes: m.scopes.map((s) => ({ ...s })) })
                  }
                  className={member?.userId === m.userId ? "selected" : ""}
                >
                  <b>{m.email}</b>
                  <span>
                    {ROLE_LABELS[m.role]}
                    {m.active ? "" : " · dezactivat"}
                  </span>
                </button>
              ))}
            </div>
            {member ? (
              <form
                className="member-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(
                    () =>
                      request("/api/admin", "POST", {
                        action: "member",
                        ...member,
                      }),
                    "Permisiunile au fost salvate.",
                  );
                }}
              >
                <h3>{member.email}</h3>
                <label>
                  Rol
                  <select
                    value={member.role}
                    onChange={(e) =>
                      setMember({ ...member, role: e.target.value as Role })
                    }
                  >
                    {Object.entries(ROLE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="check-filter consent-field">
                  <input
                    type="checkbox"
                    checked={member.active}
                    onChange={(e) =>
                      setMember({ ...member, active: e.target.checked })
                    }
                  />
                  Acces activ
                </label>
                <label className="check-filter consent-field">
                  <input
                    type="checkbox"
                    disabled={member.role !== "gis_editor"}
                    checked={member.canReview}
                    onChange={(e) =>
                      setMember({ ...member, canReview: e.target.checked })
                    }
                  />
                  Poate revizui propuneri în teritoriile alocate
                </label>
                <label className="check-filter consent-field">
                  <input
                    type="checkbox"
                    disabled={member.role === "public_viewer"}
                    checked={member.canExport}
                    onChange={(e) =>
                      setMember({ ...member, canExport: e.target.checked })
                    }
                  />
                  Poate exporta câmpurile permise
                </label>
                {member.role !== "administrator" && (
                  <>
                    <h3>Teritorii alocate</h3>
                    <p className="muted small">
                      Fără teritorii, datele restricționate nu sunt accesibile.
                      Restricțiile dintr-un teritoriu se aplică împreună;
                      teritoriile multiple se reunesc.
                    </p>
                    {member.scopes.map((scope, i) => (
                      <fieldset className="scope-editor" key={i}>
                        <legend>Teritoriul {i + 1}</legend>
                        <label>
                          Țară
                          <select
                            value={scope.country}
                            onChange={(e) =>
                              setMember({
                                ...member,
                                scopes: member.scopes.map((s, j) =>
                                  i === j
                                    ? { ...s, country: e.target.value }
                                    : s,
                                ),
                              })
                            }
                          >
                            <option value="*">Toate țările</option>
                            {Object.entries(COUNTRY_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </label>
                        {(
                          [
                            "region",
                            "county",
                            "municipality",
                            "communityId",
                          ] as const
                        ).map((key) => (
                          <label key={key}>
                            {
                              {
                                region: "Regiune",
                                county: "Județ",
                                municipality: "Municipalitate / localitate",
                                communityId: "ID comunitate",
                              }[key]
                            }
                            <input
                              maxLength={200}
                              value={scope[key] ?? ""}
                              onChange={(e) =>
                                setMember({
                                  ...member,
                                  scopes: member.scopes.map((s, j) =>
                                    i === j
                                      ? { ...s, [key]: e.target.value }
                                      : s,
                                  ),
                                })
                              }
                            />
                          </label>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setMember({
                              ...member,
                              scopes: member.scopes.filter((_, j) => j !== i),
                            })
                          }
                        >
                          Elimină teritoriul
                        </button>
                      </fieldset>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setMember({
                          ...member,
                          scopes: [...member.scopes, { country: "RO" }],
                        })
                      }
                    >
                      Adaugă teritoriu
                    </button>
                  </>
                )}
                <button className="primary" disabled={busy}>
                  Salvează permisiunile
                </button>
              </form>
            ) : (
              <p className="module-empty">
                Selectează un utilizator pentru a gestiona accesul.
              </p>
            )}
          </div>
        </>
      )}
      {section === "audit" && isAdmin(access) && (
        <>
          <button
            disabled={busy}
            onClick={() =>
              void run(
                () =>
                  request("/api/admin", "POST", {
                    action: "initialize_catalog",
                  }),
                "Importul inițial a fost verificat. Datele și editările existente au fost păstrate.",
              )
            }
          >
            Verifică importul catalogului REDI
          </button>
          <p className="muted small">
            Ultimele 100 de operații. Instantaneele complete sunt păstrate în
            baza de date pentru istoricul versiunilor.
          </p>
          <div className="table-wrap">
            <table className="workspace-table audit-table">
              <thead>
                <tr>
                  <th>Moment</th>
                  <th>Operație</th>
                  <th>Tip</th>
                  <th>Înregistrare</th>
                  <th>Utilizator</th>
                  <th>Istoric</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td>{date(a.occurred_at)}</td>
                    <td>{a.action}</td>
                    <td>{a.entity_type}</td>
                    <td>{a.entity_id}</td>
                    <td>
                      {members.find((m) => m.userId === a.actor_id)?.email ??
                        (a.actor_id ? "Cont necunoscut" : "Public / sistem")}
                    </td>
                    <td>
                      <button
                        disabled={busy}
                        onClick={() => {
                          setError("");
                          setBusy(true);
                          void request(
                            `/api/admin?entity=${encodeURIComponent(a.entity_type)}&id=${encodeURIComponent(a.entity_id)}`,
                          )
                            .then(setVersions)
                            .catch((e) => setError(e.message))
                            .finally(() => setBusy(false));
                        }}
                      >
                        Vezi versiuni
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!!versions.length && (
            <section className="version-history">
              <h3>Versiuni: {versions[0].entity_id}</h3>
              {versions.map((v) => (
                <details key={v.id}>
                  <summary>
                    {date(v.occurred_at)} · {v.action}
                  </summary>
                  <dl className="detail-grid">
                    {Object.entries(v.after_data ?? v.before_data ?? {})
                      .filter(
                        ([k, value]) =>
                          !v.before_data ||
                          JSON.stringify(v.before_data[k]) !==
                            JSON.stringify(value) ||
                          !v.after_data,
                      )
                      .map(([k, value]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>
                            {typeof value === "object"
                              ? JSON.stringify(value)
                              : String(value ?? "—")}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </details>
              ))}
            </section>
          )}
        </>
      )}
      {section === "deleted" && isAdmin(access) && (
        <>
          <p className="muted small">
            Ștergerea ascunde înregistrările, păstrând datele originale și
            istoricul. Restaurarea le readuce în registru.
          </p>
          {!deleted.length ? (
            <p className="module-empty">Nu există înregistrări șterse.</p>
          ) : (
            <div className="table-wrap">
              <table className="workspace-table">
                <thead>
                  <tr>
                    <th>Înregistrare</th>
                    <th>Set de date</th>
                    <th>Ștearsă la</th>
                    <th>Recuperare</th>
                  </tr>
                </thead>
                <tbody>
                  {deleted.map((d) => (
                    <tr key={d.collection + d.id}>
                      <th>{d.name || d.id}</th>
                      <td>{COLLECTION_LABELS[d.collection]}</td>
                      <td>{date(d.deletedAt)}</td>
                      <td>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () =>
                                request("/api/admin", "POST", {
                                  action: "restore",
                                  collection: d.collection,
                                  id: d.id,
                                }),
                              "Înregistrarea a fost restaurată.",
                            )
                          }
                        >
                          Restaurează
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
