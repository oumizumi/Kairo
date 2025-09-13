#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const binDir = path.join(__dirname, '..', 'node_modules', '.bin');

try {
    if (fs.existsSync(binDir)) {
        const files = fs.readdirSync(binDir);

        files.forEach(file => {
            const filePath = path.join(binDir, file);
            try {
                // Make file executable (works on Unix-like systems including Vercel)
                fs.chmodSync(filePath, 0o755);
                console.log(`✅ Fixed permissions for: ${file}`);
            } catch (error) {
                // Ignore permission errors on Windows or other systems
                if (error.code !== 'EPERM' && error.code !== 'ENOENT') {
                    console.warn(`⚠️  Warning: Could not fix permissions for ${file}:`, error.message);
                }
            }
        });

        console.log('🎉 Permission fix script completed successfully.');
    } else {
        console.log('📁 node_modules/.bin directory not found, skipping permission fix.');
    }
} catch (error) {
    console.warn('❌ Permission fix script encountered an error:', error.message);
    // Don't fail the build if permission fixing fails
    process.exit(0);
} 