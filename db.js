const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./kas.db');

// Buat tabel jika belum ada
db.run(`
  CREATE TABLE IF NOT EXISTS kas_grup (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grup_id TEXT,
    user_nama TEXT,
    tanggal TEXT,
    tipe TEXT,
    jumlah INTEGER,
    keterangan TEXT,
    bulan TEXT
  )
`);

// Menyimpan transaksi baru
function simpanTransaksi(grup_id, user_nama, tipe, jumlah, keterangan) {
  const tanggal = new Date().toISOString();
  const bulan = tanggal.slice(0, 7);
  db.run(
    `INSERT INTO kas_grup (grup_id, user_nama, tanggal, tipe, jumlah, keterangan, bulan) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [grup_id, user_nama, tanggal, tipe, jumlah, keterangan, bulan]
  );
}

// Ambil rekap berdasarkan grup dan bulan
function ambilRekap(grup_id, bulan, callback) {
  db.all(
    `SELECT tipe, keterangan, SUM(jumlah) as total FROM kas_grup 
     WHERE grup_id = ? AND bulan = ?
     GROUP BY tipe, keterangan`,
    [grup_id, bulan],
    (err, rows) => callback(err, rows)
  );
}

// Ambil total pemasukan dan pengeluaran
function ambilTotal(grup_id, bulan, callback) {
  db.all(
    `SELECT tipe, SUM(jumlah) as total FROM kas_grup 
     WHERE grup_id = ? AND bulan = ?
     GROUP BY tipe`,
    [grup_id, bulan],
    (err, rows) => callback(err, rows)
  );
}

// Hapus transaksi berdasarkan ID
function hapusTransaksi(id, callback) {
  db.run(
    `DELETE FROM kas_grup WHERE id = ?`,
    [id],
    function (err) {
      callback(err, this.changes); // jumlah data yang dihapus
    }
  );
}

// Ambil 10 transaksi terbaru (untuk command 'list')
function ambilSemua(grup_id, callback) {
  db.all(
    `SELECT id, user_nama, tanggal, tipe, jumlah, keterangan 
     FROM kas_grup 
     WHERE grup_id = ? 
     ORDER BY tanggal DESC 
     LIMIT 10`,
    [grup_id],
    (err, rows) => callback(err, rows)
  );
}

module.exports = {
  simpanTransaksi,
  ambilRekap,
  ambilTotal,
  hapusTransaksi,
  ambilSemua
};
