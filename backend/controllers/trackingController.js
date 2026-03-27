const { prisma } = require('../database/db');
const { calculateDistance } = require('../utils/helpers');

exports.getBinStatus = async (req, res) => {
    try {
        const bins = await prisma.qRBin.findMany({
            orderBy: { currentFill: 'desc' }
        });
        
        const summary = {
            totalBins: bins.length,
            fullBins: bins.filter(b => b.isFull).length,
            averageFill: bins.reduce((sum, b) => sum + b.currentFill, 0) / bins.length,
            bins: bins.map(b => ({
                id: b.id,
                type: b.binType,
                fillLevel: b.currentFill,
                isFull: b.isFull,
                location: { lat: b.latitude, lng: b.longitude },
                ward: b.ward,
                locality: b.locality,
                lastUpdated: b.lastUpdated
            }))
        };
        
        res.json(summary);
        
    } catch (error) {
        console.error('Get bin status error:', error);
        res.status(500).json({ error: 'Failed to get bin status' });
    }
};

exports.getActiveCollectors = async (req, res) => {
    try {
        const collectors = await prisma.user.findMany({
            where: {
                role: 'COLLECTOR',
                latitude: { not: null },
                longitude: { not: null }
            },
            include: {
                collections: {
                    take: 1,
                    orderBy: { collectionTime: 'desc' }
                }
            }
        });
        
        const activeCollectors = collectors.map(c => ({
            id: c.id,
            name: c.name,
            location: { lat: c.latitude, lng: c.longitude },
            lastCollection: c.collections[0]?.collectionTime,
            status: 'active'
        }));
        
        res.json(activeCollectors);
        
    } catch (error) {
        console.error('Get active collectors error:', error);
        res.status(500).json({ error: 'Failed to get active collectors' });
    }
};

exports.getLiveStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const [collectionsToday, activeCollectors, fullBins, pendingReports] = await Promise.all([
            prisma.collection.count({
                where: {
                    collectionTime: { gte: today }
                }
            }),
            prisma.user.count({
                where: {
                    role: 'COLLECTOR',
                    //latitude: { not: null }
                }
            }),
            prisma.qRBin.count({ where: { isFull: true } }),
            prisma.report.count({ where: { status: 'PENDING' } })
        ]);
        
        res.json({
            collectionsToday,
            activeCollectors,
            fullBins,
            pendingReports,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Get live stats error:', error);
        res.status(500).json({ error: 'Failed to get live stats' });
    }
};

exports.getCollectorRoute = async (req, res) => {
    try {
        const { collectorId } = req.params;
        
        const collector = await prisma.user.findUnique({
            where: { id: collectorId }
        });
        
        if (!collector) {
            return res.status(404).json({ error: 'Collector not found' });
        }
        
        const assignedBins = await prisma.qRBin.findMany({
            where: {
                OR: [
                    { isFull: true },
                    { currentFill: { gt: 70 } }
                ]
            },
            orderBy: { currentFill: 'desc' },
            take: 20
        });
        
        const route = {
            collector: {
                id: collector.id,
                name: collector.name,
                location: { lat: collector.latitude, lng: collector.longitude }
            },
            bins: assignedBins.map(b => ({
                id: b.id,
                type: b.binType,
                fillLevel: b.currentFill,
                location: { lat: b.latitude, lng: b.longitude },
                distance: calculateDistance(
                    collector.latitude, collector.longitude,
                    b.latitude, b.longitude
                )
            })),
            totalBins: assignedBins.length,
            estimatedTime: assignedBins.length * 5,
            estimatedDistance: assignedBins.reduce((sum, b) => sum + calculateDistance(
                collector.latitude, collector.longitude,
                b.latitude, b.longitude
            ), 0)
        };
        
        res.json(route);
        
    } catch (error) {
        console.error('Get collector route error:', error);
        res.status(500).json({ error: 'Failed to get collector route' });
    }
};

exports.updateCollectorLocation = async (req, res) => {
    try {
        const { lat, lng } = req.body;
        
        const collector = await prisma.user.update({
            where: { id: req.user.id },
            data: {
                latitude: lat,
                longitude: lng
            }
        });
        
        // Emit location update
        if (req.app.get('io')) {
            req.app.get('io').emit('collector-location-update', {
                collectorId: collector.id,
                location: { lat, lng },
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Update collector location error:', error);
        res.status(500).json({ error: 'Failed to update location' });
    }
};

exports.getBinHistory = async (req, res) => {
    try {
        const { binId } = req.params;
        
        const collections = await prisma.collection.findMany({
            where: { binId },
            include: {
                household: {
                    select: { name: true }
                },
                collector: {
                    select: { name: true }
                }
            },
            orderBy: { collectionTime: 'desc' },
            take: 20
        });
        
        const bin = await prisma.qRBin.findUnique({
            where: { id: binId }
        });
        
        res.json({
            bin,
            history: collections
        });
        
    } catch (error) {
        console.error('Get bin history error:', error);
        res.status(500).json({ error: 'Failed to get bin history' });
    }
};