#!/usr/bin/env node

/**
 * Manual Data Deployment Script
 * 
 * This script manually deploys scraped data to production environments.
 * Use this when you want to push your locally scraped data to production.
 */

const fs = require('fs-extra');
const path = require('path');

const SCRAPERS_DATA_PATH = path.join(__dirname, 'data');
const BACKEND_DATA_PATH = path.join(__dirname, '..', 'backend', 'api', 'data');
const FRONTEND_PUBLIC_PATH = path.join(__dirname, '..', 'frontend', 'public');

async function deployData() {
    console.log('🚀 Manual Data Deployment to Production');
    console.log('=====================================');
    
    // Check if scraped data exists
    if (!await fs.pathExists(SCRAPERS_DATA_PATH)) {
        console.error('❌ No scraped data found. Run scrapers first:');
        console.error('   npm run scrape:all-terms');
        process.exit(1);
    }
    
    // List available data files
    const dataFiles = await fs.readdir(SCRAPERS_DATA_PATH);
    const jsonFiles = dataFiles.filter(file => file.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
        console.error('❌ No JSON data files found in scrapers/data/');
        process.exit(1);
    }
    
    console.log(`📋 Found ${jsonFiles.length} data files:`);
    jsonFiles.forEach(file => console.log(`   - ${file}`));
    
    // Ensure directories exist
    await fs.ensureDir(BACKEND_DATA_PATH);
    await fs.ensureDir(FRONTEND_PUBLIC_PATH);
    
    // Deploy to backend
    console.log('\n📦 Deploying to backend/api/data/...');
    let backendCount = 0;
    for (const file of jsonFiles) {
        try {
            await fs.copy(
                path.join(SCRAPERS_DATA_PATH, file),
                path.join(BACKEND_DATA_PATH, file)
            );
            console.log(`   ✅ ${file}`);
            backendCount++;
        } catch (error) {
            console.error(`   ❌ ${file}: ${error.message}`);
        }
    }
    
    // Deploy to frontend
    console.log('\n📦 Deploying to frontend/public/...');
    let frontendCount = 0;
    for (const file of jsonFiles) {
        try {
            await fs.copy(
                path.join(SCRAPERS_DATA_PATH, file),
                path.join(FRONTEND_PUBLIC_PATH, file)
            );
            console.log(`   ✅ ${file}`);
            frontendCount++;
        } catch (error) {
            console.error(`   ❌ ${file}: ${error.message}`);
        }
    }
    
    // Summary
    console.log('\n🎉 Deployment Summary:');
    console.log(`   Backend: ${backendCount}/${jsonFiles.length} files deployed`);
    console.log(`   Frontend: ${frontendCount}/${jsonFiles.length} files deployed`);
    
    if (backendCount === jsonFiles.length && frontendCount === jsonFiles.length) {
        console.log('\n✅ All data successfully deployed!');
        console.log('\n📋 Next steps:');
        console.log('   1. Commit and push changes: git add . && git commit -m "Update production data" && git push');
        console.log('   2. Vercel will automatically redeploy frontend');
        console.log('   3. Railway will automatically redeploy backend');
    } else {
        console.log('\n⚠️ Some files failed to deploy. Check errors above.');
        process.exit(1);
    }
}

// Handle CLI arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run deploy:data

This script deploys locally scraped data to production directories.

Steps:
1. Copies JSON files from scrapers/data/ to backend/api/data/
2. Copies JSON files from scrapers/data/ to frontend/public/
3. You then commit and push to trigger production deployment

Environment Variables:
- Set SYNC_TO_PRODUCTION=true when running scrapers to auto-deploy
- Or use this script for manual control

Examples:
  npm run deploy:data              # Deploy all scraped data
  npm run scrape:all-terms         # Scrape without auto-deploy
  SYNC_TO_PRODUCTION=true npm run scrape:all-terms  # Scrape with auto-deploy
`);
    process.exit(0);
}

// Run deployment
deployData().catch(error => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
});
