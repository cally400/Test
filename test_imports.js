// test_imports.js
console.log('🧪 Testing module imports...\n');

const modules = [
    { name: 'path', isCore: true },
    { name: 'fs', isCore: true },
    { name: 'node-telegram-bot-api', isCore: false },
    { name: 'cloudscraper', isCore: false },
    { name: 'winston', isCore: false },
    { name: 'luxon', isCore: false },
    { name: 'sqlite3', isCore: false },
    { name: 'dotenv', isCore: false }
];

let allPassed = true;

modules.forEach(module => {
    try {
        if (module.isCore) {
            require(module.name);
        } else {
            // للملفات المحلية
            if (module.name.includes('/')) {
                require(`./${module.name}`);
            } else {
                require(module.name);
            }
        }
        console.log(`✅ ${module.name} - LOADED SUCCESSFULLY`);
    } catch (error) {
        console.log(`❌ ${module.name} - FAILED: ${error.message}`);
        allPassed = false;
    }
});

console.log('\n' + '='.repeat(50));
if (allPassed) {
    console.log('🎉 ALL MODULES LOADED SUCCESSFULLY!');
    process.exit(0);
} else {
    console.log('⚠️ SOME MODULES FAILED TO LOAD');
    console.log('💡 Try running: npm install');
    process.exit(1);
}
