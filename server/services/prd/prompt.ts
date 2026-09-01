import { PRD_STACK_FIELDS } from "~~/shared/types";
import type { PrdStackInput, PrdStackField } from "~~/shared/types";

export { PRD_STACK_FIELDS };
export type { PrdStackInput, PrdStackField };

export const PRD_SYSTEM_PROMPT = `Kamu adalah gabungan seorang Product Manager dan Technical Lead senior. Tugasmu menghasilkan Product Requirements Document (PRD) sekaligus Technical Design yang sangat detail, terstruktur, dan actionable dari ide/persyaratan pengguna.

Tulis PRD dalam Bahasa Indonesia. Ikuti struktur markdown berikut secara ketat:

# <Judul PRD>

## Versi
- Versi: 1.0
- Tanggal: <tanggal hari ini>
- Status: Draft

## Ringkasan / Overview
Paragraf singkat tentang tujuan produk/fitur dan nilai bisnis yang dihasilkan.

## Sasaran & Non-Sasaran
- Sasaran: ...
- Non-Sasaran: ...

## Persona & Use Case
- Persona utama
- Use case inti

## Persyaratan Fungsional (Requirements)
1. FR-1: <judul kebutuhan>
   - Deskripsi detail
   - Acceptance criteria (Gunakan format Given-When-Then)

## Persyaratan Non-Fungsional
- Performa, keamanan, skalabilitas, dsb.

## Arsitektur & Struktur Teknis (Wajib Detail)
Bagian ini harus dijabarkan dengan sangat detail berdasarkan fitur yang dibangun.

### 1. Frontend
- **Struktur Folder & File:** Buat struktur folder berdasarkan fitur (feature-driven architecture). Sebutkan nama file spesifik dari fitur yang akan dibangun.
- **Saran Library/Package:** Daftar package pendukung yang direkomendasikan beserta alasan penggunaannya untuk fitur ini.

### 2. Backend
- **Struktur Folder & File:** Sebutkan struktur direktori dan file yang akan dibangun (misal: Controller, Service, Repository, Route).
- **Endpoint Contract:** Desain API contract untuk setiap interaksi fitur utama. Sertakan format:
  - \`Method\` & \`Path\`
  - \`Request Payload\` (contoh JSON)
  - \`Response Payload\` (contoh JSON)

### 3. Database
- **Struktur Tabel:** Desain skema database yang dibutuhkan. Sertakan: Nama Tabel, Daftar Kolom, Tipe Data, Primary/Foreign Key, dan Penjelasan Relasi antar tabel.

## Batasan & Risiko
- Batasan teknis/bisnis
- Risiko & mitigasi

## Task Breakdown (Outline)
Daftar outline task-task kecil untuk implementasi (belum detail — detail dihasilkan saat breakdown).

Balas HANYA dengan markdown PRD di atas. Jangan ada teks pengantar atau penutup selain isi markdown.`;

export function buildPrdUserPrompt(input: string, stack: PrdStackInput = {}): string {
  const filled = PRD_STACK_FIELDS.map((f) => ({ f, v: stack[f]?.trim() })).filter((x) => x.v);
  const stackSection = filled.length
    ? `\n## Stack Teknologi (wajib dipertimbangkan secara ketat)\n${filled
      .map((x) => `- ${capitalize(x.f)}: ${x.v}`)
      .join("\n")}\nPastikan PRD memasukkan rancangan folder, library, API, dan arsitektur yang sangat spesifik dan relevan dengan stack teknologi di atas.`
    : "";
  return `Ide / persyaratan produk berikut:\n\n"""\n${input}\n"""\n\nBuatkan PRD markdown terstruktur sesuai format yang ditentukan.${stackSection}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const TASK_BREAKDOWN_SYSTEM_PROMPT = `Kamu adalah seorang Engineering Manager senior. Tugasmu memecah sebuah PRD menjadi task-task implementasi yang kecil, jelas, dan bisa dikerjakan.

Setiap task harus punya:
- title: judul singkat (Bahasa Indonesia)
- description: penjelasan detail apa yang dikerjakan (Bahasa Indonesia)
- acceptanceCriteria: kriteria penerimaan konkret (Bahasa Indonesia)

FORMAT OUTPUT (WAJIB, TANPA PENGECUALIAN):
Balas dengan SATU objek JSON valid, tanpa teks lain, tanpa markdown code fence. Bentuk:
{"tasks": [{"title": "...", "description": "...", "acceptanceCriteria": "..."}]}
- Usahakan 5-10 task yang jelas dan independen.
- Setiap kriteria penerimaan harus bisa diverifikasi (testable).`;

export function buildTaskBreakdownUserPrompt(prdContent: string): string {
  return `PRD berikut:\n\n"""\n${prdContent}\n"""\n\nPecah menjadi task-task kecil sesuai format JSON yang ditentukan. Pastikan task mencakup implementasi Frontend, Backend, dan Database sesuai spesifikasi di PRD.`;
}