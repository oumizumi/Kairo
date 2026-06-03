import puppeteer from 'puppeteer';

const BASE_URL = 'https://uocampus.public.uottawa.ca/psp/csprpr9pub/EMPLOYEE/SA/c/UO_SR_AA_MODS.UO_PUB_CLSSRCH.GBL?languageCd=ENG';

async function checkTerms() {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();

    console.log('Navigating to uOttawa class search...');
    for (let attempt = 1; attempt <= 3; attempt++) {
        await page.goto(BASE_URL, { waitUntil: 'load', timeout: 45000 });
        if (!page.url().includes('about:blank')) break;
        console.log(`about:blank on attempt ${attempt}, retrying...`);
        await new Promise(r => setTimeout(r, 1500));
    }
    console.log('Landed at:', page.url());

    await new Promise(r => setTimeout(r, 2000));

    // Check all frames
    const frames = [page.mainFrame(), ...page.frames()];
    for (const frame of frames) {
        const select = await frame.$('select[name="CLASS_SRCH_WRK2_STRM$35$"]');
        if (!select) continue;

        const options = await frame.evaluate(() => {
            const sel = document.querySelector('select[name="CLASS_SRCH_WRK2_STRM$35$"]') as HTMLSelectElement;
            if (!sel) return [];
            return Array.from(sel.options).map(o => ({ value: o.value, text: o.text.trim() }));
        });

        console.log('\n✅ Found term dropdown! Available terms:');
        for (const opt of options) {
            console.log(`  value="${opt.value}"  →  "${opt.text}"`);
        }
        break;
    }

    await browser.close();
}

checkTerms().catch(console.error);
