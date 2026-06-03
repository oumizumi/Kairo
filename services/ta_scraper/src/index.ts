import dotenv from 'dotenv';
dotenv.config();

import cron from 'node-cron';
import { initDb, upsertPosition } from './db';
import { scrapeAllTaPositions } from './scraper';

async function runScraper(): Promise<void> {
  console.log(`\n[${new Date().toISOString()}] Starting TA scrape run...`);
  try {
    const positions = await scrapeAllTaPositions();

    let upserted = 0;
    for (const pos of positions) {
      await upsertPosition(pos);
      upserted++;
    }

    console.log(`Upserted ${upserted} record(s) into ta_positions.`);
  } catch (err) {
    console.error('Scraper run failed:', err);
  }
}

async function main(): Promise<void> {
  // Initialise DB (creates table if needed)
  await initDb();

  // --once flag: run once and exit (useful for CI / manual triggers)
  if (process.argv.includes('--once')) {
    await runScraper();
    return;
  }

  // Run immediately on startup, then on cron
  await runScraper();

  // Every day at midnight UTC
  cron.schedule('0 0 * * *', runScraper, { timezone: 'UTC' });
  console.log('\nCron job scheduled — next run at 00:00 UTC.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
