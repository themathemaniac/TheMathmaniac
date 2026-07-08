import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Modal, TextInput, Alert } from 'react-native';
import { apiClient } from '../../../core/api/client';
import { formatDateString } from '../../../shared/utils/calendar';

interface TeacherAttendanceCalendarProps {
  courses: any[];
}

export const TeacherAttendanceCalendar: React.FC<TeacherAttendanceCalendarProps> = ({ courses }) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const [monthLogs, setMonthLogs] = useState<Record<string, string>>({});
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedCourseName, setSelectedCourseName] = useState<string>('');
  
  const [roster, setRoster] = useState<{ id: string; name: string; status: 'PRESENT' | 'ABSENT' }[]>([]);
  const [dayStatus, setDayStatus] = useState<'CLASS_HELD' | 'CANCELLED' | 'HOLIDAY'>('CLASS_HELD');
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState('');

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const fetchMonthLogs = async () => {
    try {
      const response = await apiClient.get('/attendance/month-summary', {
        params: { month: currentMonth + 1, year: currentYear }
      });
      if (response.data.success) {
        setMonthLogs(response.data.data);
      }
    } catch (e) {
      console.log('Error fetching month summary:', e);
    }
  };

  useEffect(() => {
    fetchMonthLogs();
  }, [currentMonth, currentYear]);

  // Calendar calculations
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0-6
  const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

  const daysArray: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) daysArray.push(null);
  for (let i = 1; i <= totalDays; i++) daysArray.push(i);

  const rows: (number | null)[][] = [];
  let tempRow: (number | null)[] = [];
  daysArray.forEach((day, index) => {
    tempRow.push(day);
    if (tempRow.length === 7 || index === daysArray.length - 1) {
      while (tempRow.length < 7) tempRow.push(null);
      rows.push(tempRow);
      tempRow = [];
    }
  });

  const handlePrevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));

  const getFullDayName = (shortDay: string) => {
    const map: Record<string, string> = { 'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday' };
    return map[shortDay] || shortDay;
  };

  // Determine what classes happen on a specific date string
  const getCoursesForDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const fullWeekDaysMap: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 0: 'Sun' };
    const dayOfWeek = fullWeekDaysMap[d.getDay()];

    return courses.filter(course => {
      let slots: any[] = [];
      try {
        slots = typeof course.timeSlots === 'string' ? JSON.parse(course.timeSlots) : (course.timeSlots || []);
      } catch (e) {}
      return slots.some(slot => slot.day === dayOfWeek || slot.day === getFullDayName(dayOfWeek));
    });
  };

  const isFutureDate = (dateStr: string) => {
    const checkDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return checkDate > today;
  };

  const requiresReason = () => {
    if (!selectedDateStr) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const target = new Date(selectedDateStr);
    target.setHours(0, 0, 0, 0);
    
    const diffTime = today.getTime() - target.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays >= 2;
  };

  const openAttendanceModal = async (course: any) => {
    if (isFutureDate(selectedDateStr)) {
      Alert.alert('Future Date', 'Cannot mark attendance for future dates.');
      return;
    }
    
    setSelectedCourseId(course.id);
    setSelectedCourseName(course.title);
    setReason('');
    setModalVisible(true);
    setLoadingRoster(true);
    
    try {
      const response = await apiClient.get('/attendance', {
        params: { date: selectedDateStr, courseId: course.id }
      });
      
      if (response.data.success) {
        const { dayStatus: dbDayStatus, roster: dbRoster } = response.data.data;
        setDayStatus(dbDayStatus || 'CLASS_HELD');
        
        const mappedRoster = dbRoster.map((student: any) => ({
          id: student.id,
          name: student.name,
          status: (student.status === 'ABSENT' ? 'ABSENT' : 'PRESENT') as 'PRESENT' | 'ABSENT'
        }));
        setRoster(mappedRoster);
      }
    } catch (e: any) {
      console.error('[Fetch Roster Error]', e);
      Alert.alert('Error', e.response?.data?.error || 'Failed to load student roster.');
      setModalVisible(false);
    } finally {
      setLoadingRoster(false);
    }
  };

  const handleToggleStudentStatus = (studentId: string, status: 'PRESENT' | 'ABSENT') => {
    setRoster(prev => prev.map(student => 
      student.id === studentId ? { ...student, status } : student
    ));
  };

  const handleSaveAttendance = async () => {
    if (!selectedDateStr || !selectedCourseId) return;
    
    if (requiresReason() && reason.trim() === '') {
      Alert.alert('Reason Required', 'Please enter a reason for this retroactive attendance change.');
      return;
    }

    setSaving(true);
    
    try {
      const records = roster.map(student => ({
        studentId: student.id,
        status: student.status
      }));

      const response = await apiClient.post('/attendance', {
        date: selectedDateStr,
        courseId: selectedCourseId,
        dayStatus,
        records,
        reason: requiresReason() ? reason.trim() : undefined
      });

      if (response.data.success) {
        Alert.alert('Success', 'Attendance recorded successfully.');
        setModalVisible(false);
        fetchMonthLogs();
      }
    } catch (e: any) {
      console.error('[Save Attendance Error]', e);
      Alert.alert('Error', e.response?.data?.error || 'Failed to save attendance.');
    } finally {
      setSaving(false);
    }
  };

  const presentCount = roster.filter(s => s.status === 'PRESENT').length;
  const absentCount = roster.filter(s => s.status === 'ABSENT').length;

  const selectedDayCourses = getCoursesForDate(selectedDateStr);
  const isSelectedHoliday = monthLogs[selectedDateStr] === 'HOLIDAY';

  return (
    <View className="bg-slate-900 border border-slate-850 rounded-3xl p-5 mb-6 shadow-2xl">
      {/* Calendar Header */}
      <View className="flex-row justify-between items-center mb-4">
        <View>
          <Text className="text-slate-500 text-[10px] font-black uppercase tracking-wider">Institute Calendar</Text>
          <Text className="text-slate-100 text-base font-black mt-0.5">{monthNames[currentMonth]} {currentYear}</Text>
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={handlePrevMonth} className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl active:opacity-90">
            <Text className="text-slate-300 font-bold text-xs">◀</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNextMonth} className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl active:opacity-90">
            <Text className="text-slate-300 font-bold text-xs">▶</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Days of Week Headers */}
      <View className="flex-row justify-between mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((dayHeader, idx) => (
          <Text key={idx} className="w-[12%] text-center text-slate-500 text-[10px] font-bold">
            {dayHeader}
          </Text>
        ))}
      </View>

      {/* Calendar Grid */}
      <View className="space-y-1">
        {rows.map((week, weekIdx) => (
          <View key={weekIdx} className="flex-row justify-between">
            {week.map((dayNum, dayIdx) => {
              if (dayNum === null) {
                return <View key={dayIdx} className="w-[12%] h-9" />;
              }

              const formattedDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const hasClasses = getCoursesForDate(formattedDateStr).length > 0;
              const hasHoliday = monthLogs[formattedDateStr] === 'HOLIDAY';
              
              const isSelected = selectedDateStr === formattedDateStr;

              let dayBg = 'bg-transparent';
              let dayText = 'text-slate-300';
              let borderStyle = 'border-transparent';

              if (isSelected) {
                dayBg = 'bg-[#2D8C82]';
                dayText = 'text-white font-extrabold';
              } else if (hasHoliday) {
                dayBg = 'bg-red-500/10';
                dayText = 'text-red-400 font-bold';
                borderStyle = 'border-red-500/20';
              } else if (hasClasses) {
                dayBg = 'bg-blue-500/10';
                dayText = 'text-blue-400 font-bold';
                borderStyle = 'border-blue-500/20';
              }

              return (
                <TouchableOpacity
                  key={dayIdx}
                  onPress={() => setSelectedDateStr(formattedDateStr)}
                  className={`w-[12%] h-9 rounded-xl border justify-center items-center ${dayBg} ${borderStyle}`}
                >
                  <Text className={`text-xs ${dayText}`}>{dayNum}</Text>
                  
                  {/* Indicator Dot */}
                  {!isSelected && (hasHoliday || hasClasses) && (
                    <View className="flex-row gap-0.5 absolute bottom-1 justify-center">
                      {hasHoliday && <View className="w-1 h-1 rounded-full bg-red-400" />}
                      {hasClasses && !hasHoliday && <View className="w-1 h-1 rounded-full bg-blue-400" />}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Selected Day Agenda */}
      <View className="mt-4 pt-4 border-t border-slate-850">
        <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider mb-2">
          Agenda: {new Date(selectedDateStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
        
        {isSelectedHoliday && (
          <View className="p-3 rounded-2xl border mb-2 flex-row justify-between items-center bg-red-500/5 border-red-500/15">
            <View className="flex-1 mr-2">
              <Text className="text-xs font-black text-red-400">Institute Holiday</Text>
              <Text className="text-slate-400 text-[10px] mt-0.5 leading-4">No regular classes are held today.</Text>
            </View>
            <View className="px-2 py-0.5 rounded-lg bg-red-500/10">
              <Text className="text-[8px] font-black uppercase text-red-400">HOLIDAY</Text>
            </View>
          </View>
        )}

        {!isSelectedHoliday && selectedDayCourses.length === 0 && (
          <Text className="text-slate-600 text-[11px] font-bold text-center py-2">No classes scheduled for you on this date.</Text>
        )}

        {selectedDayCourses.map((course, index) => (
          <View
            key={index}
            className="p-3 rounded-2xl border mb-2 flex-row justify-between items-center bg-blue-500/5 border-blue-500/15"
          >
            <View className="flex-1 mr-2">
              <Text className="text-xs font-black text-slate-100">{course.title}</Text>
              <Text className="text-slate-400 text-[10px] mt-0.5 leading-4">
                {course.targetClass ? `Class ${course.targetClass}` : course.category?.name || 'Program'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => openAttendanceModal(course)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 border border-blue-500 active:bg-blue-700"
            >
              <Text className="text-[9px] font-black uppercase text-white tracking-wider">Mark</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Roster Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-slate-950/80">
          <View className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-6 h-[80%]">
            <View className="flex-row justify-between items-center mb-4 pb-3 border-b border-slate-800">
              <View className="flex-1 mr-4">
                <Text className="text-slate-100 text-base font-black">Class Attendance</Text>
                <Text className="text-slate-400 text-[10px] font-medium mt-0.5">
                  {selectedDateStr} • {selectedCourseName}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} className="bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-700/50">
                <Text className="text-slate-100 text-xs font-bold">Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1 mb-4">
              {/* Day Type Selector */}
              <View className="mb-4">
                <Text className="text-slate-400 text-[10px] font-black mb-2 uppercase tracking-wider">
                  Status for {selectedCourseName}
                </Text>
                <View className="flex-row bg-slate-950/50 p-1 rounded-2xl border border-slate-850">
                  {(['CLASS_HELD', 'CANCELLED', 'HOLIDAY'] as const).map((statusOption) => {
                    const label = statusOption === 'CLASS_HELD' ? 'Class Held' : statusOption === 'CANCELLED' ? 'Leave' : 'Holiday';
                    const active = dayStatus === statusOption;
                    return (
                      <TouchableOpacity
                        key={statusOption}
                        onPress={() => setDayStatus(statusOption)}
                        className={`flex-1 py-2 rounded-xl items-center justify-center ${active ? 'bg-slate-800 border border-slate-700/30' : 'bg-transparent'}`}
                      >
                        <Text className={`text-[11px] font-bold ${active ? 'text-slate-100' : 'text-slate-500'}`}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Retroactive Warning */}
              {!loadingRoster && requiresReason() && (
                <View className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                  <Text className="text-amber-400 text-xs font-bold mb-1">⚠️ Retroactive Change Required</Text>
                  <Text className="text-slate-400 text-[10px] leading-4 mb-3">This date is past the 24-hour grace period. Please provide a brief reason.</Text>
                  <TextInput
                    value={reason}
                    onChangeText={setReason}
                    placeholder="e.g., Student submitted medical slip"
                    placeholderTextColor="#64748B"
                    className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-300 text-xs"
                  />
                </View>
              )}

              {/* Roster List */}
              {loadingRoster ? (
                <View className="justify-center items-center py-10">
                  <ActivityIndicator size="small" color="#2D8C82" />
                  <Text className="text-slate-400 text-xs mt-2">Loading roster...</Text>
                </View>
              ) : dayStatus !== 'CLASS_HELD' ? (
                <View className="justify-center items-center py-8 px-4 bg-slate-950/20 border border-slate-850 rounded-2xl mb-6">
                  <Text className="text-slate-400 text-sm font-bold text-center">Roster Disabled</Text>
                  <Text className="text-slate-500 text-[10px] text-center mt-2 leading-4">
                    No roster is editable because class was cancelled or it's a holiday.
                  </Text>
                </View>
              ) : roster.length === 0 ? (
                <View className="justify-center items-center py-8 px-4 bg-slate-950/20 border border-slate-850 rounded-2xl mb-6">
                  <Text className="text-slate-400 text-sm font-bold text-center">No Students</Text>
                  <Text className="text-slate-500 text-[10px] text-center mt-2 leading-4">There are no students enrolled in this class yet.</Text>
                </View>
              ) : (
                <View className="pb-4">
                  {roster.map((student) => {
                    const isPresent = student.status === 'PRESENT';
                    return (
                      <View key={student.id} className="bg-slate-950/30 border border-slate-800/60 rounded-2xl p-4 mb-3 flex-row justify-between items-center">
                        <Text className="text-slate-200 text-sm font-bold">{student.name}</Text>
                        <View className="flex-row items-center gap-2">
                          <TouchableOpacity onPress={() => handleToggleStudentStatus(student.id, 'PRESENT')} className={`px-3 py-1.5 rounded-xl border ${isPresent ? 'bg-green-500/20 border-green-500/50' : 'bg-slate-900 border-slate-850'}`}>
                            <Text className={`text-[10px] font-bold uppercase tracking-wider ${isPresent ? 'text-green-400' : 'text-slate-500'}`}>Present</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleToggleStudentStatus(student.id, 'ABSENT')} className={`px-3 py-1.5 rounded-xl border ${!isPresent ? 'bg-red-500/20 border-red-500/50' : 'bg-slate-900 border-slate-850'}`}>
                            <Text className={`text-[10px] font-bold uppercase tracking-wider ${!isPresent ? 'text-red-400' : 'text-slate-500'}`}>Absent</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            {/* Save Button */}
            {!loadingRoster && (
              <View className="border-t border-slate-850 pt-4 flex-row gap-3">
                <TouchableOpacity onPress={() => setModalVisible(false)} className="flex-1 bg-slate-950/50 border border-slate-800 py-3.5 rounded-2xl items-center">
                  <Text className="text-slate-400 text-xs font-bold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveAttendance} disabled={saving} className="flex-[2] bg-blue-600/90 py-3.5 rounded-2xl items-center justify-center shadow-lg shadow-blue-600/10">
                  <Text className="text-white text-xs font-bold">{saving ? 'Saving...' : `Save (${presentCount}P / ${absentCount}A)`}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};
