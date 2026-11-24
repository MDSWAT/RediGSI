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

Datele aplicației se salvează exclusiv în baza de date Supabase. Serverul nu creează și nu scrie fișiere de date.

## Configurarea bazei de date

1. Rulați integral `supabase/migrations/202611240001_database_storage.sql` în SQL Editor al proiectului Supabase. Migrarea creează tabelele `redi_records` și `redi_summaries`, plus funcțiile de citire, actualizare și ștergere. Poate fi rulată din nou fără a elimina datele existente.
2. Setați `SUPABASE_SECRET_KEY` în `.env.local` și în variabilele serverului de găzduire. Este acceptată și vechea variabilă `SUPABASE_SERVICE_ROLE_KEY`. Această cheie nu trebuie să aibă prefixul `NEXT_PUBLIC_`. URL-ul public și cheia publicabilă existente sunt utilizate în continuare de clienții de autentificare.
3. Reporniți serverul local sau faceți redeploy după configurarea mediului.

Tabelele au RLS activat și nu permit acces direct cu cheia publică. API-urile serverului folosesc cheia secretă. Actualizările se aplică atomic în PostgreSQL, iar citirea completă nu este limitată la 1.000 de înregistrări. API-urile păstrează comportamentul anterior de acces; autentificarea obligatorie a utilizatorilor se configurează separat.

Pentru datele deja existente în vechile fișiere locale, după configurarea schemei și a cheii, rulați o singură dată:

```bash
npm run migrate:local
```

Comanda citește vechile `data/db.json` și `data/summaries.json` numai pentru transfer, verifică ID-urile și originalele, nu suprascrie ID-urile deja existente în bază și nu modifică fișierele sursă. Rutele aplicației nu citesc aceste fișiere. Dacă schema sau cheia lipsesc, API-ul răspunde cu o eroare JSON 503 și instrucțiuni de configurare; nu există stocare de rezervă pe disc.

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

Clienții și sesiunile folosesc cheia publicabilă; stocarea datelor folosește separat clientul server din `src/lib/database.ts`. Nu este necesar un tabel demonstrativ `todos`. Rutele existente rămân publice; protejarea lor și interfața de autentificare se configurează separat.

## Sumare REDI pe țări

Fișierele CSV din foaia „Sumar” sunt recunoscute automat în dialogul de import, inclusiv titlul și notele de deasupra tabelului. Cifrele pe țări, totalul declarat, observațiile și definițiile se păstrează în `redi_summaries.report`, iar CSV-ul original în coloana text `original_csv`. Nu se creează fișiere sau obiecte în Storage. Cheia unică bazată pe conținut împiedică duplicatele, inclusiv la importuri simultane.

Vizualizarea **Sumar** afișează toate datele și permite descărcarea sursei originale. Valorile N/D rămân indisponibile. Totalurile neconcordante sunt semnalate, fără a modifica sursa. Aceste agregate nu creează puncte pe hartă: pentru localitățile individuale sunt necesare foile detaliate cu poziții sau coduri de localitate.

Verificarea parserului: `npm test` (Node.js 22.18+).

## Ordinea recomandată de import

Butonul **Adaugă manual**, disponibil în fiecare panou, permite salvarea unei comunități punctuale (coordonate sau nomenclator), a unui antreprenor, a unui client de partener sau a unei localități SIRUTA. Selectați tipul de înregistrare în formular. Comunitățile cu limite de stradă/cartier se desenează în continuare direct pe hartă. Un eșec de salvare păstrează formularul completat și afișează eroarea.

Opțiunea **Sumar REDI pe țară** creează un sumar manual separat, cu sursă și observații, fără a modifica fișierele deja importate. Totalul localităților se calculează din cele patru categorii; populația necompletată rămâne N/D. Atât introducerea manuală, cât și importul folosesc aceeași stocare Supabase.

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

- Indexare și funcții PostGIS pentru interogări geografice la volume mari.
- Autentificare și roluri (cine poate valida comunități).
- Editarea geometriei comunităților existente.
- Granițe administrative (UAT) pentru suprapunere pe poligoane, nu doar pe cod.
