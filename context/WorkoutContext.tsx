import React, { createContext, useReducer, useContext, useEffect, useCallback, ReactNode } from 'react';
import { workoutReducer, initialState, WorkoutAction, WorkoutState } from './workoutReducer';
import { useStudio } from './StudioContext';
import { subscribeToWorkoutsForOrganization, saveWorkout as firebaseSaveWorkout, deleteWorkout as firebaseDeleteWorkout, harPassenAndrats } from '../services/firebaseService';
import { Workout } from '../types';
import { lasPanel, sparaPanel } from '../utils/panelforrad';

interface WorkoutContextType extends WorkoutState {
    dispatch: React.Dispatch<WorkoutAction>;
    saveWorkout: (workout: Workout) => Promise<Workout>;
    deleteWorkout: (workoutId: string) => Promise<void>;
    setActiveWorkout: (workout: Workout | null) => void;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export const WorkoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(workoutReducer, initialState);
    const { selectedOrganization } = useStudio();

    useEffect(() => {
        if (selectedOrganization) {
            dispatch({ type: 'LOAD_WORKOUTS_START' });

            // Visa de senast kanda passen direkt — kategorierna star aldrig
            // tomma i vantan pa servern. Farska pass skriver over strax.
            const forradsNyckel = `smartstudio-pass-${selectedOrganization.id}`;
            const sparade = lasPanel<Workout[]>(forradsNyckel);
            if (sparade && sparade.length) {
                dispatch({ type: 'LOAD_WORKOUTS_SUCCESS', payload: sparade });
            }
            // SJALVLAKANDE LYSSNARE. Pa skarmarnas gamla webblasare dor lyssnaren
            // ibland tyst (biljetten gar ut, natet hickar) och en dod lyssnare
            // vaknar aldrig sjalv. Darfor: vid fel startas den om med vaxande
            // vantan, och pa skarmarna fragar vi dessutom servern en gang i
            // minuten om nagot pass andrats — har det det, startas lyssnaren om.
            let avslutaLyssnare: (() => void) | null = null;
            let omstartId: number | null = null;
            let forsok = 0;
            let senastKand = 0;
            let antalKant = -1;
            let avslutad = false;

            const prenumerera = () => {
                if (avslutad) return;
                if (avslutaLyssnare) { try { avslutaLyssnare(); } catch { /* inget */ } }
                avslutaLyssnare = subscribeToWorkoutsForOrganization(
                    selectedOrganization.id,
                    async (workouts) => {
                        forsok = 0;
                        antalKant = workouts.length;
                        senastKand = workouts.reduce((m, w) => Math.max(m, (w as any).updatedAt || 0, w.createdAt || 0), senastKand);

                        // --- CLEANUP LOGIC: Delete temporary drafts older than 24h ---
                        const now = Date.now();
                        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

                        // VIKTIGT: Endast pass som är markerade som medlemsutkast (isMemberDraft: true)
                        // och som varken är favoriter eller publicerade ska städas bort.
                        const expiredDrafts = workouts.filter(w =>
                            w.isMemberDraft === true &&
                            !w.isFavorite &&
                            !w.isPublished &&
                            w.createdAt < (now - TWENTY_FOUR_HOURS)
                        );

                        if (expiredDrafts.length > 0) {
                            console.log(`Cleaning up ${expiredDrafts.length} expired member drafts...`);
                            await Promise.all(expiredDrafts.map(w => firebaseDeleteWorkout(w.id)));
                            const validWorkouts = workouts.filter(w => !expiredDrafts.find(ed => ed.id === w.id));
                            dispatch({ type: 'LOAD_WORKOUTS_SUCCESS', payload: validWorkouts });
                            sparaPanel(forradsNyckel, validWorkouts);
                        } else {
                            dispatch({ type: 'LOAD_WORKOUTS_SUCCESS', payload: workouts });
                            sparaPanel(forradsNyckel, workouts);
                        }
                    },
                    (error) => {
                        console.warn('Passlyssnaren dog, startar om:', error?.message);
                        if (!sparade || !sparade.length) {
                            dispatch({ type: 'LOAD_WORKOUTS_ERROR', payload: error.message });
                        }
                        forsok += 1;
                        const vantan = Math.min(60000, 5000 * Math.pow(2, forsok - 1));
                        if (omstartId) window.clearTimeout(omstartId);
                        omstartId = window.setTimeout(prenumerera, vantan);
                    }
                );
            };
            prenumerera();

            // Skarmarna: minutvis farskhetskoll mot servern (tva lasningar).
            let arSkarm = false;
            try { arSkarm = localStorage.getItem('smartstudio-reservinloggning') === '1'; } catch { /* inget */ }
            let kollId: number | null = null;
            if (arSkarm) {
                kollId = window.setInterval(async () => {
                    if (avslutad || antalKant < 0) return;
                    try {
                        if (await harPassenAndrats(selectedOrganization.id, senastKand, antalKant)) {
                            console.log('[pass] servern har nyare pass an skarmen — startar om lyssnaren');
                            prenumerera();
                        }
                    } catch (e) {
                        console.warn('Farskhetskollen misslyckades:', (e as any)?.message);
                    }
                }, 60000);
            }

            // Natet kom tillbaka / sidan blev synlig igen: starta om for sakerhets skull.
            const vakna = () => { if (!avslutad) prenumerera(); };
            window.addEventListener('online', vakna);

            return () => {
                avslutad = true;
                window.removeEventListener('online', vakna);
                if (omstartId) window.clearTimeout(omstartId);
                if (kollId) window.clearInterval(kollId);
                if (avslutaLyssnare) { try { avslutaLyssnare(); } catch { /* inget */ } }
            };
        } else {
            dispatch({ type: 'LOAD_WORKOUTS_SUCCESS', payload: [] });
        }
    }, [selectedOrganization]);

    const setActiveWorkout = useCallback((workout: Workout | null) => {
        dispatch({ type: 'SET_ACTIVE_WORKOUT', payload: workout });
    }, []);

    const saveWorkout = useCallback(async (workout: Workout): Promise<Workout> => {
        if (!selectedOrganization) {
            const errorMsg = "Kan inte spara pass: ingen organisation är vald.";
            dispatch({ type: 'SAVE_WORKOUT_ERROR', payload: errorMsg });
            throw new Error(errorMsg);
        }

        dispatch({ type: 'SAVE_WORKOUT_START' });

        const workoutToSave: Workout = {
            ...workout,
            organizationId: selectedOrganization.id,
            createdAt: workout.createdAt || Date.now(),
        };

        try {
            await firebaseSaveWorkout(workoutToSave);
            dispatch({ type: 'SAVE_WORKOUT_SUCCESS', payload: workoutToSave });
            return workoutToSave;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Ett okänt fel inträffade.";
            dispatch({ type: 'SAVE_WORKOUT_ERROR', payload: errorMsg });
            throw error;
        }
    }, [selectedOrganization]);

    const deleteWorkout = useCallback(async (workoutId: string): Promise<void> => {
        if (!selectedOrganization) {
            throw new Error("Kan inte radera pass: ingen organisation är vald.");
        }
        try {
            await firebaseDeleteWorkout(workoutId);
            dispatch({ type: 'DELETE_WORKOUT_SUCCESS', payload: workoutId });
        } catch (error) {
            console.error("Kunde inte ta bort passet:", error);
            throw new Error("Ett fel uppstod när passet skulle tas bort.");
        }
    }, [selectedOrganization]);


    const value = React.useMemo(() => ({
        ...state,
        dispatch,
        saveWorkout,
        deleteWorkout,
        setActiveWorkout
    }), [state, saveWorkout, deleteWorkout, setActiveWorkout]);

    return (
        <WorkoutContext.Provider value={value}>
            {children}
        </WorkoutContext.Provider>
    );
};

export const useWorkout = (): WorkoutContextType => {
    const context = useContext(WorkoutContext);
    if (context === undefined) {
        throw new Error('useWorkout must be used within a WorkoutProvider');
    }
    return context;
};