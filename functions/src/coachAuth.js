const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, db } = require("./init");
const { getCallerData } = require("./shared");

// ============================================================================
// COACHKODEN — steg 1 i utrullningen (se Mickes kontrakt, augusti 2026)
//
// Koden flyttas från organizations/{id}.passwords.coach (öppet läsbar) till
// organizations/{id}/private/auth.coachUnlockCode (låst i firestore.rules:
// read, write: if false). Klienten når koden ENDAST via dessa callables.
//
// INGA TYSTA RESERVER: saknas konfigurerad kod kastas failed-precondition.
// Vi faller ALDRIG tillbaka på det gamla passwords-fältet.
// ============================================================================

/**
 * Taktbegränsning enligt samma mönster som flexGeminiProxy:
 * rate_limits-collection med timestamps-lista i en transaktion.
 */
const checkRateLimit = async (docId, max, message) => {
  const rateLimitRef = db.collection("rate_limits").doc(docId);
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);

  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(rateLimitRef);
      let requests = [];

      if (doc.exists) {
        requests = (doc.data().timestamps || []).filter(ts => ts > oneHourAgo);
      }

      if (requests.length >= max) {
        throw new Error("RATE_LIMIT_REACHED");
      }

      requests.push(now);
      transaction.set(rateLimitRef, { timestamps: requests }, { merge: true });
    });
  } catch (e) {
    if (e.message === "RATE_LIMIT_REACHED") {
      throw new HttpsError("resource-exhausted", message);
    }
    throw new HttpsError("internal", "Något gick fel. Försök igen.");
  }
};

/**
 * Coachkoden körs i Europa, granne med databasen. Resten av funktionerna ligger
 * kvar i us-central1 — två av dem har fasta webbadresser som Stripe och en
 * extern integration pekar på, och de får inte byta adress.
 *
 * Kodrutan används mitt i ett pass, av någon som står och väntar. Därför hålls
 * en instans varm: kallstarten var den värsta väntan.
 */
const COACH_FN = {
  region: "europe-west1",
  enforceAppCheck: process.env.NODE_ENV === "production"
};

const privateAuthRef = (organizationId) =>
  db.collection("organizations").doc(organizationId).collection("private").doc("auth");

/**
 * verifyCoachUnlockCode — in: { organizationId, code }, ut: { ok: boolean }
 *
 * Kräver inloggning + medlemskap i organisationen.
 * Takt: 10/användare/timme + 30/organisation/timme.
 * Misslyckade försök loggas med uid, orgId och tid.
 * Ingen kod konfigurerad => failed-precondition (aldrig tyst reserv).
 *
 * INGEN App Check här, till skillnad från de andra två. Skärmarna i lokalerna
 * är gamla pekskärmar som ibland inte får igenom sitt App Check-intyg, och då
 * stod coachen låst ute mitt i ett pass. Skyddet finns kvar där det räknas:
 * anropet kräver inloggning, medlemskap i rätt organisation, klarar högst tio
 * försök i timmen per användare och trettio per gym, och själva koden lämnar
 * aldrig servern. Att låsa ute betalande kunder är ett värre fel än det App
 * Check skyddar mot här.
 */
const verifyCoachUnlockCode = onCall(
  { region: COACH_FN.region, enforceAppCheck: false, minInstances: 1 },
  async (request) => {
  const data = request.data || {};
  const organizationId = data.organizationId;
  const code = data.code;

  if (typeof organizationId !== "string" || organizationId.length === 0 || typeof code !== "string") {
    throw new HttpsError("invalid-argument", "organizationId och code krävs.");
  }

  const caller = await getCallerData(request.auth);
  if (caller.role !== "systemowner" && caller.organizationId !== organizationId) {
    throw new HttpsError("permission-denied", "Du tillhör inte den här organisationen.");
  }

  // Båda taktkontrollerna samtidigt i stället för efter varandra. De är
  // oberoende av varandra, och seriellt kostade de två väntor i rad medan
  // coachen står och tittar på rutan.
  await Promise.all([
    checkRateLimit(
      `coachverify_${caller.uid}`, 10,
      "För många försök. Vänta en stund och försök igen."
    ),
    checkRateLimit(
      `coachverify_org_${organizationId}`, 30,
      "För många försök för den här organisationen just nu. Försök igen om en stund."
    )
  ]);

  const authDoc = await privateAuthRef(organizationId).get();
  const stored = authDoc.exists ? authDoc.data().coachUnlockCode : undefined;

  if (typeof stored !== "string" || stored.length === 0) {
    throw new HttpsError(
      "failed-precondition",
      "Ingen coachkod är konfigurerad för den här organisationen."
    );
  }

  const ok = stored === code;
  if (!ok) {
    console.warn(
      `Misslyckat coachkodsförsök: uid=${caller.uid} orgId=${organizationId} tid=${new Date().toISOString()}`
    );
  }

  return { ok };
  }
);

/**
 * setCoachUnlockCode — in: { organizationId, code }, ut: { ok: true }
 *
 * Kräver org-admin (eller systemägare). 4–12 tecken, inga komplexitetskrav.
 * Returnerar aldrig koden, loggar aldrig koden.
 */
const setCoachUnlockCode = onCall(COACH_FN, async (request) => {
  if (process.env.NODE_ENV === "production" && request.app == undefined) {
    throw new HttpsError("unauthenticated", "Ogiltig App Check.");
  }

  const data = request.data || {};
  const organizationId = data.organizationId;
  const code = data.code;

  if (typeof organizationId !== "string" || organizationId.length === 0 || typeof code !== "string") {
    throw new HttpsError("invalid-argument", "organizationId och code krävs.");
  }
  if (code.length < 4 || code.length > 12) {
    throw new HttpsError("invalid-argument", "Koden ska vara 4–12 tecken.");
  }

  const caller = await getCallerData(request.auth);
  const isOrgAdmin = caller.role === "organizationadmin" && caller.organizationId === organizationId;
  if (caller.role !== "systemowner" && !isOrgAdmin) {
    throw new HttpsError("permission-denied", "Endast organisationsadmin kan ändra coachkoden.");
  }

  await privateAuthRef(organizationId).set({
    coachUnlockCode: code,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: caller.uid
  }, { merge: true });

  console.log(`Coachkod uppdaterad för org ${organizationId} av ${caller.uid}`);
  return { ok: true };
});

/**
 * getCoachUnlockCode — in: { organizationId }, ut: { code: string | null }
 *
 * Lämnar ut koden ENBART till org-admin (eller systemägare) — servern kontrollerar
 * behörigheten innan något lämnar databasen. Medlemmar och coacher nekas.
 * Används av adminvyn (Varumärke) så att admin ser gymmets kod precis som förut.
 * null betyder att ingen kod är konfigurerad ännu.
 */
const getCoachUnlockCode = onCall(COACH_FN, async (request) => {
  if (process.env.NODE_ENV === "production" && request.app == undefined) {
    throw new HttpsError("unauthenticated", "Ogiltig App Check.");
  }

  const data = request.data || {};
  const organizationId = data.organizationId;
  if (typeof organizationId !== "string" || organizationId.length === 0) {
    throw new HttpsError("invalid-argument", "organizationId krävs.");
  }

  const caller = await getCallerData(request.auth);
  const isOrgAdmin = caller.role === "organizationadmin" && caller.organizationId === organizationId;
  if (caller.role !== "systemowner" && !isOrgAdmin) {
    throw new HttpsError("permission-denied", "Endast organisationsadmin kan se coachkoden.");
  }

  const authDoc = await privateAuthRef(organizationId).get();
  const stored = authDoc.exists ? authDoc.data().coachUnlockCode : undefined;
  return { code: (typeof stored === "string" && stored.length > 0) ? stored : null };
});

/**
 * migrateCoachUnlockCodes — in: { dryRun?: boolean }, ut: rapport
 *
 * Backfillar coachUnlockCode från passwords.coach för alla organisationer.
 * ENDAST systemägare. dryRun är PÅ om inget annat anges — skarp körning
 * kräver uttryckligen { dryRun: false }.
 *
 * Rapporten: { dryRun, total, migrated[], alreadyDone[], missing[] }
 * missing-listan ska vara TOM innan steg 3 (klientbytet) påbörjas.
 * Redan satta koder skrivs aldrig över.
 */
const migrateCoachUnlockCodes = onCall({
  timeoutSeconds: 300
}, async (request) => {
  const caller = await getCallerData(request.auth);
  if (caller.role !== "systemowner") {
    throw new HttpsError("permission-denied", "Endast systemägare kan köra migreringen.");
  }

  const dryRun = !(request.data && request.data.dryRun === false);

  const orgsSnap = await db.collection("organizations").get();
  const migrated = [];
  const alreadyDone = [];
  const missing = [];

  for (const orgDoc of orgsSnap.docs) {
    const authRef = orgDoc.ref.collection("private").doc("auth");
    const authDoc = await authRef.get();
    const existing = authDoc.exists ? authDoc.data().coachUnlockCode : undefined;

    if (typeof existing === "string" && existing.length > 0) {
      alreadyDone.push(orgDoc.id);
      continue;
    }

    const orgData = orgDoc.data();
    const source = orgData.passwords && orgData.passwords.coach;

    if (typeof source !== "string" || source.length === 0) {
      missing.push(orgDoc.id);
      continue;
    }

    if (!dryRun) {
      await authRef.set({
        coachUnlockCode: source,
        migratedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
    migrated.push(orgDoc.id);
  }

  console.log(
    `migrateCoachUnlockCodes (dryRun=${dryRun}): total=${orgsSnap.size} migrated=${migrated.length} alreadyDone=${alreadyDone.length} missing=${missing.length}`
  );

  return { dryRun, total: orgsSnap.size, migrated, alreadyDone, missing };
});

module.exports = {
  verifyCoachUnlockCode,
  setCoachUnlockCode,
  getCoachUnlockCode,
  migrateCoachUnlockCodes
};
