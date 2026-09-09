import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DELETE, GET, POST } from "@/app/api/project-thumbnail/route";

// The route computes this from process.cwd() at module load and offers no way
// to redirect it, so the tests write into the real (gitignored) directory and
// clean up after themselves.
const THUMBNAIL_DIR = path.join(process.cwd(), ".codex", "project-thumbnails");

// Smallest valid PNG: 1x1 transparent pixel.
const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const writtenProjectIds = new Set<string>();

function thumbnailFile(projectId: string) {
  return path.join(THUMBNAIL_DIR, `${projectId}.png`);
}

function postRequest(projectId: string, host: string, origin: string | null = `http://${host}`) {
  writtenProjectIds.add(projectId);
  const headers = new Headers({ "Content-Type": "application/json" });
  if (origin !== null) headers.set("Origin", origin);
  return new Request(`http://${host}/api/project-thumbnail`, {
    method: "POST",
    headers,
    body: JSON.stringify({ dataUrl: PNG_DATA_URL, projectId }),
  });
}

function getRequest(projectId: string, host: string, origin: string | null = `http://${host}`) {
  const headers = new Headers();
  if (origin !== null) headers.set("Origin", origin);
  return new Request(`http://${host}/api/project-thumbnail?projectId=${encodeURIComponent(projectId)}`, {
    headers,
  });
}

function deleteRequest(projectId: string, host: string, origin: string | null = `http://${host}`) {
  const headers = new Headers();
  if (origin !== null) headers.set("Origin", origin);
  return new Request(`http://${host}/api/project-thumbnail?projectId=${encodeURIComponent(projectId)}`, {
    method: "DELETE",
    headers,
  });
}

// Every host the guard must accept, and every host it must refuse. The owner
// opens the app at http://192.168.1.250:3001/, so that address is pinned by
// name rather than only by the range it belongs to.
const ACCEPTED_HOSTS = [
  ["the LAN address the app is actually opened at", "192.168.1.250"],
  ["another 192.168.0.0/16 address", "192.168.1.245"],
  ["a 10.0.0.0/8 address", "10.14.7.3"],
  ["the bottom of 172.16.0.0/12", "172.16.0.1"],
  ["the top of 172.16.0.0/12", "172.31.255.254"],
  ["localhost", "localhost"],
  ["the IPv4 loopback address", "127.0.0.1"],
] as const;

const REJECTED_HOSTS = [
  ["a 172 address just above the private block", "172.32.0.1"],
  ["a 172 address just below the private block", "172.15.255.254"],
  ["a public IP address", "93.184.216.34"],
  ["another public IP address", "8.8.8.8"],
  ["a bare hostname", "sketchforge"],
  ["a .local hostname", "tower.local"],
  ["a public domain name", "example.invalid"],
  ["a hostname that merely starts like a private range", "192.168.example.com"],
  ["a name whose leading labels look like a private IP", "192.168.1.2.example.com"],
] as const;

describe("project thumbnail origin guard", () => {
  afterEach(async () => {
    for (const projectId of writtenProjectIds) {
      await fs.rm(thumbnailFile(projectId), { force: true });
    }
    writtenProjectIds.clear();
  });

  describe("accepted hosts", () => {
    for (const [label, host] of ACCEPTED_HOSTS) {
      it(`writes, reads and deletes a thumbnail from ${label} (${host})`, async () => {
        const projectId = `accept-${host.replace(/[^a-zA-Z0-9]/g, "-")}`;

        const postResponse = await POST(postRequest(projectId, host));
        expect(postResponse.status).toBe(200);
        expect(await postResponse.json()).toEqual({ version: expect.any(Number) });
        await expect(fs.access(thumbnailFile(projectId))).resolves.toBeUndefined();

        const getResponse = await GET(getRequest(projectId, host));
        expect(getResponse.status).toBe(200);
        expect(getResponse.headers.get("content-type")).toBe("image/png");
        const bytes = Buffer.from(await getResponse.arrayBuffer());
        expect(bytes.length).toBeGreaterThan(0);
        expect(bytes.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

        const deleteResponse = await DELETE(deleteRequest(projectId, host));
        expect(deleteResponse.status).toBe(200);
        expect(await deleteResponse.json()).toEqual({ deleted: true });
        await expect(fs.access(thumbnailFile(projectId))).rejects.toThrow();
      });
    }
  });

  describe("rejected hosts", () => {
    for (const [label, host] of REJECTED_HOSTS) {
      it(`refuses all three verbs from ${label} (${host})`, async () => {
        const projectId = `reject-${host.replace(/[^a-zA-Z0-9]/g, "-")}`;

        const postResponse = await POST(postRequest(projectId, host));
        expect(postResponse.status).toBe(403);
        await expect(fs.access(thumbnailFile(projectId))).rejects.toThrow();

        expect((await GET(getRequest(projectId, host))).status).toBe(403);
        expect((await DELETE(deleteRequest(projectId, host))).status).toBe(403);
      });
    }
  });

  it("refuses a request whose URL carries no authority", async () => {
    const projectId = "reject-empty-host";
    // A truly empty http host is not constructible: WHATWG URL parsing reads
    // the first path segment as the authority, so this lands on the hostname
    // "api" — which the guard refuses anyway, being neither loopback nor a
    // private IPv4 literal.
    const emptyHostUrl = "http:///api/project-thumbnail";
    expect(new URL(emptyHostUrl).hostname).toBe("api");

    expect((await POST(new Request(emptyHostUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl: PNG_DATA_URL, projectId }),
    }))).status).toBe(403);
    await expect(fs.access(thumbnailFile(projectId))).rejects.toThrow();

    expect((await GET(new Request(`${emptyHostUrl}?projectId=${projectId}`))).status).toBe(403);
    expect((await DELETE(new Request(`${emptyHostUrl}?projectId=${projectId}`, { method: "DELETE" }))).status).toBe(403);
  });

  it("refuses a LAN request carrying a malformed Origin header", async () => {
    const projectId = "reject-malformed-origin";

    expect((await POST(postRequest(projectId, "192.168.1.250", "not a url"))).status).toBe(403);
    await expect(fs.access(thumbnailFile(projectId))).rejects.toThrow();

    expect((await GET(getRequest(projectId, "192.168.1.250", "not a url"))).status).toBe(403);
    expect((await DELETE(deleteRequest(projectId, "192.168.1.250", "not a url"))).status).toBe(403);
  });

  it("refuses a LAN request whose Origin is a public address", async () => {
    const projectId = "reject-cross-origin";

    const response = await POST(postRequest(projectId, "192.168.1.250", "http://example.invalid"));

    expect(response.status).toBe(403);
    await expect(fs.access(thumbnailFile(projectId))).rejects.toThrow();
  });

  it("still refuses a LAN Origin on a different port or protocol", async () => {
    const projectId = "reject-port-protocol";

    const wrongPort = new Request("http://192.168.1.250:3001/api/project-thumbnail", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://192.168.1.250:3002" },
      body: JSON.stringify({ dataUrl: PNG_DATA_URL, projectId }),
    });
    expect((await POST(wrongPort)).status).toBe(403);

    const wrongProtocol = new Request("http://192.168.1.250:3001/api/project-thumbnail", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://192.168.1.250:3001" },
      body: JSON.stringify({ dataUrl: PNG_DATA_URL, projectId }),
    });
    expect((await POST(wrongProtocol)).status).toBe(403);

    await expect(fs.access(thumbnailFile(projectId))).rejects.toThrow();
  });

  it("still refuses a cross-site fetch from an accepted LAN host", async () => {
    const projectId = "reject-cross-site";

    const request = new Request("http://192.168.1.250/api/project-thumbnail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://192.168.1.250",
        "Sec-Fetch-Site": "cross-site",
      },
      body: JSON.stringify({ dataUrl: PNG_DATA_URL, projectId }),
    });

    expect((await POST(request)).status).toBe(403);
    await expect(fs.access(thumbnailFile(projectId))).rejects.toThrow();
  });

  it("accepts a LAN request with no Origin header, as a same-origin navigation has", async () => {
    const projectId = "accept-no-origin";

    const response = await POST(postRequest(projectId, "192.168.1.250", null));

    expect(response.status).toBe(200);
    await expect(fs.access(thumbnailFile(projectId))).resolves.toBeUndefined();
  });
});
