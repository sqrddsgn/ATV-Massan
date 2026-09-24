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
      clean_(p.orgnr, 40),
      isCompany ? TURNOVER[p.turnover] : '–',
      isCompany ? FEES[p.turnover] : 0,
      clean_(p.name, 200),
      clean_(p.email, 200),
      clean_(p.phone, 40),
      clean_(p.description, 2000),
      clean_(p.space, 100),
      p.power === 'ja' ? 'Ja' : 'Nej',
      clean_(p.message, 2000),
      'Ja'
    ];

    getSheet_().appendRow(row);
    notify_(row);
    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Något gick fel hos oss.' });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

// Opening the /exec URL in a browser shows that the deployment is alive.
function doGet() {
  return json_({ ok: true, service: 'ATV-Mässan utställaranmälan' });
}

// Run once from the editor: creates the sheet + header row and triggers the permission prompt.
function setup() {
  getSheet_();
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

// Trim, cap length, and stop spreadsheet formula injection (=, +, -, @ at the start of a cell).
function clean_(value, max) {
  let s = String(value == null ? '' : value).trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
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
