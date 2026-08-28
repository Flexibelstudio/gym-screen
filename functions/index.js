const {
  flexUpdateUserRole,
  flexApproveCoach,
  flexInviteUser,
  receiveExternalWorkout,
  api,
  onOrganizationCreated,
  onUserCreated,
  onUserUpdated,
  onUserDeleted,
  onOrganizationUpdated,
  flexUpdateOrganization,
  onWorkoutCreated,
  onWorkoutUpdated,
  countWorkoutLog,
  flexGeminiProxy,
  aggregateLeaderboard
} = require("./src/training");

const {
  createBooking,
  cancelBooking,
  adminCheckInBooking,
  getSlotDetailsForCheckIn,
  selfCheckInByEmail,
  purchaseMembership,
  purchasePass,
  createKioskOrder
} = require("./src/booking");

const {
  mergeDuplicateExerciseNames,
  backfillWorkoutFlags
} = require("./src/maintenance");

const {
  sendMail,
  flushMailQueue
} = require("./src/mail");

const {
  verifyCoachUnlockCode,
  setCoachUnlockCode,
  getCoachUnlockCode,
  migrateCoachUnlockCodes
} = require("./src/coachAuth");

module.exports = {
  flexUpdateUserRole,
  flexApproveCoach,
  flexInviteUser,
  receiveExternalWorkout,
  api,
  onOrganizationCreated,
  onUserCreated,
  onUserUpdated,
  onUserDeleted,
  onOrganizationUpdated,
  flexUpdateOrganization,
  onWorkoutCreated,
  onWorkoutUpdated,
  countWorkoutLog,
  flexGeminiProxy,
  aggregateLeaderboard,
  createBooking,
  cancelBooking,
  adminCheckInBooking,
  getSlotDetailsForCheckIn,
  selfCheckInByEmail,
  purchaseMembership,
  purchasePass,
  createKioskOrder,
  mergeDuplicateExerciseNames,
  backfillWorkoutFlags,
  verifyCoachUnlockCode,
  setCoachUnlockCode,
  getCoachUnlockCode,
  migrateCoachUnlockCodes,
  sendMail,
  flushMailQueue
};
