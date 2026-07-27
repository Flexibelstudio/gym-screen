
import React, { useState, useEffect, useMemo } from 'react';
import { Member, UserRole, WorkoutLog } from '../types';
import { UsersIcon, PencilIcon, ChartBarIcon, SearchIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, QrCodeIcon, CopyIcon } from './icons';
import { MemberDetailModal } from './MemberDetailModal';
import { PrintablePoster } from './PrintablePoster';
import { useStudio } from '../context/StudioContext';
import { listenToMembers, updateMemberEndDate, updateUserRoleCloud, approveCoach, updateOrganization, updateUserProfile, getOrganizationLogsSince } from '../services/firebaseService';
import QRCode from 'react-qr-code';
import QRCodePNG from 'qrcode';
import { Modal } from './ui/Modal';
import { useAuth } from '../context/AuthContext';
import { Toast } from './ui/ToastNotification';
import { calculateAge, formatBirthday, isBirthdayToday } from '../utils/dateUtils';
import { buildRadar, RadarFlag, MemberRadarResult, RadarResultItem } from '../utils/coachRadar';

const LocationInviteCard: React.FC<{
    locationName: string;
    inviteCode: string;
    orgName: string;
    onCopy: (text: string) => void;
}> = ({ locationName, inviteCode, orgName, onCopy }) => {
    const [qrUrl, setQrUrl] = useState<string>('');
    const joinUrl = `${window.location.origin}/?invite=${inviteCode}`;

    useEffect(() => {
        if (inviteCode) {
            QRCodePNG.toDataURL(joinUrl, { width: 400, margin: 2 })
                .then(setQrUrl)
                .catch(console.error);
        }
    }, [joinUrl, inviteCode]);

    const handleDownload = async () => {
        try {
            const highResUrl = await QRCodePNG.toDataURL(joinUrl, { width: 1600, margin: 2 });
            const a = document.createElement('a');
            a.href = highResUrl;
            a.download = `QR-Bli-Medlem-${orgName.replace(/\s+/g, '-')}-${locationName.replace(/\s+/g, '-')}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (err) {
            console.error('QR download failed', err);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row gap-6 items-center justify-between">
            <div className="space-y-3 flex-1 min-w-0 w-full">
                <div className="flex items-center gap-2">
                    <h4 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{locationName}</h4>
                    <span className="bg-primary/10 text-primary text-xs font-black uppercase px-2.5 py-1 rounded-lg border border-primary/20">
                        Kod: {inviteCode}
                    </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Länk och QR-kod för registrering av medlemmar till {locationName}.
                </p>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 w-full">
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate flex-1">{joinUrl}</span>
                    <button
                        onClick={() => onCopy(joinUrl)}
                        className="bg-primary hover:brightness-110 text-white font-black text-xs px-3 py-2 rounded-lg transition-all flex-shrink-0 flex items-center gap-1 uppercase tracking-wider"
                    >
                        <CopyIcon className="w-3.5 h-3.5" /> Kopiera
                    </button>
                </div>
            </div>

            {qrUrl && (
                <div className="flex flex-col items-center gap-2 flex-shrink-0 bg-gray-50 dark:bg-gray-900/60 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 w-full sm:w-auto">
                    <img src={qrUrl} alt={`QR kod ${locationName}`} className="w-28 h-28 rounded-xl bg-white p-2 border border-gray-200 shadow-sm" />
                    <button
                        onClick={handleDownload}
                        className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:brightness-125 font-black text-[10px] px-3 py-2 rounded-xl uppercase tracking-wider transition-all shadow-md w-full text-center"
                    >
                        ⬇ Ladda ner QR (PNG)
                    </button>
                </div>
            )}
        </div>
    );
};

const generateInviteCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

interface MemberManagementScreenProps {
    onSelectMember?: (memberId: string) => void;
}

type RoleFilter = 'all' | 'training' | 'coach' | 'admin';

const ITEMS_PER_PAGE = 25;

const RoleSwitcher: React.FC<{ 
    currentRole: UserRole; 
    status?: string;
    memberId: string; 
    isUpdating: boolean;
    onUpdate: (role: UserRole) => void;
    canEdit: boolean;
}> = ({ currentRole, status, memberId, isUpdating, onUpdate, canEdit }) => {
    
    const handleClick = (e: React.MouseEvent) => e.stopPropagation();

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        e.stopPropagation();
        onUpdate(e.target.value as UserRole);
    };

    const getStyle = (r: UserRole) => {
        if (status === 'pending_coach') return "bg-yellow-100 text-yellow-700 border-yellow-200";
        switch (r) {
            case 'systemowner': return "bg-purple-100 text-purple-700 border-purple-200";
            case 'organizationadmin': return "bg-indigo-100 text-indigo-700 border-indigo-200";
            case 'coach': return "bg-emerald-100 text-emerald-700 border-emerald-200";
            default: return "bg-gray-100 text-gray-500 border-gray-200";
        }
    };

    const getLabel = (r: UserRole) => {
        if (status === 'pending_coach') return "Väntande Coach";
        switch (r) {
            case 'systemowner': return "Systemägare";
            case 'organizationadmin': return "Admin";
            case 'coach': return "Coach";
            default: return "Medlem";
        }
    };

    if (currentRole === 'systemowner' || !canEdit) {
        return (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border shadow-sm ${getStyle(currentRole)}`}>
                {getLabel(currentRole)}
            </span>
        );
    }

    return (
        <div className="relative inline-block" onClick={handleClick}>
            <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border shadow-sm cursor-pointer transition-all hover:brightness-95 ${getStyle(currentRole)}`}>
                {isUpdating ? (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1"></div>
                ) : (
                    <span>{getLabel(currentRole)}</span>
                )}
                {!isUpdating && <ChevronDownIcon className="w-3 h-3 opacity-70" />}
            </div>
            <select
                value={currentRole}
                onChange={handleChange}
                disabled={isUpdating}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none bg-transparent text-black"
            >
                <option value="member" className="text-black bg-white">Medlem</option>
                <option value="coach" className="text-black bg-white">Coach</option>
                <option value="organizationadmin" className="text-black bg-white">Admin</option>
            </select>
        </div>
    );
};

const LocationSwitcher: React.FC<{ 
    currentLocationId?: string; 
    memberId: string; 
    isUpdating: boolean;
    locations: { id: string, name: string }[];
    onUpdate: (locationId: string) => void;
    canEdit: boolean;
}> = ({ currentLocationId, memberId, isUpdating, locations, onUpdate, canEdit }) => {
    const handleClick = (e: React.MouseEvent) => e.stopPropagation();

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        e.stopPropagation();
        onUpdate(e.target.value);
    };

    if (locations.length === 0) return null;

    const currentLoc = locations.find(l => l.id === currentLocationId);
    const resolvedLocId = currentLoc ? currentLoc.id : (locations.length > 0 ? locations[0].id : '');
    const label = currentLoc ? currentLoc.name : (locations.length > 0 ? locations[0].name : "Saknar Ort");
    const labelClass = currentLoc ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-gray-100 text-gray-500 border-gray-200";

    if (!canEdit) {
        return (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border shadow-sm ${labelClass}`}>
                {label}
            </span>
        );
    }

    return (
        <div className="relative inline-block" onClick={handleClick}>
            <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border shadow-sm cursor-pointer transition-all hover:brightness-95 ${labelClass}`}>
                {isUpdating ? (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1"></div>
                ) : (
                    <span className="max-w-[100px] truncate">{label}</span>
                )}
                {!isUpdating && <ChevronDownIcon className="w-3 h-3 opacity-70" />}
            </div>
            <select
                value={resolvedLocId}
                onChange={handleChange}
                disabled={isUpdating}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none bg-transparent text-black"
            >
                {locations.map(loc => (
                    <option key={loc.id} value={loc.id} className="text-black bg-white">{loc.name}</option>
                ))}
            </select>
        </div>
    );
};

const RADAR_FLAGS_ORDER: RadarFlag[] = ['never_started', 'gone', 'lost_tempo', 'plateau', 'celebrate'];

const RADAR_GROUP_CONFIG: Record<RadarFlag, {
    title: string;
    badgeStyle: string;
    headerStyle: string;
    cardStyle: string;
}> = {
    never_started: {
        title: 'Aldrig kommit igång',
        badgeStyle: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/50',
        headerStyle: 'text-amber-800 dark:text-amber-300',
        cardStyle: 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/60 dark:border-amber-900/30 hover:border-amber-300 dark:hover:border-amber-700/50'
    },
    gone: {
        title: 'Borta',
        badgeStyle: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/50',
        headerStyle: 'text-amber-800 dark:text-amber-300',
        cardStyle: 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/60 dark:border-amber-900/30 hover:border-amber-300 dark:hover:border-amber-700/50'
    },
    lost_tempo: {
        title: 'Tappat tempo',
        badgeStyle: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800/50',
        headerStyle: 'text-yellow-800 dark:text-yellow-300',
        cardStyle: 'bg-yellow-50/30 dark:bg-yellow-950/10 border-yellow-200/50 dark:border-yellow-900/30 hover:border-yellow-300 dark:hover:border-yellow-700/50'
    },
    plateau: {
        title: 'Står stilla',
        badgeStyle: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/50',
        headerStyle: 'text-blue-800 dark:text-blue-300',
        cardStyle: 'bg-blue-50/30 dark:bg-blue-950/10 border-blue-200/50 dark:border-blue-900/30 hover:border-blue-300 dark:hover:border-blue-700/50'
    },
    celebrate: {
        title: 'Fira!',
        badgeStyle: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50',
        headerStyle: 'text-emerald-800 dark:text-emerald-300',
        cardStyle: 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200/50 dark:border-emerald-900/30 hover:border-emerald-300 dark:hover:border-emerald-700/50'
    }
};

interface CoachRadarSectionProps {
    members: Member[];
    organizationId?: string;
    locations?: { id: string; name: string }[];
    onSelectMember: (member: Member) => void;
    isStaff: boolean;
}

const CoachRadarSection: React.FC<CoachRadarSectionProps> = ({
    members,
    organizationId,
    locations,
    onSelectMember,
    isStaff
}) => {
    const [hasAnalyzed, setHasAnalyzed] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [radarResults, setRadarResults] = useState<RadarResultItem[]>([]);
    const [analyzedMembersCount, setAnalyzedMembersCount] = useState(0);
    const [fetchedLogsCount, setFetchedLogsCount] = useState(0);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    if (!isStaff) return null;

    const handleAnalyze = async () => {
        if (!organizationId) return;
        setIsAnalyzing(true);
        setAnalysisError(null);
        try {
            const sixtyThreeDaysAgoMs = Date.now() - 63 * 24 * 60 * 60 * 1000;
            const logs = await getOrganizationLogsSince(organizationId, sixtyThreeDaysAgoMs);

            const logsByMemberId: Record<string, WorkoutLog[]> = {};
            logs.forEach(log => {
                if (log.memberId) {
                    if (!logsByMemberId[log.memberId]) logsByMemberId[log.memberId] = [];
                    logsByMemberId[log.memberId].push(log);
                }
            });

            const results = buildRadar(members, logsByMemberId, new Date());
            setRadarResults(results);
            setAnalyzedMembersCount(members.length);
            setFetchedLogsCount(logs.length);
            setHasAnalyzed(true);
        } catch (err: any) {
            console.error("Coach Radar analysis failed:", err);
            setAnalysisError("Kunde inte hämta träningsdata för analys. Om detta beror på ett saknat Firestore-index behöver det skapas i databasen.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const toggleGroupExpand = (flag: string) => {
        setExpandedGroups(prev => ({ ...prev, [flag]: !prev[flag] }));
    };

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-black uppercase tracking-tight leading-[1.2] pt-[0.1em] text-gray-900 dark:text-white">
                        BEHÖVER UPPMÄRKSAMHET
                    </h3>
                    {hasAnalyzed ? (
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1">
                            Analyserade {analyzedMembersCount} medlemmar · {fetchedLogsCount.toLocaleString('sv-SE')} pass
                        </p>
                    ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Identifiera medlemmar som behöver stöd, motivation eller firande.
                        </p>
                    )}
                </div>

                {!hasAnalyzed && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                            Hämtar träningsdata för de senaste 63 dagarna.
                        </span>
                        <button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing}
                            className="bg-primary hover:brightness-110 text-white font-black text-xs px-5 py-3 rounded-2xl uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50"
                        >
                            {isAnalyzing ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Analyserar...</span>
                                </>
                            ) : (
                                <span>Analysera medlemmar</span>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {analysisError && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 font-medium">
                    {analysisError}
                </div>
            )}

            {hasAnalyzed && (
                <div className="space-y-6">
                    {radarResults.length === 0 ? (
                        <div className="p-6 text-center text-sm font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800">
                            Inga medlemmar behöver uppmärksamhet just nu.
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {RADAR_FLAGS_ORDER.map((flag) => {
                                const groupItems = radarResults.filter(r => r.flag === flag);
                                if (groupItems.length === 0) return null;

                                const config = RADAR_GROUP_CONFIG[flag];
                                const isExpanded = !!expandedGroups[flag];
                                const visibleItems = isExpanded ? groupItems : groupItems.slice(0, 5);
                                const hiddenCount = groupItems.length - 5;

                                return (
                                    <div key={flag} className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${config.badgeStyle}`}>
                                                {config.title}
                                            </span>
                                            <span className="text-xs font-bold text-gray-400">
                                                ({groupItems.length})
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2">
                                            {visibleItems.map((item) => {
                                                const m = item.member;
                                                const fullName = `${m.firstName || ''} ${m.lastName || ''}`.trim() || 'Namnlös medlem';
                                                const locObj = m.locationId ? locations?.find(l => l.id === m.locationId) : undefined;
                                                const locationName = locObj?.name;

                                                return (
                                                    <div
                                                        key={m.uid || m.id}
                                                        onClick={() => onSelectMember(m)}
                                                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs ${config.cardStyle}`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-black text-gray-700 dark:text-gray-200 uppercase flex-shrink-0">
                                                                {m.firstName ? m.firstName.charAt(0) : 'M'}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold text-sm text-gray-900 dark:text-white">
                                                                        {fullName}
                                                                    </span>
                                                                    {locationName && (
                                                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-gray-200/60 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                                                                            {locationName}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                                                                    {item.reason}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {!isExpanded && hiddenCount > 0 && (
                                            <button
                                                onClick={() => toggleGroupExpand(flag)}
                                                className="text-xs font-bold text-primary hover:underline pt-1 px-1"
                                            >
                                                Visa fler ({hiddenCount})
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const MemberManagementScreen: React.FC<MemberManagementScreenProps> = ({ onSelectMember }) => {
  const { selectedOrganization } = useStudio();
  const { role: currentUserRole, currentUser } = useAuth();
  
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState<{ message: string, visible: boolean }>({ message: '', visible: false });

  const [updatingMembers, setUpdatingMembers] = useState<Record<string, boolean>>({});

  const [editingDateMember, setEditingDateMember] = useState<Member | null>(null);
  const [newDateValue, setNewDateValue] = useState<string>('');

  useEffect(() => {
    if (!selectedOrganization) return;
    setIsLoading(true);
    const unsubscribe = listenToMembers(selectedOrganization.id, (data) => {
        setMembers(data);
        setIsLoading(false);
    });
    return () => unsubscribe();
  }, [selectedOrganization]);

  useEffect(() => {
      setCurrentPage(1);
  }, [searchTerm, roleFilter, locationFilter]);

  const radarMembers = useMemo(() => {
      return members.filter(m => {
          if (currentUserRole === 'coach' && currentUser?.locationId) {
              return m.locationId === currentUser.locationId;
          } else if (locationFilter === 'none') {
              return !m.locationId;
          } else if (locationFilter !== 'all') {
              return m.locationId === locationFilter;
          }
          return true;
      });
  }, [members, currentUserRole, currentUser?.locationId, locationFilter]);

  const filteredMembers = useMemo(() => {
      return members.filter(m => {
          const matchesSearch = 
              (m.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
              (m.lastName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
              (m.email || '').toLowerCase().includes(searchTerm.toLowerCase());
          
          let matchesRole = true;
          if (roleFilter === 'training') matchesRole = m.isTrainingMember !== false;
          else if (roleFilter === 'coach') matchesRole = m.role === 'coach';
          else if (roleFilter === 'admin') matchesRole = m.role === 'organizationadmin' || m.role === 'systemowner';

          let matchesLocation = true;
          
          // Coach kan bara se de i sin egen studio (om de har en studio)
          if (currentUserRole === 'coach' && currentUser?.locationId) {
              matchesLocation = m.locationId === currentUser.locationId;
          } else if (locationFilter === 'none') {
              matchesLocation = !m.locationId;
          } else if (locationFilter !== 'all') {
              matchesLocation = m.locationId === locationFilter;
          }

          return matchesSearch && matchesRole && matchesLocation;
      });
  }, [members, searchTerm, roleFilter, locationFilter]);

  const totalPages = Math.ceil(filteredMembers.length / ITEMS_PER_PAGE);
  const paginatedMembers = useMemo(() => {
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      return filteredMembers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredMembers, currentPage]);

  const stats = useMemo(() => {
      return {
          all: members.length,
          training: members.filter(m => m.isTrainingMember !== false).length,
          coaches: members.filter(m => m.role === 'coach').length,
          admins: members.filter(m => m.role === 'organizationadmin' || m.role === 'systemowner').length
      };
  }, [members]);

  const handleEditDateClick = (member: Member) => {
    setEditingDateMember(member);
    setNewDateValue(member.endDate || new Date().toISOString().split('T')[0]);
  };

  const handleSaveDate = async () => {
      if (!editingDateMember) return;
      try {
          await updateMemberEndDate(editingDateMember.id, newDateValue);
          setEditingDateMember(null);
      } catch (e) {
          alert("Kunde inte spara datum.");
      }
  };

  const handleClearDate = async () => {
      if (!editingDateMember) return;
      try {
          await updateMemberEndDate(editingDateMember.id, null);
          setEditingDateMember(null);
      } catch (e) {
          alert("Kunde inte ta bort datum.");
      }
  };

  const handleQuickRoleUpdate = async (memberId: string, newRole: UserRole) => {
      setUpdatingMembers(prev => ({ ...prev, [memberId]: true }));
      try {
          await updateUserRoleCloud(memberId, newRole);
      } catch (e) {
          console.error("Failed to update role", e);
          alert(e instanceof Error ? e.message : "Kunde inte uppdatera rollen.");
      } finally {
          setUpdatingMembers(prev => ({ ...prev, [memberId]: false }));
      }
  };

  const handleQuickLocationUpdate = async (memberId: string, newLocationId: string) => {
      setUpdatingMembers(prev => ({ ...prev, [memberId]: true }));
      try {
          await updateUserProfile(memberId, { locationId: newLocationId });
      } catch (e) {
          console.error("Failed to update location", e);
          alert(e instanceof Error ? e.message : "Kunde inte uppdatera ort.");
      } finally {
          setUpdatingMembers(prev => ({ ...prev, [memberId]: false }));
      }
  };

  const handleApproveCoach = async (e: React.MouseEvent, memberId: string) => {
      e.stopPropagation();
      setUpdatingMembers(prev => ({ ...prev, [memberId]: true }));
      try {
          await approveCoach(memberId);
      } catch (e) {
          console.error("Failed to approve coach", e);
          alert(e instanceof Error ? e.message : "Kunde inte godkänna coachen.");
      } finally {
          setUpdatingMembers(prev => ({ ...prev, [memberId]: false }));
      }
  };

  const goToPage = (page: number) => {
      setCurrentPage(page);
      const scrollContainer = document.querySelector('main');
      if (scrollContainer) {
          scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
      }
  };

  const canEditRoles = currentUserRole === 'organizationadmin' || currentUserRole === 'systemowner';

  if (isLoading) {
      return (
          <div className="h-64 flex flex-col items-center justify-center gap-4 animate-fade-in">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500 font-medium">Hämtar People Hub...</p>
          </div>
      );
  }

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, filteredMembers.length);

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <Toast isVisible={toast.visible} message={toast.message} onClose={() => setToast({ ...toast, visible: false })} />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h3 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Team & Medlemmar</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
            Hantera alla användare, tilldela roller och se träningsmål.
          </p>
        </div>
      </div>

      {/* Bjud in medlemmar sektion */}
      {selectedOrganization && (
        <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div>
            <h4 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
              <QrCodeIcon className="w-7 h-7 text-primary" /> Bjud in medlemmar
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Dela registreringslänken eller ladda ner högupplöst QR-kod för utskrift per ort.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {(selectedOrganization.locations && selectedOrganization.locations.length > 0
              ? selectedOrganization.locations
              : [{ id: 'default', name: selectedOrganization.name, inviteCode: selectedOrganization.inviteCode || '' }]
            ).map((loc) => {
              const code = loc.inviteCode || selectedOrganization.inviteCode || '';
              return (
                <LocationInviteCard
                  key={loc.id}
                  locationName={loc.name}
                  inviteCode={code}
                  orgName={selectedOrganization.name}
                  onCopy={(text) => {
                    navigator.clipboard.writeText(text);
                    setToast({ visible: true, message: `Länk för ${loc.name} kopierad!` });
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Coach Radar - Behöver Uppmärksamhet */}
      <CoachRadarSection
        members={radarMembers}
        organizationId={selectedOrganization?.id}
        locations={selectedOrganization?.locations}
        onSelectMember={(m) => setSelectedMember(m)}
        isStaff={currentUserRole === 'coach' || currentUserRole === 'organizationadmin' || currentUserRole === 'systemowner'}
      />

      {/* Search and filters removed the invite cards code above here */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col lg:flex-row gap-4 w-full">
              <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-700 w-full lg:w-auto overflow-x-auto scrollbar-hide">
                  {[
                      { id: 'all', label: 'Alla', count: stats.all },
                      { id: 'training', label: 'Medlemmar', count: stats.training },
                      { id: 'coach', label: 'Coacher', count: stats.coaches },
                      { id: 'admin', label: 'Admins', count: stats.admins }
                  ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setRoleFilter(f.id as RoleFilter)}
                        className={`flex-1 lg:flex-none px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                            roleFilter === f.id 
                            ? 'bg-white dark:bg-gray-700 text-primary shadow-md' 
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >
                          {f.label} ({f.count})
                      </button>
                  ))}
              </div>

              {selectedOrganization && selectedOrganization.locations && selectedOrganization.locations.length > 0 && currentUserRole !== 'coach' && (
                  <div className="flex items-center min-w-[200px]">
                      <select
                          value={locationFilter}
                          onChange={(e) => setLocationFilter(e.target.value)}
                          className="w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm px-4 py-3 text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                      >
                          <option value="all">Alla Orter/Studios</option>
                          <option value="none">Utan ort</option>
                          {selectedOrganization.locations.map(loc => (
                              <option key={loc.id} value={loc.id}>
                                  {loc.name}
                              </option>
                          ))}
                      </select>
                  </div>
              )}
          </div>
          
          <div className="relative w-full lg:max-w-md shrink-0">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <SearchIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input 
                  type="text"
                  placeholder="Sök på namn eller e-post..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-primary outline-none transition-all text-gray-900 dark:text-white"
              />
          </div>
      </div>

      {filteredMembers.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-16 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 shadow-sm animate-slide-up">
              <div className="w-24 h-24 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300 dark:text-gray-600">
                  <UsersIcon className="w-12 h-12" />
              </div>
              <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Hittade inga resultat</h4>
              <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-8">
                  Prova att ändra din sökning eller filter.
              </p>
              <button 
                onClick={() => { setSearchTerm(''); setRoleFilter('all'); setLocationFilter('all'); }}
                className="text-primary font-bold hover:underline"
              >
                  Nollställ filter
              </button>
          </div>
      ) : (
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                    <th className="p-6 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Användare</th>
                    <th className="p-6 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Tillhörighet</th>
                    <th className="p-6 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Medlemskap</th>
                    <th className="p-6 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Mål & Deadline</th>
                    <th className="p-6 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] text-right">Info</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {paginatedMembers.map((member) => (
                    <tr 
                        key={member.id} 
                        onClick={() => setSelectedMember(member)}
                        className="group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors"
                    >
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-300 font-black shrink-0 overflow-hidden border border-gray-200 dark:border-gray-700 shadow-inner group-hover:scale-105 transition-transform">
                            {member.photoUrl ? (
                              <img src={member.photoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="uppercase text-lg">{member.firstName?.[0] || '?'}{member.lastName?.[0] || '?'}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="font-bold text-gray-900 dark:text-white text-lg truncate">{member.firstName} {member.lastName}</p>
                            </div>
                            <div className="mt-1">
                                {(member.birthDate || member.age) ? (
                                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                                        {member.email} • <span className="font-bold">{calculateAge(member.birthDate, member.age)} år</span>
                                        {isBirthdayToday(member.birthDate) && <span className="ml-1" title={formatBirthday(member.birthDate) || ''}>🎂</span>}
                                    </span>
                                ) : (
                                    <p className="text-xs text-gray-400 dark:text-gray-500">{member.email}</p>
                                )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                          <div className="flex flex-col gap-2 items-start">
                              <RoleSwitcher 
                                  currentRole={member.role}
                                  status={member.status}
                                  memberId={member.id}
                                  isUpdating={!!updatingMembers[member.id]}
                                  onUpdate={(newRole) => handleQuickRoleUpdate(member.id, newRole)}
                                  canEdit={canEditRoles && member.id !== currentUser?.uid}
                              />
                              {selectedOrganization?.locations && selectedOrganization.locations.length > 0 && (
                                  <LocationSwitcher
                                      currentLocationId={member.locationId}
                                      memberId={member.id}
                                      isUpdating={!!updatingMembers[member.id]}
                                      locations={selectedOrganization.locations}
                                      onUpdate={(newLocId) => handleQuickLocationUpdate(member.id, newLocId)}
                                      canEdit={canEditRoles}
                                  />
                              )}
                              {member.status === 'pending_coach' && canEditRoles && (
                                  <button
                                      onClick={(e) => handleApproveCoach(e, member.id)}
                                      disabled={!!updatingMembers[member.id]}
                                      className="text-[10px] font-black tracking-wider uppercase bg-primary text-black px-3 py-1.5 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 mt-1 shadow-sm"
                                  >
                                      {updatingMembers[member.id] ? 'Godkänner...' : 'Godkänn Coach'}
                                  </button>
                              )}
                          </div>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                          {member.isTrainingMember !== false ? (
                              member.endDate ? (
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest">Uppsagd</span>
                                    <span className="text-orange-500 dark:text-orange-400 font-bold text-sm font-mono">{member.endDate}</span>
                                </div>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest text-[10px] bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded border border-gray-100 dark:border-gray-700">Löpande</span>
                              )
                          ) : (
                              <span className="text-gray-300 italic text-xs">Ej medlem</span>
                          )}
                          
                          {member.isTrainingMember !== false && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleEditDateClick(member); }} 
                                className="p-2 text-gray-300 hover:text-primary transition-colors hover:bg-primary/5 rounded-xl opacity-0 group-hover:opacity-100"
                                title="Hantera medlemskap"
                            >
                                <PencilIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-6 align-middle">
                        {member.isTrainingMember !== false && member.goals?.hasSpecificGoals ? (
                            <div className="flex flex-col items-start gap-1">
                                <div className="flex flex-wrap gap-1">
                                    {member.goals.selectedGoals.slice(0, 2).map(g => (
                                        <span key={g} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-100 dark:border-blue-800 whitespace-nowrap uppercase tracking-wider">
                                            {g}
                                        </span>
                                    ))}
                                    {member.goals.selectedGoals.length > 2 && (
                                        <span className="text-[10px] text-gray-400 font-bold self-center">+{member.goals.selectedGoals.length - 2}</span>
                                    )}
                                </div>
                                {member.goals.targetDate && (
                                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1 font-bold">
                                        <span className="text-base">🎯</span> {member.goals.targetDate}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <span className="text-xs text-gray-400 italic">Inget mål</span>
                        )}
                      </td>
                      <td className="p-6 text-right">
                          <div className="flex justify-end">
                              <div className="bg-gray-50 dark:bg-gray-800 text-gray-300 group-hover:text-primary group-hover:bg-primary/10 transition-all p-3 rounded-2xl border border-gray-100 dark:border-gray-700 group-hover:border-primary/30">
                                  <ChartBarIcon className="w-6 h-6" />
                              </div>
                          </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 gap-4">
                    <div className="text-sm font-bold text-gray-500 dark:text-gray-400 order-2 sm:order-1">
                        Visar <span className="text-gray-900 dark:text-white">{startIndex}-{endIndex}</span> av <span className="text-gray-900 dark:text-white">{filteredMembers.length}</span> medlemmar
                    </div>
                    
                    <div className="flex items-center gap-3 order-1 sm:order-2">
                        <button 
                            onClick={() => goToPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-black uppercase tracking-widest text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                        >
                            <ChevronLeftIcon className="w-4 h-4" />
                            <span>Föregående</span>
                        </button>
                        
                        <div className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-gray-200/50 dark:bg-gray-700/50 text-xs font-black text-gray-500 dark:text-gray-400">
                            <span>Sida</span>
                            <span className="text-gray-900 dark:text-white">{currentPage}</span>
                            <span>av</span>
                            <span className="text-gray-900 dark:text-white">{totalPages}</span>
                        </div>

                        <button 
                            onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-black uppercase tracking-widest text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                        >
                            <span>Nästa</span>
                            <ChevronRightIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
          </div>
      )}

      {selectedMember && (
        <MemberDetailModal
          visible={!!selectedMember}
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}

      {editingDateMember && (
          <Modal isOpen={true} onClose={() => setEditingDateMember(null)} title="Hantera Medlemskap" size="sm">
              <div className="space-y-6">
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      Välj ett datum då medlemskapet för <span className="font-bold text-gray-900 dark:text-white">{editingDateMember.firstName} {editingDateMember.lastName}</span> ska upphöra.
                  </p>
                  <div>
                      <label className="block text-xs font-black uppercase text-gray-400 mb-2 tracking-widest">Välj slutdatum</label>
                      <input 
                        type="date" 
                        value={newDateValue}
                        onChange={(e) => setNewDateValue(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-4 rounded-2xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none transition-all font-bold"
                      />
                  </div>
                  <div className="flex flex-col gap-3 pt-2">
                      <button onClick={handleSaveDate} className="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all uppercase tracking-widest text-sm">Spara slutdatum</button>
                      {editingDateMember.endDate && (
                          <button onClick={handleClearDate} className="w-full bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 font-bold py-4 rounded-2xl active:scale-95 transition-all uppercase tracking-widest text-sm">Återaktivera (Löpande)</button>
                      )}
                      <button onClick={() => setEditingDateMember(null)} className="w-full text-gray-400 font-bold py-2 hover:text-gray-900 dark:hover:text-white transition-colors">Avbryt</button>
                  </div>
              </div>
          </Modal>
      )}
    </div>
  );
};
