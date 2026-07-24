# DESIGN-GUIDE — SmartStudio
Riktning: "Energisk precision" — fart, tävling och tydlighet på avstånd (TV) och i farten (mobil).
Alla designändringar ska följa denna guide. Avvikelser kräver beslut av produktägaren.

## 1. Grundprinciper
- Mörk bas är standard (skärmen); ljust tema stöds fullt ut i appen.
- Primärfärgen är ALLTID organisationens temafärg via var(--color-primary) — aldrig hårdkodad kulör.
- Energi skapas med typografi, kontrast och rörelse — inte med fler färger.
- Läsbarhet på 5 meter (TV) och med svettiga tummar (mobil) går före dekoration.

## 2. Typografi
- Typsnitt: Inter (400/500/700/900). Inga nya typsnitt utan beslut.
- Rubriker: font-black, uppercase, tracking-tight.
- KRITISK REGEL (Å/Ä/Ö): versala rubriker har ALLTID leading-[1.2] och pt-[0.1em] när de ligger i container med line-clamp/truncate/overflow-hidden — annars klipps diakriterna.
- Hierarki: Display (skärmens stora tal/namn) > H1 (vyrubrik) > H2 (sektion) > Body (font-medium) > Caption (text-[10px]–xs, font-bold, uppercase, tracking-widest).
- Siffror är hjältar: tider, reps, vikter och räknare visas stort, font-black, gärna tabular-nums.

## 3. Färgsystem (semantiska tokens — se tailwind.config i index.html — detta är appens ENDA Tailwind-konfiguration)
- primary: var(--color-primary) — organisationens färg. Primära knappar, aktiva val, framsteg.
- work: orange (befintlig arbetsfärg i timern) — arbetsintervall, sidobadges, intensitet.
- rest: teal — vila och återhämtning.
- record: amber/guld — PB, rekord, stjärnmärkning, firande.
- danger: red-600 — radera, avbryt, no-show.
- Neutraler: befintlig gråskala (gray-50–950). Mörka ytor: gray-900/950 med border-white/10 som ljuskant i stället för skuggor.

## 4. Form & ytor
- Paneler/kort: rounded-3xl (skärm) / rounded-2xl (mobilkort). Knappar/chips: rounded-xl.
- Skuggor sparsamt; på mörk bas används ljuskant (border white/10) och glöd (primary/20 blur) i stället.
- Badges: uppercase, font-black, text-[9–10px], tracking-wider, färg enligt semantiken ovan.

## 5. Rörelse
- Snabb och bestämd: mikrointeraktioner 150ms, vybyten 250–300ms, easing ease-out.
- Firande (PB, pass klart): spring-animationer, konfetti — bara vid riktiga milstolpar.
- Aktiva element får pulsera (arbetsintervall, LIVE-indikatorn); statiska ytor rör sig aldrig.
- prefers-reduced-motion respekteras ALLTID med statisk variant.

## 6. Komponentregler
- Knappar: primär (bg-primary, vit text), sekundär (neutral yta + border), fara (danger). Höjd ≥48px på skärm, ≥44px på mobil. Text: font-bold/black, uppercase på skärm.
- Chips ("+ fler fält" m.fl.): etablerat mönster återanvänds — uppfinn inte nya varianter.
- Modaler: backdrop-blur, rounded-3xl, entré scale 0.92→1 + fade.
- Formulärfält: tydlig fokusring (ring-2 ring-primary), aldrig enbart färgskifte.

## 7. Förbud
- Inga nya bibliotek, typsnitt eller ikonuppsättningar utan produktägarbeslut.
- Inga hårdkodade hexfärger där en token finns.
- Inga logik-/flödesändringar i designetapper — endast visuellt.
- Datum aldrig i pass-titlar; sidoinformation aldrig i övningsnamn (etablerade regler).
- Tailwind-tokens definieras ENDAST i index.html:s inline-konfig — inga parallella konfigfiler.

Version 1.0 — beslut: riktning "Energisk precision" (produktägare Mikael).
