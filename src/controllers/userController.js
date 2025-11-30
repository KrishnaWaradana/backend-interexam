exports.addUser = async (req, res) => {
    const { username, email_user, password, role, nama_user, phone, subject_ids } = req.body;
    
    // Logika Foto: Jika ada file, pakai path-nya. Jika tidak, NULL.
    // (Kita tidak simpan path default di database, cukup null saja agar hemat storage)
    const fotoPath = req.file ? req.file.path : null;

    try {
        // 1. VALIDASI FORM LENGKAP (WAJIB DIISI)
        // Cek apakah field penting terisi?
        if (!username || !email_user || !password || !role || !phone || !nama_user) {
            // Hapus foto jika terlanjur ter-upload agar tidak jadi sampah
            if (fotoPath) deleteFile(fotoPath);
            return res.status(400).json({ message: "Harap isi form dengan lengkap (Nama, Username/Email, Password, Jabatan, No HP)." });
        }

        // 2. VALIDASI DUPLIKAT
        const existingUser = await prisma.users.findFirst({
            where: {
                OR: [
                    { email_user: email_user },
                    { username: username },
                    { phone: phone }
                ]
            }
        });

        if (existingUser) {
            if (fotoPath) deleteFile(fotoPath);

            let msg = 'User sudah terdaftar.';
            if (existingUser.email_user === email_user) msg = 'Email sudah digunakan.';
            else if (existingUser.username === username) msg = 'Username sudah digunakan.';
            else if (existingUser.phone === phone) msg = 'Nomor telepon sudah digunakan.';

            return res.status(409).json({ message: msg });
        }

        // 3. HASH PASSWORD
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. DATA KEAHLIAN (RELASI)
        let kompetensiData = undefined;
        if (subject_ids) {
            const idsArray = Array.isArray(subject_ids) ? subject_ids : [subject_ids];
            kompetensiData = {
                create: idsArray.map(id => ({ id_subject: parseInt(id) }))
            };
        }

        // 5. SIMPAN KE DATABASE
        const newUser = await prisma.users.create({
            data: {
                username,
                email_user,
                nama_user,
                password: hashedPassword,
                role,
                phone,
                foto: fotoPath, // Bisa null (artinya pakai default nanti di frontend)
                kompetensi: kompetensiData
            }
        });

        res.status(201).json({ message: 'User berhasil ditambahkan.', data: { id_user: newUser.id_user } });

    } catch (error) {
        if (fotoPath) deleteFile(fotoPath);
        console.error('Prisma Error saat CREATE:', error);
        res.status(500).json({ message: 'Gagal memproses data di server.', error: error.message });
    }
};