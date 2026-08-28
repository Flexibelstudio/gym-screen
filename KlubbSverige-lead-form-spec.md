# KlubbSverige-form & lead-taggning — spec till dev-chatten

## Mål
En egen ingång (form/landningssida) för KlubbSverige-medlemmar som:
1. fångar leads,
2. taggar dem som KlubbSverige-källa för attribution,
3. stödjer verifiering av medlemskap via org.nr.

Erbjudande som visas: **15% rabatt på mjukvaran (på gällande pris), exklusivt för KlubbSverige.**

## Datamodell — utöka `Lead`
`leads` ägs av träningsappen, så detta är inom en apps ägarskap. Lägg till som **valfria** fält (bakåtkompatibelt, bryter inget befintligt, kräver ej godkännande enligt SHARED-CONTRACT):

```ts
export interface Lead {
  id: string;
  name: string;
  email: string;
  gymName: string;
  phone?: string;
  message?: string;
  status: 'new' | 'contacted' | 'archived';
  createdAt: number;
  // NYTT (valfritt):
  source?: 'website' | 'klubbsverige' | string; // kanal/attribution
  orgNumber?: string;          // för medlemsverifiering
  campaignCode?: string;       // koden medlemmen kom in via
  memberVerified?: boolean;    // sätts när org.nr matchats mot registret
  screensInterested?: number;  // antal skärmar/anläggningar (för offert)
}
```

## Formulärfält (KlubbSverige-form)
**Obligatoriska**
- Anläggningens namn → `gymName`
- Org.nr → `orgNumber`
- Kontaktperson → `name`
- E-post → `email`

**Valfria**
- Telefon → `phone`
- Antal skärmar/anläggningar → `screensInterested`
- Meddelande → `message`

**Dolda / förifyllda**
- `source = 'klubbsverige'`
- `campaignCode` (från URL-param, t.ex. `/klubbsverige?kod=KLUBB2026`, eller ett inmatat fält)

## Ingång & exklusivitet
- Egen route, t.ex. `/klubbsverige` — **inte** länkad från publik meny.
- Länken/koden sprids **bara** via KlubbSveriges kanaler (nyhetsbrev + partnersida bakom medlemsinloggning). Det är i praktiken medlemsspärren.
- Visa 15%-erbjudandet på sidan. Visa **inte** KlubbSverige-priset på den publika sajten (avtalskrav §3.7.1 på unikt erbjudande).

## Verifiering (v1 = manuell, räcker gott)
1. Nya KlubbSverige-leads syns i admin med `source = 'klubbsverige'`.
2. Admin stämmer av `orgNumber`/`gymName` mot KlubbSveriges medlemsregister (tillgängligt via avtal §3.4), sätter `memberVerified = true` och aktiverar rabatten.
3. (Senare, valfritt: importera medlemsregistret till en collection och matcha `orgNumber` automatiskt → sätt `memberVerified` redan vid inskick.)

## Partner
- Lägg KlubbSverige i `system_partners` (använd befintligt `Partner`-interface: `name`, `logoUrl`, `websiteUrl`).

## Admin-vy
- Filtrera leads på `source`.
- Visa `memberVerified`-status + knapp för att markera verifierad.
- Behåll befintlig `status`-flöde ('new' → 'contacted' → 'archived').
