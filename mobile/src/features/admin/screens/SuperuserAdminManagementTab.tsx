import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiClient } from '../../../core/api/client';

export const SuperuserAdminManagementTab: React.FC = () => {
  const [admins, setAdmins] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Swap requests states
  const [swapRequests, setSwapRequests] = useState<any[]>([]);
  const [isProcessingSwap, setIsProcessingSwap] = useState(false);

  const fetchSwapRequests = async () => {
    try {
      const res = await apiClient.get('/admin-attendance/shifts/swap-requests');
      if (res.data.success) {
        setSwapRequests(res.data.data);
      }
    } catch (e) {
      console.log('Error fetching swap requests:', e);
    }
  };

  // Modals visibility states
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showCredsModal, setShowCredsModal] = useState(false);
  const [showPatternModal, setShowPatternModal] = useState(false);

  // Admin form state
  const [adminName, setAdminName] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [isSubmittingAdmin, setIsSubmittingAdmin] = useState(false);

  // Generated credentials state
  const [generatedCreds, setGeneratedCreds] = useState<any>(null);

  // Shift form state
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('Sodepur');
  const [shiftDate, setShiftDate] = useState(new Date());
  const [shiftStartTime, setShiftStartTime] = useState(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [shiftEndTime, setShiftEndTime] = useState(() => {
    const d = new Date();
    d.setHours(17, 0, 0, 0);
    return d;
  });
  const [shiftType, setShiftType] = useState<'BRANCH_DUTY' | 'FIELD_PROMOTION'>('BRANCH_DUTY');

  // Pattern management state
  const [selectedAdminForPattern, setSelectedAdminForPattern] = useState<any>(null);
  const [adminPatterns, setAdminPatterns] = useState<any[]>([]);
  const [loadingPatterns, setLoadingPatterns] = useState(false);
  const [patternDay, setPatternDay] = useState(0);
  const [patternBranch, setPatternBranch] = useState('Madhyamgram');
  const [patternType, setPatternType] = useState<'BRANCH_DUTY' | 'FIELD_PROMOTION'>('BRANCH_DUTY');
  const [patternStartTime, setPatternStartTime] = useState(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [patternEndTime, setPatternEndTime] = useState(() => {
    const d = new Date();
    d.setHours(17, 0, 0, 0);
    return d;
  });
  const [showPatternBranchDropdown, setShowPatternBranchDropdown] = useState(false);
  const [showPatternTypeDropdown, setShowPatternTypeDropdown] = useState(false);
  const [showPatternStartPicker, setShowPatternStartPicker] = useState(false);
  const [showPatternEndPicker, setShowPatternEndPicker] = useState(false);
  const [isSubmittingPattern, setIsSubmittingPattern] = useState(false);
  
  // Date/Time pickers visibility states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  const [isSubmittingShift, setIsSubmittingShift] = useState(false);

  // Dropdown controls
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  const fetchPatterns = async (adminId: string) => {
    try {
      setLoadingPatterns(true);
      const res = await apiClient.get(`/superuser/patterns/${adminId}`);
      if (res.data.success) {
        setAdminPatterns(res.data.data);
      }
    } catch (e) {
      console.error('[Fetch Patterns Error]', e);
      Alert.alert('Error', 'Unable to retrieve weekly pattern.');
    } finally {
      setLoadingPatterns(false);
    }
  };

  const handleSavePattern = async () => {
    if (!selectedAdminForPattern) return;

    const formatTime = (d: Date) => {
      let hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
    };

    try {
      setIsSubmittingPattern(true);
      const res = await apiClient.post('/superuser/patterns', {
        adminId: selectedAdminForPattern.id,
        dayOfWeek: patternDay,
        branch: patternBranch,
        startTime: formatTime(patternStartTime),
        endTime: formatTime(patternEndTime),
        type: patternType,
      });

      if (res.data.success) {
        Alert.alert('Success', 'Weekly pattern slot updated.');
        fetchPatterns(selectedAdminForPattern.id);
      }
    } catch (error: any) {
      console.error('Save Pattern Error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to save pattern.');
    } finally {
      setIsSubmittingPattern(false);
    }
  };

  const handleDeletePattern = async (patternId: string) => {
    try {
      const res = await apiClient.delete(`/superuser/patterns/${patternId}`);
      if (res.data.success) {
        Alert.alert('Success', 'Weekly slot cleared (marked as Holiday).');
        if (selectedAdminForPattern) {
          fetchPatterns(selectedAdminForPattern.id);
        }
      }
    } catch (error: any) {
      console.error('Delete Pattern Error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to delete pattern.');
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [adminsRes, shiftsRes] = await Promise.all([
        apiClient.get('/superuser/admins'),
        apiClient.get('/superuser/shifts'),
        fetchSwapRequests().catch(e => console.log('Error inside Promise.all swap fetch:', e))
      ]);

      if (adminsRes.data.success) setAdmins(adminsRes.data.data);
      if (shiftsRes.data.success) setShifts(shiftsRes.data.data);
    } catch (e) {
      console.error('[Load Superuser Management Data Error]', e);
      Alert.alert('Error', 'Unable to retrieve management data.');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessSwap = async (requestId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      setIsProcessingSwap(true);
      const res = await apiClient.post('/admin-attendance/shifts/approve-swap', {
        requestId,
        status,
      });

      if (res.data.success) {
        Alert.alert('Success', `Swap request ${status.toLowerCase()} successfully.`);
        fetchSwapRequests();
        loadData();
      }
    } catch (error: any) {
      console.error('Process Swap Error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to update swap request.');
    } finally {
      setIsProcessingSwap(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateAdmin = async () => {
    if (!adminName.trim() || !adminPhone.trim()) {
      Alert.alert('Error', 'Name and phone number are required.');
      return;
    }

    try {
      setIsSubmittingAdmin(true);
      const res = await apiClient.post('/superuser/admins', {
        name: adminName.trim(),
        phoneNumber: adminPhone.trim(),
        email: adminEmail.trim() || null,
      });

      if (res.data.success) {
        setGeneratedCreds({
          name: adminName.trim(),
          phone: res.data.data.user.phoneNumber,
          tempPass: res.data.data.tempPass,
          passphrase: res.data.data.passphrase,
        });
        setShowAdminModal(false);
        setShowCredsModal(true);

        // Reset fields
        setAdminName('');
        setAdminPhone('');
        setAdminEmail('');

        loadData();
      }
    } catch (error: any) {
      console.error('Create Admin Error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to create admin.');
    } finally {
      setIsSubmittingAdmin(false);
    }
  };

  const handleDeleteAdmin = (admin: any) => {
    Alert.alert(
      'Delete Branch Admin',
      `Are you sure you want to delete ${admin.name}? This will also delete all their shifts and logs.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await apiClient.delete(`/superuser/admins/${admin.id}`);
              if (res.data.success) {
                Alert.alert('Success', 'Admin deleted successfully.');
                loadData();
              }
            } catch (error: any) {
              console.error('Delete Admin Error:', error);
              Alert.alert('Error', error.response?.data?.error || 'Failed to delete admin.');
            }
          },
        },
      ]
    );
  };

  const handleCreateShift = async () => {
    if (!selectedAdminId) {
      Alert.alert('Error', 'Please select an Admin.');
      return;
    }

    const year = shiftDate.getFullYear();
    const month = String(shiftDate.getMonth() + 1).padStart(2, '0');
    const day = String(shiftDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const formatTime = (d: Date) => {
      let hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
    };

    try {
      setIsSubmittingShift(true);
      const res = await apiClient.post('/superuser/shifts', {
        adminId: selectedAdminId,
        branch: selectedBranch,
        date: dateStr,
        startTime: formatTime(shiftStartTime),
        endTime: formatTime(shiftEndTime),
        type: shiftType,
      });

      if (res.data.success) {
        Alert.alert('Success', 'Shift assigned successfully.');
        setShowShiftModal(false);
        loadData();
      }
    } catch (error: any) {
      console.error('Create Shift Error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to assign shift.');
    } finally {
      setIsSubmittingShift(false);
    }
  };

  const handleDeleteShift = (shiftId: string) => {
    Alert.alert(
      'Cancel Shift',
      'Are you sure you want to cancel this shift?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Shift',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await apiClient.delete(`/superuser/shifts/${shiftId}`);
              if (res.data.success) {
                Alert.alert('Success', 'Shift cancelled successfully.');
                loadData();
              }
            } catch (error: any) {
              console.error('Delete Shift Error:', error);
              Alert.alert('Error', error.response?.data?.error || 'Failed to cancel shift.');
            }
          },
        },
      ]
    );
  };

  const copyCreds = async () => {
    if (!generatedCreds) return;
    const shareText = `Name: ${generatedCreds.name}\nPhone: ${generatedCreds.phone}\nTemp Password: ${generatedCreds.tempPass}\nRecovery Passphrase: ${generatedCreds.passphrase}`;
    await Clipboard.setStringAsync(shareText);
    Alert.alert('Copied', 'Admin credentials copied to clipboard.');
  };

  if (loading) {
    return (
      <View className="py-20 justify-center items-center">
        <ActivityIndicator size="large" color="#2D8C82" />
        <Text className="text-slate-500 text-xs mt-3">Loading Management Panel...</Text>
      </View>
    );
  }

  const selectedAdmin = admins.find(a => a.id === selectedAdminId);

  return (
    <ScrollView className="flex-1 px-4 mt-4">
      {/* Admin Actions */}
      <View className="flex-row justify-between mb-6">
        <TouchableOpacity
          onPress={() => setShowAdminModal(true)}
          className="flex-1 bg-[#2D8C82] border border-[#237068] py-3.5 rounded-2xl items-center mr-2 shadow-md"
        >
          <Text className="text-white text-xs font-black uppercase">Create Admin</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            if (admins.length === 0) {
              Alert.alert('No Admins Found', 'Create at least one branch admin first.');
              return;
            }
            setSelectedAdminId(admins[0]?.id || '');
            setShowShiftModal(true);
          }}
          className="flex-1 bg-blue-600 border border-blue-700 py-3.5 rounded-2xl items-center ml-2 shadow-md"
        >
          <Text className="text-white text-xs font-black uppercase">Assign Shift</Text>
        </TouchableOpacity>
      </View>

      {/* Swap Requests Panel */}
      {swapRequests.some(r => r.status === 'PENDING') && (
        <View className="mb-6">
          <Text className="text-amber-400 text-[10px] font-black uppercase tracking-wider mb-3">Branch Swap Requests</Text>
          {swapRequests.map(req => {
            if (req.status !== 'PENDING') return null;
            return (
              <View key={req.id} className="bg-slate-900 border border-slate-850 rounded-2xl p-4 mb-3 shadow-lg">
                <Text className="text-slate-100 text-sm font-black">{req.admin?.name || 'Admin'}</Text>
                <Text className="text-slate-400 text-[11px] mt-1 leading-5">
                  Requests to serve at <Text className="text-[#2D8C82] font-black">{req.requestedBranch}</Text> on <Text className="font-black text-slate-300">{req.date}</Text>
                </Text>
                <View className="flex-row justify-end gap-2 mt-4">
                  <TouchableOpacity
                    onPress={() => handleProcessSwap(req.id, 'REJECTED')}
                    disabled={isProcessingSwap}
                    className="bg-red-500/10 border border-red-500/20 px-3.5 py-2 rounded-xl active:opacity-90"
                  >
                    <Text className="text-red-400 font-extrabold text-[10px] uppercase">Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleProcessSwap(req.id, 'APPROVED')}
                    disabled={isProcessingSwap}
                    className="bg-[#2D8C82]/10 border border-[#2D8C82]/20 px-3.5 py-2 rounded-xl active:opacity-90"
                  >
                    <Text className="text-[#2D8C82] font-black text-[10px] uppercase">Approve</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Admin Directory */}
      <Text className="text-slate-500 text-[10px] font-black uppercase tracking-wider mb-3">Branch Admins Directory</Text>
      {admins.length > 0 ? (
        admins.map(admin => (
          <View key={admin.id} className="bg-slate-900 border border-slate-850 rounded-2xl p-4 mb-3 shadow flex-row justify-between items-center">
            <View>
              <Text className="text-slate-100 text-sm font-black">{admin.name}</Text>
              <Text className="text-slate-400 text-xs mt-0.5">{admin.phoneNumber}</Text>
              {admin.email && <Text className="text-slate-500 text-[10px] mt-0.5">{admin.email}</Text>}
            </View>
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={() => {
                  setSelectedAdminForPattern(admin);
                  fetchPatterns(admin.id);
                  setShowPatternModal(true);
                }}
                className="bg-[#2D8C82]/10 border border-[#2D8C82]/20 px-3 py-2 rounded-xl"
              >
                <Text className="text-[#2D8C82] font-black text-[10px] uppercase">Schedule</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDeleteAdmin(admin)}
                className="bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl"
              >
                <Text className="text-red-400 font-extrabold text-[10px] uppercase">Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      ) : (
        <Text className="text-slate-600 text-xs py-4 text-center">No branch admins created yet.</Text>
      )}

      {/* Shifts Planner Board */}
      <Text className="text-slate-500 text-[10px] font-black uppercase tracking-wider mt-6 mb-3">Shifts Logs & Schedule</Text>
      {shifts.length > 0 ? (
        shifts.map(shift => {
          const attendance = shift.attendances[0];
          return (
            <View key={shift.id} className="bg-slate-900 border border-slate-850 rounded-2xl p-4 mb-3 shadow">
              <View className="flex-row justify-between items-center mb-2">
                <View>
                  <Text className="text-slate-200 text-sm font-black">{shift.admin?.name || 'Unknown Admin'}</Text>
                  <Text className="text-slate-400 text-xs font-semibold mt-0.5">{shift.branch} Branch ({shift.date})</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteShift(shift.id)}
                  className="bg-red-500/10 border border-red-500/20 px-2 py-1.5 rounded-lg"
                >
                  <Text className="text-red-500 text-xs">✕</Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row justify-between items-center border-t border-slate-850 pt-2.5 mt-2">
                <Text className="text-slate-500 text-xs">{shift.startTime} - {shift.endTime}</Text>
                <View className="flex-row items-center gap-2">
                  <View className={`px-2 py-0.5 rounded-md ${shift.type === 'FIELD_PROMOTION' ? 'bg-amber-600/10 border border-amber-500/20' : 'bg-blue-600/10 border border-blue-500/20'}`}>
                    <Text className={`text-[9px] font-bold uppercase ${shift.type === 'FIELD_PROMOTION' ? 'text-amber-400' : 'text-blue-400'}`}>
                      {shift.type === 'FIELD_PROMOTION' ? 'Outdoor' : 'Branch'}
                    </Text>
                  </View>
                  <Text className={`text-xs font-black ${attendance ? (attendance.logoutTime ? 'text-slate-500' : 'text-emerald-400') : 'text-red-400'}`}>
                    {attendance ? (attendance.logoutTime ? `Finished (${attendance.workingHours}h)` : 'Working') : 'Unchecked'}
                  </Text>
                </View>
              </View>
            </View>
          );
        })
      ) : (
        <Text className="text-slate-600 text-xs py-4 text-center mb-10">No shifts scheduled.</Text>
      )}

      {/* CREATE ADMIN MODAL */}
      <Modal visible={showAdminModal} transparent animationType="slide" onRequestClose={() => setShowAdminModal(false)}>
        <View className="flex-1 justify-end bg-black/80">
          <View className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 pb-10">
            <Text className="text-slate-100 text-base font-black mb-4">Create Branch Admin</Text>

            <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Name</Text>
            <TextInput
              value={adminName}
              onChangeText={setAdminName}
              placeholder="e.g. John Doe"
              placeholderTextColor="#5C5446"
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-xs mb-3"
            />

            <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Phone Number</Text>
            <TextInput
              value={adminPhone}
              onChangeText={setAdminPhone}
              keyboardType="phone-pad"
              placeholder="e.g. +919876543210"
              placeholderTextColor="#5C5446"
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-xs mb-3"
            />

            <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Email Address (Optional)</Text>
            <TextInput
              value={adminEmail}
              onChangeText={setAdminEmail}
              keyboardType="email-address"
              placeholder="e.g. john@mathemaniac.com"
              placeholderTextColor="#5C5446"
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-xs mb-4"
            />

            <View className="flex-row gap-4 mt-2">
              <TouchableOpacity
                onPress={() => setShowAdminModal(false)}
                className="flex-1 bg-slate-800 py-3 rounded-xl items-center"
              >
                <Text className="text-slate-300 text-xs font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateAdmin}
                disabled={isSubmittingAdmin}
                className="flex-1 bg-[#2D8C82] py-3 rounded-xl items-center"
              >
                {isSubmittingAdmin ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white text-xs font-bold">Create Admin</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CREDENTIALS OUTPUT MODAL */}
      <Modal visible={showCredsModal} transparent animationType="fade" onRequestClose={() => setShowCredsModal(false)}>
        <View className="flex-1 bg-black/85 justify-center px-6">
          <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl">
            <Text className="text-slate-100 text-lg font-black mb-1">Credentials Generated</Text>
            <Text className="text-slate-500 text-[10px] mb-4">Please copy these details. They cannot be retrieved later.</Text>

            {generatedCreds && (
              <View className="bg-slate-950 border border-slate-850 rounded-2xl p-4 mb-4">
                <Text className="text-slate-400 text-[10px] font-bold uppercase">Name</Text>
                <Text className="text-slate-100 text-sm font-bold mb-3">{generatedCreds.name}</Text>

                <Text className="text-slate-400 text-[10px] font-bold uppercase">Phone Number</Text>
                <Text className="text-slate-100 text-sm font-bold mb-3">{generatedCreds.phone}</Text>

                <Text className="text-slate-400 text-[10px] font-bold uppercase">Temporary Password</Text>
                <Text className="text-emerald-400 text-sm font-black mb-3">{generatedCreds.tempPass}</Text>

                <Text className="text-slate-400 text-[10px] font-bold uppercase">Recovery Passphrase</Text>
                <Text className="text-[#2D8C82] text-sm font-black">{generatedCreds.passphrase}</Text>
              </View>
            )}

            <TouchableOpacity onPress={copyCreds} className="bg-[#2D8C82] py-3 rounded-xl items-center mb-3">
              <Text className="text-white text-xs font-bold">Copy Credentials</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowCredsModal(false)} className="bg-slate-800 py-3 rounded-xl items-center">
              <Text className="text-slate-400 text-xs font-bold">Close Dialog</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* SHIFT PLANNER MODAL */}
      <Modal visible={showShiftModal} transparent animationType="slide" onRequestClose={() => setShowShiftModal(false)}>
        <View className="flex-1 justify-end bg-black/85">
          <View className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 pb-10 max-h-[90%]">
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="text-slate-100 text-base font-black mb-4">Assign Shift</Text>

              {/* Admin Selector */}
              <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Select Admin</Text>
              <TouchableOpacity
                onPress={() => setShowAdminDropdown(!showAdminDropdown)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 mb-3 flex-row justify-between items-center"
              >
                <Text className="text-slate-300 text-xs">
                  {selectedAdmin ? selectedAdmin.name : 'Select Admin'}
                </Text>
                <Text className="text-slate-500 text-[10px]">▼</Text>
              </TouchableOpacity>
              
              {showAdminDropdown && (
                <View className="bg-slate-950 border border-slate-850 rounded-xl mb-3 overflow-hidden">
                  {admins.map(admin => (
                    <TouchableOpacity
                      key={admin.id}
                      onPress={() => {
                        setSelectedAdminId(admin.id);
                        setShowAdminDropdown(false);
                      }}
                      className="p-3 border-b border-slate-900"
                    >
                      <Text className="text-slate-300 text-xs">{admin.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Branch Selector */}
              <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Branch Location</Text>
              <TouchableOpacity
                onPress={() => setShowBranchDropdown(!showBranchDropdown)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 mb-3 flex-row justify-between items-center"
              >
                <Text className="text-slate-300 text-xs">{selectedBranch}</Text>
                <Text className="text-slate-500 text-[10px]">▼</Text>
              </TouchableOpacity>
              
              {showBranchDropdown && (
                <View className="bg-slate-950 border border-slate-850 rounded-xl mb-3 overflow-hidden">
                  {['Sodepur', 'Madhyamgram'].map(br => (
                    <TouchableOpacity
                      key={br}
                      onPress={() => {
                        setSelectedBranch(br);
                        setShowBranchDropdown(false);
                      }}
                      className="p-3 border-b border-slate-900"
                    >
                      <Text className="text-slate-300 text-xs">{br}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Shift Type Selector */}
              <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Shift Duty Type</Text>
              <TouchableOpacity
                onPress={() => setShowTypeDropdown(!showTypeDropdown)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 mb-3 flex-row justify-between items-center"
              >
                <Text className="text-slate-300 text-xs">
                  {shiftType === 'FIELD_PROMOTION' ? 'Outdoor Promotion Event' : 'Branch In-Office Duty'}
                </Text>
                <Text className="text-slate-500 text-[10px]">▼</Text>
              </TouchableOpacity>

              {showTypeDropdown && (
                <View className="bg-slate-950 border border-slate-850 rounded-xl mb-3 overflow-hidden">
                  <TouchableOpacity
                    onPress={() => { setShiftType('BRANCH_DUTY'); setShowTypeDropdown(false); }}
                    className="p-3 border-b border-slate-900"
                  >
                    <Text className="text-slate-300 text-xs">Branch In-Office Duty (Enforces Geofence)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setShiftType('FIELD_PROMOTION'); setShowTypeDropdown(false); }}
                    className="p-3"
                  >
                    <Text className="text-slate-300 text-xs">Outdoor Promotion Event (Bypasses Geofence)</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Date Selector */}
              <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Shift Date</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 mb-3 items-center"
              >
                <Text className="text-slate-300 text-xs font-bold">
                  {shiftDate.toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={shiftDate}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={(event, date) => {
                    setShowDatePicker(false);
                    if (date) setShiftDate(date);
                  }}
                />
              )}

              {/* Timings */}
              <View className="flex-row gap-4 mb-4">
                <View className="flex-1">
                  <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Start Time</Text>
                  <TouchableOpacity
                    onPress={() => setShowStartPicker(true)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 items-center"
                  >
                    <Text className="text-slate-300 text-xs">
                      {shiftStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                  {showStartPicker && (
                    <DateTimePicker
                      value={shiftStartTime}
                      mode="time"
                      is24Hour={false}
                      display="default"
                      onChange={(event, time) => {
                        setShowStartPicker(false);
                        if (time) setShiftStartTime(time);
                      }}
                    />
                  )}
                </View>

                <View className="flex-1">
                  <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">End Time</Text>
                  <TouchableOpacity
                    onPress={() => setShowEndPicker(true)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 items-center"
                  >
                    <Text className="text-slate-300 text-xs">
                      {shiftEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                  {showEndPicker && (
                    <DateTimePicker
                      value={shiftEndTime}
                      mode="time"
                      is24Hour={false}
                      display="default"
                      onChange={(event, time) => {
                        setShowEndPicker(false);
                        if (time) setShiftEndTime(time);
                      }}
                    />
                  )}
                </View>
              </View>

              <View className="flex-row gap-4 mt-4">
                <TouchableOpacity
                  onPress={() => setShowShiftModal(false)}
                  className="flex-1 bg-slate-800 py-3 rounded-xl items-center"
                >
                  <Text className="text-slate-300 text-xs font-bold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCreateShift}
                  disabled={isSubmittingShift}
                  className="flex-1 bg-blue-600 py-3 rounded-xl items-center"
                >
                  {isSubmittingShift ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text className="text-white text-xs font-bold">Assign Shift</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* WEEKLY PATTERN MODAL */}
      <Modal visible={showPatternModal} transparent animationType="slide" onRequestClose={() => setShowPatternModal(false)}>
        <View className="flex-1 justify-end bg-black/85">
          <View className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 pb-10 max-h-[90%]">
            <Text className="text-slate-100 text-base font-black mb-1">
              Weekly Schedule: {selectedAdminForPattern?.name}
            </Text>
            <Text className="text-slate-500 text-[10px] mb-4 uppercase font-bold">
              Set recurring weekly branches and timings. Unscheduled days default to Holiday/Off.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* 7 Days List */}
              <View className="bg-slate-950 border border-slate-850 rounded-2xl p-3 mb-4">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((dayName, idx) => {
                  const dayPattern = adminPatterns.find(p => p.dayOfWeek === idx);
                  const isSelected = patternDay === idx;

                  return (
                    <TouchableOpacity
                      key={dayName}
                      onPress={() => {
                        setPatternDay(idx);
                        if (dayPattern) {
                          setPatternBranch(dayPattern.branch);
                          setPatternType(dayPattern.type);
                          // Parse times back into Dates for display in the pickers
                          const [startH, startM] = dayPattern.startTime.split(':');
                          const [endH, endM] = dayPattern.endTime.split(':');
                          const sd = new Date();
                          const ed = new Date();
                          sd.setHours(parseInt(startH, 10) + (dayPattern.startTime.includes('PM') && startH !== '12' ? 12 : 0), parseInt(startM, 10), 0);
                          ed.setHours(parseInt(endH, 10) + (dayPattern.endTime.includes('PM') && endH !== '12' ? 12 : 0), parseInt(endM, 10), 0);
                          setPatternStartTime(sd);
                          setPatternEndTime(ed);
                        } else {
                          setPatternBranch('Madhyamgram');
                          setPatternType('BRANCH_DUTY');
                        }
                      }}
                      className={`flex-row justify-between items-center p-3 border-b border-slate-900 rounded-xl mb-1 ${isSelected ? 'bg-slate-900 border border-slate-800' : ''}`}
                    >
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className={`text-xs font-bold ${isSelected ? 'text-[#2D8C82]' : 'text-slate-350'}`}>
                            {dayName}
                          </Text>
                          {dayPattern && (
                            <View className="bg-[#2D8C82]/10 border border-[#2D8C82]/20 px-1.5 py-0.5 rounded">
                              <Text className="text-[8px] text-[#2D8C82] font-black uppercase">{dayPattern.type === 'FIELD_PROMOTION' ? 'Outdoor' : 'Branch'}</Text>
                            </View>
                          )}
                        </View>
                        {dayPattern ? (
                          <Text className="text-slate-400 text-[10px] mt-0.5 font-semibold">
                            {dayPattern.branch} | {dayPattern.startTime} - {dayPattern.endTime}
                          </Text>
                        ) : (
                          <Text className="text-slate-650 text-[10px] mt-0.5">Holiday / Off-day</Text>
                        )}
                      </View>

                      {dayPattern ? (
                        <TouchableOpacity
                          onPress={() => handleDeletePattern(dayPattern.id)}
                          className="bg-red-500/10 px-2.5 py-1.5 rounded-lg border border-red-500/20"
                        >
                          <Text className="text-red-400 text-[9px] font-black uppercase">Clear</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text className="text-[#2D8C82] text-[10px] font-black uppercase">Add</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Slot Editor Form */}
              <Text className="text-slate-400 text-[10px] font-bold uppercase mb-3">
                Configure {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][patternDay]}
              </Text>

              {/* Branch Selector */}
              <Text className="text-slate-500 text-[9px] font-bold uppercase mb-1">Branch</Text>
              <TouchableOpacity
                onPress={() => setShowPatternBranchDropdown(!showPatternBranchDropdown)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 mb-3 flex-row justify-between items-center"
              >
                <Text className="text-slate-300 text-xs">{patternBranch}</Text>
                <Text className="text-slate-500 text-[10px]">▼</Text>
              </TouchableOpacity>
              {showPatternBranchDropdown && (
                <View className="bg-slate-950 border border-slate-850 rounded-xl mb-3 overflow-hidden">
                  {['Sodepur', 'Madhyamgram'].map(br => (
                    <TouchableOpacity
                      key={br}
                      onPress={() => {
                        setPatternBranch(br);
                        setShowPatternBranchDropdown(false);
                      }}
                      className="p-3 border-b border-slate-900"
                    >
                      <Text className="text-slate-300 text-xs">{br}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Shift Type Selector */}
              <Text className="text-slate-500 text-[9px] font-bold uppercase mb-1">Type</Text>
              <TouchableOpacity
                onPress={() => setShowPatternTypeDropdown(!showPatternTypeDropdown)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 mb-3 flex-row justify-between items-center"
              >
                <Text className="text-slate-300 text-xs">
                  {patternType === 'FIELD_PROMOTION' ? 'Outdoor Promotion Event' : 'Branch In-Office Duty'}
                </Text>
                <Text className="text-slate-500 text-[10px]">▼</Text>
              </TouchableOpacity>
              {showPatternTypeDropdown && (
                <View className="bg-slate-950 border border-slate-850 rounded-xl mb-3 overflow-hidden">
                  <TouchableOpacity
                    onPress={() => { setPatternType('BRANCH_DUTY'); setShowPatternTypeDropdown(false); }}
                    className="p-3 border-b border-slate-900"
                  >
                    <Text className="text-slate-300 text-xs">Branch In-Office Duty</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setPatternType('FIELD_PROMOTION'); setShowPatternTypeDropdown(false); }}
                    className="p-3"
                  >
                    <Text className="text-slate-300 text-xs">Outdoor Promotion Event</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Time Pickers */}
              <View className="flex-row gap-4 mb-4">
                <View className="flex-1">
                  <Text className="text-slate-500 text-[9px] font-bold uppercase mb-1">Start</Text>
                  <TouchableOpacity
                    onPress={() => setShowPatternStartPicker(true)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 items-center"
                  >
                    <Text className="text-slate-300 text-xs">
                      {patternStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                  {showPatternStartPicker && (
                    <DateTimePicker
                      value={patternStartTime}
                      mode="time"
                      is24Hour={false}
                      display="default"
                      onChange={(event, time) => {
                        setShowPatternStartPicker(false);
                        if (time) setPatternStartTime(time);
                      }}
                    />
                  )}
                </View>

                <View className="flex-1">
                  <Text className="text-slate-500 text-[9px] font-bold uppercase mb-1">End</Text>
                  <TouchableOpacity
                    onPress={() => setShowPatternEndPicker(true)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 items-center"
                  >
                    <Text className="text-slate-300 text-xs">
                      {patternEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                  {showPatternEndPicker && (
                    <DateTimePicker
                      value={patternEndTime}
                      mode="time"
                      is24Hour={false}
                      display="default"
                      onChange={(event, time) => {
                        setShowPatternEndPicker(false);
                        if (time) setPatternEndTime(time);
                      }}
                    />
                  )}
                </View>
              </View>

              <TouchableOpacity
                onPress={handleSavePattern}
                disabled={isSubmittingPattern}
                className="bg-[#2D8C82] py-3.5 rounded-xl items-center mb-3 shadow"
              >
                {isSubmittingPattern ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white text-xs font-black uppercase">Save Weekly Slot</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowPatternModal(false)}
                className="bg-slate-800 py-3.5 rounded-xl items-center"
              >
                <Text className="text-slate-400 text-xs font-bold">Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};
