import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DATA_DIR,
  collectTemplates,
  main,
  parseArgs,
  parseIndex,
  readConfig,
  readTemplateFiles,
  selectEntries,
  templateBody,
  versionBody,
} from "./templateImport.mjs";

const NOW = Date.UTC(2026, 9, 16, 12, 0, 0);
const API = "https://api.example.test/api/v1";

function fakeJwt(payload) {
  const part = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "HS256", typ: "JWT" })}.${part(payload)}.c2lnbmF0dXJl`;
}
const TOKEN = fakeJwt({ sub: "user-1", sid: "session-1", exp: NOW / 1000 + 15 * 60 });
const ENV = { ZIMOS_API_URL: API, ZIMOS_ADMIN_TOKEN: TOKEN };

const realFiles = readTemplateFiles();
const real = collectTemplates(realFiles);
const consoleFile = (key) => JSON.parse(realFiles.console[`${key}.json`]);

function capture() {
  const lines = [];
  return { lines, log: (line = "") => lines.push(String(line)), text: () => lines.join("\n") };
}

function noNetwork() {
  const calls = [];
  const fetchImpl = async (...args) => {
    calls.push(args);
    throw new Error("a dry run must not send anything");
  };
  return { calls, fetchImpl };
}

/**
 * An in-memory console API with the four routes the import may use. Any other
 * method or path fails the test, so a request that changes or removes a
 * template cannot slip through.
 */
function fakeConsole({ templates = [], failWhen = () => null, rateLimit = null } = {}) {
  const requests = [];
  const rows = templates.map((t) => ({ versions: [], ...t }));
  let nextId = 1;

  const toRow = (t) => {
    const active = [...t.versions].reverse().find((v) => v.isActive) ?? null;
    return {
      id: t.id,
      name: t.name,
      kind: t.kind,
      category: t.category ?? null,
      thumbnailUrl: t.thumbnailUrl ?? null,
      isPublished: Boolean(t.isPublished),
      primaryColor: t.primaryColor ?? null,
      tags: t.tags ?? [],
      rtl: t.rtl ?? true,
      versionCount: t.versions.length,
      activeVersion: active ? active.version : null,
      inGallery: Boolean(t.isPublished && active),
    };
  };
  const json = (status, body, headers = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

  async function fetchImpl(url, init = {}) {
    const method = init.method ?? "GET";
    const path = String(url).slice(API.length);
    const body = init.body === undefined ? undefined : JSON.parse(init.body);
    requests.push({ method, path, body, authorization: init.headers?.Authorization, redirect: init.redirect });
    expect(String(url).startsWith(`${API}/`)).toBe(true);

    const injected = failWhen({ method, path, body, requests });
    if (injected) return injected;
    const limit = rateLimit ? rateLimit(requests.length) : {};

    if (method === "GET" && path === "/admin/templates") return json(200, { templates: rows.map(toRow).reverse() }, limit);
    if (method === "POST" && path === "/admin/templates") {
      const row = { id: `t${nextId++}`, ...body, isPublished: false, versions: [] };
      rows.push(row);
      return json(201, { template: toRow(row) }, limit);
    }
    const versions = /^\/admin\/templates\/([^/]+)\/versions$/.exec(path);
    if (method === "POST" && versions) {
      const row = rows.find((t) => t.id === versions[1]);
      if (!row) return json(404, { error: { code: "NOT_FOUND", message: "Template not found" } });
      const version = { id: `v${row.id}-${row.versions.length + 1}`, version: row.versions.length + 1, isActive: body.activate !== false, body };
      row.versions.push(version);
      return json(201, { version: { id: version.id, version: version.version, isActive: version.isActive } }, limit);
    }
    const publish = /^\/admin\/templates\/([^/]+)\/publish$/.exec(path);
    if (method === "POST" && publish) {
      const row = rows.find((t) => t.id === publish[1]);
      if (!row) return json(404, { error: { code: "NOT_FOUND", message: "Template not found" } });
      if (!row.versions.some((v) => v.isActive)) {
        return json(409, { error: { code: "TEMPLATE_HAS_NO_ACTIVE_VERSION", message: "no active version" } });
      }
      row.isPublished = true;
      return json(200, { template: toRow(row) }, limit);
    }
    throw new Error(`The import sent ${method} ${path}, which it must never send`);
  }

  return { fetchImpl, requests, rows, posts: () => requests.filter((r) => r.method !== "GET") };
}

async function run(argv, options = {}) {
  const out = capture();
  const code = await main(argv, { env: ENV, now: NOW, sleep: async () => {}, log: out.log, ...options });
  // The token must never be printed, whatever happened.
  expect(out.text()).not.toContain(TOKEN);
  expect(out.text()).not.toContain(TOKEN.split(".")[1]);
  return { code, out };
}

// ------------------------------------------------------------------ the files

describe("the generated files", () => {
  it("lists the 52 templates in INDEX.md's order, every one complete and consistent", () => {
    const { rows, problems } = parseIndex(realFiles.index);
    expect(problems).toEqual([]);
    expect(rows).toHaveLength(52);
    expect(rows[0]).toMatchObject({ n: 1, key: "xs-01", name: "XS 01", rtl: false, tags: ["xs"], versionFile: "xs-01.json" });
    expect(rows[1]).toMatchObject({ n: 2, key: "xs-01-ar", rtl: true, tags: ["xs", "ar"], versionFile: "xs-01-ar.json" });
    expect(rows.at(-1).key).toBe("xs-24-ar");

    expect(real.problems).toEqual([]);
    expect(real.entries.map((e) => e.key)).toEqual(rows.map((r) => r.key));
    for (const entry of real.entries) expect(entry.problems, entry.key).toEqual([]);
  });

  it("marks exactly the Arabic copies right-to-left", () => {
    for (const entry of real.entries) expect(entry.meta.rtl, entry.key).toBe(entry.key.endsWith("-ar"));
    expect(real.entries.filter((e) => e.meta.rtl)).toHaveLength(26);
  });

  it("counts the pages and elements the backend review counted (142 pages, 554 elements)", () => {
    expect(real.entries.reduce((sum, e) => sum + e.stats.pages, 0)).toBe(142);
    expect(real.entries.reduce((sum, e) => sum + e.stats.elements, 0)).toBe(554);
  });
});

// ------------------------------------------------------------------ the bodies

describe("file to payload", () => {
  const entry = (key) => real.entries.find((e) => e.key === key);

  it("builds the body the console's New template form sends", () => {
    expect(templateBody(entry("xs-01").meta)).toEqual({
      name: "XS 01",
      category: "fashion",
      thumbnailUrl: "",
      kind: "store",
      priceAmount: 0,
      isFree: true,
      primaryColor: "#717FE0",
      tags: ["xs"],
      rtl: false,
    });
    expect(templateBody(entry("xs-13-ar").meta)).toEqual({
      name: "XS 13 عربي",
      category: "single_product",
      thumbnailUrl: "",
      kind: "store",
      priceAmount: 0,
      isFree: true,
      primaryColor: "#235EE7",
      tags: ["xs", "ar"],
      rtl: true,
    });
  });

  it("sends the version file whole, made the gallery's version", () => {
    for (const key of ["xs-01", "xs-01-ar", "xs-22-ar"]) {
      const file = consoleFile(key);
      expect(versionBody(entry(key).version)).toEqual({ ...file, activate: true });
      expect(Object.keys(versionBody(file))).toEqual(["globalStyles", "pages", "sections", "activate"]);
    }
  });

  it("fills what the form fills when a version file leaves it out", () => {
    const pages = [{ path: "/", title: "Home" }];
    expect(versionBody({ pages })).toEqual({ globalStyles: {}, pages, sections: [], activate: true });
  });
});

// ------------------------------------------------------------------ the checks

describe("the checks", () => {
  // The real files with one change; generated/<key>.json follows the console
  // file unless `consoleOnly`, so only the rule under test fails.
  function withChange(key, change, { consoleOnly = false } = {}) {
    const files = structuredClone(realFiles);
    const version = JSON.parse(files.console[`${key}.json`]);
    change(version);
    files.console[`${key}.json`] = JSON.stringify(version);
    if (!consoleOnly) {
      const whole = JSON.parse(files.generated[`${key}.json`]);
      whole.version = version;
      files.generated[`${key}.json`] = JSON.stringify(whole);
    }
    return collectTemplates(files).entries.find((e) => e.key === key).problems;
  }

  it("reports a file that is not JSON", () => {
    const files = structuredClone(realFiles);
    files.console["xs-02.json"] = "{ not json";
    const problems = collectTemplates(files).entries.find((e) => e.key === "xs-02").problems;
    expect(problems.join("\n")).toMatch(/console\/xs-02\.json is not valid JSON/);
  });

  it("reports a missing version file and one INDEX.md does not list", () => {
    const files = structuredClone(realFiles);
    delete files.console["xs-03.json"];
    files.console["xs-99.json"] = "{}";
    const { entries, problems } = collectTemplates(files);
    expect(entries.find((e) => e.key === "xs-03").problems).toContain("console/xs-03.json is missing");
    expect(problems).toContain("console/xs-99.json is not in INDEX.md");
  });

  it("reports a console file that is not the generated template's version", () => {
    const problems = withChange("xs-04", (v) => (v.pages[0].title = "Changed"), { consoleOnly: true });
    expect(problems.join("\n")).toMatch(/not the version in generated\/xs-04\.json/);
  });

  it("reports what the API would drop without saying so", () => {
    expect(withChange("xs-05", (v) => (v.draft = true)).join("\n")).toMatch(/key "draft" the API would drop/);
    expect(withChange("xs-05", (v) => (v.pages[1].hidden = true)).join("\n")).toMatch(/pages\[1\] has a key "hidden"/);
  });

  it("reports what the API would refuse", () => {
    expect(withChange("xs-06", (v) => (v.pages[1].path = "/")).join("\n")).toMatch(/two pages use the path "\/"/);
    expect(withChange("xs-06", (v) => (v.pages[0].pageType = "landing")).join("\n")).toMatch(/pageType "landing"/);
    expect(withChange("xs-06", (v) => (v.pages = [])).join("\n")).toMatch(/pages must be a list of 1 to 50/);
    expect(withChange("xs-06", (v) => (v.pages[0].title = null)).join("\n")).toMatch(/title must be text/);
  });

  it("reports a right-to-left flag on the wrong copy", () => {
    const files = structuredClone(realFiles);
    files.index = files.index.replace("| xs-07 | XS 07 | food_beverage | xs | false |", "| xs-07 | XS 07 | food_beverage | xs | true |");
    const whole = JSON.parse(files.generated["xs-07.json"]);
    whole.rtl = true;
    files.generated["xs-07.json"] = JSON.stringify(whole);
    const problems = collectTemplates(files).entries.find((e) => e.key === "xs-07").problems;
    expect(problems).toEqual(["rtl is true but the key xs-07 is not an Arabic copy"]);
  });

  it("reports INDEX.md and the generated template disagreeing", () => {
    const files = structuredClone(realFiles);
    files.index = files.index.replace("| XS 08 | fashion |", "| XS 08 | shoes |");
    const problems = collectTemplates(files).entries.find((e) => e.key === "xs-08").problems;
    expect(problems.join("\n")).toMatch(/INDEX\.md says category "shoes", generated\/xs-08\.json says "fashion"/);
  });
});

// ------------------------------------------------------------------ dry run

describe("dry run (the default)", () => {
  it("prints all 52 with name, kind, rtl and size, and sends nothing", async () => {
    const net = noNetwork();
    const { code, out } = await run([], { fetchImpl: net.fetchImpl });
    expect(code).toBe(0);
    expect(net.calls).toHaveLength(0);
    expect(out.lines[0]).toBe("Dry run: nothing is sent.");
    const rows = out.lines.filter((line) => /^\d+\s+xs-/.test(line));
    expect(rows).toHaveLength(52);
    expect(rows[0]).toMatch(/^1\s+xs-01\s+XS 01\s+store\s+fashion\s+false\s+xs\s+#717FE0\s+3\s+8\s+6\.\d KB$/);
    expect(rows[1]).toMatch(/^2\s+xs-01-ar\s+XS 01 عربي\s+store\s+fashion\s+true\s+xs,ar\s/);
    expect(out.text()).toContain("52 templates check out");
    expect(out.text()).toContain(`With --apply they would go to ${API}.`);
  });

  it("does not need the URL or the token", async () => {
    const net = noNetwork();
    const { code, out } = await run([], { env: {}, fetchImpl: net.fetchImpl });
    expect(code).toBe(0);
    expect(net.calls).toHaveLength(0);
    expect(out.text()).toContain("ZIMOS_API_URL is not set; --apply needs it.");
  });

  it("narrows to --only and --from", async () => {
    const only = await run(["--only", "xs-01"], { fetchImpl: noNetwork().fetchImpl });
    expect(only.out.lines.filter((line) => /^\d+\s+xs-/.test(line))).toEqual([expect.stringMatching(/^1\s+xs-01\s/)]);
    const from = await run(["--from=xs-05"], { fetchImpl: noNetwork().fetchImpl });
    const rows = from.out.lines.filter((line) => /^\d+\s+xs-/.test(line));
    expect(rows).toHaveLength(40);
    expect(rows[0]).toMatch(/^13\s+xs-05\s/);
  });

  it("fails, and with --apply sends nothing, when a file is wrong", async () => {
    const dir = mkdtempSync(join(tmpdir(), "template-import-"));
    try {
      mkdirSync(join(dir, "console"));
      const index = realFiles.index
        .split(/\r?\n/)
        .filter((line) => !/^\| (\d+) \|/.test(line) || /^\| [12] \|/.test(line))
        .join("\n");
      writeFileSync(join(dir, "console", "INDEX.md"), index);
      for (const key of ["xs-01", "xs-01-ar"]) {
        writeFileSync(join(dir, `${key}.json`), realFiles.generated[`${key}.json`]);
        writeFileSync(join(dir, "console", `${key}.json`), realFiles.console[`${key}.json`]);
      }
      writeFileSync(join(dir, "console", "xs-01-ar.json"), "{ broken");

      const dry = await run([], { dir, fetchImpl: noNetwork().fetchImpl });
      expect(dry.code).toBe(1);
      expect(dry.out.text()).toMatch(/#2 xs-01-ar: console\/xs-01-ar\.json is not valid JSON/);

      const net = noNetwork();
      const applied = await run(["--apply"], { dir, fetchImpl: net.fetchImpl });
      expect(applied.code).toBe(1);
      expect(net.calls).toHaveLength(0);
      expect(applied.out.text()).toContain("Nothing was sent: fix the problems above first.");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ------------------------------------------------------------------ settings

describe("settings", () => {
  it("has no default URL and refuses to apply without one", async () => {
    expect(readConfig({ ZIMOS_ADMIN_TOKEN: TOKEN }, NOW).baseUrl).toBeNull();
    const net = noNetwork();
    const { code, out } = await run(["--apply"], { env: { ZIMOS_ADMIN_TOKEN: TOKEN }, fetchImpl: net.fetchImpl });
    expect(code).toBe(2);
    expect(net.calls).toHaveLength(0);
    expect(out.text()).toMatch(/ZIMOS_API_URL is not set.*There is no default on purpose/);
    expect(out.text()).toContain("Nothing was sent.");
  });

  it("takes only an https API base ending in /api/v1 (http for localhost)", () => {
    const url = (value) => readConfig({ ZIMOS_API_URL: value, ZIMOS_ADMIN_TOKEN: TOKEN }, NOW);
    expect(url("https://api.example.test/api/v1/").baseUrl).toBe(API);
    expect(url("http://localhost:4000/api/v1").baseUrl).toBe("http://localhost:4000/api/v1");
    expect(url("http://api.example.test/api/v1").problems.join()).toMatch(/must be https/);
    expect(url("https://api.example.test").problems.join()).toMatch(/must end in \/api\/v1/);
    expect(url("https://api.example.test/api/v1?x=1").problems.join()).toMatch(/must not carry/);
    expect(url("not a url").problems.join()).toMatch(/is not a URL/);
  });

  it("wants the access token, unexpired, and never repeats it", () => {
    const token = (value) => readConfig({ ZIMOS_API_URL: API, ZIMOS_ADMIN_TOKEN: value }, NOW);
    expect(token(undefined).problems.join()).toMatch(/ZIMOS_ADMIN_TOKEN is not set/);
    const opaque = "3f9a1c0d8e7b6a5f4e3d2c1b0a9f8e7d";
    expect(token(opaque).problems.join()).toMatch(/does not look like an access token/);
    expect(token(opaque).problems.join()).not.toContain(opaque);
    const expired = fakeJwt({ sub: "user-1", exp: NOW / 1000 - 1 });
    expect(token(expired).problems.join()).toMatch(/has expired/);
    expect(token(expired).problems.join()).not.toContain(expired);
    expect(token(`Bearer ${TOKEN}`)).toMatchObject({ token: TOKEN, problems: [] });
    expect(token(`"${TOKEN}"`).token).toBe(TOKEN);
  });

  it("reads its options", () => {
    expect(parseArgs([])).toMatchObject({ apply: false, only: null, from: null, resumeIncomplete: false });
    expect(parseArgs(["--apply", "--only", "xs-01"])).toMatchObject({ apply: true, only: "xs-01" });
    expect(parseArgs(["--from=xs-05", "--resume-incomplete"])).toMatchObject({ from: "xs-05", resumeIncomplete: true });
    expect(() => parseArgs(["--only"])).toThrow(/needs a template key/);
    expect(() => parseArgs(["--only", "xs-01", "--from", "xs-02"])).toThrow(/cannot be used together/);
    expect(() => parseArgs(["--force"])).toThrow(/Unknown option/);
    expect(() => selectEntries(real.entries, { only: "xs-99" })).toThrow(/no template with that key/);
  });
});

// ------------------------------------------------------------------ applying

describe("--apply", () => {
  let server;
  afterEach(() => {
    // Whatever a test did, only the four allowed calls were ever made.
    for (const r of server?.requests ?? []) {
      const allowed =
        (r.method === "GET" && r.path === "/admin/templates") ||
        (r.method === "POST" && /^\/admin\/templates(\/[^/]+\/(versions|publish))?$/.test(r.path));
      expect(allowed, `${r.method} ${r.path}`).toBe(true);
      expect(r.authorization).toBe(`Bearer ${TOKEN}`);
      expect(r.redirect).toBe("error");
    }
    server = null;
  });

  it("creates, versions and publishes all 52 in INDEX.md's order", async () => {
    server = fakeConsole();
    const { code, out } = await run(["--apply"], { fetchImpl: server.fetchImpl });
    expect(code).toBe(0);
    expect(server.requests[0]).toMatchObject({ method: "GET", path: "/admin/templates" });
    const posts = server.posts();
    expect(posts).toHaveLength(52 * 3);
    real.entries.forEach((entry, i) => {
      const [create, version, publish] = posts.slice(i * 3, i * 3 + 3);
      const id = server.rows[i].id;
      expect(create).toMatchObject({ path: "/admin/templates", body: templateBody(entry.meta) });
      expect(version).toMatchObject({ path: `/admin/templates/${id}/versions`, body: versionBody(consoleFile(entry.key)) });
      expect(publish).toMatchObject({ path: `/admin/templates/${id}/publish`, body: undefined });
    });
    expect(server.rows.map((t) => t.name)).toEqual(real.entries.map((e) => e.meta.name));
    expect(server.rows.every((t) => t.isPublished && t.versions.length === 1)).toBe(true);
    expect(server.rows.filter((t) => t.rtl).map((t) => t.name)).toEqual(
      real.entries.filter((e) => e.key.endsWith("-ar")).map((e) => e.meta.name)
    );
    expect(out.text()).toContain("created and published (52)");
  });

  it("skips what is already there, so a second run sends no writes", async () => {
    server = fakeConsole();
    await run(["--apply"], { fetchImpl: server.fetchImpl });
    const writes = server.posts().length;
    const again = await run(["--apply"], { fetchImpl: server.fetchImpl });
    expect(again.code).toBe(0);
    expect(server.posts()).toHaveLength(writes);
    expect(server.rows).toHaveLength(52);
    expect(again.out.text()).toContain("already there, left alone (52)");
  });

  it("does one template with --only and carries on with --from", async () => {
    server = fakeConsole();
    await run(["--apply", "--only", "xs-01"], { fetchImpl: server.fetchImpl });
    expect(server.rows.map((t) => t.name)).toEqual(["XS 01"]);
    const { out } = await run(["--apply", "--from", "xs-21"], { fetchImpl: server.fetchImpl });
    expect(server.rows.map((t) => t.name)).toEqual(["XS 01", "XS 21", "XS 21 عربي", "XS 22", "XS 22 عربي", "Atelier", "Atelier عربي", "Cradle", "Cradle عربي"]);
    expect(out.text()).toContain("created and published (8): xs-21, xs-21-ar, xs-22, xs-22-ar, xs-23, xs-23-ar, xs-24, xs-24-ar");
  });

  it("stops at the first failure with the whole error, and says what was done", async () => {
    const error = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid body",
        details: [{ field: "pages[0].builderData", message: 'Unknown element type "xs_slider"' }],
        requestId: "req-42",
      },
    };
    server = fakeConsole({
      failWhen: ({ method, path, requests }) =>
        method === "POST" && /\/versions$/.test(path) && requests.filter((r) => /\/versions$/.test(r.path)).length === 3
          ? new Response(JSON.stringify(error), { status: 422, headers: { "content-type": "application/json" } })
          : null,
    });
    const { code, out } = await run(["--apply"], { fetchImpl: server.fetchImpl });
    expect(code).toBe(1);
    const text = out.text();
    expect(text).toContain('STOPPED at #3 xs-01b ("XS 01 B"), while adding its version.');
    expect(text).toContain("POST /admin/templates/t3/versions");
    expect(text).toContain("HTTP 422");
    expect(text).toContain('"code": "VALIDATION_ERROR"');
    expect(text).toContain('Unknown element type \\"xs_slider\\"');
    expect(text).toContain('"requestId": "req-42"');
    expect(text).toMatch(/does not know an element type/);
    expect(text).toContain("the template exists (id t3), with no version, not published.");
    expect(text).toContain("--from xs-01b --resume-incomplete");
    expect(text).toContain("Before it (2 of 52):");
    expect(text).toContain("created and published (2): xs-01, xs-01-ar");
    // Nothing after the failed request.
    expect(server.requests.at(-1)).toMatchObject({ method: "POST", path: "/admin/templates/t3/versions" });
  });

  it("leaves a half-made template alone until --resume-incomplete, which finishes it without a new one", async () => {
    server = fakeConsole({
      templates: [{ id: "old", name: "XS 01 B", kind: "store", category: "fashion", tags: ["xs"], rtl: false, primaryColor: "#717FE0" }],
    });
    const plain = await run(["--apply", "--only", "xs-01b"], { fetchImpl: server.fetchImpl });
    expect(plain.code).toBe(0);
    expect(server.posts()).toHaveLength(0);
    expect(plain.out.text()).toMatch(/already there with no version .*--resume-incomplete/);

    const resumed = await run(["--apply", "--only", "xs-01b", "--resume-incomplete"], { fetchImpl: server.fetchImpl });
    expect(resumed.code).toBe(0);
    expect(server.posts().map((r) => r.path)).toEqual(["/admin/templates/old/versions", "/admin/templates/old/publish"]);
    expect(server.rows).toHaveLength(1);
    expect(resumed.out.text()).toContain("finished from an earlier run (1): xs-01b");
  });

  it("never touches a template that is there: published with other settings, unpublished, the funnel, or named twice", async () => {
    server = fakeConsole({
      templates: [
        // Pasted by hand with the form's default right-to-left left ticked.
        { id: "hand", name: "XS 01", kind: "store", category: "fashion", tags: ["xs"], rtl: true, primaryColor: "#717FE0", isPublished: true, versions: [{ version: 1, isActive: true }] },
        { id: "draft", name: "XS 02", kind: "store", category: "home_living", tags: ["xs"], rtl: false, primaryColor: "#3B5D50", versions: [{ version: 1, isActive: true }] },
        { id: "funnel", name: "XS 03", kind: "funnel", isPublished: true, versions: [{ version: 1, isActive: true }] },
        { id: "a", name: "XS 04", kind: "store" },
        { id: "b", name: "XS 04", kind: "store" },
      ],
    });
    const { code, out } = await run(["--apply"], { fetchImpl: server.fetchImpl });
    expect(code).toBe(0);
    const touched = new Set(server.posts().map((r) => r.path.split("/")[3]).filter(Boolean));
    for (const id of ["hand", "draft", "funnel", "a", "b"]) expect(touched.has(id), id).toBe(false);
    expect(server.rows.filter((t) => t.name === "XS 01")).toHaveLength(1);
    expect(server.rows.filter((t) => t.name === "XS 03").map((t) => t.kind)).toEqual(["funnel", "store"]);
    const text = out.text();
    expect(text).toMatch(/#1 xs-01 \("XS 01"\): already in the gallery .*rtl is true in the console, false in the file/);
    expect(text).toMatch(/#7 xs-02 \("XS 02"\): already there unpublished/);
    expect(text).toMatch(/#11 xs-04 \("XS 04"\): 2 store templates already have this name/);
    expect(text).toContain("created and published (49)");
  });

  it("stops before writing anything when the token is refused", async () => {
    server = fakeConsole({
      failWhen: () =>
        new Response(JSON.stringify({ error: { code: "INVALID_TOKEN", message: "Invalid or expired access token" } }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
    });
    const { code, out } = await run(["--apply"], { fetchImpl: server.fetchImpl });
    expect(code).toBe(1);
    expect(server.requests).toHaveLength(1);
    expect(out.text()).toContain("STOPPED while reading the templates already in the console.");
    expect(out.text()).toContain("HTTP 401");
    expect(out.text()).toMatch(/Copy a fresh one/);
  });

  it("stops on a request that gets no answer", async () => {
    server = fakeConsole({
      failWhen: ({ method }) => {
        if (method === "POST") throw new TypeError("fetch failed");
        return null;
      },
    });
    const { code, out } = await run(["--apply", "--only", "xs-01"], { fetchImpl: server.fetchImpl });
    expect(code).toBe(1);
    expect(out.text()).toContain("No response: fetch failed");
    expect(out.text()).toContain('STOPPED at #1 xs-01 ("XS 01"), while creating the template.');
  });

  it("waits for the rate limit window instead of running into a 429", async () => {
    const waits = [];
    server = fakeConsole({
      rateLimit: (n) => (n === 2 ? { "RateLimit-Remaining": "3", "RateLimit-Reset": "7" } : { "RateLimit-Remaining": "90" }),
    });
    const { code, out } = await run(["--apply", "--only", "xs-01"], {
      fetchImpl: server.fetchImpl,
      sleep: async (ms) => waits.push(ms),
    });
    expect(code).toBe(0);
    expect(waits).toEqual([7000]);
    expect(out.text()).toContain("waiting 7 s for the API's rate limit window");
  });
});

it("reads the files from the dashboard's generated folder", () => {
  expect(readFileSync(join(DATA_DIR, "console", "INDEX.md"), "utf8")).toBe(realFiles.index);
});
