const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentUpdated, onDocumentDeleted, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();

// Sätt regionen till us-central1 (standard)
setGlobalOptions({ region: "us-central1" });

/**
 * Hjälpfunktion för att generera slumpmässig inbjudningskod (t.ex. SMG6WY)
 */
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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

  // 3. BACKUP: Om token saknar roll, hämta användaren direkt från Firestore.
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
exports.flexUpdateUserRole = onCall({
  secrets: ["STRIPE_SECRET_KEY", "STRIPE_COACH_FEE_PRICE_ID", "STRIPE_SCREEN_FEE_PRICE_ID"]
}, async (request) => {
  const caller = await verifyAdminPrivileges(request.auth);
  const { targetUid, newRole } = request.data;

  if (!targetUid || !newRole) {
    throw new HttpsError("invalid-argument", "Mål-UID och ny roll krävs.");
  }

  const targetUserDoc = await admin.firestore().collection("users").doc(targetUid).get();
  if (!targetUserDoc.exists) {
    throw new HttpsError("not-found", "Användaren finns inte.");
  }
  const targetUserData = targetUserDoc.data();

  if (caller.role === "organizationadmin") {
    if (targetUserData.organizationId !== caller.organizationId) {
      throw new HttpsError("permission-denied", "Du kan bara hantera din egen organisation.");
    }
    if (newRole === "systemowner") {
      throw new HttpsError("permission-denied", "Behörighet saknas för att skapa systemägare.");
    }
  }

  const newClaims = {
    role: newRole,
    organizationId: targetUserData.organizationId
  };
  if (newRole === "organizationadmin") {
    newClaims.adminRole = "admin";
  }

  await admin.auth().setCustomUserClaims(targetUid, newClaims);

  const firestoreUpdate = {
    role: newRole,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  if (newRole === "organizationadmin") {
    firestoreUpdate.adminRole = "admin";
  } else {
    firestoreUpdate.adminRole = admin.firestore.FieldValue.delete();
  }

  // TODO: STRIPE INTEGRATION
  // Om newRole === 'coach' och targetUserData.role === 'member':
  // 1. Avbryt användarens personliga Stripe-prenumeration (om de har en).
  // 2. Öka organisationens "coach-count" i Stripe (om de är över maxFreeCoaches).
  //
  // Om newRole === 'member' och targetUserData.role === 'coach':
  // 1. Minska organisationens "coach-count" i Stripe.
  // 2. Användaren tappar sin coach-status och kommer att mötas av betalväggen 
  //    nästa gång de loggar in, för att starta en egen prenumeration.

  await admin.firestore().collection("users").doc(targetUid).update(firestoreUpdate);
  
  return { success: true, message: `Rollen uppdaterad till ${newRole}` };
});

// --- FUNKTION: Godkänn Coach ---
exports.flexApproveCoach = onCall({
  secrets: ["STRIPE_SECRET_KEY", "STRIPE_COACH_FEE_PRICE_ID", "STRIPE_SCREEN_FEE_PRICE_ID"]
}, async (request) => {
  const caller = await verifyAdminPrivileges(request.auth);
  const { targetUid } = request.data;

  if (!targetUid) {
    throw new HttpsError("invalid-argument", "Mål-UID krävs.");
  }

  const targetUserDoc = await admin.firestore().collection("users").doc(targetUid).get();
  if (!targetUserDoc.exists) {
    throw new HttpsError("not-found", "Användaren finns inte.");
  }
  const targetUserData = targetUserDoc.data();

  if (caller.role === "organizationadmin") {
    if (targetUserData.organizationId !== caller.organizationId) {
      throw new HttpsError("permission-denied", "Du kan bara hantera din egen organisation.");
    }
  }

  await admin.firestore().collection("users").doc(targetUid).update({
    status: 'active',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true, message: "Coach godkänd." };
});

// --- FUNKTION: Bjuda in användare ---
exports.flexInviteUser = onCall({
  secrets: ["STRIPE_SECRET_KEY", "STRIPE_COACH_FEE_PRICE_ID", "STRIPE_SCREEN_FEE_PRICE_ID"]
}, async (request) => {
  const caller = await verifyAdminPrivileges(request.auth);
  const { email, role: inRole, organizationId, password } = request.data;
  
  if (caller.role === "organizationadmin") {
    if (organizationId !== caller.organizationId) {
      throw new HttpsError("permission-denied", "Du kan bara bjuda in till din egen organisation.");
    }
  }

  const userRecord = await admin.auth().createUser({
    email,
    password,
    emailVerified: false,
  });

  const finalRole = inRole === "admin" ? "organizationadmin" : "coach";
  const claims = { role: finalRole, organizationId };
  if (inRole === "admin") claims.adminRole = "admin";
  
  await admin.auth().setCustomUserClaims(userRecord.uid, claims);

  const newUserDoc = {
    email,
    role: finalRole,
    status: 'active',
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
      res.status(403).send('Unauthorized');
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
      currentPBs[pb.exerciseName.toLowerCase().trim()] = pb.weight;
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
        data: { userName, userPhotoUrl, records: newRecords }
      });
      batch.update(logRef, { newPBs: newRecords });
    }

    await batch.commit();
    res.json({ success: true, newRecordsCount: newRecords.length });

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

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://staging-smartstudio.netlify.app',
    'https://smartstudio.netlify.app',
    'https://smartstudio.se',
    'https://staging-smartskarm.netlify.app',
    'https://smartskarm.netlify.app',
    'https://smartskarm.se',
    'http://localhost:5173'
  ];
  if (allowedOrigins.includes(origin) || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    // Tillåt även andra domäner tillfälligt för att undvika CORS-problem
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(204).send('');
  next();
});

let stripeClient = null;
function getStripe() {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || key.trim() === "") throw new Error('STRIPE_SECRET_KEY is missing');
    stripeClient = new Stripe(key, { apiVersion: '2024-04-10', timeout: 20000 });
  }
  return stripeClient;
}

/**
 * --- FUNKTION: Uppdatera antalet coacher i Stripe ---
 */
async function updateStripeCoachCount(organizationId) {
  const db = admin.firestore();
  const orgDoc = await db.collection("organizations").doc(organizationId).get();
  if (!orgDoc.exists) return;

  const orgData = orgDoc.data();
  const maxFreeCoaches = orgData.maxFreeCoaches || 5;
  
  const stripeSubscriptionId = orgData.stripeSubscriptionId;

  if (!stripeSubscriptionId) return; // Kanske på faktura eller gratisperiod

  // Räkna aktiva coacher och admins
  const usersSnapshot = await db.collection("users")
    .where("organizationId", "==", organizationId)
    .where("role", "in", ["coach", "organizationadmin"])
    .get();

  let activeCount = 0;
  usersSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.role === 'coach' && data.status === 'active') {
      activeCount++;
    } else if (data.role === 'organizationadmin') {
      activeCount++;
    }
  });

  const extraCoaches = Math.max(0, activeCount - maxFreeCoaches);

  const stripe = getStripe();
  const coachFeePriceId = process.env.STRIPE_COACH_FEE_PRICE_ID;

  if (!coachFeePriceId) {
    console.error("STRIPE_COACH_FEE_PRICE_ID saknas i miljön.");
    return;
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const coachItem = subscription.items.data.find(item => item.price.id === coachFeePriceId);

    if (coachItem) {
      if (coachItem.quantity !== extraCoaches) {
        await stripe.subscriptionItems.update(coachItem.id, { quantity: extraCoaches });
        console.log(`Uppdaterade coach-antal till ${extraCoaches} för org ${organizationId}`);
      }
    } else {
      await stripe.subscriptionItems.create({
        subscription: stripeSubscriptionId,
        price: coachFeePriceId,
        quantity: extraCoaches
      });
      console.log(`Lade till coach-avgift (${extraCoaches} st) för org ${organizationId}`);
    }
  } catch (error) {
    console.error(`Kunde inte uppdatera Stripe-prenumeration för org ${organizationId}:`, error);
  }
}

/**
 * Uppdaterar antalet extra skärmar i Stripe för en organisation.
 * 1 skärm ingår, därefter kostar det extra.
 */
async function updateStripeScreenCount(organizationId) {
  const db = admin.firestore();
  
  // Hämta organisationen
  const orgDoc = await db.collection("organizations").doc(organizationId).get();
  if (!orgDoc.exists) return;
  const orgData = orgDoc.data();
  
  const stripeSubscriptionId = orgData.stripeSubscriptionId;

  if (!stripeSubscriptionId) return; // Kanske på faktura eller gratisperiod

  // Räkna aktiva skärmar (studios)
  const activeScreens = orgData.studios ? orgData.studios.length : 0;
  const extraScreens = Math.max(0, activeScreens - 1); // 1 skärm ingår

  const stripe = getStripe();
  const screenFeePriceId = process.env.STRIPE_SCREEN_FEE_PRICE_ID;

  if (!screenFeePriceId) {
    console.error("STRIPE_SCREEN_FEE_PRICE_ID saknas i miljön.");
    return;
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const screenItem = subscription.items.data.find(item => item.price.id === screenFeePriceId);

    if (screenItem) {
      if (screenItem.quantity !== extraScreens) {
        await stripe.subscriptionItems.update(screenItem.id, { quantity: extraScreens });
        console.log(`Uppdaterade skärm-antal till ${extraScreens} för org ${organizationId}`);
      }
    } else {
      await stripe.subscriptionItems.create({
        subscription: stripeSubscriptionId,
        price: screenFeePriceId,
        quantity: extraScreens
      });
      console.log(`Lade till skärm-avgift (${extraScreens} st) för org ${organizationId}`);
    }
  } catch (error) {
    console.error(`Kunde inte uppdatera Stripe-prenumeration (skärmar) för org ${organizationId}:`, error);
  }
}

// 1. WEBHOOKS (LÅST TILL EXAKT STRUKTUR)
app.post("/webhook", express.raw({type: 'application/json'}), async (req, res) => {
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

    if (event.type === 'account.updated') {
      const account = event.data.object;
      const accountId = account.id;
      const isComplete = account.details_submitted && account.charges_enabled;
      
      const db = admin.firestore();
      const orgQuery = await db.collection('organizations').where('stripeConnectAccountId', '==', accountId).limit(1).get();
      
      if (!orgQuery.empty) {
        const orgId = orgQuery.docs[0].id;
        await db.collection('organizations').doc(orgId).update({
          stripeConnectSetupComplete: isComplete
        });
        console.log(`Updated stripeConnectSetupComplete to ${isComplete} for org ${orgId} via webhook`);
      }
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata.userId;
      const paymentType = session.metadata.paymentType;
      const organizationId = session.metadata.organizationId;
      
      if (userId) {
        const db = admin.firestore();

        if (paymentType === 'member_subscription') {
          // Hantera medlemskap för slutkund (gymmedlem)
          await db.collection('users').doc(userId).update({
            stripeCustomerId: session.customer,
            role: 'member',
            organizationId: organizationId,
            stripeSubscriptionId: session.subscription,
            subscriptionStatus: 'active'
          });

          await admin.auth().setCustomUserClaims(userId, {
            role: 'member',
            organizationId: organizationId
          });

          console.log(`Användare ${userId} blev medlem i org ${organizationId}`);
        } else {
          // Hantera gymmets egen prenumeration
          const orgQuery = await db.collection('organizations').where('ownerUid', '==', userId).limit(1).get();

          if (!orgQuery.empty) {
            const orgDoc = orgQuery.docs[0];
            const orgId = orgDoc.id;
            const currentOrgData = orgDoc.data();

            // MATCHAR EXAKT DIN BEGÄRDA STRUKTUR (Rensar bort fält som createdAt, ownerUid etc)
            const exactStructure = {
              customPages: currentOrgData.customPages || [],
              globalConfig: {
                customCategories: (currentOrgData.globalConfig && currentOrgData.globalConfig.customCategories) || [
                  { id: "1", name: "Standard", prompt: "" }
                ]
              },
              id: orgId,
              inviteCode: currentOrgData.inviteCode || generateInviteCode(),
              name: currentOrgData.name || "Näst bästa gymmet",
              ownerUid: currentOrgData.ownerUid || userId,
              maxFreeCoaches: currentOrgData.maxFreeCoaches || 5,
              passwords: {
                coach: (currentOrgData.passwords && currentOrgData.passwords.coach) || "1234"
              },
              status: "active",
              studios: currentOrgData.studios || [],
              subdomain: currentOrgData.subdomain || "",
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription
            };

            if (paymentType === 'system_fee') {
              exactStructure.systemFeePaid = true;
              exactStructure.systemFeeDate = admin.firestore.FieldValue.serverTimestamp();
            }

            // Vi använder .set(exactStructure) för att tvinga dokumentet att BARA ha dessa fält + stripe fält
            await db.collection('organizations').doc(orgId).set(exactStructure, { merge: true });

            const userUpdateData = {
              role: 'organizationadmin',
              organizationId: orgId
            };

            if (paymentType !== 'system_fee') {
              userUpdateData.subscriptionStatus = 'active';
            }

            await db.collection('users').doc(userId).update(userUpdateData);

            await admin.auth().setCustomUserClaims(userId, {
              role: 'organizationadmin',
              organizationId: orgId,
              adminRole: 'admin'
            });

            console.log(`Org ${orgId} återställd till exakt mall och kopplad till ${userId}`);
            
            // Lägg till "Extra Coach" och "Extra Skärm"-produkterna i prenumerationen med kvantitet 0 direkt
            await updateStripeCoachCount(orgId);
            await updateStripeScreenCount(orgId);
          }
        }
      }
    }

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      const status = subscription.status; // 'active', 'past_due', 'canceled', etc.
      
      const db = admin.firestore();
      
      // Leta efter användare med detta stripeCustomerId
      const userQuery = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
      if (!userQuery.empty) {
        const userId = userQuery.docs[0].id;
        await db.collection('users').doc(userId).update({
          subscriptionStatus: status === 'active' || status === 'trialing' ? 'active' : 'inactive',
          stripeSubscriptionId: status === 'canceled' ? admin.firestore.FieldValue.delete() : subscription.id
        });
        console.log(`Uppdaterade prenumerationsstatus för användare ${userId} till ${status}`);
      }

      // Leta efter organisation med detta stripeCustomerId
      const orgQuery = await db.collection('organizations').where('stripeCustomerId', '==', customerId).limit(1).get();
      if (!orgQuery.empty) {
        const orgId = orgQuery.docs[0].id;
        const isPaid = status === 'active' || status === 'trialing';
        
        if (status === 'canceled') {
           await db.collection('organizations').doc(orgId).update({
             stripeSubscriptionId: admin.firestore.FieldValue.delete(),
             systemFeePaid: false
           });
           console.log(`Tog bort prenumerations-ID och satte systemFeePaid=false för org ${orgId} (avslutad)`);
        } else {
           await db.collection('organizations').doc(orgId).update({
             stripeSubscriptionId: subscription.id,
             systemFeePaid: isPaid
           });
           console.log(`Uppdaterade prenumerations-ID för org ${orgId}, systemFeePaid=${isPaid}`);
        }
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      const customerId = invoice.customer;
      
      const db = admin.firestore();
      
      // Stäng av användare direkt vid misslyckad betalning
      const userQuery = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
      if (!userQuery.empty) {
        const userId = userQuery.docs[0].id;
        await db.collection('users').doc(userId).update({
          subscriptionStatus: 'inactive'
        });
        console.log(`Betalning misslyckades. Satte prenumerationsstatus för användare ${userId} till inactive`);
      }

      // Stäng av organisation direkt vid misslyckad betalning
      const orgQuery = await db.collection('organizations').where('stripeCustomerId', '==', customerId).limit(1).get();
      if (!orgQuery.empty) {
        const orgId = orgQuery.docs[0].id;
        await db.collection('organizations').doc(orgId).update({
          systemFeePaid: false
        });
        console.log(`Betalning misslyckades. Satte systemFeePaid=false för org ${orgId}`);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).send(`Server Error`);
  }
});

app.use(express.json());

// 2. CREATE CHECKOUT SESSION
app.post("/create-checkout-session", async (req, res) => {
  try {
    const stripe = getStripe();
    const { userId, organizationId, paymentType, email } = req.body;
    if (!userId) return res.status(400).json({ error: "userId saknas" });

    const searchEmail = email || `test_${userId}@example.com`;
    let customerId;

    const existingCustomers = await stripe.customers.list({ email: searchEmail, limit: 1 });
    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: searchEmail,
        metadata: { userId }
      });
      customerId = customer.id;
    }

    let priceId = paymentType === 'system_fee' ? process.env.STRIPE_SYSTEM_FEE_PRICE_ID : process.env.STRIPE_PRICE_ID;
    const coachFeePriceId = process.env.STRIPE_COACH_FEE_PRICE_ID;
    const screenFeePriceId = process.env.STRIPE_SCREEN_FEE_PRICE_ID;
    const domain = req.headers.origin || 'https://smartstudio.se';

    // Beräkna Unix-timestamp för den 1:a i nästa månad (UTC)
    const now = new Date();
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
    const billingCycleAnchor = Math.floor(nextMonth.getTime() / 1000);

    const lineItems = [{ price: priceId, quantity: 1 }];
    
    // OBS: Vi lägger INTE till coach-avgiften (coachFeePriceId) med kvantitet 0 här.
    // Stripe tillåter inte kvantitet 0 för standardpriser vid skapande av Checkout Session.
    // Denna läggs till automatiskt av updateStripeCoachCount när kunden faktiskt lägger till extra coacher.
    
    // OBS: Vi lägger INTE till skärm-avgiften (screenFeePriceId) med kvantitet 0 här längre.
    // Stripe gillar inte alltid att man skickar in nya Price IDs med kvantitet 0 om de inte är 
    // exakt rätt konfigurerade. Istället läggs denna rad till automatiskt av updateStripeScreenCount
    // första gången kunden faktiskt lägger till en extra skärm.

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      customer_update: { address: 'auto' },
      line_items: lineItems,
      subscription_data: {
        billing_cycle_anchor: billingCycleAnchor
      },
      success_url: `${domain}/?success=true&type=${paymentType || 'sub'}`,
      cancel_url: `${domain}/?canceled=true`,
      client_reference_id: userId,
      metadata: { userId, organizationId: organizationId || 'unknown', paymentType: paymentType || 'subscription' }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. CREATE STRIPE CONNECT ACCOUNT (ONBOARDING)
app.post("/create-connect-account", async (req, res) => {
  try {
    const stripe = getStripe();
    const { organizationId, returnUrl } = req.body;
    if (!organizationId) return res.status(400).json({ error: "organizationId saknas" });

    const db = admin.firestore();
    const orgDoc = await db.collection("organizations").doc(organizationId).get();
    if (!orgDoc.exists) return res.status(404).json({ error: "Organisationen hittades inte" });
    
    const orgData = orgDoc.data();
    let accountId = orgData.stripeConnectAccountId;

    // Skapa ett nytt Express-konto om det inte finns
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'SE',
        email: orgData.companyDetails?.billingContact?.email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'company',
        company: {
          name: orgData.companyDetails?.legalName || orgData.name,
        }
      });
      accountId = account.id;
      await db.collection("organizations").doc(organizationId).update({
        stripeConnectAccountId: accountId
      });
    }

    const domain = returnUrl || req.headers.origin || 'https://smartstudio.se';

    // Skapa en onboarding-länk
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${domain}/?connect=refresh`,
      return_url: `${domain}/?connect=success`,
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url });
  } catch (error) {
    console.error("Error creating connect account:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3.5 CHECK STRIPE CONNECT STATUS
app.post("/check-connect-status", async (req, res) => {
  try {
    const stripe = getStripe();
    const { organizationId } = req.body;
    if (!organizationId) return res.status(400).json({ error: "organizationId saknas" });

    const db = admin.firestore();
    const orgDoc = await db.collection("organizations").doc(organizationId).get();
    if (!orgDoc.exists) return res.status(404).json({ error: "Organisationen hittades inte" });
    
    const orgData = orgDoc.data();
    const accountId = orgData.stripeConnectAccountId;

    if (!accountId) {
      return res.json({ isComplete: false });
    }

    const account = await stripe.accounts.retrieve(accountId);
    const isComplete = account.details_submitted && account.charges_enabled;

    // Spara status i databasen
    await db.collection("organizations").doc(organizationId).update({
      stripeConnectSetupComplete: isComplete
    });

    res.json({ isComplete, account });
  } catch (error) {
    console.error("Error checking connect status:", error);
    res.status(500).json({ error: error.message });
  }
});

// 4. CREATE MEMBER CHECKOUT SESSION (39 SEK/mån, 19 SEK till plattformen)
app.post("/create-member-checkout", async (req, res) => {
  try {
    const stripe = getStripe();
    const { userId, organizationId, email } = req.body;
    if (!userId || !organizationId) return res.status(400).json({ error: "userId eller organizationId saknas" });

    const db = admin.firestore();
    const orgDoc = await db.collection("organizations").doc(organizationId).get();
    if (!orgDoc.exists) return res.status(404).json({ error: "Organisationen hittades inte" });
    
    const orgData = orgDoc.data();
    const connectedAccountId = orgData.stripeConnectAccountId;

    if (!connectedAccountId) {
      return res.status(400).json({ error: "Gymmet har inte kopplat ett Stripe-konto ännu." });
    }

    // Kontrollera om kontot är redo att ta emot betalningar
    const account = await stripe.accounts.retrieve(connectedAccountId);
    if (!account.charges_enabled) {
      return res.status(400).json({ error: "Gymmets Stripe-konto är inte fullständigt aktiverat ännu." });
    }

    const searchEmail = email || `member_${userId}@example.com`;
    let customerId;

    const existingCustomers = await stripe.customers.list({ email: searchEmail, limit: 1 });
    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: searchEmail,
        metadata: { userId, organizationId }
      });
      customerId = customer.id;
    }

    const domain = req.headers.origin || 'https://smartstudio.se';

    // 19 kr av 39 kr = 48.7179%
    const applicationFeePercent = 48.7179;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      automatic_tax: { enabled: true },
      customer_update: { address: 'auto' },
      line_items: [{
        price_data: {
          currency: 'sek',
          product_data: {
            name: 'SmartStudio Medlemskap',
            description: `Medlemskap hos ${orgData.name || 'Gymmet'}`,
          },
          unit_amount: 3900, // 39.00 SEK
          recurring: {
            interval: 'month',
          },
        },
        quantity: 1,
      }],
      subscription_data: {
        transfer_data: {
          destination: connectedAccountId,
        },
        application_fee_percent: applicationFeePercent,
      },
      success_url: `${domain}/?success=true&type=member`,
      cancel_url: `${domain}/?canceled=true`,
      client_reference_id: userId,
      metadata: { userId, organizationId, paymentType: 'member_subscription' }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Error creating member checkout:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/create-portal-session', async (req, res) => {
  try {
    const { customerId, configurationId, isOrganization } = req.body;
    if (!customerId) {
      return res.status(400).json({ error: "Missing customerId" });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const domain = req.headers.origin || 'https://ais-dev-mioe74iqdi7yxzjsz433lx-46889914413.europe-west2.run.app';

    const sessionParams = {
      customer: customerId,
      return_url: domain,
    };

    if (configurationId) {
      sessionParams.configuration = configurationId;
    } else if (isOrganization && process.env.STRIPE_RESTRICTED_PORTAL_CONFIG_ID) {
      sessionParams.configuration = process.env.STRIPE_RESTRICTED_PORTAL_CONFIG_ID;
    }

    const session = await stripe.billingPortal.sessions.create(sessionParams);

    res.json({ url: session.url });
  } catch (error) {
    console.error("Error creating portal session:", error);
    res.status(500).json({ error: error.message });
  }
});

exports.api = onRequest({
  secrets: ["STRIPE_SECRET_KEY", "STRIPE_SYSTEM_FEE_PRICE_ID", "STRIPE_PRICE_ID", "STRIPE_WEBHOOK_SECRET", "STRIPE_COACH_FEE_PRICE_ID", "STRIPE_SCREEN_FEE_PRICE_ID", "STRIPE_RESTRICTED_PORTAL_CONFIG_ID"]
}, app);

// ============================================================================
// PUSH NOTIFICATIONS
// ============================================================================

async function notifyOrganizationMembers(orgId, title, body) {
  const db = admin.firestore();
  
  try {
    const membersSnap = await db.collection('users')
      .where('organizationId', '==', orgId)
      .where('pushNotificationsEnabled', '==', true)
      .get();

    const tokens = [];
    membersSnap.forEach(doc => {
      const data = doc.data();
      if (data.fcmToken) {
        tokens.push(data.fcmToken);
      }
    });

    // Ta bort eventuella dubbletter (t.ex. om flera användare loggat in på samma enhet)
    const uniqueTokens = [...new Set(tokens)];

    if (uniqueTokens.length === 0) {
      console.log(`Inga användare med aktiverade push-notiser hittades i org ${orgId}.`);
      return;
    }

    const message = {
      notification: { title, body },
      webpush: {
        notification: {
          icon: '/favicon.png'
        }
      },
      tokens: uniqueTokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`${response.successCount} push-notiser skickades framgångsrikt till org ${orgId}.`);
    if (response.failureCount > 0) {
      console.error(`${response.failureCount} push-notiser misslyckades för org ${orgId}.`);
    }
  } catch (error) {
    console.error('Fel vid skickande av push-notis till org-medlemmar:', error);
  }
}

/**
 * Hjälpfunktion för att skicka push-notiser till alla systemägare som har aktiverat det.
 */
async function notifySystemOwners(title, body) {
  const db = admin.firestore();
  
  try {
    const ownersSnap = await db.collection('users')
      .where('role', '==', 'systemowner')
      .where('pushNotificationsEnabled', '==', true)
      .get();

    const tokens = [];
    ownersSnap.forEach(doc => {
      const data = doc.data();
      if (data.fcmToken) {
        tokens.push(data.fcmToken);
      }
    });

    // Ta bort eventuella dubbletter
    const uniqueTokens = [...new Set(tokens)];

    if (uniqueTokens.length === 0) {
      console.log('Inga systemägare med aktiverade push-notiser hittades.');
      return;
    }

    const message = {
      notification: { title, body },
      webpush: {
        notification: {
          icon: '/favicon.png'
        }
      },
      tokens: uniqueTokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`${response.successCount} push-notiser skickades framgångsrikt.`);
    if (response.failureCount > 0) {
      console.error(`${response.failureCount} push-notiser misslyckades.`);
    }
  } catch (error) {
    console.error('Fel vid skickande av push-notis:', error);
  }
}

/**
 * --- TRIGGER: Ny organisation skapad ---
 */
exports.onOrganizationCreated = onDocumentCreated({
  document: "organizations/{orgId}",
  secrets: ["STRIPE_SECRET_KEY", "STRIPE_COACH_FEE_PRICE_ID", "STRIPE_SCREEN_FEE_PRICE_ID"]
}, async (event) => {
  const newOrg = event.data.data();
  if (newOrg) {
    await notifySystemOwners(
      'Ny organisation!',
      `Organisationen "${newOrg.name || 'Okänd'}" har precis skapats.`
    );
  }
});

/**
 * --- TRIGGER: Uppdatera Stripe om en coach skapas ---
 */
exports.onUserCreated = onDocumentCreated({
  document: "users/{userId}",
  secrets: ["STRIPE_SECRET_KEY", "STRIPE_COACH_FEE_PRICE_ID", "STRIPE_SCREEN_FEE_PRICE_ID"]
}, async (event) => {
  const newUser = event.data.data();
  
  // 1. Push-notis om det är en ny coach
  if (newUser.role === 'coach') {
    let orgName = 'Okänd organisation';
    if (newUser.organizationId) {
      const orgDoc = await admin.firestore().collection('organizations').doc(newUser.organizationId).get();
      if (orgDoc.exists) {
        orgName = orgDoc.data().name || orgName;
      }
    }
    const coachName = newUser.firstName ? `${newUser.firstName} ${newUser.lastName || ''}`.trim() : 'En ny coach';
    await notifySystemOwners(
      'Ny coach registrerad!',
      `${coachName} har registrerat sig hos ${orgName}.`
    );
  }

  // 2. Stripe-uppdatering
  const isCountable = (newUser.role === 'coach' && newUser.status === 'active') || newUser.role === 'organizationadmin';
  if (isCountable && newUser.organizationId) {
    console.log(`Ny användare (coach/admin) ${event.params.userId} skapades i org ${newUser.organizationId}. Uppdaterar Stripe...`);
    await updateStripeCoachCount(newUser.organizationId);
  }
});
exports.onUserUpdated = onDocumentUpdated({
  document: "users/{userId}",
  secrets: ["STRIPE_SECRET_KEY", "STRIPE_COACH_FEE_PRICE_ID", "STRIPE_SCREEN_FEE_PRICE_ID"]
}, async (event) => {
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();

  // Push-notis om en användare blir coach (t.ex. godkänd eller roll uppdaterad)
  if (beforeData.role !== 'coach' && afterData.role === 'coach') {
    let orgName = 'Okänd organisation';
    if (afterData.organizationId) {
      const orgDoc = await admin.firestore().collection('organizations').doc(afterData.organizationId).get();
      if (orgDoc.exists) {
        orgName = orgDoc.data().name || orgName;
      }
    }
    const coachName = afterData.firstName ? `${afterData.firstName} ${afterData.lastName || ''}`.trim() : 'En ny coach';
    await notifySystemOwners(
      'Ny coach registrerad!',
      `${coachName} har registrerat sig hos ${orgName}.`
    );
  }

  const wasCountable = (beforeData.role === 'coach' && beforeData.status === 'active') || beforeData.role === 'organizationadmin';
  const isCountable = (afterData.role === 'coach' && afterData.status === 'active') || afterData.role === 'organizationadmin';

  if (wasCountable !== isCountable) {
    const orgId = afterData.organizationId || beforeData.organizationId;
    if (orgId) {
      console.log(`Status/roll ändrades för ${event.params.userId} i org ${orgId}. Uppdaterar Stripe...`);
      await updateStripeCoachCount(orgId);
    }
  }
});
exports.onUserDeleted = onDocumentDeleted({
  document: "users/{userId}",
  secrets: ["STRIPE_SECRET_KEY", "STRIPE_COACH_FEE_PRICE_ID", "STRIPE_SCREEN_FEE_PRICE_ID"]
}, async (event) => {
  const deletedUser = event.data.data();
  const wasCountable = (deletedUser.role === 'coach' && deletedUser.status === 'active') || deletedUser.role === 'organizationadmin';
  if (wasCountable && deletedUser.organizationId) {
    console.log(`Användare (coach/admin) ${event.params.userId} togs bort från org ${deletedUser.organizationId}. Uppdaterar Stripe...`);
    await updateStripeCoachCount(deletedUser.organizationId);
  }
});
exports.onOrganizationUpdated = onDocumentUpdated({
  document: "organizations/{orgId}",
  secrets: ["STRIPE_SECRET_KEY", "STRIPE_COACH_FEE_PRICE_ID", "STRIPE_SCREEN_FEE_PRICE_ID"]
}, async (event) => {
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();

  // Kolla om maxFreeCoaches har ändrats
  const beforeMax = beforeData.maxFreeCoaches || 5;
  const afterMax = afterData.maxFreeCoaches || 5;

  if (beforeMax !== afterMax) {
    console.log(`maxFreeCoaches ändrades från ${beforeMax} till ${afterMax} för org ${event.params.orgId}. Uppdaterar Stripe...`);
    await updateStripeCoachCount(event.params.orgId);
  }

  // Kolla om antalet studios (skärmar) har ändrats
  const beforeStudiosCount = beforeData.studios ? beforeData.studios.length : 0;
  const afterStudiosCount = afterData.studios ? afterData.studios.length : 0;

  if (beforeStudiosCount !== afterStudiosCount) {
    console.log(`Antal skärmar ändrades från ${beforeStudiosCount} till ${afterStudiosCount} för org ${event.params.orgId}. Uppdaterar Stripe...`);
    await updateStripeScreenCount(event.params.orgId);
    
    // Push-notis om en ny skärm lades till
    if (afterStudiosCount > beforeStudiosCount) {
      await notifySystemOwners(
        'Ny skärm tillagd!',
        `En ny skärm har lagts till i organisationen "${afterData.name || 'Okänd'}".`
      );
    }
  }
});
exports.flexUpdateOrganization = onCall({
  secrets: ["STRIPE_SECRET_KEY", "STRIPE_COACH_FEE_PRICE_ID", "STRIPE_SCREEN_FEE_PRICE_ID"]
}, async (request) => {
  const caller = await verifyAdminPrivileges(request.auth);
  const { organizationId, updateData } = request.data;

  if (!organizationId || !updateData) {
    throw new HttpsError("invalid-argument", "organizationId och updateData krävs.");
  }
  if (caller.role === "organizationadmin" && caller.organizationId !== organizationId) {
    throw new HttpsError("permission-denied", "Du kan bara uppdatera din egen organisation.");
  }

  try {
    const db = admin.firestore();
    await db.collection("organizations").doc(organizationId).update({
      ...updateData,
      lastUpdatedBy: caller.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    throw new HttpsError("internal", "Ett fel uppstod vid uppdatering.");
  }
});

/**
 * --- TRIGGER: Nytt pass publicerat ---
 */
exports.onWorkoutCreated = onDocumentCreated({
  document: "workouts/{workoutId}"
}, async (event) => {
  const newWorkout = event.data.data();
  
  // Om passet skapas och direkt är publicerat och inte ett utkast
  if (newWorkout && newWorkout.isPublished && !newWorkout.isMemberDraft && newWorkout.organizationId) {
    await notifyOrganizationMembers(
      newWorkout.organizationId,
      'Nytt pass tillgängligt! 🏋️‍♀️',
      `Passet "${newWorkout.title || 'Nytt pass'}" har precis publicerats.`
    );
  }
});

exports.onWorkoutUpdated = onDocumentUpdated({
  document: "workouts/{workoutId}"
}, async (event) => {
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();

  // Om passet ändras från opublicerat till publicerat
  const wasPublished = beforeData.isPublished === true;
  const isPublished = afterData.isPublished === true;

  if (!wasPublished && isPublished && !afterData.isMemberDraft && afterData.organizationId) {
    await notifyOrganizationMembers(
      afterData.organizationId,
      'Nytt pass tillgängligt! 🏋️‍♀️',
      `Passet "${afterData.title || 'Nytt pass'}" har precis publicerats.`
    );
  }
});
