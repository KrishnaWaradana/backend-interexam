const path = require('path');
const express = require('express');
const cors = require('cors'); 
const app = express();

const prisma = require('./config/prismaClient'); // ⬅️ IMPORT PRISMA DARI FILE CONFIG BARU

const adminRoutes = require('./routes/adminRoutes'); 

// MIDDLEWARE WAJIB
app.use(express.json()); 
app.use(cors({ 
    origin: ['http://localhost:5173', 'http://localhost:3000'], 
    credentials: true 
}));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
// ROUTE UTAMA
app.use('/api/v1', adminRoutes);

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server Express berjalan di http://localhost:${PORT}`);
});

// ⚠️ Perhatian: Hapus 'module.exports' dari sini, karena Controller akan mengimpor Prisma langsung dari config.
// Jika Controller juga membutuhkan app/port, gunakan const { app, prisma } = require('../index');