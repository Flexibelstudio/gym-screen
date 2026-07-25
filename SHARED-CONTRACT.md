# SHARED-CONTRACT — SmartStudio delad backend

Detta Firebase-projekt delas av flera appar: SmartStudio (träningsskärm), SmartStudio Bokningar, och framtida SmartStudio Hemsida. Allt som listas här är fryst kontrakt: får inte döpas om, tas bort eller ändras i signatur/beteende utan godkännande från båda apparnas ägare.

## 1. Cloud Functions (functions/index.js)

### Bokningens callables (anropas via httpsCallable med EXAKT dessa namn)
createBooking, cancelBooking, adminCheckInBooking, getSlotDetailsForCheckIn,
selfCheckInByEmail, purchaseMembership, purchasePass, createKioskOrder

### Delade hjälpare (används av bokningsfunktionerna, definieras EN gång)
getCallerData, isStaffRole

### Träningsappens exports (fryses för denna app)
flexUpdateUserRole, flexApproveCoach, flexInviteUser, receiveExternalWorkout,
api, onOrganizationCreated, onUserCreated, onUserUpdated, onUserDeleted,
onOrganizationUpdated, flexUpdateOrganization, onWorkoutCreated,
onWorkoutUpdated, flexGeminiProxy, aggregateLeaderboard

Regel: vid uppdelning i moduler ska index.js re-exportera samtliga namn oförändrade.

## 2. Firestore collections — ägarskap

### Delade (båda apparna läser/skriver — ändringar kräver bådas godkännande)
users (inkl. subcollections personalBests, customPrograms, customExercises),
organizations, org_settings (PUBLIK läsning — även framtida Hemsida läser här),
mail, system

### Bokningar äger (träningsappen rör dem inte)
services, slots, bookings, passes, client_memberships, memberships,
kiosk_products, kiosk_orders, noShowFees

### Träningsappen äger (Bokningar rör dem inte)
workouts, workoutLogs, workout_results, exerciseBank, custom_exercises,
exerciseSuggestions, studio_events, active_checkins, leaderboards, races,
info_carousel, coachNotes, admin_activity, system_gallery, system_partners, leads

## 3. Firestore-regler (firestore.rules)
Regelblocken för bokningens collections (rad ~221–269) samt org_settings publika läsning får inte tas bort eller skärpas utan bokningsappens godkännande.

## 4. Framtida SmartStudio Hemsida
Hemsidan förväntas endast LÄSA publika ytor (org_settings m.m.). Nya publika läsytor ska läggas till i detta kontrakt innan de implementeras.

## 6. Stripe-noteringar
Organization.memberPromotionCode: Stripe promotion code-ID för automatisk medlemsrabatt vid registrering. Måste vara skapad på SmartStudios plattformskonto i Stripe (inte gymmets Connect-konto). Rabatten påverkar även plattformsavgiften proportionerligt.
Organization.allowMemberPromotionCode: Sätter om organisationen har tillstånd att använda medlemsrabattkod. Sätts endast av systemägare; utan true ignoreras memberPromotionCode i checkout (serverside).

## 7. Ändringsprocess
1. Föreslå ändring i detta dokument först.
2. Båda apparnas ägare godkänner.
3. Genomför ändringen i kod/regler.
Versionslogg förs längst ner i denna fil.

---
Version 1.0 — 2026-07-20 — Initialt kontrakt.
Version 1.1 — 2026-07-25 — Tillägg av Stripe-noteringar för memberPromotionCode.
Version 1.2 — 2026-07-25 — Tillägg av allowMemberPromotionCode för behörighetsspärr av medlemsrabattkod.
