# Zakelijke KM Logger

Mobiele PWA voor een individuele gebruiker om zakelijke kilometers met een priveauto lokaal te registreren.

De app werkt zonder backend, zonder login en zonder database-server. Data blijft in de browser bewaard via `localStorage`. Gebruik regelmatig een JSON-backup als eigen archief.

## Vereisten

- Node.js
- npm

## Lokaal installeren

```bash
npm install
```

## Lokaal starten

```bash
npm run dev
```

Open daarna de lokale URL die Vite toont, meestal:

```text
http://localhost:5173
```

## Build maken

```bash
npm run build
```

De productieversie komt in de map `dist`.

## Build lokaal testen

```bash
npm run preview
```

Open daarna de preview-URL die Vite toont. Dit lijkt meer op de latere productieversie dan `npm run dev`.

## Projectmap uploaden naar GitHub

1. Maak op GitHub handmatig een nieuwe repository aan.
2. Open deze projectmap lokaal.
3. Initialiseer Git en maak je eerste commit:

```bash
git init
git add .
git commit -m "Eerste versie zakelijke km logger"
```

4. Koppel daarna je nieuwe GitHub-repository. GitHub toont hiervoor de exacte commando's, bijvoorbeeld:

```bash
git remote add origin https://github.com/jouw-gebruikersnaam/zakelijke-km-logger.git
git branch -M main
git push -u origin main
```

Er is bewust geen automatische GitHub-koppeling gemaakt.

## Later koppelen aan Vercel

1. Push het project naar GitHub.
2. Ga naar Vercel en kies `Add New Project`.
3. Selecteer de GitHub-repository.
4. Gebruik deze instellingen:

- Framework preset: `Vite`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

5. Deploy het project.

De PWA-bestanden staan in `public/manifest.json`, `public/sw.js` en `public/icons/`.

## App toevoegen aan beginscherm

### iPhone

1. Open de app in Safari.
2. Tik op de deelknop.
3. Kies `Zet op beginscherm`.
4. Bevestig met `Voeg toe`.

### Android

1. Open de app in Chrome.
2. Tik op het menu met drie puntjes.
3. Kies `App installeren` of `Toevoegen aan startscherm`.
4. Bevestig de installatie.

## JSON-backup

In `Backup/export` kun je per maand, kwartaal, jaar of voor alles een JSON-backup maken. Die backup bevat instellingen, periodegegevens en ritten in exportformaat `1.0`.

Bij import controleert de app:

- of het bestand bij `Zakelijke KM Logger` hoort
- of `exportFormatVersion` klopt
- hoeveel ritten in het bestand staan
- hoeveel ritten mogelijk dubbel zijn op basis van `id`

Daarna kies je zelf of je bestaande data vervangt of de import toevoegt.

## CSV-export

Er zijn twee CSV-exports:

- Ritten-CSV: alle ritregels met datum, adressen, klant, project, doel, kilometers, bedrag, status en notitie.
- Boekhouder-CSV: compact overzicht met periode, aantal zakelijke ritten, totaal zakelijke kilometers, kilometertarief, totaal bedrag en aantal incomplete ritten.

Alleen complete zakelijke ritten tellen mee voor aftrekbare bedragen. Priveritten en incomplete ritten blijven zichtbaar, maar tellen niet mee.

## GPS als hulpmiddel

Het scherm `GPS-rit` vraagt alleen bij start en einde een locatie op via de browser. De app doet geen automatische ritdetectie en geen permanente background tracking.

GPS-coordinaten en hemelsbrede afstand zijn hulpmiddelen. Controleer altijd adressen en definitieve kilometers voordat je opslaat.

## Schermen

- Dashboard
- Nieuwe rit
- GPS-rit
- Ritten
- Rapportage
- Backup/export
- Instellingen
