const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
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
    throw new HttpsError("not-found", "Användaren finns inte.");
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

/**
 * --- API-BRYGGA: Ta emot pass från externa system ---
 * Denna funktion är en vanlig HTTP endpoint (Webhook).
 * Den tar emot JSON-data, loggar passet och kollar efter Personbästa (PB).
 */
exports.receiveExternalWorkout = onRequest(async (req, res) => {
  // 1. CORS Headers (Tillåt anrop från din andra app)
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const data = req.body;
    
    // 2. Validering (Enkel säkerhetskoll)
    // I en skarp version bör du byta ut "hemlig-nyckel" mot en env variabel eller hämta från databasen.
    const SECRET_KEY = "smart-skarm-bridge-secret"; 
    
    if (data.secretKey !== SECRET_KEY) {
      console.warn("Unauthorized attempt to log workout");
      res.status(403).send('Unauthorized');
      return;
    }

    if (!data.organizationId || !data.user || !data.workout) {
      res.status(400).send('Missing required fields (organizationId, user, workout)');
      return;
    }

    const db = admin.firestore();
    const { organizationId, user, workout } = data;

    // 3. Hitta eller skapa användare i Smart Skärm
    // Vi använder e-post för att matcha användare mellan systemen.
    let userId = null;
    let userPhotoUrl = null;
    let userName = user.name || "Okänd Atlet";

    const userQuery = await db.collection("users").where("email", "==", user.email).limit(1).get();
    
    if (!userQuery.empty) {
      const userDoc = userQuery.docs[0];
      userId = userDoc.id;
      const userData = userDoc.data();
      userPhotoUrl = userData.photoUrl || null;
      // Använd namnet från Smart Skärm om det finns, annars det inskickade
      userName = userData.firstName ? `${userData.firstName} ${userData.lastName || ''}` : userName;
    } else {
      // Användaren finns inte - skapa en "Shadow User" så vi kan spara PBn
      const newUserRef = db.collection("users").doc();
      userId = newUserRef.id;
      await newUserRef.set({
        email: user.email,
        firstName: user.name.split(" ")[0] || "Extern",
        lastName: user.name.split(" ").slice(1).join(" ") || "Användare",
        organizationId: organizationId,
        role: "member",
        isExternal: true, // Flagga för att visa att denna kommer utifrån
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Created shadow user for ${user.email}`);
    }

    // 4. Skapa loggen (Workout Log) -> Detta syns i Community Feed
    const logRef = db.collection("workoutLogs").doc();
    const logEntry = {
      id: logRef.id,
      memberId: userId,
      organizationId: organizationId,
      workoutId: workout.id || "external_id",
      workoutTitle: workout.title || "Externt Pass",
      date: workout.date || Date.now(),
      source: "external_api",
      memberName: userName,
      memberPhotoUrl: userPhotoUrl,
      // Spara hela rådatan ifall vi vill visa detaljer senare
      exerciseResults: workout.exercises.map(ex => ({
        exerciseName: ex.name,
        weight: ex.weight || null,
        reps: ex.reps || null,
        sets: ex.sets || 1
      })),
      comment: workout.comment || "Loggat från medlemsappen",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await logRef.set(logEntry);

    // 5. PB-Detektiven: Kolla efter nya rekord
    const newRecords = [];
    const pbCollectionRef = db.collection("users").doc(userId).collection("personalBests");
    const currentPBsSnap = await pbCollectionRef.get();
    const currentPBs = {};
    
    currentPBsSnap.forEach(doc => {
      const pb = doc.data();
      // Normalisera nyckeln (små bokstäver, trim) för enklare matchning
      const key = pb.exerciseName.toLowerCase().trim();
      currentPBs[key] = pb.weight;
    });

    const batch = db.batch();

    // Loopa genom inskickade övningar
    if (workout.exercises && Array.isArray(workout.exercises)) {
      for (const exercise of workout.exercises) {
        if (exercise.weight && exercise.weight > 0 && exercise.name) {
          const normName = exercise.name.toLowerCase().trim();
          const currentMax = currentPBs[normName] || 0;

          // Om vikten är högre än nuvarande max -> NYTT PB!
          if (exercise.weight > currentMax) {
            const diff = exercise.weight - currentMax;
            
            // Skapa ett "säkert" ID för dokumentet
            const pbId = normName.replace(/[^a-z0-9]/g, "_");
            const pbRef = pbCollectionRef.doc(pbId);

            batch.set(pbRef, {
              id: pbId,
              exerciseName: exercise.name, // Spara det "fina" namnet
              weight: exercise.weight,
              date: Date.now(),
              source: "external"
            });

            newRecords.push({
              exerciseName: exercise.name,
              weight: exercise.weight,
              diff: parseFloat(diff.toFixed(2))
            });
          }
        }
      }
    }

    // 6. Om vi hittade nya rekord -> Skapa Event för TV-skärmen
    if (newRecords.length > 0) {
      const eventRef = db.collection("studio_events").doc();
      batch.set(eventRef, {
        id: eventRef.id,
        type: "pb", // Detta triggar animationen i PBOverlay.tsx
        organizationId: organizationId,
        timestamp: Date.now(),
        data: {
          userName: userName,
          userPhotoUrl: userPhotoUrl,
          records: newRecords
        }
      });
      
      // Uppdatera även loggen med PB-info för historikens skull
      batch.update(logRef, { newPBs: newRecords });
    }

    // Kör alla DB-uppdateringar
    await batch.commit();

    // 7. Klart!
    res.json({ 
      success: true, 
      message: "Workout processed", 
      newRecordsCount: newRecords.length 
    });

  } catch (error) {
    console.error("Error processing external workout:", error);
    res.status(500).send("Internal Server Error");
  }
});