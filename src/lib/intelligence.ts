import type { DB } from "./types";
export function intelligence(db: DB) {
  const populations = db.communities
    .map((c) => c.population)
    .filter(
      (n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0,
    );
  const knownIds = new Set(db.communities.map((c) => c.id));
  const linked = new Set(
    db.entrepreneurs
      .map((e) => e.communityId)
      .filter((id): id is string => !!id && knownIds.has(id)),
  );
  const partners = new Map<
    string,
    {
      name: string;
      clients: number;
      localities: Set<string>;
      unlocated: number;
    }
  >();
  const finance = new Map<
    string,
    { currency: string; amount: number; records: number }
  >();
  let unknownCurrency = 0;
  for (const client of db.clients) {
    const p = partners.get(client.partner) ?? {
      name: client.partner,
      clients: 0,
      localities: new Set<string>(),
      unlocated: 0,
    };
    p.clients++;
    if (client.siruta || client.locality)
      p.localities.add(
        [
          client.country,
          client.county ?? "",
          client.siruta ?? client.locality,
        ].join("|"),
      );
    else p.unlocated++;
    partners.set(client.partner, p);
    if (typeof client.amount === "number" && Number.isFinite(client.amount)) {
      const currency = client.currency?.toUpperCase();
      if (!currency || !/^[A-Z]{3}$/.test(currency)) {
        unknownCurrency++;
        continue;
      }
      const f = finance.get(currency) ?? { currency, amount: 0, records: 0 };
      f.amount += client.amount;
      f.records++;
      finance.set(currency, f);
    }
  }
  const sectors = new Map<string, number>();
  for (const e of db.entrepreneurs) {
    const sector = e.sector ?? "Domeniu neprecizat";
    sectors.set(sector, (sectors.get(sector) ?? 0) + 1);
  }
  return {
    populationRecords: populations.length,
    populationMin: populations.length ? Math.min(...populations) : null,
    populationMax: populations.length ? Math.max(...populations) : null,
    linkedCommunities: linked.size,
    communityCoverage: knownIds.size ? linked.size / knownIds.size : null,
    partners: [...partners.values()].sort((a, b) => b.clients - a.clients),
    finance: [...finance.values()].sort((a, b) =>
      a.currency.localeCompare(b.currency),
    ),
    unknownCurrency,
    sectors: [...sectors].sort((a, b) => b[1] - a[1]),
  };
}
