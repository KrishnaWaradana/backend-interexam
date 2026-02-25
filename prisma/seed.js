const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Memulai proses seeding data berskala masif...");

    // ==========================================
    // 1. DATA KATEGORI (Categories)
    // ==========================================
    const categoryList = [
        { nama: 'CPNS 2026', ket: 'Seleksi Calon Pegawai Negeri Sipil Terbaru' },
        { nama: 'UTBK-SNBT (Saintek)', ket: 'Seleksi Masuk PTN Kelompok Ujian IPA' },
        { nama: 'UTBK-SNBT (Soshum)', ket: 'Seleksi Masuk PTN Kelompok Ujian IPS' },
        { nama: 'PPPK Tenaga Teknis', ket: 'Pegawai Pemerintah Perjanjian Kerja' },
        { nama: 'Sekolah Kedinasan (STAN/STIS)', ket: 'Seleksi Ikatan Dinas' },
        { nama: 'Olimpiade Sains Nasional', ket: 'Kompetisi Sains Tingkat Nasional' },
        { nama: 'Ujian Mandiri PTN', ket: 'SIMAK UI, UTUL UGM, dll' },
        { nama: 'Psikotes Perusahaan', ket: 'Tes Masuk Kerja BUMN/Swasta' },
        { nama: 'Sertifikasi IT', ket: 'Ujian Kompetensi Bidang Teknologi' },
        { nama: 'Bahasa Asing (TOEFL/JLPT)', ket: 'Ujian Kemampuan Bahasa' }
    ];

    for (const c of categoryList) {
        const existingCat = await prisma.categories.findFirst({ where: { nama_category: c.nama } });
        if (!existingCat) {
            await prisma.categories.create({ data: { nama_category: c.nama, keterangan: c.ket } });
        }
    }
    console.log("✔️ Kategori (CPNS, UTBK, BUMN, dll) berhasil di-seed.");

    // ==========================================
    // 2. DATA JENJANG PENDIDIKAN
    // ==========================================
    const jenjangList = [
        { nama: 'SD', ket: 'Sekolah Dasar' },
        { nama: 'SMP', ket: 'Sekolah Menengah Pertama' },
        { nama: 'SMA', ket: 'Sekolah Menengah Atas' },
        { nama: 'Perguruan Tinggi', ket: 'Mahasiswa / Lulusan Univ' }
    ];

    const jenjangMap = {};
    for (const j of jenjangList) {
        let record = await prisma.jenjang.findFirst({ where: { nama_jenjang: j.nama } });
        if (!record) {
            record = await prisma.jenjang.create({ data: { nama_jenjang: j.nama, keterangan: j.ket } });
        }
        jenjangMap[j.nama] = record.id_jenjang;
    }
    console.log("✔️ Jenjang berhasil di-seed.");

    // ==========================================
    // 3. DATA MATA PELAJARAN (SUBJECTS)
    // ==========================================
    const subjectList = [
        // Umum & Sekolah
        "Matematika", "Bahasa Indonesia", "IPA Terpadu", "IPS Terpadu", "Bahasa Inggris", 
        "Fisika", "Kimia", "Biologi", "Ekonomi", "Geografi", "Sosiologi", "Sejarah",
        // UTBK Specific
        "Penalaran Umum", "Pengetahuan Kuantitatif", "Literasi Bahasa Indonesia", "Literasi Bahasa Inggris", "Penalaran Matematika",
        // CPNS/Kedinasan Specific
        "Tes Intelegensia Umum (TIU)", "Tes Wawasan Kebangsaan (TWK)", "Tes Karakteristik Pribadi (TKP)",
        // Perguruan Tinggi / IT
        "Struktur Data & Algoritma", "Basis Data", "Jaringan Komputer", "Hukum Tata Negara", "Akuntansi Keuangan"
    ];

    const subjectMap = {};
    for (const s of subjectList) {
        let record = await prisma.subjects.findFirst({ where: { nama_subject: s } });
        if (!record) {
            record = await prisma.subjects.create({ data: { nama_subject: s, keterangan: `Mata Pelajaran ${s}` } });
        }
        subjectMap[s] = record.id_subject;
    }
    console.log("✔️ Mata Pelajaran berhasil di-seed.");

    // ==========================================
    // 4. DATA TOPIK
    // ==========================================
    const topicsData = [
        // --- JENJANG SD ---
        { jenjang: 'SD', subject: 'Matematika', topics: ['Bilangan Bulat & Cacah', 'FPB & KPK', 'Pecahan, Desimal, Persen', 'Bangun Datar & Ruang Dasar', 'Koordinat Kartesius Dasar', 'Statistika Modus Median Mean', 'Skala & Perbandingan'] },
        { jenjang: 'SD', subject: 'IPA Terpadu', topics: ['Siklus Makhluk Hidup', 'Gaya, Gerak & Energi', 'Tata Surya & Bumi', 'Sifat & Perubahan Wujud Benda', 'Bunyi & Cahaya', 'Pelestarian Lingkungan', 'Anatomi Tubuh Manusia Dasar'] },

        // --- JENJANG SMP ---
        { jenjang: 'SMP', subject: 'Matematika', topics: ['Himpunan & Logika', 'Sistem Persamaan Linear Dua Variabel', 'Teorema Pythagoras', 'Lingkaran & Garis Singgung', 'Bangun Ruang Sisi Lengkung', 'Kesebangunan & Kekongruenan', 'Peluang & Statistika SMP'] },
        { jenjang: 'SMP', subject: 'Bahasa Inggris', topics: ['Descriptive Text', 'Recount Text', 'Narrative Text', 'Procedure Text', 'Report Text', 'Simple Present vs Continuous', 'Degrees of Comparison'] },

        // --- JENJANG SMA (SAINTEK & SOSHUM) ---
        { jenjang: 'SMA', subject: 'Fisika', topics: ['Besaran & Vektor', 'Kinematika Gerak Lurus', 'Dinamika Partikel (Newton)', 'Usaha & Energi', 'Fluida Statis & Dinamis', 'Termodinamika', 'Optik Geometris', 'Listrik Statis & Dinamis', 'Fisika Modern'] },
        { jenjang: 'SMA', subject: 'Kimia', topics: ['Struktur Atom & Sistem Periodik', 'Ikatan Kimia', 'Hukum Dasar Kimia & Stoikiometri', 'Termokimia', 'Laju Reaksi & Kesetimbangan', 'Larutan Asam Basa', 'Sifat Koligatif Larutan', 'Redoks & Elektrokimia', 'Senyawa Turunan Alkana'] },
        { jenjang: 'SMA', subject: 'Biologi', topics: ['Biologi Sel & Mikroskopis', 'Metabolisme & Enzim', 'Hereditas & Genetika', 'Bioteknologi Modern', 'Evolusi & Mutasi', 'Ekologi & Bioma', 'Fisiologi Sistem Manusia'] },
        { jenjang: 'SMA', subject: 'Ekonomi', topics: ['Konsep Kelangkaan', 'Permintaan & Penawaran', 'Kebijakan Moneter & Fiskal', 'Akuntansi Jasa & Dagang', 'Pasar Modal & Investasi', 'Manajemen & Koperasi'] },

        // --- JENJANG SMA (UTBK SNBT 2026) ---
        { jenjang: 'SMA', subject: 'Penalaran Umum', topics: ['Simpulan Logis', 'Penalaran Analitik', 'Logika Formal', 'Analisis Data Grafik/Tabel'] },
        { jenjang: 'SMA', subject: 'Pengetahuan Kuantitatif', topics: ['Geometri Geometris', 'Aritmatika Sosial', 'Fungsi & Logaritma', 'Matriks & Transformasi', 'Peluang Kejadian'] },

        // --- JENJANG PERGURUAN TINGGI (CPNS / KEDINASAN / KERJA) ---
        { jenjang: 'Perguruan Tinggi', subject: 'Tes Intelegensia Umum (TIU)', topics: ['Analogi Verbal (Hubungan Kata)', 'Silogisme (Penarikan Kesimpulan)', 'Analitis (Urutan Posisi)', 'Berhitung Cepat (Numerik)', 'Deret Angka & Huruf', 'Perbandingan Kuantitatif (X vs Y)', 'Figural (Analogi, Serial, Ketidaksamaan)'] },
        { jenjang: 'Perguruan Tinggi', subject: 'Tes Wawasan Kebangsaan (TWK)', topics: ['Nasionalisme & Sejarah Perjuangan', 'Integritas & Etika ASN', 'Bela Negara (Teori & Implementasi)', 'Pilar Negara (Pancasila, UUD 45, NKRI)', 'Bahasa Indonesia (EYD & Efektif)'] },
        { jenjang: 'Perguruan Tinggi', subject: 'Tes Karakteristik Pribadi (TKP)', topics: ['Pelayanan Publik', 'Jejaring Kerja & Komunikasi', 'Sosial Budaya (Kebhinekaan)', 'TIK & Profesionalisme', 'Anti Radikalisme', 'Kepemimpinan & Kerja Tim'] },
        
        // --- SPESIFIK JURUSAN (IT & HUKUM) ---
        { jenjang: 'Perguruan Tinggi', subject: 'Struktur Data & Algoritma', topics: ['Array, Stack & Queue', 'Linked List & Tree', 'Sorting & Searching', 'Complexity Big O Notation'] },
        { jenjang: 'Perguruan Tinggi', subject: 'Hukum Tata Negara', topics: ['Teori Kedaulatan', 'Lembaga Negara', 'Sengketa Konstitusi', 'Otonomi Daerah'] }
    ];

    let topicCount = 0;
    for (const group of topicsData) {
        const idJenjang = jenjangMap[group.jenjang];
        const idSubject = subjectMap[group.subject];

        for (const topicName of group.topics) {
            const existingTopic = await prisma.topics.findFirst({ 
                where: { nama_topics: topicName, id_jenjang: idJenjang, id_subjects: idSubject } 
            });

            if (!existingTopic) {
                await prisma.topics.create({
                    data: {
                        nama_topics: topicName,
                        keterangan: `Materi pembelajaran untuk ${topicName}`,
                        id_jenjang: idJenjang,
                        id_subjects: idSubject
                    }
                });
                topicCount++;
            }
        }
    }

    console.log(`✔️ Sukses! Menambahkan ${topicCount} Topik baru.`);
    console.log("🎉 SEEDING DATA SELESAI. DATABASE ANDA SEKARANG SUDAH SANGAT LENGKAP!");
}

main()
    .catch((e) => {
        console.error("❌ Seeding Gagal:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });