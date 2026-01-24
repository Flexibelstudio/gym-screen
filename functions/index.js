
// functions/index.js (GEN-2 Callables)
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();

setGlobalOptions({region: "us-central1"});

/**
 * Hjälpfunktion för att kolla admin-behörighet i onCall.
 * I onCall finns auth-data direkt i request-objektet.
 */
const checkAdmin = (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Du måste vara inloggad.");
  }
  const role = request.auth.token.role;
  if (role !== "systemowner" && role !== "organizationadmin") {
    throw new HttpsError("permission-denied", "Du saknar administratörsrättigheter.");
  }
};

exports.flexUpdateUserRole = onCall(async (request) => {
  // 1. Säkerhetskoll
  checkAdmin(request);
  
  const {targetUid, newRole} = request.data;
  const callerRole = request.auth.token.role;
  const callerOrgId = request.auth.token.organizationId;

  if (!targetUid || !newRole) {
    throw new HttpsError("invalid-argument", "Mål-UID och ny roll krävs.");
  }

  // 2. Hämta målanvändaren
  const userDoc = await admin.firestore().collection("users").doc(targetUid).get();
  if (!userDoc.exists) {
    throw new HttpsError("not-found", "Användaren hittades inte.");
  }
  const userData = userDoc.data();

  // 3. Organisations-validering (Admin får bara ändra sina egna)
  if (callerRole === "organizationadmin") {
    if (userData.organizationId !== callerOrgId) {
      throw new HttpsError("permission-denied", "Du kan bara ändra användare i din egen organisation.");
    }
    if (newRole === "systemowner") {
      throw new HttpsError("permission-denied", "Du kan inte utse någon till systemägare.");
    }
  }

  // 4. Uppdatera Auth Custom Claims
  const newClaims = {
    role: newRole,
    organizationId: userData.organizationId
  };
  if (newRole === "organizationadmin") {
    newClaims.adminRole = "admin";
  }
  await admin.auth().setCustomUserClaims(targetUid, newClaims);

  // 5. Uppdatera Firestore
  const updateData = {
    role: newRole,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  if (newRole === "organizationadmin") {
    updateData.adminRole = "admin";
  } else {
    updateData.adminRole = admin.firestore.FieldValue.delete();
  }
  
  await admin.firestore().collection("users").doc(targetUid).update(updateData);

  return {success: true, message: `Rollen uppdaterad till ${newRole}`};
});

exports.flexInviteUser = onCall(async (request) => {
  checkAdmin(request);
  
  const {email, role: inRole, organizationId, password} = request.data;
  
  // Validering
  if (!email || !inRole || !organizationId || !password) {
    throw new HttpsError("invalid-argument", "Data saknas.");
  }

  // Skapa användare
  const userRecord = await admin.auth().createUser({
    email,
    password,
    emailVerified: false,
  });

  // Sätt claims
  const finalRole = inRole === "admin" ? "organizationadmin" : "coach";
  const claims = {role: finalRole, organizationId};
  if (inRole === "admin") claims.adminRole = "admin";
  await admin.auth().setCustomUserClaims(userRecord.uid, claims);

  // Spara i Firestore
  const doc = {
    email,
    role: finalRole,
    organizationId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(inRole === "admin" ? {adminRole: "admin"} : {}),
  };
  await admin.firestore().collection("users").doc(userRecord.uid).set(doc);

  return {success: true, uid: userRecord.uid};
});
