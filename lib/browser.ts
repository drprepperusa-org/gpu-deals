/**
 * Shared browser instance.
 * - Local: uses installed Chrome
 * - Vercel: uses @sparticuz/chromium (serverless)
 */

type PuppeteerBrowser = Awaited<ReturnType<typeof import('puppeteer-core').launch>>;
let browserInstance: PuppeteerBrowser | null = null;

const LOCAL_CHROME_PATHS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  process.env.CHROME_PATH || '',
].filter(Boolean);

export async function getBrowser(): Promise<PuppeteerBrowser> {
  if (browserInstance && browserInstance.connected) return browserInstance;

  const puppeteer = await import('puppeteer-core');

  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    // Serverless: use @sparticuz/chromium
    const chromium = (await import('@sparticuz/chromium')).default;
    browserInstance = await puppeteer.default.launch({
      args: chromium.args,
      defaultViewport: { width: 1920, height: 1080 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  } else {
    // Local: use installed Chrome
    const fs = await import('fs');
    let execPath = '';
    for (const p of LOCAL_CHROME_PATHS) {
      if (fs.existsSync(p)) { execPath = p; break; }
    }
    if (!execPath) throw new Error('Chrome not found. Set CHROME_PATH in .env');

    browserInstance = await puppeteer.default.launch({
      executablePath: execPath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    });
  }

  return browserInstance;
}

export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }
}
