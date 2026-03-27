const bcrypt = require('bcryptjs');

async function seedUsers(prisma) {
    console.log('Seeding users...');

    // Hash passwords
    const adminPassword = await bcrypt.hash('admin123', 12);
    const collectorPassword = await bcrypt.hash('collector123', 12);
    const householdPassword = await bcrypt.hash('user123', 12);

    const users = [
        {
            email: 'admin@smartwaste.com',
            password: adminPassword,
            name: 'Admin User',
            role: 'ADMIN',
            points: 0
        },
        {
            email: 'collector@smartwaste.com',
            password: collectorPassword,
            name: 'John Collector',
            role: 'COLLECTOR',
            points: 500
        },
        {
            email: 'household1@smartwaste.com',
            password: householdPassword,
            name: 'Green Family',
            role: 'HOUSEHOLD',
            points: 1250
        },
        {
            email: 'household2@smartwaste.com',
            password: householdPassword,
            name: 'Eco Warriors',
            role: 'HOUSEHOLD',
            points: 890
        }
    ];

    for (const user of users) {
        await prisma.user.upsert({
            where: { email: user.email },
            update: user,
            create: user
        });
    }

    console.log('Seeded ' + users.length + ' users');
    return users;
}

module.exports = seedUsers;
