const { prisma } = require('../db');

async function runAllSeeds() {
    console.log('🌱 Starting database seeding...\n');
    
    try {
        // Run seeds in order (respecting foreign key dependencies)
        const seedUsers = require('./001_users');
        const seedBins = require('./002_bins');
        const seedCollections = require('./003_collections');
        const seedRewards = require('./004_rewards');
        const seedWards = require('./005_wards');
        const seedSensorData = require('./006_sensor_data');
        const seedNotifications = require('./007_notifications');
        const seedPredictions = require('./008_predictions');
        
        // Execute seeds in order
        await seedUsers(prisma);
        await seedBins(prisma);
        await seedCollections(prisma);
        await seedRewards(prisma);
        await seedWards(prisma);
        await seedSensorData(prisma);
        await seedNotifications(prisma);
        await seedPredictions(prisma);
        
        console.log('\n🎉 Database seeding completed successfully!');
        
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run if called directly
if (require.main === module) {
    runAllSeeds().catch(console.error);
}

module.exports = runAllSeeds;