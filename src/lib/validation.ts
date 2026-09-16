import { z } from "zod";

import { isValidCamelot, normalizeCamelot } from "./camelot";

const emptyToNull = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
};

const optionalString = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());

const optionalInt = (min: number, max: number) =>
  z.preprocess((value) => {
    const cleaned = emptyToNull(value);
    if (cleaned === null || cleaned === undefined) return cleaned;
    if (typeof cleaned === "string") return Number(cleaned);
    return cleaned;
  }, z.number().int().min(min).max(max).nullable().optional());

export const trackCreateSchema = z.object({
  title: z.string().trim().min(1, "タイトルは必須です").max(200),
  artist: z.string().trim().min(1, "アーティストは必須です").max(200),
  bpm: z.coerce
    .number()
    .min(40, "BPM は 40 以上で入力してください")
    .max(300, "BPM は 300 以下で入力してください"),
  camelot: z
    .string()
    .trim()
    .refine(isValidCamelot, "Camelot キーは 1A〜12B の形式で入力してください")
    .transform((value) => normalizeCamelot(value)!),
  musicalKey: optionalString(20),
  genre: optionalString(60),
  energy: z.coerce.number().int().min(1).max(10).default(5),
  durationSec: optionalInt(1, 60 * 60 * 3),
  releaseYear: optionalInt(1900, 2200),
  label: optionalString(120),
  notes: optionalString(2000),
});

export const trackUpdateSchema = trackCreateSchema.partial();

export type TrackCreateInput = z.infer<typeof trackCreateSchema>;
export type TrackUpdateInput = z.infer<typeof trackUpdateSchema>;

/* ------------------------------------------------------------------ */
/* クエリパラメータ（すべて string | undefined で来る前提）             */
/* ------------------------------------------------------------------ */

const isBlank = (value: unknown) => value === undefined || value === null || value === "";

const numParam = (fallback: number, min: number, max: number) =>
  z.preprocess(
    (value) => (isBlank(value) ? fallback : Number(value)),
    z.number().min(min).max(max),
  );

const intParam = (fallback: number, min: number, max: number) =>
  z.preprocess(
    (value) => (isBlank(value) ? fallback : Number(value)),
    z.number().int().min(min).max(max),
  );

const boolParam = (fallback: boolean) =>
  z.preprocess((value) => {
    if (isBlank(value)) return fallback;
    if (typeof value === "string") return value === "true" || value === "1";
    return Boolean(value);
  }, z.boolean());

const optionalWeight = z.preprocess(
  (value) => (isBlank(value) ? undefined : Number(value)),
  z.number().min(0).max(1).optional(),
);

export const recommendQuerySchema = z.object({
  limit: intParam(10, 1, 50),
  maxPitchPercent: numParam(8, 0.5, 30),
  allowHalfDouble: boolParam(true),
  keyCompatibleOnly: boolParam(false),
  minScore: numParam(30, 0, 100),
  genre: z.preprocess(
    (value) => (isBlank(value) ? null : String(value).trim()),
    z.string().min(1).nullable(),
  ),
  excludeIds: z.preprocess(
    (value) =>
      isBlank(value)
        ? []
        : String(value)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
    z.array(z.string()),
  ),
  weightBpm: optionalWeight,
  weightKey: optionalWeight,
  weightEnergy: optionalWeight,
});

export type RecommendQuery = z.infer<typeof recommendQuerySchema>;

/** zod のエラーを API レスポンス用に整形する */
export function formatZodError(error: z.ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}
