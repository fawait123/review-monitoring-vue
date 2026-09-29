import type { DiffFile, DiffHunk, DiffLine, DiffLineKind } from "./types";

/**
 * Parse unified diff (output `gh pr diff`) menjadi per-file hunks + line maps.
 * Line = nomor baris file BARU (new side) untuk komentar GitHub.
 */
export function parseDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = [];
  let current: DiffFile | null = null;
  let hunk: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const raw of diff.split("\n")) {
    if (raw.startsWith("diff --git ")) {
      if (current) files.push(current);
      const m = raw.match(/diff --git a\/(.*?) b\/(.*?)$/);
      const path = m?.[2] ?? raw.slice(11).trim();
      current = { path, hunks: [], header: [raw] };
      hunk = null;
      continue;
    }
    if (!current) continue;
    // Penanda "tidak ada newline di akhir" bukan baris kode. Kalau dibiarkan, ia
    // dihitung sebagai context dan menggeser newLine/oldLine semua baris berikutnya.
    if (raw.startsWith("\\ No newline at end of file")) continue;
    if (raw.startsWith("@@")) {
      const m = raw.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (m) {
        hunk = {
          oldStart: Number(m[1]),
          oldLines: m[2] ? Number(m[2]) : 1,
          newStart: Number(m[3]),
          newLines: m[4] ? Number(m[4]) : 1,
          lines: [],
        };
        oldLine = hunk.oldStart;
        newLine = hunk.newStart;
        current.hunks.push(hunk);
      }
      continue;
    }
    if (!hunk) {
      // Blok sebelum hunk pertama: index, ---/+++, mode, rename. Simpan apa adanya
      // supaya diff hasil re-serialize tetap menyebut nama file yang sama.
      if (raw.trim() !== "") current.header!.push(raw);
      continue;
    }

    let kind: DiffLineKind;
    const content = raw.slice(1);
    let old: number | null = null;
    let new_: number | null = null;
    if (raw.startsWith("+")) {
      kind = "add";
      new_ = newLine++;
    } else if (raw.startsWith("-")) {
      kind = "del";
      old = oldLine++;
    } else {
      kind = "context";
      old = oldLine++;
      new_ = newLine++;
    }
    hunk.lines.push({ kind, oldLine: old, newLine: new_, content });
  }
  if (current) files.push(current);
  return files;
}

/** Kumpulan new-line numbers yang ada dalam diff (hanya add/context) per file. */
export function hunkLineRanges(files: DiffFile[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const f of files) {
    const lines: number[] = [];
    for (const h of f.hunks) {
      for (const l of h.lines) {
        if (l.newLine !== null && l.kind !== "del") lines.push(l.newLine);
      }
    }
    map.set(f.path, lines.sort((a, b) => a - b));
  }
  return map;
}

/** Clamp `line` ke baris terdekat dalam `lines` (harus terurut menaik).
 *  Return null bila di luar rentang — memaksa menempelkan baris yang jauh ke
 *  baris terdekatnya memunculkan komentar di lokasi yang salah. */
export function clampToRange(lines: number[], line: number): number | null {
  if (lines.length === 0) return null;
  const min = lines[0]!;
  const max = lines[lines.length - 1]!;
  if (line < min || line > max) return null;
  let best = min;
  let bestDist = Infinity;
  for (const l of lines) {
    const d = Math.abs(l - line);
    if (d < bestDist) {
      bestDist = d;
      best = l;
    }
  }
  return best;
}

/** Clamp line ke nearest diff line (add/context) di file tsb. Return null jika file tak ada. */
export function clampToHunkLine(files: DiffFile[], path: string, line: number): number | null {
  const ranges = hunkLineRanges(files);
  return clampToRange(ranges.get(path) ?? [], line);
}

/** Bangun ulang diff unified yang valid dari subset hunk.
 *  `maxLineChars` memotong isi baris yang sendirian melebihi budget — satu baris
 *  tidak bisa dipecah per baris, jadi tanpa ini file minified/JSON besar akan
 *  mengirim blob utuh dan menggagalkan tujuan chunking. Nomor baris tetap utuh. */
export function serializeHunks(file: DiffFile, hunks: DiffHunk[], maxLineChars = 0): string {
  const out: string[] = file.header && file.header.length > 0
    ? [...file.header]
    : [`diff --git a/${file.path} b/${file.path}`, `--- a/${file.path}`, `+++ b/${file.path}`];
  for (const h of hunks) {
    out.push(`@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`);
    for (const l of h.lines) {
      const prefix = l.kind === "add" ? "+" : l.kind === "del" ? "-" : " ";
      const c = maxLineChars > 0 && l.content.length > maxLineChars
        ? `${l.content.slice(0, maxLineChars)} ...[isi baris dipotong, total ${l.content.length} karakter]`
        : l.content;
      out.push(prefix + c);
    }
  }
  return out.join("\n");
}

/** Anggaran karakter per potongan diff (±2-3k token). Di bawah ini review tetap
 *  satu panggilan; di atas itu file dipecah per hunk supaya model tidak menebak
 *  nomor baris di tengah konteks raksasa. Naikkan kalau masih kurang teliti,
 *  turunkan kalau review jadi terlalu lambat. */
export const CHUNK_MAX_CHARS = 8000;

export interface DiffChunk {
  hunks: DiffHunk[];
  /** Nomor baris new-side milik potongan ini — dasar clamp yang ter-scope. */
  newLines: number[];
  label: string;
  chars: number;
  /** Budget yang dipakai untuk bagian ini; diteruskan ke serializeHunks. */
  budget: number;
}

function hunkChars(h: DiffHunk): number {
  let n = h.oldStart.toString().length + h.oldLines.toString().length +
    h.newStart.toString().length + h.newLines.toString().length + 8;
  for (const l of h.lines) n += l.content.length + 1;
  return n;
}

/** Sub-hunk dari satu hunk raksasa. Nomor @@ dihitung ulang dari baris yang
 *  benar-benar ada di subset, jadi diff hasil serialize tetap konsisten. */
function splitHunk(h: DiffHunk, budget: number): DiffHunk[] {
  const out: DiffHunk[] = [];
  let batch: DiffLine[] = [];
  let chars = 0;

  const flush = () => {
    if (batch.length === 0) return;
    const olds = batch.filter((l) => l.oldLine !== null);
    const news = batch.filter((l) => l.newLine !== null);
    out.push({
      oldStart: olds[0]?.oldLine ?? 0,
      oldLines: olds.length,
      newStart: news[0]?.newLine ?? 0,
      newLines: news.length,
      lines: batch,
    });
    batch = [];
    chars = 0;
  };

  for (const l of h.lines) {
    const c = l.content.length + 1;
    if (batch.length > 0 && chars + c > budget) flush();
    batch.push(l);
    chars += c;
  }
  flush();
  return out;
}

function makeChunk(file: DiffFile, hunks: DiffHunk[], budget: number): DiffChunk {
  const newLines: number[] = [];
  let chars = 0;
  for (const h of hunks) {
    chars += hunkChars(h);
    for (const l of h.lines) {
      if (l.newLine !== null && l.kind !== "del") newLines.push(l.newLine);
    }
  }
  newLines.sort((a, b) => a - b);
  const label = newLines.length > 0
    ? (newLines[0] === newLines[newLines.length - 1]
      ? `baris ${newLines[0]}`
      : `baris ${newLines[0]}-${newLines[newLines.length - 1]}`)
    : "hanya baris hapus";
  return { hunks, newLines, label, chars, budget };
}

/** Pecah satu file menjadi potongan diff yang bisa direview terpisah. */
export function chunkFileDiff(file: DiffFile, maxChars: number = CHUNK_MAX_CHARS): DiffChunk[] {
  const headerChars = file.header ? file.header.join("\n").length + 1 : 0;
  const budget = Math.max(500, maxChars - headerChars);
  const chunks: DiffChunk[] = [];
  let batch: DiffHunk[] = [];
  let chars = 0;

  const flush = () => {
    if (batch.length > 0) chunks.push(makeChunk(file, batch, budget));
    batch = [];
    chars = 0;
  };

  for (const h of file.hunks) {
    const hc = hunkChars(h);
    if (hc > budget) {
      // Hunk tunggal melebihi budget: pecah per baris.
      flush();
      for (const sub of splitHunk(h, budget)) {
        batch.push(sub);
        chars += hunkChars(sub);
        if (chars >= budget) flush();
      }
      continue;
    }
    if (chars + hc > budget) flush();
    batch.push(h);
    chars += hc;
  }
  flush();
  return chunks.length > 0 ? chunks : [makeChunk(file, [], budget)];
}
