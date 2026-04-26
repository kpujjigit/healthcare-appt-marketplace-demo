// Synthetic data generators. Centralized here so every route uses the same
// canonical attribute values and dashboard widgets get consistent groupings.
//
// Buckets are documented next to each generator so the boundaries stay stable
// across runs. Inconsistent buckets across runs make trend dashboards lie.

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function uuid(): string {
  // Node 18+ has crypto.randomUUID via global.
  return (globalThis.crypto?.randomUUID?.() ?? fallbackUuid());
}

function fallbackUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---- Specialty + geo + insurance ----

export const SPECIALTY_TYPES = [
  "primary_care",
  "dermatology",
  "dental",
  "cardiology",
  "psychiatry",
  "obgyn",
  "ortho",
  "pediatrics",
  "eye_care",
  "urgent_care",
  "physical_therapy",
  "other",
] as const;

export const INSURANCE_CARRIERS = [
  "aetna",
  "anthem",
  "bcbs",
  "cigna",
  "humana",
  "kaiser",
  "uhc",
  "medicare",
  "other",
] as const;

export const PLAN_TYPES = ["hmo", "ppo", "epo", "pos", "medicare_advantage"] as const;

export const GEO_MARKETS = ["nyc", "la", "chi", "bos", "sf", "other"] as const;

export const APPOINTMENT_TYPES = ["in_person", "telehealth", "urgent_care", "follow_up"] as const;

export const PROVIDER_INTEGRATION_TYPES = ["epic", "athena", "eclinicalworks", "cerner", "native"] as const;

export const CLIENT_PLATFORMS = ["web", "ios", "android", "mobile_web"] as const;

export const FORM_STEPS = ["demographics", "insurance_card", "id_upload", "medical_history", "consent"] as const;

// ---- Bucket helpers (boundaries are load-bearing — keep stable) ----

export function bucketResultCount(n: number): string {
  if (n === 0) return "0";
  if (n <= 5) return "1-5";
  if (n <= 20) return "6-20";
  if (n <= 50) return "21-50";
  return "50+";
}

export function bucketLatencyMs(ms: number): string {
  // Generic latency buckets — individual spans can override per the guide,
  // but most use this default. See span-attribute-guide.md for per-span
  // boundary overrides.
  if (ms < 200) return "0-200";
  if (ms < 500) return "200-500";
  if (ms < 1000) return "500-1000";
  if (ms < 3000) return "1000-3000";
  return "3000+";
}

export function bucketLatencyVerify(ms: number): string {
  if (ms < 200) return "0-200";
  if (ms < 500) return "200-500";
  if (ms < 1500) return "500-1500";
  if (ms < 5000) return "1500-5000";
  return "5000+";
}

export function bucketLatencyBook(ms: number): string {
  if (ms < 500) return "0-500";
  if (ms < 1500) return "500-1500";
  if (ms < 5000) return "1500-5000";
  if (ms < 15000) return "5000-15000";
  return "15000+";
}

export function bucketLatencyIntake(ms: number): string {
  if (ms < 500) return "0-500";
  if (ms < 2000) return "500-2000";
  if (ms < 10000) return "2000-10000";
  if (ms < 30000) return "10000-30000";
  return "30000+";
}

export function bucketLeadTimeHours(h: number): string {
  if (h < 24) return "0-24h";
  if (h < 24 * 3) return "1-3d";
  if (h < 24 * 7) return "3-7d";
  if (h < 24 * 30) return "7-30d";
  return "30d+";
}

export function bucketUploadBytes(b: number): string {
  if (b < 100_000) return "0-100KB";
  if (b < 1_000_000) return "100KB-1MB";
  if (b < 5_000_000) return "1MB-5MB";
  return "5MB+";
}

// ---- Random sample helpers ----

export function randomLeadTimeHours(): number {
  // Skew toward shorter lead times — healthcare marketplaces typically see
  // a meaningful share of bookings within 48h of the search.
  const r = Math.random();
  if (r < 0.35) return Math.random() * 48; // 0-48h
  if (r < 0.6) return 48 + Math.random() * 120; // 2-7d
  return 168 + Math.random() * (24 * 60); // 7-30d
}

export function randomUploadBytes(): number {
  // Bias toward 1-5MB (typical insurance card photo + ID).
  const r = Math.random();
  if (r < 0.05) return Math.floor(Math.random() * 100_000);
  if (r < 0.4) return 100_000 + Math.floor(Math.random() * 900_000);
  if (r < 0.9) return 1_000_000 + Math.floor(Math.random() * 4_000_000);
  return 5_000_000 + Math.floor(Math.random() * 5_000_000);
}
