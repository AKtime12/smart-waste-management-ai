const { PrismaClient } = require('@prisma/client');

// Create a single PrismaClient instance for the entire application
const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Handle connection events
prisma.$connect()
    .then(() => {
        console.log('✅ Database connected successfully');
    })
    .catch((error) => {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    });

// Graceful shutdown
process.on('beforeExit', async () => {
    await prisma.$disconnect();
    console.log('Database disconnected');
});

module.exports = { prisma };