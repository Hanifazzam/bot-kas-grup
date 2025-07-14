const { google } = require("googleapis");

let sheets;
let sheetId = process.env.GOOGLE_SHEET_ID;

// Setup Google Auth
async function authGoogle() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIAL_JSON),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const client = await auth.getClient();
  sheets = google.sheets({ version: "v4", auth: client });
}

async function simpanKeSheets({ grup_id, user_nama, tanggal, tipe, jumlah, keterangan, bulan }) {
  if (!sheets) await authGoogle();

  const values = [[grup_id, user_nama, tanggal, tipe, jumlah, keterangan, bulan]];
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "Sheet1!A:G", // Pastikan Sheet1 ada di spreadsheet kamu
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

module.exports = { simpanKeSheets };
