import React from 'react';
import { Page, Workout, WorkoutBlock, Passkategori, CustomPage, StartGroup, UserRole, UserData, StudioConfig, Organization, WorkoutDiploma, InfoCarousel } from '../types';
import { HomeScreen } from './HomeScreen';
import { AIGeneratorScreen } from './AIGeneratorScreen';
import { FreestandingTimerScreen } from './FreestandingTimerScreen';
import { WorkoutBuilderScreen } from './WorkoutBuilderScreen';
import { SimpleWorkoutBuilderScreen } from './SimpleWorkoutBuilderScreen';
import { WorkoutListScreen } from './WorkoutListScreen';
import SavedWorkoutsScreen from './SavedWorkoutsScreen';
import { StudioSelectionScreen } from './StudioSelectionScreen';
import { RepsOnlyScreen } from './RepsOnlyScreen';
import { NotesScreen } from './NotesScreen';
import { HyroxScreen } from './HyroxScreen';
import { HyroxRaceListScreen } from './HyroxRaceListScreen';
import { HyroxRaceDetailScreen } from './HyroxRaceDetailScreen';
import { MemberManagementScreen } from './MemberManagementScreen';
import { AdminAnalyticsScreen } from './AdminAnalyticsScreen';
import { MemberProfileScreen } from './MemberProfileScreen';
import { CoachScreen } from './CoachScreen';
import { SuperAdminScreen } from './SuperAdminScreen';
import { SystemOwnerScreen } from './SystemOwnerScreen';
import { CustomContentScreen } from './CustomContentScreen';
import { CustomPageEditorScreen } from './CustomPageEditorScreen';
import { TimerScreen } from './TimerScreen';
import WorkoutDetailScreen from './WorkoutDetailScreen';
import { WarmupScreen } from './WarmupScreen';
import { WorkoutLogScreen } from '../mobile/screens/WorkoutLogScreen';

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
    activeWorkout: Workout | null;
    activeBlock: WorkoutBlock | null;
    
    passkategoriFilter: string | null;
    activeCustomPage: CustomPage | null;
    activeRaceId: string | null;
    racePrepState: { groups: StartGroup[]; interval: number } | null;
    followMeShowImage: boolean;
    mobileLogData: { workoutId: string, organizationId: string } | null;
    
    preferredAdminTab: string;
    profileEditTrigger: number;

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
    onDuplicateWorkout: (workout: Workout) => void;
    onTimerFinish: (finishData: { isNatural?: boolean; time?: number, raceId?: string }) => void;
    
    functions: {
        selectOrganization: (organization: Organization) => void;
        createOrganization: (name: string, subdomain: string) => Promise<void>;
        deleteOrganization: (organizationId: string) => Promise<void>;
        saveGlobalConfig: (organizationId: string, newConfig: StudioConfig) => Promise<void>;
        createStudio: (organizationId: string, name: string) => Promise<void>;
        updateStudio: (organizationId: string, studioId: string, name: string) => Promise<void>;
        deleteStudio: (organizationId: string, studioId: string) => Promise<void>;
        updatePasswords: (organizationId: string, passwords: Organization['passwords']) => Promise<void>;
        updateLogos: (organizationId: string, logos: { light: string; dark: string }) => Promise<void>;
        updatePrimaryColor: (organizationId: string, color: string) => Promise<void>;
        updateOrganization: (organizationId: string, name: string, subdomain: string, inviteCode?: string) => Promise<void>;
        updateCustomPages: (organizationId: string, customPages: CustomPage[]) => Promise<void>;
        updateInfoCarousel: (organizationId: string, infoCarousel: InfoCarousel) => Promise<void>;
        
        saveCustomPage: (pageData: CustomPage) => Promise<void>;
        deleteCustomPage: (pageId: string) => Promise<void>;
        editCustomPage: (page: CustomPage | null) => void;
        
        editStudioConfig: (studio: any) => void;
        switchToStudioView: (studio: any) => void;
        
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
        handleLogWorkoutRequest: (workoutId: string, orgId: string) => void;
    }
}

export const AppRouter: React.FC<AppRouterProps> = (props) => {
    const { 
        page, navigateTo, handleBack, role, userData, studioConfig, selectedOrganization, allOrganizations, isStudioMode, isImpersonating, theme,
        workouts, activeWorkout, activeBlock,
        passkategoriFilter, activeCustomPage, activeRaceId, racePrepState, followMeShowImage, mobileLogData,
        preferredAdminTab, profileEditTrigger,
        onSelectWorkout, onSelectPasskategori, onCreateNewWorkout, onStartBlock, onEditWorkout, onDeleteWorkout, onSaveWorkout, onSaveWorkoutNoNav,
        onTogglePublish, onToggleFavorite, onDuplicateWorkout, onTimerFinish,
        functions
    } = props;

    switch (page) {
        case Page.Home:
            return <HomeScreen 
                navigateTo={navigateTo} 
                onSelectWorkout={onSelectWorkout} 
                onSelectPasskategori={onSelectPasskategori}
                savedWorkouts={workouts.filter(w => w.isFavorite || (!w.isPublished && !w.isMemberDraft))}
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
                workouts={workouts.filter(w => w.isFavorite || (!w.isPublished && !w.isMemberDraft))}
                onSelectWorkout={onSelectWorkout}
                onEditWorkout={onEditWorkout}
                onDeleteWorkout={onDeleteWorkout as any}
                onToggleFavorite={onToggleFavorite}
                onCreateNewWorkout={onCreateNewWorkout}
                isStudioMode={isStudioMode}
            />;

        case Page.WorkoutDetail:
            if (!activeWorkout) return <div>Inget pass valt</div>;
            // Check if it's a warm-up workout (usually short, one block, tag 'Uppvärmning')
            if (activeWorkout.blocks.length === 1 && activeWorkout.blocks[0].tag === 'Uppvärmning') {
                 return <WarmupScreen onStartWorkout={onStartBlock} />;
            }
            return <WorkoutDetailScreen 
                workout={activeWorkout} 
                onStartBlock={(block) => onStartBlock(block, activeWorkout)} 
                onUpdateBlockSettings={(blockId, settings) => { /* Implement update logic if needed locally or pass up */ }}
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
                onVisualize={() => { /* Visualize logic */ }}
                onLogWorkout={functions.handleLogWorkoutRequest}
                onClose={handleBack}
            />;

        case Page.Timer:
            if (!activeBlock) return <div>Inget block valt</div>;
            return <TimerScreen 
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
            />;

        case Page.FreestandingTimer:
            return <FreestandingTimerScreen onStart={functions.handleStartFreestandingTimer} />;

        case Page.AIGenerator:
            return <AIGeneratorScreen 
                onWorkoutGenerated={functions.handleGeneratedWorkout} 
                studioConfig={studioConfig}
                initialMode={props.passkategoriFilter ? 'generate' : 'generate'} // Simplified
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
            />;

        case Page.SimpleWorkoutBuilder:
            return <SimpleWorkoutBuilderScreen 
                initialWorkout={activeWorkout} 
                onSave={onSaveWorkout} 
                onCancel={handleBack}
            />;

        case Page.Coach:
            return <CoachScreen 
                role={role} 
                navigateTo={navigateTo}
                onSelectCustomPage={functions.handleSelectCustomPage}
                isImpersonating={isImpersonating}
                onReturnToAdmin={functions.handleReturnToAdmin}
                onAdminLogin={functions.handleCoachAccessRequest}
                onMemberProfileRequest={functions.handleMemberProfileRequest}
            />;

        case Page.IdeaBoard:
            return <NotesScreen 
                onWorkoutInterpreted={functions.handleWorkoutInterpreted}
                studioConfig={studioConfig}
                initialWorkoutToDraw={null} // Can pass activeWorkout if editing logic exists
                onBack={handleBack}
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
            />;

        case Page.HyroxRaceList:
            return <HyroxRaceListScreen onSelectRace={functions.handleSelectRace} />;

        case Page.HyroxRaceDetail:
            if (!activeRaceId) return <div>Inget lopp valt</div>;
            return <HyroxRaceDetailScreen raceId={activeRaceId} onBack={handleBack} />;

        case Page.MemberRegistry:
            return <MemberManagementScreen onSelectMember={(id) => { /* Handle member selection if needed */ }} />;

        case Page.MobileLog:
            if (!mobileLogData) return <div>Ingen data för loggning</div>;
            return <WorkoutLogScreen 
                workoutId={mobileLogData.workoutId} 
                organizationId={mobileLogData.organizationId} 
                onClose={handleBack}
                navigation={{ goBack: handleBack }}
                route={{ params: mobileLogData }}
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
            /> : <div>Laddar profil...</div>;

        case Page.CustomContent:
            if (!activeCustomPage) return <div>Sidan finns inte</div>;
            return <CustomContentScreen page={activeCustomPage} />;

        case Page.CustomPageEditor:
            return <CustomPageEditorScreen 
                onSave={functions.saveCustomPage} 
                onCancel={handleBack} 
                pageToEdit={props.activeCustomPage} // Using activeCustomPage as prop for editor
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
                onUpdatePrimaryColor={functions.updatePrimaryColor}
                onUpdateOrganization={functions.updateOrganization}
                onUpdateCustomPages={functions.updateCustomPages}
                onSwitchToStudioView={functions.switchToStudioView}
                onEditCustomPage={functions.editCustomPage}
                onDeleteCustomPage={functions.deleteCustomPage}
                onUpdateInfoCarousel={functions.updateInfoCarousel}
                onUpdateDisplayWindows={async () => {}} // Placeholder as it was not in functions prop
                workouts={workouts}
                workoutsLoading={false} // Assume loaded
                onSaveWorkout={onSaveWorkoutNoNav}
                onDeleteWorkout={onDeleteWorkout}
                onTogglePublish={onTogglePublish}
                onDuplicateWorkout={onDuplicateWorkout}
                onSelectMember={(id) => { /* ... */ }}
                onBack={functions.handleGoToSystemOwner}
                onGoToSystemOwner={functions.handleGoToSystemOwner}
                initialTab={preferredAdminTab}
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
};