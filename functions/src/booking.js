const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin } = require("./init");
const { getCallerData, isStaffRole } = require("./shared");

// =====================================================================
// ÄNDRINGSLOGG (aug 2026):
// 1. Ny betaltyp 'medlemskap' – kräver aktivt medlemskap, drar ALDRIG klipp.
//    'klippkort' drar ALLTID klipp (gamla tysta medlemskaps-bypassen borttagen).
// 2. Väntelista – createBooking({ joinWaitlist: true }) skapar bokning med
//    status 'waiting' när passet är fullt (ingen plats/klipp dras).
//    cancelBooking lyfter automatiskt första i kön till 'confirmed'.
// 3. Klippkortens giltighet – passes-dokument kan ha validForCategories[] och
//    validForServiceIds[]. Tomt/saknas = gäller allt (bakåtkompatibelt).
//    Tjänster kan ha fältet category (t.ex. 'Träning', 'Yoga', 'Massage').
//    purchasePass kopierar giltighetsreglerna från passType till kortet.
// =====================================================================

// Hjälpare: är ett klippkort giltigt för en viss tjänst?
const passValidForService = (passData, service, serviceId) => {
  const cats = passData.validForCategories || [];
  const ids = passData.validForServiceIds || [];
  if (cats.length === 0 && ids.length === 0) return true; // oscopat kort = gäller allt
  if (service && service.category && cats.includes(service.category)) return true;
  return ids.includes(serviceId);
};

// Hjälpare: hitta bästa giltiga klippkort för en kund + tjänst
const findEligiblePass = async (db, clientId, service, serviceId, klippCost, now) => {
  const passSnap = await db.collection("passes").where("clientId", "==", clientId).get();
  const eligible = passSnap.docs.filter((d) => {
    const p = d.data();
    return p.remainingKlipp >= klippCost &&
      new Date(p.expiryDate) >= now &&
      passValidForService(p, service, serviceId);
  });
  if (eligible.length === 0) return null;
  // Dra från kortet som går ut först (minst slöseri för kunden)
  eligible.sort((a, b) => (a.data().expiryDate || "").localeCompare(b.data().expiryDate || ""));
  return eligible[0];
};

// --- FUNKTION: Skapa bokning ---
const createBooking = onCall(async (request) => {
  const db = admin.firestore();
  const caller = await getCallerData(request.auth);
  const { slotId, serviceId, paymentType, clientId, clientName, clientEmail, joinWaitlist } = request.data;

  if (!slotId || !serviceId) {
    throw new HttpsError("invalid-argument", "slotId och serviceId krävs.");
  }
  if (!["klippkort", "betalning", "medlemskap"].includes(paymentType)) {
    throw new HttpsError("invalid-argument", "Ogiltig betaltyp. Tillåtna: klippkort, betalning, medlemskap.");
  }

  const slotSnap = await db.collection("slots").doc(slotId).get();
  if (!slotSnap.exists) throw new HttpsError("not-found", "Hittade inte den önskade tiden.");
  const slot = slotSnap.data();

  const serviceSnap = await db.collection("services").doc(serviceId).get();
  if (!serviceSnap.exists) throw new HttpsError("not-found", "Hittade inte tjänsten.");
  const service = serviceSnap.data();

  const organizationId = slot.organizationId;
  const klippCost = service.klippCost != null ? service.klippCost : 1;

  // Bokar man åt någon annan krävs personal
  const isAdminBooking = isStaffRole(caller.role) && !!clientId;
  const targetClientId = isAdminBooking ? clientId : caller.uid;
  const targetClientName = isAdminBooking
    ? (clientName || "")
    : (caller.displayName || `${caller.firstName || ""} ${caller.lastName || ""}`.trim());
  const targetClientEmail = isAdminBooking ? (clientEmail || "") : caller.email;

  if (!isAdminBooking && caller.role === "member" && caller.organizationId !== organizationId) {
    throw new HttpsError("permission-denied", "Du kan bara boka i din egen anläggning.");
  }

  const settingsSnap = await db.collection("org_settings").doc(organizationId).get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};

  const now = new Date();
  const slotTime = new Date(slot.dateTime);

  // Dubbelbokning (inkl. befintlig köplats)
  const existingSnap = await db.collection("bookings")
    .where("slotId", "==", slotId)
    .where("clientId", "==", targetClientId)
    .get();
  if (existingSnap.docs.some((d) => d.data().status !== "cancelled")) {
    throw new HttpsError("already-exists", "Användaren har redan bokat eller köat till denna tid.");
  }

  // Regler som bara gäller när en medlem bokar sig själv
  if (caller.role === "member" && !isAdminBooking) {
    const bookingDaysAhead = settings.bookingDaysAhead != null ? settings.bookingDaysAhead : 14;
    const diffDays = (slotTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > bookingDaysAhead) {
      throw new HttpsError("failed-precondition", `Du kan högst boka pass ${bookingDaysAhead} dagar i förväg.`);
    }
    const maxFutureBookings = settings.maxFutureBookings != null ? settings.maxFutureBookings : 5;
    const futureSnap = await db.collection("bookings")
      .where("clientId", "==", targetClientId)
      .where("organizationId", "==", organizationId)
      .where("status", "==", "confirmed")
      .get();
    const futureCount = futureSnap.docs.filter((d) => new Date(d.data().dateTime) >= now).length;
    if (futureCount >= maxFutureBookings) {
      throw new HttpsError("failed-precondition", `Du har nått gränsen för antal förhandsbokningar (max ${maxFutureBookings} st samtidigt).`);
    }
  }

  // Aktiva medlemskap (för restriktioner + betaltypen 'medlemskap')
  const cmSnap = await db.collection("client_memberships")
    .where("clientId", "==", targetClientId)
    .where("status", "==", "active")
    .get();
  // Tomt endDate = löper tills vidare (aktivt)
  const activeMemberships = cmSnap.docs.map((d) => d.data()).filter((cm) => !cm.endDate || new Date(cm.endDate) >= now);

  // Medlemskapsrestriktion på passet
  if (slot.allowedMemberships && slot.allowedMemberships.length > 0 && caller.role === "member" && !isAdminBooking) {
    const ok = activeMemberships.some((cm) => slot.allowedMemberships.includes(cm.membershipId));
    if (!ok) {
      throw new HttpsError("failed-precondition", 'Detta pass kräver ett specifikt medlemskap. Teckna ett under "Mitt Medlemskap".');
    }
  }

  // Betaltyp 'medlemskap': kräver aktivt medlemskap, inga klipp dras
  if (paymentType === "medlemskap" && activeMemberships.length === 0) {
    throw new HttpsError("failed-precondition", "Användaren har inget aktivt medlemskap. Välj klippkort eller betalning istället.");
  }

  // Betaltyp 'klippkort': hitta giltigt kort för just denna tjänst (kategorier/tjänste-scope)
  let passRefToDeduct = null;
  if (paymentType === "klippkort") {
    if (slot.klippkortValid === false) {
      throw new HttpsError("failed-precondition", "Detta pass kan inte bokas med klippkort.");
    }
    const eligibleDoc = await findEligiblePass(db, targetClientId, service, serviceId, klippCost, now);
    if (!eligibleDoc) {
      throw new HttpsError("failed-precondition", "Användaren har inget giltigt klippkort för denna tjänst.");
    }
    passRefToDeduct = eligibleDoc.ref;
  }

  // Transaktion: platstak + ev. väntelista + klippavdrag + skapa bokning
  const bookingRef = db.collection("bookings").doc();
  let placedOnWaitlist = false;
  await db.runTransaction(async (tx) => {
    const freshSlot = await tx.get(slotSnap.ref);
    const s = freshSlot.data();
    const booked = s.bookedCount || 0;
    const isFull = booked >= s.maxParticipants;

    if (isFull && !joinWaitlist) {
      throw new HttpsError("failed-precondition", "SLOT_FULL: Denna tid är tyvärr fullbokad.");
    }

    const status = isFull ? "waiting" : "confirmed";
    placedOnWaitlist = isFull;

    let passData = null;
    if (passRefToDeduct && status === "confirmed") {
      passData = (await tx.get(passRefToDeduct)).data();
      if (!passData || passData.remainingKlipp < klippCost) {
        throw new HttpsError("failed-precondition", "Klippkortet har inte tillräckligt med klipp.");
      }
    }

    tx.set(bookingRef, {
      id: bookingRef.id,
      slotId,
      clientId: targetClientId,
      clientName: targetClientName,
      clientEmail: targetClientEmail,
      serviceId: service.id || serviceId,
      serviceName: service.name,
      dateTime: slot.dateTime,
      duration: service.duration,
      trainerId: slot.trainerId,
      trainerName: slot.trainerName,
      status,
      paymentType,
      organizationId,
      createdAt: new Date().toISOString(),
    });

    if (status === "confirmed") {
      tx.update(slotSnap.ref, { bookedCount: booked + 1 });
      if (passRefToDeduct) {
        tx.update(passRefToDeduct, { remainingKlipp: passData.remainingKlipp - klippCost });
      }
    }
    // Väntelista: ingen platsräkning, inga klipp – dras först vid uppflytt.
  });

  return {
    success: true,
    bookingId: bookingRef.id,
    waitlisted: placedOnWaitlist,
    message: placedOnWaitlist
      ? "Passet är fullt – du står nu i kö och flyttas upp automatiskt om en plats blir ledig."
      : "Bokningen genomfördes!",
  };
});

// --- FUNKTION: Avboka (med automatiskt köupprop) ---
const cancelBooking = onCall(async (request) => {
  const db = admin.firestore();
  const caller = await getCallerData(request.auth);
  const { bookingId } = request.data;
  if (!bookingId) throw new HttpsError("invalid-argument", "bookingId krävs.");

  const bookingRef = db.collection("bookings").doc(bookingId);
  const bookingSnap = await bookingRef.get();
  if (!bookingSnap.exists) throw new HttpsError("not-found", "Bokningen hittades inte.");
  const booking = bookingSnap.data();

  const staff = isStaffRole(caller.role);
  if (booking.clientId !== caller.uid && !staff) {
    throw new HttpsError("permission-denied", "Du har inte behörighet att avboka denna tid.");
  }
  if (booking.status === "cancelled") {
    throw new HttpsError("failed-precondition", "Bokningen är redan avbokad.");
  }

  const now = new Date();

  // En köplats kan alltid lämnas: ingen policy, ingen återbetalning, ingen platsräkning
  if (booking.status === "waiting") {
    await bookingRef.update({ status: "cancelled" });
    return { success: true, message: "Du har lämnat kön." };
  }

  // Avbokningspolicy (gäller bara medlemmar; personal kan avboka när som helst)
  const settingsSnap = await db.collection("org_settings").doc(booking.organizationId).get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  const cancelHours = settings.cancelHoursBefore != null ? settings.cancelHoursBefore : 24;
  const diffHours = (new Date(booking.dateTime).getTime() - now.getTime()) / (1000 * 60 * 60);
  if (diffHours < cancelHours && caller.role === "member") {
    throw new HttpsError("failed-precondition", `Avbokning måste ske senast ${cancelHours} timmar innan bokad tid. Kontakta oss direkt vid akuta förhinder.`);
  }

  // Klippåterföring: föredra ett kort som är giltigt för tjänsten, annars nyaste
  let passToRefundRef = null;
  if (booking.paymentType === "klippkort") {
    const serviceSnap = booking.serviceId ? await db.collection("services").doc(booking.serviceId).get() : null;
    const service = serviceSnap && serviceSnap.exists ? serviceSnap.data() : null;
    const passSnap = await db.collection("passes").where("clientId", "==", booking.clientId).get();
    if (!passSnap.empty) {
      const matching = passSnap.docs.filter((d) => passValidForService(d.data(), service, booking.serviceId));
      const pool = matching.length > 0 ? matching : passSnap.docs;
      const sorted = pool.sort((a, b) =>
        (b.data().createdAt || "").localeCompare(a.data().createdAt || "")
      );
      passToRefundRef = sorted[0].ref;
    }
  }

  // Köupprop: hitta första i kön (och förbered dennes klippavdrag)
  const waitingSnap = await db.collection("bookings")
    .where("slotId", "==", booking.slotId)
    .where("status", "==", "waiting")
    .get();
  let promo = null; // { ref, data, passRef, passKlippCost, newPaymentType }
  if (!waitingSnap.empty) {
    const sortedWaiting = waitingSnap.docs.sort((a, b) =>
      (a.data().createdAt || "").localeCompare(b.data().createdAt || "")
    );
    const first = sortedWaiting[0];
    const wb = first.data();
    promo = { ref: first.ref, data: wb, passRef: null, passKlippCost: 0, newPaymentType: wb.paymentType };

    if (wb.paymentType === "klippkort") {
      const svcSnap = wb.serviceId ? await db.collection("services").doc(wb.serviceId).get() : null;
      const svc = svcSnap && svcSnap.exists ? svcSnap.data() : null;
      const cost = svc && svc.klippCost != null ? svc.klippCost : 1;
      const eligibleDoc = await findEligiblePass(db, wb.clientId, svc, wb.serviceId, cost, now);
      if (eligibleDoc) {
        promo.passRef = eligibleDoc.ref;
        promo.passKlippCost = cost;
      } else {
        // Inget giltigt kort längre – flytta upp ändå men markera som betalning på plats
        promo.newPaymentType = "betalning";
      }
    }
  }

  const slotRef = db.collection("slots").doc(booking.slotId);
  await db.runTransaction(async (tx) => {
    const freshSlot = await tx.get(slotRef);
    let refundPass = null;
    if (passToRefundRef) refundPass = (await tx.get(passToRefundRef)).data();

    let promoPassData = null;
    if (promo && promo.passRef) {
      promoPassData = (await tx.get(promo.passRef)).data();
      if (!promoPassData || promoPassData.remainingKlipp < promo.passKlippCost) {
        // Kortet hann ta slut – flytta upp som betalning på plats istället
        promo.passRef = null;
        promo.newPaymentType = "betalning";
      }
    }

    tx.update(bookingRef, { status: "cancelled" });
    if (passToRefundRef && refundPass) {
      tx.update(passToRefundRef, { remainingKlipp: (refundPass.remainingKlipp || 0) + 1 });
    }

    if (promo) {
      // Uppflytt: den avbokade platsen tas direkt av första i kön → bookedCount oförändrad
      tx.update(promo.ref, { status: "confirmed", paymentType: promo.newPaymentType });
      if (promo.passRef && promoPassData) {
        tx.update(promo.passRef, { remainingKlipp: promoPassData.remainingKlipp - promo.passKlippCost });
      }
    } else if (freshSlot.exists) {
      tx.update(slotRef, { bookedCount: Math.max(0, (freshSlot.data().bookedCount || 0) - 1) });
    }
  });

  return {
    success: true,
    message: promo
      ? "Bokningen har avbokats. Första personen i kön har automatiskt fått platsen."
      : "Bokningen har avbokats framgångsrikt.",
  };
});

// --- FUNKTION: Personal checkar in / markerar no-show ---
const adminCheckInBooking = onCall(async (request) => {
  const db = admin.firestore();
  const caller = await getCallerData(request.auth);
  if (!isStaffRole(caller.role)) throw new HttpsError("permission-denied", "Ej behörig.");

  const { bookingId, status } = request.data;
  if (!bookingId || !status) throw new HttpsError("invalid-argument", "bookingId och status krävs.");

  const bookingRef = db.collection("bookings").doc(bookingId);
  const bookingSnap = await bookingRef.get();
  if (!bookingSnap.exists) throw new HttpsError("not-found", "Bokningen hittades inte.");
  const booking = bookingSnap.data();
  const oldStatus = booking.status;

  await bookingRef.update({ status });

  // No-show-avgift: skapa vid noshow, ta bort om det ångras
  if (status === "noshow") {
    const settingsSnap = await db.collection("org_settings").doc(booking.organizationId).get();
    const feeAmount = settingsSnap.exists && settingsSnap.data().noShowFee != null
      ? settingsSnap.data().noShowFee : 100;
    const existing = await db.collection("noShowFees").where("bookingId", "==", bookingId).get();
    const activeExists = existing.docs.some((d) => d.data().status !== "excused");
    if (!activeExists) {
      const feeRef = db.collection("noShowFees").doc();
      await feeRef.set({
        id: feeRef.id,
        clientId: booking.clientId,
        bookingId,
        organizationId: booking.organizationId,
        date: new Date().toISOString().split("T")[0],
        fee: feeAmount,
        reason: `Uteblev från pass: ${booking.serviceName}`,
        status: "active",
      });
    }
  } else if (oldStatus === "noshow" && status !== "noshow") {
    const toRemove = await db.collection("noShowFees").where("bookingId", "==", bookingId).get();
    const batch = db.batch();
    toRemove.docs.forEach((d) => batch.delete(d.ref));
    if (!toRemove.empty) await batch.commit();
  }

  return { success: true, booking: { ...booking, status } };
});

// --- FUNKTION: Hämta passdetaljer för incheckningsterminal (ingen inloggning krävs) ---
const getSlotDetailsForCheckIn = onCall(async (request) => {
  const db = admin.firestore();
  const { slotId } = request.data;
  if (!slotId) throw new HttpsError("invalid-argument", "slotId krävs.");

  const slotSnap = await db.collection("slots").doc(slotId).get();
  if (!slotSnap.exists) throw new HttpsError("not-found", "Passet kunde inte hittas.");
  const slot = slotSnap.data();

  let service = null;
  if (slot.serviceId) {
    const svc = await db.collection("services").doc(slot.serviceId).get();
    if (svc.exists) service = svc.data();
  }

  const bSnap = await db.collection("bookings").where("slotId", "==", slotId).get();
  const bookings = bSnap.docs.map((d) => d.data()).filter((b) => b.status !== "cancelled");

  return {
    success: true,
    slot: {
      ...slot,
      serviceColor: (service && service.color) || "#545eb6",
      serviceName: (service && service.name) || "Träningspass",
    },
    bookings,
  };
});

// --- FUNKTION: Självincheckning + kedjeincheckning (ingen inloggning krävs) ---
const selfCheckInByEmail = onCall(async (request) => {
  const db = admin.firestore();
  const { slotId, searchString, bookingId } = request.data;
  if (!slotId) throw new HttpsError("invalid-argument", "slotId krävs.");

  const slotSnap = await db.collection("slots").doc(slotId).get();
  if (!slotSnap.exists) throw new HttpsError("not-found", "Passet hittades inte.");
  const slot = slotSnap.data();
  const organizationId = slot.organizationId;

  // Incheckningsfönster
  const settingsSnap = await db.collection("org_settings").doc(organizationId).get();
  const windowMin = settingsSnap.exists && settingsSnap.data().checkInWindowMinutes != null
    ? settingsSnap.data().checkInWindowMinutes : 15;
  const now = new Date();
  const minutesUntilStart = Math.ceil((new Date(slot.dateTime).getTime() - now.getTime()) / 60000);
  if (minutesUntilStart > windowMin) {
    throw new HttpsError("failed-precondition", `Incheckningen öppnar först ${windowMin} minuter innan passet startar. Det är för närvarande ${minutesUntilStart} minuter kvar.`);
  }

  const slotBookingsSnap = await db.collection("bookings").where("slotId", "==", slotId).get();
  const slotBookings = slotBookingsSnap.docs.map((d) => ({ ref: d.ref, ...d.data() }));

  const batch = db.batch();
  let checkedIn = null;

  // 1. Specifik bokning
  if (bookingId) {
    const found = slotBookings.find((b) => b.id === bookingId);
    if (found) { batch.update(found.ref, { status: "attended" }); checkedIn = { ...found, status: "attended" }; }
  }

  // 2. Sök på e-post/namn
  if (!checkedIn && searchString) {
    const clean = searchString.trim().toLowerCase();
    const match = slotBookings.find((b) => b.status !== "cancelled" && (
      (b.clientEmail && b.clientEmail.toLowerCase() === clean) ||
      (b.clientName && b.clientName.toLowerCase().includes(clean))
    ));
    if (match) { batch.update(match.ref, { status: "attended" }); checkedIn = { ...match, status: "attended" }; }
  }

  // 3. Registrera på plats om det finns plats
  if (!checkedIn && searchString) {
    const active = slotBookings.filter((b) => b.status !== "cancelled");
    if (active.length >= (slot.maxParticipants || 12)) {
      throw new HttpsError("failed-precondition", "Hittade ingen bokning, och passet är tyvärr fullbokat!");
    }
    let user = null;
    const byEmail = await db.collection("users").where("email", "==", searchString.trim()).limit(1).get();
    if (!byEmail.empty) user = { uid: byEmail.docs[0].id, ...byEmail.docs[0].data() };

    let service = null;
    if (slot.serviceId) { const svc = await db.collection("services").doc(slot.serviceId).get(); if (svc.exists) service = svc.data(); }

    const newRef = db.collection("bookings").doc();
    checkedIn = {
      id: newRef.id,
      organizationId,
      slotId,
      serviceId: slot.serviceId || null,
      serviceName: (service && service.name) || "Träningspass",
      clientId: user ? user.uid : `guest_${Math.random().toString(36).substr(2, 9)}`,
      clientName: user ? (user.displayName || `${user.firstName || ""} ${user.lastName || ""}`.trim()) : searchString,
      clientEmail: user ? user.email : (searchString.includes("@") ? searchString : ""),
      dateTime: slot.dateTime,
      duration: slot.duration || 60,
      trainerId: slot.trainerId,
      trainerName: slot.trainerName,
      status: "attended",
      createdAt: new Date().toISOString(),
      paymentType: "betalning",
    };
    batch.set(newRef, checkedIn);
    batch.update(slotSnap.ref, { bookedCount: (slot.bookedCount || 0) + 1 });
  }

  if (!checkedIn) throw new HttpsError("not-found", "Hittade ingen bokning att checka in.");

  // 4. Kedjeincheckning – checka in efterföljande pass i rad
  const othersMap = new Map();
  const addOther = (d) => {
    const b = d.data();
    if (b.id !== checkedIn.id && b.status !== "cancelled" && b.status !== "attended") {
      othersMap.set(b.id, { ref: d.ref, ...b });
    }
  };
  const byClient = await db.collection("bookings").where("clientId", "==", checkedIn.clientId).get();
  byClient.docs.forEach(addOther);
  if (checkedIn.clientEmail) {
    const byMail = await db.collection("bookings").where("clientEmail", "==", checkedIn.clientEmail).get();
    byMail.docs.forEach(addOther);
  }

  const slotCache = new Map([[slot.id || slotId, slot]]);
  for (const b of othersMap.values()) {
    if (!slotCache.has(b.slotId)) {
      const s = await db.collection("slots").doc(b.slotId).get();
      if (s.exists) slotCache.set(b.slotId, s.data());
    }
  }

  const chained = [];
  const remaining = [...othersMap.values()];
  let currentSlot = slot;
  let keepGoing = true;
  while (keepGoing) {
    const next = remaining.find((b) => {
      const ns = slotCache.get(b.slotId);
      if (!ns) return false;
      const curEnd = new Date(new Date(currentSlot.dateTime).getTime() + (currentSlot.duration || 60) * 60000);
      const gapMin = (new Date(ns.dateTime).getTime() - curEnd.getTime()) / 60000;
      return gapMin >= -10 && gapMin <= windowMin;
    });
    if (next) {
      batch.update(next.ref, { status: "attended" });
      chained.push(next);
      remaining.splice(remaining.indexOf(next), 1);
      currentSlot = slotCache.get(next.slotId);
    } else {
      keepGoing = false;
    }
  }

  await batch.commit();

  let message = "Incheckad! Ha ett fantastiskt pass!";
  if (chained.length > 0) {
    message = `Incheckad! Du har även checkats in på följande pass i rad: ${chained.map((b) => b.serviceName).join(", ")}`;
  }
  return { success: true, booking: checkedIn, message };
});

// --- FUNKTION: Köp/teckna medlemskap ---
const purchaseMembership = onCall(async (request) => {
  const db = admin.firestore();
  const caller = await getCallerData(request.auth);
  const { membershipId } = request.data;
  if (!membershipId) throw new HttpsError("invalid-argument", "membershipId krävs.");

  const mSnap = await db.collection("memberships").doc(membershipId).get();
  if (!mSnap.exists) throw new HttpsError("not-found", "Medlemskapstyp hittades inte.");
  const membership = mSnap.data();

  const batch = db.batch();
  // Avsluta befintliga aktiva medlemskap
  const activeSnap = await db.collection("client_memberships")
    .where("clientId", "==", caller.uid).where("status", "==", "active").get();
  activeSnap.docs.forEach((d) => batch.update(d.ref, { status: "expired" }));

  const startDate = new Date().toISOString().split("T")[0];
  const end = new Date();
  end.setMonth(end.getMonth() + (membership.validityMonths || 1));
  const endDate = end.toISOString().split("T")[0];

  const cmRef = db.collection("client_memberships").doc();
  const newCM = {
    id: cmRef.id,
    clientId: caller.uid,
    membershipId,
    name: membership.name,
    price: membership.price,
    startDate,
    endDate,
    maxBookingsPerMonth: membership.maxBookingsPerMonth,
    remainingBookingsThisMonth: membership.maxBookingsPerMonth,
    status: "active",
    organizationId: membership.organizationId,
    createdAt: new Date().toISOString(),
    ort: membership.ort || null,
  };
  batch.set(cmRef, newCM);
  await batch.commit();

  return { success: true, clientMembership: newCM, message: `Välkommen! Du är nu medlem i ${membership.name}.` };
});

// --- FUNKTION: Köp klippkort ---
const purchasePass = onCall(async (request) => {
  const db = admin.firestore();
  const caller = await getCallerData(request.auth);
  const { passType } = request.data;
  if (!passType || passType.totalKlipp == null) {
    throw new HttpsError("invalid-argument", "passType med totalKlipp krävs.");
  }

  const validityMonths = passType.validityMonths || 6;
  const passRef = db.collection("passes").doc();
  const newPass = {
    id: passRef.id,
    clientId: caller.uid,
    name: passType.name,
    totalKlipp: passType.totalKlipp,
    remainingKlipp: passType.totalKlipp,
    expiryDate: new Date(Date.now() + validityMonths * 30 * 24 * 60 * 60 * 1000)
      .toISOString().split("T")[0],
    organizationId: caller.organizationId,
    createdAt: new Date().toISOString(),
    // Giltighetsregler kopieras från klippkortstypen (tomt = gäller allt)
    validForCategories: passType.validForCategories || [],
    validForServiceIds: passType.validForServiceIds || [],
  };
  await passRef.set(newPass);

  return { success: true, pass: newPass, message: "Klippkort köpt!" };
});

// --- FUNKTION: Kioskköp (kreditkontroll + atomiskt lageravdrag) ---
const createKioskOrder = onCall(async (request) => {
  const db = admin.firestore();
  const caller = await getCallerData(request.auth);
  const { productId, paymentMethod, ort } = request.data;
  if (!productId || !paymentMethod) {
    throw new HttpsError("invalid-argument", "productId och paymentMethod krävs.");
  }

  // Kreditkontroll: 'membership_invoice' kräver aktivt löpande medlemskap
  if (paymentMethod === "membership_invoice") {
    const cmSnap = await db.collection("client_memberships")
      .where("clientId", "==", caller.uid).where("status", "==", "active").get();
    const active = cmSnap.docs.some((d) => !d.data().endDate || new Date(d.data().endDate) >= new Date());
    if (!active) {
      throw new HttpsError("failed-precondition", "Endast medlemmar med ett aktivt löpande medlemskap (månadsbetalning) kan handla på kredit.");
    }
  }

  const productRef = db.collection("kiosk_products").doc(productId);
  const prodSnap = await productRef.get();
  if (!prodSnap.exists) throw new HttpsError("not-found", "Produkten hittades inte.");
  const product = prodSnap.data();

  const resolvedOrtKey = (ort || caller.ort || (product.orter && product.orter[0]) || "Salem").trim();

  const orderRef = db.collection("kiosk_orders").doc();
  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(productRef);
    const p = fresh.data();
    const perOrt = p.stockPerOrt || {};

    // Lagerkontroll
    if (perOrt[resolvedOrtKey] !== undefined) {
      if (perOrt[resolvedOrtKey] <= 0) {
        throw new HttpsError("failed-precondition", `Produkten är tyvärr slut i lager på orten ${resolvedOrtKey}.`);
      }
    } else if (p.stock !== undefined && p.stock <= 0) {
      throw new HttpsError("failed-precondition", "Produkten är tyvärr slut i lager.");
    }

    // Lageravdrag
    const update = {};
    if (perOrt[resolvedOrtKey] !== undefined) update[`stockPerOrt.${resolvedOrtKey}`] = perOrt[resolvedOrtKey] - 1;
    if (p.stock !== undefined) update.stock = p.stock - 1;
    if (Object.keys(update).length > 0) tx.update(productRef, update);

    // Moms (inkl. i priset)
    const r = product.vatRate / 100;
    const vatAmount = Number((product.price * r / (1 + r)).toFixed(2));

    tx.set(orderRef, {
      id: orderRef.id,
      clientId: caller.uid,
      clientName: caller.displayName || caller.email,
      clientEmail: caller.email,
      productId: product.id || productId,
      productName: product.name,
      price: product.price,
      vatRate: product.vatRate,
      vatAmount,
      paymentStatus: "paid",
      paymentMethod,
      createdAt: new Date().toISOString(),
      organizationId: product.organizationId,
      ort: resolvedOrtKey,
    });
  });

  return {
    success: true,
    orderId: orderRef.id,
    message: paymentMethod === "membership_invoice"
      ? "Köp genomfört! Kostnaden läggs på nästa medlemsfaktura."
      : `Köp genomfört via ${paymentMethod === "stripe" ? "kortbetalning (Stripe)" : "betala på plats"}!`,
  };
});

module.exports = {
  createBooking,
  cancelBooking,
  adminCheckInBooking,
  getSlotDetailsForCheckIn,
  selfCheckInByEmail,
  purchaseMembership,
  purchasePass,
  createKioskOrder
};
