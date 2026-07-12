import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface RoutineSession {
  id: string;
  dayOfWeek: DayOfWeek;    
  startTime: string; // e.g. "04:30 PM"
  endTime: string;   // e.g. "06:30 PM"
  courseName: string;
  location: string;
  batchName: string;
  color?: string; 
}

export interface TimetableProps {
  sessions: RoutineSession[];
  onSessionPress?: (session: RoutineSession) => void;
  title?: string;
}

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const START_HOUR = 7; // 7:00 AM
const END_HOUR = 23;  // 11:00 PM (23:00)
const TOTAL_HOURS = END_HOUR - START_HOUR;

const parseTime = (timeStr: string) => {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = match[3]?.toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h + m / 60;
};

const formatHourLabel = (hour: number) => {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
  return `${h} ${ampm}`;
};

export const Timetable: React.FC<TimetableProps> = ({ sessions, onSessionPress, title }) => {
  const [selectedSession, setSelectedSession] = useState<RoutineSession | null>(null);

  const handlePress = (session: RoutineSession) => {
    setSelectedSession(session);
    if (onSessionPress) {
      onSessionPress(session);
    }
  };

  const renderDayRow = (day: DayOfWeek) => {
    // 1. Filter and parse sessions for this day
    const daySessions = sessions
      .filter(s => s.dayOfWeek === day)
      .map(s => ({
        ...s,
        startDec: parseTime(s.startTime),
        endDec: parseTime(s.endTime)
      }))
      .sort((a, b) => a.startDec - b.startDec);

    // 2. Compute non-overlapping rows
    const rows: typeof daySessions[] = [];
    daySessions.forEach(session => {
      let placed = false;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const lastSessionInRow = row[row.length - 1];
        if (lastSessionInRow.endDec <= session.startDec) {
          row.push(session);
          placed = true;
          break;
        }
      }
      if (!placed) {
        rows.push([session]);
      }
    });

    const rowHeight = 32;
    const paddingY = 8;
    const totalHeight = Math.max(1, rows.length) * rowHeight + paddingY * 2;

    return (
      <View key={day} className="flex-row border-t border-slate-800" style={{ height: totalHeight }}>
        {/* Y-Axis Day Label */}
        <View className="w-[12%] justify-center items-center border-r border-slate-800 bg-slate-900/50">
          <Text className="text-slate-400 text-[10px] font-bold uppercase">{day.substring(0, 3)}</Text>
        </View>

        {/* Timeline Data Area */}
        <View className="flex-1 relative justify-center bg-slate-950/20 overflow-hidden">
          {/* Placed Sessions */}
          {rows.map((row, rowIndex) => (
            row.map(session => {
              // Calculate percentage width & left offset relative to the START_HOUR and END_HOUR
              const leftPerc = Math.max(0, ((session.startDec - START_HOUR) / TOTAL_HOURS) * 100);
              const rightBoundary = Math.min(TOTAL_HOURS, session.endDec - START_HOUR);
              const widthPerc = Math.max(1, (rightBoundary / TOTAL_HOURS) * 100 - leftPerc);
              
              return (
                <TouchableOpacity
                  key={session.id}
                  activeOpacity={0.8}
                  onPress={() => handlePress(session)}
                  className="absolute rounded-md border justify-center px-1.5 overflow-hidden shadow-sm"
                  style={{
                    left: `${leftPerc}%`,
                    width: `${widthPerc}%`,
                    top: paddingY + rowIndex * rowHeight,
                    height: rowHeight - 4,
                    backgroundColor: session.color ? `${session.color}70` : 'rgba(45, 140, 130, 0.5)',
                    borderColor: session.color ? `${session.color}` : 'rgba(45, 140, 130, 1)',
                  }}
                >
                  <Text 
                    className="font-black text-[10px]"
                    style={{ color: '#0F172A' }} // dark slate
                    numberOfLines={1}
                  >
                    {session.courseName}
                  </Text>
                  <Text 
                    className="font-bold text-[8px]" 
                    style={{ color: '#1E293B' }} // slightly lighter dark slate
                    numberOfLines={1}
                  >
                    {session.batchName}
                  </Text>
                </TouchableOpacity>
              );
            })
          ))}
        </View>
      </View>
    );
  };

  return (
    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4 w-full">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-4 px-1">
        <Text className="text-slate-100 text-base font-bold">{title || 'Weekly Timeline'}</Text>
        <View className="bg-[#2D8C82]/20 px-3 py-1 rounded-full">
          <Text className="text-[#2D8C82] text-[10px] font-bold uppercase tracking-wider">Live</Text>
        </View>
      </View>

      <View className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900">
        {/* X-Axis Header (Time) */}
        <View className="flex-row h-6">
          <View className="w-[12%] border-r border-slate-800 bg-slate-900/80" />
          <View className="flex-1 relative bg-slate-900/80">
            {Array.from({ length: TOTAL_HOURS + 1 }).map((_, i) => {
              if (i % 2 !== 0 && i !== TOTAL_HOURS) return null; // Only show every 2 hours to avoid crowding
              return (
                <Text 
                  key={i} 
                  className="absolute text-slate-500 text-[8px] font-bold"
                  style={{ 
                    left: `${(i / TOTAL_HOURS) * 100}%`, 
                    transform: [{ translateX: -10 }],
                    bottom: 4 
                  }}
                >
                  {formatHourLabel(START_HOUR + i)}
                </Text>
              );
            })}
          </View>
        </View>

        {/* Days & Timelines */}
        {DAYS.map(day => renderDayRow(day))}
      </View>

      {/* Session Details Modal */}
      <Modal
        visible={!!selectedSession}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedSession(null)}
      >
        <Pressable 
          className="flex-1 bg-slate-950/90 justify-center items-center p-6"
          onPress={() => setSelectedSession(null)}
        >
          <Pressable className="w-full bg-slate-900 border-2 border-black rounded-3xl overflow-hidden shadow-2xl">
            {selectedSession && (
              <View>
                <View 
                  className="px-6 py-4 flex-row justify-between items-center"
                  style={{ backgroundColor: selectedSession.color ? `${selectedSession.color}20` : 'rgba(45, 140, 130, 0.15)' }}
                >
                  <View>
                    <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                      {selectedSession.dayOfWeek}
                    </Text>
                    <Text 
                      className="text-2xl font-black"
                      style={{ color: selectedSession.color || '#3CA79B' }}
                    >
                      {selectedSession.courseName}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => setSelectedSession(null)}
                    className="w-9 h-9 bg-black rounded-full justify-center items-center border border-slate-700"
                  >
                    <Text className="text-white text-lg font-black mt-[-2px]">✕</Text>
                  </TouchableOpacity>
                </View>

                <View className="p-6">
                  {/* Batch Name Tile */}
                  <View 
                    className="flex-row mb-4 border p-3 rounded-2xl"
                    style={{ 
                      backgroundColor: selectedSession.color ? `${selectedSession.color}70` : 'rgba(45, 140, 130, 0.5)',
                      borderColor: selectedSession.color || 'rgba(45, 140, 130, 1)' 
                    }}
                  >
                    <View className="w-10 justify-center items-center">
                      <Text className="text-xl">👥</Text>
                    </View>
                    <View className="flex-1 justify-center">
                      <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#0F172A' }}>Batch Name</Text>
                      <Text className="text-sm font-bold mt-0.5" style={{ color: '#1E293B' }}>{selectedSession.batchName}</Text>
                    </View>
                  </View>

                  {/* Location Tile */}
                  <View 
                    className="flex-row mb-4 border p-3 rounded-2xl"
                    style={{ 
                      backgroundColor: selectedSession.color ? `${selectedSession.color}70` : 'rgba(45, 140, 130, 0.5)',
                      borderColor: selectedSession.color || 'rgba(45, 140, 130, 1)' 
                    }}
                  >
                    <View className="w-10 justify-center items-center">
                      <Text className="text-xl">📍</Text>
                    </View>
                    <View className="flex-1 justify-center">
                      <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#0F172A' }}>Location</Text>
                      <Text className="text-sm font-bold mt-0.5" style={{ color: '#1E293B' }}>{selectedSession.location}</Text>
                    </View>
                  </View>

                  {/* Timing Tile */}
                  <View 
                    className="flex-row border p-3 rounded-2xl"
                    style={{ 
                      backgroundColor: selectedSession.color ? `${selectedSession.color}70` : 'rgba(45, 140, 130, 0.5)',
                      borderColor: selectedSession.color || 'rgba(45, 140, 130, 1)' 
                    }}
                  >
                    <View className="w-10 justify-center items-center">
                      <Text className="text-xl">⏱️</Text>
                    </View>
                    <View className="flex-1 justify-center">
                      <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#0F172A' }}>Timing</Text>
                      <Text className="text-sm font-bold mt-0.5" style={{ color: '#1E293B' }}>
                        {selectedSession.startTime} - {selectedSession.endTime}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};
