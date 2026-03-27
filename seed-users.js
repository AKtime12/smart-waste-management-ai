const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedUsers() {
    console.log('Seeding users...');
    
    try {
        const adminPassword = await bcrypt.hash('admin123', 12);
        const collectorPassword = await bcrypt.hash('collector123', 12);
        const userPassword = await bcrypt.hash('user123', 12);
        
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
        
        await prisma.user.upsert({
            where: { email: 'household@smartwaste.com' },
            update: {},
            create: {
                email: 'household@smartwaste.com',
                password: userPassword,
                name: 'Household User',
                role: 'HOUSEHOLD',
                points: 1250
            }
        });
        console.log('Household created');
        
        console.log('All users seeded!');
        
        const users = await prisma.user.findMany();
        console.log('Users in database:');
        for(let i = 0; i < users.length; i++) {
            console.log('  - ' + users[i].email + ' (' + users[i].role + ')');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

seedUsers();