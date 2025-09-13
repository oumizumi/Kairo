import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface CatalogueCourse {
  courseCode: string;
  courseTitle: string;
  units: string;
  description: string;
  prerequisites: string;
}

const OUTPUT_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'all_courses_complete.json');

// Helper function to clean prerequisite strings
function cleanPrerequisites(prereqText: string): string {
  if (!prereqText) {
    return "";
  }
  // Remove "Prerequisite(s): ", "Préalable(s) : ", etc. and trim
  let cleanedText = prereqText.replace(/^(Prerequisite(s)?:\s*|Préalable(s)?\s*:\s*)/i, '').trim();
  return cleanedText;
}

// Helper function to extract units from course title
function extractUnitsFromTitle(titleAndUnits: string): { title: string; units: string } {
  // Look for patterns like "(3 units)", "(3 crédits)", "(3units)", etc.
  const unitsMatch = titleAndUnits.match(/\((\d+(?:\.\d+)?)\s*(?:units?|crédits?|credit\s*hours?)\)/i);
  const units = unitsMatch ? unitsMatch[1] : "";

  // Remove the units part from the title
  let cleanTitle = titleAndUnits.replace(/\s*\([^)]*(?:units?|crédits?|credit\s*hours?)[^)]*\)/gi, '').trim();

  // Clean up any extra whitespace
  cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();

  return { title: cleanTitle, units };
}

// Expanded hardcoded subjects list
const hardcodedSubjects: { [key: string]: string } = {
  "CPT": "https://catalogue.uottawa.ca/en/courses/cpt/", // Accounting
  "ADM": "https://catalogue.uottawa.ca/en/courses/adm/", // Administration
  "AMM": "https://catalogue.uottawa.ca/en/courses/amm/", // Advanced Materials and Manufacturing
  "AFR": "https://catalogue.uottawa.ca/en/courses/afr/", // African Studies
  "ASE": "https://catalogue.uottawa.ca/en/courses/ase/", // Anatomical Sciences Education
  "ANA": "https://catalogue.uottawa.ca/en/courses/ana/", // Anatomy and Neurobiology
  "ANP": "https://catalogue.uottawa.ca/en/courses/anp/", // Anatomy and Physiology
  "ANE": "https://catalogue.uottawa.ca/en/courses/ane/", // Anesthesiology
  "ANT": "https://catalogue.uottawa.ca/en/courses/ant/", // Anthropology
  "ARB": "https://catalogue.uottawa.ca/en/courses/arb/", // Arab Language and Culture
  "ACP": "https://catalogue.uottawa.ca/en/courses/acp/", // Arts Co-op
  "AMT": "https://catalogue.uottawa.ca/en/courses/amt/", // Arts,Music,Theatre
  "ASI": "https://catalogue.uottawa.ca/en/courses/asi/", // Asian Studies
  "BCH": "https://catalogue.uottawa.ca/en/courses/bch/", // Biochemistry
  "BIL": "https://catalogue.uottawa.ca/en/courses/bil/", // Bilingualism Studies
  "BIM": "https://catalogue.uottawa.ca/en/courses/bim/", // Biomedical Science
  "BIO": "https://catalogue.uottawa.ca/en/courses/bio/", // Biology
  "BML": "https://catalogue.uottawa.ca/en/courses/bml/", // Biomolecular Sciences
  "BMG": "https://catalogue.uottawa.ca/en/courses/bmg/", // Biomedical Engineering
  "BNF": "https://catalogue.uottawa.ca/en/courses/bnf/", // Bioinformatics
  "BPS": "https://catalogue.uottawa.ca/en/courses/bps/", // Biopharmaceutical Science
  "CDN": "https://catalogue.uottawa.ca/en/courses/cdn/", // Canadian Studies
  "CEG": "https://catalogue.uottawa.ca/en/courses/ceg/", // Computer Engineering
  "CHG": "https://catalogue.uottawa.ca/en/courses/chg/", // Chemical Engineering
  "CHM": "https://catalogue.uottawa.ca/en/courses/chm/", // Chemistry
  "CHN": "https://catalogue.uottawa.ca/en/courses/chn/", // Chinese
  "CIN": "https://catalogue.uottawa.ca/en/courses/cin/", // Film Studies
  "CLA": "https://catalogue.uottawa.ca/en/courses/cla/", // Classical Studies
  "CLI": "https://catalogue.uottawa.ca/en/courses/cli/", // Clinical Rotation
  "CLT": "https://catalogue.uottawa.ca/en/courses/clt/", // Celtic Studies
  "CML": "https://catalogue.uottawa.ca/en/courses/cml/", // Common Law
  "CMM": "https://catalogue.uottawa.ca/en/courses/cmm/", // Cellular and Molecular Medicine
  "CMN": "https://catalogue.uottawa.ca/en/courses/cmn/", // Communication
  "CPL": "https://catalogue.uottawa.ca/en/courses/cpl/", // Complex Project Leadership
  "CRM": "https://catalogue.uottawa.ca/en/courses/crm/", // Criminology
  "CSI": "https://catalogue.uottawa.ca/en/courses/csi/", // Computer Science
  "CTS": "https://catalogue.uottawa.ca/en/courses/cts/", // Cardio-Respiratory Systems
  "CVG": "https://catalogue.uottawa.ca/en/courses/cvg/", // Civil Engineering
  "DCC": "https://catalogue.uottawa.ca/en/courses/dcc/", // Law (Certificate)
  "DCL": "https://catalogue.uottawa.ca/en/courses/dcl/", // Law
  "DCN": "https://catalogue.uottawa.ca/en/courses/dcn/", // Digital Cultures
  "DLS": "https://catalogue.uottawa.ca/en/courses/dls/", // Second-Language Teaching
  "DRC": "https://catalogue.uottawa.ca/en/courses/drc/", // Civil Law
  "DTI": "https://catalogue.uottawa.ca/en/courses/dti/", // Digital Transformation and Innovation
  "DVM": "https://catalogue.uottawa.ca/en/courses/dvm/", // International Development and Globalization
  "EAS": "https://catalogue.uottawa.ca/en/courses/eas/", // Indigenous Studies
  "ECH": "https://catalogue.uottawa.ca/en/courses/ech/", // Conflict Studies and Human Rights
  "ECO": "https://catalogue.uottawa.ca/en/courses/eco/", // Economics
  "EDU": "https://catalogue.uottawa.ca/en/courses/edu/", // Education
  "EED": "https://catalogue.uottawa.ca/en/courses/eed/", // Entrepreneurial Engineering Design
  "EFR": "https://catalogue.uottawa.ca/en/courses/efr/", // Francophone Studies
  "ELA": "https://catalogue.uottawa.ca/en/courses/ela/", // Latin American Studies
  "ELE": "https://catalogue.uottawa.ca/en/courses/ele/", // Elective Courses in Medicine
  "ELG": "https://catalogue.uottawa.ca/en/courses/elg/", // Electrical Engineering
  "EMP": "https://catalogue.uottawa.ca/en/courses/emp/", // Engineering Management
  "ENG": "https://catalogue.uottawa.ca/en/courses/eng/", // English
  "ENV": "https://catalogue.uottawa.ca/en/courses/env/", // Environmental Studies
  "EPI": "https://catalogue.uottawa.ca/en/courses/epi/", // Epidemiology and Applied Health Research
  "ERG": "https://catalogue.uottawa.ca/en/courses/erg/", // Occupational Therapy
  "ESL": "https://catalogue.uottawa.ca/en/courses/esl/", // English as a Second Language
  "ESP": "https://catalogue.uottawa.ca/en/courses/esp/", // Spanish
  "EVD": "https://catalogue.uottawa.ca/en/courses/evd/", // Environmental Sustainability
  "EVG": "https://catalogue.uottawa.ca/en/courses/evg/", // Environmental Engineering
  "EVS": "https://catalogue.uottawa.ca/en/courses/evs/", // Environmental Science
  "FAM": "https://catalogue.uottawa.ca/en/courses/fam/", // Family Medicine
  "FEM": "https://catalogue.uottawa.ca/en/courses/fem/", // Feminist and Gender Studies
  "FLS": "https://catalogue.uottawa.ca/en/courses/fls/", // French as a Second Language
  "FRA": "https://catalogue.uottawa.ca/en/courses/fra/", // Lettres françaises
  "FRE": "https://catalogue.uottawa.ca/en/courses/fre/", // French Studies
  "GAE": "https://catalogue.uottawa.ca/en/courses/gae/", // Gastroenteritis
  "GEG": "https://catalogue.uottawa.ca/en/courses/geg/", // Geography
  "GEO": "https://catalogue.uottawa.ca/en/courses/geo/", // Geology
  "GLO": "https://catalogue.uottawa.ca/en/courses/glo/", // uOGlobal
  "GNG": "https://catalogue.uottawa.ca/en/courses/gng/", // General Engineering
  "GRT": "https://catalogue.uottawa.ca/en/courses/grt/", // Gerontology
  "GSU": "https://catalogue.uottawa.ca/en/courses/gsu/", // General Surgery
  "HAH": "https://catalogue.uottawa.ca/en/courses/hah/", // Health Administration
  "HIS": "https://catalogue.uottawa.ca/en/courses/his/", // History
  "HMG": "https://catalogue.uottawa.ca/en/courses/hmg/", // Human and Molecular Genetics
  "HSS": "https://catalogue.uottawa.ca/en/courses/hss/", // Health Sciences
  "IAI": "https://catalogue.uottawa.ca/en/courses/iai/", // Interdisciplinary Artificial Intelligence
  "ILA": "https://catalogue.uottawa.ca/en/courses/ila/", // Indigenous Languages
  "IMM": "https://catalogue.uottawa.ca/en/courses/imm/", // Immunology
  "INR": "https://catalogue.uottawa.ca/en/courses/inr/", // Medical Intern or Resident
  "ISI": "https://catalogue.uottawa.ca/en/courses/isi/", // Information Studies
  "ISP": "https://catalogue.uottawa.ca/en/courses/isp/", // Science, Society and Policy
  "ITA": "https://catalogue.uottawa.ca/en/courses/ita/", // Italian Language and Culture
  "ITI": "https://catalogue.uottawa.ca/en/courses/iti/", // Information Technology
  "JCS": "https://catalogue.uottawa.ca/en/courses/jcs/", // Vered Jewish Canadian Studies
  "JOU": "https://catalogue.uottawa.ca/en/courses/jou/", // Journalism
  "JPN": "https://catalogue.uottawa.ca/en/courses/jpn/", // Japanese
  "LAT": "https://catalogue.uottawa.ca/en/courses/lat/", // Latin
  "LCL": "https://catalogue.uottawa.ca/en/courses/lcl/", // Classics
  "LCM": "https://catalogue.uottawa.ca/en/courses/lcm/", // World Literatures and Cultures
  "LIN": "https://catalogue.uottawa.ca/en/courses/lin/", // Linguistics
  "LLM": "https://catalogue.uottawa.ca/en/courses/llm/", // Modern Languages
  "LSR": "https://catalogue.uottawa.ca/en/courses/lsr/", // Leisure Studies
  "MAT": "https://catalogue.uottawa.ca/en/courses/mat/", // Mathematics
  "MBA": "https://catalogue.uottawa.ca/en/courses/mba/", // MBA Program
  "MCG": "https://catalogue.uottawa.ca/en/courses/mcg/", // Mechanical Engineering
  "MDV": "https://catalogue.uottawa.ca/en/courses/mdv/", // Medieval Studies
  "MED": "https://catalogue.uottawa.ca/en/courses/med/", // Medicine
  "MGT": "https://catalogue.uottawa.ca/en/courses/mgt/", // Management
  "MHA": "https://catalogue.uottawa.ca/en/courses/mha/", // Health Administration
  "MHS": "https://catalogue.uottawa.ca/en/courses/mhs/", // Health Systems
  "MIC": "https://catalogue.uottawa.ca/en/courses/mic/", // Microbiology and Immunology
  "MRP": "https://catalogue.uottawa.ca/en/courses/mrp/", // Major Research Paper
  "MUS": "https://catalogue.uottawa.ca/en/courses/mus/", // Music
  "NAP": "https://catalogue.uottawa.ca/en/courses/nap/", // Neurology
  "NOT": "https://catalogue.uottawa.ca/en/courses/not/", // Notary Law
  "NSC": "https://catalogue.uottawa.ca/en/courses/nsc/", // Neuroscience
  "NSG": "https://catalogue.uottawa.ca/en/courses/nsg/", // Nursing
  "NUT": "https://catalogue.uottawa.ca/en/courses/nut/", // Food and Nutrition
  "OBG": "https://catalogue.uottawa.ca/en/courses/obg/", // Obstetrics and Gynecology
  "OMT": "https://catalogue.uottawa.ca/en/courses/omt/", // Ophthalmic Medical Technology
  "OPH": "https://catalogue.uottawa.ca/en/courses/oph/", // Ophthalmology
  "ORA": "https://catalogue.uottawa.ca/en/courses/ora/", // Speech-Language Pathology
  "ORT": "https://catalogue.uottawa.ca/en/courses/ort/", // Orthopaedic Pathology
  "PAE": "https://catalogue.uottawa.ca/en/courses/pae/", // Pediatrics
  "PAP": "https://catalogue.uottawa.ca/en/courses/pap/", // Public Administration
  "PCS": "https://catalogue.uottawa.ca/en/courses/pcs/", // Medicine
  "PCT": "https://catalogue.uottawa.ca/en/courses/pct/", // Psychiatry
  "PED": "https://catalogue.uottawa.ca/en/courses/ped/", // Education
  "PHA": "https://catalogue.uottawa.ca/en/courses/pha/", // Pharmacology
  "PHI": "https://catalogue.uottawa.ca/en/courses/phi/", // Philosophy
  "PHR": "https://catalogue.uottawa.ca/en/courses/phr/", // Population Health Risk Assessment and Management
  "PHS": "https://catalogue.uottawa.ca/en/courses/phs/", // Physiology
  "PHT": "https://catalogue.uottawa.ca/en/courses/pht/", // Physiotherapy
  "PHY": "https://catalogue.uottawa.ca/en/courses/phy/", // Physics
  "PIP": "https://catalogue.uottawa.ca/en/courses/pip/", // Pre-internship Program
  "PLN": "https://catalogue.uottawa.ca/en/courses/pln/", // Polish
  "PME": "https://catalogue.uottawa.ca/en/courses/pme/", // Pathology and Experimental Medicine
  "POL": "https://catalogue.uottawa.ca/en/courses/pol/", // Political Science
  "POP": "https://catalogue.uottawa.ca/en/courses/pop/", // Population Health
  "POR": "https://catalogue.uottawa.ca/en/courses/por/", // Portuguese
  "PSY": "https://catalogue.uottawa.ca/en/courses/psy/", // Psychology
  "RAD": "https://catalogue.uottawa.ca/en/courses/rad/", // Radiology
  "RCH": "https://catalogue.uottawa.ca/en/courses/rch/", // Research Internship
  "REA": "https://catalogue.uottawa.ca/en/courses/rea/", // Rehabilitation Sciences
  "RUS": "https://catalogue.uottawa.ca/en/courses/rus/", // Russian Language and Culture
  "SAI": "https://catalogue.uottawa.ca/en/courses/sai/", // Interprofessional Health Care Practice
  "SCI": "https://catalogue.uottawa.ca/en/courses/sci/", // Science (General)
  "SCS": "https://catalogue.uottawa.ca/en/courses/scs/", // Social Sciences
  "SDS": "https://catalogue.uottawa.ca/en/courses/sds/", // Data Science
  "SEC": "https://catalogue.uottawa.ca/en/courses/sec/", // Cybersecurity
  "SED": "https://catalogue.uottawa.ca/en/courses/sed/", // Engineering Design and Teaching Innovation
  "SEG": "https://catalogue.uottawa.ca/en/courses/seg/", // Software Engineering
  "SOC": "https://catalogue.uottawa.ca/en/courses/soc/", // Sociology
  "SRS": "https://catalogue.uottawa.ca/en/courses/srs/", // Religious Studies
  "SSP": "https://catalogue.uottawa.ca/en/courses/ssp/", // Health Sciences
  "SSS": "https://catalogue.uottawa.ca/en/courses/sss/", // Social Sciences of Health
  "SYS": "https://catalogue.uottawa.ca/en/courses/sys/", // Systems Science
  "THE": "https://catalogue.uottawa.ca/en/courses/the/", // Theatre
  "THD": "https://catalogue.uottawa.ca/en/courses/thd/", // Doctoral Thesis
  "THM": "https://catalogue.uottawa.ca/en/courses/thm/", // Master's Thesis
  "TMM": "https://catalogue.uottawa.ca/en/courses/tmm/", // Translational and Molecular Medicine
  "TOX": "https://catalogue.uottawa.ca/en/courses/tox/", // Chemical and Environmental Toxicology
  "TRA": "https://catalogue.uottawa.ca/en/courses/tra/", // Translation
  "TSO": "https://catalogue.uottawa.ca/en/courses/tso/", // Social Work
  "URO": "https://catalogue.uottawa.ca/en/courses/uro/", // Urology
  "YDD": "https://catalogue.uottawa.ca/en/courses/ydd/", // Yiddish
};

async function scrapeSingleSubject(subjectCode: string, subjectUrl: string): Promise<CatalogueCourse[]> {
  console.log(`Processing subject: ${subjectCode}...`);
  let browser: Browser | null = null;
  const subjectCoursesData: CatalogueCourse[] = [];

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    console.log(`Navigating to subject page: ${subjectUrl}`);
    await page.goto(subjectUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const courseElements = await page.locator('div.courseblock').all();

    if (courseElements.length === 0) {
      console.log(`No course blocks found on ${subjectUrl} with the selector 'div.courseblock'.`);
    } else {
      console.log(`Found ${courseElements.length} course elements on ${subjectUrl}`);
    }

    for (let i = 0; i < courseElements.length; i++) {
      try {
        const block = courseElements[i];

        const fullTitle = await block.locator('p.courseblocktitle').textContent() || '';

        // Parse the full title which should be in format: "ASI 3510 Thèmes choisis en culture d'Asie de l'Est (3 crédits)" or "APA 46111 Internat/expérience clinique"
        // Extract course code from the beginning (supports 2-4 letter prefixes and 4+ digit numbers)
        const codeMatch = fullTitle.match(/^([A-Z]{2,4}\s*\d{4,}[A-Z]?)/);
        const finalCode = codeMatch ? codeMatch[1].replace(/\s/g, '') : '';

        // Extract title and units from the full title
        // Remove the course code from the beginning
        let titleAndUnits = fullTitle;
        if (codeMatch) {
          titleAndUnits = fullTitle.replace(codeMatch[0], '').trim();
        }

        const { title, units } = extractUnitsFromTitle(titleAndUnits);

        // Get description with aggressive timeout handling - ensure we never skip a course
        let description = '';
        try {
          description = await block.locator('p.courseblockdesc').textContent({ timeout: 3000 }) || '';
        } catch (descError) {
          // If timeout, just use a placeholder - don't skip the course
          description = 'Description temporarily unavailable - please check course catalogue';
          console.log(`    ⚠️  Description timeout for course block ${i + 1}, using placeholder`);
        }

        // Get prerequisites with fast timeout - don't let this block course collection
        let prereqTextRaw = '';
        try {
          const prereqElement = block.locator('p.courseblockextra').filter({ hasText: /Prerequisite|Préalable/i }).first();
          prereqTextRaw = await prereqElement.textContent({ timeout: 1500 }) || '';
        } catch (prereqError) {
          // If prerequisite element not found, try looking in the description we already have
          if (description && description !== 'Description temporarily unavailable - please check course catalogue') {
            const prereqMatch = description.match(/(Prerequisite[s]?|Préalable[s]?)[:\s]+(.*?)(?:\.|$)/i);
            if (prereqMatch) {
              prereqTextRaw = prereqMatch[0];
            }
          }
          // If still no prerequisites found, continue with empty string - don't skip the course
        }

        const cleanedPrereqText = cleanPrerequisites(prereqTextRaw);

        // ALWAYS capture the course if we have a valid course code - never skip
        if (finalCode) {
          subjectCoursesData.push({
            courseCode: finalCode,
            courseTitle: title || 'Title not available',
            units: units || '',
            description: description.trim() || 'Description not available',
            prerequisites: cleanedPrereqText
          });

          console.log(`  ✓ Parsed: ${finalCode} - ${title || 'Title not available'} (${units || 'units not specified'} units)`);
        } else {
          // Even if we don't have a course code, log what we tried to parse
          console.log(`  ⚠️  No valid course code found for course block ${i + 1}, skipping...`);
        }
      } catch (err: any) {
        console.error(`  ✗ Error parsing course block ${i + 1} on page ${subjectUrl}. Error: ${err.message}`);
        // Continue to the next course block instead of stopping
        continue;
      }
    }

  } catch (error: any) {
    console.error(`Error during scraping for subject ${subjectCode} at ${subjectUrl}:`, error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return subjectCoursesData;
}

async function scrapeAllSubjects(): Promise<void> {
  console.log("🚀 Starting to scrape ALL subjects from uOttawa course catalogue...");
  console.log(`📚 Total subjects to process: ${Object.keys(hardcodedSubjects).length}`);

  const allCoursesData: { [subjectCode: string]: CatalogueCourse[] } = {};
  let totalCourses = 0;

  const subjectCodes = Object.keys(hardcodedSubjects).sort();

  for (let i = 0; i < subjectCodes.length; i++) {
    const subjectCode = subjectCodes[i];
    const subjectUrl = hardcodedSubjects[subjectCode];

    console.log(`\n📖 [${i + 1}/${subjectCodes.length}] Processing ${subjectCode}...`);

    try {
      const courses = await scrapeSingleSubject(subjectCode, subjectUrl);
      allCoursesData[subjectCode] = courses;
      totalCourses += courses.length;

      console.log(`  ✅ ${subjectCode}: ${courses.length} courses scraped`);

      // Small delay between subjects to be respectful to the server
      if (i < subjectCodes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error: any) {
      console.error(`  ❌ ${subjectCode}: Failed to scrape - ${error.message}`);
      allCoursesData[subjectCode] = [];
    }
  }

  // Save all data to a single comprehensive file
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(allCoursesData, null, 2), 'utf-8');

    console.log(`\n🎉 SUCCESS! Scraped ${totalCourses} total courses across ${Object.keys(allCoursesData).length} subjects`);
    console.log(`📁 Data saved to: ${OUTPUT_FILE}`);

    // Also save a flattened version for easier processing
    const flattenedCourses: CatalogueCourse[] = [];
    for (const subjectCode in allCoursesData) {
      flattenedCourses.push(...allCoursesData[subjectCode]);
    }

    const flattenedOutputFile = path.join(OUTPUT_DIR, 'all_courses_flattened.json');
    await fs.writeFile(flattenedOutputFile, JSON.stringify(flattenedCourses, null, 2), 'utf-8');
    console.log(`📁 Flattened data saved to: ${flattenedOutputFile}`);

    // Generate summary statistics
    const summary = {
      totalCourses,
      totalSubjects: Object.keys(allCoursesData).length,
      coursesBySubject: Object.fromEntries(
        Object.entries(allCoursesData).map(([code, courses]) => [code, courses.length])
      ),
      scrapedAt: new Date().toISOString()
    };

    const summaryFile = path.join(OUTPUT_DIR, 'scraping_summary.json');
    await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2), 'utf-8');
    console.log(`📊 Summary saved to: ${summaryFile}`);

  } catch (error: any) {
    console.error(`❌ Error saving data: ${error.message}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const targetSubjectCode = args[0] ? args[0].toUpperCase() : null;

  const availableHardcodedCodes = Object.keys(hardcodedSubjects).sort();

  if (!targetSubjectCode) {
    console.log("No subject code provided. Available hardcoded subjects are:");
    console.log(availableHardcodedCodes.join(', '));
    console.log("\nOptions:");
    console.log("1. Run with a specific subject code: node dist/scrape_catalogue.js CSI");
    console.log("2. Run with 'ALL' to scrape all subjects: node dist/scrape_catalogue.js ALL");
    process.exit(0);
  }

  if (targetSubjectCode === 'ALL') {
    await scrapeAllSubjects();
  } else {
    const subjectUrl = hardcodedSubjects[targetSubjectCode];

    if (subjectUrl) {
      console.log(`🎯 Scraping single subject: ${targetSubjectCode}`);
      const courses = await scrapeSingleSubject(targetSubjectCode, subjectUrl);

      if (courses.length > 0) {
        await fs.mkdir(OUTPUT_DIR, { recursive: true });
        const subjectOutputFile = path.join(OUTPUT_DIR, `${targetSubjectCode}_courses.json`);
        await fs.writeFile(subjectOutputFile, JSON.stringify(courses, null, 2), 'utf-8');
        console.log(`✅ Successfully scraped ${courses.length} courses for subject ${targetSubjectCode}`);
        console.log(`📁 Data saved to: ${subjectOutputFile}`);
      } else {
        console.log(`❌ No courses were scraped for subject ${targetSubjectCode}`);
      }
    } else {
      console.error(`❌ Error: Subject code ${targetSubjectCode} not found in hardcoded list.`);
      console.log("Available hardcoded subjects are:");
      console.log(availableHardcodedCodes.join(', '));
    }
  }
}

// Call the main function if the script is run directly
if (require.main === module) {
  main()
    .then(() => console.log('\n🏁 Scraping process finished.'))
    .catch(error => console.error('❌ Error during the scraping process:', error));
}

// Exported function to get subject codes, now reflects hardcoded list
export async function getAvailableSubjectCodesFromCatalogue(): Promise<string[]> {
  console.log('Returning available hardcoded subject codes...');
  return Object.keys(hardcodedSubjects).sort();
}
