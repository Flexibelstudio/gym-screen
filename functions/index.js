const functions = require("firebase-functions");
const {onCall} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

exports.inviteUser = onCall(async (request) => {
  // 1. Kontrollera att den som anropar är en autentiserad admin
  if (!request.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "Du måste vara inloggad för att kunna bjuda in användare.",
    );
  }

  const callingUser = await admin.auth().getUser(request.auth.uid);
  const userRole = callingUser.customClaims.role;

  if (userRole !== "systemowner" && userRole !== "organizationadmin") {
    throw new functions.https.HttpsError(
        "permission-denied",
        "Du har inte behörighet att bjuda in användare.",
    );
  }

  // 2. Validera indata
  const {email, role, organizationId} = request.data;
  if (!email || !role || !organizationId) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "E-post, roll och organisation är obligatoriska.",
    );
  }

  try {
    // 3. Skapa användarkontot
    const userRecord = await admin.auth().createUser({
      email: email,
      emailVerified: false, // De verifierar via lösenordsåterställning
    });

    // 4. Sätt anpassade roller (custom claims)
    const finalRole = role === "admin" ? "organizationadmin" : "coach";
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: finalRole,
      organizationId: organizationId,
      // eslint-disable-next-line max-len
      adminRole: role === "admin" ? "admin" : null, // Sätt 'admin' som standard, kan göras till 'superadmin' manuellt
    });

    // 5. Skapa användardokument i Firestore
    await admin.firestore().collection("users").doc(userRecord.uid).set({
      email: email,
      role: finalRole,
      organizationId: organizationId,
      adminRole: role === "admin" ? "admin" : null,
    });

    // 6. Skicka länk för att sätta lösenord
    const link = await admin.auth().generatePasswordResetLink(email);
    // (Valfritt men rekommenderat: Skicka länken i ett snyggt mail)

    // eslint-disable-next-line max-len
    console.log(`Successfully invited ${email} as ${role}. Password reset link: ${link}`);

    return {
      success: true,
      // eslint-disable-next-line max-len
      message: `Inbjudan har skickats till ${email}. Användaren kan sätta sitt lösenord via en länk som bör skickas manuellt.`,
    };
  } catch (error) {
    console.error("Error creating new user:", error);
    // Returnera ett mer användarvänligt felmeddelande
    if (error.code === "auth/email-already-exists") {
      throw new functions.https.HttpsError("already-exists",
          "E-postadressen är redan registrerad.");
    }
    throw new functions.https.HttpsError("internal",
        "Ett okänt serverfel inträffade.");
  }
});
