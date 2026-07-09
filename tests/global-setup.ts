import { request, FullConfig } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fork } from "child_process";
import dotenv from "dotenv";
import { fetchAndParseSitemap } from "../utils/network";
import { defaultConfig } from "../config/page-validation.config";

// Load environment variables with override enabled
const envPath = path.resolve(__dirname, "..", ".env");
const dotenvResult = dotenv.config({ path: envPath, override: true });
if (dotenvResult.error) {
  console.error(`[Global Setup] Failed to load .env from ${envPath}:`, dotenvResult.error);
} else {
  console.log(`[Global Setup] Successfully loaded .env from ${envPath}:`, dotenvResult.parsed);
}

async function globalSetup(config: FullConfig) {
  // Determine BASE_URL based on POD environment variable
  const pod = (process.env.POD || 'stage').toLowerCase();
  let baseURL = process.env.BASE_URL || "http://localhost:3001";
  
  if (pod === 'prod') {
    baseURL = 'https://www.edx.org/';
  } else if (pod === 'stage') {
    baseURL = 'https://odyssey.stage.edx.org/';
  }
  // If local or custom URL is set, use that instead
  if (process.env.BASE_URL && (process.env.BASE_URL.includes('localhost') || process.env.BASE_URL.includes('127.0.0.1'))) {
    baseURL = process.env.BASE_URL;
  }
  
  process.env.BASE_URL = baseURL; // Update environment variable for tests to use
  
  const useSitemap = process.env.USE_SITEMAP === "true";

  console.log(`[Global Setup] Started. POD=${pod}, BASE_URL=${baseURL}, USE_SITEMAP=${useSitemap}`);

  if (useSitemap) {
    let mockProcess: any = null;

    // Start mock server if testing locally and it is not already running
    const isLocal = baseURL.includes("localhost") || baseURL.includes("127.0.0.1");
    if (isLocal) {
      console.log("[Global Setup] Starting temporary mock server to fetch sitemap...");
      const mockServerPath = path.resolve(__dirname, "mock-server.js");
      mockProcess = fork(mockServerPath, [], {
        env: { ...process.env, PORT: "3001" },
        silent: true,
      });

      // Wait 1.5 seconds for the mock server to start
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    console.log(`[Global Setup] Fetching sitemap from ${baseURL}${defaultConfig.sitemapPath}...`);
    const requestContext = await request.newContext({ baseURL });
    try {
      const paths = await fetchAndParseSitemap(requestContext, defaultConfig.sitemapPath, baseURL);
      const targetPath = path.resolve(__dirname, "..", "config", "sitemap-urls.json");
      
      const configDir = path.dirname(targetPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(targetPath, JSON.stringify(paths, null, 2), "utf8");
      console.log(`[Global Setup] Wrote ${paths.length} sitemap URLs to ${targetPath}`);
    } catch (err) {
      console.error("[Global Setup] Failed to fetch sitemap:", err);
    } finally {
      await requestContext.dispose();
      if (mockProcess) {
        console.log("[Global Setup] Shutting down temporary mock server...");
        mockProcess.kill();
      }
    }
  }
}

export default globalSetup;
