import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Storage abstraction (NFR-1). Local disk today; an S3/R2 implementation can
 * replace it later without changing any caller.
 */
export interface FileStore {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

const UPLOAD_ROOT = path.join(process.cwd(), ".uploads");

function safePath(key: string): string {
  // Prevent path traversal; keys are app-generated but be defensive.
  const normalized = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
  return path.join(UPLOAD_ROOT, normalized);
}

class LocalDiskStore implements FileStore {
  async put(key: string, data: Buffer): Promise<void> {
    const dest = safePath(key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, data);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(safePath(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(safePath(key), { force: true });
  }
}

// Single shared instance. Swap here when S3 credentials are configured.
export const fileStore: FileStore = new LocalDiskStore();
