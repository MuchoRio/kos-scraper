import { chromium } from "playwright-core";

/** Launch system Chrome/Edge/Chromium headless with Indonesian locale. */
export async function launchSystemBrowser({ lang = "id-ID", extraArgs = [] } = {}) {
  const channels = process.platform === "win32" ? ["chrome", "msedge"] : ["chrome", "chromium"];
  let lastErr = null;
  for (const channel of channels) {
    try {
      return await chromium.launch({
        channel,
        headless: true,
        args: [`--lang=${lang}`, ...extraArgs],
      });
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("No local Chrome/Edge browser available for playwright-core");
}

