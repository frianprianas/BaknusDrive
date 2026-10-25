# Aturan Proyek (Workspace Rules)

## Lingkungan Pengembangan (Workstation Only)
1. **Hanya Workstation untuk Koding**:
   - Mesin/komputer lokal ini HANYA digunakan sebagai workstation untuk menulis, mengedit, dan me-review kode.
   - **DILARANG KERAS** menjalankan Docker (`docker`, `docker compose`, dsb.) atau service container di komputer lokal ini.
   - Jangan pernah menyarankan, mencoba mengeksekusi, atau menjalankan Docker di mesin ini.

## Deployment & Server Workflow
2. **Sinkronisasi via Git**:
   - Semua perubahan kode dan update aplikasi disinkronkan ke server melalui Git (`git commit`, `git push` ke remote repository).
   - Server yang bertanggung jawab untuk menjalankan container/service dan production runtime.

## Identitas Git Pengembang
3. **Akun & Identitas Git**:
   - Username: `frianprianas`
   - Email: `freeyhan87@hotmail.com`
   - Remote: `https://github.com/frianprianas/BaknusDrive.git`
   - Agent AI harus selalu menggunakan dan mengingat identitas ini untuk setiap operasi Git di workstation ini tanpa perlu ditanyakan kembali.