// functions/index.js
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

exports.inviteUser = onCall({region: "us-central1"}, async (request) => {
  // 1) Auth-koll
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Du måste vara inloggad för att kunna bjuda in användare.",
    );
  }

  const callingUser = await admin.auth().getUser(request.auth.uid);
  const userRole = callingUser.customClaims?.role;

  if (userRole !== "systemowner" && userRole !== "organizationadmin") {
    throw new HttpsError(
      "permission-denied",
      "Du har inte behörighet att bely in användare.",
    );
  }

  // 2) Validera indata
  const {email, role, organizationId} = request.data || {};
  if (!email || !role || !organizationId) {
    throw new HttpsError(
      "invalid-argument",
      "E-post, roll och organisation är obligatoriska.",
    );
  }

  try {
    // 3) Skapa användare
    const userRecord = await admin.auth().createUser({
      email,
      emailVerified: false,
    });

    // 4) Sätt claims
    const finalRole = role === "admin" ? "organizationadmin" : "coach";
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: finalRole,
      organizationId,
      adminRole: role === "admin" ? "admin" : undefined,
    });

    // 5) Firestore-dokument
    await admin.firestore().collection("users").doc(userRecord.uid).set({
      email,
      role: finalRole,
      organizationId,
      adminRole: role === "admin" ? "admin" : undefined,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 6) Länk för lösenord
    const link = await admin.auth().generatePasswordResetLink(
      email, /* {
        url: "https://din-app.web.app/welcome",
      } */
    );

    console.log(
      `Successfully invited ${email} as ${finalRole}. Password reset link: ${link}`,
    );

    return {
      success: true,
      message: `Inbjudan skapad för ${email}. Skicka lösenordslänken till användaren.`,
      link,
    };
  } catch (error) {
    console.error("Error inviting user:", error);
    if (error.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "E-postadressen är redan registrerad.");
    }
    throw new HttpsError("internal", "Ett okänt serverfel inträffade.");
  }
});
