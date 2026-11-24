# RediGSI

Roma Community Map

Aplicație GIS (Next.js + Leaflet) pentru:

1. **Harta comunităților** – importul catalogului de comunități validate și afișarea lor geolocalizată.
2. **Marcarea de comunități noi** – punct, stradă (linie), cartier (poligon) sau zonă (dreptunghi), desenate direct pe hartă. Intră ca „propuse” și pot fi validate ulterior.
3. **Antreprenori** – import din CSV/Excel, afișare pe hartă cu detalii, legare automată de comunitatea în care se află.
4. **Export** – comunități în GeoJSON / CSV / Excel, cu coordonate (centroid), geometrie WKT și cod SIRUTA, pentru import în alte baze de date sau QGIS/ArcGIS.
5. **Suprapunere cu partenerii** – import liste de clienți finanțați de un partener și comparare pe localitate (SIRUTA), județ sau țară.

## Pornire

```bash
npm install
npm run dev
# http://localhost:3000
```

Datele se salvează în `data/db.json` (exclus din git – poate conține date personale).

## Supabase

Configurați `NEXT_PUBLIC_SUPABASE_URL` și `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` în `.env.local`, după modelul `.env.example`. Fișierul local este exclus din Git; pentru găzduire, setați aceleași variabile în mediul de deployment.

- `src/utils/supabase/client.ts`: client pentru componentele din browser.
- `src/utils/supabase/server.ts`: client nou pentru fiecare cerere pe server, folosind `await cookies()`.
- `src/utils/supabase/middleware.ts`: verifică și reîmprospătează sesiunea cu `auth.getClaims()`, transmite cookie-urile actualizate către server și browser și păstrează antetele care împiedică memorarea în cache a răspunsurilor cu sesiuni.
- `src/proxy.ts`: conectează reîmprospătarea sesiunii la convenția Next.js 16; exclude resursele statice și fișierele exemplu.

Exemplu pentru o componentă server sau un Route Handler:

```ts
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

const supabase = createClient(await cookies());
// Interogați aici tabelele și politicile RLS definite în proiectul Supabase.
```

Integrarea pregătește clienții și sesiunile. Pagina GIS și stocarea existentă în `data/db.json` și `data/summaries.json` rămân funcționale; datele nu sunt migrate automat și nu este necesar un tabel demonstrativ `todos`. Rutele existente rămân publice; protejarea lor și interfața de autentificare se configurează separat.

## Sumare REDI pe țări

Fișierele CSV din foaia „Sumar” sunt recunoscute automat în dialogul de import, inclusiv titlul și notele de deasupra tabelului. Cifrele pe țări, totalul declarat, observațiile, definițiile și CSV-ul original se păstrează separat în `data/summaries.json` (exclus din git). Reimportul aceluiași conținut nu creează duplicate.

Vizualizarea **Sumar** afișează toate datele și permite descărcarea sursei originale. Valorile N/D rămân indisponibile. Totalurile neconcordante sunt semnalate, fără a modifica sursa. Aceste agregate nu creează puncte pe hartă: pentru localitățile individuale sunt necesare foile detaliate cu poziții sau coduri de localitate.

Verificarea parserului: `npm test` (Node.js 22.18+).

## Ordinea recomandată de import

1. **Nomenclator SIRUTA** (cod, denumire, județ, lat, lng) – permite plasarea pe hartă a rândurilor care au doar localitatea sau codul SIRUTA.
2. **Catalogul de comunități**.
3. **Antreprenori** – sunt legați automat de comunități (în poligon / la ≤300 m de stradă / ≤500 m de punct / aceeași localitate dacă e singura comunitate acolo).
4. **Clienți parteneri**.

Formate acceptate: CSV (separator `,` `;` sau tab), XLSX/XLS/ODS, GeoJSON. Coloanele sunt potrivite automat după nume (RO/EN) și pot fi corectate manual; coloanele necunoscute se păstrează și apar la export.

Poziția se ia, în ordine, din: coloana WKT/GeoJSON → lat/lng → coloana „lat, lng” → nomenclator (cod SIRUTA sau localitate + județ). Rândurile plasate la centrul localității sunt marcate `approx` și nu intră în calculul „în perimetrul comunității”.

Fișiere exemplu (date fictive) în `public/samples/`. Codurile SIRUTA din exemple sunt orientative – folosiți nomenclatorul oficial INS.

## Structură

- `src/components/App.tsx` – interfața (tab-uri, liste, statistici)
- `src/components/MapView.tsx` – harta, straturi, desenare (Geoman)
- `src/components/ImportDialog.tsx` – import cu potrivire de coloane
- `src/lib/geo.ts` – normalizare, SIRUTA, WKT, apartenență spațială
- `src/lib/overlap.ts` – calculul suprapunerii
- `src/lib/export.ts` – exporturi
- `src/app/api/data/…` – API pentru stocare

## Pași următori pentru producție

- Bază de date reală (PostgreSQL + PostGIS) în locul fișierului JSON.
- Autentificare și roluri (cine poate valida comunități).
- Editarea geometriei comunităților existente.
- Granițe administrative (UAT) pentru suprapunere pe poligoane, nu doar pe cod.
