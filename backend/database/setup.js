const runMigrations = require('./run-migrations');
const runAllSeeds = require('./seeds/index');

async function setupDatabase() {
    console.log('🚀 Setting up database...\n');
    
    try {
        // Run migrations first
        await runMigrations();
        console.log('');
        
        // Then run seeds
        await runAllSeeds();
        
        console.log('\n✅ Database setup complete!');
        
    } catch (error) {
        console.error('\n❌ Database setup failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    setupDatabase();
}

module.exports = setupDatabase;