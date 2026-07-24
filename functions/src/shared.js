const { HttpsError } = require("firebase-functions/v2/https");
const { admin } = require("./init");

// --- Helper: hämta inloggad användares data (kräver inloggning) ---
const getCallerData = async (auth) => {
  if (!auth) throw new HttpsError("unauthenticated", "Du måste vara inloggad.");
  const userDoc = await admin.firestore().collection("users").doc(auth.uid).get();
  if (!userDoc.exists) throw new HttpsError("permission-denied", "Användaren finns inte i databasen.");
  return { uid: auth.uid, ...userDoc.data() };
};

// --- Helper: är rollen personal? (systemägare / orgadmin / coach) ---
const isStaffRole = (role) =>
  role === "systemowner" || role === "organizationadmin" || role === "coach";

module.exports = { getCallerData, isStaffRole };
