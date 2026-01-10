import React, { createContext, useReducer, useContext, useEffect, useCallback, ReactNode } from 'react';
import { workoutReducer, initialState, WorkoutAction, WorkoutState } from './workoutReducer';
import { useStudio } from './StudioContext';
import { getWorkoutsForOrganization, saveWorkout as firebaseSaveWorkout, deleteWorkout as firebaseDeleteWorkout } from '../services/firebaseService';
import { Workout } from '../types';

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
            getWorkoutsForOrganization(selectedOrganization.id)
                .then(workouts => {
                    dispatch({ type: 'LOAD_WORKOUTS_SUCCESS', payload: workouts });
                })
                .catch(error => {
                    dispatch({ type: 'LOAD_WORKOUTS_ERROR', payload: error.message });
                });
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


    return (
        <WorkoutContext.Provider value={{ ...state, dispatch, saveWorkout, deleteWorkout, setActiveWorkout }}>
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