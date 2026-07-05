// All pricing lives here. When the owner changes rates, you only edit this file.

const SHORT_STAY_PACKAGES = [
  { label: '3 Hours', hours: 3, price: 650 },
  { label: '4 Hours', hours: 4, price: 750 },
  { label: '5 Hours', hours: 5, price: 800 },
  { label: '6 Hours', hours: 6, price: 850 },
  { label: '7 Hours', hours: 7, price: 950 },
  { label: '8 Hours', hours: 8, price: 1050 },
  { label: '24 Hours', hours: 24, price: 1300 }
];

const NIGHT_STAY = {
  label: 'Night Stay Special (8 PM - 9 AM, AC Room)',
  price: 999
};

// Used for multi-day stays: nights x this rate.
// CONFIRM WITH CLIENT - currently defaulting to the 24-Hour package rate.
const MULTI_DAY_RATE_PER_NIGHT = 1300;

const BOOKING_TYPES = {
  SHORT_STAY: 'Short Stay',
  NIGHT_STAY: 'Night Stay',
  MULTI_DAY: 'Multiple Days'
};

module.exports = { SHORT_STAY_PACKAGES, NIGHT_STAY, MULTI_DAY_RATE_PER_NIGHT, BOOKING_TYPES };
