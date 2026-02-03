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
const paketSoalRoutes = require('./routes/paketSoalRoutes');
const soalRoutes = require('./routes/contributor/soalRoutes'); 
const bankSoalRoutes = require('./routes/BankSoalRoutes');
const subTopicRoutes = require('./routes/subTopikRoutes');
const categoryRoutes = require('./routes/categoryRoutes');

// MIDDLEWARE WAJIB
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ limit: '10mb', extended: true })); // Parsing JSON body
app.use(cors({ 
    origin: ['http://localhost:5173', 'http://localhost:3000'], 
    credentials: true 
}));
// Middleware untuk melayani file statis dari folder uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));


//  DAFTAR ROUTE UTAMA (PREFIXING) 
app.use('/api/v1/admin', adminRoutes);

// Admin Routes (Contoh: /api/v1/admin/users)
app.use('/api/v1', adminRoutes); 

// Topic Routes (Contoh: /api/v1/topics/list)
app.use('/api/v1/topics', topicRoutes); 

// Auth Routes (Contoh: /api/auth/google)
app.use('/api/auth', authRoutes);

app.use('/api/v1/admin/paket-soal', paketSoalRoutes);

app.use('/api/v1/categories', categoryRoutes);
// Jenjang Routes (Contoh: /api/v1/admin/jenjang/list)
app.use('/api/v1/admin/jenjang', jenjangRoutes); 

// E. BANK SOAL (UNIFIED ROUTE) 
// Endpoint ini dipakai Admin & Validator.
// -> Admin: GET /api/v1/bank-soal?as_role=admin
// -> Validator: GET /api/v1/bank-soal?as_role=validator
app.use('/api/v1/bank-soal', bankSoalRoutes);


// Jalan untuk ambil data Jenjang & Subject
app.use('/api/v1/contributor/lookup', contributorLookupRoutes);
// Ini akan membuat endpoint POST yang dicari menjadi: /api/v1/contributor/question
app.use('/api/v1/contributor', soalRoutes); 

app.use('/api/v1/subtopics', subTopicRoutes);



const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server Express berjalan di http://localhost:${PORT}`);
});