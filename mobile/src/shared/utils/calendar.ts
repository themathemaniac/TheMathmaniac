/**
 * Utility functions for calendar rendering
 */

export const generateWeeks = (year: number, month: number): (number | null)[][] => {
  // month is 0-indexed (0 = Jan, 11 = Dec)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0, Sunday = 6
  
  const weeksList: (number | null)[][] = [];
  let currentWeek: (number | null)[] = Array(7).fill(null);
  
  // Fill the leading empty days
  for (let i = 0; i < startDay; i++) {
    currentWeek[i] = null;
  }
  
  let currentDayOfWeek = startDay;
  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek[currentDayOfWeek] = day;
    currentDayOfWeek++;
    
    if (currentDayOfWeek === 7) {
      weeksList.push(currentWeek);
      currentWeek = Array(7).fill(null);
      currentDayOfWeek = 0;
    }
  }
  
  // Push the last week if it contains any days
  if (currentWeek.some(d => d !== null)) {
    weeksList.push(currentWeek);
  }
  
  return weeksList;
};

export const getMonthName = (month: number): string => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month];
};

export const formatDateString = (year: number, month: number, day: number): string => {
  const monthStr = String(month + 1).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');
  return `${year}-${monthStr}-${dayStr}`;
};
