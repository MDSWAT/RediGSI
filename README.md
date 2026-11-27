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
2. Pentru configurare și importul inițial, setați `SUPABASE_SECRET_KEY` în `.env.local` și în variabilele serverului de găzduire. Este acceptată și vechea variabilă `SUPABASE_SERVICE_ROLE_KEY`. Această cheie nu trebuie să aibă prefixul `NEXT_PUBLIC_`. URL-ul public și cheia publicabilă existente sunt utilizate în continuare de clienții de autentificare.
3. Reporniți serverul local sau faceți redeploy după configurarea mediului.

Tabelele au RLS activat și nu permit acces direct cu cheia publică. După migrarea de guvernanță, API-urile folosesc sesiunea verificată a utilizatorului și RPC-uri care impun rolul, teritoriul și vizibilitatea în PostgreSQL. Cheia secretă este utilizată numai pentru importul inițial și operațiile de configurare. Citirea completă nu este limitată la 1.000 de înregistrări.

Pentru datele deja existente în vechile fișiere locale, după configurarea schemei și a cheii, rulați o singură dată:

```bash
npm run migrate:local
```

Comanda citește vechile `data/db.json` și `data/summaries.json` numai pentru transfer, verifică ID-urile și originalele, nu suprascrie ID-urile deja existente în bază și nu modifică fișierele sursă. Rutele aplicației nu citesc aceste fișiere. Dacă lipsește schema necesară sau serviciul nu este disponibil, API-ul răspunde cu o eroare JSON 503; nu există stocare de rezervă pe disc. După activarea guvernanței, operațiile obișnuite folosesc sesiunea utilizatorului, nu cheia serverului.

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

Clienții și sesiunile folosesc cheia publicabilă. Rutele de lucru folosesc `workspaceServer.ts` și RPC-urile de guvernanță cu identitatea utilizatorului. Clientul privilegiat `src/lib/database.ts` rămâne pentru importul catalogului și migrarea datelor vechi. Nu este necesar un tabel demonstrativ `todos`. Accesul public primește numai proiecția aprobată; modificările, exportul și administrarea necesită permisiuni.

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


### Registrul HTML REDI 2026

Cele 11 exporturi HTML furnizate sunt păstrate ca text, referințe și valori originale în `src/data/catalog-2026.json`. Acesta este un pachet de import static, inclus numai în codul serverului; aplicația nu citește și nu scrie fișiere de date la rulare. La verificarea importului inițial din Administrare → Jurnal, `catalogSeed.ts` importă cele 628 de rânduri și sumarul cu toate foile sursă în Supabase, folosind schema deja existentă. Este necesară cheia server Supabase din mediul de hosting.

ID-urile stabile după foaie și rând și inserările fără suprascriere permit reluarea importului după întreruperi. Marcajul de finalizare este scris ultimul în `redi_summaries`. După finalizare, importul nu reface înregistrările șterse și nu suprascrie editările. Marcajul este comun tuturor instanțelor serverului.

Sunt disponibile 628 de rânduri: Albania 61, Bosnia 90, Kosovo 38, Macedonia N 80, Muntenegru 25, Serbia 166, Turcia 42, Moldova 15, România 111. Sumarul conține 4.580 de localități; exporturile filtrate nu includ toate rândurile, în special în România și Moldova. Rândurile absente nu sunt generate.

610 rânduri au poziții orientative asociate după nume și regiune din GeoNames (CC BY 4.0, https://www.geonames.org/). Sunt centre de localitate sau municipalitate, nu limite sau adrese ale comunităților. Cele 18 rânduri ambigue/fără nume rămân în listă cu geometrie nulă. Duplicate precum Ege și Örnekköy sunt păstrate ca rânduri distincte ale sursei. Cifrele de recensământ și cele din alte surse rămân separate; nu sunt însumate.

Filtrele de țară, cele patru statusuri REDI, campania health și localizarea se aplică și hărții. Selectarea unei înregistrări afișează toate coloanele originale. În Sumar REDI se pot consulta acoperirea, toate foile originale și referințele bibliografice. Exporturile păstrează și înregistrările fără geometrie.


### Contururi administrative

Registrul are acum un import suplimentar de contururi reale pentru toate cele 628 de rânduri: 534 contururi de localitate, 36 municipalități mai largi și 58 regiuni de referință, reprezentate ca 560 de zone distincte. Toate cele 111 înregistrări românești au contur de localitate. Sursele și anii diferă: datele nu reprezintă automat delimitările administrative din prezent. În special Tuzi și Zeta folosesc municipalitatea Podgorica din sursa 2017 ca referință mai largă; Moldova are raioane și Turcia provincii. Contururile nu afirmă limitele populației Roma.

La verificarea importului inițial din Administrare → Jurnal, `boundaryImport.ts` completează în Supabase geometria originală a înregistrărilor de catalog. Nu este necesară o nouă schemă SQL. Sunt păstrate editările numelui, statusului și notelor; geometriile personalizate și înregistrările șterse sunt excluse. Comparația întregului document la actualizare protejează și editările concurente. Importul se poate relua după o eroare și are un marcaj de finalizare în baza de date, ascuns din lista de sumare.

Contururile comune sunt desenate o singură dată; popup-ul oferă acces la fiecare rând. Liniile întrerupte indică zone mai largi, iar panoul și exporturile includ nivelul, sursa, anul și licența. Cele 18 puncte inițial necunoscute rămân marcate ca localizare neconfirmată, chiar dacă regiunea lor de referință este afișată.

Surse, licențe și pașii opționali de regenerare: [BOUNDARY_SOURCES.md](src/data/BOUNDARY_SOURCES.md).


## Module, roluri și propuneri — prima etapă

Această etapă implementează prioritatea confirmată: module, RBAC și validarea comunităților. Nu reprezintă finalizarea tuturor funcțiilor din specificația extinsă.

### Activare pe Supabase

1. Aplicați întâi migrarea de stocare, apoi `supabase/migrations/202611270001_governance.sql` în SQL Editor. A doua migrare este aditivă și repetabilă: păstrează înregistrările, sursele și marcajele de import existente. Nu ocoliți migrarea prin reactivarea rutelor vechi fără verificări de acces.
2. Creați sau identificați contul inițial în **Supabase Auth → Users**. În SQL Editor, ca proprietar al proiectului, apelați `select public.redi_bootstrap_admin('adresa-contului-din-auth');`. Alternativ, setați local `REDI_ADMIN_EMAIL` și cheia serverului, apoi rulați `npm run admin:bootstrap`. Funcția poate fi folosită numai înainte de existența unui administrator și nu este accesibilă publicului sau utilizatorilor autentificați obișnuiți. Nu atribuie automat roluri pe baza metadatelor de înscriere.
3. Autentificați-vă în aplicație și atribuiți rolurile și teritoriile celorlalte conturi existente din **Administrare → Utilizatori**. Nu se trimit invitații automat. Un utilizator fără apartenență activă are numai acces public.
4. Dacă registrul nu a fost importat anterior, folosiți **Administrare → Jurnal → Verifică importul catalogului REDI**. Această operație necesită cheia serverului, păstrează editările și nu recreează înregistrări șterse după finalizarea importului. Citirea și modificările obișnuite nu folosesc cheia privilegiată.

Aplicarea migrării și bootstrap-ul pe proiectul găzduit nu au fost executate în această sesiune: accesul disponibil nu poate administra proiectul configurat. Testele PostgreSQL locale nu înlocuiesc verificarea conturilor și a datelor din proiectul real.

### Cele patru module

- **Hartă**: comunități, antreprenori, parteneri și suprapunere ca selecții în panoul hărții. Desenarea directă și formularele de modificare apar numai editorilor. Publicul poate trimite separat o propunere punctuală sau un contur; navigarea Google Maps/Waze apare numai când utilizatorul are deja acces la geometrie.
- **Analiză**: indicatori de bază, distribuția pe țări, calitatea registrului și comparații calculate exclusiv din datele accesibile. Selecția de țară se păstrează la deschiderea hărții. Sumarele originale, care pot conține foi din mai multe țări, sunt accesibile numai rolurilor cu acces global; sursa CSV originală este descărcabilă numai de administrator.
- **Date**: importurile existente CSV/Excel/GeoJSON cu potrivirea coloanelor, adăugare manuală și export printr-un endpoint protejat. Publicul nu vede acest modul. Exportul exclude numele persoanelor din afaceri/portofolii, contactele, notele și coloanele suplimentare. Exporturile respectă teritoriile și filtrul de țară. Administratorii pot arhiva selecția vizibilă și o pot restaura ulterior.
- **Administrare**: propuneri pentru editorii cu drept explicit de revizuire; utilizatori, aprobarea/publicarea, jurnalul, versiunile și restaurarea pentru administratori. Ultimul administrator activ nu poate fi dezactivat sau retrogradat din aplicație.

### Reguli de acces și geografie

Rolurile sunt `public_viewer`, `authorized_viewer`, `gis_editor`, `administrator`, stocate în `redi_memberships`, nu în metadate controlabile la înscriere. Un editor primește dreptul de revizuire numai explicit. Exportul poate fi revocat separat.

Fiecare teritoriu combină `country` cu restricții opționale `region`, `county`, `municipality` și `communityId`. Mai multe teritorii se reunesc. `[{"country":"*"}]` este grantul global; fără teritorii, un membru neadministrator nu primește înregistrări restricționate. Verificarea folosește atributele administrative ale înregistrării, nu un calcul PostGIS de incluziune geometrică. La actualizare se verifică atât înregistrarea anterioară, cât și rezultatul, iar un lot nepermis este respins atomic. Datele aprobate pentru public rămân disponibile și în afara teritoriilor de lucru, prin aceeași proiecție publică redusă.

Înregistrările vechi fără metadate de publicare rămân restricționate. Confidențialele sunt rezervate administratorului. Proiecția publică include numai câmpurile de bază, fără note, surse suplimentare sau demografie. Geometria exactă este omisă implicit, chiar și după publicarea informațiilor de bază.

### Fluxul propunerilor

`submitted → pending_review → under_validation → approved / rejected → published`

Propunerile sunt stocate în `redi_proposals`, separat de `redi_records`. Reviewerii desemnați pot începe revizuirea și validarea în teritoriile lor; administratorul aprobă sau respinge și publică. Respingerea necesită un motiv. Publicarea cere evaluarea confidențialității, iar accesul public și expunerea geometriei sunt opțiuni separate, debifate implicit. Publicarea creează o singură înregistrare în aceeași tranzacție. Etapa așteptată și blocarea rândului împiedică suprascrierea deciziilor concurente.

Clasificarea comunității și statusul REDI importat rămân independente de etapa de validare. Limita de propuneri este impusă în baza de date, inclusiv pentru apeluri RPC directe: 100/oră la nivel de platformă și 10/oră pentru un cont autentificat. Limita publică globală este o protecție minimă; protecția anti-abuz granulară trebuie completată înaintea unei lansări cu trafic ridicat.

`redi_audit_events` păstrează actorul, momentul, operația și instantaneele. Modificările registrului și importurile sumarelor sunt auditate prin trigger. Ștergerea normală este logică, cu `deleted_at`; restaurarea păstrează ID-ul și documentul original. Interfața arată ultimele 100 de evenimente și până la 100 de versiuni pentru o înregistrare. Protecțiile tehnice implementate nu constituie o certificare de conformitate GDPR.

### Validare și pași rămași

`npm test` include teste PostgreSQL/PGlite pentru roluri, izolarea datelor și teritoriilor, publicare, conflicte de etapă, exporturi, audit și restaurare, plus testele existente ale catalogului și importurilor. Datele din teste sunt exclusiv sintetice și nu sunt folosite ca fallback în aplicație.

Rămân pentru etapele următoare: clustering dinamic, editarea geometriei existente direct pe hartă, limite administrative suplimentare verificate, nomenclatoare configurabile de clasificări, KML, deduplicare asistată, geocodare și evaluarea preciziei, analize financiare/de penetrare avansate, hărți tematice suplimentare și validarea operațională pe proiectul găzduit. Datele și funcțiile existente de geometrie/proveniență rămân păstrate.
