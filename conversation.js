// In-memory session store: { [phoneNumber]: { step, data } }
// At 50-60 bookings/day this is fine. If you restart the server mid-conversation
// a user loses their progress and just types "hi" again to restart - acceptable
// tradeoff for this scale. (Swap for Redis only if you outgrow this.)
const sessions = {};

const STEPS = {
  START: 'START',
  ASK_NAME: 'ASK_NAME',
  ASK_PHONE_CONFIRM: 'ASK_PHONE_CONFIRM',
  ASK_BOOKING_TYPE: 'ASK_BOOKING_TYPE',

  // Short stay branch
  ASK_SHORT_PACKAGE: 'ASK_SHORT_PACKAGE',
  ASK_SHORT_DATE: 'ASK_SHORT_DATE',
  ASK_SHORT_START_TIME: 'ASK_SHORT_START_TIME',

  // Night stay branch
  ASK_NIGHT_DATE: 'ASK_NIGHT_DATE',

  // Multi-day branch
  ASK_CHECKIN: 'ASK_CHECKIN',
  ASK_CHECKOUT: 'ASK_CHECKOUT',

  ASK_GUESTS: 'ASK_GUESTS',
  CONFIRM: 'CONFIRM',
  DONE: 'DONE'
};

function getSession(phone) {
  if (!sessions[phone]) {
    sessions[phone] = { step: STEPS.START, data: { phone } };
  }
  return sessions[phone];
}

function resetSession(phone) {
  sessions[phone] = { step: STEPS.START, data: { phone } };
}

// Accepts 12/08/2025, 12-08-2025, and "today"/"tomorrow"
function looksLikeDate(text) {
  const t = text.trim().toLowerCase();
  if (t === 'today' || t === 'tomorrow') return true;
  return /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(t);
}

// Accepts 9pm, 9:30pm, 21:00, 9 pm
function looksLikeTime(text) {
  const t = text.trim().toLowerCase().replace(/\s+/g, '');
  return /^([1-9]|1[0-2])(:[0-5][0-9])?(am|pm)$/.test(t) || /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(t);
}

function looksLikeNumber(text) {
  return /^\d+$/.test(text.trim());
}

module.exports = {
  sessions, STEPS, getSession, resetSession,
  looksLikeDate, looksLikeTime, looksLikeNumber
};
