# WealthOS

Jouw volledige financiële leven, op één scherm.

WealthOS is een persoonlijke financiële cockpit, gebouwd met React Native + Expo en beschikbaar als een echte **Windows-desktopapp** (installer, zie hieronder) en — dezelfde codebase, geen aparte versie — voor iOS en Android. Het geeft in één oogopslag antwoord op: hoeveel bezit ik, waar staat mijn geld, hoeveel beleg ik, wat heb ik uitgegeven, en hoe ontwikkelt mijn vermogen zich? De app is **local-first**: alle gegevens staan alleen op het apparaat, er is geen account, cloud of server nodig, en de app werkt volledig offline.

WealthOS is een persoonlijke tracker en geeft geen financieel advies. Het is geen bank of broker, doet geen betalingen en plaatst geen orders.

## Wat is gebouwd

- **Dashboard**: totaal vermogen, vermogensgrafiek (1W–Alles), vermogensverdeling (donut), portefeuille-preview, recente transacties, en dynamische "Jouw maand"-inzichten.
- **Rekeningen**: betaalrekeningen, spaarrekeningen en contant geld — toevoegen, bewerken, verwijderen, saldo-over-tijd grafiek.
- **Beleggingen**: aandelen, ETF's, crypto en fondsen, met meerdere aan-/verkopen per positie, correct gewogen gemiddelde aankoopprijs, sorteren en filteren.
- **Transacties**: zoeken, filteren op type, groeperen per datum.
- **Budgetten**: per categorie per maand, met voortgangsbalk en status (op schema / let op / bijna op / overschreden).
- **Schulden**: hypotheek, lening, creditcard — meegenomen in de netto-vermogensberekening.
- **Analyse**: inkomsten/uitgaven deze maand, netto cashflow, spaarpercentage, uitgavenanalyse per categorie, maandvergelijking.
- **Lokale profielen + PIN (sinds 0.3.0)**: meerdere personen kunnen dezelfde installatie gebruiken met volledig gescheiden data per profiel, elk met een eigen 4-cijferige PIN. De PIN wordt alleen als hash opgeslagen, in dezelfde versleutelde secure-storage als de marktdata-API-keys (nooit in platte tekst, nooit in de gewone app-data).
- **Instellingen**: thema (licht/donker/systeem), valuta, privacy-modus, profielbeheer, JSON-export/import, demo-data reset.
- **Demo-data**: 4 rekeningen, 8 beleggingen, 26 transacties, 6 budgetten, 1 schuld en 12 maanden vermogenshistorie — allemaal onderling consistent (assets − liabilities = net worth, exact). Demo-data gebruikt nooit live marktdata en werkt altijd, ook zonder API-key.
- **Live marktdata (optioneel, sinds 0.2.0, met eerlijke live-status sinds 0.4.0 en correcte currency-conversie sinds 0.4.1)**: koersen, instrumentgrafieken (1D–MAX) en wisselkoersen — zie de sectie hieronder.
- **273 unit tests** voor financiële berekeningen, FX-conversie, market-data caching, live/offline-statuslogica en provider-foutafhandeling (zie [TESTING.md](TESTING.md)), inclusief edge cases (nul, negatief, leeg, over-verkoop, offline, ongeldige API-key, quote-currency ≠ positie-currency).

## Windows-desktopversie

WealthOS draait als een echte Windows-app: een dubbelklikbare installer die een start­menu-snelkoppeling, een taakbalk-icoon en een eigen venster aanmaakt — geen browser, geen internet, geen account nodig.

### Hoe het werkt

De desktopversie is de bestaande Expo-webexport (dezelfde React/TypeScript-code als de mobiele app, via `react-native-web`), verpakt met [Electron](https://www.electronjs.org/) (`electron/main.js`). Er is geen aparte "Windows-versie" van de businesslogica — rekeningen, transacties, beleggingen, budgetten, berekeningen, privacy-modus en licht/donker-thema zijn letterlijk dezelfde code als op mobiel. Alleen back-up/herstel heeft een kleine desktop-specifieke variant gekregen (zie hieronder), omdat de mobiele bestandskiezer (`expo-file-system`/`expo-sharing`) geen webimplementatie heeft.

Financiële gegevens staan lokaal in de Chromium-`localStorage` van de app, in `%APPDATA%\WealthOS\` — nergens anders, nooit naar internet verstuurd. De app laadt via een eigen `wealthos-app://`-protocol in plaats van `file://` of een willekeurige poort: dat geeft de app op elke start exact dezelfde herkenbare "oorsprong", wat noodzakelijk is omdat browseropslag per oorsprong (inclusief poortnummer) gescheiden wordt — met een willekeurige poort zou elke herstart een lege, nieuwe opslag zien. Dit is expliciet getest: gegevens overleven een volledige (geforceerde) afsluiting en herstart.

### Back-up / gegevens veiligstellen

Instellingen → "Exporteren, importeren & reset" → Exporteren opent een native Windows "Opslaan als"-dialoog (geen browserdownload-map) om een JSON-back-up van al je gegevens weg te schrijven; Importeren opent een native bestandskiezer om een eerder geëxporteerd bestand terug te zetten, met dezelfde validatie (Zod-schema, versiecontrole) als op mobiel — een ongeldig of vreemd bestand wordt geweigerd, nooit gedeeltelijk toegepast.

### De installer zelf bouwen

```bash
npm run dist:win
```

Dit exporteert eerst de webbundel (`expo export -p web` → `dist/`) en verpakt die daarna met `electron-builder` tot `release\WealthOS Setup <versie>.exe` (~200 MB, want Electron bundelt een eigen Chromium + Node.js — dat is de prijs van een offline, geen-installatie-vereisten-desktopapp).

### Installeren

1. Dubbelklik `release\WealthOS Setup <versie>.exe` (bijv. `WealthOS Setup 0.4.2.exe`).
2. **Windows SmartScreen kan waarschuwen** ("Windows heeft je pc beschermd") — dit is normaal voor een app zonder betaald Authenticode-certificaat (~€300-500/jaar), niet een teken dat er iets mis is. Klik "Meer info" → "Toch uitvoeren".
3. De installer is one-click: hij installeert direct naar `%LOCALAPPDATA%\Programs\WealthOS` en zet snelkoppelingen op het Bureaublad en in het Startmenu, zonder verdere vragen.
4. Start WealthOS vanaf het Startmenu of Bureaublad zoals elk ander programma.

Verwijderen kan gewoon via Instellingen → Apps, of via de meegeïnstalleerde "Uninstall WealthOS"-snelkoppeling.

**Waarom one-click en geen keuze van installatiemap:** de eerdere "assisted"-installer (met een map-kiezer) bleek de stille installatievlag (`/S`) niet betrouwbaar te ondersteunen — een bekende beperking van electron-builder/NSIS — en kon vasthangen op een onzichtbare wizardpagina. Een one-click-installer heeft die pagina niet en installeert altijd naar de standaardlocatie, wat dit probleem volledig voorkomt.

### Problemen oplossen

Renderer-fouten (JavaScript-fouten in de UI) worden weggeschreven naar `%APPDATA%\WealthOS\logs\renderer.log` — dit bestand bestaat alleen als er daadwerkelijk een waarschuwing of fout is opgetreden; geen bestand betekent een schone sessie.

## Live marktdata (optioneel)

WealthOS kan actuele koersen, historische grafieken, dividend- en bedrijfsinformatie tonen voor beleggingen die je daaraan koppelt — volledig optioneel, gratis, en met je eigen API-key. Staat live marktdata uit (de standaardinstelling) of heb je geen key ingevuld, dan werkt de rest van de app exact zoals in 0.1.0.

### Instellen (geen terminal nodig)

1. Ga naar **Instellingen → Live marktdata** en zet de schakelaar aan.
2. Maak gratis een account op [twelvedata.com](https://twelvedata.com) en/of [alphavantage.co](https://www.alphavantage.co/support/#api-key), en plak de gratis API-key in het betreffende veld.
3. Druk op "Verbinding testen" om te bevestigen dat de key werkt.
4. Kies bij "Belegging toevoegen" via het zoekveld de juiste beurs-notering (bijv. Euronext Amsterdam versus een Amerikaanse notering van hetzelfde aandeel) — WealthOS onthoudt daarna welke exacte notering bij die positie hoort.

### Providers en wat ze doen

| Provider | Rol | Gebruikt voor |
|---|---|---|
| **Twelve Data** | Primair | Koersen (aandelen/ETF/crypto/forex), historische koersen (grafieken), symboolzoeken, wisselkoersen |
| **Alpha Vantage** | Secundair, optioneel | Alleen dividend- en bedrijfsinformatie — bewust nooit voor koersen (zie hieronder) |

Beide zijn providerkeuzes achter een gedeelde interface (`MarketDataProviderClient` / `MarketDataService`) — geen scherm praat rechtstreeks met een provider, dus een providerwissel raakt nooit de UI. Deze scheiding is ook een bewuste juridische keuze: Alpha Vantage's realtime/15-min-vertraagde koersdata valt onder een aparte, beurs-gereguleerde licentie (FINRA/SEC) die niet gratis is; hun *dividend/company-overview*-endpoints vallen daar niet onder en zijn wel gratis beschikbaar (25 verzoeken/dag) — WealthOS gebruikt Alpha Vantage daarom uitsluitend voor dat laatste.

### Live/vertraagd/offline-status — nooit een verzonnen "LIVE"

Elke gekoppelde belegging en elk wisselkoerspaar toont een eerlijke status, herleid uit een enkele functie die nooit raadt:

- **LIVE** — de laatste ververs-poging is ook de laatst geslaagde, en recent genoeg (aandelen/ETF/forex binnen ~10 min, crypto binnen ~5 min).
- **VERTRAAGD** — laatst geslaagde koers is ouder dan dat, maar er is niets fout gegaan.
- **OFFLINE** — live marktdata staat uit, er is geen API-key, of er is nog nooit succesvol iets opgehaald.
- **FOUT** — de laatste ververs-poging is mislukt (ratelimit, ongeldige key, offline, onbekend symbool) — met de exacte reden erbij.

Deze status wordt nooit op cache-leeftijd alleen gebaseerd: een recente succesvolle koers die daarna niet meer ververst kan worden (bijv. omdat live marktdata is uitgezet) valt terug naar OFFLINE in plaats van een verouderde LIVE te blijven tonen.

### Instrumentgrafieken

Tikken op een gekoppelde aandeel/ETF/crypto/forex-positie opent een detailscherm met een echte koersgrafiek (1D/5D/1M/3M/1Y/MAX) op basis van Twelve Data's historische data — nooit demo- of willekeurige data. Wisselkoersen hebben een eigen overzicht ("Meer → Wisselkoersen") met dezelfde soort grafiek.

### Multi-currency waardering — quote-valuta versus positie-valuta

Een koers komt soms in een andere valuta binnen dan de positie zelf is opgeslagen (bijv. een BTC/USD-koers voor een positie die je zelf in EUR hebt aangemaakt, of een Amerikaans aandeel in een EUR-portefeuille). WealthOS onderscheidt dit expliciet:

1. **Quote-valuta** (wat de provider teruggeeft) wordt via de bestaande wisselkoers-cache/provider omgerekend naar de **positie-valuta** (hoe jij de positie hebt aangemaakt) vóórdat de koers wordt opgeslagen.
2. Is er geen geldige wisselkoers beschikbaar (offline, ratelimit, geen key) — dan blijft de positie op zijn laatst bekende, correcte waarde staan. Nooit een stille 1-op-1-omrekening, nooit een bedrag in de verkeerde valuta.
3. Verschilt de koers- van de positie-valuta, dan staat dat expliciet bij de positie (bijv. "Koers in USD, omgerekend naar EUR").
4. Portefeuille- en dashboardtotalen (in je eigen basisvaluta) gebruiken dezelfde, al-omgerekende waarde — nooit een losstaande, inconsistente berekening.

### Belangrijk: gratis-tier beperkingen (laatst geverifieerd tegen de actuele officiële voorwaarden)

- **Geen realtime**: koersen zijn vertraagd (doorgaans ~15 minuten) en worden zo gelabeld — nooit als "live" in de betekenis van tick-by-tick.
- **Ratelimits**: Twelve Data's gratis "Basic"-plan staat 8 verzoeken/minuut en 800/dag toe. WealthOS ververst daarom niet vaker dan nodig (aandelen/ETF/forex ~10 min, crypto ~5 min), bundelt meerdere posities in één verzoek waar mogelijk, en wacht 15 minuten na een ratelimit-fout voordat het opnieuw probeert.
- **Amerikaanse markten zijn de kern van het gratis plan**; Twelve Data's eigen documentatie noemt realtime dekking primair voor Amerikaanse beurzen. **Europese aandelen/ETF's zijn daardoor wisselend beschikbaar** — dit verschilt per instrument (bijv. Adyen was gratis beschikbaar, Heineken niet) en wordt niet vooraf gegarandeerd door de provider. WealthOS kan dit dus niet garanderen; als een notering niet beschikbaar is op je gratis plan, toont de app een eerlijke FOUT-status en blijft de laatst bekende of handmatig ingevoerde waarde zichtbaar — nooit een crash, nooit een foutieve LIVE-melding.
- **Dividend/bedrijfsinformatie**: op Twelve Data's gratis plan zitten fundamentals (dividend, company profile) achter een betaald plan — daarom haalt WealthOS die uitsluitend bij Alpha Vantage op (gratis, 25 verzoeken/dag), nooit bij Twelve Data.
- **Alleen persoonlijk, niet-commercieel gebruik**: elke gebruiker maakt zijn eigen gratis account aan en ziet alleen zijn eigen data, opgehaald met zijn eigen key — WealthOS heeft geen eigen server, slaat niets centraal op en stuurt niets door naar derden of andere gebruikers. Dat valt binnen de "internal/personal use"-voorwaarden van beide providers (geen doorlevering aan derden, geen commercieel gebruik van gratis-tier-data); commercieel hergebruik wordt niet ondersteund. Deze voorwaarden zijn niet alleen ooit gecontroleerd maar zijn opnieuw tegen de actuele officiële pagina's van beide providers geverifieerd.

### API-keys: opslag en veiligheid

- Keys worden **nooit** hardcoded, gelogd, of in een export/back-up meegenomen.
- Op Windows staan ze versleuteld via Electron's `safeStorage` (Windows DPAPI) in een apart bestand (`secure-keys.json`), volledig gescheiden van de gewone app-data die de export/import-functie gebruikt. Profiel-PIN's (zie hierboven) gebruiken dezelfde versleutelde opslag, elk onder een eigen per-profiel sleutel.
- Verwijderen van een key via Instellingen wist 'm direct en definitief uit die versleutelde opslag.
- Een export/back-up bevat nooit `secure-keys.json` en nooit een key-waarde — alleen booleans zoals "Twelve Data gekoppeld: ja/nee". Een import kan dus nooit een bestaande key overschrijven of verwijderen.

### Cache en offline-gedrag

Elke koers, historische reeks, dividend- en bedrijfsprofiel wordt lokaal gecached, met de beurs-notering als onderdeel van de cache-sleutel (zodat bijvoorbeeld een Amerikaanse en een Europese notering van hetzelfde aandeel nooit door elkaar lopen). Is de provider tijdelijk onbereikbaar, geeft een ratelimit-fout, of is er geen internet: WealthOS toont de laatst bekende gecachte waarde met een duidelijk "Cache · bijgewerkt HH:MM"-label in plaats van een foutmelding of een crash.

## Architectuur

```
app/            Schermen (Expo Router file-based routing)
components/     Herbruikbare UI-componenten + form/ subset
features/       Domeinlogica die meerdere lagen combineert (demo-data, insights, import/export, app-lock)
hooks/          useTheme, usePrivacyFormat, useWealthSummary, usePortfolioSnapshots
lib/            calculations.ts, storage.ts, security.ts, repositories/
services/       banking/, brokerage/, market/ — providers achter interfaces
store/          Zustand stores (accounts, investments, transactions, budgets, liabilities, settings, marketData, profile)
types/          models.ts (domeinmodel), providers.ts (toekomstige integraties)
utils/          money.ts, date.ts, id.ts, validation.ts (Zod)
constants/      theme.ts (design tokens), categories.ts
tests/          Jest unit tests
```

**UI → Store → Repository → Storage.** Schermen lezen en muteren nooit direct AsyncStorage. Elke entiteit heeft een repository (`lib/repositories/`) die CRUD + timestamps regelt; elke store (`store/`) houdt de in-memory lijst bij voor reactieve UI en coördineert cross-entity effecten (zie hieronder). Dit is de enige source of truth — er staat nergens een los hardcoded getal op een scherm.

### Waarom AsyncStorage in plaats van SQLite

Voor een single-user local-first tracker met een paar honderd tot een paar duizend records is een document-store per entiteit (JSON-array in AsyncStorage, via een generieke `BaseRepository<T>`) eenvoudiger, minder foutgevoelig zonder native SQL-migraties te hoeven schrijven en testen, en ruim voldoende performant. Zie punt 63/#85 in de opdracht: AsyncStorage wordt expliciet genoemd als geschikte optie. Mocht de app naar een schaal groeien waar dit niet meer volstaat (tienduizenden transacties), is de repository-laag het punt waarop je zonder UI-wijzigingen naar `expo-sqlite` kunt overstappen — de interface (`getAll`, `getById`, `save`, `remove`) blijft gelijk.

Gevoelige instellingen (de PIN-hash) staan apart in `expo-secure-store`, niet in de gewone AsyncStorage-collectie.

### Transaction impact — hoe een transactie het rekeningsaldo raakt

Een handmatige transactie past het saldo van de gekoppelde rekening automatisch aan (`store/transactionsStore.ts`):

- **Inkomst** → saldo `+= bedrag`
- **Uitgave** en **Belegging** (als uitstroom-categorie) → saldo `-= bedrag`
- **Overboeking** → saldo blijft ongewijzigd (dit model kent geen doelrekening-veld; een overboeking wordt alleen vastgelegd voor cashflow-inzicht, niet verrekend)

Bij **bewerken** wordt eerst het effect van de oude transactie teruggedraaid (op de oude rekening, met het oude bedrag/type) en dàn het nieuwe effect toegepast (op de nieuwe rekening, met het nieuwe bedrag/type) — nooit allebei tegelijk zonder terugdraaien, om dubbele boekingen te voorkomen. Bij **verwijderen** wordt het effect eenmalig teruggedraaid.

Demo-data is hier een uitzondering: de seed-functie zet rekeningsaldi en transacties onafhankelijk van elkaar neer als een reeds-consistente startsituatie, in plaats van transactie-voor-transactie te "spelen" — dat zou voor identieke eindresultaten zorgen maar nodeloos complex zijn voor data die toch al gegarandeerd correct is opgezet.

### Investeringen — meerdere aankopen en het gewogen gemiddelde

Elke koop/verkoop wordt vastgelegd als een `InvestmentTransaction`. Na elke koop/verkoop herberekent `calculateWeightedAveragePosition` (`lib/calculations.ts`) de volledige positie (aantal, gewogen gemiddelde aankoopprijs, geïnvesteerd bedrag) door **alle** transacties chronologisch te doorlopen — niet door het vorige weergegeven getal bij te werken. Een verkoop wijzigt nooit de gemiddelde prijs (die hoort bij wat je nog vasthoudt), alleen het aantal en het geïnvesteerde bedrag. Het aantal kan nooit negatief worden: een verkoop wordt capped op de beschikbare hoeveelheid.

### Geld en getallen

Bedragen worden intern als **integer eurocenten** opgeslagen (`10,25` → `1025`), nooit als floating-point euro's, om afrondingsfouten te voorkomen (zie `utils/money.ts`). Weergave gaat altijd via `formatMoney`/`formatMoneySigned`/`formatMoneyCompact`, die Nederlandse notatie toepassen (`€ 184.250,40`). Datums worden intern als ISO-timestamps opgeslagen en pas bij weergave naar Nederlands geformatteerd (`utils/date.ts`).

### Mock-providers en toekomstige integraties

`services/{banking,brokerage,market}/` definieert interfaces (`BankingProvider`, `BrokerageProvider`, `MarketDataProvider`) plus een `Mock*Provider`-implementatie die dezelfde vorm data teruggeeft als een echte integratie later zou doen. De UI is nooit afhankelijk van de mock-implementatie zelf, alleen van de interface — een latere PSD2/Open Banking- of broker-koppeling vervangt alleen de provider-klasse. Elke entiteit heeft een `origin`-veld (`demo` / `manual` / `synced`) zodat de UI (`DataOriginBadge`) altijd kan tonen of iets voorbeelddata, handmatig ingevoerd, of gesynchroniseerd is — er wordt nooit gedaan alsof demo-prijzen live zijn.

### Beveiliging

- Elk profiel heeft een eigen PIN, nooit in platte tekst opgeslagen — alleen een SHA-256 hash (`lib/security.ts`, via `expo-crypto`) staat in de versleutelde secure-storage (`lib/secureKeyStore.ts`: Electron `safeStorage`/Windows DPAPI op desktop, `expo-secure-store` op mobiel), per profiel gescheiden zodat een PIN-reset of profiel-verwijdering nooit financiële data van een ander profiel kan raken.
- Geen bankwachtwoorden, seed phrases of API-secrets ergens in de code of demo-data.
- **Bekend aandachtspunt**: Instellingen → Beveiliging bevat nog een PIN/biometrie-instelling uit vóór het profielensysteem (0.3.0) die niet meer aan de daadwerkelijke app-toegang gekoppeld is — de profiel-PIN (hierboven) is de enige echte voordeur. Dit scherm heeft dus geen effect meer en zou opgeruimd moeten worden; dit raakt geen marktdata-functionaliteit en is bewust niet aangepakt in deze release (zie "Resterende aandachtspunten" verderop).
- `.env`, credentials en secrets staan in `.gitignore`; `.env.example` bevat geen echte waarden en is niet nodig om de app te starten.

## Vereisten

- Node.js 20+ en npm
- Voor lokale iOS-builds: een Mac met Xcode
- Voor lokale Android-builds: Android Studio met een geconfigureerde SDK
- Voor EAS-builds in de cloud: een gratis of betaald Expo-account

## Installatie

```bash
npm install
```

Start de app (kies een target):

```bash
npx expo start
```

Dit opent Expo Dev Tools; scan de QR-code met de Expo Go-app op je telefoon, of druk op `i` / `a` voor een simulator, of `w` voor de webpreview.

## Android — lokaal ontwikkelen

Vereist een geïnstalleerde Android SDK/emulator (via Android Studio):

```bash
npx expo run:android
```

## iOS — lokaal ontwikkelen

Vereist een Mac met Xcode:

```bash
npx expo run:ios
```

Een iOS-build vereist altijd signing (een Apple-ontwikkelaarsaccount); zonder Mac/Xcode gebruik je EAS Build (hieronder) in plaats daarvan.

## Testen en controleren

```bash
npm test          # 273 unit tests: financiële berekeningen + market-data/FX/cache/live-status
npm run typecheck # strict TypeScript, geen `any`
npx expo-doctor   # health-check van dependencies en configuratie
```

Alle drie slagen op dit moment zonder fouten of waarschuwingen.

## EAS — wat jij zelf moet doen

EAS-builds draaien in Expo's cloud en hebben jouw eigen (gratis) Expo-account nodig. Dit kan niemand anders voor je doen — login vereist jouw credentials:

```bash
npx eas-cli login
```

Daarna eenmalig het project koppelen aan jouw account (schrijft een echte `projectId` in `app.json` → `extra.eas.projectId`, ter vervanging van de placeholder):

```bash
npx eas-cli build:configure
```

Voor iOS-builds heb je daarnaast een **Apple Developer-account** nodig (€99/jaar, via developer.apple.com). Bij de eerste `eas build --platform ios` vraagt EAS zelf om in te loggen met je Apple ID en regelt het certificaten en provisioning-profielen automatisch — je hoeft niets handmatig in Xcode te doen.

### Android installeren (APK, stap voor stap)

1. `npx eas-cli login`
2. `npx eas-cli build:configure`
3. `npx eas-cli build --platform android --profile preview`
4. Wacht tot de build slaagt (EAS toont een voortgangslink naar expo.dev); aan het eind krijg je een downloadlink naar een `.apk`-bestand.
5. Open die link op je Android-telefoon (of stuur 'm naar jezelf via e-mail/Drive) en tik op het gedownloade bestand.
6. Android vraagt mogelijk om "installeren van onbekende bronnen" toe te staan voor de app waarmee je het bestand opende (Bestanden-app of browser) — sta dit eenmalig toe.
7. WealthOS staat nu op je telefoon.

### iPhone installeren — development build (stap voor stap)

Vereist een Apple Developer-account.

1. `npx eas-cli build --platform ios --profile development`
2. EAS vraagt om in te loggen met je Apple ID en registreert je iPhone (het scant een QR-code of vraagt het UDID — volg de prompts van EAS zelf).
3. Na een geslaagde build: open de getoonde link op je iPhone en installeer via het `Instellingen → Algemeen → VPN en apparaatbeheer`-scherm (vertrouw het ontwikkelaarsprofiel eenmalig).
4. Start daarna de dev-server (`npx expo start --dev-client`) om de app live te gebruiken tijdens ontwikkeling.

### TestFlight (stap voor stap)

Aanbevolen manier om WealthOS op je eigen iPhone te krijgen zonder los development-gedoe.

1. `npx eas-cli build --platform ios --profile preview`
2. `npx eas-cli submit --platform ios` (uploadt de build naar App Store Connect — logt in met je Apple ID)
3. Open App Store Connect (appstoreconnect.apple.com) → TestFlight, wacht tot Apple de build heeft verwerkt (meestal enkele minuten tot een uur)
4. Installeer de **TestFlight**-app uit de App Store op je iPhone, log in met hetzelfde Apple ID, en installeer WealthOS via TestFlight.

### Production release (stap voor stap)

1. `npx eas-cli build --platform all --profile production` (bouwt een Android App Bundle + iOS-build tegelijk)
2. Android: `npx eas-cli submit --platform android` (vereist een Google Play Console-account, eenmalig €25)
3. iOS: `npx eas-cli submit --platform ios`, daarna in App Store Connect de store-vermelding (screenshots, beschrijving, privacybeleid-URL) invullen en voor review indienen.

## Wat nog ontbreekt (afhankelijk van externe accounts/credentials)

Dit zijn de enige punten die niet "klaar" zijn omdat ze een keuze of account van jou vereisen — alles daarbuiten is functioneel gebouwd en getest:

- **EAS-login**: ik kan `eas login` niet voor je uitvoeren — dat vereist jouw Expo-accountwachtwoord, wat ik principieel niet invoer. Log zelf in (`npx eas-cli login`) en de rest van de build kan direct door.
- **EAS project-ID**: `app.json` bevat een placeholder (`REPLACE_WITH_EAS_PROJECT_ID`) die pas een echte waarde krijgt na `eas build:configure` met jouw eigen Expo-account.
- **Apple Developer-account**: nodig voor elke iOS-build (development, TestFlight of App Store) — zonder account kan alleen Android en de webpreview gebouwd/getest worden.
- **App Store / Play Store metadata**: screenshots, store-beschrijving en privacybeleid-URL zijn niet gemaakt — dat zijn creatieve/juridische keuzes die bij jou horen te liggen vlak voor publicatie. Het app-icoon en de splash screen zijn wel al ontworpen (zie `assets/icon.png`) en hoeven niet vervangen te worden.
- **Real bank/broker-koppeling**: bewust niet gebouwd (zie "Geen echte bankkoppeling" in de opdracht) — de architectuur (`services/banking/`, `services/brokerage/`) is er wel klaar voor. Live marktdata (`services/market/`) is sinds 0.2.0 wél echt gebouwd, optioneel en gratis, en sinds 0.4.0/0.4.1 uitgebreid met eerlijke live-status, instrumentgrafieken en correcte multi-currency-waardering — zie de sectie hierboven.

## Resterende aandachtspunten

- Instellingen → Beveiliging bevat een niet-meer-functionele PIN/biometrie-instelling uit vóór het profielensysteem (0.3.0) — zie "Beveiliging" hierboven. Los van marktdata; bewust niet aangepakt in deze release.
- Europese aandelen/ETF's blijven instrument-afhankelijk beschikbaar op het gratis Twelve Data-plan (zie "Belangrijk: gratis-tier beperkingen"). Dit is een providerbeperking, geen bug.

## Roadmap (toekomstige uitbreidingen, nu bewust niet gebouwd)

1. Open Banking / PSD2-koppeling (via `BankingProvider`)
2. Broker-koppelingen (via `BrokerageProvider`)
3. ~~Live marktdata~~ — gebouwd in 0.2.0, uitgebreid met eerlijke live-status + grafieken in 0.4.0 en correcte multi-currency-waardering in 0.4.1 (Twelve Data + Alpha Vantage, optioneel, gratis)
4. Cloud-sync en multi-device
5. Push-notificaties (budget bijna bereikt, maandresultaat)
6. Geavanceerde analytics
7. AI-gedreven financiële inzichten
8. Terugkerende transacties
9. Automatische categorisatie

## Licentie

Zie [LICENSE](LICENSE).
