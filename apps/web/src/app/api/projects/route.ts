import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { inspectSkfProjectPackage, SKF_LIMITS, SKF_MEDIA_TYPE } from "@/lib/skfProject";

// Server copy of every project, so the same projects show up in any browser.
// Each project is two files in the library folder: <id>.skf (the project
// itself) and <id>.json (its dashboard card: name, revision, and so on).
// A deleted project keeps a small <id>.json marked deleted, so a browser that
// still holds a local copy removes it instead of uploading it again.

export const runtime = "nodejs";
export const revalidate = false;

const PROJECTS_DIR_ENV = "SKETCHFORGE_PROJECTS_DIR";
const SHARED_PROJECTS_ENV = "SKETCHFORGE_SHARED_PROJECTS_DIR";
const META_MAX_BYTES = 256 * 1024;
const PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

type LibraryEntry = {
  id: string;
  revision: number;
  deleted?: boolean;
  deletedAt?: number;
  [key: string]: unknown;
};

function libraryDirectory() {
  const configured = process.env[PROJECTS_DIR_ENV]?.trim();
  if (configured) return path.resolve(configured);
  // Default: a "library" folder inside the shared projects folder, which the
  // Docker image already maps to a persistent volume.
  const shared = process.env[SHARED_PROJECTS_ENV]?.trim();
  return shared ? path.join(path.resolve(shared), "library") : null;
}

function validProjectId(value: string | null): value is string {
  return Boolean(value && PROJECT_ID_PATTERN.test(value));
}

function sameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const host = forwardedHost || request.headers.get("host") || requestUrl.host;
    const protocol = forwardedProtocol || requestUrl.protocol.replace(/:$/, "");
    return new URL(origin).origin === `${protocol}://${host}`;
  } catch {
    return false;
  }
}

async function readEntry(root: string, id: string): Promise<LibraryEntry | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(path.join(root, `${id}.json`), "utf8")) as LibraryEntry;
    if (parsed?.id !== id || typeof parsed.revision !== "number") return null;
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function writeFileAtomic(root: string, fileName: string, data: Uint8Array | string) {
  const temporaryPath = path.join(root, `.${fileName}.${randomUUID()}.tmp`);
  try {
    const handle = await fs.open(temporaryPath, "wx");
    try {
      await handle.writeFile(data);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temporaryPath, path.join(root, fileName));
  } catch (error) {
    await fs.unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const root = libraryDirectory();
  if (!root) return NextResponse.json({ enabled: false, projects: [] }, { headers: noStore });
  try {
    await fs.mkdir(root, { recursive: true });
    const id = new URL(request.url).searchParams.get("id");
    if (id !== null) {
      if (!validProjectId(id)) return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
      const entry = await readEntry(root, id);
      if (!entry || entry.deleted) return NextResponse.json({ error: "Project was not found on the server" }, { status: 404 });
      const bytes = await fs.readFile(path.join(root, `${id}.skf`));
      return new Response(bytes, {
        headers: { ...noStore, "Content-Length": String(bytes.byteLength), "Content-Type": SKF_MEDIA_TYPE },
      });
    }

    const names = (await fs.readdir(root)).filter((name) => name.endsWith(".json") && !name.startsWith("."));
    const entries = await Promise.all(names.map((name) => readEntry(root, name.slice(0, -".json".length))));
    return NextResponse.json(
      { enabled: true, projects: entries.filter((entry): entry is LibraryEntry => Boolean(entry)) },
      { headers: noStore },
    );
  } catch (error) {
    return NextResponse.json(
      { enabled: true, projects: [], error: error instanceof Error ? error.message : "Could not read projects on the server" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const root = libraryDirectory();
  if (!root) return NextResponse.json({ error: "Server project storage is disabled" }, { status: 404 });
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Projects only accept same-origin saves" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!validProjectId(id)) return NextResponse.json({ error: "Invalid project id" }, { status: 400 });

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > SKF_LIMITS.archiveBytes + META_MAX_BYTES) {
    return NextResponse.json({ error: "Project is too large to save on the server" }, { status: 413 });
  }

  try {
    const form = await request.formData();
    const metaText = form.get("meta");
    const file = form.get("file");
    if (typeof metaText !== "string" || metaText.length > META_MAX_BYTES || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Project upload is missing its details or file" }, { status: 400 });
    }
    const meta = JSON.parse(metaText) as LibraryEntry;
    if (!meta || typeof meta !== "object" || meta.id !== id || typeof meta.revision !== "number" || !Number.isFinite(meta.revision)) {
      return NextResponse.json({ error: "Project details do not match the upload" }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > SKF_LIMITS.archiveBytes) return NextResponse.json({ error: "Project is too large to save on the server" }, { status: 413 });
    await inspectSkfProjectPackage(bytes);

    await fs.mkdir(root, { recursive: true });
    const current = await readEntry(root, id);
    if (current?.deleted) {
      return NextResponse.json({ error: "This project was deleted from another browser", deleted: true }, { status: 410 });
    }
    if (current && current.revision > meta.revision) {
      return NextResponse.json({ error: "The server has a newer copy of this project", project: current }, { status: 409 });
    }

    // Project file first, then its card, so a listed card always has its file.
    await writeFileAtomic(root, `${id}.skf`, bytes);
    const { deleted: _deleted, deletedAt: _deletedAt, ...entry } = meta;
    await writeFileAtomic(root, `${id}.json`, JSON.stringify(entry));
    return NextResponse.json({ project: entry }, { status: current ? 200 : 201, headers: noStore });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save project on the server" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const root = libraryDirectory();
  if (!root) return NextResponse.json({ error: "Server project storage is disabled" }, { status: 404 });
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Projects only accept same-origin deletes" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!validProjectId(id)) return NextResponse.json({ error: "Invalid project id" }, { status: 400 });

  try {
    await fs.mkdir(root, { recursive: true });
    const current = await readEntry(root, id);
    const tombstone: LibraryEntry = { id, revision: current?.revision ?? 0, deleted: true, deletedAt: Date.now() };
    await writeFileAtomic(root, `${id}.json`, JSON.stringify(tombstone));
    await fs.unlink(path.join(root, `${id}.skf`)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
    return NextResponse.json({ deleted: true, id }, { headers: noStore });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete project on the server" }, { status: 500 });
  }
}
