import 'server-only';
import { FIT_SCALE, renderBriefHtml, type BriefDoc } from './template';
import { briefAssets } from './load';

/**
 * Prints the brief to an A4 PDF (page 1 overview, extra pages for a long playlist) with headless Chromium.
 * On Vercel the serverless build of Chromium is used; locally set CHROMIUM_PATH.
 */
export async function renderBriefPdf(doc: BriefDoc): Promise<Uint8Array> {
  const puppeteer = (await import('puppeteer-core')).default;
  let executablePath = process.env.CHROMIUM_PATH;
  let args = ['--no-sandbox', '--disable-gpu'];
  if (!executablePath) {
    const chromium = (await import('@sparticuz/chromium')).default;
    executablePath = await chromium.executablePath();
    args = chromium.args;
  }
  const browser = await puppeteer.launch({ executablePath, args, headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(renderBriefHtml(doc, briefAssets()), { waitUntil: 'load' });
    await page.evaluateHandle('document.fonts.ready');
    const scale = Number(await page.evaluate(FIT_SCALE)) || 1;
    return await page.pdf({ format: 'A4', printBackground: true, scale });
  } finally {
    await browser.close();
  }
}
