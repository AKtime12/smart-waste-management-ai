const { prisma } = require('./db');
const bcrypt = require('bcryptjs');

async function seedUsers() {
    console.log('Seeding users...');
    
    try {
        const adminPassword = await bcrypt.hash('admin123', 10);
        await prisma.user.upsert({
            where: { email: 'admin@smartwaste.com' },
            update: {},
            create: {
                email: 'admin@smartwaste.com',
                password: adminPassword,
                name: 'Admin User',
                role: 'ADMIN',
                points: 0
            }
        });
        console.log('Admin created');
        
        const collectorPassword = await bcrypt.hash('collector123', 10);
        await prisma.user.upsert({
            where: { email: 'collector@smartwaste.com' },
            update: {},
            create: {
                email: 'collector@smartwaste.com',
                password: collectorPassword,
                name: 'Collector User',
                role: 'COLLECTOR',
                points: 500
            }
        });
        console.log('Collector created');
        
        const householdPassword = await bcrypt.hash('user123', 10);
        await prisma.user.upsert({
            where: { email: 'household@smartwaste.com' },
            update: {},
            create: {
                email: 'household@smartwaste.com',
                password: householdPassword,
                name: 'Household User',
                role: 'HOUSEHOLD',
                points: 1250,
                address: '123 Green Street'
            }
        });
        console.log('Household created');
        
        console.log('All users seeded successfully!');
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

seedUsers();