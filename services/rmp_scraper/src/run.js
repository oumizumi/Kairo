const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require('fs');
const Papa = require('papaparse');

puppeteer.use(StealthPlugin());

const waitTime = 300;
const csvPath = './names.csv';

const fileContent = fs.readFileSync(csvPath, 'utf8');
const parsed = Papa.parse(fileContent, { header: true, dynamicTyping: false, skipEmptyLines: true });

// Resume support: skip names that already have a non-empty, non-"Not Found" ID
const rows = parsed.data;
const idMap = {};
for (const row of rows) {
  if (row.ID && row.ID !== 'Not Found' && row.ID !== 'Error') {
    idMap[row.Name] = row.ID;
  }
}

const namesArray = rows.map(r => r.Name);
const idArray = rows.map(r => (r.ID && r.ID !== '') ? r.ID : null);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function saveCSV() {
  const updatedData = namesArray.map((name, i) => ({ Name: name, ID: idArray[i] || 'Not Found' }));
  fs.writeFileSync(csvPath, Papa.unparse(updatedData));
}

async function findProfessorID(universityName) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.goto("https://www.ratemyprofessors.com/login", { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    await page.type('input[name="email"]', 'ofgharad@gmail.com', { delay: 80 });
    await page.type('input[name="password"]', 'Ou#17mer*05', { delay: 80 });
    await page.keyboard.press('Enter');
    await sleep(3000);
    console.log('Logged in');

    for (let i = 0; i < namesArray.length; i++) {
      const name = namesArray[i];

      // Skip already-processed entries
      if (idArray[i] && idArray[i] !== 'Not Found' && idArray[i] !== 'Error') {
        console.log(`[${i + 1}/${namesArray.length}] Skipping (already have ID ${idArray[i]}): ${name}`);
        continue;
      }

      console.log(`[${i + 1}/${namesArray.length}] Searching: ${name}`);

      const searchUrl = `https://www.ratemyprofessors.com/search/professors?q=${encodeURIComponent(name + ' ' + universityName)}`;

      try {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      } catch (navErr) {
        console.log(`  -> Navigation failed for ${name}: ${navErr.message}`);
        idArray[i] = 'Not Found';
        if (i % 10 === 0) saveCSV();
        continue;
      }

      await sleep(waitTime);

      try {
        const [element] = await page.$$('::-p-xpath(//*[contains(text(), "QUALITY")])');
        if (element) {
          const boundingBox = await element.boundingBox();
          if (boundingBox) {
            await page.mouse.click(boundingBox.x + boundingBox.width / 2, boundingBox.y + boundingBox.height / 2);
            await sleep(800);
          }
        } else {
          console.log(`  -> No results for: ${name}`);
        }
      } catch (err) {
        console.log(`  -> Click error for ${name}: ${err.message}`);
      }

      const url = page.url();
      const match = url.match(/(\d+)$/);
      if (match) {
        idArray[i] = match[0];
        console.log(`  -> ID: ${match[0]}`);
      } else {
        idArray[i] = 'Not Found';
        console.log(`  -> Not found (url: ${url})`);
      }

      // Save progress every 10 professors
      if (i % 10 === 0) saveCSV();
    }

  } finally {
    saveCSV();
    console.log('Saved to CSV.');
    await browser.close();
  }
}

findProfessorID("University of Ottawa");
