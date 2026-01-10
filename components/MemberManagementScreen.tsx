
import React, { useState, useEffect, useMemo } from 'react';
import { Member, UserRole } from '../types';
import { UsersIcon, PencilIcon, ChartBarIcon, SearchIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';
import { MemberDetailModal } from './MemberDetailModal';
import { useStudio } from '../context/StudioContext';
import { listenToMembers, updateMemberEndDate, updateUserRole } from '../services/firebaseService';
import QRCode from 'react-qr-code';
import { Modal } from './ui/Modal';
import { useAuth } from '../context/AuthContext';

interface MemberManagementScreenProps {
    onSelectMember?: (memberId: string) => void;
}

type RoleFilter = 'all' | 'training' | 'coach' | 'admin';

const ITEMS_PER_PAGE = 50;

// Helper component for the inline dropdown
const RoleSwitcher: React.FC<{ 
    currentRole: UserRole; 
    memberId: string; 
    isUpdating: boolean;
    onUpdate: (role: UserRole) => void;
    canEdit: boolean;
}> = ({ currentRole, memberId, isUpdating, onUpdate, canEdit }) => {
    
    // Prevent row click when interacting with dropdown
    const handleClick = (e: React.MouseEvent) => e.stopPropagation();

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        e.stopPropagation();
        onUpdate(e.target.value as UserRole);
    };

    const getStyle = (r: UserRole) => {
        switch (r) {
            case 'systemowner': return "bg-purple-100 text-purple-700 border-purple-200";
            case 'organizationadmin': return "bg-indigo-100 text-indigo-700 border-indigo-200";
            case 'coach': return "bg-emerald-100 text-emerald-700 border-emerald-200";
            default: return "bg-gray-100 text-gray-500 border-gray-200";
        }
    };

    const getLabel = (r: UserRole) => {
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
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
            >
                <option value="member">Medlem</option>
                <option value="coach">Coach</option>
                <option value="organizationadmin">Admin</option>
            </select>
        </div>
    );
};

export const MemberManagementScreen: React.FC<MemberManagementScreenProps> = ({ onSelectMember }) => {
  const { selectedOrganization } = useStudio();
  const { role: currentUserRole, currentUser } = useAuth();
  
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Updating state for inline role changes
  const [updatingMembers, setUpdatingMembers] = useState<Record<string, boolean>>({});

  // Date editing state
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

  // Reset to first page when filters change
  useEffect(() => {
      setCurrentPage(1);
  }, [searchTerm, roleFilter]);

  const filteredMembers = useMemo(() => {
      return members.filter(m => {
          const matchesSearch = 
              m.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || 
              m.lastName.toLowerCase().includes(searchTerm.toLowerCase()) || 
              m.email.toLowerCase().includes(searchTerm.toLowerCase());
          
          let matchesRole = true;
          if (roleFilter === 'training') matchesRole = m.isTrainingMember !== false;
          else if (roleFilter === 'coach') matchesRole = m.role === 'coach';
          else if (roleFilter === 'admin') matchesRole = m.role === 'organizationadmin' || m.role === 'systemowner';

          return matchesSearch && matchesRole;
      });
  }, [members, searchTerm, roleFilter]);

  // Pagination Logic
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
          await updateUserRole(memberId, newRole);
      } catch (e) {
          console.error("Failed to update role", e);
          alert("Kunde inte uppdatera rollen.");
      } finally {
          setUpdatingMembers(prev => ({ ...prev, [memberId]: false }));
      }
  };

  const canEditRoles = currentUserRole === 'organizationadmin' || currentUserRole === 'systemowner';

  const inviteCode = selectedOrganization?.inviteCode;
  const qrPayload = selectedOrganization ? JSON.stringify({ action: 'join', oid: selectedOrganization.id }) : '';

  if (isLoading) {
      return (
          <div className="h-64 flex flex-col items-center justify-center gap-4 animate-fade-in">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500 font-medium">Hämtar People Hub...</p>
          </div>
      );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h3 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Team & Medlemmar</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
            Hantera alla användare, tilldela roller och se träningsmål.
          </p>
        </div>
        <button 
          onClick={() => setShowInviteModal(true)} 
          className="bg-primary hover:brightness-110 text-white font-black py-4 px-8 rounded-2xl shadow-xl shadow-primary/20 transition-all transform hover:-translate-y-1 active:scale-95 flex items-center gap-3 self-start md:self-auto"
        >
          <span className="uppercase tracking-widest text-sm">Anslut nya</span>
        </button>
      </div>

      {/* Filter & Search Bar - Desktop optimization */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-700 w-full lg:w-auto">
              {[
                  { id: 'all', label: 'Alla', count: stats.all },
                  { id: 'training', label: 'Medlemmar', count: stats.training },
                  { id: 'coach', label: 'Coacher', count: stats.coaches },
                  { id: 'admin', label: 'Admins', count: stats.admins }
              ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setRoleFilter(f.id as RoleFilter)}
                    className={`flex-1 lg:flex-none px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        roleFilter === f.id 
                        ? 'bg-white dark:bg-gray-700 text-primary shadow-md' 
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                      {f.label} ({f.count})
                  </button>
              ))}
          </div>
          
          <div className="relative w-full lg:max-w-md">
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
                onClick={() => { setSearchTerm(''); setRoleFilter('all'); }}
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
                    <th className="p-6 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Namn & Roll</th>
                    <th className="p-6 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Medlemskap</th>
                    <th className="p-6 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Mål & Deadline</th>
                    <th className="p-6 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Kontakt</th>
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
                            <p className="font-bold text-gray-900 dark:text-white text-lg truncate">{member.firstName} {member.lastName}</p>
                            <div className="mt-1 flex items-center gap-2">
                                <RoleSwitcher 
                                    currentRole={member.role}
                                    memberId={member.id}
                                    isUpdating={!!updatingMembers[member.id]}
                                    onUpdate={(newRole) => handleQuickRoleUpdate(member.id, newRole)}
                                    canEdit={canEditRoles && member.id !== currentUser?.uid}
                                />
                            </div>
                          </div>
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
                      <td className="p-6 text-gray-600 dark:text-gray-300">
                        <p className="text-sm font-medium">{member.email}</p>
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
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeftIcon className="w-4 h-4" />
                        Föregående
                    </button>
                    <span className="text-sm font-bold text-gray-500 dark:text-gray-400">
                        Sida {currentPage} av {totalPages}
                    </span>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Nästa
                        <ChevronRightIcon className="w-4 h-4" />
                    </button>
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

      {showInviteModal && selectedOrganization && (
        <Modal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} title="Anslut Medlemmar" size="lg">
            <div className="text-center p-4 sm:p-6 space-y-8">
                <div className="space-y-2">
                    <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Bjud in ditt team</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-lg">
                        Medlemmar och personal ansluter sig till {selectedOrganization.name} via denna kod.
                    </p>
                </div>
                {inviteCode ? (
                    <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12 py-4">
                        <div className="bg-white p-5 rounded-[2.5rem] shadow-xl border border-gray-100 flex flex-col items-center">
                            <QRCode value={qrPayload} size={200} fgColor="#000000" bgColor="#ffffff" level="L" />
                            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Skanna i appen</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Eller använd kod</span>
                            <div className="bg-gray-100 dark:bg-gray-800 px-10 py-6 rounded-[2rem] border-2 border-gray-200 dark:border-gray-700 shadow-inner">
                                <span className="text-5xl font-black font-mono tracking-[0.2em] text-primary">{inviteCode}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-8 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-dashed border-yellow-200 rounded-3xl">
                        <p className="text-yellow-800 dark:text-yellow-200 font-bold">Ingen kod tillgänglig</p>
                        <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-2">Du måste först aktivera Passloggning i Globala Inställningar för att generera en kod.</p>
                    </div>
                )}
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-3xl text-sm text-indigo-800 dark:text-indigo-200 text-left border border-indigo-100 dark:border-indigo-800">
                    <p className="leading-relaxed">
                        <strong>Tips:</strong> När medlemmar scannar koden skapas deras konto och de kopplas direkt till ditt gym. Som admin kan du sedan uppgradera medlemmar till <strong>Coacher</strong> eller <strong>Admins</strong> genom att klicka på deras profil i listan.
                    </p>
                </div>
                
                <button 
                    onClick={() => window.print()}
                    className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black py-5 px-8 rounded-2xl shadow-2xl hover:opacity-90 transition-all transform active:scale-95 uppercase tracking-widest text-sm"
                >
                    Skriv ut instruktions-poster
                </button>
            </div>
        </Modal>
      )}
    </div>
  );
};
