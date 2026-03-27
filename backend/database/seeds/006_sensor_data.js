async function seedSensorData(prisma) {
    console.log('🌱 Seeding sensor data...');

    const bins = await prisma.qRBin.findMany();
    const sensorData = [];

    // Generate sensor data for the last 7 days for each bin
    for (const bin of bins) {
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            
            // Simulate fill level changes
            const fillLevel = Math.min(100, Math.max(0, 
                bin.currentFill + (Math.random() * 20 - 10)
            ));
            
            sensorData.push({
                binId: bin.id,
                fillLevel: fillLevel,
                temperature: 25 + Math.random() * 10,
                humidity: 50 + Math.random() * 30,
                isFull: fillLevel > 90,
                batteryLevel: 80 + Math.random() * 20,
                timestamp: date
            });
        }
    }

    for (const data of sensorData) {
        await prisma.sensorData.create({
            data: data
        });
    }

    console.log(`✅ Seeded ${sensorData.length} sensor records`);
    return sensorData;
}

module.exports = seedSensorData;