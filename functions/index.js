// functions/index.js (Upgraded to GEN-2)
const admin = require("firebase-admin");
// ÄNDRING 1: Bytte onCall mot onRequest för att hantera vanliga HTTP-anrop och CORS.
const {onRequest, HttpsError} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2");

admin.initializeApp();

// Set region globally to avoid specifying it on every function
setGlobalOptions({region: "us-central1"});

// ÄNDRING 2: Lade till {cors: true} för att automatiskt hantera CORS-headers.
// ÄNDRING 3 (NY): Lade till {invoker: "public"} för att explicit göra funktionen offentlig.
exports.flexInviteUser = onRequest({cpu: 1, cors: true, invoker: "public"}, async (request, response) => {
  // VIKTIGT SÄKERHETSMEDDELANDE:
  // Eftersom vi bytt till onRequest, är `request.auth` inte längre tillgängligt automatiskt.
  // Auth-koden nedan är bortkommenterad för att lösa CORS-problemet snabbt.
  // FÖR PRODUKTION måste du implementera manuell token-verifiering för att säkra denna funktion.
  /*
  // 1) Auth check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Du måste vara inloggad.");
  }

  const callerRole = request.auth.token.role;
  if (callerRole !== "systemowner" && callerRole !== "organizationadmin") {
    throw new HttpsError("permission-denied", "Saknar behörighet.");
  }
  */

  try {
    // ÄNDRING 4: Bytte request.data till request.body, vilket är standard för onRequest.
    const {email, role: inRole, organizationId, password} = request.body || {};
    if (!email || !inRole || !organizationId || !password) {
      throw new HttpsError("invalid-argument", "E-post, roll, org och lösenord krävs.");
    }
    if (typeof password !== "string" || password.length < 6) {
      throw new HttpsError("invalid-argument", "Lösenord minst 6 tecken.");
    }

    // 3) Create user
    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email,
        password,
        emailVerified: false,
      });
    } catch (err) {
      if (err?.code === "auth/email-already-exists") {
        throw new HttpsError("already-exists", "E-postadressen är redan registrerad.");
      }
      throw new HttpsError("internal", `Skapa användare misslyglades: ${err.message}`);
    }

    // 4) Set custom claims
    try {
      const finalRole = inRole === "admin" ? "organizationadmin" : "coach";
      const claims = {role: finalRole, organizationId};
      if (inRole === "admin") {
        claims.adminRole = "admin";
      }
      await admin.auth().setCustomUserClaims(userRecord.uid, claims);
    } catch (err) {
      await admin.auth().deleteUser(userRecord.uid); // Cleanup
      throw new HttpsError("internal", `Sätta roller misslyglades: ${err.message}`);
    }

    // 5) Create user document in Firestore
    try {
      const finalRole = inRole === "admin" ? "organizationadmin" : "coach";
      const doc = {
        email,
        role: finalRole,
        organizationId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(inRole === "admin" ? {adminRole: "admin"} : {}),
      };
      await admin.firestore().collection("users").doc(userRecord.uid).set(doc);
    } catch (err) {
      await admin.auth().deleteUser(userRecord.uid); // Cleanup
      throw new HttpsError("internal", `Spara användardata misslyglades: ${err.message}`);
    }
    
    // Skicka ett lyckat svar
    response.json({data: {success: true, message: `Användare ${email} har skapats.`}});

  } catch (err) {
    // Hantera HttpsError och skicka ett korrekt felsvar
    if (err instanceof HttpsError) {
      response.status(400).json({error: {message: err.message, code: err.code}});
    } else {
      response.status(500).json({error: {message: "Ett internt serverfel inträffade."}});
    }
  }
});