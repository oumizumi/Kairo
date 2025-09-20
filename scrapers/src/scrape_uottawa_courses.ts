import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs-extra';
import * as path from 'path';

// Course data interface
interface UOttawaCourse {
    courseCode: string;        // e.g., "ITI 1100"
    courseTitle: string;       // e.g., "Digital Systems I"
    section: string;           // e.g., "Z01-LEC"
    days: string[];            // e.g., ["Tu", "Fr"]
    time: string;              // e.g., "Tu 11:30 - 12:50, Fr 13:00 - 14:20"
    instructor: string;        // e.g., "Mohammad Al Ridhawi" or "Staff"
    meetingDates: string;      // e.g., "2025-05-05 - 2025-07-25"
    meetingStartDate: string;  // e.g., "2025-05-05"
    meetingEndDate: string;    // e.g., "2025-07-25"
    status: 'Open' | 'Closed' | 'Waitlist' | 'Unknown';
    term: string;              // e.g., "2025 Fall Term"
    subjectCode: string;       // e.g., "ITI"
}

// New structured interfaces for grouped course data
interface Section {
    section: string;           // e.g., "A01-LAB"
    days: string[];           // e.g., ["Tu"]
    time: string;             // e.g., "Tu 10:00 - 11:20"
    instructor: string;       // e.g., "Lucia Moura"
    meetingDates: string;     // e.g., "2025-09-03 - 2025-12-02"
    meetingStartDate: string; // e.g., "2025-09-03"
    meetingEndDate: string;   // e.g., "2025-12-02"
    status: 'Open' | 'Closed' | 'Waitlist' | 'Unknown';
}

interface SectionGroup {
    groupId: string;          // e.g., "A"
    lecture?: Section;        // Main lecture for this group
    labs: Section[];          // Lab sections for this group
    tutorials: Section[];     // Tutorial sections for this group
}

interface GroupedCourse {
    courseCode: string;       // e.g., "CSI 2110"
    courseTitle: string;      // e.g., "Data Structures and Algorithms"
    subjectCode: string;      // e.g., "CSI"
    term: string;             // e.g., "2025 Fall Term"
    sectionGroups: {          // Organized by group letter
        [groupId: string]: SectionGroup;
    };
}

interface GroupedCourseData {
    courses: GroupedCourse[];
}

// Search parameters interface
interface SearchParams {
    term: string;
    subjectCode?: string;
    courseNumber?: string;
    openClassesOnly?: boolean;
}

// Term mappings
const TERM_MAPPINGS = {
    '2025 Fall Term': '2259',
    '2026 Winter Term': '2261'
};

// All available subject codes from uOttawa
const SUBJECT_CODES = [
    'ACP', 'ADM', 'AFR', 'AHL', 'ALG', 'AMM', 'AMT', 'ANA', 'ANE', 'ANP', 'ANT', 'APA', 'API', 'ARB', 'ART', 'ASE', 'ASI',
    'BCH', 'BIL', 'BIM', 'BMG', 'BML', 'BNF', 'BPS',
    'CDN', 'CEG', 'CHG', 'CHM', 'CHN', 'CIN', 'CLA', 'CLI', 'CLT', 'CML', 'CMN', 'CMM', 'CPL', 'CPT', 'CRM', 'CSI', 'CTS',
    'DCN', 'DCC', 'DCL', 'DLS', 'DRC', 'DSS', 'DTI', 'DVM',
    'EAS', 'ECH', 'ECO', 'EDA', 'EDU', 'EED', 'EEL', 'EER', 'EES', 'EFR', 'EKO', 'ELA', 'ELE', 'ELG', 'EMP', 'ENG', 'ENV', 'EPI', 'ERG', 'ESP', 'ESL', 'EVG', 'EVS', 'EVD',
    'FAM', 'FEM', 'FLS', 'FRA', 'FRE', 'FSS',
    'GAE', 'GEG', 'GEO', 'GLO', 'GNG', 'GRT', 'GSU',
    'HAH', 'HIS', 'HMG', 'HSS',
    'IAI', 'ILA', 'IMM', 'INR', 'ISP', 'ISI', 'ITA', 'ITI',
    'JCS', 'JOU', 'JPN',
    'LCL', 'LCM', 'LIN', 'LLM', 'LSR',
    'MAT', 'MBA', 'MCG', 'MDV', 'MED', 'MGT', 'MHA', 'MHS', 'MIC', 'MKT', 'MRP', 'MUS',
    'NAP', 'NOT', 'NSC', 'NSG', 'NUT',
    'OBG', 'OMT', 'OPH', 'ORA', 'ORT',
    'PAE', 'PAP', 'PCS', 'PCT', 'PED', 'PHA', 'PHI', 'PHR', 'PHY', 'PHS', 'PHT', 'PLN', 'POL', 'POP', 'POR', 'PIP', 'PME', 'PSY',
    'RAD', 'RCH', 'REA', 'RUS',
    'SAI', 'SCI', 'SCS', 'SEC', 'SED', 'SEG', 'SOC', 'SRS', 'SSP', 'SSS', 'SYS',
    'THE', 'THD', 'THM', 'TMM', 'TOX', 'TRA', 'TSO',
    'URO',
    'YDD'
];

class UOttawaCourseScraper {
    private baseUrl = 'https://uocampus.public.uottawa.ca/psp/csprpr9pub/EMPLOYEE/SA/c/UO_SR_AA_MODS.UO_PUB_CLSSRCH.GBL?languageCd=ENG';
    private browser: Browser | null = null;
    private page: Page | null = null;
    private workingSelectors: any = null;

    /**
     * Parse meeting dates string into start and end dates
     * @param meetingDates - String like "2025-05-05 - 2025-07-25"
     * @returns Object with meetingStartDate and meetingEndDate
     */
    private parseMeetingDates(meetingDates: string): { meetingStartDate: string; meetingEndDate: string } {
        if (!meetingDates || meetingDates === 'TBD' || meetingDates === 'N/A') {
            return { meetingStartDate: 'TBD', meetingEndDate: 'TBD' };
        }

        // Match pattern like "2025-05-05 - 2025-07-25"
        const dateRangeMatch = meetingDates.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);

        if (dateRangeMatch) {
            return {
                meetingStartDate: dateRangeMatch[1],
                meetingEndDate: dateRangeMatch[2]
            };
        }

        // If no range found, try to extract a single date
        const singleDateMatch = meetingDates.match(/(\d{4}-\d{2}-\d{2})/);
        if (singleDateMatch) {
            return {
                meetingStartDate: singleDateMatch[1],
                meetingEndDate: singleDateMatch[1]
            };
        }

        // Fallback
        return { meetingStartDate: 'TBD', meetingEndDate: 'TBD' };
    }

    /**
     * Initialize the scraper with browser setup
     */
    async initialize(): Promise<void> {
        console.log(' Initializing uOttawa Course Scraper...');

        this.browser = await puppeteer.launch({
            headless: false, // Keep visible so you can see the scraping
            defaultViewport: { width: 1920, height: 1080 },
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        this.page = await this.browser.newPage();

        // Set user agent to avoid detection
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log('✅ Scraper initialized successfully');
    }

    /**
     * Clean up resources
     */
    async cleanup(): Promise<void> {
        if (this.page) {
            await this.page.close();
        }
        if (this.browser) {
            await this.browser.close();
        }
        console.log(' Cleanup completed');
    }

    /**
     * Helper to get the working frame (the one with the form/results)
     */
    private async getWorkingFrame(): Promise<any> {
        if (!this.page) throw new Error('Page not initialized');

        console.log(' Looking for working frame...');
        const frames = this.page.frames();
        console.log(`Found ${frames.length} frames on the page`);

        // Wait a bit for the page to fully load
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Try multiple possible selectors for form elements
        const possibleSelectors = {
            termSelect: [
                'select[name="CLASS_SRCH_WRK2_STRM$35$"]',
                'select[name*="STRM"]',
                'select[id*="STRM"]',
                'select[name*="term"]',
                'select[id*="term"]'
            ],
            subjectInput: [
                'input[name="SSR_CLSRCH_WRK_SUBJECT$0"]',
                'input[name*="SUBJECT"]',
                'input[id*="SUBJECT"]',
                'input[name*="subject"]',
                'input[id*="subject"]'
            ],
            searchButton: [
                'a[name="CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH"]',
                'a[name*="CLASS_SRCH"]',
                'a[id*="CLASS_SRCH"]',
                'input[type="submit"]',
                'button[type="submit"]',
                'a:contains("Search")',
                'button:contains("Search")'
            ]
        };

        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            console.log(`Frame ${i}: ${frame.url()}`);

            // Try to find form elements with multiple selector strategies
            for (const termSelector of possibleSelectors.termSelect) {
                for (const subjectSelector of possibleSelectors.subjectInput) {
                    for (const searchSelector of possibleSelectors.searchButton) {
                        try {
                            const termSelect = await frame.$(termSelector);
                            const subjectInput = await frame.$(subjectSelector);
                            const searchButton = await frame.$(searchSelector);

                            if (termSelect || subjectInput || searchButton) {
                                console.log(`✅ Found form elements in frame ${i} with selectors:`);
                                console.log(`   Term: ${termSelector} - ${termSelect ? 'Found' : 'Not found'}`);
                                console.log(`   Subject: ${subjectSelector} - ${subjectInput ? 'Found' : 'Not found'}`);
                                console.log(`   Search: ${searchSelector} - ${searchButton ? 'Found' : 'Not found'}`);

                                // Store the working selectors for later use
                                this.workingSelectors = {
                                    termSelect: termSelector,
                                    subjectInput: subjectSelector,
                                    searchButton: searchSelector
                                };

                                return frame;
                            }
                        } catch (error) {
                            // Continue trying other selectors
                            continue;
                        }
                    }
                }
            }
        }

        // If no frame has the elements, try the main page with the same strategy
        console.log('🔍 Trying main page for form elements...');

        for (const termSelector of possibleSelectors.termSelect) {
            for (const subjectSelector of possibleSelectors.subjectInput) {
                for (const searchSelector of possibleSelectors.searchButton) {
                    try {
                        const termSelect = await this.page.$(termSelector);
                        const subjectInput = await this.page.$(subjectSelector);
                        const searchButton = await this.page.$(searchSelector);

                        if (termSelect || subjectInput || searchButton) {
                            console.log(`✅ Found form elements on main page with selectors:`);
                            console.log(`   Term: ${termSelector} - ${termSelect ? 'Found' : 'Not found'}`);
                            console.log(`   Subject: ${subjectSelector} - ${subjectInput ? 'Found' : 'Not found'}`);
                            console.log(`   Search: ${searchSelector} - ${searchButton ? 'Found' : 'Not found'}`);

                            // Store the working selectors for later use
                            this.workingSelectors = {
                                termSelect: termSelector,
                                subjectInput: subjectSelector,
                                searchButton: searchSelector
                            };

                            return this.page;
                        }
                    } catch (error) {
                        // Continue trying other selectors
                        continue;
                    }
                }
            }
        }

        // If still no elements found, let's debug what's actually on the page
        console.log('🔍 Debugging: No form elements found, analyzing page structure...');

        const pageContent = await this.page.evaluate(() => {
            const allSelects = Array.from(document.querySelectorAll('select')).map(select => ({
                name: select.getAttribute('name'),
                id: select.getAttribute('id'),
                className: select.getAttribute('class'),
                options: Array.from(select.options).map(opt => ({ value: opt.value, text: opt.text }))
            }));

            const allInputs = Array.from(document.querySelectorAll('input')).map(input => ({
                name: input.getAttribute('name'),
                id: input.getAttribute('id'),
                type: input.getAttribute('type'),
                className: input.getAttribute('class'),
                placeholder: input.getAttribute('placeholder')
            }));

            const allButtons = Array.from(document.querySelectorAll('button, a')).map(btn => ({
                name: btn.getAttribute('name'),
                id: btn.getAttribute('id'),
                type: btn.getAttribute('type'),
                className: btn.getAttribute('class'),
                text: btn.textContent?.trim(),
                tagName: btn.tagName
            }));

            return { allSelects, allInputs, allButtons };
        });

        console.log('📋 Available select elements:', pageContent.allSelects);
        console.log('📋 Available input elements:', pageContent.allInputs);
        console.log('📋 Available button elements:', pageContent.allButtons);

        throw new Error('Could not find working frame - website structure may have changed');
    }

    /**
     * Main search function (updated to handle 300-section error)
     */
    async searchCourses(params: SearchParams): Promise<UOttawaCourse[]> {
        try {
            console.log(`🔍 Searching uOttawa courses: ${params.subjectCode || 'All subjects'} for ${params.term}`);

            if (!this.page) {
                throw new Error('Scraper not initialized. Call initialize() first.');
            }

            // Navigate to the course search page
            await this.page.goto(this.baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            console.log('📍 Navigated to uOttawa course search page');

            // Get the working frame
            const frame = await this.getWorkingFrame();

            // Fill out the search form in the frame
            await this.fillFormInFrame(frame, params);

            // Submit the search in the frame
            await this.submitSearchInFrame(frame);

            // Wait a bit for page to load
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Check for 300-section error FIRST before waiting for results
            const has300SectionError = await frame.evaluate(() => {
                return document.body.innerText.includes('Your search will exceed the maximum limit of 300 sections');
            });

            if (has300SectionError) {
                // 300-section error - do split search
                console.log(`⚠️ 300-section error detected for ${params.subjectCode || 'all subjects'}. Splitting search...`);

                // First search: courses ≤ 3000
                console.log(`🔍 Running first search for ${params.subjectCode}: courses ≤ 3000`);

                // Reload the page to get fresh form
                await this.page.goto(this.baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                const frame1 = await this.getWorkingFrame();

                // Fill form with course number ≤ 3000
                await this.fillFormInFrame(frame1, params);

                console.log('📝 Setting dropdown to "less than or equal to" (T)...');
                await frame1.select('select[name="SSR_CLSRCH_WRK_SSR_EXACT_MATCH1$0"]', 'T'); // Less than or equal to
                console.log('✅ Dropdown set successfully');
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for dropdown to process

                console.log('📝 Clearing and entering course number: 3000...');
                await frame1.click('input[name="SSR_CLSRCH_WRK_CATALOG_NBR$0"]', { clickCount: 3 }); // Select all text
                await frame1.type('input[name="SSR_CLSRCH_WRK_CATALOG_NBR$0"]', '3000');
                console.log('✅ Course number entered successfully');
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for input to process

                console.log('🔍 Submitting split search 1 (≤3000)...');
                await this.submitSearchInFrame(frame1);
                await frame1.waitForSelector('table, .PSLEVEL1GRID, .PSLEVEL1GRIDNBONBO, tr[bgcolor], tr:has(.PSEDITBOX_DISPONLY), tr:has(.PABOLDTEXT)', { timeout: 30000 });
                const results1 = await this.extractCourseResultsFromFrame(frame1, { ...params, courseNumber: '≤3000' });

                // Second search: courses ≥ 3001
                console.log(`🔍 Running second search for ${params.subjectCode}: courses ≥ 3001`);

                // Reload the page again for fresh form
                await this.page.goto(this.baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                const frame2 = await this.getWorkingFrame();

                // Fill form with course number ≥ 3001
                await this.fillFormInFrame(frame2, params);

                console.log('📝 Setting dropdown to "greater than or equal to" (G)...');
                await frame2.select('select[name="SSR_CLSRCH_WRK_SSR_EXACT_MATCH1$0"]', 'G'); // Greater than or equal to
                console.log('✅ Dropdown set successfully');
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for dropdown to process

                console.log('📝 Clearing and entering course number: 3001...');
                await frame2.click('input[name="SSR_CLSRCH_WRK_CATALOG_NBR$0"]', { clickCount: 3 }); // Select all text
                await frame2.type('input[name="SSR_CLSRCH_WRK_CATALOG_NBR$0"]', '3001');
                console.log('✅ Course number entered successfully');
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for input to process

                console.log('🔍 Submitting split search 2 (≥3001)...');
                await this.submitSearchInFrame(frame2);
                await frame2.waitForSelector('table, .PSLEVEL1GRID, .PSLEVEL1GRIDNBONBO, tr[bgcolor], tr:has(.PSEDITBOX_DISPONLY), tr:has(.PABOLDTEXT)', { timeout: 30000 });
                const results2 = await this.extractCourseResultsFromFrame(frame2, { ...params, courseNumber: '≥3001' });

                // Merge and deduplicate results
                const allResults = [...results1, ...results2];
                const seen = new Set();
                const deduped = allResults.filter((course) => {
                    const key = `${course.courseCode}|${course.section}|${course.time}|${course.instructor}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });

                console.log(`✅ Found ${deduped.length} courses for ${params.subjectCode || 'all subjects'} (split search: ${results1.length} + ${results2.length} = ${allResults.length}, deduplicated to ${deduped.length})`);
                console.log(`🔄 Split search completed for ${params.subjectCode}, returning results...`);
                return deduped;
            } else {
                // No error - wait for results and extract normally
                await frame.waitForSelector('table, .PSLEVEL1GRID, .PSLEVEL1GRIDNBONBO, tr[bgcolor], tr:has(.PSEDITBOX_DISPONLY), tr:has(.PABOLDTEXT)', { timeout: 30000 });

                // Extract course results from the frame
                const courses = await this.extractCourseResultsFromFrame(frame, params);

                console.log(`✅ Found ${courses.length} courses for ${params.subjectCode || 'all subjects'}`);
                return courses;
            }

        } catch (error) {
            console.error('❌ Error during course search:', error);
            throw error;
        }
    }

    /**
     * Fill out the search form with provided parameters
     */
    private async fillSearchForm(params: SearchParams): Promise<void> {
        if (!this.page) throw new Error('Page not initialized');

        console.log('📝 Filling search form...');

        // Debug: Check what's actually on the page
        console.log('🔍 Debugging page structure...');
        const pageContent = await this.page.content();
        console.log('📄 Page title:', await this.page.title());

        // Check for iframes
        const frames = this.page.frames();
        console.log(`🖼️ Found ${frames.length} frames on the page`);

        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            console.log(`Frame ${i}: ${frame.url()}`);

            // Check if this frame has our form elements
            const termSelect = await frame.$('select[name="CLASS_SRCH_WRK2_STRM$35$"]');
            const subjectInput = await frame.$('input[name="SSR_CLSRCH_WRK_SUBJECT$0"]');
            const searchButton = await frame.$('a[name="CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH"]');

            if (termSelect || subjectInput || searchButton) {
                console.log(`✅ Found form elements in frame ${i}`);

                // Use this frame for form operations
                await this.fillFormInFrame(frame, params);
                return;
            }
        }

        // If no frame has the elements, try the main page
        console.log('🔍 Trying main page for form elements...');

        // List all select elements on the page
        const allSelects = await this.page.$$eval('select', selects =>
            selects.map(select => ({
                name: select.getAttribute('name'),
                id: select.getAttribute('id'),
                options: Array.from(select.options).map(opt => ({ value: opt.value, text: opt.text }))
            }))
        );

        console.log('📋 All select elements found:', allSelects);

        // List all input elements
        const allInputs = await this.page.$$eval('input', inputs =>
            inputs.map(input => ({
                name: input.getAttribute('name'),
                id: input.getAttribute('id'),
                type: input.getAttribute('type'),
                placeholder: input.getAttribute('placeholder')
            }))
        );

        console.log('📋 All input elements found:', allInputs);

        // List all anchor elements
        const allAnchors = await this.page.$$eval('a', anchors =>
            anchors.map(anchor => ({
                name: anchor.getAttribute('name'),
                id: anchor.getAttribute('id'),
                text: anchor.textContent?.trim(),
                onclick: anchor.getAttribute('onclick')
            }))
        );

        console.log('📋 All anchor elements found:', allAnchors);

        throw new Error('Could not find form elements in any frame or on main page');
    }

    /**
     * Fill form in a specific frame
     */
    private async fillFormInFrame(frame: any, params: SearchParams): Promise<void> {
        console.log('📝 Filling form in frame...');

        // Use the working selectors that were found
        const selectors = this.workingSelectors || {
            termSelect: 'select[name="CLASS_SRCH_WRK2_STRM$35$"]',
            subjectInput: 'input[name="SSR_CLSRCH_WRK_SUBJECT$0"]',
            searchButton: 'a[name="CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH"]'
        };

        // Step 1: Select Term
        const termValue = TERM_MAPPINGS[params.term as keyof typeof TERM_MAPPINGS];
        if (!termValue) {
            throw new Error(`Invalid term: ${params.term}. Available terms: ${Object.keys(TERM_MAPPINGS).join(', ')}`);
        }

        console.log(`📅 Selecting term: ${params.term} (value: ${termValue})`);

        try {
            await frame.select(selectors.termSelect, termValue);
            console.log('✅ Term selected successfully');
        } catch (error) {
            console.log(`⚠️ Could not select term with selector ${selectors.termSelect}, trying alternative approach...`);

            // Try to find the term select element and click through options
            const termSelect = await frame.$(selectors.termSelect);
            if (termSelect) {
                await termSelect.click();
                await new Promise(resolve => setTimeout(resolve, 500));

                // Try to find and click the option with the correct value
                const option = await frame.$(`option[value="${termValue}"]`);
                if (option) {
                    await option.click();
                    console.log('✅ Term selected via option click');
                } else {
                    console.log(`⚠️ Could not find option with value ${termValue}`);
                }
            } else {
                console.log(`⚠️ Could not find term select element with selector ${selectors.termSelect}`);
            }
        }

        // Wait for form to update
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Step 1.5: UNCHECK "Open Classes Only" checkbox to get both open and closed sections
        console.log('🔓 Unchecking "Open Classes Only" checkbox...');
        try {
            const openOnlyCheckbox = await frame.$('input[name="SSR_CLSRCH_WRK_SSR_OPEN_ONLY$0"]');
            if (openOnlyCheckbox) {
                const isChecked = await frame.evaluate((checkbox: HTMLInputElement) => checkbox.checked, openOnlyCheckbox);
                if (isChecked) {
                    await openOnlyCheckbox.click();
                    console.log('✅ "Open Classes Only" checkbox unchecked successfully');
                } else {
                    console.log('ℹ️ "Open Classes Only" checkbox was already unchecked');
                }
            } else {
                console.log('⚠️ Could not find "Open Classes Only" checkbox');
            }
        } catch (error) {
            console.log('⚠️ Error unchecking "Open Classes Only" checkbox:', error);
        }

        // Wait for checkbox change to be processed
        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 2: Enter Subject Code (if provided)
        if (params.subjectCode) {
            console.log(`📚 Entering subject code: ${params.subjectCode}`);

            try {
                // Clear the field first
                await frame.click(selectors.subjectInput, { clickCount: 3 });
                await frame.type(selectors.subjectInput, params.subjectCode);
                console.log('✅ Subject code entered successfully');
            } catch (error) {
                console.log(`⚠️ Could not enter subject code with selector ${selectors.subjectInput}, trying alternative approach...`);

                // Try alternative input methods
                const subjectInput = await frame.$(selectors.subjectInput);
                if (subjectInput) {
                    await subjectInput.focus();
                    await subjectInput.type(params.subjectCode);
                    console.log('✅ Subject code entered via focus and type');
                } else {
                    console.log(`⚠️ Could not find subject input element with selector ${selectors.subjectInput}`);
                }
            }

            // Wait for input to be processed
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Step 3: Enter Course Number (if provided)
        if (params.courseNumber) {
            console.log(`🔢 Entering course number: ${params.courseNumber}`);

            // Try to find course number input field
            const courseNumberSelectors = [
                'input[name="SSR_CLSRCH_WRK_CATALOG_NBR$0"]',
                'input[name*="CATALOG_NBR"]',
                'input[id*="CATALOG_NBR"]',
                'input[name*="course"]',
                'input[id*="course"]'
            ];

            let courseInputFound = false;
            for (const courseSelector of courseNumberSelectors) {
                try {
                    const courseInput = await frame.$(courseSelector);
                    if (courseInput) {
                        await courseInput.click({ clickCount: 3 });
                        await courseInput.type(params.courseNumber);
                        console.log(`✅ Course number entered with selector ${courseSelector}`);
                        courseInputFound = true;
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }

            if (!courseInputFound) {
                console.log('⚠️ Could not find course number input field');
            }
        }

        console.log('✅ Search form filled successfully');
    }

    /**
     * Submit the search form in a specific frame
     */
    private async submitSearchInFrame(frame: any): Promise<void> {
        console.log('🔍 Submitting search in frame...');

        // Use the working selectors that were found
        const selectors = this.workingSelectors || {
            termSelect: 'select[name="CLASS_SRCH_WRK2_STRM$35$"]',
            subjectInput: 'input[name="SSR_CLSRCH_WRK_SUBJECT$0"]',
            searchButton: 'a[name="CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH"]'
        };

        // Try multiple strategies to find and click the search button
        const searchButtonSelectors = [
            selectors.searchButton,
            'a[name*="CLASS_SRCH"]',
            'a[id*="CLASS_SRCH"]',
            'input[type="submit"]',
            'button[type="submit"]',
            'input[value*="Search"]',
            'button:contains("Search")',
            'a:contains("Search")',
            'input[value*="search"]',
            'button:contains("search")',
            'a:contains("search")'
        ];

        let searchButtonFound = false;
        for (const buttonSelector of searchButtonSelectors) {
            try {
                const searchButton = await frame.$(buttonSelector);
                if (searchButton) {
                    console.log(`✅ Found search button with selector: ${buttonSelector}`);

                    // Try to click the button
                    try {
                        await searchButton.click();
                        console.log('✅ Search button clicked successfully');
                        searchButtonFound = true;
                        break;
                    } catch (clickError) {
                        console.log(`⚠️ Could not click button with selector ${buttonSelector}, trying alternative...`);

                        // Try alternative click methods
                        try {
                            await frame.evaluate((selector: string) => {
                                const button = document.querySelector(selector) as HTMLElement;
                                if (button) {
                                    button.click();
                                    return true;
                                }
                                return false;
                            }, buttonSelector);
                            console.log('✅ Search button clicked via evaluate');
                            searchButtonFound = true;
                            break;
                        } catch (evalError) {
                            console.log(`⚠️ Could not click via evaluate with selector ${buttonSelector}`);
                            continue;
                        }
                    }
                }
            } catch (error) {
                continue;
            }
        }

        if (!searchButtonFound) {
            console.log('❌ Search button not found!');

            // List all anchor elements to find the correct search button
            const anchors = await frame.evaluate(() => {
                return Array.from(document.querySelectorAll('a, button, input[type="submit"]')).map(anchor => ({
                    name: anchor.getAttribute('name'),
                    id: anchor.getAttribute('id'),
                    text: anchor.textContent?.trim() || anchor.getAttribute('value') || '',
                    onclick: anchor.getAttribute('onclick'),
                    tagName: anchor.tagName,
                    type: anchor.getAttribute('type')
                }));
            });
            console.log('📋 Available button elements:', anchors);

            // Try to find any element that might be a search button
            for (const anchor of anchors) {
                if (anchor.text.toLowerCase().includes('search') ||
                    anchor.name?.toLowerCase().includes('search') ||
                    anchor.id?.toLowerCase().includes('search')) {
                    console.log(`🔍 Potential search button found: ${anchor.tagName} - ${anchor.text} (name: ${anchor.name}, id: ${anchor.id})`);
                }
            }

            throw new Error('Search button not found');
        }

        // Wait for some loading indicator or a short delay
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('✅ Search submitted in frame');
    }

    /**
     * Extract course results from the results page in a frame
     */
    private async extractCourseResultsFromFrame(frame: any, params: SearchParams): Promise<UOttawaCourse[]> {
        console.log('📋 Extracting course results from frame...');

        // Wait for results to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Debug: Check what's actually on the page
        console.log('🔍 Debugging page content...');
        const pageContent = await frame.evaluate(() => {
            const bodyText = document.body.innerText;
            const tables = Array.from(document.querySelectorAll('table'));
            const tableInfo = tables.map((table, index) => ({
                index,
                rows: table.querySelectorAll('tr').length,
                hasCourseData: table.innerText.includes('Section') || table.innerText.includes('Days') || table.innerText.includes('Instructor'),
                sampleText: table.innerText.substring(0, 200) + '...'
            }));
            return {
                bodyText: bodyText.substring(0, 500) + '...',
                tableCount: tables.length,
                tableInfo,
                hasNoResults: bodyText.includes('No classes found') || bodyText.includes('no classes were found'),
                hasError: bodyText.includes('error') || bodyText.includes('Error'),
                hasResults: bodyText.includes('The following classes match') || bodyText.includes('Search Results')
            };
        });

        console.log('📄 Page content summary:', pageContent);

        // Check if results are found
        const noResultsText = await frame.evaluate(() => {
            const bodyText = document.body.innerText;
            return bodyText.includes('No classes found') || bodyText.includes('no classes were found');
        });

        if (noResultsText) {
            console.log('ℹ️ No courses found for the search criteria');
            return [];
        }

        // Parse PeopleSoft course structure
        const courses = await frame.evaluate((searchParams: any) => {
            // Define decodeUTF8 function inside browser context
            function decodeUTF8(str: string): string {
                try {
                    // Decode as UTF-8 if misinterpreted as Latin-1
                    return decodeURIComponent(escape(str));
                } catch {
                    return str;
                }
            }

            // Define parseMeetingDates function inside browser context
            function parseMeetingDates(meetingDates: string): { meetingStartDate: string; meetingEndDate: string } {
                if (!meetingDates || meetingDates === 'TBD' || meetingDates === 'N/A') {
                    return { meetingStartDate: 'TBD', meetingEndDate: 'TBD' };
                }

                // Match pattern like "2025-05-05 - 2025-07-25"
                const dateRangeMatch = meetingDates.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);

                if (dateRangeMatch) {
                    return {
                        meetingStartDate: dateRangeMatch[1],
                        meetingEndDate: dateRangeMatch[2]
                    };
                }

                // If no range found, try to extract a single date
                const singleDateMatch = meetingDates.match(/(\d{4}-\d{2}-\d{2})/);
                if (singleDateMatch) {
                    return {
                        meetingStartDate: singleDateMatch[1],
                        meetingEndDate: singleDateMatch[1]
                    };
                }

                // Fallback
                return { meetingStartDate: 'TBD', meetingEndDate: 'TBD' };
            }

            const courseData: any[] = [];

            // Find course headers in PeopleSoft structure
            const courseHeaders = Array.from(document.querySelectorAll('td.PAGROUPBOXLABELLEVEL1'));
            console.log(`Found ${courseHeaders.length} course headers`);

            for (const header of courseHeaders) {
                const headerText = header.textContent?.trim() || '';

                // Parse course code and title from header (e.g., "ITI 1100 - Digital Systems I" or "APA 46111 - Internat/expérience clinique")
                const courseMatch = headerText.match(/([A-Z]{2,4}\s+\d{4,})\s*-\s*(.+)/);
                if (!courseMatch) {
                    console.log('Skipping invalid header:', headerText);
                    continue;
                }

                const currentCourseCode = courseMatch[1].trim();
                const rawCourseTitle = courseMatch[2].trim();
                const currentCourseTitle = decodeUTF8(rawCourseTitle);
                const currentSubjectCode = currentCourseCode.split(' ')[0];

                console.log(`Processing course: ${currentCourseCode} - ${currentCourseTitle}`);

                // Find the main course table that immediately follows this header
                let courseTable = header.closest('table');
                if (!courseTable) {
                    // Try to find the next table after the header
                    let nextElement = header.parentElement as HTMLElement | null;
                    while (nextElement && !nextElement.querySelector('table.PSLEVEL1GRIDNBONBO')) {
                        nextElement = nextElement.nextElementSibling as HTMLElement | null;
                    }
                    courseTable = nextElement?.querySelector('table.PSLEVEL1GRIDNBONBO') || null;
                }

                if (!courseTable) {
                    console.log('No course table found for this header');
                    continue;
                }

                // Process only the data rows in THIS specific table
                const dataRows = Array.from(courseTable.querySelectorAll('tr[id*="trSSR_CLSRCH_MTG1"]'));
                console.log(`Found ${dataRows.length} section rows for ${currentCourseCode}`);

                for (const row of dataRows) {
                    try {
                        // Extract the row number from the ID (e.g., "trSSR_CLSRCH_MTG1$0_row1" -> "0")
                        const rowId = row.getAttribute('id') || '';
                        const rowNumMatch = rowId.match(/trSSR_CLSRCH_MTG1\$(\d+)_row1/);
                        if (!rowNumMatch) continue;

                        const rowNum = rowNumMatch[1];

                        // Extract section data using PeopleSoft ID patterns
                        const sectionElement = document.querySelector(`#MTG_CLASSNAME\\$${rowNum}`);
                        const scheduleElement = document.querySelector(`#MTG_DAYTIME\\$${rowNum}`);
                        const instructorElement = document.querySelector(`#MTG_INSTR\\$${rowNum}`);
                        const datesElement = document.querySelector(`#MTG_TOPIC\\$${rowNum}`);
                        // Status element will be found in the improved detection logic below

                        if (!sectionElement) continue; // Skip if no section info found

                        // Parse section info (format: "Z00-LEC<br>Session A")
                        const sectionHTML = sectionElement.innerHTML || '';
                        const sectionLines = sectionHTML.split('<br>').map(line => decodeUTF8(line.trim()));
                        const sectionCode = sectionLines[0] || '';

                        // Parse schedule (format: "Tu 11:30 - 12:50<br>Fr 11:30 - 12:50")
                        const scheduleHTML = scheduleElement?.innerHTML || '';
                        const scheduleLines = scheduleHTML.split('<br>').map(line => decodeUTF8(line.trim())).filter(line => line);

                        // Parse instructor (format: "Mohammad Al Ridhawi<br>Staff")
                        const instructorHTML = instructorElement?.innerHTML || '';
                        const instructorLines = instructorHTML.split('<br>').map(line => decodeUTF8(line.trim())).filter(line => line);

                        // Parse dates (format: "2025-05-05 - 2025-07-25")
                        const datesHTML = datesElement?.innerHTML || '';
                        const dateLines = datesHTML.split('<br>').map(line => decodeUTF8(line.trim())).filter(line => line);

                        // Validate section format
                        const sectionMatch = sectionCode.match(/([A-Z]+\d+)-([A-Z]+)/);
                        if (!sectionMatch) {
                            console.log('⚠️ Unknown section format:', sectionCode, '- Including as UNKNOWN type');
                            // Still add the section, but mark as UNKNOWN
                            const meetingDates = dateLines.length > 0 ? dateLines[0] : 'TBD';
                            const { meetingStartDate, meetingEndDate } = parseMeetingDates(meetingDates);

                            courseData.push({
                                courseCode: currentCourseCode || 'UNKNOWN',
                                courseTitle: currentCourseTitle || 'UNKNOWN',
                                section: sectionCode || 'UNKNOWN',
                                days: ['N/A'],
                                time: scheduleLines.join(', ') || 'N/A',
                                instructor: instructorLines[0] || 'Staff',
                                meetingDates: meetingDates,
                                meetingStartDate: meetingStartDate,
                                meetingEndDate: meetingEndDate,
                                status: 'Open',
                                term: searchParams.term,
                                subjectCode: currentSubjectCode || 'UNKNOWN',
                                sectionType: 'UNKNOWN'
                            });
                            continue;
                        }

                        // Extract days and times from schedule lines
                        const scheduleInfo = [];
                        for (const scheduleLine of scheduleLines) {
                            const dayTimeMatch = scheduleLine.match(/(Mo|Tu|We|Th|Fr|Sa|Su)\s+(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})/);
                            if (dayTimeMatch) {
                                scheduleInfo.push({
                                    day: dayTimeMatch[1],
                                    time: dayTimeMatch[2]
                                });
                            }
                        }

                        // Accept N/A schedules and any section type
                        let days = [];
                        let combinedTime = '';
                        if (scheduleLines.length === 1 && scheduleLines[0].startsWith('N/A')) {
                            days = ['N/A'];
                            combinedTime = scheduleLines[0];
                        } else if (scheduleInfo.length > 0) {
                            days = scheduleInfo.map(s => s.day);
                            const scheduleStrings = scheduleInfo.map(s => `${s.day} ${s.time}`);
                            combinedTime = scheduleStrings.join(', ');
                        } else {
                            // fallback: still add the course, mark as unknown
                            days = ['N/A'];
                            combinedTime = scheduleLines.join(', ') || 'N/A';
                        }

                        // Parse dates (format: "2025-05-05 - 2025-07-25") - extract unique dates only
                        const meetingDates = dateLines.length > 0 ? dateLines[0] : 'TBD';
                        const { meetingStartDate, meetingEndDate } = parseMeetingDates(meetingDates);

                        // Extract status with improved detection
                        let status: 'Open' | 'Closed' | 'Waitlist' | 'Unknown' = 'Unknown';

                        // Find the current row element
                        const currentRow = document.querySelector(`tr[id*="trSSR_CLSRCH_MTG1$${rowNum}"]`);

                        if (currentRow) {
                            // Look for status images in the entire row
                            const statusImages = Array.from(currentRow.querySelectorAll('img[src*="PS_CS_STATUS"]'));

                            for (const img of statusImages) {
                                const imgSrc = img.getAttribute('src') || '';
                                const imgAlt = img.getAttribute('alt') || '';

                                if (imgSrc.includes('PS_CS_STATUS_OPEN_ICN') || imgAlt.toLowerCase() === 'open') {
                                    status = 'Open';
                                    break;
                                } else if (imgSrc.includes('PS_CS_STATUS_CLOSED_ICN') || imgAlt.toLowerCase() === 'closed') {
                                    status = 'Closed';
                                    break;
                                } else if (imgSrc.includes('WAITLIST') || imgAlt.toLowerCase() === 'waitlist') {
                                    status = 'Waitlist';
                                    break;
                                }
                            }

                            // If no status image found, check text content in the row
                            if (status === 'Unknown') {
                                const rowText = currentRow.textContent?.toLowerCase() || '';
                                if (rowText.includes('open')) {
                                    status = 'Open';
                                } else if (rowText.includes('closed')) {
                                    status = 'Closed';
                                } else if (rowText.includes('waitlist')) {
                                    status = 'Waitlist';
                                }
                            }
                        }

                        console.log(`Adding section: ${currentCourseCode} ${sectionCode} - ${combinedTime} - ${instructorLines[0] || 'Staff'}`);

                        courseData.push({
                            courseCode: currentCourseCode,
                            courseTitle: currentCourseTitle,
                            section: sectionCode,
                            days: days,
                            time: combinedTime,
                            instructor: instructorLines[0] || 'Staff',
                            meetingDates: meetingDates,
                            meetingStartDate: meetingStartDate,
                            meetingEndDate: meetingEndDate,
                            status: status,
                            term: searchParams.term,
                            subjectCode: currentSubjectCode,
                            sectionType: sectionCode.split('-')[1]
                        });

                    } catch (error) {
                        console.error('Error processing row:', error);
                    }
                }
            }

            return courseData;
        }, params);

        console.log(`📊 Extracted ${courses.length} course sections`);

        // Simple deduplication based on exact matches only
        const uniqueCourses = [];
        const seenKeys = new Set();

        for (const course of courses) {
            const uniqueKey = `${course.courseCode}|${course.section}|${course.time}|${course.instructor}`;

            if (!seenKeys.has(uniqueKey)) {
                seenKeys.add(uniqueKey);
                uniqueCourses.push(course);
            }
        }

        console.log(`✅ Final count: ${uniqueCourses.length} unique sections`);
        return uniqueCourses;
    }

    /**
     * Search courses by subject code
     */
    async searchBySubject(subjectCode: string, term: string = '2025 Fall Term'): Promise<UOttawaCourse[]> {
        return this.searchCourses({ term, subjectCode });
    }

    /**
     * Search for a specific course
     */
    async searchSpecificCourse(subjectCode: string, courseNumber: string, term: string = '2025 Fall Term'): Promise<UOttawaCourse[]> {
        return this.searchCourses({ term, subjectCode, courseNumber });
    }

    /**
     * Get all available terms
     */
    getAvailableTerms(): string[] {
        return Object.keys(TERM_MAPPINGS);
    }

    /**
     * Get all available subject codes
     */
    getAvailableSubjects(): string[] {
        return SUBJECT_CODES;
    }

    /**
     * Save courses to JSON file
     */
    async saveToJson(courses: UOttawaCourse[], filename: string): Promise<void> {
        const outputPath = path.join(__dirname, '..', 'data', filename);
        await fs.ensureDir(path.dirname(outputPath));
        await fs.writeJson(outputPath, courses, { spaces: 2 });
        console.log(`💾 Saved ${courses.length} courses to ${outputPath} `);
    }

    /**
     * Convert flat course data to grouped structure
     */
    groupCoursesBySection(flatCourses: UOttawaCourse[]): GroupedCourseData {
        console.log('🔄 Converting flat course data to grouped structure...');

        const courseMap = new Map<string, GroupedCourse>();

        for (const course of flatCourses) {
            const courseKey = `${course.courseCode}`;

            // Initialize course if not exists
            if (!courseMap.has(courseKey)) {
                courseMap.set(courseKey, {
                    courseCode: course.courseCode,
                    courseTitle: course.courseTitle,
                    subjectCode: course.subjectCode,
                    term: course.term,
                    sectionGroups: {}
                });
            }

            const groupedCourse = courseMap.get(courseKey)!;

            // Parse section code to get group letter and type
            // Format: "A00-LEC", "A02-LAB", "B00-LEC", "HS00-LEC" etc.
            const sectionMatch = course.section.match(/^([A-Z]+)(\d*)-([A-Z]+)$/);
            if (!sectionMatch) {
                console.warn(`⚠️ Could not parse section: ${course.section}`);
                continue;
            }

            const groupLetter = sectionMatch[1]; // "A", "B", "C", "HS", etc.
            const sectionNumber = sectionMatch[2]; // "00", "01", "02", etc.
            const sectionType = sectionMatch[3]; // "LEC", "LAB", "TUT", etc.

            console.log(`Processing: ${course.section} -> Group: ${groupLetter}, Type: ${sectionType}, Course: ${course.courseCode}`);

            // Initialize section group if not exists
            if (!groupedCourse.sectionGroups[groupLetter]) {
                groupedCourse.sectionGroups[groupLetter] = {
                    groupId: groupLetter,
                    labs: [],
                    tutorials: []
                };
            }

            const sectionGroup = groupedCourse.sectionGroups[groupLetter];

            // Parse meeting dates to get start and end dates
            const { meetingStartDate, meetingEndDate } = this.parseMeetingDates(course.meetingDates);

            // Create section object
            const section: Section = {
                section: course.section,
                days: course.days,
                time: course.time,
                instructor: course.instructor,
                meetingDates: course.meetingDates,
                meetingStartDate,
                meetingEndDate,
                status: course.status
            };

            // Categorize section by type
            switch (sectionType) {
                case 'LEC':
                    if (sectionGroup.lecture) {
                        console.warn(`⚠️ Group ${groupLetter} already has a lecture, overwriting: ${sectionGroup.lecture.section} with ${course.section}`);
                    }
                    sectionGroup.lecture = section;
                    console.log(`✅ Added lecture ${course.section} to group ${groupLetter}`);
                    break;
                case 'LAB':
                    sectionGroup.labs.push(section);
                    console.log(`✅ Added lab ${course.section} to group ${groupLetter}`);
                    break;
                case 'TUT':
                case 'TT':
                case 'SEM':
                case 'DGD':
                    sectionGroup.tutorials.push(section);
                    console.log(`✅ Added tutorial ${course.section} to group ${groupLetter}`);
                    break;
                default:
                    console.warn(`⚠️ Unknown section type: ${sectionType} for ${course.section}, adding to tutorials`);
                    sectionGroup.tutorials.push(section);
            }
        }

        const courses = Array.from(courseMap.values());
        console.log(`✅ Grouped ${flatCourses.length} sections into ${courses.length} courses`);

        // Debug: show what we got for each course
        for (const course of courses) {
            console.log(`\n📚 ${course.courseCode}:`);
            for (const [groupId, group] of Object.entries(course.sectionGroups)) {
                console.log(`  Group ${groupId}:`);
                if (group.lecture) {
                    console.log(`    LEC: ${group.lecture.section} - ${group.lecture.instructor}`);
                } else {
                    console.log(`    ⚠️ NO LECTURE FOUND!`);
                }
                console.log(`    LABs: ${group.labs.length} sections`);
                console.log(`    TUTs: ${group.tutorials.length} sections`);
            }
        }

        return { courses };
    }

    /**
     * Save grouped courses to JSON file
     */
    async saveGroupedToJson(groupedData: GroupedCourseData, filename: string): Promise<void> {
        const outputPath = path.join(__dirname, '..', 'data', filename);
        await fs.ensureDir(path.dirname(outputPath));
        await fs.writeJson(outputPath, groupedData, { spaces: 2 });
        console.log(`💾 Saved ${groupedData.courses.length} grouped courses to ${outputPath}`);
    }
}

// Export singleton instance
export const uottawaScraper = new UOttawaCourseScraper();

// Export types for use in other files
export type { UOttawaCourse, SearchParams, Section, SectionGroup, GroupedCourse, GroupedCourseData };

/**
 * Clean up UTF-8 encoding issues in text
 * Fixes common garbled characters like Ã© -> é, Ã¢ -> â, etc.
 */
function cleanText(text: string): string {
    if (!text) return text;

    return text
        .replace(/Ã©/g, 'é')
        .replace(/Ã¢/g, 'â')
        .replace(/Ã¨/g, 'è')
        .replace(/Ãª/g, 'ê')
        .replace(/Ã€/g, 'À')
        .replace(/Ã /g, 'à')
        .replace(/Ã´/g, 'ô')
        .replace(/Ã¹/g, 'ù')
        .replace(/Ã»/g, 'û')
        .replace(/Ã§/g, 'ç')
        .replace(/Ã‰/g, 'É')
        .replace(/Ã‚/g, 'Â')
        .replace(/Ãˆ/g, 'È')
        .replace(/ÃŠ/g, 'Ê')
        .replace(/Ã™/g, 'Ù')
        .replace(/Ã›/g, 'Û')
        .replace(/Ã‡/g, 'Ç')
        .replace(/â€™/g, '’')
        .replace(/â€œ/g, '“')
        .replace(/â€/g, '”')
        .replace(/â€“/g, '–')
        .replace(/â€”/g, '—')
        .replace(/Ãƒ/g, 'Ã')   // If it means "Ã", leave it — otherwise update based on source
        .replace(/Ã³/g, 'ó')
        .replace(/Ã¡/g, 'á')
        .replace(/Ã­/g, 'í')
        .replace(/Ãº/g, 'ú')
        .replace(/Ã±/g, 'ñ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Helper function to fix encoding issues
function decodeUTF8(str: string): string {
    try {
        // Decode as UTF-8 if misinterpreted as Latin-1
        return decodeURIComponent(escape(str));
    } catch {
        return str;
    }
}

/**
 * Transform grouped course data to KaiRoll format
 */
function transformToKaiRollFormat(data: GroupedCourseData): any[] {
    const offerings: any[] = [];

    for (const course of data.courses) {
        for (const [groupId, sectionGroup] of Object.entries(course.sectionGroups)) {
            // Add lecture offering if exists
            if (sectionGroup.lecture) {
                offerings.push({
                    code: course.courseCode,  // Use 'code' field name to match populate_data expectations
                    courseTitle: course.courseTitle,
                    section: sectionGroup.lecture.section,
                    instructor: sectionGroup.lecture.instructor,
                    schedule: sectionGroup.lecture.time,
                    location: 'TBD'
                });
            }

            // Add lab offerings
            for (const lab of sectionGroup.labs) {
                offerings.push({
                    code: course.courseCode,  // Use 'code' field name to match populate_data expectations
                    courseTitle: course.courseTitle,
                    section: lab.section,
                    instructor: lab.instructor,
                    schedule: lab.time,
                    location: 'TBD'
                });
            }

            // Add tutorial offerings
            for (const tutorial of sectionGroup.tutorials) {
                offerings.push({
                    code: course.courseCode,  // Use 'code' field name to match populate_data expectations
                    courseTitle: course.courseTitle,
                    section: tutorial.section,
                    instructor: tutorial.instructor,
                    schedule: tutorial.time,
                    location: 'TBD'
                });
            }
        }
    }

    return offerings;
}

// Main execution function for ALL TERMS with automatic KaiRoll update
export async function main() {
    console.log('🚀 uOttawa Course Scraper → KaiRoll Auto-Update');
    console.log('==================================================');
    console.log('This will:');
    console.log('1. 🕷️  Scrape uOttawa courses for each term');
    console.log('2. 💾  Save to JSON files after each term');
    console.log('3. 🔄  Update KaiRoll database after each term');
    console.log('==================================================\n');

    const scraper = new UOttawaCourseScraper();

    try {
        await scraper.initialize();

        const allTerms = Object.keys(TERM_MAPPINGS);
        console.log(`📅 Will scrape ${allTerms.length} terms: ${allTerms.join(', ')}\n`);
        console.log(`📚 Will scrape ${SUBJECT_CODES.length} subjects: ${SUBJECT_CODES.join(', ')}\n`);

        for (const term of allTerms) {
            console.log(`\n🎯 Starting comprehensive scrape for: ${term}`);
            console.log('='.repeat(80));

            const results = {
                successful: 0,
                failed: 0,
                totalCourses: 0,
                errors: [] as string[]
            };

            let allCourses: UOttawaCourse[] = [];

            for (let i = 0; i < SUBJECT_CODES.length; i++) {
                const subject = SUBJECT_CODES[i];
                console.log(`\n[${i + 1}/${SUBJECT_CODES.length}] 📚 Scraping subject: ${subject} for ${term}`);
                console.log('─'.repeat(60));

                try {
                    console.log(`🔄 Starting search for ${subject}...`);
                    const courses = await scraper.searchBySubject(subject, term);

                    if (courses.length > 0) {
                        console.log(`✅ SUCCESS: Found ${courses.length} ${subject} courses`);
                        results.successful++;
                        results.totalCourses += courses.length;
                        allCourses.push(...courses);
                    } else {
                        console.log(`⚠️ No courses found for ${subject}`);
                        results.successful++; // Still count as successful even if no courses
                    }
                    console.log(`✅ Completed search for ${subject}, continuing to next subject...`);
                } catch (error) {
                    console.error(`❌ FAILURE: Error searching for ${subject} courses:`, error);
                    results.failed++;
                    results.errors.push(subject);
                    console.log(`🔄 Moving to next subject despite ${subject} failure...`);
                }

                // SPEED: Reduced delay from 2000ms to 1000ms
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Generate filename based on term
            let filename = '';
            if (term.includes('Fall')) {
                filename = 'all_courses_fall_2025.json';
            } else if (term.includes('Winter')) {
                filename = 'all_courses_winter_2026.json';
            }

            // Generate and save complete grouped dataset for this term
            const termGroupedData = scraper.groupCoursesBySection(allCourses);
            await scraper.saveGroupedToJson(termGroupedData, filename);

            console.log(`\n🏁 ${term} SCRAPE COMPLETE!`);
            console.log(`📊 Results: ${results.successful} successful, ${results.failed} failed`);
            console.log(`📈 Total: ${results.totalCourses} sections → ${termGroupedData.courses.length} grouped courses`);
            console.log(`💾 Saved as: ${filename}`);

            if (results.failed > 0) {
                console.log(`❌ Failed subjects: ${results.errors.join(', ')}`);
            }

            // 🔄 UPDATE KAIROLL IMMEDIATELY AFTER THIS TERM
            console.log(`\n🔄 UPDATING KAIROLL FOR ${term}...`);
            console.log('='.repeat(50));
            try {
                await updateKaiRollForTerm(term, filename);
                console.log(`✅ ${term} data updated in KaiRoll!\n`);
            } catch (error) {
                console.error(`❌ KaiRoll update failed for ${term}, but continuing with next term:`, error);
                console.log(`⚠️ You may need to manually run: python3 manage.py populate_data\n`);
            }

            // 🔄 SYNC DATA BASED ON ENVIRONMENT
            if (process.env.SYNC_TO_PRODUCTION === 'true') {
                console.log(`\n🔄 SYNCING LATEST DATA TO ALL LOCATIONS (PRODUCTION MODE)...`);
                await syncLatestDataToAllLocations(filename);
                console.log(`✅ Latest data synced to all locations!\n`);
            } else {
                console.log(`\n📝 Skipping production sync (set SYNC_TO_PRODUCTION=true to enable)`);
                console.log(`💡 Data saved locally in scrapers/data/ - use deploy script to push to production\n`);
            }
        }

        console.log('\n🎉 ALL TERMS SCRAPING AND UPDATING COMPLETED!');
        console.log('📁 All JSON files created and KaiRoll updated for each term');

        // 🔄 FINAL SYNC BASED ON ENVIRONMENT
        if (process.env.SYNC_TO_PRODUCTION === 'true') {
            console.log('\n🔄 PERFORMING FINAL SYNC OF ALL LATEST DATA...');
            await syncAllLatestData();
            console.log('✅ All latest data synced across all systems!');
        } else {
            console.log('\n📝 Scraping completed! Data saved locally in scrapers/data/');
            console.log('💡 To deploy to production, use: npm run deploy:data');
        }

        // 🎯 UPDATE FRONTEND DATA BASED ON ENVIRONMENT
        if (process.env.SYNC_TO_PRODUCTION === 'true') {
            console.log('\n🎯 AUTO-UPDATING FRONTEND DATA...');
            try {
                const { updateFrontendData } = require('../update_frontend_data.js');
                await updateFrontendData();
                console.log('✅ Frontend data automatically updated!');
            } catch (error) {
                console.error('❌ Error updating frontend data:', error);
                console.log('💡 You may need to run the update manually');
            }
        }

    } catch (error) {
        console.error('❌ Error during comprehensive scrape:', error);
    } finally {
        await scraper.cleanup();
    }
}

/**
 * Update KaiRoll database for a specific term
 */
async function updateKaiRollForTerm(term: string, filename: string): Promise<void> {
    const path = require('path');
    const fs = require('fs-extra');

    try {
        // Load scraped data for this specific term
        const scraperDataDir = path.join(__dirname, '..', 'data');
        const kairollDataDir = path.join(__dirname, '..', '..', 'backend', 'api', 'data');

        console.log(`📂 Loading scraped course data for ${term}...`);

        const termData = await fs.readJson(path.join(scraperDataDir, filename));
        console.log(`✅ Loaded ${term}: ${termData.courses.length} courses`);

        // Load existing KaiRoll data or create new structure
        const kairollDataPath = path.join(kairollDataDir, 'all_courses_by_term.json');
        let kairollData: any = {};

        if (await fs.pathExists(kairollDataPath)) {
            kairollData = await fs.readJson(kairollDataPath);
            console.log('📂 Loaded existing KaiRoll data');
        } else {
            console.log('📂 Creating new KaiRoll data structure');
        }

        // Transform this term's data to KaiRoll format
        console.log(`🔄 Transforming ${term} to KaiRoll format...`);

        let termKey = '';
        if (term.includes('Fall')) {
            termKey = 'Fall 2025';
        } else if (term.includes('Winter')) {
            termKey = 'Winter 2026';
        }

        kairollData[termKey] = transformToKaiRollFormat(termData);
        console.log(`✅ Transformed ${term}: ${kairollData[termKey].length} offerings`);

        // Save updated KaiRoll data
        console.log(`💾 Saving updated KaiRoll data...`);
        await fs.ensureDir(kairollDataDir);
        await fs.writeJson(kairollDataPath, kairollData, { spaces: 2 });
        console.log(`✅ Saved: ${kairollDataPath}`);

        // Update courses and professors files (incremental)
        await updateKaiRollFiles(termData, kairollDataDir);

        // Create term-specific last updated file
        const termFileKey = term.toLowerCase().replace(/\s+/g, '_');
        const lastUpdatedData = {
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
            }),
            term: term,
            files_updated: 1,
            deployment_time: new Date().toISOString()
        };

        // Copy updated JSON file to frontend
        console.log(`🔄 Updating frontend data for ${term}...`);
        const frontendPublicDir = path.join(__dirname, '..', '..', 'frontend', 'public');
        await fs.ensureDir(frontendPublicDir);

        try {
            await fs.copy(path.join(scraperDataDir, filename),
                path.join(frontendPublicDir, filename));
            console.log(`✅ Frontend data file updated: ${filename}`);
            
            // Save term-specific last updated file to frontend
            const termLastUpdatedFile = `last_updated_${termFileKey}.json`;
            await fs.writeJson(path.join(frontendPublicDir, termLastUpdatedFile), lastUpdatedData, { spaces: 2 });
            console.log(`✅ Term-specific timestamp created: ${termLastUpdatedFile}`);
        } catch (copyError) {
            console.warn(`⚠️ Failed to copy ${filename} to frontend:`, copyError);
        }

        // Run Django populate command (optional - don't fail if this doesn't work)
        console.log(`🔄 Running Django populate_data command for ${term}...`);
        const { spawn } = require('child_process');
        const backendDir = path.join(__dirname, '..', '..', 'backend');

        return new Promise((resolve) => {
            const djangoProcess = spawn('python3', ['manage.py', 'populate_data'], {
                cwd: backendDir,
                stdio: 'inherit'
            });

            djangoProcess.on('close', (code: number | null) => {
                if (code === 0) {
                    console.log(`✅ Database populated successfully for ${term}`);
                } else {
                    console.error(`❌ Django command failed with code ${code} for ${term}`);
                    console.log(`⚠️ Database population failed, but JSON files were saved successfully`);
                }
                resolve(); // Always resolve, don't reject
            });

            djangoProcess.on('error', (error: Error) => {
                console.error(`❌ Failed to start Django process for ${term}:`, error);
                console.log(`⚠️ Database population failed, but JSON files were saved successfully`);
                resolve(); // Always resolve, don't reject
            });
        });

    } catch (error) {
        console.error(`❌ KaiRoll update failed for ${term}:`, error);
        throw error;
    }
}

/**
 * Update course and professor files incrementally for a single term
 */
async function updateKaiRollFiles(termData: GroupedCourseData, kairollDataDir: string): Promise<void> {
    const fs = require('fs-extra');
    const path = require('path');

    console.log('📚 Updating course and professor files...');

    // Load existing data or create new
    const coursesPath = path.join(kairollDataDir, 'courses.json');
    const professorsPath = path.join(kairollDataDir, 'professors.json');

    let existingCourses = [];
    let existingProfessors = [];

    if (await fs.pathExists(coursesPath)) {
        existingCourses = await fs.readJson(coursesPath);
    }
    if (await fs.pathExists(professorsPath)) {
        existingProfessors = await fs.readJson(professorsPath);
    }

    // Collect new courses and professors from this term
    const coursesMap = new Map();
    const professorsSet = new Set<string>();

    // Add existing data to maps
    for (const course of existingCourses) {
        coursesMap.set(course.code, course);
    }
    for (const prof of existingProfessors) {
        professorsSet.add(prof.name);
    }

    // Add new data from this term
    for (const course of termData.courses) {
        // Add course if not already exists
        if (!coursesMap.has(course.courseCode)) {
            coursesMap.set(course.courseCode, {
                code: course.courseCode,
                title: course.courseTitle,
                description: '',
                units: 3.0,
                department: course.subjectCode,
                professors: []
            });
        }

        // Collect instructors
        for (const sectionGroup of Object.values(course.sectionGroups)) {
            if (sectionGroup.lecture?.instructor && sectionGroup.lecture.instructor !== 'Staff') {
                professorsSet.add(sectionGroup.lecture.instructor);
            }
            for (const lab of sectionGroup.labs) {
                if (lab.instructor && lab.instructor !== 'Staff') {
                    professorsSet.add(lab.instructor);
                }
            }
            for (const tutorial of sectionGroup.tutorials) {
                if (tutorial.instructor && tutorial.instructor !== 'Staff') {
                    professorsSet.add(tutorial.instructor);
                }
            }
        }
    }

    // Save updated courses
    const coursesArray = Array.from(coursesMap.values());
    await fs.writeJson(coursesPath, coursesArray, { spaces: 2 });
    console.log(`✅ Updated ${coursesArray.length} courses: ${coursesPath}`);

    // Save updated professors
    const professorsArray = Array.from(professorsSet).map(name => ({
        name,
        title: '',
        department: '',
        email: null,
        bio: ''
    }));

    await fs.writeJson(professorsPath, professorsArray, { spaces: 2 });
    console.log(`✅ Updated ${professorsArray.length} professors: ${professorsPath}`);
}

/**
 * Sync latest scraped data to all locations (frontend, backend, KaiRoll)
 */
async function syncLatestDataToAllLocations(filename: string): Promise<void> {
    const path = require('path');
    const fs = require('fs-extra');

    try {
        const scraperDataDir = path.join(__dirname, '..', 'data');
        const sourceFile = path.join(scraperDataDir, filename);

        // Copy to frontend public directory
        const frontendPublicDir = path.join(__dirname, '..', '..', 'frontend', 'public');
        await fs.ensureDir(frontendPublicDir);
        await fs.copy(sourceFile, path.join(frontendPublicDir, filename));
        console.log(`✅ Frontend updated: ${filename}`);

        // Copy to backend API data directory
        const backendDataDir = path.join(__dirname, '..', '..', 'backend', 'api', 'data');
        await fs.ensureDir(backendDataDir);
        await fs.copy(sourceFile, path.join(backendDataDir, filename));
        console.log(`✅ Backend updated: ${filename}`);

        // Also copy the complete courses file if it exists
        const completeFile = path.join(scraperDataDir, 'all_courses_complete.json');
        if (await fs.pathExists(completeFile)) {
            await fs.copy(completeFile, path.join(frontendPublicDir, 'all_courses_complete.json'));
            await fs.copy(completeFile, path.join(backendDataDir, 'all_courses_complete.json'));
            console.log(`✅ Complete courses file synced`);
        }

    } catch (error) {
        console.error(`❌ Error syncing latest data:`, error);
    }
}

/**
 * Sync all latest scraped data across all systems
 */
async function syncAllLatestData(): Promise<void> {
    const path = require('path');
    const fs = require('fs-extra');

    try {
        console.log('🔄 Syncing all latest scraped data...');

        const scraperDataDir = path.join(__dirname, '..', 'data');
        const frontendPublicDir = path.join(__dirname, '..', '..', 'frontend', 'public');
        const backendDataDir = path.join(__dirname, '..', '..', 'backend', 'api', 'data');

        // Ensure directories exist
        await fs.ensureDir(frontendPublicDir);
        await fs.ensureDir(backendDataDir);

        // List of files to sync
        const filesToSync = [
            'all_courses_fall_2025.json',
            'all_courses_winter_2026.json',
            'all_courses_complete.json',
            'all_courses_flattened.json'
        ];

        for (const file of filesToSync) {
            const sourceFile = path.join(scraperDataDir, file);
            if (await fs.pathExists(sourceFile)) {
                // Copy to frontend
                await fs.copy(sourceFile, path.join(frontendPublicDir, file));
                // Copy to backend
                await fs.copy(sourceFile, path.join(backendDataDir, file));
                console.log(`✅ Synced: ${file}`);
            }
        }

        console.log('✅ All latest data synced successfully!');

    } catch (error) {
        console.error('❌ Error syncing all latest data:', error);
    }
}

if (require.main === module) {
    main().catch(console.error);
} 