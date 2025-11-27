// functions/index.js (Upgraded to GEN-2)
const admin = require("firebase-admin");
const {onRequest, HttpsError} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2");

admin.initializeApp();

// Set region globally to avoid specifying it on every function
setGlobalOptions({region: "us-central1"});

/**
 * Verifies that the request is from an authenticated user with admin privileges.
 * Throws an HttpsError if authentication or authorization fails.
 * @param {object} request The Express request object.
 * @return {Promise<admin.auth.DecodedIdToken>} The decoded ID token of the authenticated admin.
 */
const verifyAdminRequest = async (request) => {
  const authorizationHeader = request.headers.authorization || "";
  if (!authorizationHeader.startsWith("Bearer ")) {
    throw new HttpsError("unauthenticated", "Unauthorized: No Bearer token provided.");
  }

  const idToken = authorizationHeader.split("Bearer ")[1];
  if (!idToken) {
    throw new HttpsError("unauthenticated", "Unauthorized: Token is empty.");
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Check for custom claims that grant admin access
    const userRole = decodedToken.role;
    if (userRole !== "systemowner" && userRole !== "organizationadmin") {
      throw new HttpsError("permission-denied", "Forbidden: User does not have admin privileges.");
    }

    return decodedToken; // Return the decoded token on success
  } catch (error) {
    // Catch both verifyIdToken errors and our own permission-denied error
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error("Token verification failed:", error);
    // Re-throw other errors as a generic unauthenticated error
    throw new HttpsError("unauthenticated", `Unauthorized: ${error.message}`);
  }
};


exports.flexInviteUser = onRequest({cpu: 1, cors: true, invoker: "public"}, async (request, response) => {
  try {
    // 1) Verify the caller is an authenticated admin.
    // This will throw an HttpsError if verification fails, which is caught below.
    await verifyAdminRequest(request);
    // ✅ Auth secured with verifyAdminRequest – only admins can create users

    // 2) Proceed with user creation logic now that the caller is verified.
    const {email, role: inRole, organizationId, password} = request.body || {};
    if (!email || !inRole || !organizationId || !password) {
      throw new HttpsError("invalid-argument", "E-post, roll, org och lösenord krävs.");
    }
    if (typeof password !== "string" || password.length < 6) {
      throw new HttpsError("invalid-argument", "Lösenord minst 6 tecken.");
    }

    // 3) Create user in Firebase Auth
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

    // 4) Set custom claims for role-based access control
    try {
      const finalRole = inRole === "admin" ? "organizationadmin" : "coach";
      const claims = {role: finalRole, organizationId};
      // Note: the `admin` role in the request body is translated to `organizationadmin` here.
      if (inRole === "admin") {
        claims.adminRole = "admin";
      }
      await admin.auth().setCustomUserClaims(userRecord.uid, claims);
    } catch (err) {
      await admin.auth().deleteUser(userRecord.uid); // Cleanup on failure
      throw new HttpsError("internal", `Sätta roller misslyglades: ${err.message}`);
    }

    // 5) Create a corresponding user document in Firestore
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
      await admin.auth().deleteUser(userRecord.uid); // Cleanup on failure
      throw new HttpsError("internal", `Spara användardata misslyglades: ${err.message}`);
    }

    // 6) Send a success response
    response.status(200).json({data: {success: true, message: `Användare ${email} har skapats.`}});

  } catch (err) {
    // Handle HttpsError and send the correct status code
    if (err instanceof HttpsError) {
      let statusCode = 500; // Default to internal server error
      if (err.code === "unauthenticated") {
        statusCode = 401;
      } else if (err.code === "permission-denied") {
        statusCode = 403;
      } else if (err.code === "invalid-argument" || err.code === "already-exists") {
        statusCode = 400;
      }
      response.status(statusCode).json({error: {message: err.message, code: err.code}});
    } else {
      // Handle unexpected errors
      console.error("An unexpected error occurred in flexInviteUser:", err);
      response.status(500).json({error: {message: "Ett internt serverfel inträffade."}});
    }
  }
});