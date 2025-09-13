#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Automated script to update frontend course data after scraping
 * This script should be called automatically after the uOttawa scraper completes
 */

console.log('🔄 Starting automated frontend data update...');

// Define paths
const SCRAPERS_DATA_PATH = path.join(__dirname, 'data');
const BACKEND_DATA_PATH = path.join(__dirname, '..', 'backend', 'api', 'data');
const FRONTEND_PUBLIC_PATH = path.join(__dirname, '..', 'frontend', 'public');
const FRONTEND_API_DATA_PATH = path.join(FRONTEND_PUBLIC_PATH, 'api', 'data');

// Ensure directories exist
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📁 Created directory: ${dirPath}`);
    }
}

// Copy file with error handling
function copyFile(source, destination) {
    try {
        if (fs.existsSync(source)) {
            fs.copyFileSync(source, destination);
            console.log(`✅ Copied: ${path.basename(source)} -> ${path.relative(process.cwd(), destination)}`);
            return true;
        } else {
            console.log(`⚠️ Source file not found: ${source}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ Error copying ${source} to ${destination}:`, error.message);
        return false;
    }
}

// Transform backend course data to frontend format
function transformCourseDataToFrontendFormat() {
    console.log('🔄 Transforming course data to frontend format...');
    
    const termFiles = {
        'Fall 2025': 'all_courses_fall_2025.json',
        'Winter 2026': 'all_courses_winter_2026.json',
        'Spring/Summer 2025': 'all_courses_spring_summer_2025.json'
    };
    
    const result = {};
    let totalSections = 0;
    let totalOpen = 0;
    let totalClosed = 0;
    
    for (const [termName, fileName] of Object.entries(termFiles)) {
        const filePath = path.join(BACKEND_DATA_PATH, fileName);
        
        if (fs.existsSync(filePath)) {
            console.log(` Processing ${termName} from ${fileName}...`);
            
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const sections = [];
                
                // Transform each course
                data.courses.forEach(course => {
                    const { courseCode, courseTitle, sectionGroups } = course;
                    
                    // Process each section group
                    Object.values(sectionGroups).forEach(group => {
                        // Process lecture
                        if (group.lecture) {
                            sections.push({
                                code: courseCode,
                                courseTitle: courseTitle,
                                section: group.lecture.section,
                                instructor: group.lecture.instructor,
                                schedule: group.lecture.time,
                                location: 'TBD',
                                status: group.lecture.status || 'Unknown'
                            });
                        }
                        
                        // Process labs
                        if (group.labs && group.labs.length > 0) {
                            group.labs.forEach(lab => {
                                sections.push({
                                    code: courseCode,
                                    courseTitle: courseTitle,
                                    section: lab.section,
                                    instructor: lab.instructor,
                                    schedule: lab.time,
                                    location: 'TBD',
                                    status: lab.status || 'Unknown'
                                });
                            });
                        }
                        
                        // Process tutorials
                        if (group.tutorials && group.tutorials.length > 0) {
                            group.tutorials.forEach(tutorial => {
                                sections.push({
                                    code: courseCode,
                                    courseTitle: courseTitle,
                                    section: tutorial.section,
                                    instructor: tutorial.instructor,
                                    schedule: tutorial.time,
                                    location: 'TBD',
                                    status: tutorial.status || 'Unknown'
                                });
                            });
                        }
                    });
                });
                
                result[termName] = sections;
                
                // Count statistics
                const openCount = sections.filter(s => s.status === 'Open').length;
                const closedCount = sections.filter(s => s.status === 'Closed').length;
                
                totalSections += sections.length;
                totalOpen += openCount;
                totalClosed += closedCount;
                
                console.log(`✅ ${termName}: ${sections.length} sections (${openCount} Open, ${closedCount} Closed)`);
                
            } catch (error) {
                console.error(`❌ Error processing ${fileName}:`, error.message);
            }
        } else {
            console.log(`⚠️ File not found: ${filePath}`);
        }
    }
    
    // Write the transformed data
    const outputPath = path.join(FRONTEND_API_DATA_PATH, 'all_courses_by_term.json');
    try {
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log(`✅ Updated frontend API data: ${outputPath}`);
        console.log(`📊 Total: ${totalSections} sections (${totalOpen} Open, ${totalClosed} Closed)`);
    } catch (error) {
        console.error(`❌ Error writing frontend API data:`, error.message);
    }
}

// Main update function
function updateFrontendData() {
    console.log('🚀 Starting frontend data update process...');
    
    // Ensure directories exist
    ensureDirectoryExists(BACKEND_DATA_PATH);
    ensureDirectoryExists(FRONTEND_PUBLIC_PATH);
    ensureDirectoryExists(FRONTEND_API_DATA_PATH);
    
    // Step 1: Copy scraped data to backend
    console.log('\n📋 Step 1: Updating backend data...');
    const backendFiles = [
        'all_courses_fall_2025.json',
        'all_courses_winter_2026.json',
        'all_courses_spring_summer_2025.json',
        'all_courses_complete.json',
        'all_courses_flattened.json'
    ];
    
    let backendUpdateCount = 0;
    backendFiles.forEach(fileName => {
        const source = path.join(SCRAPERS_DATA_PATH, fileName);
        const destination = path.join(BACKEND_DATA_PATH, fileName);
        if (copyFile(source, destination)) {
            backendUpdateCount++;
        }
    });
    
    // Step 2: Copy scraped data to frontend public
    console.log('\n📋 Step 2: Updating frontend public files...');
    const frontendFiles = [
        'all_courses_fall_2025.json',
        'all_courses_winter_2026.json',
        'all_courses_spring_summer_2025.json',
        'all_courses_complete.json',
        'all_courses_flattened.json'
    ];
    
    let frontendUpdateCount = 0;
    frontendFiles.forEach(fileName => {
        const source = path.join(SCRAPERS_DATA_PATH, fileName);
        const destination = path.join(FRONTEND_PUBLIC_PATH, fileName);
        if (copyFile(source, destination)) {
            frontendUpdateCount++;
        }
    });
    
    // Step 3: Transform data for frontend API
    console.log('\n📋 Step 3: Transforming data for frontend API...');
    transformCourseDataToFrontendFormat();
    
    // Summary
    console.log('\n🎉 Frontend data update completed!');
    console.log(`📊 Backend files updated: ${backendUpdateCount}/${backendFiles.length}`);
    console.log(`📊 Frontend files updated: ${frontendUpdateCount}/${frontendFiles.length}`);
    console.log('💡 Frontend cache will be automatically refreshed on next page load');
    
    // Create timestamp file for tracking
    const timestampPath = path.join(FRONTEND_API_DATA_PATH, 'last_update.json');
    const timestamp = {
        lastUpdate: new Date().toISOString(),
        updatedFiles: [...backendFiles, ...frontendFiles, 'all_courses_by_term.json'],
        totalFiles: backendUpdateCount + frontendUpdateCount + 1
    };
    
    try {
        fs.writeFileSync(timestampPath, JSON.stringify(timestamp, null, 2));
        console.log(`📅 Update timestamp saved: ${timestamp.lastUpdate}`);
    } catch (error) {
        console.error(`⚠️ Could not save timestamp:`, error.message);
    }
}

// Run the update if called directly
if (require.main === module) {
    updateFrontendData();
}

module.exports = { updateFrontendData };