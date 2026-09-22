# Vitacom Studio

## Jalankan admin

1. Buka `Start-Vitacom-Admin.cmd` dalam folder projek ini (Python 3 diperlukan).
2. Buka http://127.0.0.1:8766/admin.html.
3. Pada kali pertama, cipta kata laluan sendiri, sekurang-kurangnya 10 aksara.
4. Pilih halaman, klik teks atau gambar dalam pratonton, dan edit melalui panel kanan.
5. Tekan **Simpan website lokal**. Refresh halaman website untuk melihat hasilnya.

## Fungsi

- Edit teks, saiz dan warna; edit pautan serta metadata carian setiap halaman.
- Tukar gambar melalui upload, URL atau pustaka; sembunyikan gambar tanpa memadam fail asal.
- Susun semula dan sembunyikan seksyen asal.
- Tambah seksyen tajuk, teks, gambar dan butang pada penghujung halaman; susun sesama seksyen tambahan.
- Warna jenama dan font teks untuk semua halaman.
- Undo/redo, draf browser, sejarah 20 versi, eksport/import kandungan JSON.
- Logo dan elemen berulang boleh dipilih dan diedit pada setiap halaman.
- Dashboard dengan jumlah halaman, fail gambar, versi tersimpan, akses pantas dan aktiviti terkini.
- Carian gambar mengikut nama/folder, penapis jenis fail, susunan nama/tarikh/saiz, serta carian pemilih gambar.
- Bar pengumuman global dengan mesej dan pautan pilihan, menggunakan aliran draf/pratonton/simpan yang sama.
- Profil nama admin, tukar kata laluan dengan pengesahan kata laluan semasa, dan log keluar sesi lain.
- Rekod 200 aktiviti terkini, boleh dicari; aktiviti sebelum ciri ini dipasang tidak direkodkan semula.
- Duplikasi seksyen tambahan; Ctrl+S atau Command+S untuk simpan kandungan dari mana-mana menu.
- Site Health menyemak tajuk/penerangan SEO, alt gambar, pautan dan fail dalaman, upload serta ruang cakera.
- Pusat notifikasi menunjukkan draf belum disimpan, draf lama dan isu Site Health yang memerlukan perhatian.
- Carian pantas Ctrl+K atau Command+K membuka semua alat admin tanpa mencari menu secara manual.

Tetapan akaun disimpan terus; tetapan website kekal sebagai draf sehingga butang Simpan ditekan.
Dashboard memaparkan data kandungan sebenar, bukan statistik pelawat atau jualan.
Versi lokal menggunakan satu akaun admin; pengurusan ramai pengguna/peranan belum diaktifkan.
Menukar kata laluan menamatkan semua sesi lama dan memperbaharui sesi semasa.

## Fail dan simpanan

`content.json` menyimpan perubahan website. `cms.js` membaca fail tersebut pada setiap halaman.
Gambar upload berada dalam `assets/uploads/`. Kandungan dan upload disalin ke `dist` juga.
Kata laluan berhash dan sejarah berada dalam `.vitacom-admin/`, yang disekat oleh server admin.
Jangan terbitkan folder `.vitacom-admin`. Buat sandaran seluruh projek untuk menyertakan semua gambar.
Sandaran JSON hanya mengandungi kandungan dan rujukan gambar, bukan fail gambar itu sendiri.

Server menggunakan pustaka standard Python sahaja. Ia mendengar pada `127.0.0.1` sahaja,
bukan rangkaian awam. Tutup tetingkap server untuk menghentikannya. Sesi login bertahan 8 jam.
Jika lupa kata laluan, hentikan server dan pindahkan `.vitacom-admin/auth.json` ke tempat selamat,
kemudian mulakan semula untuk setup akaun. Kaedah ini memerlukan akses fail pada komputer ini.

## Akses online yang dirancang

Versi ini ialah CMS lokal yang berfungsi, bukan admin online yang sudah diterbitkan.
Admin dan API dipisahkan supaya backend boleh dipindahkan kemudian. Sebelum penggunaan online,
sambungkan API kepada hosting backend yang menyokong storan kekal, gunakan HTTPS/cookie Secure,
dan pilih storan gambar, akaun admin serta sandaran bersama. Vercel static hosting sahaja tidak
menjalankan server Python ini atau memberi simpanan fail kekal. Jangan dedahkan port server lokal.

Tiada deployment dilakukan oleh butang Simpan. Website online sedia ada tidak berubah.

## Semakan

`python test_admin.py` menguji login, perlindungan origin, simpanan, konflik versi, sejarah, upload,
tetapan pengumuman, profil, pertukaran kata laluan dan penamatan sesi
dalam direktori sementara tanpa mengubah kandungan atau kata laluan projek ini.
