import "server-only";
import { GridFSBucket } from "mongodb";
import { Readable } from "node:stream";
import { getMongoDatabase } from "../db/mongodb.mjs";

function validateKey(key: string) {
  if (!/^jaguar\/[a-f0-9-]{36}$/.test(key)) throw new Error("Invalid private storage key");
}
export const mongoBucket = {
  async put(key: string, bytes: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }) {
    validateKey(key);
    const bucket = new GridFSBucket(await getMongoDatabase(), { bucketName: "uploads" });
    const upload = bucket.openUploadStream(key, { metadata: { contentType: options?.httpMetadata?.contentType || "application/octet-stream" } });
    await new Promise<void>((resolve, reject) => { upload.once("finish", resolve); upload.once("error", reject); upload.end(Buffer.from(bytes)); });
  },
  async get(key: string) {
    validateKey(key);
    const bucket = new GridFSBucket(await getMongoDatabase(), { bucketName: "uploads" });
    const file = await bucket.find({ filename: key }).next();
    if (!file) return null;
    return { body: Readable.toWeb(bucket.openDownloadStream(file._id)) as ReadableStream<Uint8Array> };
  },
  async delete(key: string) {
    validateKey(key);
    const bucket = new GridFSBucket(await getMongoDatabase(), { bucketName: "uploads" });
    const file = await bucket.find({ filename: key }).next();
    if (file) await bucket.delete(file._id);
  },
};
