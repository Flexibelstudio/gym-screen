import React, { useState, useEffect } from 'react';
import { Member } from '../types';
import { ToggleSwitch, UsersIcon, PencilIcon, ChartBarIcon } from './icons';
import { MemberDetailModal } from './MemberDetailModal';
import { useStudio } from '../context/StudioContext';
import { getMembers, updateMemberStatus, updateMemberEndDate } from '../services/firebaseService';
import QRCode from 'react-qr-code';
import { Modal } from './ui/Modal';

interface MemberManagementScreenProps {
    onSelectMember?: (memberId: string) => void;
}

export const MemberManagementScreen: React.FC<MemberManagementScreenProps> = ({ onSelectMember }) => {
  const { selectedOrganization } = useStudio();
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Börja med att ladda
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Date editing state
  const [editingDateMember, setEditingDateMember] = useState<Member | null>(null);
  const [newDateValue, setNewDateValue] = useState<string>('');

  // --- HÄMTA DATA VID START ---
  useEffect(() => {
    if (selectedOrganization) {
        loadMembers();
    }
  }, [selectedOrganization]);

  const loadMembers = async () => {
      if (!selectedOrganization) return;
      setIsLoading(true);
      try {
          // Detta anrop hämtar MOCK_MEMBERS om vi är offline, eller riktig data om vi är online
          const data = await getMembers(selectedOrganization.id);
          setMembers(data);
      } catch (e) {
          console.error("Failed to load members", e);
      } finally {
          setIsLoading(false);
      }
  };

  // --- ACTIONS ---

  const toggleStatus = async (member: Member) => {
    const newStatus = member.status === 'active' ? 'inactive' : 'active';
    
    // 1. Uppdatera UI direkt (Optimistisk)
    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, status: newStatus } : m));
    
    // 2. Skicka till backend
    try {
        await updateMemberStatus(member.id, newStatus);
    } catch (e) {
        // Rollback om det misslyckas
        setMembers(prev => prev.map(m => m.id === member.id ? { ...m, status: member.status } : m));
        alert("Kunde inte uppdatera status.");
    }
  };

  const handleEditDateClick = (member: Member) => {
    setEditingDateMember(member);
    setNewDateValue(member.endDate || new Date().toISOString().split('T')[0]);
  };

  const handleSaveDate = async () => {
      if (!editingDateMember) return;
      const originalDate = editingDateMember.endDate;
      
      // Optimistisk uppdatering
      setMembers(prev => prev.map(m => m.id === editingDateMember.id ? { ...m, endDate: newDateValue } : m));
      
      try {
          await updateMemberEndDate(editingDateMember.id, newDateValue);
          setEditingDateMember(null);
      } catch (e) {
          setMembers(prev => prev.map(m => m.id === editingDateMember.id ? { ...m, endDate: originalDate } : m));
          alert("Kunde inte spara datum.");
      }
  };

  const handleClearDate = async () => {
      if (!editingDateMember) return;
      const originalDate = editingDateMember.endDate;

      setMembers(prev => prev.map(m => m.id === editingDateMember.id ? { ...m, endDate: null } : m));

      try {
          await updateMemberEndDate(editingDateMember.id, null);
          setEditingDateMember(null);
      } catch (e) {
          setMembers(prev => prev.map(m => m.id === editingDateMember.id ? { ...m, endDate: originalDate } : m));
          alert("Kunde inte ta bort datum.");
      }
  };

  const inviteCode = selectedOrganization?.inviteCode;
  const qrPayload = selectedOrganization ? JSON.stringify({ action: 'join', oid: selectedOrganization.id }) : '';

  // --- RENDERING ---

  if (isLoading) {
      return (
          <div className="h-64 flex flex-col items-center justify-center gap-4 animate-fade-in">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500 font-medium">Hämtar medlemsregister...</p>
          </div>
      );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Medlemsregister</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
            Hantera dina medlemmar, se deras mål och styr åtkomst.
          </p>
        </div>
        <button 
          onClick={() => setShowInviteModal(true)} 
          className="bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-primary/20 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center gap-2"
        >
          <span className="text-xl">📱</span> Anslut medlemmar
        </button>
      </div>

      {/* EMPTY STATE - Visas bara om listan är tom */}
      {members.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 shadow-sm animate-slide-up">
              <div className="w-24 h-24 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300 dark:text-gray-600">
                  <UsersIcon className="w-12 h-12" />
              </div>
              <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Ditt register är tomt</h4>
              <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-8">
                  Det ser lite tomt ut här! Dela din inbjudningskod med dina medlemmar så att de kan skapa konton och kopplas till ditt gym.
              </p>
              <button 
                onClick={() => setShowInviteModal(true)}
                className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold py-4 px-10 rounded-2xl shadow-xl hover:opacity-90 transition-opacity"
              >
                  Visa Inbjudningskod
              </button>
          </div>
      ) : (
          /* TABELLVY - Visas om medlemmar finns (Mock eller Riktiga) */
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                    <th className="p-5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Namn</th>
                    <th className="p-5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mål & Deadline</th>
                    <th className="p-5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                    <th className="p-5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Giltig t.o.m.</th>
                    <th className="p-5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="p-5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Åtgärd</th>
                    <th className="p-5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Analys</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-300 font-bold shrink-0">
                            {member.firstName?.[0] || '?'}{member.lastName?.[0] || '?'}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white">{member.firstName} {member.lastName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-5 align-middle">
                        {member.goals?.hasSpecificGoals ? (
                            <div className="flex flex-col items-start gap-1">
                                <div className="flex flex-wrap gap-1">
                                    {member.goals.selectedGoals.slice(0, 2).map(g => (
                                        <span key={g} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800 whitespace-nowrap">
                                            {g}
                                        </span>
                                    ))}
                                    {member.goals.selectedGoals.length > 2 && (
                                        <span className="text-[10px] text-gray-500 self-center">+{member.goals.selectedGoals.length - 2}</span>
                                    )}
                                </div>
                                {member.goals.targetDate && (
                                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                        <span>🎯</span> {member.goals.targetDate}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <span className="text-xs text-gray-400 italic">Ej angett</span>
                        )}
                      </td>
                      <td className="p-5 text-gray-600 dark:text-gray-300 text-sm">
                        {member.email}
                      </td>
                      <td className="p-5">
                        <div className="flex items-center gap-2">
                          {member.endDate ? (
                            <span className="text-red-600 dark:text-red-400 font-medium text-sm">{member.endDate}</span>
                          ) : (
                            <span className="text-gray-400 italic text-sm">Tills vidare</span>
                          )}
                          <button 
                            onClick={() => handleEditDateClick(member)} 
                            className="text-gray-400 hover:text-primary transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="Ändra slutdatum"
                          >
                            <PencilIcon className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="p-5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          member.status === 'active' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {member.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </td>
                      <td className="p-5 text-right">
                        <div className="flex justify-end items-center gap-4">
                          <ToggleSwitch 
                            label="" 
                            checked={member.status === 'active'} 
                            onChange={() => toggleStatus(member)} 
                          />
                        </div>
                      </td>
                      <td className="p-5 text-right">
                          <button
                            onClick={() => setSelectedMember(member)}
                            className="text-primary hover:text-primary/80 transition-colors p-2 rounded-lg hover:bg-primary/10"
                            title="Visa analys & mål"
                          >
                              <ChartBarIcon className="w-5 h-5" />
                          </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
      )}

      {/* --- MODALS --- */}

      {selectedMember && (
        <MemberDetailModal
          visible={!!selectedMember}
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}

      {editingDateMember && (
          <Modal isOpen={true} onClose={() => setEditingDateMember(null)} title="Hantera Slutdatum" size="sm">
              <div className="space-y-6">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                      Ange ett datum då medlemskapet för <span className="font-bold text-gray-900 dark:text-white">{editingDateMember.firstName} {editingDateMember.lastName}</span> ska upphöra.
                  </p>
                  <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Välj datum</label>
                      <input 
                        type="date" 
                        value={newDateValue}
                        onChange={(e) => setNewDateValue(e.target.value)}
                        className="w-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white p-3 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none"
                      />
                  </div>
                  <div className="flex flex-col gap-3 pt-2">
                      <button onClick={handleSaveDate} className="w-full bg-primary text-white font-bold py-3 rounded-lg">Spara Datum</button>
                      <button onClick={handleClearDate} className="w-full bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 font-semibold py-3 rounded-lg">Ta bort slutdatum</button>
                      <button onClick={() => setEditingDateMember(null)} className="w-full text-gray-500 font-medium py-2">Avbryt</button>
                  </div>
              </div>
          </Modal>
      )}

      {showInviteModal && selectedOrganization && (
        <Modal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} title="Anslut Medlemmar" size="lg">
            <div className="text-center p-6 space-y-8">
                <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Gå med i {selectedOrganization.name}</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                        Visa denna kod för dina medlemmar så att de kan ansluta sig till gymmet i appen.
                    </p>
                </div>
                {inviteCode ? (
                    <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                            <QRCode value={qrPayload} size={200} fgColor="#000000" bgColor="#ffffff" level="L" />
                            <p className="mt-4 text-xs font-bold uppercase tracking-widest text-gray-500">Skanna i appen</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Eller använd kod</span>
                            <div className="bg-gray-100 dark:bg-gray-700 px-8 py-4 rounded-xl border-2 border-gray-200 dark:border-gray-600">
                                <span className="text-4xl font-black font-mono tracking-widest text-primary">{inviteCode}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-8 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-dashed border-yellow-200 rounded-2xl">
                        <p className="text-yellow-800 dark:text-yellow-200 font-bold">Ingen kod tillgänglig</p>
                        <p className="text-yellow-700 dark:text-yellow-300 text-sm">Du måste först aktivera Passloggning i Globala Inställningar.</p>
                    </div>
                )}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-sm text-blue-800 dark:text-blue-200 text-left">
                    <p><strong>Tips:</strong> När medlemmar scannar koden i sin app kopplas de automatiskt till ditt gym och dyker upp i listan här.</p>
                </div>
                
                <button 
                    onClick={() => window.print()}
                    className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold py-3 px-8 rounded-lg shadow-lg hover:opacity-90 transition-opacity"
                >
                    Skriv ut poster
                </button>
            </div>
        </Modal>
      )}
    </div>
  );
};

export default MemberManagementScreen;