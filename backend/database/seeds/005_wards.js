async function seedWards(prisma) {
    console.log('🌱 Seeding wards...');

    const wards = [
        {
            name: 'Ward A - Green Society',
            totalPoints: 1250,
            participationRate: 78,
            rank: 1,
            level: 'GOLD'
        },
        {
            name: 'Ward B - Eco Colony',
            totalPoints: 890,
            participationRate: 65,
            rank: 2,
            level: 'SILVER'
        },
        {
            name: 'Ward C - Waste Warriors',
            totalPoints: 540,
            participationRate: 52,
            rank: 3,
            level: 'BRONZE'
        },
        {
            name: 'Ward D - Clean City',
            totalPoints: 210,
            participationRate: 35,
            rank: 4,
            level: 'DEVELOPING'
        }
    ];

    for (const ward of wards) {
        await prisma.ward.upsert({
            where: { name: ward.name },
            update: ward,
            create: ward
        });
    }

    console.log(`✅ Seeded ${wards.length} wards`);
    return wards;
}

module.exports = seedWards;