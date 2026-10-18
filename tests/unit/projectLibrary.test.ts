import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DELETE, GET, POST } from "@/app/api/projects/route";
import { planProjectLibrarySync } from "@/lib/projectLibrarySync";
import { exportSkfProject } from "@/lib/skfProject";
import { DEFAULT_SNAP_GRID, DEFAULT_WORKPLANE_WORKSPACE } from "@/lib/workplaneSettings";

const SHARED_PROJECTS_ENV = "SKETCHFORGE_SHARED_PROJECTS_DIR";
const BASE = "http://localhost/api/projects";

let sharedRoot = "";
let previousSharedRoot: string | undefined;

async function skfBytes(name = "Test project") {
  return exportSkfProject({
    projectId: "project-a",
    projectName: name,
    createdAt: 1_700_000_000_000,
    modifiedAt: 1_700_000_000_000,
    shapes: [],
    history: [],
    historyIndex: 0,
    assets: [],
    workspace: DEFAULT_WORKPLANE_WORKSPACE,
    snapGrid: DEFAULT_SNAP_GRID,
    placementElevation: 0,
  });
}

async function upload(id: string, meta: Record<string, unknown>, origin = "http://localhost") {
  const bytes = await skfBytes();
  const form = new FormData();
  form.set("meta", JSON.stringify({ id, ...meta }));
  form.set("file", new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer]), `${id}.skf`);
  return POST(new Request(`${BASE}?id=${id}`, { method: "POST", body: form, headers: { Origin: origin } }));
}

async function list() {
  const payload = await (await GET(new Request(BASE))).json() as { enabled: boolean; projects: Array<Record<string, unknown>> };
  return payload;
}

describe("server project library route", () => {
  beforeEach(async () => {
    previousSharedRoot = process.env[SHARED_PROJECTS_ENV];
    sharedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sketchforge-library-"));
    process.env[SHARED_PROJECTS_ENV] = sharedRoot;
  });

  afterEach(async () => {
    if (previousSharedRoot === undefined) delete process.env[SHARED_PROJECTS_ENV];
    else process.env[SHARED_PROJECTS_ENV] = previousSharedRoot;
    await fs.rm(sharedRoot, { recursive: true, force: true });
  });

  it("is off when no storage folder is configured", async () => {
    delete process.env[SHARED_PROJECTS_ENV];
    expect(await list()).toEqual({ enabled: false, projects: [] });
  });

  it("saves a project into the library folder and lists and serves it", async () => {
    const response = await upload("project-a", { name: "Bracket", revision: 100 });
    expect(response.status).toBe(201);
    await expect(fs.access(path.join(sharedRoot, "library", "project-a.skf"))).resolves.toBeUndefined();

    const payload = await list();
    expect(payload.enabled).toBe(true);
    expect(payload.projects).toEqual([{ id: "project-a", name: "Bracket", revision: 100 }]);

    const file = await GET(new Request(`${BASE}?id=project-a`));
    expect(file.status).toBe(200);
    const served = new Uint8Array(await file.arrayBuffer());
    const stored = new Uint8Array(await fs.readFile(path.join(sharedRoot, "library", "project-a.skf")));
    expect(served).toEqual(stored);
  });

  it("does not show library projects in the shared projects folder listing", async () => {
    await upload("project-a", { name: "Bracket", revision: 100 });
    const top = await fs.readdir(sharedRoot);
    expect(top).toEqual(["library"]);
  });

  it("refuses an older copy over a newer one, and accepts the same or newer revision", async () => {
    await upload("project-a", { name: "Bracket", revision: 200 });
    expect((await upload("project-a", { name: "Old", revision: 150 })).status).toBe(409);
    expect((await upload("project-a", { name: "Same rev", revision: 200 })).status).toBe(200);
    expect((await upload("project-a", { name: "Newer", revision: 300 })).status).toBe(200);
    expect((await list()).projects).toEqual([{ id: "project-a", name: "Newer", revision: 300 }]);
  });

  it("marks a deleted project and will not take it back", async () => {
    await upload("project-a", { name: "Bracket", revision: 100 });
    const response = await DELETE(new Request(`${BASE}?id=project-a`, { method: "DELETE", headers: { Origin: "http://localhost" } }));
    expect(response.status).toBe(200);
    await expect(fs.access(path.join(sharedRoot, "library", "project-a.skf"))).rejects.toThrow();
    expect((await list()).projects).toMatchObject([{ id: "project-a", deleted: true }]);
    expect((await GET(new Request(`${BASE}?id=project-a`))).status).toBe(404);
    expect((await upload("project-a", { name: "Bracket", revision: 500 })).status).toBe(410);
  });

  it("rejects bad ids, mismatched details, non-project files, and cross-origin writes", async () => {
    expect((await GET(new Request(`${BASE}?id=../etc`))).status).toBe(400);
    expect((await upload("project-a", { id: "project-b", name: "X", revision: 1 })).status).toBe(400);
    expect((await upload("project-a", { name: "X", revision: 1 }, "https://example.invalid")).status).toBe(403);

    const form = new FormData();
    form.set("meta", JSON.stringify({ id: "project-c", name: "X", revision: 1 }));
    form.set("file", new Blob(["not a project"]), "project-c.skf");
    const response = await POST(new Request(`${BASE}?id=project-c`, { method: "POST", body: form }));
    expect(response.status).toBe(400);
    expect((await list()).projects).toEqual([]);
  });
});

describe("planProjectLibrarySync", () => {
  it("uploads local-only projects and downloads server-only ones", () => {
    const plan = planProjectLibrarySync(
      [{ id: "local", revision: 1 }],
      [{ id: "remote", revision: 1 }],
    );
    expect(plan).toEqual({ uploads: ["local"], downloads: ["remote"], localDeletes: [] });
  });

  it("moves whichever side has the higher revision", () => {
    const plan = planProjectLibrarySync(
      [{ id: "a", revision: 5 }, { id: "b", revision: 9 }, { id: "c", revision: 7 }],
      [{ id: "a", revision: 9 }, { id: "b", revision: 5 }, { id: "c", revision: 7 }],
    );
    expect(plan).toEqual({ uploads: ["b"], downloads: ["a"], localDeletes: [] });
  });

  it("at the same revision the newer picture wins, so two browsers do not overwrite each other", () => {
    const plan = planProjectLibrarySync(
      [{ id: "a", revision: 5, thumbnailVersion: 20 }, { id: "b", revision: 5, thumbnailVersion: 10 }],
      [{ id: "a", revision: 5, thumbnailVersion: 10 }, { id: "b", revision: 5, thumbnailVersion: 20 }],
    );
    expect(plan).toEqual({ uploads: ["a"], downloads: ["b"], localDeletes: [] });
  });

  it("removes local copies of projects deleted elsewhere", () => {
    const plan = planProjectLibrarySync([{ id: "a", revision: 5 }], [{ id: "a", revision: 5, deleted: true }]);
    expect(plan).toEqual({ uploads: [], downloads: [], localDeletes: ["a"] });
  });

  it("leaves the project open in the editor alone, and never revives one deleted here", () => {
    const plan = planProjectLibrarySync(
      [{ id: "open", revision: 1 }, { id: "gone-open", revision: 1 }],
      [{ id: "open", revision: 9 }, { id: "gone-open", revision: 1, deleted: true }, { id: "deleted-here", revision: 3 }],
      { busyIds: new Set(["open", "gone-open"]), pendingDeleteIds: new Set(["deleted-here"]) },
    );
    expect(plan).toEqual({ uploads: [], downloads: [], localDeletes: [] });
  });
});
