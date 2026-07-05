const { google } = require('googleapis');

function getSheetsClient() {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  return google.sheets({ version: 'v4', auth });
}

// Sheet columns (set these as your header row in Sheet1):
// Timestamp | Name | Phone | Booking Type | Package/Room | Date/Check-in | Check-out | Start Time | Nights | Price | Guests | Status
async function appendBooking(booking) {
  const sheets = getSheetsClient();

  const row = [
    new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    booking.name,
    booking.phone,
    booking.bookingType || '',
    booking.package || '',
    booking.date || booking.checkIn || '',
    booking.checkOut || '',
    booking.startTime || '',
    booking.nights || '',
    booking.price || '',
    booking.guests,
    'Pending Confirmation'
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Sheet1!A:L',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] }
  });
}

module.exports = { appendBooking };
