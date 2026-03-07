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

    let userId = null;
    let userPhotoUrl = null;
    let userName = user.name || "Okänd Atlet";

    const userQuery = await db.collection("users").where("email", "==", user.email).limit(1).get();
    
    if (!userQuery.empty) {
      const userDoc = userQuery.docs[0];
      userId = userDoc.id;
      const userData = userDoc.data();
      userPhotoUrl = userData.photoUrl || null;
      userName = userData.firstName ? `${userData.firstName} ${userData.lastName || ''}` : userName;
    } else {
      const newUserRef = db.collection("users").doc();
      userId = newUserRef.id;
      await newUserRef.set({
        email: user.email,
        firstName: user.name.split(" ")[0] || "Extern",
        lastName: user.name.split(" ").slice(1).join(" ") || "Användare",
        organizationId: organizationId,
        role: "member",
        isExternal: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Created shadow user for ${user.email}`);
    }

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

    const newRecords = [];
    const pbCollectionRef = db.collection("users").doc(userId).collection("personalBests");
    const currentPBsSnap = await pbCollectionRef.get();
    const currentPBs = {};
    
    currentPBsSnap.forEach(doc => {
      const pb = doc.data();
      const key = pb.exerciseName.toLowerCase().trim();
      currentPBs[key] = pb.weight;
    });

    const batch = db.batch();

    if (workout.exercises && Array.isArray(workout.exercises)) {
      for (const exercise of workout.exercises) {
        if (exercise.weight && exercise.weight > 0 && exercise.name) {
          const normName = exercise.name.toLowerCase().trim();
          const currentMax = currentPBs[normName] || 0;

          if (exercise.weight > currentMax) {
            const diff = exercise.weight - currentMax;
            const pbId = normName.replace(/[^a-z0-9]/g, "_");
            const pbRef = pbCollectionRef.doc(pbId);

            batch.set(pbRef, {
              id: pbId,
              exerciseName: exercise.name,
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

    if (newRecords.length > 0) {
      const eventRef = db.collection("studio_events").doc();
      batch.set(eventRef, {
        id: eventRef.id,
        type: "pb",
        organizationId: organizationId,
        timestamp: Date.now(),
        data: {
          userName: userName,
          userPhotoUrl: userPhotoUrl,
          records: newRecords
        }
      });
      batch.update(logRef, { newPBs: newRecords });
    }

    await batch.commit();

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


// ============================================================================
// STRIPE API & EXPRESS SERVER
// ============================================================================

const express = require("express");
const Stripe = require("stripe");

const app = express();

// CORS Middleware
app.use((req, res, next) => {
  // UPPDATERAD: Tillåt din riktiga prod-domän
  const allowedOrigins = [
    'https://staging-smartskarm.netlify.app', 
    'https://smartskarm.netlify.app', // Om Netlify-domänen används direkt
    'https://smartskarm.se',           // DIN PROD-DOMÄN
    'http://localhost:5173'
  ];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

let stripeClient = null;
function getStripe() {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      console.error("STRIPE_SECRET_KEY saknas i miljön!");
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    stripeClient = new Stripe(key, { apiVersion: '2024-04-10' });
  }
  return stripeClient;
}

// 1. WEBHOOKS
app.post("/webhook", async (req, res) => {
  try {
    const stripe = getStripe();
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata.userId;
      
      if (userId) {
        console.log(`Uppdaterar användare ${userId} till aktiv!`);
        await admin.firestore().collection('users').doc(userId).update({
          subscriptionStatus: 'active',
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription
        });
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).send(`Server Error`);
  }
});

app.use(express.json());

// 3. CREATE CHECKOUT SESSION
app.post("/create-checkout-session", async (req, res) => {
  try {
    console.log("Tar emot checkout request...");
    const stripe = getStripe();
    const { userId, organizationId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId saknas" });
    }

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      throw new Error("STRIPE_PRICE_ID saknas i miljön");
    }

    // JUSTERAD: Din prod-domän som fallback
    const domain = req.headers.origin || 'https://smartskarm.se';

    console.log(`Skapar session för användare ${userId} med pris ${priceId}`);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      allow_promotion_codes: true,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${domain}/?success=true`,
      cancel_url: `${domain}/?canceled=true`,
      client_reference_id: userId,
      metadata: {
        userId: userId,
        organizationId: organizationId || 'unknown'
      }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Checkout session error:", error);
    res.status(500).json({ error: error.message });
  }
});

exports.api = onRequest(app);