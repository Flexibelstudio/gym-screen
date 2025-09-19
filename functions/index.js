// Gen 1 (inte v2)
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
admin.initializeApp();

exports.inviteUserCallable = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Du måste vara inloggad.");
    }

    const { email, password, role, organizationId } = data || {};
    if (!email || !password || !role || !organizationId) {
      throw new functions.https.HttpsError("invalid-argument", "Ogiltiga indata.");
    }
    if (typeof password !== "string" || password.length < 6) {
      throw new functions.https.HttpsError("invalid-argument", "Lösenordet måste vara minst 6 tecken.");
    }

    // Skapa användaren
    const user = await admin.auth().createUser({ email, password });

    // Sätt claims
    const finalRole = role === "admin" ? "organizationadmin" : "coach";
    const claims = { role: finalRole, organizationId };
    if (role === "admin") claims.adminRole = "admin";
    await admin.auth().setCustomUserClaims(user.uid, claims);

    // Spara Firestore-doc
    const db = admin.firestore();
    await db.collection("users").doc(user.uid).set({
      email,
      role: finalRole,
      organizationId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(role === "admin" ? { adminRole: "admin" } : {})
    }, { merge: true });

    return { success: true, message: "Användare skapad.", uid: user.uid };
  });
