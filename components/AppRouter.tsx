import React from 'react';
import { Page, Workout, WorkoutBlock, StudioConfig, Organization, CustomPage, UserRole, UserData, StartGroup } from '../types';

// --- Importera dina gamla komponenter ---
import { HomeScreen } from './HomeScreen';
import { CoachScreen } from './CoachScreen';
import { WorkoutListScreen } from './WorkoutListScreen';
import WorkoutDetailScreen from './WorkoutDetailScreen';
import { TimerScreen } from './TimerScreen';
import { SimpleWorkoutBuilderScreen } from './SimpleWorkoutBuilderScreen';
import { AIGeneratorScreen } from './AIGeneratorScreen';
import { HyroxScreen } from './HyroxScreen';
import { HyroxRaceListScreen } from './HyroxRaceListScreen';
import { HyroxRaceDetailScreen } from './HyroxRaceDetailScreen';
import { NotesScreen } from './NotesScreen';
import { FreestandingTimerScreen } from './FreestandingTimerScreen';
import SavedWorkoutsScreen from './SavedWorkoutsScreen';
import { CustomContentScreen } from './CustomContentScreen';
import { StudioSelectionScreen } from './StudioSelectionScreen';
import { SystemOwnerScreen } from './SystemOwnerScreen';
import { SuperAdminScreen } from './SuperAdminScreen';
import { WorkoutBuilderScreen } from './WorkoutBuilderScreen';
import { RepsOnlyScreen } from './RepsOnlyScreen';
import { CustomPageEditorScreen } from './CustomPageEditorScreen';

// --- DE NYA KOMPONENTERNA ---
import MemberProfileScreen from './MemberProfileScreen';
import MemberManagementScreen from './MemberManagementScreen';
import { AdminAnalyticsScreen } from './AdminAnalyticsScreen';
// OBS: Se till att sökvägen stämmer med var du la mappen (src/mobile/screens)
// Om du la mappen direkt i src, så blir importen:
import WorkoutLogScreen from '../mobile/screens/WorkoutLogScreen'; 

interface AppRouterProps {
    page: Page;
    navigateTo: (page: Page) => void;
    handleBack: () => void;
    
    // Data & Config
    role: UserRole;
    userData: UserData | null;
    studioConfig: StudioConfig;
    selectedOrganization: Organization | null;
    allOrganizations: Organization[];
    isStudioMode: boolean;
    isImpersonating: boolean;
    theme: string;
    
    // Workout Data
    workouts: Workout[];
    activeWorkout: Workout | null;
    activeBlock: WorkoutBlock | null;
    
    // UI State Helpers
    passkategoriFilter: string | null;
    activeCustomPage: CustomPage | null;
    activeRaceId: string | null;
    racePrepState: { groups: StartGroup[]; interval: number } | null;
    followMeShowImage: boolean;
    
    // --- NYTT FÖR LOGGNING ---
    mobileLogData?: { workoutId: string, organizationId: string } | null;

    // --- CALLBACKS FRÅN GAMLA APP.TSX ---
    onSelectWorkout: (workout: Workout) => void;
    onSelectPasskategori: (cat: string) => void;
    onCreateNewWorkout: () => void;
    onStartBlock: (block: WorkoutBlock, workout: Workout) => void;
    onEditWorkout: (workout: Workout, blockId?: string) => void;
    onDeleteWorkout: (id: string) => Promise<void>;
    onSaveWorkout: (workout: Workout, startFirstBlock?: boolean) => Promise<void>;
    onTogglePublish: (id: string, isPublished: boolean) => Promise<void>;
    onToggleFavorite: (id: string) => Promise<void>;
    onDuplicateWorkout: (workout: Workout) => void;
    
    // Admin functions
    functions: {
        selectOrganization: (org: Organization) => void;
        createOrganization: (name: string, subdomain: string) => Promise<void>;
        deleteOrganization: (id: string) => Promise<void>;
        saveGlobalConfig: (orgId: string, config: StudioConfig) => Promise<void>;
        createStudio: (orgId: string, name: string) => Promise<void>;
        updateStudio: (orgId: string, studioId: string, name: string) => Promise<void>;
        deleteStudio: (orgId: string, studioId: string) => Promise<void>;
        updatePasswords: (orgId: string, passwords: any) => Promise<void>;
        updateLogos: (orgId: string, logos: { light: string; dark: string }) => Promise<void>;
        updatePrimaryColor: (orgId: string, color: string) => Promise<void>;
        updateOrganization: (orgId: string, name: string, subdomain: string) => Promise<void>;
        updateCustomPages: (orgId: string, pages: CustomPage[]) => Promise<void>;
        updateInfoCarousel: (orgId: string, carousel: any) => Promise<void>;
        
        saveCustomPage: (page: CustomPage) => Promise<void>;
        deleteCustomPage: (id: string) => Promise<void>;
        editCustomPage: (page: CustomPage | null) => void;
        
        editStudioConfig: (studio: any) => void;
        switchToStudioView: (studio: any) => void;
        
        handleCoachAccessRequest: () => void;
        handleReturnToAdmin: () => void;
        setShowImage: (url: string | null) => void;
        setTimerHeaderVisible: (visible: boolean) => void;
        setBackButtonHidden: (hidden: boolean) => void;
        setRacePrepState: (state: any) => void;
        setCompletionInfo: (info: any) => void;
        setRegisteringHyroxTime: (val: boolean) => void;
        setFollowMeShowImage: (val: boolean) => void;
        
        handleGeneratedWorkout: (workout: Workout) => void;
        handleWorkoutInterpreted: (workout: Workout) => void;
        setAiGeneratorInitialTab: (tab: any) => void;
        setCustomBackHandler: (handler: any) => void;
        
        handleStartFreestandingTimer: (block: WorkoutBlock) => void;
        handleStartRace: (workout: Workout) => void;
        handleSelectRace: (id: string) => void;
        handleReturnToGroupPrep: () => void;
        handleSelectCustomPage: (page: CustomPage) => void;
    }
}

export const AppRouter: React.FC<AppRouterProps> = (props) => {
    const { 
        page, navigateTo, handleBack, role, userData, studioConfig, selectedOrganization, 
        workouts, activeWorkout, activeBlock, functions, theme
    } = props;

    switch (page) {
        case Page.Home:
            return <HomeScreen 
                navigateTo={navigateTo} 
                onSelectWorkout={props.onSelectWorkout} 
                onSelectPasskategori={props.onSelectPasskategori} 
                savedWorkouts={workouts} 
                onCreateNewWorkout={props.onCreateNewWorkout} 
                onShowBoostModal={() => {}} 
                studioConfig={studioConfig} 
                organizationLogoUrlLight={selectedOrganization?.logoUrlLight} 
                organizationLogoUrlDark={selectedOrganization?.logoUrlDark} 
                theme={theme} 
            />;
      
        case Page.Coach:
            return <CoachScreen 
                role={role} 
                navigateTo={navigateTo} 
                onSelectCustomPage={functions.handleSelectCustomPage}
                isImpersonating={props.isImpersonating}
                onReturnToAdmin={functions.handleReturnToAdmin} 
            />;

        case Page.WorkoutList:
            return props.passkategoriFilter ? <WorkoutListScreen 
                passkategori={props.passkategoriFilter}
                onSelectWorkout={props.onSelectWorkout}
            /> : null;

        case Page.WorkoutDetail:
            return activeWorkout ? <WorkoutDetailScreen 
                workout={activeWorkout} 
                onStartBlock={(block) => props.onStartBlock(block, activeWorkout)} 
                onUpdateBlockSettings={() => {}}
                onUpdateWorkout={(w) => props.onSaveWorkout(w)}
                onEditWorkout={props.onEditWorkout} 
                isCoachView={role !== 'member'}
                onTogglePublish={props.onTogglePublish}
                onToggleFavorite={props.onToggleFavorite}
                onDuplicate={props.onDuplicateWorkout}
                onShowImage={functions.setShowImage} 
                isPresentationMode={false}
                studioConfig={studioConfig}
                onDelete={props.onDeleteWorkout}
                followMeShowImage={props.followMeShowImage}
                setFollowMeShowImage={functions.setFollowMeShowImage}
                onVisualize={(w) => { /* IdeaBoard logic if needed */ }}
            /> : null;

        case Page.Timer:
            return activeBlock ? <TimerScreen 
                key={activeBlock.id} 
                block={activeBlock} 
                onFinish={(data) => {
                    // Logic handled in App.tsx callback if passed correctly
                }} 
                onHeaderVisibilityChange={functions.setTimerHeaderVisible} 
                onShowImage={functions.setShowImage} 
                setCompletionInfo={functions.setCompletionInfo}
                setIsRegisteringHyroxTime={functions.setRegisteringHyroxTime}
                setIsBackButtonHidden={functions.setBackButtonHidden}
                followMeShowImage={props.followMeShowImage}
                organization={selectedOrganization}
                onBackToGroups={functions.handleReturnToGroupPrep}
            /> : null;

        case Page.RepsOnly:
             return activeBlock ? <RepsOnlyScreen 
                block={activeBlock} 
                onFinish={() => {}} 
                onShowImage={functions.setShowImage} 
                organization={selectedOrganization} 
             /> : null;

        case Page.WorkoutBuilder:
            return <WorkoutBuilderScreen 
                initialWorkout={activeWorkout}
                onSave={props.onSaveWorkout} 
                onCancel={handleBack} 
                focusedBlockId={null} 
                studioConfig={studioConfig}
                sessionRole={role}
                isNewDraft={false}
            />;

        case Page.SimpleWorkoutBuilder:
            return <SimpleWorkoutBuilderScreen 
                initialWorkout={activeWorkout}
                onSave={props.onSaveWorkout} 
                onCancel={handleBack} 
            />;

        case Page.AIGenerator:
            return <AIGeneratorScreen 
                onWorkoutGenerated={functions.handleGeneratedWorkout} 
                onEditWorkout={props.onEditWorkout}
                onDeleteWorkout={props.onDeleteWorkout}
                onTogglePublish={props.onTogglePublish}
                onCreateNewWorkout={props.onCreateNewWorkout}
                initialMode={'create'}
                studioConfig={studioConfig}
                setCustomBackHandler={functions.setCustomBackHandler}
                workouts={workouts}
                workoutsLoading={false}
            />;

        case Page.Hyrox:
            return <HyroxScreen 
                navigateTo={navigateTo}
                onSelectWorkout={functions.handleStartRace}
                studioConfig={studioConfig}
                racePrepState={props.racePrepState}
                onPrepComplete={() => functions.setRacePrepState(null)}
            />;

        case Page.HyroxRaceList:
            return <HyroxRaceListScreen onSelectRace={functions.handleSelectRace} />;

        case Page.HyroxRaceDetail:
            return props.activeRaceId ? <HyroxRaceDetailScreen raceId={props.activeRaceId} onBack={handleBack} /> : null;

        case Page.IdeaBoard:
            return <NotesScreen 
                onWorkoutInterpreted={functions.handleWorkoutInterpreted}
                studioConfig={studioConfig}
                initialWorkoutToDraw={activeWorkout}
                onBack={handleBack}
            />;

        case Page.FreestandingTimer:
            return <FreestandingTimerScreen onStart={functions.handleStartFreestandingTimer} />;

        case Page.SavedWorkouts:
            return <SavedWorkoutsScreen 
                workouts={workouts.filter(w => w.isMemberDraft)} 
                onSelectWorkout={props.onSelectWorkout} 
                onEditWorkout={props.onEditWorkout}
                onDeleteWorkout={props.onDeleteWorkout}
                onToggleFavorite={props.onToggleFavorite}
                onCreateNewWorkout={props.onCreateNewWorkout}
                isStudioMode={props.isStudioMode}
            />;

        case Page.StudioSelection:
            return <StudioSelectionScreen onStudioSelected={handleBack} />;

        case Page.SystemOwner:
            return <SystemOwnerScreen 
                allOrganizations={props.allOrganizations}
                onSelectOrganization={functions.selectOrganization}
                onCreateOrganization={functions.createOrganization}
                onDeleteOrganization={functions.deleteOrganization}
            />;

        case Page.SuperAdmin:
            return selectedOrganization ? <SuperAdminScreen 
                organization={selectedOrganization}
                adminRole={userData?.adminRole || 'admin'}
                userRole={role}
                theme={theme}
                onSaveGlobalConfig={functions.saveGlobalConfig}
                onEditStudioConfig={functions.editStudioConfig}
                onCreateStudio={functions.createStudio}
                onUpdateStudio={functions.updateStudio}
                onDeleteStudio={functions.deleteStudio}
                onUpdatePasswords={functions.updatePasswords}
                onUpdateLogos={functions.updateLogos}
                onUpdatePrimaryColor={functions.updatePrimaryColor}
                onUpdateOrganization={functions.updateOrganization}
                onUpdateCustomPages={functions.updateCustomPages}
                onSwitchToStudioView={functions.switchToStudioView}
                onEditCustomPage={functions.editCustomPage}
                onDeleteCustomPage={functions.deleteCustomPage}
                onUpdateInfoCarousel={functions.updateInfoCarousel}
                onUpdateDisplayWindows={async () => {}} 
                workouts={workouts}
                workoutsLoading={false}
                onSaveWorkout={props.onSaveWorkout}
                onDeleteWorkout={props.onDeleteWorkout}
                onTogglePublish={props.onTogglePublish}
            /> : null;

        case Page.CustomContent:
            return props.activeCustomPage ? <CustomContentScreen page={props.activeCustomPage} /> : null;
            
        case Page.CustomPageEditor:
            return <CustomPageEditorScreen
                  onSave={functions.saveCustomPage}
                  onCancel={handleBack}
                  pageToEdit={null} 
             />

        // --- HÄR ÄR DE NYA SIDORNA ---
        
        case Page.MemberRegistry:
            return <MemberManagementScreen 
                organizationId={selectedOrganization?.id || ''}
                goBack={() => navigateTo(Page.Coach)}
            />;
            
        case Page.MemberProfile:
            return userData ? <MemberProfileScreen 
                userData={userData}
                goBack={handleBack}
            /> : <div>Laddar profil...</div>;

        case Page.AdminAnalytics:
            return <AdminAnalyticsScreen />;

        case Page.MobileLog:
             return props.mobileLogData ? (
                 <WorkoutLogScreen 
                    workoutId={props.mobileLogData.workoutId} 
                    organizationId={props.mobileLogData.organizationId} 
                    onClose={() => navigateTo(Page.Home)}
                 /> 
             ) : <div>Laddar loggning...</div>;

        default:
            return <div>Sidan hittades inte</div>;
    }
};