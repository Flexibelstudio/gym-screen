
import React, { useState } from 'react';
import { Member } from '../types';
import { ToggleSwitch, UsersIcon, PencilIcon, ChartBarIcon } from './icons';
import { MemberDetailModal } from './MemberDetailModal';
import { useStudio } from '../context/StudioContext';
import { updateOrganization } from '../services/firebaseService';
import QRCode from 'react-qr-code';
import { Modal } from './ui/Modal';

interface MemberManagementScreenProps {
    onSelectMember?: (memberId: string) => void;
}

// Mock Data
const MOCK_MEMBERS: Member[] = [
  { 
    id: '1', 
    firstName: 'Anna', 
    lastName: 'Andersson', 
    email: 'anna.andersson@example.com', 
    status: 'active', 
    organizationId: 'mock-org', 
    createdAt: Date.now(), 
    role: 'member',
    endDate: '2024-12-31',
    goals: {
        hasSpecificGoals: true,
        selectedGoals: ['Bli starkare', 'Gå ner i vikt'],
        targetDate: '2024-12-31'
    }
  },
  { 
    id: '2', 
    firstName: 'Erik', 
    lastName: 'Eriksson', 
    email: 'erik.e@example.com', 
    status: 'inactive', 
    organizationId: 'mock-org', 
    createdAt: Date.now() - 86400000, 
    role: 'member',
    endDate: null,
    goals: {
        hasSpecificGoals: true,
        selectedGoals: ['HYROX', 'Bättre kondition'],
        targetDate: '2025-06-01'
    }
  },
  { 
    id: '3', 
    firstName: 'Johan', 
    lastName: 'Johansson', 
    email: 'johan.j@example.com', 
    status: 'active', 
    organizationId: 'mock-org', 
    createdAt: Date.now() - 172800000, 
    role: 'member',
    endDate: null
  },
];

const generateInviteCode = () => {
    // Generate a random 6-character alphanumeric code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude I, 1, O, 0 to avoid confusion
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

export const MemberManagementScreen: React.FC<MemberManagementScreenProps> = ({ onSelectMember }) => {
  const { selectedOrganization, selectOrganization } = useStudio();
  const [members, setMembers] = useState<Member[]>(MOCK_MEMBERS);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  // Date editing state
  const [editingDateMember, setEditingDateMember] = useState<Member | null>(null);
  const [newDateValue, setNewDateValue] = useState<string>('');

  const toggleStatus = (id: string) => {
    setMembers(prev => prev.map(m => {
      if (m.id === id) {
        return { ...m, status: m.status === 'active' ? 'inactive' : 'active' };
      }
      return m;
    }));
  };

  const handleInviteClick = async () => {
    if (!selectedOrganization) return;
    setShowInviteModal(true);

    if (!selectedOrganization.inviteCode) {
        setIsGeneratingCode(true);
        try {
            const newCode = generateInviteCode();
            const updatedOrg = { ...selectedOrganization, inviteCode: newCode };
            selectOrganization(updatedOrg);
        } catch (e) {
            console.error("Failed to generate code", e);
        } finally {
            setIsGeneratingCode(false);
        }
    }
  };

  const handleEditDateClick = (member: Member) => {
    setEditingDateMember(member);
    // Use existing date or today's date if null
    setNewDateValue(member.endDate || new Date().toISOString().split('T')[0]);
  };

  const handleSaveDate = () => {
      if (!editingDateMember) return;
      
      setMembers(prev => prev.map(m => {
          if (m.id === editingDateMember.id) {
              return { ...m, endDate: newDateValue };
          }
          return m;
      }));
      setEditingDateMember(null);
  };

  const handleClearDate = () => {
      if (!editingDateMember) return;
      
      setMembers(prev => prev.map(m => {
          if (m.id === editingDateMember.id) {
              return { ...m, endDate: null }; // Set to indefinite
          }
          return m;
      }));
      setEditingDateMember(null);
  };

  const inviteCode = selectedOrganization?.inviteCode || 'GENERATING...';
  const qrPayload = selectedOrganization ? JSON.stringify({ action: 'join', oid: selectedOrganization.id }) : '';

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Medlemsregister</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
            Hantera dina medlemmar, se deras mål och styr åtkomst.
          </p>
        </div>
        <button 
          onClick={handleInviteClick} 
          className="bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-primary/20 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center gap-2"
        >
          <span className="text-xl">📱</span> Anslut medlemmar
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
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
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-300 font-bold">
                        {member.firstName[0]}{member.lastName[0]}
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
                  <td className="p-5 text-gray-600 dark:text-gray-300">
                    {member.email}
                  </td>
                  <td className="p-5">
                    <div className="flex items-center gap-2">
                      {member.endDate ? (
                        <span className="text-red-600 dark:text-red-400 font-medium">{member.endDate}</span>
                      ) : (
                        <span className="text-gray-400 italic">Tills vidare</span>
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
                        onChange={() => toggleStatus(member.id)} 
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
        {members.length === 0 && (
          <div className="p-10 text-center text-gray-500 dark:text-gray-400">
            Inga medlemmar registrerade än.
          </div>
        )}
      </div>

      {selectedMember && (
        <MemberDetailModal
          visible={!!selectedMember}
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}

      {/* Date Edit Modal */}
      {editingDateMember && (
          <Modal
            isOpen={true}
            onClose={() => setEditingDateMember(null)}
            title="Hantera Slutdatum"
            size="sm"
          >
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
                      <button 
                        onClick={handleSaveDate}
                        className="w-full bg-primary hover:brightness-95 text-white font-bold py-3 rounded-lg transition-colors shadow-sm"
                      >
                          Spara Datum
                      </button>
                      
                      <button 
                        onClick={handleClearDate}
                        className="w-full bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 font-semibold py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                          Ta bort slutdatum (Tills vidare)
                      </button>

                      <button 
                        onClick={() => setEditingDateMember(null)}
                        className="w-full text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 font-medium py-2 transition-colors"
                      >
                          Avbryt
                      </button>
                  </div>
              </div>
          </Modal>
      )}

      {showInviteModal && selectedOrganization && (
        <Modal 
            isOpen={showInviteModal} 
            onClose={() => setShowInviteModal(false)} 
            title="Anslut Medlemmar"
            size="lg"
        >
            <div className="text-center p-6 space-y-8">
                <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Gå med i {selectedOrganization.name}</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                        Visa denna kod för dina medlemmar så att de kan ansluta sig till gymmet i appen.
                    </p>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12">
                    {/* QR Code Section */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                        <QRCode 
                            value={qrPayload}
                            size={200}
                            fgColor="#000000"
                            bgColor="#ffffff"
                            level="L"
                        />
                        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-gray-500">Skanna i appen</p>
                    </div>

                    {/* Manual Code Section */}
                    <div className="flex flex-col items-center">
                        <span className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Eller använd kod</span>
                        <div className="bg-gray-100 dark:bg-gray-700 px-8 py-4 rounded-xl border-2 border-gray-200 dark:border-gray-600">
                            {isGeneratingCode ? (
                                <span className="text-gray-400 animate-pulse">Laddar...</span>
                            ) : (
                                <span className="text-4xl font-black font-mono tracking-widest text-primary">{inviteCode}</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-sm text-blue-800 dark:text-blue-200">
                    <p><strong>Tips:</strong> Skriv ut denna vy och sätt upp i receptionen.</p>
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