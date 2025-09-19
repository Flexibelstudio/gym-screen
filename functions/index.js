// functions/index.js (GEN-1)
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();

exports.inviteUser = functions
  .region("us-central1")
  .https.onCall(async (request) => {
    const { HttpsError } = functions.https;

    // 1) Auth
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Du måste vara inloggad.");
    }
    const caller = await admin.auth().getUser(request.auth.uid);
    const role = caller.customClaims?.role;
    if (role !== "systemowner" && role !== "organizationadmin") {
      throw new HttpsError("permission-denied", "Saknar behörighet.");
    }

    // 2) Indata
    const { email, role: inRole, organizationId, password } = request.data || {};
    if (!email || !inRole || !organizationId || !password) {
      throw new HttpsError("invalid-argument", "E-post, roll, org och lösenord krävs.");
    }
    if (typeof password !== "string" || password.length < 6) {
      throw new HttpsError("invalid-argument", "Lösenord minst 6 tecken.");
    }

    // 3) Skapa användare
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
      throw new HttpsError("internal", `Skapa användare misslyckades: ${err.message}`);
    }

    // 4) Claims
    try {
      const finalRole = inRole === "admin" ? "organizationadmin" : "coach";
      const claims = { role: finalRole, organizationId };
      if (inRole === "admin") claims.adminRole = "admin";
      await admin.auth().setCustomUserClaims(userRecord.uid, claims);
    } catch (err) {
      await admin.auth().deleteUser(userRecord.uid);
      throw new HttpsError("internal", `Sätta roller misslyckades: ${err.message}`);
    }

    // 5) Firestore
    try {
      const finalRole = inRole === "admin" ? "organizationadmin" : "coach";
      const doc = {
        email,
        role: finalRole,
        organizationId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(inRole === "admin" ? { adminRole: "admin" } : {}),
      };
      await admin.firestore().collection("users").doc(userRecord.uid).set(doc);
    } catch (err) {
      await admin.auth().deleteUser(userRecord.uid);
      throw new HttpsError("internal", `Spara användardata misslyckades: ${err.message}`);
    }

    return { success: true, message: `Användare ${email} har skapats.` };
  });
