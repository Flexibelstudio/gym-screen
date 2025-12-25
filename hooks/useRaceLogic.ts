import { useEffect, useState } from "react";

/**
 * Custom hook to manage the logic for ending a HYROX-style race.
 * It determines when all participants have finished and triggers the necessary callbacks.
 * @param participants - An array of participant objects, each with an `isFinished` status.
 * @param onRaceFinish - A callback function to execute when the race ends (e.g., to show an animation).
 */
export const useRaceLogic = (
  participants: { isFinished: boolean }[],
  onRaceFinish: () => void
) => {
  const [raceEnded, setRaceEnded] = useState(false);

  useEffect(() => {
    // Check if there are any participants and if all of them have finished.
    const allFinished =
      participants.length > 0 && participants.every((p) => p.isFinished);

    // If the race has ended and we haven't already processed it, trigger the finish sequence.
    if (allFinished && !raceEnded) {
      onRaceFinish(); // Trigger the visual/audio feedback for race completion.
      setRaceEnded(true); // Mark the race as ended to prevent re-triggering.
    }
  }, [participants, raceEnded, onRaceFinish]);

  // Return the raceEnded state for the component to use if needed.
  return { raceEnded };
};