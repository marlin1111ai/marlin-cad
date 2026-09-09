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

// Every request URL uses the address the SERVER binds, exactly as the
// container sees it: HOSTNAME=0.0.0.0 on internal port 3000. The address the
// browser actually used arrives only in the Host header. Building the requests
// this way means a guard that read `request.url` instead of the Host header
// could not pass these tests.
const BIND_URL = "http://0.0.0.0:3000";

const writtenProjectIds = new Set<string>();

function thumbnailFile(projectId: string) {
  return path.join(THUMBNAIL_DIR, `${projectId}.png`);
}

type RequestOptions = {
  host: string | null;
  origin?: string | null;
  fetchSite?: string;
  protocol?: string;
};

function buildHeaders({ host, origin, fetchSite }: RequestOptions, extra?: Record<string, string>) {
  const headers = new Headers(extra);
  if (host !== null) headers.set("Host", host);
  if (origin !== undefined && origin !== null) headers.set("Origin", origin);
  if (fetchSite) headers.set("Sec-Fetch-Site", fetchSite);
  return headers;
}

// `origin` defaults to the matching origin for the given Host, which is what a
// browser on that address actually sends.
function withDefaults(options: RequestOptions): RequestOptions {
  if (options.origin === undefined && options.host !== null) {
    return { ...options, origin: `${options.protocol ?? "http"}://${options.host}` };
  }
  return options;
}

function postRequest(projectId: string, rawOptions: RequestOptions) {
  const options = withDefaults(rawOptions);
  writtenProjectIds.add(projectId);
  return new Request(`${BIND_URL}/api/project-thumbnail`, {
    method: "POST",
    headers: buildHeaders(options, { "Content-Type": "application/json" }),
    body: JSON.stringify({ dataUrl: PNG_DATA_URL, projectId }),
  });
}

function getRequest(projectId: string, rawOptions: RequestOptions) {
  const options = withDefaults(rawOptions);
  return new Request(`${BIND_URL}/api/project-thumbnail?projectId=${encodeURIComponent(projectId)}`, {
    headers: buildHeaders(options),
  });
}

function deleteRequest(projectId: string, rawOptions: RequestOptions) {
  const options = withDefaults(rawOptions);
  return new Request(`${BIND_URL}/api/project-thumbnail?projectId=${encodeURIComponent(projectId)}`, {
    method: "DELETE",
    headers: buildHeaders(options),
  });
}

// The owner opens the app at http://192.168.1.250:3001/, so that exact Host --
// a published port that differs from the container's internal 3000 -- is
// pinned by name rather than only by the range it belongs to.
const ACCEPTED_HOSTS = [
  ["the Unraid address and published port the app is opened at", "192.168.1.250:3001"],
  ["the dev box on the internal port", "192.168.1.245:3000"],
  ["a 192.168.0.0/16 address with no port", "192.168.1.245"],
  ["a 10.0.0.0/8 address", "10.14.7.3:3000"],
  ["the bottom of 172.16.0.0/12", "172.16.0.1:3000"],
  ["the top of 172.16.0.0/12", "172.31.255.254:3000"],
  ["localhost", "localhost:3000"],
  ["the IPv4 loopback address", "127.0.0.1:3000"],
] as const;

const REJECTED_HOSTS = [
  ["a 172 address just above the private block", "172.32.0.1:3000"],
  ["a 172 address just below the private block", "172.15.255.254:3000"],
  ["a public IP address", "93.184.216.34:3000"],
  ["another public IP address", "8.8.8.8"],
  ["a .local hostname", "tower.local:3000"],
  ["a bare hostname", "sketchforge:3000"],
  ["a public domain name", "example.invalid"],
  ["a name whose leading labels look like a private IP", "192.168.1.2.example.com"],
  ["the bind address itself", "0.0.0.0:3000"],
  ["a malformed host", "not a host:3000"],
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

        const postResponse = await POST(postRequest(projectId, { host }));
        expect(postResponse.status).toBe(200);
        expect(await postResponse.json()).toEqual({ version: expect.any(Number) });
        await expect(fs.access(thumbnailFile(projectId))).resolves.toBeUndefined();

        const getResponse = await GET(getRequest(projectId, { host }));
        expect(getResponse.status).toBe(200);
        expect(getResponse.headers.get("content-type")).toBe("image/png");
        const bytes = Buffer.from(await getResponse.arrayBuffer());
        expect(bytes.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

        const deleteResponse = await DELETE(deleteRequest(projectId, { host }));
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

        const postResponse = await POST(postRequest(projectId, { host }));
        expect(postResponse.status).toBe(403);
        await expect(fs.access(thumbnailFile(projectId))).rejects.toThrow();

        expect((await GET(getRequest(projectId, { host }))).status).toBe(403);
        expect((await DELETE(deleteRequest(projectId, { host }))).status).toBe(403);
      });
    }
  });

  it("refuses all three verbs when the Host header is missing entirely", async () => {
    const projectId = "reject-missing-host";

    // The request URL still carries the bind address, so a guard reading
    // request.url would see 0.0.0.0 here; one reading the Host header sees
    // nothing at all. Both must refuse.
    const postResponse = await POST(postRequest(projectId, { host: null, origin: null }));
    expect(postResponse.status).toBe(403);
    await expect(fs.access(thumbnailFile(projectId))).rejects.toThrow();

    expect((await GET(getRequest(projectId, { host: null, origin: null }))).status).toBe(403);
    expect((await DELETE(deleteRequest(projectId, { host: null, origin: null }))).status).toBe(403);
  });

  it("refuses all three verbs when an allowed Host carries a mismatched Origin", async () => {
    const projectId = "reject-origin-mismatch";
    const options = { host: "192.168.1.250:3001", origin: "http://192.168.1.250:3002" };

    expect((await POST(postRequest(projectId, options))).status).toBe(403);
    await expect(fs.access(thumbnailFile(projectId))).rejects.toThrow();

    expect((await GET(getRequest(projectId, options))).status).toBe(403);
    expect((await DELETE(deleteRequest(projectId, options))).status).toBe(403);
  });

  it("refuses an allowed Host whose Origin is a different private address", async () => {
    const projectId = "reject-other-lan-origin";

    const response = await POST(postRequest(projectId, {
      host: "192.168.1.250:3001",
      origin: "http://192.168.1.245:3001",
    }));

    expect(response.status).toBe(403);
    await expect(fs.access(thumbnailFile(projectId))).rejects.toThrow();
  });

  it("refuses an allowed Host whose Origin is a public address", async () => {
    const projectId = "reject-public-origin";

    const response = await POST(postRequest(projectId, {
      host: "192.168.1.250:3001",
      origin: "http://example.invalid",
    }));

    expect(response.status).toBe(403);
    await expect(fs.access(thumbnailFile(projectId))).rejects.toThrow();
  });

  it("refuses an allowed Host whose Origin is a malformed URL", async () => {
    const projectId = "reject-malformed-origin";
    const options = { host: "192.168.1.250:3001", origin: "not a url" };

    expect((await POST(postRequest(projectId, options))).status).toBe(403);
    await expect(fs.access(thumbnailFile(projectId))).rejects.toThrow();

    expect((await GET(getRequest(projectId, options))).status).toBe(403);
    expect((await DELETE(deleteRequest(projectId, options))).status).toBe(403);
  });

  it("refuses an allowed Host whose Origin switches protocol", async () => {
    const projectId = "reject-protocol";

    const response = await POST(postRequest(projectId, {
      host: "192.168.1.250:3001",
      origin: "https://192.168.1.250:3001",
    }));

    expect(response.status).toBe(403);
    await expect(fs.access(thumbnailFile(projectId))).rejects.toThrow();
  });

  it("refuses a cross-site fetch from an otherwise allowed Host and Origin", async () => {
    const projectId = "reject-cross-site";
    const options = { host: "192.168.1.250:3001", fetchSite: "cross-site" };

    expect((await POST(postRequest(projectId, options))).status).toBe(403);
    await expect(fs.access(thumbnailFile(projectId))).rejects.toThrow();

    expect((await GET(getRequest(projectId, options))).status).toBe(403);
    expect((await DELETE(deleteRequest(projectId, options))).status).toBe(403);
  });

  it("accepts the same-origin and same-site fetch metadata a browser sends", async () => {
    for (const fetchSite of ["same-origin", "same-site", "none"]) {
      const projectId = `accept-sfs-${fetchSite}`;
      const response = await POST(postRequest(projectId, { host: "192.168.1.250:3001", fetchSite }));
      expect(response.status).toBe(200);
      await expect(fs.access(thumbnailFile(projectId))).resolves.toBeUndefined();
    }
  });

  it("accepts a LAN request with no Origin header, as a same-origin navigation has", async () => {
    const projectId = "accept-no-origin";

    const response = await POST(postRequest(projectId, { host: "192.168.1.250:3001", origin: null }));

    expect(response.status).toBe(200);
    await expect(fs.access(thumbnailFile(projectId))).resolves.toBeUndefined();
  });

  it("ignores the bind address in request.url when the Host header is allowed", async () => {
    const projectId = "accept-ignores-bind-address";

    // Belt and braces for the actual production bug: the URL host is 0.0.0.0,
    // which is refused on its own (see the rejected-hosts table), yet the
    // request must still be accepted on the strength of its Host header.
    const request = new Request(`${BIND_URL}/api/project-thumbnail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Host: "192.168.1.250:3001",
        Origin: "http://192.168.1.250:3001",
        "Sec-Fetch-Site": "same-origin",
      },
      body: JSON.stringify({ dataUrl: PNG_DATA_URL, projectId }),
    });
    writtenProjectIds.add(projectId);

    expect(new URL(request.url).hostname).toBe("0.0.0.0");
    expect((await POST(request)).status).toBe(200);
    await expect(fs.access(thumbnailFile(projectId))).resolves.toBeUndefined();
  });
});
