async function seedNotifications(prisma) {
    console.log('🌱 Seeding notifications...');

    const users = await prisma.user.findMany();
    const notificationTypes = ['bin_full', 'collection', 'points', 'report', 'reward', 'system'];
    const titles = {
        bin_full: '⚠️ Bin Full Alert',
        collection: '✅ Collection Completed',
        points: '🎉 Points Earned',
        report: '📋 New Report',
        reward: '🏆 Reward Available',
        system: 'ℹ️ System Update'
    };
    
    const notifications = [];

    for (const user of users) {
        for (let i = 0; i < 5; i++) {
            const type = notificationTypes[Math.floor(Math.random() * notificationTypes.length)];
            const date = new Date();
            date.setDate(date.getDate() - Math.floor(Math.random() * 30));
            
            let message = '';
            switch(type) {
                case 'bin_full':
                    message = 'A bin in your area needs immediate collection!';
                    break;
                case 'collection':
                    message = 'Your waste was collected successfully!';
                    break;
                case 'points':
                    message = 'You earned +15 points for proper segregation!';
                    break;
                case 'report':
                    message = 'A new waste report was submitted in your area';
                    break;
                case 'reward':
                    message = 'New rewards available in the marketplace!';
                    break;
                default:
                    message = 'System update: New features available';
            }
            
            notifications.push({
                userId: user.id,
                title: titles[type],
                message: message,
                type: type,
                read: Math.random() > 0.7,
                createdAt: date
            });
        }
    }

    for (const notification of notifications) {
        await prisma.notification.create({
            data: notification
        });
    }

    console.log(`✅ Seeded ${notifications.length} notifications`);
    return notifications;
}

module.exports = seedNotifications;