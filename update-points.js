const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updatePoints() {
    try {
        const result = await prisma.user.updateMany({
            where: { email: 'household@smartwaste.com' },
            data: { points: 1250 }
        });
        console.log('User points updated:', result);
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

updatePoints();