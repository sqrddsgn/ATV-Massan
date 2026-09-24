/**
 * ATV-Mässan – exhibitor applications -> Google Sheet
 *
 * Bound to the spreadsheet that should receive the replies
 * (Extensions > Apps Script). Deploy as a Web app; see README.md.
 */

const SHEET_NAME = 'Anmälningar';
const NOTIFY_EMAIL = 'info@dahliamotor.se'; // e-mail a copy of each application here; '' turns it off
const TIMEZONE = 'Europe/Stockholm';

const FEES = { '0-100000': 200, '100000-2000000': 1000, '2000000-20000000': 5000, '20000000+': 10000 };
const TURNOVER = {
  '0-100000': '0 – 100 000 kr',
  '100000-2000000': '100 000 kr – 2 miljoner kr',
  '2000000-20000000': '2 – 20 miljoner kr',
  '20000000+': '20 miljoner kr och uppåt'
};
const POWER = { '10A': 2400, '16A': 3200, '32A': 4000 };
const TYPES = { foretag: 'Företag', ideell: 'Ideell förening / skola / liknande' };

const HEADERS = [
  'Tidpunkt', 'Typ', 'Företag / förening', 'Organisationsnummer', 'Omsättning',
  'Avgift (kr, exkl. moms)', 'Kontaktperson', 'E-post', 'Telefon',
  'Vad ställer ni ut?', 'Ytbehov', 'Behöver el', 'Övrigt', 'Samtycke'
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const p = (e && e.parameter) || {};

    if (p.website) return json_({ ok: true }); // honeypot filled in: pretend success, store nothing

    const error = validate_(p);
    if (error) return json_({ ok: false, error: error });

    const isCompany = p.type === 'foretag';
    const row = [
      Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss'),
      TYPES[p.type],
      clean_(p.company, 200),
      clean_(p.orgnr, 40, true),
      isCompany ? TURNOVER[p.turnover] : '–',
      isCompany ? FEES[p.turnover] : 0,
      clean_(p.name, 200),
      clean_(p.email, 200),
      clean_(p.phone, 40, true),
      clean_(p.description, 2000),
      clean_(p.space, 100),
      power_(p),
      clean_(p.message, 2000),
      'Ja'
    ];

    appendRow_(getSheet_(), row);
    notify_(row);
    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Något gick fel hos oss.' });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

// Bump this when you change the script; it shows in the browser when you open the /exec URL,
// so you can see which version is actually live.
const VERSION = 'v4-power';

// Opening the /exec URL in a browser shows that the deployment is alive.
function doGet() {
  return json_({ ok: true, service: 'ATV-Mässan utställaranmälan', version: VERSION });
}

// Run once from the editor: creates the sheet + header row, formats the phone and organisation
// number columns as plain text, and triggers the permission prompt.
function setup() {
  formatTextColumns_(getSheet_());
}

// Chosen electricity connection as text for the sheet, e.g. "Ja – 16A (3 200 kr)".
function power_(p) {
  if (POWER.hasOwnProperty(p.power_amp)) {
    const price = String(POWER[p.power_amp]).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return 'Ja \u2013 ' + p.power_amp + ' (' + price + ' kr)';
  }
  return p.power === 'ja' ? 'Ja' : 'Nej'; // older form versions sent a plain checkbox
}

function validate_(p) {
  if (p.type !== 'foretag' && p.type !== 'ideell') return 'Välj typ av utställare.';
  if (p.type === 'foretag' && !FEES.hasOwnProperty(p.turnover)) return 'Välj företagets omsättning.';
  if (!clean_(p.company, 200)) return 'Fyll i företag eller förening.';
  if (!clean_(p.name, 200)) return 'Fyll i kontaktperson.';
  if (!clean_(p.phone, 40)) return 'Fyll i telefonnummer.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean_(p.email, 200))) return 'Fyll i en giltig e-postadress.';
  if (!clean_(p.description, 2000)) return 'Beskriv vad ni vill visa eller sälja.';
  if (p.consent !== 'ja') return 'Du behöver godkänna att vi sparar uppgifterna.';
  return '';
}

// Trim and cap length. Unless the cell will be plain text, also stop spreadsheet formula
// injection (=, +, -, @ at the start of a cell).
function clean_(value, max, isText) {
  let s = String(value == null ? '' : value).trim().slice(0, max);
  if (!isText && /^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

// Columns that must stay text, otherwise Sheets turns 0701234567 into the number 701234567.
const TEXT_COLUMNS = [4, 9]; // 1-based: Organisationsnummer, Telefon

// Like appendRow, but marks the text columns as plain text before writing so leading zeros survive.
function appendRow_(sheet, row) {
  const r = sheet.getLastRow() + 1;
  TEXT_COLUMNS.forEach(function (col) { sheet.getRange(r, col).setNumberFormat('@'); });
  SpreadsheetApp.flush(); // make sure the text format is applied before the values are written
  sheet.getRange(r, 1, 1, row.length).setValues([row]);
}

function formatTextColumns_(sheet) {
  TEXT_COLUMNS.forEach(function (col) {
    sheet.getRange(2, col, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('@');
  });
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function notify_(row) {
  if (!NOTIFY_EMAIL) return;
  try {
    const lines = HEADERS.map(function (h, i) { return h + ': ' + row[i]; });
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      replyTo: String(row[7]).replace(/^'/, ''),
      subject: 'Ny utställaranmälan: ' + row[2],
      body: lines.join('\n')
    });
  } catch (err) {
    console.error('Notification failed: ' + err); // the row is already saved; don't fail the request
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
