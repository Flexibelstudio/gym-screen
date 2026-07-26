
import React, { Suspense, lazy } from 'react';
import { Page, Workout, WorkoutBlock, Passkategori, CustomPage, StartGroup, UserRole, UserData, StudioConfig, Organization, WorkoutDiploma, InfoCarousel } from '../types';

// Statically imported HOT PATHS (zero loading delay, real-time critical)
import { HomeScreen } from './HomeScreen';
import { WorkoutListScreen } from './WorkoutListScreen';
import SavedWorkoutsScreen from './SavedWorkoutsScreen';
import WorkoutDetailScreen from './WorkoutDetailScreen';
import { TimerScreen } from './TimerScreen';
import { RepsOnlyScreen } from './RepsOnlyScreen';
import { WarmupScreen } from './WarmupScreen';
import { WorkoutLogScreen } from '../mobile/screens/WorkoutLogScreen';
import { MemberProfileScreen } from './MemberProfileScreen';

// Lazy loaded COLD / HEAVY PATHS
const AIGeneratorScreen = lazy(() => import('./AIGeneratorScreen').then(m => ({ default: m.AIGeneratorScreen })));
const FreestandingTimerScreen = lazy(() => import('./FreestandingTimerScreen').then(m => ({ default: m.FreestandingTimerScreen })));
const WorkoutBuilderScreen = lazy(() => import('./WorkoutBuilderScreen').then(m => ({ default: m.WorkoutBuilderScreen })));
const SimpleWorkoutBuilderScreen = lazy(() => import('./SimpleWorkoutBuilderScreen').then(m => ({ default: m.SimpleWorkoutBuilderScreen })));
const StudioSelectionScreen = lazy(() => import('./StudioSelectionScreen').then(m => ({ default: m.StudioSelectionScreen })));
const NotesScreen = lazy(() => import('./NotesScreen').then(m => ({ default: m.NotesScreen })));
const HyroxScreen = lazy(() => import('./HyroxScreen').then(m => ({ default: m.HyroxScreen })));
const HyroxRaceListScreen = lazy(() => import('./HyroxRaceListScreen').then(m => ({ default: m.HyroxRaceListScreen })));
const HyroxRaceDetailScreen = lazy(() => import('./HyroxRaceDetailScreen').then(m => ({ default: m.HyroxRaceDetailScreen })));
const MemberManagementScreen = lazy(() => import('./MemberManagementScreen').then(m => ({ default: m.MemberManagementScreen })));
const AdminAnalyticsScreen = lazy(() => import('./AdminAnalyticsScreen').then(m => ({ default: m.AdminAnalyticsScreen })));
const CoachScreen = lazy(() => import('./CoachScreen').then(m => ({ default: m.CoachScreen })));
const CoachNotesScreen = lazy(() => import('./CoachNotesScreen').then(m => ({ default: m.CoachNotesScreen })));
const SuperAdminScreen = lazy(() => import('./SuperAdminScreen').then(m => ({ default: m.SuperAdminScreen })));
const SystemOwnerScreen = lazy(() => import('./SystemOwnerScreen').then(m => ({ default: m.SystemOwnerScreen })));
const CustomContentScreen = lazy(() => import('./CustomContentScreen').then(m => ({ default: m.CustomContentScreen })));
const CustomPageEditorScreen = lazy(() => import('./CustomPageEditorScreen').then(m => ({ default: m.CustomPageEditorScreen })));
const WorkoutGamesHubScreen = lazy(() => import('./games/WorkoutGamesHubScreen').then(m => ({ default: m.WorkoutGamesHubScreen })));

const ViewFallback: React.FC = () => (
    <div className="flex flex-col items-center justify-center min-h-[50vh] w-full p-8 text-center">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
        <span className="text-sm font-medium text-gray-400">Laddar vy...</span>
    </div>
);

interface AppRouterProps {
    page: Page;
    navigateTo: (page: Page) => void;
    handleBack: () => void;
    role: UserRole;
    userData: UserData | null;
    studioConfig: StudioConfig;
    selectedOrganization: Organization | null;
    allOrganizations: Organization[];
    isStudioMode: boolean;
    isImpersonating: boolean;
    theme: string;
    
    workouts: Workout[];
    customPrograms?: Workout[];
    activeWorkout: Workout | null;
    activeBlock: WorkoutBlock | null;
    
    passkategoriFilter: string | null;
    activeCustomPage: CustomPage | null;
    customPageToEdit: CustomPage | null;
    activeRaceId: string | null;
    isEditingNewDraft: boolean;
    racePrepState: { groups: StartGroup[]; interval: number } | null;
    followMeShowImage: boolean;
    mobileLogData: { workoutId: string, organizationId: string } | null;
    
    preferredAdminTab: string;
    profileEditTrigger: number;
    isAutoTransition: boolean;

    // NEW: Remote command
    remoteCommand?: { type: string, timestamp: number } | null;
    selectedStudio?: any;

    onSelectWorkout: (workout: Workout, action?: 'view' | 'log') => void;
    onSelectPasskategori: (passkategori: Passkategori) => void;
    onCreateNewWorkout: () => void;
    onStartBlock: (block: WorkoutBlock, workoutContext: Workout) => void;
    onEditWorkout: (workout: Workout, blockId?: string) => void;
    onDeleteWorkout: (workoutId: string) => Promise<void>;
    onSaveWorkout: (workout: Workout, startFirstBlock?: boolean) => Promise<void>;
    onSaveWorkoutNoNav: (workout: Workout) => Promise<Workout>;
    onTogglePublish: (workoutId: string, isPublished: boolean) => void;
    onToggleFavorite: (workoutId: string) => void;
    onDuplicateWorkout: (workout: Workout, origin?: string) => void;
    onTimerFinish: (finishData: { isNatural?: boolean; time?: number, raceId?: string }) => void;
    
    functions: {
        selectOrganization: (organization: Organization) => void;
        createOrganization: (name: string, subdomain: string) => Promise<void>;
        deleteOrganization: (organizationId: string) => Promise<void>;
        saveGlobalConfig: (organizationId: string, newConfig: StudioConfig) => Promise<void>;
        createStudio: (organizationId: string, name: string, locationId?: string) => Promise<void>;
        updateStudio: (organizationId: string, studioId: string, name: string, locationId?: string) => Promise<void>;
        deleteStudio: (organizationId: string, studioId: string) => Promise<void>;
        updatePasswords: (organizationId: string, passwords: Organization['passwords']) => Promise<void>;
        updateLogos: (organizationId: string, logos: { light: string; dark: string }) => Promise<void>;
        updateFavicon: (organizationId: string, faviconUrl: string) => Promise<void>;
        updateAppIcon: (organizationId: string, appIconUrl: string) => Promise<void>;
        updatePrimaryColor: (organizationId: string, color: string) => Promise<void>;
        updateOrganization: (organizationId: string, name: string, subdomain: string, inviteCode?: string, coachCode?: string, maxFreeCoaches?: number) => Promise<void>;
        updateCustomPages: (organizationId: string, customPages: CustomPage[]) => Promise<void>;
        updateInfoCarousel: (organizationId: string, infoCarousel: InfoCarousel) => Promise<void>;
        
        saveCustomPage: (pageData: CustomPage) => Promise<void>;
        deleteCustomPage: (pageId: string) => Promise<void>;
        editCustomPage: (page: CustomPage | null) => void;
        
        editStudioConfig: (studio: any) => void;
        switchToStudioView: (studio: any) => void;
        lockStudioDevice?: (studio: any) => void;
        
        handleCoachAccessRequest: () => void;
        handleReturnToAdmin: () => void;
        handleGoToSystemOwner: () => void;
        setShowImage: (url: string) => void;
        setTimerHeaderVisible: (visible: boolean) => void;
        setBackButtonHidden: (hidden: boolean) => void;
        setRacePrepState: (state: any) => void;
        setCompletionInfo: (info: any) => void;
        setRegisteringHyroxTime: (registering: boolean) => void;
        setFollowMeShowImage: (show: boolean) => void;
        
        handleGeneratedWorkout: (workout: Workout) => void;
        handleWorkoutInterpreted: (workout: Workout) => void;
        handleAdjustWorkout: (workout: Workout) => void;
        setAiGeneratorInitialTab: (tab: any) => void;
        setCustomBackHandler: (handler: any) => void;
        
        handleStartFreestandingTimer: (block: WorkoutBlock) => void;
        handleStartRace: (workout: Workout) => void;
        handleSelectRace: (raceId: string) => void;
        handleReturnToGroupPrep: () => void;
        handleSelectCustomPage: (page: CustomPage) => void;
        
        handleMemberProfileRequest: () => void;
        handleEditProfileRequest: () => void;
        handleLogWorkoutRequest: (workoutId: string, orgId: string) => void;
        checkUnsavedChanges: () => boolean;
    }
}

export const AppRouter: React.FC<AppRouterProps> = (props) => {
    const { 
        page, navigateTo, handleBack, role, userData, studioConfig, selectedOrganization, allOrganizations, isStudioMode, isImpersonating, theme,
        workouts, customPrograms = [], activeWorkout, activeBlock,
        passkategoriFilter, activeCustomPage, customPageToEdit, activeRaceId, racePrepState, followMeShowImage, mobileLogData,
        preferredAdminTab, profileEditTrigger, isAutoTransition, remoteCommand, selectedStudio,
        onSelectWorkout, onSelectPasskategori, onCreateNewWorkout, onStartBlock, onEditWorkout, onDeleteWorkout, onSaveWorkout, onSaveWorkoutNoNav,
        onTogglePublish, onToggleFavorite, onDuplicateWorkout, onTimerFinish,
        functions
    } = props;

    return (
        <Suspense fallback={<ViewFallback />}>
            {(() => {
                switch (page) {
                    case Page.Home:
                        return <HomeScreen 
                            navigateTo={navigateTo} 
                            onSelectWorkout={onSelectWorkout} 
                            onSelectPasskategori={onSelectPasskategori}
                            savedWorkouts={workouts.filter(w => w.isFavorite || (w.isMemberDraft && !w.isPublished))}
                            onCreateNewWorkout={onCreateNewWorkout}
                            onShowBoostModal={() => {}} 
                            studioConfig={studioConfig}
                            organizationLogoUrlLight={selectedOrganization?.logoUrlLight}
                            organizationLogoUrlDark={selectedOrganization?.logoUrlDark}
                            theme={theme}
                        />;

                    case Page.WorkoutList:
                        return <WorkoutListScreen 
                            passkategori={passkategoriFilter || undefined}
                            onSelectWorkout={onSelectWorkout}
                        />;

                    case Page.SavedWorkouts:
                        return <SavedWorkoutsScreen 
                            workouts={workouts.filter(w => {
                                const isSaved = w.isFavorite || (w.isMemberDraft && !w.isPublished);
                                if (!isSaved) return false;

                                const categoryConfig = studioConfig.customCategories.find(c => c.name === w.category);
                                const isCategoryLocked = categoryConfig?.isLocked === true;

                                if (isStudioMode) {
                                    if (w.showInStudio === false) return false;
                                } else {
                                    if (w.showInApp === false) return false;
                                    if (isCategoryLocked) return false;
                                }

                                return true;
                            })}
                            onSelectWorkout={onSelectWorkout}
                            onEditWorkout={onEditWorkout}
                            onDeleteWorkout={onDeleteWorkout as any}
                            onToggleFavorite={onToggleFavorite}
                            onCreateNewWorkout={onCreateNewWorkout}
                            isStudioMode={isStudioMode}
                        />;

                    case Page.WorkoutDetail:
                        if (!activeWorkout) return <div>Inget pass valt</div>;
                        // Prevent flickering for freestanding timers
                        if (activeWorkout.id.startsWith('freestanding-workout-') || activeWorkout.id.startsWith('fs-workout-')) {
                            return <div className="flex items-center justify-center h-screen bg-black text-white">Laddar timer...</div>;
                        }
                        const isOwnProgram = customPrograms.some(cp => cp.id === activeWorkout.id);
                        return <WorkoutDetailScreen 
                            workout={activeWorkout} 
                            onStartBlock={(block, workout) => onStartBlock(block, workout)} 
                            onUpdateBlockSettings={() => {}}
                            onEditWorkout={onEditWorkout} 
                            onAdjustWorkout={functions.handleAdjustWorkout}
                            isCoachView={isStudioMode || role === 'coach' || role === 'organizationadmin' || role === 'systemowner'}
                            onTogglePublish={onTogglePublish}
                            onToggleFavorite={onToggleFavorite}
                            onDuplicate={onDuplicateWorkout}
                            onShowImage={functions.setShowImage} 
                            isPresentationMode={false}
                            studioConfig={studioConfig}
                            onDelete={onDeleteWorkout as any}
                            followMeShowImage={followMeShowImage}
                            setFollowMeShowImage={functions.setFollowMeShowImage}
                            onUpdateWorkout={onSaveWorkoutNoNav}
                            onVisualize={() => {}}
                            onLogWorkout={functions.handleLogWorkoutRequest}
                            onClose={handleBack}
                            onHeaderVisibilityChange={functions.setTimerHeaderVisible}
                            isOwnProgram={isOwnProgram}
                        />;

                    case Page.Timer:
                        if (!activeBlock) return <div>Inget block valt</div>;
                        return <TimerScreen 
                            key={activeBlock.id}
                            block={activeBlock}
                            onFinish={onTimerFinish}
                            onHeaderVisibilityChange={functions.setTimerHeaderVisible}
                            onShowImage={functions.setShowImage}
                            setCompletionInfo={functions.setCompletionInfo}
                            setIsRegisteringHyroxTime={functions.setRegisteringHyroxTime}
                            setIsBackButtonHidden={functions.setBackButtonHidden}
                            followMeShowImage={followMeShowImage}
                            organization={selectedOrganization}
                            onBackToGroups={functions.handleReturnToGroupPrep}
                            isAutoTransition={isAutoTransition}
                            // Pass command to TimerScreen
                            remoteCommand={remoteCommand}
                        />;

                    case Page.FreestandingTimer:
                        return <FreestandingTimerScreen 
                            onStart={functions.handleStartFreestandingTimer} 
                            onCancel={handleBack}
                        />;

                    case Page.AIGenerator:
                        return <AIGeneratorScreen 
                            onWorkoutGenerated={functions.handleGeneratedWorkout} 
                            studioConfig={studioConfig}
                            initialMode="generate"
                            setCustomBackHandler={functions.setCustomBackHandler}
                            workouts={workouts}
                        />;

                    case Page.WorkoutBuilder:
                        return <WorkoutBuilderScreen 
                            initialWorkout={activeWorkout} 
                            onSave={onSaveWorkout} 
                            onCancel={handleBack}
                            studioConfig={studioConfig}
                            sessionRole={role}
                            setCustomBackHandler={functions.setCustomBackHandler}
                            isNewDraft={props.isEditingNewDraft}
                            isAdminView={!isStudioMode}
                        />;

                    case Page.SimpleWorkoutBuilder:
                        return <SimpleWorkoutBuilderScreen 
                            initialWorkout={activeWorkout} 
                            onSave={onSaveWorkout} 
                            onCancel={handleBack}
                            isNewDraft={props.isEditingNewDraft}
                            isAdminView={!isStudioMode}
                            setCustomBackHandler={functions.setCustomBackHandler}
                        />;

                    case Page.Coach:
                        return <CoachScreen 
                            role={role} 
                            isStudioMode={isStudioMode}
                            navigateTo={navigateTo}
                            onSelectCustomPage={functions.handleSelectCustomPage}
                            isImpersonating={isImpersonating}
                            onReturnToAdmin={functions.handleReturnToAdmin}
                            onAdminLogin={functions.handleCoachAccessRequest}
                            onMemberProfileRequest={functions.handleMemberProfileRequest}
                        />;

                    case Page.CoachNotes:
                        return <CoachNotesScreen onBack={handleBack} onWorkoutInterpreted={functions.handleGeneratedWorkout} />;

                    case Page.IdeaBoard:
                        return <NotesScreen 
                            onWorkoutInterpreted={functions.handleWorkoutInterpreted}
                            studioConfig={studioConfig}
                            initialWorkoutToDraw={null}
                            onBack={handleBack}
                            remoteCommand={remoteCommand}
                        />;

                    case Page.RepsOnly:
                        if (!activeBlock) return <div>Inget block valt</div>;
                        return <RepsOnlyScreen 
                            block={activeBlock} 
                            onFinish={() => onTimerFinish({ isNatural: true })}
                            onShowImage={functions.setShowImage}
                            organization={selectedOrganization}
                        />;

                    case Page.Hyrox:
                        return <HyroxScreen 
                            navigateTo={navigateTo}
                            onSelectWorkout={functions.handleStartRace}
                            studioConfig={studioConfig}
                            racePrepState={racePrepState}
                            onPrepComplete={() => {}}
                            remoteCommand={remoteCommand}
                            isStudioMode={isStudioMode}
                        />;

                    case Page.HyroxRaceList:
                        return <HyroxRaceListScreen onSelectRace={functions.handleSelectRace} />;

                    case Page.HyroxRaceDetail:
                        if (!activeRaceId) return <div>Inget lopp valt</div>;
                        return <HyroxRaceDetailScreen raceId={activeRaceId} onBack={handleBack} />;

                    case Page.WorkoutGamesHub:
                        return <WorkoutGamesHubScreen 
                            onBack={handleBack} 
                            setCustomBackHandler={functions.setCustomBackHandler}
                        />;

                    case Page.MemberRegistry:
                        return <MemberManagementScreen onSelectMember={() => {}} />;

                    case Page.MobileLog:
                        if (!mobileLogData) return <div>Ingen data för loggning</div>;
                        return <WorkoutLogScreen 
                            workoutId={mobileLogData.workoutId} 
                            organizationId={mobileLogData.organizationId} 
                            onClose={handleBack}
                            navigation={{ goBack: handleBack }}
                            route={{ params: mobileLogData }}
                            workouts={workouts}
                        />;

                    case Page.AdminAnalytics:
                        return <AdminAnalyticsScreen />;

                    case Page.MemberProfile:
                        return userData ? <MemberProfileScreen 
                            userData={userData}
                            onBack={handleBack}
                            profileEditTrigger={profileEditTrigger}
                            navigateTo={navigateTo}
                            functions={functions}
                            studioConfig={studioConfig}
                        /> : <div>Laddar profil...</div>;

                    case Page.CustomContent:
                        if (!activeCustomPage) return <div>Sidan finns inte</div>;
                        return <CustomContentScreen page={activeCustomPage} />;

                    case Page.CustomPageEditor:
                        return <CustomPageEditorScreen 
                            onSave={functions.saveCustomPage} 
                            onCancel={handleBack} 
                            pageToEdit={customPageToEdit}
                            setCustomBackHandler={functions.setCustomBackHandler}
                        />;

                    case Page.SuperAdmin:
                        if (!selectedOrganization) return <div>Ingen organisation vald</div>;
                        return <SuperAdminScreen 
                            organization={selectedOrganization}
                            adminRole={role === 'systemowner' ? 'superadmin' : 'admin'}
                            userRole={role}
                            theme={theme}
                            onSaveGlobalConfig={functions.saveGlobalConfig}
                            onEditStudioConfig={functions.editStudioConfig}
                            onCreateStudio={functions.createStudio}
                            onUpdateStudio={functions.updateStudio}
                            onDeleteStudio={functions.deleteStudio}
                            onUpdatePasswords={functions.updatePasswords}
                            onUpdateLogos={functions.updateLogos}
                            onUpdateFavicon={functions.updateFavicon}
                            onUpdateAppIcon={functions.updateAppIcon}
                            onUpdatePrimaryColor={functions.updatePrimaryColor}
                            onUpdateOrganization={functions.updateOrganization}
                            onUpdateCustomPages={functions.updateCustomPages}
                            onSwitchToStudioView={functions.switchToStudioView}
                            onLockStudioDevice={functions.lockStudioDevice}
                            onEditCustomPage={functions.editCustomPage}
                            onDeleteCustomPage={functions.deleteCustomPage}
                            onUpdateInfoCarousel={functions.updateInfoCarousel}
                            onUpdateDisplayWindows={async () => {}}
                            workouts={workouts}
                            workoutsLoading={false}
                            onSaveWorkout={onSaveWorkoutNoNav}
                            onDeleteWorkout={onDeleteWorkout}
                            onTogglePublish={onTogglePublish}
                            onDuplicateWorkout={onDuplicateWorkout}
                            onSelectMember={() => {}}
                            onBack={handleBack}
                            onGoToSystemOwner={functions.handleGoToSystemOwner}
                            initialTab={preferredAdminTab}
                            setCustomBackHandler={functions.setCustomBackHandler}
                            checkUnsavedChanges={functions.checkUnsavedChanges}
                        />;

                    case Page.SystemOwner:
                        return <SystemOwnerScreen 
                            allOrganizations={allOrganizations}
                            onSelectOrganization={functions.selectOrganization}
                            onCreateOrganization={functions.createOrganization}
                            onDeleteOrganization={functions.deleteOrganization as any}
                        />;

                    case Page.StudioSelection:
                        return <StudioSelectionScreen onStudioSelected={() => {}} />;

                    default:
                        return <div>Sidan hittades inte</div>;
                }
            })()}
        </Suspense>
    );
};
