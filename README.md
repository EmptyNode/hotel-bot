# Hotel WhatsApp Booking Bot

## What this does
Guest messages "hi" on WhatsApp → bot asks name → booking type (Short Stay /
Night Stay / Multiple Days) → branches accordingly:

- **Short Stay**: shows the hourly package menu (3–24 hrs), asks date + start time
- **Night Stay**: shows the fixed 8 PM–9 AM package, asks date only
- **Multiple Days**: asks check-in + check-out dates, auto-calculates nights

Then asks guest count → shows a confirmation summary → guest replies "yes" →
saved to Google Sheet → hotel owner gets a WhatsApp alert with full details.

## Sheet columns
`Timestamp | Name | Phone | Booking Type | Package/Room | Date/Check-in | Check-out | Start Time | Nights | Price | Guests | Status`

## Pricing config
All rates live in `pricing.js`. When the client changes prices, you only
edit that one file and redeploy — no need to touch the conversation logic.

**⚠️ Confirm with the client:** `MULTI_DAY_RATE_PER_NIGHT` in `pricing.js`
currently defaults to the 24-Hour package rate (₹1300/night). If they have
a different multi-day/long-stay rate, update that constant.

## Local setup
```bash
npm install
cp .env.example .env   # fill in real values
npm run dev
```

## Deploy (free tier, recommended: Render.com)
1. Push this folder to a GitHub repo
2. Render.com → New → Web Service → connect repo
3. Build command: `npm install`  |  Start command: `npm start`
4. Add all variables from `.env` as Environment Variables in Render's dashboard
5. Deploy → you'll get a URL like `https://hotel-bot.onrender.com`

## Connect to Meta
1. In Meta Developer Console → WhatsApp → Configuration
2. Webhook URL: `https://hotel-bot.onrender.com/webhook`
3. Verify Token: same string as `VERIFY_TOKEN` in your `.env`
4. Subscribe to `messages` field

## Testing
Send "hi" from a personal WhatsApp to the test number Meta gave you.
(Test numbers only work with phone numbers you've added to the allow-list
in Meta Developer Console → WhatsApp → API Setup → "To" recipients, until
you go through Business Verification.)

## Going live with the client's real number
- Requires Meta Business Verification (a few business days) — start this early
- Client's existing WhatsApp Business app number gets "migrated" to Cloud API,
  or a new number is used exclusively for the bot (recommend a new number so
  the owner can keep using their personal WhatsApp Business app separately)
- Get a permanent access token: Meta Business Settings → System Users →
  create system user → generate token with `whatsapp_business_messaging` permission

## Handing off to the client
Client doesn't touch code at all. They only need:
1. Access to the Google Sheet (share as Viewer/Editor)
2. Their WhatsApp number set as OWNER_WHATSAPP_NUMBER to get booking alerts
3. Optionally: a simple filter/view in the Sheet for "Pending Confirmation" rows

You (developer) own: Meta Developer account, Render hosting, the GitHub repo.
Recommend setting these up under the client's own email/business so they
retain ownership if you're no longer maintaining it — just keep yourself
as a collaborator.

## Cost at this scale
- WhatsApp Cloud API: free up to 1,000 conversations/month (business-initiated
  notifications to the owner may fall under paid tiers if very frequent —
  at 50-60/day of owner notifications, check current Meta pricing since this
  changes; the confirmation replies to guests, being user-initiated within
  a session, are typically free)
- Render free/starter tier: $0-7/month
- Google Sheets API: free

## Scaling beyond this
If bookings grow past a few hundred/day or you need room-availability logic
(to prevent double-booking), swap Google Sheets for a real DB (Postgres/Airtable)
and add availability checks before confirming. Everything else in this
architecture stays the same.
