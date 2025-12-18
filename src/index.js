const path = require('path');
const express = require('express');
const cors = require('cors'); 
const app = express();
const dotenv = require('dotenv');

dotenv.config();

global.__basedir = __dirname;

const prisma = require('./config/prismaClient'); 

const contributorLookupRoutes = require('./routes/contributor/lookupRoutes');
const adminRoutes = require('./routes/adminRoutes'); 
const topicRoutes = require('./routes/topicRoutes');
const authRoutes = require('./routes/authRoutes');
const jenjangRoutes = require('./routes/jenjangRoutes');
const adminBankSoalRoutes = require('./routes/adminBankSoalRoutes');

const soalRoutes = require('./routes/contributor/soalRoutes'); 
const validatorBankSoalRoutes = require('./routes/validator/BankSoalRoutes');

// MIDDLEWARE WAJIB
app.use(express.json()); // Parsing JSON body
app.use(cors({ 
    origin: ['http://localhost:5173', 'http://localhost:3000'], 
    credentials: true 
}));
// Middleware untuk melayani file statis dari folder uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));


//  DAFTAR ROUTE UTAMA (PREFIXING) 

// Admin Routes (Contoh: /api/v1/admin/users)
app.use('/api/v1', adminRoutes); 

// Topic Routes (Contoh: /api/v1/topics/list)
app.use('/api/v1/topics', topicRoutes); 

// Auth Routes (Contoh: /api/auth/google)
app.use('/api/auth', authRoutes);

// Jenjang Routes (Contoh: /api/v1/admin/jenjang/list)
app.use('/api/v1/admin/jenjang', jenjangRoutes); 

// Admin Bank Soal (Melihat Semua Soal)
// Endpoint: http://localhost:5000/api/v1/admin/bank-soal
app.use('/api/v1/admin/bank-soal', adminBankSoalRoutes);

// Validator Bank Soal (Validasi Sesuai Kompetensi)
// Endpoint: http://localhost:5000/api/v1/validator/bank-soal
app.use('/api/v1/validator/bank-soal', validatorBankSoalRoutes);


// Jalan untuk ambil data Jenjang & Subject
app.use('/api/v1/contributor/lookup', contributorLookupRoutes);
// Ini akan membuat endpoint POST yang dicari menjadi: /api/v1/contributor/question
app.use('/api/v1/contributor', soalRoutes); 



const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server Express berjalan di http://localhost:${PORT}`);
});