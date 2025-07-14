const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const qrcode = require('qrcode-terminal');
const {
  simpanTransaksi,
  ambilRekap,
  ambilTotal,
  hapusTransaksi,
  ambilSemua
} = require('./db');

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({ auth: state });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("📷 Scan QR Code berikut untuk login:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log("✅ Bot berhasil terhubung ke WhatsApp.");
    } else if (connection === 'close') {
      console.log("❌ Koneksi terputus. Mencoba ulang...");
      startBot(); // reconnect otomatis
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.pushName || "User";
    const isGroup = !!msg.key.remoteJid.endsWith("@g.us");
    const grup_id = msg.key.remoteJid;
    const pesan = msg.message.conversation || msg.message.extendedTextMessage?.text;

    if (!pesan || !isGroup) return;

    // Tambah pemasukan
    if (pesan.startsWith("+")) {
      const [jumlah, ...ket] = pesan.slice(1).trim().split(" ");
      simpanTransaksi(grup_id, sender, "masuk", parseInt(jumlah), ket.join(" "));
      await sock.sendMessage(grup_id, {
        text: `✅ ${sender} menambahkan pemasukan: Rp${jumlah}`
      });
    }

    // Tambah pengeluaran
    else if (pesan.startsWith("-")) {
      const [jumlah, ...ket] = pesan.slice(1).trim().split(" ");
      simpanTransaksi(grup_id, sender, "keluar", parseInt(jumlah), ket.join(" "));
      await sock.sendMessage(grup_id, {
        text: `❌ ${sender} mencatat pengeluaran: Rp${jumlah}`
      });
    }

    // Total ringkasan bulan
    else if (pesan === "total") {
      const bulan = new Date().toISOString().slice(0, 7);
      ambilTotal(grup_id, bulan, (err, rows) => {
        if (err) return;
        let masuk = 0, keluar = 0;
        rows.forEach(r => {
          if (r.tipe === 'masuk') masuk = r.total;
          if (r.tipe === 'keluar') keluar = r.total;
        });
        const saldo = masuk - keluar;
        sock.sendMessage(grup_id, {
          text: `📅 Bulan: ${bulan}\n📥 Masuk: Rp${masuk}\n📤 Keluar: Rp${keluar}\n💰 Saldo: Rp${saldo}`
        });
      });
    }

    // Rekap detail bulan
    else if (pesan === "rekap") {
      const bulan = new Date().toISOString().slice(0, 7);
      ambilRekap(grup_id, bulan, (err, rows) => {
        if (err) return;
        let teks = `📊 Rekap Kas Bulan ${bulan}:\n`;
        rows.forEach(r => {
          teks += `- [${r.tipe}] ${r.keterangan}: Rp${r.total}\n`;
        });
        sock.sendMessage(grup_id, { text: teks });
      });
    }

    // List 10 transaksi terakhir (dengan ID)
    else if (pesan === "list") {
      ambilSemua(grup_id, async (err, rows) => {
        if (err || rows.length === 0) {
          await sock.sendMessage(grup_id, { text: "❌ Tidak ada transaksi terbaru." });
        } else {
          let teks = `📄 Transaksi Terakhir:\n`;
          rows.forEach(r => {
            teks += `#${r.id} | ${r.tipe} | Rp${r.jumlah} | ${r.keterangan} | ${r.user_nama}\n`;
          });
          await sock.sendMessage(grup_id, { text: teks });
        }
      });
    }

    // Hapus transaksi berdasarkan ID
    else if (pesan.startsWith("hapus ")) {
      const id = parseInt(pesan.split(" ")[1]);
      if (isNaN(id)) {
        await sock.sendMessage(grup_id, {
          text: "❌ ID tidak valid. Gunakan: hapus [id]"
        });
      } else {
        hapusTransaksi(id, async (err, changes) => {
          if (err) {
            await sock.sendMessage(grup_id, {
              text: "❌ Gagal menghapus data."
            });
          } else if (changes === 0) {
            await sock.sendMessage(grup_id, {
              text: `❌ Data dengan ID ${id} tidak ditemukan.`
            });
          } else {
            await sock.sendMessage(grup_id, {
              text: `🗑️ Data dengan ID ${id} berhasil dihapus.`
            });
          }
        });
      }
    }

    // Bantuan / daftar perintah
    else if (pesan === "bantuan" || pesan === "help") {
      const teks = `
📌 *Daftar Perintah Bot Kas Grup*:

➕ *+ jumlah keterangan*
Menambahkan pemasukan.
Contoh: + 10000 iuran juli

➖ *- jumlah keterangan*
Mencatat pengeluaran.
Contoh: - 5000 beli minum

📤 *total*
Menampilkan ringkasan bulan ini (masuk, keluar, saldo)

📊 *rekap*
Menampilkan rekap detail kas bulan ini

📄 *list*
Menampilkan 10 transaksi terakhir dengan ID

🗑️ *hapus [id]*
Menghapus transaksi berdasarkan ID
Contoh: hapus 3

❓ *bantuan / help*
Menampilkan daftar perintah ini

💡 Tips:
- Semua perintah hanya bisa digunakan di grup
- Format penulisan harus rapi agar data mudah diproses
      `;
      await sock.sendMessage(grup_id, { text: teks });
    }
  });
}

startBot();
