async function seedBins(prisma) {
    console.log('🌱 Seeding QR bins...');

    const bins = [
        {
            qrCode: 'BIN_ORG_001',
            binType: 'ORGANIC',
            latitude: 28.6139,
            longitude: 77.2090,
            ward: 'Ward A',
            locality: 'Green Society',
            capacity: 100,
            currentFill: 85,
            isFull: true
        },
        {
            qrCode: 'BIN_REC_001',
            binType: 'RECYCLABLE',
            latitude: 28.6145,
            longitude: 77.2095,
            ward: 'Ward A',
            locality: 'Green Society',
            capacity: 100,
            currentFill: 45,
            isFull: false
        },
        {
            qrCode: 'BIN_NON_001',
            binType: 'NON_RECYCLABLE',
            latitude: 28.6150,
            longitude: 77.2100,
            ward: 'Ward B',
            locality: 'Eco Colony',
            capacity: 100,
            currentFill: 92,
            isFull: true
        },
        {
            qrCode: 'BIN_HAZ_001',
            binType: 'HAZARDOUS',
            latitude: 28.6135,
            longitude: 77.2085,
            ward: 'Ward A',
            locality: 'Green Society',
            capacity: 100,
            currentFill: 30,
            isFull: false
        },
        {
            qrCode: 'BIN_ORG_002',
            binType: 'ORGANIC',
            latitude: 28.6160,
            longitude: 77.2110,
            ward: 'Ward C',
            locality: 'Waste Warriors',
            capacity: 100,
            currentFill: 70,
            isFull: false
        },
        {
            qrCode: 'BIN_REC_002',
            binType: 'RECYCLABLE',
            latitude: 28.6140,
            longitude: 77.2080,
            ward: 'Ward A',
            locality: 'Green Society',
            capacity: 100,
            currentFill: 60,
            isFull: false
        },
        {
            qrCode: 'BIN_ORG_003',
            binType: 'ORGANIC',
            latitude: 28.6170,
            longitude: 77.2120,
            ward: 'Ward D',
            locality: 'Clean City',
            capacity: 100,
            currentFill: 15,
            isFull: false
        },
        {
            qrCode: 'BIN_REC_003',
            binType: 'RECYCLABLE',
            latitude: 28.6155,
            longitude: 77.2095,
            ward: 'Ward B',
            locality: 'Eco Colony',
            capacity: 100,
            currentFill: 80,
            isFull: false
        }
    ];

    for (const bin of bins) {
        await prisma.qRBin.upsert({
            where: { qrCode: bin.qrCode },
            update: bin,
            create: bin
        });
    }

    console.log(`✅ Seeded ${bins.length} QR bins`);
    return bins;
}

module.exports = seedBins;