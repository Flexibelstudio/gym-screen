const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { db } = require("./init");
const { getCallerData } = require("./shared");

// ============================================================================
// UTGÅENDE MEJL
//
// Klienten lägger färdiga meddelanden i mail-samlingen: { to, message: { subject,
// text } }. Formatet är detsamma som Firebase-tillägget "Trigger Email" använder,
// men det tillägget stängs ned 31 mars 2027 — därför skickar vi själva via Resend.
//
// Vi skriver tillbaka ett delivery-fält på varje dokument. Det är både kvittot
// och spärren: ett dokument som redan har delivery.state rörs aldrig igen, så
// varken en omskrivning eller ett omkört anrop kan skicka samma mejl två gånger.
// Vill man skicka om ett meddelande raderar man delivery-fältet på dokumentet.
// ============================================================================

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

/**
 * Avsändare. Domänen måste vara verifierad i Resend, och där är i dag bara
 * flexibelfriskvardhalsa.se verifierad. Mejlen går ändå bara till oss själva,
 * så ingen utomstående ser avsändaren. Verifieras smartstudio.se senare byts
 * raden — inget annat behöver ändras.
 */
const FROM = "SmartStudio <no-reply@flexibelfriskvardhalsa.se>";

const stamp = (ref, delivery) => ref.set({ delivery }, { merge: true });

const sendMail = onDocumentWritten(
  { document: "mail/{mailId}", secrets: [RESEND_API_KEY] },
  async (event) => {
    const after = event.data && event.data.after;
    if (!after || !after.exists) return;

    const data = after.data() || {};

    // Redan hanterat eller pågående — rör inte. Det här stoppar också kedjan
    // som annars uppstår av att vi själva skriver till dokumentet.
    if (data.delivery && data.delivery.state) return;

    const ref = after.ref;
    const to = data.to;
    const message = data.message || {};

    if (!to || !message.subject) {
      await stamp(ref, { state: "ERROR", error: "Saknar mottagare eller ämne.", endTime: new Date() });
      return;
    }

    // Stämpla först. Körs funktionen om efter en krasch ska den inte börja om
    // från början och skicka mejlet en gång till.
    await stamp(ref, { state: "PROCESSING", startTime: new Date() });

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY.value()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: FROM,
          to: Array.isArray(to) ? to : [to],
          subject: message.subject,
          text: message.text || "",
          ...(message.html ? { html: message.html } : {}),
          ...(data.replyTo ? { reply_to: data.replyTo } : {})
        })
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        const reason = (body && body.message) || `HTTP ${response.status}`;
        console.error("Resend nekade mejlet:", reason, body);
        await stamp(ref, { state: "ERROR", error: String(reason).slice(0, 500), endTime: new Date() });
        return;
      }

      await stamp(ref, { state: "SUCCESS", messageId: body.id || null, endTime: new Date() });
    } catch (error) {
      console.error("Kunde inte nå Resend:", error);
      await stamp(ref, {
        state: "ERROR",
        error: String(error && error.message).slice(0, 500),
        endTime: new Date()
      });
    }
  }
);

/**
 * Tömmer kön i efterhand. Meddelanden som hamnade i mail-samlingen innan
 * funktionen fanns har aldrig fått något delivery-fält, och väcks därför inte
 * av någon skrivning. Den här petar på dem så att sendMail tar vid.
 */
const flushMailQueue = onCall({ secrets: [RESEND_API_KEY] }, async (request) => {
  const caller = await getCallerData(request.auth);
  if (caller.role !== "systemowner") {
    throw new HttpsError("permission-denied", "Bara systemägare får tömma mejlkön.");
  }

  const snap = await db.collection("mail").limit(50).get();
  let nudged = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    if (data.delivery && data.delivery.state) continue;
    await doc.ref.set({ queuedAt: new Date() }, { merge: true });
    nudged++;
  }

  return { nudged };
});

module.exports = {
  sendMail,
  flushMailQueue
};
