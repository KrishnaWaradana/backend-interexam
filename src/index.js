const path = require('path');
const express = require('express');
const cors = require('cors'); 
const app = express();
const dotenv = require('dotenv');

dotenv.config();
const prisma = require('./config/prismaClient'); // ⬅️ IMPORT PRISMA DARI FILE CONFIG BARU

const adminRoutes = require('./routes/adminRoutes'); 
const topicRoutes = require('./routes/topicRoutes');
const authRoutes = require('./routes/authRoutes');
const jenjangRoutes = require('./routes/jenjangRoutes');

const adminBankSoalRoutes = require('./routes/adminBankSoalRoutes');
const validatorBankSoalRoutes = require('./routes/validator/bankSoalRoutes');

// MIDDLEWARE WAJIB
app.use(express.json()); 
app.use(cors({ 
    origin: ['http://localhost:5173', 'http://localhost:3000'], 
    credentials: true 
}));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
// ROUTE UTAMA
app.use('/api/v1', adminRoutes);
app.use('/api/v1/topics', topicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/v1/admin/jenjang', jenjangRoutes); 
app.use('/api/v1/admin/bank-soal', adminBankSoalRoutes);
app.use('/api/v1/validator/bank-soal', validatorBankSoalRoutes);

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server Express berjalan di http://localhost:${PORT}`);
});

// ⚠️ Perhatian: Hapus 'module.exports' dari sini, karena Controller akan mengimpor Prisma langsung dari config.
// Jika Controller juga membutuhkan app/port, gunakan const { app, prisma } = require('../index');