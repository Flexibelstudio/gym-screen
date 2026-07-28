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
  mergeDuplicateExerciseNames
} = require("./src/maintenance");

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
  mergeDuplicateExerciseNames
};
