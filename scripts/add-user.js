// apps/backend/scripts/add-user.js
// Skrip praktis untuk menambah atau mengubah role user/admin di database InterExam

const prisma = require('../src/config/prismaClient');

async function addUser() {
  const args = process.argv.slice(2);
  const email = args[0];
  const roleInput = args[1] || 'Admin';
  const nameInput = args[2] || email?.split('@')[0] || 'User Admin';

  if (!email) {
    console.log(`
❌ Harap masukkan email!
Format penggunaan:
  node scripts/add-user.js <email> [role] [nama]

Contoh:
  node scripts/add-user.js user@gmail.com Admin "Nama Lengkap"
  node scripts/add-user.js validator@gmail.com Validator
  node scripts/add-user.js contributor@gmail.com Contributor
    `);
    process.exit(1);
  }

  const validRoles = ['Admin', 'Validator', 'Contributor'];
  const role = validRoles.find(r => r.toLowerCase() === roleInput.toLowerCase());

  if (!role) {
    console.error(`❌ Role '${roleInput}' tidak valid! Pilih salah satu: ${validRoles.join(', ')}`);
    process.exit(1);
  }

  try {
    console.log(`🔍 Memeriksa status akun untuk: ${email}...`);

    // 1. Cek apakah email terdaftar di tabel subscribers (Siswa)
    const subscriber = await prisma.subscribers.findFirst({
      where: { email_subscriber: email }
    });

    if (subscriber) {
      console.log(`⚠️ Email ditemukan di tabel Subscribers (id: ${subscriber.id_subscriber}).`);
      console.log(`Menghapus dari tabel Subscribers agar tidak konflik dengan login Internal...`);
      await prisma.subscribers.delete({
        where: { id_subscriber: subscriber.id_subscriber }
      });
      console.log(`✔️ Berhasil dibersihkan dari Subscribers.`);
    }

    // 2. Cek apakah sudah ada di tabel users (Internal)
    let user = await prisma.users.findFirst({
      where: { email_user: email }
    });

    if (user) {
      user = await prisma.users.update({
        where: { id_user: user.id_user },
        data: {
          role: role,
          status: 'Verified'
        }
      });
      console.log(`✅ BERHASIL DIUPDATE:`);
    } else {
      user = await prisma.users.create({
        data: {
          email_user: email,
          nama_user: nameInput,
          username: email.split('@')[0],
          role: role,
          status: 'Verified'
        }
      });
      console.log(`✅ BERHASIL DITAMBAHKAN:`);
    }

    // Catat ke userStatus
    await prisma.userStatus.create({
      data: {
        id_user: user.id_user,
        status: 'Verified',
        description: `Set as ${role} via script`,
        created_at: new Date()
      }
    });

    console.log(`----------------------------------------`);
    console.log(`ID User : ${user.id_user}`);
    console.log(`Email   : ${user.email_user}`);
    console.log(`Nama    : ${user.nama_user}`);
    console.log(`Role    : ${user.role}`);
    console.log(`Status  : ${user.status}`);
    console.log(`----------------------------------------`);
    console.log(`Sekarang Anda dapat login di /login-internal menggunakan akun Google tersebut!`);

  } catch (error) {
    console.error("❌ Terjadi kesalahan:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

addUser();
