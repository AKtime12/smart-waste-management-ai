const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function createCollector() {
    try {
        const hashedPassword = await bcrypt.hash('collector123', 10);
        
        const collector = await prisma.user.create({
            data: {
                email: 'collector_new@smartwaste.com',
                password: hashedPassword,
                name: 'New Collector',
                role: 'COLLECTOR',
                points: 0,
                phone: '+919876543210',
                address: 'Collection Center'
            }
        });
        
        console.log('New collector created successfully!');
        console.log('Email:', collector.email);
        console.log('Password: collector123');
        console.log('Role:', collector.role);
        
        const collectors = await prisma.user.findMany({
            where: { role: 'COLLECTOR' }
        });
        console.log('All collectors:');
        for (let i = 0; i < collectors.length; i++) {
            console.log('  - ' + collectors[i].email + ' (' + collectors[i].role + ')');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        if (error.message.includes('Unique constraint')) {
            console.log('Collector already exists!');
        }
    } finally {
        await prisma.();
    }
}

createCollector();
