import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { apiClient } from '../../core/api/client';

interface CalendarEvent {
  date: string; // YYYY-MM-DD
  title: string;
  subtitle: string;
  type: 'HOLIDAY' | 'CLASS';
}

export const MiniCalendar: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const fetchCalendar = async () => {
    try {
      const res = await apiClient.get('/profile/calendar');
      if (res.data.success) {
        setEvents(res.data.data);
      }
    } catch (e) {
      console.log('Error loading calendar:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, []);

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-11

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // First day of month
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 (Sunday) to 6 (Saturday)
  
  // Total days in month
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Create grid arrays
  const daysArray: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null);
  }
  for (let i = 1; i <= totalDays; i++) {
    daysArray.push(i);
  }

  // Group into weeks (rows of 7)
  const rows: (number | null)[][] = [];
  let tempRow: (number | null)[] = [];
  daysArray.forEach((day, index) => {
    tempRow.push(day);
    if (tempRow.length === 7 || index === daysArray.length - 1) {
      while (tempRow.length < 7) {
        tempRow.push(null);
      }
      rows.push(tempRow);
      tempRow = [];
    }
  });

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getEventsForDate = (dateStr: string) => {
    return events.filter(e => e.date === dateStr);
  };

  const selectedDayEvents = getEventsForDate(selectedDateStr);

  if (loading) {
    return (
      <View className="bg-slate-900 border border-slate-850 rounded-3xl p-5 mb-6 justify-center items-center h-48">
        <ActivityIndicator size="small" color="#2D8C82" />
        <Text className="text-slate-500 text-xs mt-3">Loading Calendar...</Text>
      </View>
    );
  }

  return (
    <View className="bg-slate-900 border border-slate-850 rounded-3xl p-5 mb-6 shadow-2xl">
      {/* Calendar Header */}
      <View className="flex-row justify-between items-center mb-4">
        <View>
          <Text className="text-slate-500 text-[10px] font-black uppercase tracking-wider">Institute Calendar</Text>
          <Text className="text-slate-100 text-base font-black mt-0.5">{monthNames[month]} {year}</Text>
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

              const formattedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayEvents = getEventsForDate(formattedDateStr);
              
              const isSelected = selectedDateStr === formattedDateStr;
              const hasHoliday = dayEvents.some(e => e.type === 'HOLIDAY');
              const hasClass = dayEvents.some(e => e.type === 'CLASS');

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
              } else if (hasClass) {
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
                  {!isSelected && dayEvents.length > 0 && (
                    <View className="flex-row gap-0.5 absolute bottom-1 justify-center">
                      {hasHoliday && <View className="w-1 h-1 rounded-full bg-red-400" />}
                      {hasClass && <View className="w-1 h-1 rounded-full bg-blue-400" />}
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
        {selectedDayEvents.length > 0 ? (
          selectedDayEvents.map((ev, index) => {
            const isHoliday = ev.type === 'HOLIDAY';
            return (
              <View
                key={index}
                className={`p-3 rounded-2xl border mb-2 flex-row justify-between items-center ${
                  isHoliday ? 'bg-red-500/5 border-red-500/15' : 'bg-blue-500/5 border-blue-500/15'
                }`}
              >
                <View className="flex-1 mr-2">
                  <Text className={`text-xs font-black ${isHoliday ? 'text-red-400' : 'text-slate-100'}`}>
                    {ev.title}
                  </Text>
                  <Text className="text-slate-400 text-[10px] mt-0.5 leading-4">
                    {ev.subtitle}
                  </Text>
                </View>
                <View className={`px-2 py-0.5 rounded-lg ${isHoliday ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                  <Text className={`text-[8px] font-black uppercase ${isHoliday ? 'text-red-400' : 'text-blue-400'}`}>
                    {ev.type}
                  </Text>
                </View>
              </View>
            );
          })
        ) : (
          <Text className="text-slate-600 text-[11px] font-bold text-center py-2">No classes or holidays on this date.</Text>
        )}
      </View>
    </View>
  );
};
