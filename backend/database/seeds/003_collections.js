async function seedCollections(prisma) {
    console.log('🌱 Seeding collections...');

    const users = await prisma.user.findMany({
        where: { role: 'HOUSEHOLD' }
    });
    
    const bins = await prisma.qRBin.findMany();
    const qualities = ['EXCELLENT', 'GOOD', 'POOR', 'FAILED'];
    
    const collections = [];
    
    // Generate 50 sample collections
    for (let i = 0; i < 50; i++) {
        const randomUser = users[Math.floor(Math.random() * users.length)];
        const randomBin = bins[Math.floor(Math.random() * bins.length)];
        const quality = qualities[Math.floor(Math.random() * qualities.length)];
        
        let points = 0;
        if (quality === 'EXCELLENT') points = 20;
        else if (quality === 'GOOD') points = 10;
        else if (quality === 'POOR') points = 2;
        
        const weight = Math.floor(Math.random() * 30) + 5;
        
        // Random date within last 30 days
        const date = new Date();
        date.setDate(date.getDate() - Math.floor(Math.random() * 30));
        
        collections.push({
            binId: randomBin.id,
            householdId: randomUser.id,
            collectorId: null,
            collectionTime: date,
            wasteWeight: weight,
            aiVerified: true,
            segregationQuality: quality,
            pointsAwarded: points + Math.floor(weight / 5)
        });
    }

    for (const collection of collections) {
        const created = await prisma.collection.create({
            data: collection
        });
        
        // Update user points
        if (collection.pointsAwarded > 0) {
            await prisma.user.update({
                where: { id: collection.householdId },
                data: { points: { increment: collection.pointsAwarded } }
            });
            
            // Create point transaction
            await prisma.pointTransaction.create({
                data: {
                    userId: collection.householdId,
                    points: collection.pointsAwarded,
                    reason: `Waste collection - ${collection.segregationQuality} segregation`,
                    collectionId: created.id
                }
            });
        }
    }

    console.log(`✅ Seeded ${collections.length} collections`);
    return collections;
}

module.exports = seedCollections;