import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createApp } from "../src/app.js";
import { getServerConfig } from "../src/config/env.js";
import { DataStore } from "../src/services/store.js";

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kos-scraper-test-"));
}

function createFakeSpawn(mode = "complete") {
  return () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.pid = 99999;
    child.killed = false;
    child.kill = () => {
      child.killed = true;
      setImmediate(() => child.emit("close", 143));
    };

    if (mode === "complete") {
      setTimeout(() => {
        const item = {
          source: "sewakost",
          url: "https://www.sewakost.com/kost/jakarta/jakarta-selatan/test-123/",
          slug: "test-123",
          title: "Kos Uji Cipete",
          price: 950000,
          price_text: "Rp 950.000",
          price_suspect: false,
          jenis: "Kost Putri",
          kecamatan: "Cilandak",
          kelurahan: "Cipete Selatan",
          fasilitas_list: ["AC", "Free WiFi"],
        };
        child.stderr.emit("data", Buffer.from(JSON.stringify({ type: "phase", phase: "detail", current: 1, total: 1, message: "Memuat detail 1/1" }) + "\n"));
        child.stderr.emit("data", Buffer.from(JSON.stringify({ type: "item", current: 1, total: 1, item }) + "\n"));
        child.stdout.emit("data", Buffer.from(JSON.stringify({ items: [item], files: { csv: "hasil_test.csv" } })));
        child.emit("close", 0);
      }, 25);
    }
    return child;
  };
}

async function startTestServer(dataDir, mode = "complete") {
  const base = getServerConfig();
  const config = { ...base, dataDir, clientDistDir: path.join(dataDir, "no-dist") };
  const { app, queue } = createApp(config, { spawnFn: createFakeSpawn(mode) });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    queue,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test("API health, presets, and validation reject unsafe payloads with JSON", async (t) => {
  const tmp = makeTmpDir();
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const srv = await startTestServer(tmp);
  t.after(() => srv.close());

  const health = await fetch(`${srv.baseUrl}/api/health`).then((r) => r.json());
  assert.equal(health.success, true);
  assert.deepEqual(health.adapters, [
    "sewakost",
    "rukita",
    "mamikos",
    "infokost",
    "cove",
    "djuragankamar",
    "rumah123",
    "kostjakarta",
  ]);

  const presets = await fetch(`${srv.baseUrl}/api/presets`).then((r) => r.json());
  assert.equal(presets.landmarks[0].id, "bank-mega");

  const badArea = await fetch(`${srv.baseUrl}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sources: ["sewakost"], area: "jakarta; rm -rf /" }),
  });
  assert.equal(badArea.status, 400);
  const badJson = await badArea.json();
  assert.equal(badJson.success, false);

  const traversal = await fetch(`${srv.baseUrl}/api/results/..%2Fpackage.json`);
  assert.equal(traversal.status, 400);

  const badResource = await fetch(`${srv.baseUrl}/api/resources/inspect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://example.com/not-google" }),
  });
  assert.equal(badResource.status, 400);

  const resList = await fetch(`${srv.baseUrl}/api/resources/results`).then((r) => r.json());
  assert.equal(resList.success, true);
  assert.equal(Array.isArray(resList.items), true);
  const travBody = await traversal.json();
  assert.equal(travBody.success, false);
});

test("Job queue streams items, completes, and exports safe CSV", async (t) => {
  const tmp = makeTmpDir();
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const srv = await startTestServer(tmp, "complete");
  t.after(() => srv.close());

  // Server-side private resource catalog never leaks raw URLs back to clients
  const savedPreset = await fetch(`${srv.baseUrl}/api/resources/presets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      label: "Private Kost DB",
      url: "https://docs.google.com/spreadsheets/d/1PRIVATE_SECRET_SHEET_ID_99999/edit?gid=0",
    }),
  }).then((r) => r.json());
  assert.equal(savedPreset.success, true);
  assert.equal("url" in savedPreset.preset, false);

  const presetList = await fetch(`${srv.baseUrl}/api/resources/presets`).then((r) => r.json());
  assert.equal(presetList.presets.length, 1);
  assert.equal(JSON.stringify(presetList).includes("1PRIVATE_SECRET_SHEET_ID_99999"), false);

  const createdRes = await fetch(`${srv.baseUrl}/api/resources/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      presetId: savedPreset.preset.id,
      area: "jakarta-selatan",
      priceCategory: "murah",
      availability: "strict_available",
      quality: "worth_it",
      gender: "campur",
      pet: "pet_friendly",
      detailsLimit: 0,
      liveEnrichLimit: 500,
      keepHistory: false,
      storageMode: "merge",
    }),
  });
  assert.equal(createdRes.status, 201);
  const { job: resJob } = await createdRes.json();
  assert.equal(resJob.options.url, null);
  assert.equal(resJob.options.presetId, savedPreset.preset.id);
  assert.equal(JSON.stringify(resJob).includes("1PRIVATE_SECRET_SHEET_ID_99999"), false);
  const stateFile = fs.readFileSync(path.join(tmp, "jobs_state.json"), "utf8");
  assert.equal(stateFile.includes("1PRIVATE_SECRET_SHEET_ID_99999"), false);
  assert.equal(resJob.options.priceCategory, "murah");
  assert.equal(resJob.options.availability, "strict_available");
  assert.equal(resJob.options.storageMode, "merge");
  assert.equal(resJob.options.detailsLimit, 0);
  assert.equal(resJob.options.liveEnrichLimit, 500);

  const delPreset = await fetch(`${srv.baseUrl}/api/resources/presets/${savedPreset.preset.id}`, {
    method: "DELETE",
  }).then((r) => r.json());
  assert.equal(delPreset.presets.length, 0);

  // File CRUD delete endpoints validate & delete safely
  fs.writeFileSync(path.join(tmp, "old_test.json"), "[]", "utf8");
  fs.mkdirSync(path.join(tmp, "resources"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "resources", "old_res.json"), "[]", "utf8");
  const delMain = await fetch(`${srv.baseUrl}/api/results/old_test.json`, { method: "DELETE" }).then((r) => r.json());
  assert.equal(delMain.success, true);
  assert.equal(fs.existsSync(path.join(tmp, "old_test.json")), false);
  const delRes = await fetch(`${srv.baseUrl}/api/resources/results/old_res.json`, { method: "DELETE" }).then((r) => r.json());
  assert.equal(delRes.success, true);
  assert.equal(fs.existsSync(path.join(tmp, "resources", "old_res.json")), false);

  const created = await fetch(`${srv.baseUrl}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sources: ["sewakost"], area: "jakarta-selatan", maxPrice: 1200000 }),
  });
  assert.equal(created.status, 201);
  const { job } = await created.json();

  await new Promise((resolve) => setTimeout(resolve, 100));
  const polled = await fetch(`${srv.baseUrl}/api/jobs/${job.id}`).then((r) => r.json());
  assert.equal(polled.job.status, "completed");
  assert.equal(polled.job.itemsCount, 1);

  const csvRes = await fetch(`${srv.baseUrl}/api/export/csv`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      maskContact: true,
      items: [{ source: "sewakost", title: "=HACK()", price: 950000, wa: "081234567890", wa_link: "https://wa.me/6281234567890", url: "https://example.com" }],
    }),
  });
  assert.equal(csvRes.status, 200);
  const csvText = await csvRes.text();
  assert.match(csvText, /'=HACK\(\)/);
  assert.match(csvText, /0812-••••-7890/);
});

test("Job cancellation terminates running child and DataStore marks active jobs interrupted on restart", async (t) => {
  const tmp = makeTmpDir();
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const srv = await startTestServer(tmp, "hang");
  t.after(() => srv.close());

  const { job } = await fetch(`${srv.baseUrl}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-google-maps-api-key": "SUPER_SECRET_KEY_123" },
    body: JSON.stringify({ sources: ["sewakost"], area: "jakarta-selatan", gmaps: true, concurrency: 99 }),
  }).then((r) => r.json());

  assert.equal(job.options.gmaps, true);
  assert.equal(job.options.concurrency, 8);
  assert.equal(JSON.stringify(job).includes("SUPER_SECRET_KEY_123"), false);

  const cancelled = await fetch(`${srv.baseUrl}/api/jobs/${job.id}/cancel`, { method: "POST" }).then((r) => r.json());
  assert.equal(cancelled.job.status, "cancelled");

  const persisted = fs.readFileSync(path.join(tmp, "jobs_state.json"), "utf8");
  assert.equal(persisted.includes("SUPER_SECRET_KEY_123"), false);

  const store = new DataStore(tmp);
  store.persistJobsState([{ id: "job_stale", options: {}, status: "running", progress: {}, logs: [], createdAt: "2026-01-01", updatedAt: "2026-01-01" }]);
  const reloaded = store.loadJobsState();
  assert.equal(reloaded[0].status, "interrupted");
});

