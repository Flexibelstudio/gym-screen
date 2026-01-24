const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();

// Sätt regionen till us-central1 (standard)
setGlobalOptions({ region: "us-central1" });

/**
 * Hjälpfunktion för att kolla admin-behörighet
 * Strategi: 1. Kolla Token. 2. Om det misslyckas, kolla Databasen.
 */
const verifyAdminPrivileges = async (auth) => {
  // 1. Grundkoll: Är man inloggad?
  if (!auth) {
    throw new HttpsError("unauthenticated", "Du måste vara inloggad.");
  }

  const uid = auth.uid;
  const tokenRole = auth.token.role || "";

  // 2. Snabbkoll: Har token redan rätt roll? (Systemägare eller OrgAdmin)
  if (tokenRole === "systemowner" || tokenRole === "organizationadmin") {
    return { 
      uid, 
      role: tokenRole, 
      organizationId: auth.token.organizationId 
    };
  }

  // 3. BACKUP (Detta är vad som räddar dig nu!): 
  // Om token saknar roll, hämta användaren direkt från Firestore.
  console.log(`Token saknar admin-roll för ${uid}, kollar databasen...`);
  
  const userDoc = await admin.firestore().collection("users").doc(uid).get();
  
  if (!userDoc.exists) {
    throw new HttpsError("permission-denied", "Användaren finns inte i databasen.");
  }

  const userData = userDoc.data();
  const dbRole = userData.role;

  // Kolla om rollen i databasen är godkänd
  if (dbRole === "systemowner" || dbRole === "organizationadmin") {
    console.log(`Godkänd via databasen: ${uid} är ${dbRole}`);
    return {
      uid,
      role: dbRole,
      organizationId: userData.organizationId
    };
  }

  // Om vi kommer hit är man varken admin i Token eller Databas
  throw new HttpsError("permission-denied", "Du saknar administratörsrättigheter.");
};

// --- FUNKTION: Uppdatera Roll ---
exports.flexUpdateUserRole = onCall(async (request) => {
  // 1. Verifiera att den som anropar är Admin (eller Systemägare)
  const caller = await verifyAdminPrivileges(request.auth);

  const { targetUid, newRole } = request.data;

  if (!targetUid || !newRole) {
    throw new HttpsError("invalid-argument", "Mål-UID och ny roll krävs.");
  }

  // 2. Hämta den användare vi ska ändra på
  const targetUserDoc = await admin.firestore().collection("users").doc(targetUid).get();
  if (!targetUserDoc.exists) {
    throw new HttpsError("not-found", "Användaren hittades inte.");
  }
  const targetUserData = targetUserDoc.data();

  // 3. Säkerhetsregler: Vem får ändra vem?
  if (caller.role === "organizationadmin") {
    // OrgAdmin får bara ändra folk i sin egen org
    if (targetUserData.organizationId !== caller.organizationId) {
      throw new HttpsError("permission-denied", "Du kan bara hantera din egen organisation.");
    }
    // OrgAdmin får inte skapa systemägare
    if (newRole === "systemowner") {
      throw new HttpsError("permission-denied", "Behörighet saknas för att skapa systemägare.");
    }
  }

  // 4. Uppdatera Auth (Custom Claims) - Detta fixar token för nästa gång
  const newClaims = {
    role: newRole,
    organizationId: targetUserData.organizationId
  };
  // Lägg till extra admin-flagga för admins
  if (newRole === "organizationadmin") {
    newClaims.adminRole = "admin";
  }

  await admin.auth().setCustomUserClaims(targetUid, newClaims);

  // 5. Uppdatera Databasen (Firestore)
  const firestoreUpdate = {
    role: newRole,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  if (newRole === "organizationadmin") {
    firestoreUpdate.adminRole = "admin";
  } else {
    firestoreUpdate.adminRole = admin.firestore.FieldValue.delete();
  }

  await admin.firestore().collection("users").doc(targetUid).update(firestoreUpdate);

  return { success: true, message: `Rollen uppdaterad till ${newRole}` };
});

// --- FUNKTION: Bjuda in användare ---
exports.flexInviteUser = onCall(async (request) => {
  const caller = await verifyAdminPrivileges(request.auth);

  const { email, role: inRole, organizationId, password } = request.data;
  
  // Säkerställ att OrgAdmin bara skapar i sin egen org
  if (caller.role === "organizationadmin") {
    if (organizationId !== caller.organizationId) {
      throw new HttpsError("permission-denied", "Du kan bara bjuda in till din egen organisation.");
    }
  }

  // Skapa användaren i Auth
  const userRecord = await admin.auth().createUser({
    email,
    password,
    emailVerified: false,
  });

  // Sätt claims direkt
  const finalRole = inRole === "admin" ? "organizationadmin" : "coach";
  const claims = { role: finalRole, organizationId };
  if (inRole === "admin") claims.adminRole = "admin";
  
  await admin.auth().setCustomUserClaims(userRecord.uid, claims);

  // Spara i Firestore
  const newUserDoc = {
    email,
    role: finalRole,
    organizationId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (inRole === "admin") newUserDoc.adminRole = "admin";

  await admin.firestore().collection("users").doc(userRecord.uid).set(newUserDoc);

  return { success: true, uid: userRecord.uid };
});