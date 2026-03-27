const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runMigrations() {
    console.log('🔄 Running database migrations...');
    
    try {
        // Read and execute migration files in order
        const migrationsDir = path.join(__dirname, 'migrations');
        const migrationFiles = fs.readdirSync(migrationsDir).sort();
        
        for (const file of migrationFiles) {
            if (file.endsWith('.sql')) {
                console.log(`📄 Executing: ${file}`);
                const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
                
                // Execute SQL using raw query
                await prisma.$executeRawUnsafe(sql);
                console.log(`✅ Completed: ${file}`);
            }
        }
        
        console.log('🎉 All migrations completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run if called directly
if (require.main === module) {
    runMigrations().catch(console.error);
}

module.exports = runMigrations;