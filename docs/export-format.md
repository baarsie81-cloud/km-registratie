# JSON Exportformaat

Dit document beschrijft het vaste JSON-exportformaat van **Zakelijke KM Logger**.

Dit formaat is leidend voor apps die deze data later importeren, waaronder de toekomstige `km-bundelaar-dashboard` app.

## Versie

De huidige exportversie is:

```json
{
  "exportFormatVersion": "1.0"
}
```

Importerende apps moeten deze waarde controleren voordat data wordt verwerkt.

## Hoofdstructuur

Een exportbestand is een JSON-object met deze hoofdvelden:

```json
{
  "appName": "Zakelijke KM Logger",
  "exportFormatVersion": "1.0",
  "appVersion": "1.0.0",
  "exportedAt": "2026-05-17T10:00:00.000Z",
  "user": {},
  "period": {},
  "trips": []
}
```

Velden:

- `appName`: vaste appnaam, altijd `Zakelijke KM Logger`.
- `exportFormatVersion`: versie van dit exportformaat, momenteel `1.0`.
- `appVersion`: versie van de app die het bestand heeft gemaakt.
- `exportedAt`: ISO 8601 timestamp waarop het bestand is geëxporteerd.
- `user`: gegevens van de gebruiker en auto-instellingen.
- `period`: periode waarop de export betrekking heeft.
- `trips`: lijst met geëxporteerde ritten.

## User-object

Het `user`-object beschrijft de instellingen op het moment van export.

```json
{
  "name": "Jan Baars",
  "vehicle": "Privéauto",
  "licensePlate": "AB-123-C",
  "defaultMileageRate": 0.23
}
```

Velden:

- `name`: naam van de gebruiker.
- `vehicle`: standaard voertuig.
- `licensePlate`: kenteken, mag leeg zijn.
- `defaultMileageRate`: standaard kilometertarief.

## Period-object

Het `period`-object beschrijft de gekozen exportperiode.

```json
{
  "from": "2026-01-01",
  "to": "2026-03-31"
}
```

Velden:

- `from`: startdatum van de exportperiode in `YYYY-MM-DD`.
- `to`: einddatum van de exportperiode in `YYYY-MM-DD`.

Bij een export van `alles` mogen `from` en `to` leeg zijn als er nog geen ritten zijn.

## Trips-array

`trips` is een array met ritobjecten.

Elke rit gebruikt dezelfde veldnamen als de app intern gebruikt.

## Verplichte Velden Per Rit

Voor importdoeleinden moet elke rit minimaal deze velden bevatten:

- `id`
- `userName`
- `date`
- `startAddress`
- `endAddress`
- `purpose`
- `finalKm`
- `tripType`
- `mileageRate`
- `deductibleAmount`
- `status`
- `createdAt`
- `updatedAt`

Let op: een rit kan `status: "incompleet"` hebben. In dat geval kunnen inhoudelijk verplichte bedrijfsgegevens, zoals `purpose` of `finalKm`, leeg zijn. De veldnaam zelf moet dan nog steeds aanwezig zijn.

## Optionele Velden Per Rit

Deze velden mogen aanwezig zijn en kunnen leeg zijn:

- `startTime`
- `endTime`
- `startLat`
- `startLng`
- `endLat`
- `endLng`
- `customer`
- `project`
- `odometerStart`
- `odometerEnd`
- `calculatedKm`
- `manualKm`
- `returnTrip`
- `note`

Aanbevolen is om alle bekende tripvelden altijd mee te geven, ook als sommige waarden leeg zijn. Dat maakt imports voorspelbaar.

## Tripvelden

Volledig ritmodel:

```json
{
  "id": "trip-001",
  "userName": "Jan Baars",
  "date": "2026-01-15",
  "startTime": "08:30",
  "endTime": "09:15",
  "startAddress": "Hoofdkantoor, Amsterdam",
  "endAddress": "Klantlocatie, Utrecht",
  "startLat": 52.3676,
  "startLng": 4.9041,
  "endLat": 52.0907,
  "endLng": 5.1214,
  "customer": "Voorbeeld BV",
  "project": "Adviestraject",
  "purpose": "Klantafspraak",
  "odometerStart": 42110,
  "odometerEnd": 42152,
  "calculatedKm": 42,
  "manualKm": 42,
  "finalKm": 42,
  "returnTrip": false,
  "tripType": "zakelijk",
  "mileageRate": 0.23,
  "deductibleAmount": 9.66,
  "status": "compleet",
  "note": "Heenrit naar afspraak.",
  "createdAt": "2026-01-15T07:20:00.000Z",
  "updatedAt": "2026-01-15T08:20:00.000Z"
}
```

## Kilometerwaarden

De app gebruikt drie kilometerwaarden:

- `calculatedKm`: automatisch berekende afstand. Dit kan komen uit kilometertellerstanden of uit een GPS-schatting. Bij GPS is dit een hemelsbrede schatting en geen routeafstand.
- `manualKm`: handmatig ingevulde of gecorrigeerde kilometers door de gebruiker.
- `finalKm`: definitieve kilometerwaarde die voor overzichten, rapportages en exports gebruikt wordt.

Importerende apps moeten `finalKm` als leidend behandelen.

Als `manualKm` en `calculatedKm` verschillen, betekent dit dat de gebruiker de berekende waarde handmatig heeft gecorrigeerd.

## Status

`status` heeft een van deze waarden:

- `compleet`
- `incompleet`

Een rit is `compleet` als minimaal aanwezig zijn:

- `date`
- `startAddress`
- `endAddress`
- `purpose` bij zakelijke ritten
- `finalKm` groter dan 0

Een rit is `incompleet` als belangrijke gegevens ontbreken.

Importerende apps moeten incomplete ritten wel bewaren en tonen, maar ze niet automatisch meetellen als fiscaal complete rit.

## Aftrekbaar Bedrag

`deductibleAmount` wordt berekend als:

```text
finalKm * mileageRate
```

Voorbeeld:

```text
42 * 0.23 = 9.66
```

Alleen complete zakelijke ritten tellen mee voor aftrekbare totalen.

Privéritten mogen zichtbaar blijven in imports en rapportages, maar tellen niet mee voor aftrekbare bedragen.

## Toekomstige Uitbreidingen

Nieuwe velden mogen in toekomstige versies worden toegevoegd zonder bestaande imports te breken.

Regels voor compatibiliteit:

- Bestaande veldnamen mogen niet van betekenis veranderen binnen `exportFormatVersion: "1.0"`.
- Importerende apps moeten onbekende extra velden negeren of bewaren.
- Nieuwe optionele velden mogen worden toegevoegd aan ritten, `user`, `period` of de hoofdstructuur.
- Verplichte wijzigingen vereisen een nieuwe `exportFormatVersion`, bijvoorbeeld `"2.0"`.
- Imports voor versie `1.0` mogen niet falen op onbekende extra velden.

## Volledig Voorbeeld

```json
{
  "appName": "Zakelijke KM Logger",
  "exportFormatVersion": "1.0",
  "appVersion": "1.0.0",
  "exportedAt": "2026-05-17T10:00:00.000Z",
  "user": {
    "name": "Jan Baars",
    "vehicle": "Privéauto",
    "licensePlate": "AB-123-C",
    "defaultMileageRate": 0.23
  },
  "period": {
    "from": "2026-01-01",
    "to": "2026-03-31"
  },
  "trips": [
    {
      "id": "trip-2026-001",
      "userName": "Jan Baars",
      "date": "2026-01-15",
      "startTime": "08:30",
      "endTime": "09:15",
      "startAddress": "Hoofdkantoor, Amsterdam",
      "endAddress": "Klantlocatie, Utrecht",
      "startLat": 52.3676,
      "startLng": 4.9041,
      "endLat": 52.0907,
      "endLng": 5.1214,
      "customer": "Voorbeeld BV",
      "project": "Adviestraject",
      "purpose": "Klantafspraak",
      "odometerStart": 42110,
      "odometerEnd": 42152,
      "calculatedKm": 42,
      "manualKm": 42,
      "finalKm": 42,
      "returnTrip": false,
      "tripType": "zakelijk",
      "mileageRate": 0.23,
      "deductibleAmount": 9.66,
      "status": "compleet",
      "note": "Heenrit naar afspraak.",
      "createdAt": "2026-01-15T07:20:00.000Z",
      "updatedAt": "2026-01-15T08:20:00.000Z"
    },
    {
      "id": "trip-2026-002",
      "userName": "Jan Baars",
      "date": "2026-01-15",
      "startTime": "16:20",
      "endTime": "17:05",
      "startAddress": "Klantlocatie, Utrecht",
      "endAddress": "Hoofdkantoor, Amsterdam",
      "startLat": 52.0907,
      "startLng": 5.1214,
      "endLat": 52.3676,
      "endLng": 4.9041,
      "customer": "Voorbeeld BV",
      "project": "Adviestraject",
      "purpose": "Terugreis klantafspraak",
      "odometerStart": "",
      "odometerEnd": "",
      "calculatedKm": "",
      "manualKm": 42,
      "finalKm": 42,
      "returnTrip": true,
      "tripType": "zakelijk",
      "mileageRate": 0.23,
      "deductibleAmount": 9.66,
      "status": "compleet",
      "note": "Terugrit handmatig bevestigd.",
      "createdAt": "2026-01-15T15:10:00.000Z",
      "updatedAt": "2026-01-15T16:10:00.000Z"
    }
  ]
}
```
