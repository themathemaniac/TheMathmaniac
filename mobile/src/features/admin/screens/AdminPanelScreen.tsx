import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../../navigation/types';
import { useAuthStore } from '../../../core/store/auth';
import { Button } from '../../../shared/components/Button';
import { AdminCoursesTab } from './AdminCoursesTab';
import { AdminRoutineTab } from './AdminRoutineTab';
import { SuperuserAdminManagementTab } from './SuperuserAdminManagementTab';
import { apiClient } from '../../../core/api/client';
import { MiniCalendar } from '../../../shared/components/MiniCalendar';
import DateTimePicker from '@react-native-community/datetimepicker';

type AdminPanelScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AdminPanel'>;

const FilterDropdown = ({ label, value, options, onSelect }: { label: string, value: string, options: string[], onSelect: (v: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <TouchableOpacity onPress={() => setIsOpen(true)} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 justify-center mx-1">
        <Text className="text-[9px] text-slate-500 font-bold uppercase mb-0.5">{label}</Text>
        <Text className="text-slate-200 text-xs font-bold" numberOfLines={1}>
          {value === 'ALL' ? `All` : value}
        </Text>
      </TouchableOpacity>
      
      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setIsOpen(false)} className="flex-1 bg-black/80 justify-center px-6">
          <View className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden max-h-[70%]">
            <View className="p-4 border-b border-slate-800 bg-slate-950">
              <Text className="text-slate-100 text-sm font-black text-center">Select {label}</Text>
            </View>
            <ScrollView className="p-2">
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => { onSelect(opt); setIsOpen(false); }}
                  className={`p-4 rounded-xl mb-1 ${value === opt ? 'bg-[#2D8C82]' : 'bg-transparent'}`}
                >
                  <Text className={`text-center font-bold text-sm ${value === opt ? 'text-white' : 'text-slate-300'}`}>
                    {opt === 'ALL' ? `All` : opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setIsOpen(false)} className="p-4 border-t border-slate-800 bg-slate-950 mt-2">
              <Text className="text-slate-400 text-xs font-bold text-center">Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

export const AdminPanelScreen: React.FC = () => {
  const navigation = useNavigation<AdminPanelScreenNavigationProp>();
  const {
    adminCreateUser,
    adminRecoverUser,
    adminDeleteUser,
    adminListUsers,
    adminListAuditLogs,
    logout,
    isLoading,
    user
  } = useAuthStore();

  const isSuperuser = user?.phoneNumber && ['+917980357754', '+919831754957'].includes(user.phoneNumber);

  const [activeTab, setActiveTab] = useState<'directory' | 'create' | 'audit' | 'courses' | 'routines' | 'admins' | 'holidays'>('directory');

  // Holidays state
  const [holidays, setHolidays] = useState<any[]>([]);
  const [holidayTitle, setHolidayTitle] = useState('');
  const [holidayDate, setHolidayDate] = useState(new Date());
  const [showHolidayDatePicker, setShowHolidayDatePicker] = useState(false);
  const [isSubmittingHoliday, setIsSubmittingHoliday] = useState(false);
  const [loadingHolidays, setLoadingHolidays] = useState(false);

  const fetchHolidays = async () => {
    try {
      setLoadingHolidays(true);
      const res = await apiClient.get('/admin/holidays');
      if (res.data.success) {
        setHolidays(res.data.data);
      }
    } catch (e) {
      console.log('Error pulling holidays:', e);
    } finally {
      setLoadingHolidays(false);
    }
  };

  const handleCreateHoliday = async () => {
    if (!holidayTitle.trim()) {
      Alert.alert('Error', 'Please enter a holiday title.');
      return;
    }
    const year = holidayDate.getFullYear();
    const month = String(holidayDate.getMonth() + 1).padStart(2, '0');
    const day = String(holidayDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    try {
      setIsSubmittingHoliday(true);
      const res = await apiClient.post('/admin/holidays', {
        date: dateStr,
        title: holidayTitle.trim(),
      });
      if (res.data.success) {
        Alert.alert('Success', 'Holiday scheduled successfully.');
        setHolidayTitle('');
        fetchHolidays();
      }
    } catch (error: any) {
      console.log('Create Holiday Error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to add holiday.');
    } finally {
      setIsSubmittingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    Alert.alert('Remove Holiday', 'Are you sure you want to delete this holiday?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await apiClient.delete(`/admin/holidays/${id}`);
            if (res.data.success) {
              Alert.alert('Success', 'Holiday deleted successfully.');
              fetchHolidays();
            }
          } catch (e: any) {
            console.log('Delete Holiday Error:', e);
            Alert.alert('Error', 'Failed to remove holiday.');
          }
        },
      },
    ]);
  };

  useEffect(() => {
    if (activeTab === 'holidays') {
      fetchHolidays();
    }
  }, [activeTab]);

  // Directory State
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'STUDENT' | 'TEACHER'>('ALL');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedSchool, setSelectedSchool] = useState<string>('ALL');
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');

  // Create User Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'STUDENT' | 'TEACHER'>('STUDENT');
  const [email, setEmail] = useState('');
  const [stream, setStream] = useState('');
  const [classText, setClassText] = useState('');
  const [faculty, setFaculty] = useState('');
  const [school, setSchool] = useState('');
  const [subjects, setSubjects] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generated Credentials Modal State
  const [showCredsModal, setShowCredsModal] = useState(false);
  const [generatedCreds, setGeneratedCreds] = useState<{
    name: string;
    phone: string;
    role: string;
    tempPass: string;
    passphrase: string;
  } | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Load Directory Users
  const loadUsers = async () => {
    const data = await adminListUsers(searchQuery, roleFilter === 'ALL' ? undefined : roleFilter);
    setUsers(data);
  };

  // Load Audit Logs
  const loadAuditLogs = async () => {
    const data = await adminListAuditLogs();
    setAuditLogs(data);
  };

  useEffect(() => {
    if (activeTab === 'directory') {
      loadUsers();
    } else if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab, roleFilter]);

  // Trigger search on typing with delay
  useEffect(() => {
    if (activeTab === 'directory') {
      const delay = setTimeout(() => {
        loadUsers();
      }, 300);
      return () => clearTimeout(delay);
    }
  }, [searchQuery]);

  const uniqueClasses = React.useMemo(() => {
    const classes = users.map(u => u.class).filter(Boolean);
    return ['ALL', ...Array.from(new Set(classes))];
  }, [users]);

  const uniqueSchools = React.useMemo(() => {
    const schools = users.map(u => u.school).filter(Boolean);
    return ['ALL', ...Array.from(new Set(schools))];
  }, [users]);

  const uniqueSubjects = React.useMemo(() => {
    const allSubjects = new Set<string>();
    users.forEach(u => {
      if (u.subjects) {
        u.subjects.split(',').forEach((s: string) => allSubjects.add(s.trim()));
      }
    });
    return ['ALL', ...Array.from(allSubjects)];
  }, [users]);

  const filteredUsers = React.useMemo(() => {
    return users.filter(user => {
      const matchesClass = selectedClass === 'ALL' || user.class === selectedClass;
      const matchesSchool = selectedSchool === 'ALL' || user.school === selectedSchool;
      const matchesSubject = selectedSubject === 'ALL' || (user.subjects && user.subjects.split(',').map((s: string)=>s.trim()).includes(selectedSubject));
      return matchesClass && matchesSchool && matchesSubject;
    });
  }, [users, selectedClass, selectedSchool, selectedSubject]);

  useEffect(() => {
    if (!uniqueClasses.includes(selectedClass)) setSelectedClass('ALL');
  }, [uniqueClasses]);

  useEffect(() => {
    if (!uniqueSchools.includes(selectedSchool)) setSelectedSchool('ALL');
  }, [uniqueSchools]);

  useEffect(() => {
    if (!uniqueSubjects.includes(selectedSubject)) setSelectedSubject('ALL');
  }, [uniqueSubjects]);

  const handleCreateSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Input Error', 'Please enter a full name.');
      return;
    }
    if (!phone || phone.length < 10) {
      Alert.alert('Input Error', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    if (role === 'STUDENT') {
      if (!stream.trim() || !classText.trim() || !school.trim()) {
        Alert.alert('Input Error', 'Stream, Class, and School are mandatory for students.');
        return;
      }
    }

    setIsSubmitting(true);
    const result = await adminCreateUser(
      name.trim(),
      phone.trim(),
      role,
      email.trim() || undefined,
      role === 'STUDENT' ? stream.trim() || undefined : undefined,
      role === 'STUDENT' ? classText.trim() || undefined : undefined,
      role === 'STUDENT' ? faculty.trim() || undefined : undefined,
      role === 'STUDENT' ? school.trim() || undefined : undefined,
      role === 'TEACHER' ? subjects.trim() || undefined : undefined
    );
    setIsSubmitting(false);

    if (result) {
      setGeneratedCreds({
        name: name.trim(),
        phone: phone.startsWith('+91') ? phone : `+91${phone}`,
        role,
        tempPass: result.temporaryPassword,
        passphrase: result.recoveryPassphrase
      });
      setShowCredsModal(true);

      // Reset form
      setName('');
      setPhone('');
      setEmail('');
      setRole('STUDENT');
      setStream('');
      setClassText('');
      setFaculty('');
      setSchool('');
      setSubjects('');
    } else {
      const errorMsg = useAuthStore.getState().error || 'Failed to create user.';
      Alert.alert('Creation Failed', errorMsg);
    }
  };
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isUpdating, setIsUpdating] = useState(false);

  const handleEditPress = (userItem: any) => {
    setEditingUser(userItem);
    setEditForm({
      name: userItem.name || '',
      email: userItem.email || '',
      stream: userItem.stream || '',
      class: userItem.class || '',
      school: userItem.school || '',
      faculty: userItem.faculty || '',
      subjects: userItem.subjects || '',
    });
  };

  const handleUpdateUser = async () => {
    if (!editForm.name?.trim()) {
      Alert.alert('Error', 'Name is required.');
      return;
    }
    setIsUpdating(true);
    const success = await useAuthStore.getState().adminUpdateUser(editingUser.id, editForm);
    setIsUpdating(false);
    if (success) {
      Alert.alert('Success', 'User updated successfully.');
      setEditingUser(null);
      loadUsers();
    } else {
      Alert.alert('Error', useAuthStore.getState().error || 'Failed to update user.');
    }
  };

  const handleRecoverPress = (userItem: any) => {
    Alert.alert(
      'Confirm Recovery Reset',
      `Are you sure you want to reset credentials for ${userItem.name}?\n\nThis will reset their password to default and regenerate their recovery passphrase immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Credentials',
          style: 'destructive',
          onPress: async () => {
            const result = await adminRecoverUser(userItem.id);
            if (result) {
              setGeneratedCreds({
                name: userItem.name,
                phone: userItem.phoneNumber,
                role: userItem.role,
                tempPass: result.temporaryPassword,
                passphrase: result.recoveryPassphrase
              });
              setShowCredsModal(true);
              loadUsers();
            }
          }
        }
      ]
    );
  };

  const handleDeletePress = (userItem: any) => {
    Alert.alert(
      'Confirm Permanent Deletion',
      `Are you sure you want to permanently delete the student/user ${userItem.name}?\n\nThis will remove all associated records (purchases, progress, results, etc.) and is irreversible.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            const success = await adminDeleteUser(userItem.id);
            if (success) {
              Alert.alert('Deleted', 'User record deleted successfully.');
              loadUsers();
            } else {
              const errorMsg = useAuthStore.getState().error || 'Failed to delete user.';
              Alert.alert('Error', errorMsg);
            }
          }
        }
      ]
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    Clipboard.setStringAsync(text);
    Alert.alert('Copied', `${label} copied to clipboard.`);
  };

  const copyAllCreds = () => {
    if (!generatedCreds) return;
    const details = `Name: ${generatedCreds.name}\nPhone: ${generatedCreds.phone}\nRole: ${generatedCreds.role}\nTemp Password: ${generatedCreds.tempPass}\nRecovery Passphrase: ${generatedCreds.passphrase}`;
    Clipboard.setStringAsync(details);
    Alert.alert('Copied', 'All credentials details copied to clipboard.');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-950 px-5 pt-14"
    >
      {/* Header */}
      <View className="flex-row justify-between items-center mb-6">
        <View className="flex-1 mr-4">
          <Text className="text-slate-100 text-2xl font-black">Admin Panel</Text>
          <Text className="text-slate-400 text-xs mt-1">LMS Account & Recovery Management</Text>
        </View>
        <View className="flex-row items-center gap-x-2">
          {navigation.canGoBack() ? (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl"
            >
              <Text className="text-slate-300 text-xs font-bold">Back</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => {
                Alert.alert('Confirm Logout', 'Are you sure you want to sign out?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Sign Out',
                    onPress: async () => {
                      await logout();
                      navigation.replace('Login');
                    },
                    style: 'destructive',
                  },
                ]);
              }}
              className="bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl"
            >
              <Text className="text-red-400 text-xs font-bold">Sign Out</Text>
            </TouchableOpacity>
          )}
          <Image
            source={require('../../../../assets/Mathemaniac_Logo_Padded.png')}
            className="w-20 h-14 rounded-full border border-slate-700/60"
            resizeMode="cover"
          />
        </View>
      </View>

      {/* Content Area */}
      {activeTab === 'directory' && (
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1" keyboardShouldPersistTaps="handled" stickyHeaderIndices={[2]}>
          {/* Geotagged Attendance Tracker Action Banner for Admin */}
          <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6">
            <View className="flex-row justify-between items-center">
              <View className="flex-1 mr-4">
                <Text className="text-slate-100 text-sm font-bold">📍 Geofenced Attendance</Text>
                <Text className="text-slate-500 text-[10px] mt-1 font-semibold leading-4">
                  Clock in and track your duty shift hours (11:00 AM - 09:00 PM) matching the geofence boundary.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('AdminAttendance' as any)}
                className="bg-[#2D8C82] border border-[#3CA79B] px-4 py-2.5 rounded-2xl active:opacity-90 shadow-md shadow-teal-500/10"
              >
                <Text className="text-white text-xs font-extrabold uppercase tracking-wider">Start Tracking</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Mini Calendar showing Holidays and Classes */}
          <MiniCalendar />

          {/* Tabs */}
          <View className="mb-6">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
              <TouchableOpacity
                onPress={() => setActiveTab('directory')}
                className={`px-4 py-2.5 rounded-xl items-center justify-center mr-1 ${
                  (activeTab as string) === 'directory' ? 'bg-slate-800' : 'bg-transparent'
                }`}
              >
                <Text className={`font-bold text-[10px] ${(activeTab as string) === 'directory' ? 'text-slate-100' : 'text-slate-400'}`}>
                  Directory
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('create')}
                className={`px-4 py-2.5 rounded-xl items-center justify-center mr-1 ${
                  (activeTab as string) === 'create' ? 'bg-slate-800' : 'bg-transparent'
                }`}
              >
                <Text className={`font-bold text-[10px] ${(activeTab as string) === 'create' ? 'text-slate-100' : 'text-slate-400'}`}>
                  Create
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('audit')}
                className={`px-4 py-2.5 rounded-xl items-center justify-center mr-1 ${
                  (activeTab as string) === 'audit' ? 'bg-slate-800' : 'bg-transparent'
                }`}
              >
                <Text className={`font-bold text-[10px] ${(activeTab as string) === 'audit' ? 'text-slate-100' : 'text-slate-400'}`}>
                  Logs
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('courses')}
                className={`px-4 py-2.5 rounded-xl items-center justify-center mr-1 ${
                  (activeTab as string) === 'courses' ? 'bg-slate-800' : 'bg-transparent'
                }`}
              >
                <Text className={`font-bold text-[10px] ${(activeTab as string) === 'courses' ? 'text-slate-100' : 'text-slate-400'}`}>
                  Courses
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('routines')}
                className={`px-4 py-2.5 rounded-xl items-center justify-center mr-1 ${
                  (activeTab as string) === 'routines' ? 'bg-slate-800' : 'bg-transparent'
                }`}
              >
                <Text className={`font-bold text-[10px] ${(activeTab as string) === 'routines' ? 'text-slate-100' : 'text-slate-400'}`}>
                  Routines
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('holidays')}
                className={`px-4 py-2.5 rounded-xl items-center justify-center mr-1 ${
                  (activeTab as string) === 'holidays' ? 'bg-slate-800' : 'bg-transparent'
                }`}
              >
                <Text className={`font-bold text-[10px] ${(activeTab as string) === 'holidays' ? 'text-slate-100' : 'text-slate-400'}`}>
                  Holidays
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('admins')}
                className={`px-4 py-2.5 rounded-xl items-center justify-center mr-1 ${
                  (activeTab as string) === 'admins' ? 'bg-slate-800' : 'bg-transparent'
                }`}
              >
                <Text className={`font-bold text-[10px] ${(activeTab as string) === 'admins' ? 'text-slate-100' : 'text-slate-400'}`}>
                  Admins
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Sticky Header Group */}
          <View className="bg-slate-950 z-10">
            {/* Filters */}
            <View className="flex-row gap-3 mb-4">
              <TextInput
                className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3.5 text-slate-300 text-sm font-semibold"
                placeholder="Search by name or phone..."
                placeholderTextColor="#8A8070"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            
            <View className="flex-row bg-slate-900/50 p-1 rounded-xl mb-4 border border-slate-800/40">
              {['ALL', 'STUDENT', 'TEACHER'].map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRoleFilter(r as any)}
                  className={`flex-1 py-2 rounded-lg items-center ${
                    roleFilter === r ? 'bg-slate-800' : 'bg-transparent'
                  }`}
                >
                  <Text className={`font-black text-[10px] uppercase tracking-wider ${
                    roleFilter === r ? 'text-slate-100' : 'text-slate-500'
                  }`}>
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Dropdown Filters in one row */}
            {users.length > 0 && (
              <View className="flex-row mb-4 bg-slate-900 border border-slate-800 rounded-2xl p-2 items-center">
                <FilterDropdown label="Class" value={selectedClass} options={uniqueClasses} onSelect={setSelectedClass} />
                <FilterDropdown label="School" value={selectedSchool} options={uniqueSchools} onSelect={setSelectedSchool} />
                <FilterDropdown label="Subject" value={selectedSubject} options={uniqueSubjects} onSelect={setSelectedSubject} />
              </View>
            )}
          </View>

          {/* User List */}
          <View className="flex-1">
            {isLoading && users.length === 0 ? (
              <View className="items-center py-20">
                <ActivityIndicator size="small" color="#2D8C82" />
              </View>
            ) : users.length === 0 ? (
              <View className="items-center py-20 bg-slate-900/10 border border-dashed border-slate-800 rounded-2xl">
                <Text className="text-slate-500 font-bold text-sm">No users found.</Text>
              </View>
            ) : filteredUsers.length === 0 ? (
              <View className="items-center py-20 bg-slate-900/10 border border-dashed border-slate-800 rounded-2xl">
                <Text className="text-slate-500 font-bold text-sm">No users match the active filters.</Text>
              </View>
            ) : (
              <View className="pb-10">
                {filteredUsers.map((item) => (
                  <View
                    key={item.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-3"
                  >
                    <View className="flex-row justify-between items-start mb-2">
                      <View className="flex-1 mr-2">
                        <Text className="text-slate-100 text-sm font-black">{item.name}</Text>
                        <Text className="text-slate-400 text-xs mt-0.5">{item.phoneNumber}</Text>
                        {item.email && <Text className="text-slate-500 text-[10px] mt-0.5">{item.email}</Text>}
                        {item.role === 'STUDENT' && (item.class || item.stream || item.faculty || item.school) && (
                          <View className="flex-row flex-wrap gap-2 mt-2">
                            {item.class && (
                              <View className="bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                                <Text className="text-[10px] text-slate-400 font-medium">Class: {item.class}</Text>
                              </View>
                            )}
                            {item.stream && (
                              <View className="bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                                <Text className="text-[10px] text-slate-400 font-medium">Stream: {item.stream}</Text>
                              </View>
                            )}
                            {item.school && (
                              <View className="bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                                <Text className="text-[10px] text-slate-400 font-medium">School: {item.school}</Text>
                              </View>
                            )}
                            {item.faculty && (
                              <View className="bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                                <Text className="text-[10px] text-slate-400 font-medium">Faculty: {item.faculty}</Text>
                              </View>
                            )}
                          </View>
                        )}
                        {item.subjects && (
                          <View className="mt-2">
                            <Text className="text-[10px] text-slate-400 font-medium">Subjects: {item.subjects}</Text>
                          </View>
                        )}
                      </View>
                      <View className={`px-2.5 py-0.5 rounded-full border ${
                        item.role === 'TEACHER' ? 'bg-purple-900/20 border-purple-500/30' : 'bg-blue-900/20 border-blue-500/30'
                      }`}>
                        <Text className={`text-[8px] font-black uppercase tracking-wider ${
                          item.role === 'TEACHER' ? 'text-purple-400' : 'text-blue-400'
                        }`}>
                          {item.role}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-slate-850">
                      <View className="flex-row items-center">
                        <View className={`w-2 h-2 rounded-full mr-1.5 ${item.firstLogin ? 'bg-amber-500' : 'bg-green-500'}`} />
                        <Text className="text-[10px] text-slate-500 font-semibold">
                          {item.firstLogin ? 'Temp Password active' : 'Password changed'}
                        </Text>
                      </View>
                      <View className="flex-row gap-2 mt-2">
                        <TouchableOpacity
                          onPress={() => handleEditPress(item)}
                          className="bg-slate-700/50 border border-slate-600/50 px-3 py-1.5 rounded-xl"
                        >
                          <Text className="text-slate-300 text-[10px] font-bold">Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleRecoverPress(item)}
                          className="bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-xl"
                        >
                          <Text className="text-blue-400 text-[10px] font-bold">Reset & Recover</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeletePress(item)}
                          className="bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-xl"
                        >
                          <Text className="text-red-400 text-[10px] font-bold">Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {activeTab !== 'directory' && (
        <View className="mb-6">
          {/* Tabs for non-directory */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
            <TouchableOpacity
              onPress={() => setActiveTab('directory')}
              className={`px-4 py-2.5 rounded-xl items-center justify-center mr-1 ${
                (activeTab as string) === 'directory' ? 'bg-slate-800' : 'bg-transparent'
              }`}
            >
              <Text className={`font-bold text-[10px] ${(activeTab as string) === 'directory' ? 'text-slate-100' : 'text-slate-400'}`}>
                Directory
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('create')}
              className={`px-4 py-2.5 rounded-xl items-center justify-center mr-1 ${
                (activeTab as string) === 'create' ? 'bg-slate-800' : 'bg-transparent'
              }`}
            >
              <Text className={`font-bold text-[10px] ${(activeTab as string) === 'create' ? 'text-slate-100' : 'text-slate-400'}`}>
                Create
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('audit')}
              className={`px-4 py-2.5 rounded-xl items-center justify-center mr-1 ${
                (activeTab as string) === 'audit' ? 'bg-slate-800' : 'bg-transparent'
              }`}
            >
              <Text className={`font-bold text-[10px] ${(activeTab as string) === 'audit' ? 'text-slate-100' : 'text-slate-400'}`}>
                Logs
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('courses')}
              className={`px-4 py-2.5 rounded-xl items-center justify-center mr-1 ${
                (activeTab as string) === 'courses' ? 'bg-slate-800' : 'bg-transparent'
              }`}
            >
              <Text className={`font-bold text-[10px] ${(activeTab as string) === 'courses' ? 'text-slate-100' : 'text-slate-400'}`}>
                Courses
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('routines')}
              className={`px-4 py-2.5 rounded-xl items-center justify-center mr-1 ${
                (activeTab as string) === 'routines' ? 'bg-slate-800' : 'bg-transparent'
              }`}
            >
              <Text className={`font-bold text-[10px] ${(activeTab as string) === 'routines' ? 'text-slate-100' : 'text-slate-400'}`}>
                Routines
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('holidays')}
              className={`px-4 py-2.5 rounded-xl items-center justify-center mr-1 ${
                (activeTab as string) === 'holidays' ? 'bg-slate-800' : 'bg-transparent'
              }`}
            >
              <Text className={`font-bold text-[10px] ${(activeTab as string) === 'holidays' ? 'text-slate-100' : 'text-slate-400'}`}>
                Holidays
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('admins')}
              className={`px-4 py-2.5 rounded-xl items-center justify-center mr-1 ${
                (activeTab as string) === 'admins' ? 'bg-slate-800' : 'bg-transparent'
              }`}
            >
              <Text className={`font-bold text-[10px] ${(activeTab as string) === 'admins' ? 'text-slate-100' : 'text-slate-400'}`}>
                Admins
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {activeTab === 'create' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 200 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-10">
            <Text className="text-slate-100 text-base font-bold mb-5">Create New Account</Text>

            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Full Name</Text>
            <TextInput
              className="bg-slate-800 border border-slate-700/50 rounded-xl px-4 py-3 text-slate-300 text-sm font-semibold mb-4"
              placeholder="e.g. Mr. X"
              placeholderTextColor="#64748b"
              value={name}
              onChangeText={setName}
            />

            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Mobile Number</Text>
            <TextInput
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-sm font-semibold mb-4"
              placeholder="e.g. 7980357754"
              placeholderTextColor="#5C5446"
              keyboardType="number-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={10}
            />

            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Email Address (Optional)</Text>
            <TextInput
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-sm font-semibold mb-4"
              placeholder="e.g. student@outlook.com"
              placeholderTextColor="#5C5446"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-3">User Role</Text>
            <View className="flex-row bg-slate-950 p-1 rounded-xl mb-6 border border-slate-800">
              <TouchableOpacity
                onPress={() => setRole('STUDENT')}
                className={`flex-1 py-2.5 rounded-lg items-center ${
                  role === 'STUDENT' ? 'bg-slate-800' : 'bg-transparent'
                }`}
              >
                <Text className={`font-black text-[10px] uppercase tracking-wider ${
                  role === 'STUDENT' ? 'text-slate-100' : 'text-slate-500'
                }`}>
                  Student
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setRole('TEACHER')}
                className={`flex-1 py-2.5 rounded-lg items-center ${
                  role === 'TEACHER' ? 'bg-slate-800' : 'bg-transparent'
                }`}
              >
                <Text className={`font-black text-[10px] uppercase tracking-wider ${
                  role === 'TEACHER' ? 'text-slate-100' : 'text-slate-500'
                }`}>
                  Teacher
                </Text>
              </TouchableOpacity>
            </View>

            {role === 'STUDENT' && (
              <View className="mb-4">
                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Stream (Optional)</Text>
                <TextInput
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-sm font-semibold mb-4"
                  placeholder="e.g. Science / Commerce / Arts"
                  placeholderTextColor="#5C5446"
                  value={stream}
                  onChangeText={setStream}
                />

                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Class (Optional)</Text>
                <TextInput
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-sm font-semibold mb-4"
                  placeholder="e.g. 11th / 12th"
                  placeholderTextColor="#5C5446"
                  value={classText}
                  onChangeText={setClassText}
                />

                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">School (Optional)</Text>
                <TextInput
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-sm font-semibold mb-4"
                  placeholder="e.g. Delhi Public School"
                  placeholderTextColor="#5C5446"
                  value={school}
                  onChangeText={setSchool}
                />

                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Faculty (Optional)</Text>
                <TextInput
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-sm font-semibold mb-4"
                  placeholder="e.g. Prof. S. Sen"
                  placeholderTextColor="#5C5446"
                  value={faculty}
                  onChangeText={setFaculty}
                />
              </View>
            )}

            <View className="mb-4 z-50">
              <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Subjects (Comma separated)</Text>
              <TextInput
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-sm font-semibold mb-4"
                placeholder="e.g. Mathematics, Physics"
                placeholderTextColor="#5C5446"
                value={subjects}
                onChangeText={setSubjects}
              />
              {(() => {
                const parts = subjects.split(',');
                const lastPart = parts[parts.length - 1].trim().toLowerCase();
                if (lastPart.length > 0) {
                  const suggestions = uniqueSubjects.filter(s => s.toLowerCase().includes(lastPart) && s.toLowerCase() !== lastPart);
                  if (suggestions.length > 0) {
                    return (
                      <View className="bg-slate-800 border border-slate-700 rounded-xl mb-4 overflow-hidden shadow-sm shadow-black/20">
                        {suggestions.map(s => (
                          <TouchableOpacity 
                            key={s} 
                            className="px-4 py-3 border-b border-slate-700/50"
                            onPress={() => {
                              const newParts = [...parts];
                              newParts[newParts.length - 1] = newParts.length > 1 ? ' ' + s : s;
                              setSubjects(newParts.join(','));
                            }}
                          >
                            <Text className="text-slate-200 text-xs font-bold">{s}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    );
                  }
                }
                return null;
              })()}
            </View>

            <Button
              title="Generate Credentials & Create"
              onPress={handleCreateSubmit}
              loading={isSubmitting}
            />
          </View>
        </ScrollView>
      )}

      {activeTab === 'audit' && (
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          {isLoading && auditLogs.length === 0 ? (
            <View className="items-center py-20">
              <ActivityIndicator size="small" color="#2D8C82" />
            </View>
          ) : auditLogs.length === 0 ? (
            <View className="items-center py-20 bg-slate-900/10 border border-dashed border-slate-800 rounded-2xl">
              <Text className="text-slate-500 font-bold text-sm">No audit logs found.</Text>
            </View>
          ) : (
            <View className="pb-10">
              {auditLogs.map((log) => (
                <View
                  key={log.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-3"
                >
                  <View className="flex-row justify-between items-center mb-1.5">
                    <Text className="text-slate-100 text-xs font-black uppercase tracking-wide">
                      {log.action}
                    </Text>
                    <Text className="text-slate-500 text-[9px] font-bold">
                      {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text className="text-slate-400 text-xs leading-4">{log.details}</Text>
                  <Text className="text-slate-650 text-[9px] mt-1.5 font-semibold">Log ID: {log.id}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {activeTab === 'courses' && (
        <View className="flex-1">
          <AdminCoursesTab />
        </View>
      )}

      {activeTab === 'routines' && (
        <View className="flex-1">
          <AdminRoutineTab />
        </View>
      )}

      {activeTab === 'admins' && (
        <View className="flex-1">
          <SuperuserAdminManagementTab />
        </View>
      )}

      {activeTab === 'holidays' && (
        <ScrollView className="flex-1 px-5 mt-4" contentContainerStyle={{ paddingBottom: 60 }}>
          <View className="bg-slate-900 border border-slate-850 rounded-3xl p-5 mb-6 shadow-2xl">
            <Text className="text-slate-100 text-base font-black mb-4">Schedule a Holiday</Text>

            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Holiday Title</Text>
            <TextInput
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-slate-300 text-sm font-semibold mb-4"
              placeholder="e.g. Independence Day"
              placeholderTextColor="#5C5446"
              value={holidayTitle}
              onChangeText={setHolidayTitle}
            />

            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Select Date</Text>
            <TouchableOpacity
              onPress={() => setShowHolidayDatePicker(true)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 mb-5 justify-center"
            >
              <Text className="text-slate-300 text-sm font-semibold">
                {holidayDate.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
            </TouchableOpacity>

            {showHolidayDatePicker && (
              <DateTimePicker
                value={holidayDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => {
                  setShowHolidayDatePicker(false);
                  if (date) setHolidayDate(date);
                }}
              />
            )}

            <TouchableOpacity
              onPress={handleCreateHoliday}
              disabled={isSubmittingHoliday}
              className="bg-[#2D8C82] border border-[#237068] py-4 rounded-2xl items-center shadow-lg active:opacity-90"
            >
              {isSubmittingHoliday ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-white text-xs font-black uppercase tracking-wider">Add Holiday</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Current Year Holidays List */}
          <Text className="text-slate-500 text-[10px] font-black uppercase tracking-wider mb-3">Scheduled Holidays</Text>
          {loadingHolidays ? (
            <ActivityIndicator size="small" color="#2D8C82" className="py-6" />
          ) : holidays.length > 0 ? (
            holidays.map((h) => (
              <View key={h.id} className="bg-slate-900 border border-slate-850 rounded-2xl p-4 mb-3 shadow flex-row justify-between items-center">
                <View className="flex-1 mr-4">
                  <Text className="text-slate-100 text-sm font-black">{h.title}</Text>
                  <Text className="text-slate-400 text-xs mt-0.5">
                    {new Date(h.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteHoliday(h.id)}
                  className="bg-red-500/10 border border-red-500/20 px-3.5 py-2 rounded-xl active:opacity-90"
                >
                  <Text className="text-red-400 font-extrabold text-[10px] uppercase">Remove</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View className="bg-slate-900/20 border border-slate-850 rounded-2xl py-8 items-center justify-center">
              <Text className="text-slate-500 text-xs font-bold">No holidays scheduled yet.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Generated Credentials Modal (Shown ONLY ONCE) */}
      <Modal visible={showCredsModal} transparent animationType="fade" onRequestClose={() => setShowCredsModal(false)}>
        <View className="flex-1 justify-center items-center bg-slate-950/90 px-6">
          <View style={{ maxWidth: 400 }} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full">
            <View className="items-center mb-4">
              <Text className="text-4xl mb-2">🔑</Text>
              <Text className="text-slate-100 text-lg font-black">Account Credentials</Text>
              <Text className="text-amber-500 text-[10px] font-black uppercase tracking-wider mt-1 text-center bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                ⚠️ Displayed Only Once
              </Text>
            </View>

            {generatedCreds && (
              <View className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 mb-6 space-y-3">
                <View className="flex-row justify-between items-center pb-2 border-b border-slate-900">
                  <Text className="text-slate-500 text-[9px] font-black uppercase">Name</Text>
                  <Text className="text-slate-200 text-xs font-bold">{generatedCreds.name}</Text>
                </View>
                <View className="flex-row justify-between items-center pb-2 border-b border-slate-900">
                  <Text className="text-slate-500 text-[9px] font-black uppercase">Phone</Text>
                  <Text className="text-slate-200 text-xs font-bold">{generatedCreds.phone}</Text>
                </View>
                <View className="flex-row justify-between items-center pb-2 border-b border-slate-900">
                  <Text className="text-slate-500 text-[9px] font-black uppercase">Role</Text>
                  <Text className="text-slate-200 text-xs font-bold">{generatedCreds.role}</Text>
                </View>
                <View className="flex-row justify-between items-center pb-2 border-b border-slate-900">
                  <Text className="text-slate-500 text-[9px] font-black uppercase">Temp Password</Text>
                  <View className="flex-row items-center">
                    <Text className="text-emerald-400 text-xs font-black mr-2 select-text">{generatedCreds.tempPass}</Text>
                    <TouchableOpacity onPress={() => copyToClipboard(generatedCreds.tempPass, 'Temporary Password')}>
                      <Text className="text-blue-400 text-[10px] font-bold">Copy</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-slate-500 text-[9px] font-black uppercase">Passphrase</Text>
                  <View className="flex-row items-center">
                    <Text className="text-blue-400 text-xs font-black mr-2 select-text">{generatedCreds.passphrase}</Text>
                    <TouchableOpacity onPress={() => copyToClipboard(generatedCreds.passphrase, 'Recovery Passphrase')}>
                      <Text className="text-blue-400 text-[10px] font-bold">Copy</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            <Text className="text-slate-500 text-[10px] leading-4 text-center mb-6">
              Make sure to copy these details now. Plaintext passwords and passphrases are not stored in the database and cannot be recovered later.
            </Text>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={copyAllCreds}
                className="flex-1 bg-slate-800 border border-slate-700/50 py-3.5 rounded-2xl items-center justify-center"
              >
                <Text className="text-slate-200 text-xs font-bold">Copy All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowCredsModal(false)}
                className="flex-1 bg-blue-600 py-3.5 rounded-2xl items-center justify-center shadow-lg shadow-blue-500/20"
              >
                <Text className="text-white text-xs font-bold">Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit User Modal */}
      <Modal visible={!!editingUser} animationType="slide" transparent onRequestClose={() => setEditingUser(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/80">
          <View className="bg-slate-950 rounded-t-3xl h-[85%] border-t border-slate-800">
            <View className="flex-row justify-between items-center p-5 border-b border-slate-850">
              <Text className="text-slate-100 text-lg font-black">Edit User</Text>
              <TouchableOpacity onPress={() => setEditingUser(null)} className="bg-slate-800 px-4 py-2 rounded-xl border border-slate-700/50">
                <Text className="text-slate-300 font-bold text-xs">Cancel</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView className="flex-1 p-5" contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
              <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Full Name</Text>
              <TextInput
                className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-sm font-semibold mb-4"
                value={editForm.name}
                onChangeText={(t) => setEditForm({...editForm, name: t})}
              />

              <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Email Address</Text>
              <TextInput
                className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-sm font-semibold mb-4"
                value={editForm.email}
                onChangeText={(t) => setEditForm({...editForm, email: t})}
                keyboardType="email-address"
              />

              {editingUser?.role === 'STUDENT' && (
                <View>
                  <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Stream</Text>
                  <TextInput
                    className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-sm font-semibold mb-4"
                    value={editForm.stream}
                    onChangeText={(t) => setEditForm({...editForm, stream: t})}
                  />

                  <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Class</Text>
                  <TextInput
                    className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-sm font-semibold mb-4"
                    value={editForm.class}
                    onChangeText={(t) => setEditForm({...editForm, class: t})}
                  />

                  <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">School</Text>
                  <TextInput
                    className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-sm font-semibold mb-4"
                    value={editForm.school}
                    onChangeText={(t) => setEditForm({...editForm, school: t})}
                  />

                  <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Faculty</Text>
                  <TextInput
                    className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-sm font-semibold mb-4"
                    value={editForm.faculty}
                    onChangeText={(t) => setEditForm({...editForm, faculty: t})}
                  />
                </View>
              )}

              <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Subjects (Comma separated)</Text>
              <TextInput
                className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-sm font-semibold mb-4"
                value={editForm.subjects}
                onChangeText={(t) => setEditForm({...editForm, subjects: t})}
              />

              <View className="mb-20">
                <Button title="Save Changes" onPress={handleUpdateUser} loading={isUpdating} />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
};

export default AdminPanelScreen;
