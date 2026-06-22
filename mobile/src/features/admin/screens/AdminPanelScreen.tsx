import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Modal, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../../navigation/types';
import { useAuthStore } from '../../../core/store/auth';
import { Button } from '../../../shared/components/Button';
import { AdminCoursesTab } from './AdminCoursesTab';

type AdminPanelScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AdminPanel'>;

export const AdminPanelScreen: React.FC = () => {
  const navigation = useNavigation<AdminPanelScreenNavigationProp>();
  const {
    adminCreateUser,
    adminRecoverUser,
    adminDeleteUser,
    adminListUsers,
    adminListAuditLogs,
    logout,
    isLoading
  } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'directory' | 'create' | 'audit' | 'courses'>('directory');

  // Directory State
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'STUDENT' | 'TEACHER'>('ALL');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedSchool, setSelectedSchool] = useState<string>('ALL');

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

  const filteredUsers = React.useMemo(() => {
    return users.filter(user => {
      const matchesClass = selectedClass === 'ALL' || user.class === selectedClass;
      const matchesSchool = selectedSchool === 'ALL' || user.school === selectedSchool;
      return matchesClass && matchesSchool;
    });
  }, [users, selectedClass, selectedSchool]);

  useEffect(() => {
    if (!uniqueClasses.includes(selectedClass)) {
      setSelectedClass('ALL');
    }
  }, [uniqueClasses]);

  useEffect(() => {
    if (!uniqueSchools.includes(selectedSchool)) {
      setSelectedSchool('ALL');
    }
  }, [uniqueSchools]);

  const handleCreateSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Input Error', 'Please enter a full name.');
      return;
    }
    if (!phone || phone.length < 10) {
      Alert.alert('Input Error', 'Please enter a valid 10-digit mobile number.');
      return;
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
        <View>
          <Text className="text-slate-100 text-2xl font-black">Admin Panel</Text>
          <Text className="text-slate-400 text-xs mt-1">LMS Account & Recovery Management</Text>
        </View>
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
      </View>

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
            onPress={() => navigation.navigate('TeacherAttendanceTracking')}
            className="bg-[#2D8C82] border border-[#3CA79B] px-4 py-2.5 rounded-2xl active:opacity-90 shadow-md shadow-teal-500/10"
          >
            <Text className="text-white text-xs font-extrabold uppercase tracking-wider">Start Tracking</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row bg-slate-900 p-1.5 rounded-2xl mb-6 border border-slate-800">
        <TouchableOpacity
          onPress={() => setActiveTab('directory')}
          className={`flex-1 py-3 rounded-xl items-center justify-center ${
            activeTab === 'directory' ? 'bg-slate-800' : 'bg-transparent'
          }`}
        >
          <Text className={`font-bold text-[10px] ${activeTab === 'directory' ? 'text-slate-100' : 'text-slate-400'}`}>
            Directory
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('create')}
          className={`flex-1 py-3 rounded-xl items-center justify-center ${
            activeTab === 'create' ? 'bg-slate-800' : 'bg-transparent'
          }`}
        >
          <Text className={`font-bold text-[10px] ${activeTab === 'create' ? 'text-slate-100' : 'text-slate-400'}`}>
            Create
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('audit')}
          className={`flex-1 py-3 rounded-xl items-center justify-center ${
            activeTab === 'audit' ? 'bg-slate-800' : 'bg-transparent'
          }`}
        >
          <Text className={`font-bold text-[10px] ${activeTab === 'audit' ? 'text-slate-100' : 'text-slate-400'}`}>
            Logs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('courses')}
          className={`flex-1 py-3 rounded-xl items-center justify-center ${
            activeTab === 'courses' ? 'bg-slate-800' : 'bg-transparent'
          }`}
        >
          <Text className={`font-bold text-[10px] ${activeTab === 'courses' ? 'text-slate-100' : 'text-slate-400'}`}>
            Courses
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      {activeTab === 'directory' && (
        <View className="flex-1">
          {/* Filters */}
          <View className="flex-row gap-3 mb-4">
            <TextInput
              className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3.5 text-slate-100 text-sm font-semibold"
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

          {/* Class & School Filter Badges */}
          {users.length > 0 && (
            <View className="mb-4">
              {/* Class Filter */}
              {uniqueClasses.length > 2 && (
                <View className="mb-3">
                  <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider mb-1.5">Filter by Class</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                    {uniqueClasses.map((cls) => (
                      <TouchableOpacity
                        key={cls}
                        onPress={() => setSelectedClass(cls)}
                        className={`mr-2 px-3 py-1.5 rounded-xl border ${
                          selectedClass === cls
                            ? 'bg-blue-600 border-blue-500'
                            : 'bg-slate-900 border-slate-800'
                        }`}
                      >
                        <Text className={`text-[10px] font-bold ${
                          selectedClass === cls ? 'text-white' : 'text-slate-400'
                        }`}>
                          {cls === 'ALL' ? 'All Classes' : cls}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* School Filter */}
              {uniqueSchools.length > 2 && (
                <View className="mb-2">
                  <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider mb-1.5">Filter by School</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                    {uniqueSchools.map((sch) => (
                      <TouchableOpacity
                        key={sch}
                        onPress={() => setSelectedSchool(sch)}
                        className={`mr-2 px-3 py-1.5 rounded-xl border ${
                          selectedSchool === sch
                            ? 'bg-blue-600 border-blue-500'
                            : 'bg-slate-900 border-slate-800'
                        }`}
                      >
                        <Text className={`text-[10px] font-bold ${
                          selectedSchool === sch ? 'text-white' : 'text-slate-400'
                        }`}>
                          {sch === 'ALL' ? 'All Schools' : sch}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* User List */}
          <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
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
                        {item.role === 'TEACHER' && item.subjects && (
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
                      <View className="flex-row gap-2">
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
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold mb-4"
              placeholder="e.g. Raunak Dey"
              placeholderTextColor="#5C5446"
              value={name}
              onChangeText={setName}
            />

            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Mobile Number</Text>
            <TextInput
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold mb-4"
              placeholder="e.g. 7980357754"
              placeholderTextColor="#5C5446"
              keyboardType="number-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={10}
            />

            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Email Address (Optional)</Text>
            <TextInput
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold mb-4"
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
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold mb-4"
                  placeholder="e.g. Science / Commerce / Arts"
                  placeholderTextColor="#5C5446"
                  value={stream}
                  onChangeText={setStream}
                />

                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Class (Optional)</Text>
                <TextInput
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold mb-4"
                  placeholder="e.g. 11th / 12th"
                  placeholderTextColor="#5C5446"
                  value={classText}
                  onChangeText={setClassText}
                />

                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">School (Optional)</Text>
                <TextInput
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold mb-4"
                  placeholder="e.g. Delhi Public School"
                  placeholderTextColor="#5C5446"
                  value={school}
                  onChangeText={setSchool}
                />

                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Faculty (Optional)</Text>
                <TextInput
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold mb-4"
                  placeholder="e.g. Prof. S. Sen"
                  placeholderTextColor="#5C5446"
                  value={faculty}
                  onChangeText={setFaculty}
                />
              </View>
            )}

            {role === 'TEACHER' && (
              <View className="mb-4">
                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Subjects</Text>
                <TextInput
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold mb-4"
                  placeholder="e.g. Mathematics, Physics"
                  placeholderTextColor="#5C5446"
                  value={subjects}
                  onChangeText={setSubjects}
                />
              </View>
            )}

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

      {activeTab === 'courses' && <AdminCoursesTab />}

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
    </KeyboardAvoidingView>
  );
};
