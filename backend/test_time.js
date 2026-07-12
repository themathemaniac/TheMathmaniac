const parseTimeTo24Hour = (timeStr) => {
  if (!timeStr) return "00:00";
  const parts = timeStr.split(' ');
  if (parts.length !== 2) return timeStr;
  const [time, modifier] = parts;
  let [hours, minutes] = time.split(':');
  if (hours === '12') hours = '00';
  if (modifier === 'PM') hours = String(parseInt(hours, 10) + 12);
  return `${String(hours).padStart(2, '0')}:${minutes}`;
};

console.log('11:30 AM ->', parseTimeTo24Hour('11:30 AM'));
console.log('12:00 PM ->', parseTimeTo24Hour('12:00 PM'));
console.log('01:30 PM ->', parseTimeTo24Hour('01:30 PM'));

function checkEarly(timeStr, currHour, currMin) {
  const t24 = parseTimeTo24Hour(timeStr);
  const startMins = parseInt(t24.split(':')[0]) * 60 + parseInt(t24.split(':')[1]);
  const currentMins = currHour * 60 + currMin;
  console.log(`Class: ${timeStr} -> ${t24} (${startMins}m). Curr: ${currHour}:${currMin} (${currentMins}m). Early? ${currentMins < startMins - 30}`);
}

checkEarly('11:30 AM', 12, 0);
checkEarly('12:00 PM', 11, 45);
