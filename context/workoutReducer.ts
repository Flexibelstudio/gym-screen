import { Workout } from '../types';

export interface WorkoutState {
  workouts: Workout[];
  activeWorkout: Workout | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

export type WorkoutAction =
  | { type: 'LOAD_WORKOUTS_START' }
  | { type: 'LOAD_WORKOUTS_SUCCESS'; payload: Workout[] }
  | { type: 'LOAD_WORKOUTS_ERROR'; payload: string }
  | { type: 'SET_ACTIVE_WORKOUT'; payload: Workout | null }
  | { type: 'CLEAR_ACTIVE_WORKOUT' }
  | { type: 'SAVE_WORKOUT_START' }
  | { type: 'SAVE_WORKOUT_SUCCESS'; payload: Workout }
  | { type: 'SAVE_WORKOUT_ERROR'; payload: string }
  | { type: 'DELETE_WORKOUT_SUCCESS'; payload: string }; // payload is workoutId

export const initialState: WorkoutState = {
  workouts: [],
  activeWorkout: null,
  isLoading: true,
  isSaving: false,
  error: null,
};

export function workoutReducer(state: WorkoutState, action: WorkoutAction): WorkoutState {
  switch (action.type) {
    case 'LOAD_WORKOUTS_START':
      return { ...state, isLoading: true, error: null };
    case 'LOAD_WORKOUTS_SUCCESS':
      return { ...state, isLoading: false, workouts: action.payload };
    case 'LOAD_WORKOUTS_ERROR':
      return { ...state, isLoading: false, error: action.payload };
    case 'SET_ACTIVE_WORKOUT':
      return { ...state, activeWorkout: action.payload };
    case 'CLEAR_ACTIVE_WORKOUT':
      return { ...state, activeWorkout: null };
    case 'SAVE_WORKOUT_START':
        return { ...state, isSaving: true, error: null };
    case 'SAVE_WORKOUT_SUCCESS':
        const updatedWorkout = action.payload;
        const isNew = !state.workouts.some(w => w.id === updatedWorkout.id);
        const newWorkouts = isNew
            ? [updatedWorkout, ...state.workouts]
            : state.workouts.map(w => w.id === updatedWorkout.id ? updatedWorkout : w);
        return {
            ...state,
            isSaving: false,
            workouts: newWorkouts,
            activeWorkout: state.activeWorkout?.id === updatedWorkout.id ? updatedWorkout : state.activeWorkout,
        };
    case 'SAVE_WORKOUT_ERROR':
        return { ...state, isSaving: false, error: action.payload };
    case 'DELETE_WORKOUT_SUCCESS':
        return {
            ...state,
            workouts: state.workouts.filter(w => w.id !== action.payload),
            activeWorkout: state.activeWorkout?.id === action.payload ? null : state.activeWorkout,
        };
    default:
      return state;
  }
}
