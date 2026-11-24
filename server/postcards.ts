import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { storageGetSignedUrl, storagePut, storagePutExact } from "./storage";
import { publicProcedure, router } from "./_core/trpc";

const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_MEDIA_BYTES = 20 * 1024 * 1024;
const OWNER_COOKIE = "__Host-epostcard-owner";
const MANIFEST_LIMIT = 1000;

const mediaSchema = z.string().max(12_000_000).optional();
const flowButtonSchema = z.object({
  id: z.string().max(100),
  label: z.string().max(100),
  action: z.enum(["next", "go_to_step", "open_envelope", "open_postcard", "run_away", "stay"]),
  targetStepId: z.string().max(100).optional(),
});
const flowStepSchema = z.object({
  id: z.string().max(100),
  kind: z.enum(["intro", "tease", "question", "yes", "memory", "custom"]),
  label: z.string().max(200),
  eyebrow: z.string().max(200),
  title: z.string().max(2_000),
  body: z.string().max(4_000),
  emoji: z.string().max(200),
  buttons: z.array(flowButtonSchema).min(1).max(8).optional(),
  image: mediaSchema,
  gif: mediaSchema,
});
const cardSchema = z.object({
  to: z.string().max(200),
  from: z.string().max(200),
  message: z.string().max(2_000),
  occasion: z.string().max(200),
  theme: z.string().max(50),
  envelopeButtonLabel: z.string().max(100).optional(),
  photo: mediaSchema,
  flow: z.array(flowStepSchema).max(30),
});
const cardKeySchema = z.string().max(220).regex(/^postcards\/[0-9a-f]{64}\/[0-9a-f-]{36}\/card_[0-9a-f]{8}\.json$/i);
const manifestEntrySchema = z.object({
  id: z.string().uuid(),
  key: cardKeySchema,
  name: z.string().max(120),
  to: z.string().max(200),
  occasion: z.string().max(200),
  theme: z.string().max(50),
  updatedAt: z.string().max(40),
});
const manifestSchema = z.object({ version: z.literal(1), postcards: z.array(manifestEntrySchema).max(MANIFEST_LIMIT) });
type Manifest = z.infer<typeof manifestSchema>;

const manifestLocks = new Map<string, Promise<void>>();

function getOwnerId(ctx: { req: { headers: { cookie?: string } }; res: { cookie: (name: string, value: string, options: object) => unknown } }) {
  const rawCookie = ctx.req.headers.cookie ?? "";
  const existing = rawCookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${OWNER_COOKIE}=`))?.slice(OWNER_COOKIE.length + 1);
  if (existing && /^[0-9a-f]{64}$/i.test(existing)) return existing.toLowerCase();
  const ownerId = randomBytes(32).toString("hex");
  ctx.res.cookie(OWNER_COOKIE, ownerId, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 365 * 24 * 60 * 60 * 1000,
  });
  return ownerId;
}

function manifestKey(ownerId: string) {
  return `postcards/${ownerId}/index.json`;
}

async function readManifest(ownerId: string): Promise<Manifest> {
  const signedUrl = await storageGetSignedUrl(manifestKey(ownerId));
  const response = await fetch(signedUrl);
  // This object store returns 403 for a missing key when bucket listing is disabled.
  if (response.status === 403 || response.status === 404) return { version: 1, postcards: [] };
  if (!response.ok) throw new Error(`Cloud manifest load failed (${response.status})`);
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > 1_000_000) throw new Error("Cloud manifest is too large");
  return manifestSchema.parse(await response.json());
}

async function withManifestLock<T>(ownerId: string, action: () => Promise<T>): Promise<T> {
  const previous = manifestLocks.get(ownerId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  manifestLocks.set(ownerId, current);
  await previous;
  try {
    return await action();
  } finally {
    release();
    if (manifestLocks.get(ownerId) === current) manifestLocks.delete(ownerId);
  }
}

async function writeManifest(ownerId: string, manifest: Manifest) {
  await storagePutExact(manifestKey(ownerId), JSON.stringify(manifest), "application/json; charset=utf-8");
}

function parseDataUrl(value: string) {
  const match = /^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Only JPEG, PNG, GIF, and WebP image uploads are supported." });
  }
  const mimeType = match[1];
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_MEDIA_BYTES) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Each image or GIF must be 8 MB or smaller." });
  }
  const isValidSignature =
    (mimeType === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (mimeType === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (mimeType === "image/gif" && ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))) ||
    (mimeType === "image/webp" && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP");
  if (!isValidSignature) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "The uploaded file does not match its image type." });
  }
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
  return { mimeType, extension, bytes };
}

function validateExistingMediaUrl(value: string) {
  if (!value || value.startsWith("/manus-storage/")) return value;
  if (/^https?:\/\//i.test(value)) return value;
  throw new TRPCError({ code: "BAD_REQUEST", message: "Image fields must be an uploaded image or an HTTP(S) URL." });
}

async function storeMedia(value: string | undefined, folder: string, label: string, total: { bytes: number }) {
  if (!value) return value;
  if (!value.startsWith("data:")) return validateExistingMediaUrl(value);
  const { mimeType, extension, bytes } = parseDataUrl(value);
  total.bytes += bytes.length;
  if (total.bytes > MAX_TOTAL_MEDIA_BYTES) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "The total image/GIF upload size must be 20 MB or less." });
  }
  const uploaded = await storagePut(`${folder}/${label}.${extension}`, bytes, mimeType);
  return uploaded.url;
}

export const postcardsRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const ownerId = getOwnerId(ctx);
    try {
      return await readManifest(ownerId);
    } catch (error) {
      console.error("[Postcards] List failed:", error);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The cloud postcard list could not be loaded." });
    }
  }),
  save: publicProcedure
    .input(z.object({ postcardId: z.string().uuid(), name: z.string().trim().min(1).max(120), card: cardSchema }))
    .mutation(async ({ input, ctx }) => {
      const ownerId = getOwnerId(ctx);
      const folder = `postcards/${ownerId}/${input.postcardId}`;
      const total = { bytes: 0 };
      const card = {
        ...input.card,
        photo: await storeMedia(input.card.photo, folder, "photo", total),
        flow: await Promise.all(input.card.flow.map(async (step, index) => ({
          ...step,
          image: await storeMedia(step.image, folder, `flow-${index}-image`, total),
          gif: await storeMedia(step.gif, folder, `flow-${index}-gif`, total),
        }))),
      };
      const storedCard = await storagePut(`${folder}/card.json`, JSON.stringify(card), "application/json; charset=utf-8");
      const item = {
        id: input.postcardId,
        key: storedCard.key,
        name: input.name,
        to: card.to,
        occasion: card.occasion,
        theme: card.theme,
        updatedAt: new Date().toISOString(),
      };
      await withManifestLock(ownerId, async () => {
        const manifest = await readManifest(ownerId);
        const postcards = [item, ...manifest.postcards.filter((entry) => entry.id !== item.id)].slice(0, MANIFEST_LIMIT);
        await writeManifest(ownerId, { version: 1, postcards });
      });
      return { key: storedCard.key, card, item };
    }),
  remove: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const ownerId = getOwnerId(ctx);
      try {
        await withManifestLock(ownerId, async () => {
          const manifest = await readManifest(ownerId);
          await writeManifest(ownerId, { version: 1, postcards: manifest.postcards.filter((entry) => entry.id !== input.id) });
        });
        return { success: true as const };
      } catch (error) {
        console.error("[Postcards] Remove failed:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The postcard could not be removed from the cloud list." });
      }
    }),
  load: publicProcedure
    .input(z.object({ key: cardKeySchema }))
    .query(async ({ input }) => {
      try {
        const signedUrl = await storageGetSignedUrl(input.key);
        const response = await fetch(signedUrl);
        if (!response.ok) throw new Error(`Storage returned HTTP ${response.status}`);
        const contentLength = Number(response.headers.get("content-length") ?? "0");
        if (contentLength > 2_000_000) throw new Error("Stored postcard data is too large");
        return { card: cardSchema.parse(await response.json()) };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[Postcards] Load failed:", error);
        throw new TRPCError({ code: "NOT_FOUND", message: "This postcard link is invalid or the stored postcard could not be loaded." });
      }
    }),
});
