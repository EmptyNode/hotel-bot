require('dotenv').config();
const express = require('express');
const { sendText, sendButtons } = require('./whatsapp');
const { appendBooking } = require('./sheets');
const { sessions, STEPS, getSession, resetSession, looksLikeDate, looksLikeTime, looksLikeNumber } = require('./conversation');
const { SHORT_STAY_PACKAGES, NIGHT_STAY, MULTI_DAY_RATE_PER_NIGHT, BOOKING_TYPES } = require('./pricing');

const app = express();
app.use(express.json());

// ---------- Webhook verification (Meta calls this once during setup) ----------
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ---------- Incoming messages ----------
app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // ack fast, Meta expects this
  console.log('--- Incoming webhook hit ---');
  console.log(JSON.stringify(req.body, null, 2));
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];
    if (!message) {
      console.log('No message object found in payload (likely a status update).');
      return;
    }

    const from = message.from;
    let text = '';

    if (message.type === 'text') {
      text = message.text.body.trim();
    } else if (message.type === 'interactive') {
      text = message.interactive.button_reply?.title?.trim()
        || message.interactive.list_reply?.title?.trim()
        || '';
    } else {
      await sendText(from, "I can only understand text messages right now. Type 'hi' to start a booking.");
      return;
    }

    await handleMessage(from, text);
  } catch (err) {
    console.error('Webhook error:', err.message);
    if (err.response) {
      console.error('Full API error response:', JSON.stringify(err.response.data, null, 2));
    }
  }
});

function welcomeMessage() {
  return `Welcome to *The Four Season Hotel*! 🌟\n\n` +
    `📍 Ruby Hospital Crossing, EM Bypass, Kolkata\n\n` +
    `💸 Stay Your Way – Pocket-Friendly Prices!\n\n` +
    `Let's get you booked. What's your full name?`;
}

async function handleMessage(from, text) {
  const session = getSession(from);
  console.log(`[MSG] from=${from} text="${text}" currentStep=${session.step} totalSessionsInMemory=${Object.keys(sessions).length}`);
  const lower = text.toLowerCase();

  if (['hi', 'hello', 'start', 'book', 'menu'].includes(lower)) {
    resetSession(from);
    session.step = STEPS.ASK_NAME;
    await sendText(from, welcomeMessage());
    return;
  }
  if (lower === 'cancel') {
    resetSession(from);
    await sendText(from, 'Booking cancelled. Type "hi" anytime to start again.');
    return;
  }

  switch (session.step) {
    case STEPS.START:
      resetSession(from);
      session.step = STEPS.ASK_NAME;
      await sendText(from, welcomeMessage());
      break;

    case STEPS.ASK_NAME:
      session.data.name = text;
      session.step = STEPS.ASK_BOOKING_TYPE;
      await sendButtons(from,
        `Thanks, ${text}! What type of stay would you like?`,
        [BOOKING_TYPES.SHORT_STAY, BOOKING_TYPES.NIGHT_STAY, BOOKING_TYPES.MULTI_DAY]);
      break;

    case STEPS.ASK_BOOKING_TYPE: {
      const type = Object.values(BOOKING_TYPES).find(t => t.toLowerCase() === lower);
      if (!type) {
        await sendButtons(from, `Please choose one:`,
          [BOOKING_TYPES.SHORT_STAY, BOOKING_TYPES.NIGHT_STAY, BOOKING_TYPES.MULTI_DAY]);
        return;
      }
      session.data.bookingType = type;

      if (type === BOOKING_TYPES.SHORT_STAY) {
        session.step = STEPS.ASK_SHORT_PACKAGE;
        const menu = SHORT_STAY_PACKAGES
          .map(p => `✅ ${p.label} – ₹${p.price}`)
          .join('\n');
        await sendText(from, `⏰ *Short Stay Packages:*\n${menu}\n\nWhich package would you like? (reply e.g. "3 Hours")`);
      } else if (type === BOOKING_TYPES.NIGHT_STAY) {
        session.step = STEPS.ASK_NIGHT_DATE;
        await sendText(from, `🌙 *${NIGHT_STAY.label}: ₹${NIGHT_STAY.price}*\n\nWhat date will you check in? (DD/MM/YYYY, or "today"/"tomorrow")`);
      } else {
        session.step = STEPS.ASK_CHECKIN;
        await sendText(from, `Great, a multi-day stay. What's your *check-in date*? (DD/MM/YYYY)`);
      }
      break;
    }

    case STEPS.ASK_SHORT_PACKAGE: {
      const pkg = SHORT_STAY_PACKAGES.find(p => lower.includes(p.hours.toString()));
      if (!pkg) {
        const menu = SHORT_STAY_PACKAGES.map(p => `✅ ${p.label} – ₹${p.price}`).join('\n');
        await sendText(from, `Please choose one of these:\n${menu}`);
        return;
      }
      session.data.package = pkg.label;
      session.data.price = pkg.price;
      session.step = STEPS.ASK_SHORT_DATE;
      await sendText(from, `Got it, *${pkg.label}* (₹${pkg.price}).\n\nWhat date? (DD/MM/YYYY, or "today"/"tomorrow")`);
      break;
    }

    case STEPS.ASK_SHORT_DATE:
      if (!looksLikeDate(text)) {
        await sendText(from, `Please send a valid date, e.g. 25/08/2026, or "today"/"tomorrow"`);
        return;
      }
      session.data.date = text;
      session.step = STEPS.ASK_SHORT_START_TIME;
      await sendText(from, `What time would you like to check in? (e.g. 3pm or 15:00)`);
      break;

    case STEPS.ASK_SHORT_START_TIME:
      if (!looksLikeTime(text)) {
        await sendText(from, `Please send a valid time, e.g. 3pm or 15:00`);
        return;
      }
      session.data.startTime = text;
      session.step = STEPS.ASK_GUESTS;
      await sendText(from, `How many guests?`);
      break;

    case STEPS.ASK_NIGHT_DATE:
      if (!looksLikeDate(text)) {
        await sendText(from, `Please send a valid date, e.g. 25/08/2026, or "today"/"tomorrow"`);
        return;
      }
      session.data.date = text;
      session.data.package = NIGHT_STAY.label;
      session.data.price = NIGHT_STAY.price;
      session.step = STEPS.ASK_GUESTS;
      await sendText(from, `How many guests?`);
      break;

    case STEPS.ASK_CHECKIN:
      if (!looksLikeDate(text)) {
        await sendText(from, `Please send a valid date, e.g. 25/08/2026`);
        return;
      }
      session.data.checkIn = text;
      session.step = STEPS.ASK_CHECKOUT;
      await sendText(from, `And your *check-out date*? (DD/MM/YYYY)`);
      break;

    case STEPS.ASK_CHECKOUT:
      if (!looksLikeDate(text)) {
        await sendText(from, `Please send a valid date, e.g. 27/08/2026`);
        return;
      }
      session.data.checkOut = text;
      // Best-effort nights calc; falls back gracefully if parsing fails
      const nights = estimateNights(session.data.checkIn, session.data.checkOut);
      session.data.nights = nights || '—';
      session.data.price = nights ? nights * MULTI_DAY_RATE_PER_NIGHT : `${MULTI_DAY_RATE_PER_NIGHT}/night (confirm at hotel)`;
      session.step = STEPS.ASK_GUESTS;
      await sendText(from, `How many guests?`);
      break;

    case STEPS.ASK_GUESTS:
      if (!looksLikeNumber(text)) {
        await sendText(from, `Please enter just the number of guests, e.g. 2`);
        return;
      }
      session.data.guests = text;
      session.step = STEPS.CONFIRM;
      await sendText(from, buildConfirmationText(session.data));
      break;

    case STEPS.CONFIRM:
      if (lower === 'yes') {
        await appendBooking(session.data);
        await sendText(from,
          `✅ Your booking request is confirmed! The hotel will reach out shortly to verify availability.\n\nThank you for choosing The Four Season Hotel! 🙏`);
        await notifyOwner(session.data);
        resetSession(from);
      } else {
        await sendText(from, `Reply *yes* to confirm, or *cancel* to start over.`);
      }
      break;

    default:
      resetSession(from);
      await sendText(from, `Something went wrong. Type "hi" to start a new booking.`);
  }
}

function estimateNights(checkInStr, checkOutStr) {
  const parse = (s) => {
    const m = s.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (!m) return null;
    let [, d, mo, y] = m;
    if (y.length === 2) y = '20' + y;
    return new Date(`${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`);
  };
  const inDate = parse(checkInStr);
  const outDate = parse(checkOutStr);
  if (!inDate || !outDate || isNaN(inDate) || isNaN(outDate)) return null;
  const diffDays = Math.round((outDate - inDate) / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : null;
}

function buildConfirmationText(d) {
  let lines = [`Please confirm your booking:\n`, `👤 Name: ${d.name}`, `📦 Type: ${d.bookingType}`];

  if (d.bookingType === BOOKING_TYPES.SHORT_STAY) {
    lines.push(`⏰ Package: ${d.package} (₹${d.price})`);
    lines.push(`📅 Date: ${d.date}`);
    lines.push(`🕐 Start Time: ${d.startTime}`);
  } else if (d.bookingType === BOOKING_TYPES.NIGHT_STAY) {
    lines.push(`🌙 Package: ${d.package} (₹${d.price})`);
    lines.push(`📅 Date: ${d.date}`);
  } else {
    lines.push(`📅 Check-in: ${d.checkIn}`);
    lines.push(`📅 Check-out: ${d.checkOut}`);
    lines.push(`🌃 Nights: ${d.nights}`);
    lines.push(`💰 Estimated Price: ₹${d.price}`);
  }

  lines.push(`👥 Guests: ${d.guests}`);
  lines.push(`\nReply *yes* to confirm or *cancel* to start over.`);
  return lines.join('\n');
}

async function notifyOwner(booking) {
  if (!process.env.OWNER_WHATSAPP_NUMBER) return;
  let details = `Type: ${booking.bookingType}\n`;
  if (booking.bookingType === BOOKING_TYPES.SHORT_STAY) {
    details += `Package: ${booking.package} (₹${booking.price})\nDate: ${booking.date}\nStart Time: ${booking.startTime}\n`;
  } else if (booking.bookingType === BOOKING_TYPES.NIGHT_STAY) {
    details += `Package: ${booking.package} (₹${booking.price})\nDate: ${booking.date}\n`;
  } else {
    details += `Check-in: ${booking.checkIn}\nCheck-out: ${booking.checkOut}\nNights: ${booking.nights}\nEst. Price: ₹${booking.price}\n`;
  }
  await sendText(process.env.OWNER_WHATSAPP_NUMBER,
    `🔔 *New Booking*\n\nName: ${booking.name}\nPhone: ${booking.phone}\n${details}Guests: ${booking.guests}\n\nAlso saved in the Google Sheet.`);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Hotel bot running on port ${PORT} - DEBUG LOGGING ENABLED`));
