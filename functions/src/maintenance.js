const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin } = require("./init");
const { getCallerData } = require("./shared");

/**
 * Helper to compute PB ID (matches services/firebase/init.ts: getPBId)
 */
const getPBId = (name) => {
  if (!name) return "";
  return name.toLowerCase().trim().replace(/[^\w]/g, "_");
};

/**
 * Helper to compute PB score (matches services/firebase/logs.ts: saveWorkoutLog)
 * score = calculated1RM > 0 ? calculated1RM * 10000 : (weight > 0 ? weight * 100 + reps : reps)
 */
const calculatePBScore = (doc) => {
  const c1rm = parseFloat(doc.calculated1RM) || 0;
  const w = parseFloat(doc.weight) || 0;
  const r = parseFloat(doc.reps) || 0;
  if (c1rm > 0) return c1rm * 10000;
  if (w > 0) return w * 100 + r;
  return r;
};

/**
 * En PB-post är användbar om den har antingen ett beräknat 1RM eller minst en
 * repetition. Poster med reps 0 och 1RM 0 saknar jämförbar prestandadata — de kan
 * inte rankas mot andra och får därför aldrig utses till vinnare.
 */
const isUsablePB = (doc) => {
  const c1rm = parseFloat(doc.calculated1RM) || 0;
  const r = parseFloat(doc.reps) || 0;
  return c1rm > 0 || r > 0;
};

/**
 * mergeDuplicateExerciseNames
 * Engångsfunktion för att slå ihop dubbletter av övningsnamn i medlemmars personbästa och historik.
 */
const mergeDuplicateExerciseNames = onCall(
  { timeoutSeconds: 540 },
  async (request) => {
    // 1. Systemägarkontroll
    const caller = await getCallerData(request.auth);
    if (caller.role !== "systemowner") {
      throw new HttpsError(
        "permission-denied",
        "Endast systemägare har behörighet att köra denna funktion."
      );
    }

    const db = admin.firestore();
    const {
      orgId,
      aliasGroups = [],
      dryRun = true,
      migrateLogs = false
    } = request.data || {};

    if (!orgId) {
      throw new HttpsError("invalid-argument", "orgId krävs.");
    }

    if (!Array.isArray(aliasGroups)) {
      throw new HttpsError("invalid-argument", "aliasGroups måste vara en array.");
    }

    // Statistiksamlare
    let membersExamined = 0;
    let pbDocsExamined = 0;
    let pbDocsToWrite = 0;
    let pbDocsToDelete = 0;
    let logsExamined = 0;
    let logsToRewrite = 0;
    let exerciseResultEntriesToRewrite = 0;

    const groupsAffectedMap = {}; // canonical -> { canonical, memberCount, docCount, examples: [] }
    const groupsSkipped = []; // grupper där ingen post hade jämförbar data

    // Samling av batch-operationer om dryRun === false
    const batchOps = [];

    // 2. Hämta medlemmar i organisationen sidvis (paginerat)
    let lastUserDoc = null;
    let hasMoreUsers = true;

    while (hasMoreUsers) {
      let uQuery = db
        .collection("users")
        .where("organizationId", "==", orgId)
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(500);

      if (lastUserDoc) {
        uQuery = uQuery.startAfter(lastUserDoc);
      }

      const usersSnap = await uQuery.get();
      if (usersSnap.empty) {
        hasMoreUsers = false;
        break;
      }

      membersExamined += usersSnap.size;
      lastUserDoc = usersSnap.docs[usersSnap.docs.length - 1];

      // Bearbeta medlemmarnas personalBests
      for (const memberDoc of usersSnap.docs) {
        const memberData = memberDoc.data() || {};
        const memberName =
          `${memberData.firstName || ""} ${memberData.lastName || ""}`.trim() || memberDoc.id;

        const pbsSnap = await memberDoc.ref.collection("personalBests").get();
        pbDocsExamined += pbsSnap.size;

        const pbDocs = pbsSnap.docs.map((d) => ({
          id: d.id,
          ref: d.ref,
          ...d.data()
        }));

        for (const group of aliasGroups) {
          if (!group.canonical || !Array.isArray(group.variants)) continue;

          const canonicalName = group.canonical.trim();
          const variantsSet = new Set(
            group.variants.map((v) => String(v).toLowerCase().trim())
          );

          // Hitta PB-dokument i medlemmens samling där exerciseName matchar någon av varianterna
          const matchingDocs = pbDocs.filter(
            (d) => d.exerciseName && variantsSet.has(String(d.exerciseName).toLowerCase().trim())
          );

          if (matchingDocs.length < 2) {
            // 0 eller 1 hittad → ingen åtgärd
            continue;
          }

          // Sortera för att utse vinnare. Poster utan jämförbar data rankas alltid sist,
          // oavsett poäng, så att de aldrig kan slå ett äkta resultat.
          matchingDocs.sort((a, b) => {
            const usableA = isUsablePB(a);
            const usableB = isUsablePB(b);
            if (usableA !== usableB) return usableA ? -1 : 1;

            const scoreA = calculatePBScore(a);
            const scoreB = calculatePBScore(b);
            if (scoreB !== scoreA) return scoreB - scoreA;
            const targetId = getPBId(canonicalName);
            if (a.id === targetId) return -1;
            if (b.id === targetId) return 1;
            return (b.date || 0) - (a.date || 0);
          });

          // Har ingen post i gruppen jämförbar data går det inte att avgöra vilken som
          // ska överleva. Rör då ingenting och rapportera gruppen i stället.
          if (!isUsablePB(matchingDocs[0])) {
            if (groupsSkipped.length < 100) {
              groupsSkipped.push({
                memberName,
                canonical: canonicalName,
                names: matchingDocs.map((d) => d.exerciseName),
                docs: matchingDocs.map((d) => ({
                  name: d.exerciseName,
                  weight: parseFloat(d.weight) || 0,
                  reps: parseFloat(d.reps) || 0,
                  calculated1RM: parseFloat(d.calculated1RM) || 0
                }))
              });
            }
            continue;
          }

          const winner = matchingDocs[0];
          const targetDocId = getPBId(canonicalName);

          // Bevara ALLA fält från vinnaren, ändra bara id och exerciseName till det kanoniska, utan hittepå-datum
          const { id: winnerId, ref: winnerRef, ...winnerFields } = winner;
          const targetPayload = {
            ...winnerFields,
            id: targetDocId,
            exerciseName: canonicalName
          };

          // Identifiera dokument som ska raderas (alla källdokument utom måldokumentet om dess id är identiskt)
          const docsToDelete = matchingDocs.filter((d) => d.id !== targetDocId);

          // Skapa / uppdatera gruppstatistik i rapporten
          if (!groupsAffectedMap[canonicalName]) {
            groupsAffectedMap[canonicalName] = {
              canonical: canonicalName,
              memberCount: 0,
              docCount: 0,
              examples: []
            };
          }

          const grp = groupsAffectedMap[canonicalName];
          grp.memberCount++;
          grp.docCount += matchingDocs.length;

          if (grp.examples.length < 3) {
            grp.examples.push({
              memberName,
              names: matchingDocs.map((d) => d.exerciseName),
              winner: {
                name: winner.exerciseName,
                weight: parseFloat(winner.weight) || 0,
                reps: parseFloat(winner.reps) || 0,
                calculated1RM: parseFloat(winner.calculated1RM) || 0
              }
            });
          }

          pbDocsToWrite++;
          pbDocsToDelete += docsToDelete.length;

          // Om inte dryRun, schemalägg batch-skrivningar
          if (!dryRun) {
            const targetRef = memberDoc.ref.collection("personalBests").doc(targetDocId);
            batchOps.push({ type: "set", ref: targetRef, data: targetPayload, options: { merge: true } });
            docsToDelete.forEach((d) => {
              batchOps.push({ type: "delete", ref: d.ref });
            });
          }
        }
      }

      if (usersSnap.size < 500) {
        hasMoreUsers = false;
      }
    }

    // 3. Om migrateLogs === true: skriv om historiska workoutLogs sidvis (paginerat)
    if (migrateLogs) {
      const variantToCanonical = {};
      for (const group of aliasGroups) {
        if (!group.canonical || !Array.isArray(group.variants)) continue;
        const canonicalName = group.canonical.trim();
        for (const v of group.variants) {
          variantToCanonical[String(v).toLowerCase().trim()] = canonicalName;
        }
      }

      let lastLogDoc = null;
      let hasMoreLogs = true;

      while (hasMoreLogs) {
        let lQuery = db
          .collection("workoutLogs")
          .where("organizationId", "==", orgId)
          .orderBy(admin.firestore.FieldPath.documentId())
          .limit(500);

        if (lastLogDoc) {
          lQuery = lQuery.startAfter(lastLogDoc);
        }

        const logsSnap = await lQuery.get();
        if (logsSnap.empty) {
          hasMoreLogs = false;
          break;
        }

        logsExamined += logsSnap.size;
        lastLogDoc = logsSnap.docs[logsSnap.docs.length - 1];

        for (const logDoc of logsSnap.docs) {
          const logData = logDoc.data() || {};
          if (Array.isArray(logData.exerciseResults) && logData.exerciseResults.length > 0) {
            let logModified = false;
            const updatedExerciseResults = logData.exerciseResults.map((ex) => {
              if (!ex || !ex.exerciseName) return ex;
              const cleaned = String(ex.exerciseName).toLowerCase().trim();
              const targetCanonical = variantToCanonical[cleaned];

              if (targetCanonical && ex.exerciseName !== targetCanonical) {
                logModified = true;
                exerciseResultEntriesToRewrite++;
                return { ...ex, exerciseName: targetCanonical };
              }
              return ex;
            });

            if (logModified) {
              logsToRewrite++;
              if (!dryRun) {
                batchOps.push({
                  type: "update",
                  ref: logDoc.ref,
                  data: { exerciseResults: updatedExerciseResults }
                });
              }
            }
          }
        }

        if (logsSnap.size < 500) {
          hasMoreLogs = false;
        }
      }
    }

    // 4. Utför batchskrivningar endast om dryRun är false
    if (!dryRun && batchOps.length > 0) {
      let batch = db.batch();
      let count = 0;
      for (const op of batchOps) {
        if (op.type === "set") {
          batch.set(op.ref, op.data, op.options || {});
        } else if (op.type === "update") {
          batch.update(op.ref, op.data);
        } else if (op.type === "delete") {
          batch.delete(op.ref);
        }
        count++;
        if (count >= 400) {
          await batch.commit();
          batch = db.batch();
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
      }
    }

    const groupsAffected = Object.values(groupsAffectedMap);
    const estimatedWrites = pbDocsToWrite + pbDocsToDelete + logsToRewrite;

    return {
      membersExamined,
      pbDocsExamined,
      groupsAffected,
      groupsSkipped,
      pbDocsToWrite,
      pbDocsToDelete,
      logsExamined,
      logsToRewrite,
      exerciseResultEntriesToRewrite,
      estimatedWrites
    };
  }
);

/**
 * backfillWorkoutFlags
 * Kompletterar saknade fält (isMemberDraft och publishAt) på pass i en organisation.
 */
const backfillWorkoutFlags = onCall(
  { timeoutSeconds: 540 },
  async (request) => {
    // 1. Systemägarkontroll
    const caller = await getCallerData(request.auth);
    if (caller.role !== "systemowner") {
      throw new HttpsError(
        "permission-denied",
        "Endast systemägare har behörighet att köra denna funktion."
      );
    }

    const db = admin.firestore();
    const { orgId, dryRun = true } = request.data || {};

    if (!orgId) {
      throw new HttpsError("invalid-argument", "orgId krävs.");
    }

    let totalExamined = 0;
    let missingIsMemberDraft = 0;
    let missingPublishAt = 0;
    let skippedNoCreatedAt = 0;
    const skippedIds = [];
    let updatedCount = 0;

    let lastWorkoutDoc = null;
    let hasMore = true;

    let batch = db.batch();
    let batchCount = 0;

    while (hasMore) {
      let wQuery = db
        .collection("workouts")
        .where("organizationId", "==", orgId)
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(500);

      if (lastWorkoutDoc) {
        wQuery = wQuery.startAfter(lastWorkoutDoc);
      }

      const workoutsSnap = await wQuery.get();
      if (workoutsSnap.empty) {
        hasMore = false;
        break;
      }

      totalExamined += workoutsSnap.size;
      lastWorkoutDoc = workoutsSnap.docs[workoutsSnap.docs.length - 1];

      for (const workoutDoc of workoutsSnap.docs) {
        const data = workoutDoc.data() || {};
        const updatePayload = {};
        let needsUpdate = false;

        if (data.isMemberDraft === undefined) {
          missingIsMemberDraft++;
          updatePayload.isMemberDraft = false;
          needsUpdate = true;
        }

        if (data.publishAt === undefined) {
          missingPublishAt++;
          if (typeof data.createdAt === "number" && Number.isFinite(data.createdAt) && data.createdAt > 0) {
            updatePayload.publishAt = data.createdAt;
            needsUpdate = true;
          } else {
            skippedNoCreatedAt++;
            if (skippedIds.length < 50) {
              skippedIds.push(workoutDoc.id);
            }
          }
        }

        if (needsUpdate) {
          if (!dryRun) {
            batch.update(workoutDoc.ref, updatePayload);
            batchCount++;
            updatedCount++;

            if (batchCount >= 400) {
              await batch.commit();
              batch = db.batch();
              batchCount = 0;
            }
          }
        }
      }

      if (workoutsSnap.size < 500) {
        hasMore = false;
      }
    }

    if (!dryRun && batchCount > 0) {
      await batch.commit();
    }

    return {
      totalExamined,
      missingIsMemberDraft,
      missingPublishAt,
      skippedNoCreatedAt,
      skippedIds,
      updatedCount
    };
  }
);

module.exports = { mergeDuplicateExerciseNames, backfillWorkoutFlags };

