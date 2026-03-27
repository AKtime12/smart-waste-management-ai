async function seedRewards(prisma) {
    console.log('🌱 Seeding rewards...');

    const rewards = [
        {
            name: '₹100 Amazon Voucher',
            description: 'Get ₹100 Amazon gift card for your recycling efforts',
            points: 500,
            category: 'vouchers',
            stock: 50,
            isActive: true
        },
        {
            name: 'Eco-Friendly Water Bottle',
            description: 'Stainless steel reusable water bottle',
            points: 300,
            category: 'products',
            stock: 25,
            isActive: true
        },
        {
            name: 'Plant a Tree',
            description: "We'll plant a tree in your name",
            points: 200,
            category: 'experiences',
            stock: 100,
            isActive: true
        },
        {
            name: '₹500 Flipkart Voucher',
            description: 'Get ₹500 Flipkart gift card',
            points: 2000,
            category: 'vouchers',
            stock: 20,
            isActive: true
        },
        {
            name: 'Compost Bin',
            description: 'Home composting kit for organic waste',
            points: 800,
            category: 'products',
            stock: 15,
            isActive: true
        },
        {
            name: 'City Eco Tour',
            description: 'Guided eco-tour of the city',
            points: 1500,
            category: 'experiences',
            stock: 10,
            isActive: true
        },
        {
            name: '₹50 Swiggy Voucher',
            description: 'Get ₹50 Swiggy food delivery voucher',
            points: 250,
            category: 'vouchers',
            stock: 100,
            isActive: true
        },
        {
            name: 'Bamboo Toothbrush Set',
            description: 'Eco-friendly bamboo toothbrush set',
            points: 150,
            category: 'products',
            stock: 50,
            isActive: true
        }
    ];

    // Clear existing rewards (no foreign key conflicts in this seed order)
    await prisma.reward.deleteMany({});
    
    // Insert all rewards
    await prisma.reward.createMany({
        data: rewards,
    });

    console.log(`✅ Seeded ${rewards.length} rewards`);
    return rewards;
}

module.exports = seedRewards;