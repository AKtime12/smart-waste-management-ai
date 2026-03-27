async function seedPredictions(prisma) {
    console.log('🌱 Seeding predictions...');

    const areas = ['Downtown', 'Suburb', 'Industrial', 'Residential', 'Commercial'];
    const predictions = [];

    // Generate predictions for next 30 days
    for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        
        for (const area of areas) {
            // Base prediction with seasonal variation
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            let baseVolume = 300 + Math.random() * 200;
            
            if (isWeekend) baseVolume *= 1.3;
            
            // Festival multipliers
            const dateStr = date.toISOString().split('T')[0];
            const festivals = {
                '2024-10-31': 2.5, // Diwali
                '2024-12-25': 1.8, // Christmas
                '2025-01-01': 2.0  // New Year
            };
            
            if (festivals[dateStr]) {
                baseVolume *= festivals[dateStr];
            }
            
            predictions.push({
                area: area,
                date: date,
                predictedVolume: Math.round(baseVolume),
                confidence: 0.75 + Math.random() * 0.2,
                factors: JSON.stringify({
                    isWeekend: isWeekend,
                    isFestival: !!festivals[dateStr],
                    season: Math.floor(date.getMonth() / 3)
                }),
                recommendations: JSON.stringify({
                    requiredTrucks: Math.ceil(baseVolume / 500),
                    additionalCollectors: Math.ceil(baseVolume / 300) - 1,
                    priority: baseVolume > 500 ? 'high' : 'normal'
                })
            });
        }
    }

    for (const prediction of predictions) {
        // Use composite unique key (area, date)
        await prisma.prediction.upsert({
            where: {
                area_date: {
                    area: prediction.area,
                    date: prediction.date
                }
            },
            update: prediction,
            create: prediction
        });
    }

    console.log(`✅ Seeded ${predictions.length} predictions`);
    return predictions;
}

module.exports = seedPredictions;