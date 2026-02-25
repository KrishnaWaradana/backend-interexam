const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Memulai SEEDING FINAL (Fix HTML & Relasi Subject)...");

    // ==========================================
    // 1. DATA KATEGORI
    // ==========================================
    const categoryList = [
        { nama: 'CPNS 2026', ket: 'Seleksi Calon Pegawai Negeri Sipil' },
        { nama: 'UTBK-SNBT (Saintek)', ket: 'Seleksi Masuk PTN Ujian IPA' },
        { nama: 'UTBK-SNBT (Soshum)', ket: 'Seleksi Masuk PTN Ujian IPS' },
        { nama: 'PPPK Tenaga Teknis', ket: 'Pegawai Pemerintah' },
        { nama: 'Sekolah Kedinasan', ket: 'Seleksi Ikatan Dinas' },
        { nama: 'Olimpiade Sains', ket: 'Kompetisi Sains Nasional' },
        { nama: 'Ujian Mandiri PTN', ket: 'SIMAK UI, UTUL UGM' },
        { nama: 'Psikotes Perusahaan', ket: 'Tes BUMN/Swasta' },
        { nama: 'Sertifikasi IT', ket: 'Ujian Kompetensi IT' },
        { nama: 'Bahasa Asing', ket: 'TOEFL/IELTS' }
    ];

    for (const c of categoryList) {
        const namaCat = c.nama.substring(0, 45);
        const ketCat = c.ket.substring(0, 45);
        const existing = await prisma.categories.findFirst({ where: { nama_category: namaCat } });
        if (!existing) {
            await prisma.categories.create({ data: { nama_category: namaCat, keterangan: ketCat } });
        }
    }
    console.log("✔️ Kategori OK.");

    // ==========================================
    // 2. DATA JENJANG (Disimpan ke Map biar Relasi Kuat)
    // ==========================================
    const jenjangList = [
        { nama: 'SD', ket: 'Sekolah Dasar' },
        { nama: 'SMP', ket: 'Sekolah Menengah Pertama' },
        { nama: 'SMA', ket: 'Sekolah Menengah Atas' },
        { nama: 'Perguruan Tinggi', ket: 'Mahasiswa / Umum' }
    ];

    const jenjangMap = {}; // Penyimpanan ID Jenjang
    for (const j of jenjangList) {
        let record = await prisma.jenjang.findFirst({ where: { nama_jenjang: j.nama } });
        if (!record) {
            record = await prisma.jenjang.create({ data: { nama_jenjang: j.nama, keterangan: j.ket } });
        }
        jenjangMap[j.nama] = record.id_jenjang;
    }
    console.log("✔️ Jenjang OK.");

    // ==========================================
    // 3. DATA MATA PELAJARAN (Disimpan ke Map biar Relasi Kuat)
    // ==========================================
    const subjectList = [
        "Matematika", "Bahasa Indonesia", "IPA Terpadu", "IPS Terpadu", "Bahasa Inggris", 
        "Fisika", "Kimia", "Biologi", "Ekonomi", "Geografi", "Sosiologi", "Sejarah",
        "Penalaran Umum", "Pengetahuan Kuantitatif", "Literasi B. Indonesia", "Literasi B. Inggris", "Penalaran Matematika",
        "TIU (Intelegensia)", "TWK (Wawasan)", "TKP (Karakteristik)",
        "Struktur Data", "Basis Data", "Jaringan Komputer", "Hukum Tata Negara", "Akuntansi Keuangan"
    ];

    const subjectMap = {}; // Penyimpanan ID Subject
    for (const s of subjectList) {
        const namaSub = s.substring(0, 45);
        const ketSub = `Mapel ${s}`.substring(0, 45);
        let record = await prisma.subjects.findFirst({ where: { nama_subject: namaSub } });
        if (!record) {
            record = await prisma.subjects.create({ data: { nama_subject: namaSub, keterangan: ketSub } });
        }
        // Kita simpan key-nya menggunakan nama ASLI dari array subjectList
        subjectMap[s] = record.id_subject; 
    }
    console.log("✔️ Mata Pelajaran OK.");

    // ==========================================
    // 4. DATA TOPIK (Relasi Dijamin 100% Masuk)
    // ==========================================
    const topicsData = [
        { jenjang: 'SD', subject: 'Matematika', topics: ['Bilangan Bulat & Cacah', 'FPB & KPK', 'Pecahan, Desimal, Persen'] },
        { jenjang: 'SD', subject: 'IPA Terpadu', topics: ['Siklus Makhluk Hidup', 'Tata Surya & Bumi'] },
        
        { jenjang: 'SMP', subject: 'Matematika', topics: ['Himpunan & Logika', 'Teorema Pythagoras', 'Lingkaran', 'Peluang & Statistika'] },
        { jenjang: 'SMP', subject: 'Bahasa Inggris', topics: ['Descriptive Text', 'Recount Text', 'Simple Present Tense'] },
        
        { jenjang: 'SMA', subject: 'Fisika', topics: ['Besaran & Vektor', 'Hukum Newton', 'Usaha & Energi'] },
        { jenjang: 'SMA', subject: 'Kimia', topics: ['Struktur Atom', 'Ikatan Kimia', 'Stoikiometri'] },
        { jenjang: 'SMA', subject: 'Biologi', topics: ['Biologi Sel', 'Genetika', 'Sistem Imunitas'] },
        { jenjang: 'SMA', subject: 'Ekonomi', topics: ['Permintaan Penawaran', 'Aritmatika Sosial'] },
        { jenjang: 'SMA', subject: 'Pengetahuan Kuantitatif', topics: ['Geometri', 'Peluang Kejadian'] },
        
        { jenjang: 'Perguruan Tinggi', subject: 'TIU (Intelegensia)', topics: ['Analogi Verbal', 'Silogisme Logika', 'Deret Angka & Huruf', 'Berhitung Cepat', 'Analitis Posisi', 'Figural Serial'] },
        { jenjang: 'Perguruan Tinggi', subject: 'TWK (Wawasan)', topics: ['Nasionalisme & Sejarah', 'Pilar Negara (Pancasila)', 'UUD 1945'] },
        { jenjang: 'Perguruan Tinggi', subject: 'TKP (Karakteristik)', topics: ['Pelayanan Publik', 'Jejaring Kerja', 'Profesionalisme'] },
        
        { jenjang: 'Perguruan Tinggi', subject: 'Struktur Data', topics: ['Array & Stack'] },
        { jenjang: 'Perguruan Tinggi', subject: 'Basis Data', topics: ['Basis Data'] },
        { jenjang: 'Perguruan Tinggi', subject: 'Jaringan Komputer', topics: ['Jaringan Komputer'] }, 
        { jenjang: 'Perguruan Tinggi', subject: 'Hukum Tata Negara', topics: ['Hukum Tata Negara'] },
        { jenjang: 'Perguruan Tinggi', subject: 'Akuntansi Keuangan', topics: ['Akuntansi Keuangan'] }
    ];

    let topicCount = 0;
    for (const group of topicsData) {
        // Ambil ID langsung dari Map yang sudah kita buat di atas
        const idJenjang = jenjangMap[group.jenjang];
        const idSubject = subjectMap[group.subject];

        if (!idJenjang || !idSubject) {
            console.error(`❌ ERROR FATAL: Mapel "${group.subject}" atau Jenjang "${group.jenjang}" tidak ditemukan ID-nya! Cek ejaan.`);
            continue; 
        }

        for (const topicName of group.topics) {
            const namaTopik = topicName.substring(0, 45);
            const ketTopik = `Materi ${topicName}`.substring(0, 45);

            const existingTopic = await prisma.topics.findFirst({ 
                where: { nama_topics: namaTopik, id_jenjang: idJenjang, id_subjects: idSubject } 
            });

            if (!existingTopic) {
                await prisma.topics.create({
                    data: { 
                        nama_topics: namaTopik, 
                        keterangan: ketTopik, 
                        id_jenjang: idJenjang, 
                        id_subjects: idSubject // RELASI SUBJECT DI SINI PASTI TERISI
                    }
                });
                topicCount++;
            }
        }
    }
    console.log(`✔️ Topik OK (${topicCount} created). Relasi ke Subject aman.`);


    // ==========================================
    // 5. USER (REAL USER DARI DB)
    // ==========================================
    console.log("🔍 Menyiapkan Users...");
    
    // Pastikan user ada (buat jika belum ada)
    const usersToCreate = [
        { email: 'contributor@seeder.com', username: 'Seeder Contributor', role: 'Contributor' },
        { email: 'validator@seeder.com', username: 'Seeder Validator', role: 'Validator' },
        { email: 'admin@seeder.com', username: 'Seeder Admin', role: 'Admin' }
    ];

    for (const u of usersToCreate) {
        const exist = await prisma.users.findUnique({ where: { email_user: u.email } });
        if (!exist) {
            await prisma.users.create({
                data: {
                    email_user: u.email,
                    username: u.username,
                    nama_user: u.username,
                    password: '$2b$10$dummyhashedpassword', 
                    role: u.role,
                    status: 'Verified'
                }
            });
        }
    }

    const realContributors = await prisma.users.findMany({ where: { role: 'Contributor' } });
    const realValidators = await prisma.users.findMany({ where: { role: { in: ['Validator', 'Admin'] } } });

    const getRandomUser = (arr) => arr[Math.floor(Math.random() * arr.length)];


    // ==========================================
    // 6. 50 SOAL REAL (NO HTML TAGS & CLEAN)
    // ==========================================
    console.log("📝 Membuat 50 Soal Real (Tanpa HTML Tag)...");

    const realQuestions = [
        // --- TIU (CPNS) ---
        { topic: 'Analogi Verbal', text: 'KAKI : SEPATU = ... : ...', correct: 'Telinga : Anting', wrongs: ['Meja : Ruangan', 'Cat : Kuas', 'Cincin : Jari', 'Topi : Kepala'], discuss: 'Hubungan: Kaki memakai sepatu. Telinga memakai Anting.' },
        { topic: 'Silogisme Logika', text: 'Semua mahasiswa lulusan universitas memiliki gelar sarjana. Budi adalah mahasiswa lulusan universitas.', correct: 'Budi memiliki gelar sarjana.', wrongs: ['Budi mungkin memiliki gelar sarjana.', 'Budi belum tentu sarjana.', 'Tidak semua mahasiswa sarjana.', 'Budi lulusan terbaik.'], discuss: 'Premis umum menyatakan semua lulusan universitas bergelar sarjana. Maka Budi bergelar sarjana.' },
        { topic: 'Berhitung Cepat', text: 'Jika x = 1/16 dan y = 16%, maka ...', correct: 'x < y', wrongs: ['x > y', 'x = y', 'x = 2y', 'Hubungan x dan y tidak dapat ditentukan'], discuss: 'x = 0.0625. y = 0.16. Maka x < y.' },
        { topic: 'Deret Angka & Huruf', text: '2, 5, 10, 17, 26, ...', correct: '37', wrongs: ['35', '36', '34', '38'], discuss: 'Pola deret: +3, +5, +7, +9. Selanjutnya +11. 26 + 11 = 37.' },
        { topic: 'Analitis Posisi', text: 'Andi lebih tinggi dari Budi. Budi lebih tinggi dari Caca. Siapakah yang paling pendek?', correct: 'Caca', wrongs: ['Andi', 'Budi', 'Tidak bisa ditentukan', 'Semua sama tinggi'], discuss: 'Urutan tinggi: Andi > Budi > Caca. Caca paling pendek.' },
        { topic: 'Figural Serial', text: 'Tentukan gambar selanjutnya dari pola rotasi 90 derajat searah jarum jam...', correct: 'Gambar menghadap kanan', wrongs: ['Gambar menghadap kiri', 'Gambar menghadap atas', 'Gambar menghadap bawah', 'Gambar miring'], discuss: 'Pola rotasi konsisten 90 derajat ke kanan.' },
        
        // --- TWK (CPNS) ---
        { topic: 'Nasionalisme & Sejarah', text: 'Organisasi pergerakan nasional yang pertama kali bergerak dalam bidang politik adalah...', correct: 'Indische Partij', wrongs: ['Budi Utomo', 'Sarekat Islam', 'Perhimpunan Indonesia', 'PNI'], discuss: 'Indische Partij (1912) adalah organisasi politik pertama.' },
        { topic: 'Pilar Negara (Pancasila)', text: 'Sikap gotong royong merupakan butir pengamalan Pancasila sila ke...', correct: 'Kelima', wrongs: ['Pertama', 'Kedua', 'Ketiga', 'Keempat'], discuss: 'Sila ke-5 (Keadilan Sosial) menekankan gotong royong.' },
        { topic: 'UUD 1945', text: 'Amandemen pertama UUD 1945 dilakukan pada tahun...', correct: '1999', wrongs: ['1998', '2000', '2001', '2002'], discuss: 'Amandemen UUD 1945: 1999, 2000, 2001, 2002.' },
        
        // --- TKP (CPNS) ---
        { topic: 'Pelayanan Publik', text: 'Ada pelanggan marah karena antrian lama, sikap Anda...', correct: 'Meminta maaf dan menenangkan pelanggan', wrongs: ['Diam saja', 'Meminta satpam mengusir', 'Memarahinya balik', 'Menutup loket'], discuss: 'Empati dan sopan santun adalah kunci pelayanan publik.' },
        { topic: 'Profesionalisme', text: 'Anda ditawari gratifikasi agar proses perizinan dipercepat. Sikap Anda...', correct: 'Menolak tegas', wrongs: ['Menerima diam-diam', 'Menolak tapi minta sumbangan', 'Melapor atasan saja', 'Ragu-ragu'], discuss: 'Integritas ASN diuji. Wajib menolak gratifikasi.' },
        { topic: 'Jejaring Kerja', text: 'Membangun relasi kerja bermanfaat untuk...', correct: 'Mempermudah pencapaian tujuan organisasi', wrongs: ['Menambah musuh', 'Pamer jabatan', 'Korupsi', 'Bersantai'], discuss: 'Networking memperluas kolaborasi positif.' },

        // --- MATEMATIKA ---
        { topic: 'Bilangan Bulat & Cacah', text: 'Hasil dari -15 + (-12) : 3 adalah...', correct: '-19', wrongs: ['-9', '9', '-1', '1'], discuss: '(-12 : 3) = -4. Lalu (-15) + (-4) = -19.' },
        { topic: 'Himpunan & Logika', text: 'Jika A = {1, 2, 3} dan B = {3, 4, 5}, maka A ∩ B adalah...', correct: '{3}', wrongs: ['{1, 2, 3, 4, 5}', '{1, 2}', '{4, 5}', '{}'], discuss: 'Angka 3 ada di kedua himpunan.' },
        { topic: 'Teorema Pythagoras', text: 'Segitiga siku-siku alas 3 cm, tinggi 4 cm. Sisi miring adalah...', correct: '5 cm', wrongs: ['6 cm', '7 cm', '8 cm', '9 cm'], discuss: '3, 4, 5 adalah Tripel Pythagoras.' },
        { topic: 'Lingkaran', text: 'Rumus luas lingkaran adalah...', correct: 'π × r²', wrongs: ['2 × π × r', 'π × d', 'p × l', 'a × t / 2'], discuss: 'Luas lingkaran menggunakan kuadrat jari-jari.' },
        { topic: 'Bilangan Bulat & Cacah', text: '500 + 25 x 4 = ...', correct: '600', wrongs: ['2100', '529', '1250', '2000'], discuss: '25x4=100. 500+100=600.' },
        { topic: 'Peluang & Statistika', text: 'Peluang muncul gambar pada pelemparan satu koin adalah...', correct: '1/2', wrongs: ['1/4', '1/3', '1', '0'], discuss: 'Hanya ada 2 sisi. Peluang 1 dari 2.' },

        // --- FISIKA ---
        { topic: 'Hukum Newton', text: 'Hukum Newton I dikenal dengan sebutan hukum...', correct: 'Kelembaman', wrongs: ['Aksi-Reaksi', 'Percepatan', 'Kekekalan Energi', 'Gravitasi'], discuss: 'Sifat mempertahankan keadaan disebut inersia/kelembaman.' },
        { topic: 'Usaha & Energi', text: 'Energi benda karena ketinggiannya disebut...', correct: 'Energi Potensial', wrongs: ['Kinetik', 'Mekanik', 'Listrik', 'Kimia'], discuss: 'EP = mgh (ketinggian).' },
        { topic: 'Besaran & Vektor', text: 'Yang termasuk besaran vektor adalah...', correct: 'Kecepatan', wrongs: ['Jarak', 'Massa', 'Waktu', 'Suhu'], discuss: 'Vektor punya nilai dan arah.' },
        
        // --- BIOLOGI ---
        { topic: 'Biologi Sel', text: 'Organel sel penghasil energi adalah...', correct: 'Mitokondria', wrongs: ['Ribosom', 'Lisosom', 'Retikulum Endoplasma', 'Nukleus'], discuss: 'Mitokondria adalah tempat respirasi sel.' },
        { topic: 'Genetika', text: 'Bapak genetika dunia adalah...', correct: 'Gregor Mendel', wrongs: ['Charles Darwin', 'Louis Pasteur', 'Robert Hooke', 'Aristoteles'], discuss: 'Mendel meneliti pewarisan sifat.' },
        { topic: 'Sistem Imunitas', text: 'Vaksinasi bertujuan untuk...', correct: 'Memicu antibodi', wrongs: ['Membunuh bakteri', 'Menyembuhkan sakit', 'Menambah darah', 'Mengurangi nyeri'], discuss: 'Vaksin melatih sistem imun.' },
        { topic: 'Siklus Makhluk Hidup', text: 'Hewan dengan metamorfosis sempurna adalah...', correct: 'Kupu-kupu', wrongs: ['Kecoa', 'Belalang', 'Ayam', 'Kucing'], discuss: 'Telur-Ulat-Kepompong-Kupu.' },

        // --- B. INGGRIS ---
        { topic: 'Simple Present Tense', text: 'She ... to school every day.', correct: 'goes', wrongs: ['go', 'going', 'went', 'gone'], discuss: 'Subjek She menggunakan verb+es.' },
        { topic: 'Descriptive Text', text: 'Generic structure of Descriptive Text is...', correct: 'Identification - Description', wrongs: ['Orientation - Events', 'Goal - Steps', 'Thesis - Arguments', 'Complication - Resolution'], discuss: 'Identifikasi lalu Deskripsi.' },
        { topic: 'Recount Text', text: 'Recount text uses ... tense.', correct: 'Simple Past', wrongs: ['Simple Future', 'Simple Present', 'Present Continuous', 'Past Continuous'], discuss: 'Menceritakan masa lalu.' },

        // --- KIMIA & EKO ---
        { topic: 'Struktur Atom', text: 'Partikel inti atom adalah...', correct: 'Proton dan Neutron', wrongs: ['Proton Elektron', 'Elektron Neutron', 'Proton saja', 'Elektron saja'], discuss: 'Inti berisi Proton+Neutron.' },
        { topic: 'Stoikiometri', text: 'Satuan jumlah zat kimia adalah...', correct: 'Mol', wrongs: ['Gram', 'Liter', 'Molaritas', 'Ampere'], discuss: 'Satuan SI jumlah zat adalah Mol.' },
        { topic: 'Permintaan Penawaran', text: 'Jika harga naik, maka permintaan...', correct: 'Turun', wrongs: ['Naik', 'Tetap', 'Hilang', 'Stabil'], discuss: 'Hukum permintaan.' },
        { topic: 'Aritmatika Sosial', text: 'Bunga tabungan dinyatakan dalam...', correct: 'Persen (%)', wrongs: ['Rupiah', 'Desimal', 'Pecahan', 'Derajat'], discuss: 'Suku bunga dalam persen.' },

        // --- UMUM / KULIAH ---
        { topic: 'Array & Stack', text: 'Prinsip kerja Stack adalah...', correct: 'LIFO', wrongs: ['FIFO', 'Random', 'Sorted', 'Queue'], discuss: 'Last In First Out.' },
        { topic: 'Basis Data', text: 'Kepanjangan SQL adalah...', correct: 'Structured Query Language', wrongs: ['Simple Query Language', 'Standard Question Language', 'System Query Logic', 'System Question List'], discuss: 'Bahasa query terstruktur.' },
        { topic: 'Jaringan Komputer', text: 'Penghubung jaringan beda segmen adalah...', correct: 'Router', wrongs: ['Switch', 'Hub', 'Kabel LAN', 'Modem'], discuss: 'Router merutekan paket.' },
        { topic: 'Hukum Tata Negara', text: 'Lembaga legislatif Indonesia adalah...', correct: 'DPR', wrongs: ['Presiden', 'MA', 'KPK', 'BPK'], discuss: 'Dewan Perwakilan Rakyat.' },
        { topic: 'Akuntansi Keuangan', text: 'Harta = Utang + ...', correct: 'Modal', wrongs: ['Beban', 'Pendapatan', 'Prive', 'Kas'], discuss: 'Persamaan dasar akuntansi.' },
        { topic: 'Tata Surya & Bumi', text: 'Planet terbesar adalah...', correct: 'Jupiter', wrongs: ['Saturnus', 'Bumi', 'Mars', 'Uranus'], discuss: 'Jupiter planet terbesar.' },
        { topic: 'Geometri', text: 'Besar sudut siku-siku adalah...', correct: '90 derajat', wrongs: ['45 derajat', '180 derajat', '360 derajat', '60 derajat'], discuss: 'Tegak lurus 90 derajat.' },
        { topic: 'Peluang Kejadian', text: 'Peluang dadu angka genap adalah...', correct: '1/2', wrongs: ['1/6', '2/6', '4/6', '5/6'], discuss: 'Genap (2,4,6) ada 3 dari 6.' },
        { topic: 'Silogisme Logika', text: 'Semua ikan berenang. Lele adalah ikan.', correct: 'Lele bisa berenang', wrongs: ['Lele terbang', 'Lele bukan ikan', 'Sebagian ikan berenang', 'Tidak disimpulkan'], discuss: 'Kesimpulan logis.' },
        { topic: 'Analogi Verbal', text: 'GURU : SEKOLAH = ... : ...', correct: 'Dokter : Rumah Sakit', wrongs: ['Petani : Cangkul', 'Supir : Mobil', 'Penyanyi : Suara', 'Penulis : Buku'], discuss: 'Profesi dan tempat kerja.' },
        { topic: 'Deret Angka & Huruf', text: 'A, C, E, G, ...', correct: 'I', wrongs: ['H', 'J', 'K', 'L'], discuss: 'Loncat 1 huruf.' },
        { topic: 'Berhitung Cepat', text: '15% dari 200 adalah...', correct: '30', wrongs: ['20', '25', '35', '40'], discuss: '30.' },
        { topic: 'Pilar Negara (Pancasila)', text: 'Lambang sila pertama adalah...', correct: 'Bintang', wrongs: ['Rantai', 'Pohon Beringin', 'Kepala Banteng', 'Padi Kapas'], discuss: 'Ketuhanan YME.' },
        { topic: 'Nasionalisme & Sejarah', text: 'Pembaca teks Proklamasi adalah...', correct: 'Ir. Soekarno', wrongs: ['Moh. Hatta', 'Sayuti Melik', 'Ahmad Soebardjo', 'Sudirman'], discuss: 'Didampingi Hatta.' },
        { topic: 'Pelayanan Publik', text: 'Prinsip pelayanan publik yang BURUK adalah...', correct: 'Berbelit-belit', wrongs: ['Transparan', 'Akuntabel', 'Cepat', 'Mudah'], discuss: 'Pelayanan harus mudah dan cepat.' }
    ];

    let soalCreatedCount = 0;

    for (let i = 0; i < realQuestions.length; i++) {
        const q = realQuestions[i];
        
        // Cari Topik ID (Match nama depan 45 char)
        const namaTopikCari = q.topic.substring(0, 45);
        const topicDb = await prisma.topics.findFirst({
            where: { nama_topics: namaTopikCari },
            include: { subject: true } // Cek relasinya sekalian
        });

        if (!topicDb) {
            console.warn(`⚠️ SKIP: Topik "${q.topic}" tidak ketemu. Cek data TopicsData.`);
            continue; 
        }

        const contributor = getRandomUser(realContributors);
        const validator = getRandomUser(realValidators);

        // Opsi Jawaban
        const answerList = [];
        
        // Benar
        answerList.push({
            opsi_jawaban_text: q.correct, // Plain text
            status: true,
            pembahasan: q.discuss
        });

        // Salah
        const wrongs = Array.isArray(q.wrongs) ? q.wrongs : [q.wrongs];
        wrongs.forEach(wrongText => {
            answerList.push({
                opsi_jawaban_text: wrongText,
                status: false,
                pembahasan: "Jawaban ini kurang tepat."
            });
        });

        // Dummy filler jika kurang dari 5
        while(answerList.length < 5) {
            answerList.push({
                opsi_jawaban_text: `Opsi Tambahan ${answerList.length}`,
                status: false,
                pembahasan: "Salah."
            });
        }

        // Create Soal
        await prisma.soal.create({
            data: {
                tanggal_pembuatan: new Date().toISOString(),
                text_soal: q.text, // SUDAH BERSIH DARI TAG HTML
                jenis_soal: 'multiple_choice',
                level_kesulitan: i % 3 === 0 ? 'mudah' : (i % 3 === 1 ? 'sedang' : 'sulit'),
                status: 'disetujui',
                
                // --- FIX: NULL AGAR TIDAK MUNCUL KUNING DI FRONTEND ---
                catatan_revisi: null, 
                
                id_contributor: contributor.id_user,
                id_topics: topicDb.id_topics,
                // Kita tidak perlu input id_subjects di tabel Soal karena tabel Soal tidak punya kolom id_subjects
                // Relasinya via Topic. Karena Topic sudah punya Subject (dijamin di langkah 4), maka aman.
                
                jawaban: { create: answerList },
                validasi: {
                    create: {
                        tanggal_validasi: new Date(),
                        keterangan: "Valid.",
                        status: 'disetujui',
                        id_validator: validator.id_user
                    }
                }
            }
        });
        soalCreatedCount++;
    }

    console.log(`✔️ Sukses! Berhasil membuat ${soalCreatedCount} Soal Real & Bersih.`);
    console.log("🎉 SEEDING FINAL SELESAI.");
}

main()
    .catch((e) => {
        console.error("❌ Seeding Gagal:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });