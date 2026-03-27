const { prisma } = require('../database/db');
const { calculateDistance } = require('../utils/helpers');

exports.submitReport = async (req, res) => {
    try {
        const { location, description, latitude, longitude } = req.body;
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
        
        const report = await prisma.report.create({
            data: {
                userId: req.user.id,
                imageUrl,
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                description,
                status: 'PENDING'
            }
        });
        
        // Notify nearby collectors
        const nearbyCollectors = await prisma.user.findMany({
            where: {
                role: 'COLLECTOR',
                latitude: { not: null },
                longitude: { not: null }
            }
        });
        
        const collectorsToNotify = nearbyCollectors.filter(collector => {
            const distance = calculateDistance(
                latitude, longitude,
                collector.latitude, collector.longitude
            );
            return distance <= 2; // 2km radius
        });
        
        // Emit WebSocket events
        if (req.app.get('io')) {
            collectorsToNotify.forEach(collector => {
                req.app.get('io').to(`collector_${collector.id}`).emit('new-report', {
                    reportId: report.id,
                    location: description,
                    distance: calculateDistance(
                        latitude, longitude,
                        collector.latitude, collector.longitude
                    )
                });
            });
            
            req.app.get('io').emit('report-submitted', {
                reportId: report.id,
                location: description
            });
        }
        
        res.status(201).json({
            success: true,
            report,
            message: 'Report submitted successfully'
        });
        
    } catch (error) {
        console.error('Submit report error:', error);
        res.status(500).json({ error: 'Failed to submit report' });
    }
};

exports.getReports = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        
        const where = {};
        if (status) where.status = status;
        
        const reports = await prisma.report.findMany({
            where,
            include: {
                user: {
                    select: { name: true, email: true, phone: true }
                }
            },
            skip: (page - 1) * limit,
            take: parseInt(limit),
            orderBy: { createdAt: 'desc' }
        });
        
        const total = await prisma.report.count({ where });
        
        res.json({
            reports,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
        
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ error: 'Failed to get reports' });
    }
};

exports.getNearbyReports = async (req, res) => {
    try {
        const { lat, lng, radius = 5 } = req.query;
        
        const reports = await prisma.report.findMany({
            where: {
                status: 'PENDING'
            },
            include: {
                user: {
                    select: { name: true, phone: true }
                }
            }
        });
        
        // Filter by distance
        const nearbyReports = reports.filter(report => {
            const distance = calculateDistance(
                parseFloat(lat), parseFloat(lng),
                report.latitude, report.longitude
            );
            return distance <= parseFloat(radius);
        });
        
        res.json(nearbyReports);
        
    } catch (error) {
        console.error('Get nearby reports error:', error);
        res.status(500).json({ error: 'Failed to get nearby reports' });
    }
};

exports.getReportById = async (req, res) => {
    try {
        const report = await prisma.report.findUnique({
            where: { id: req.params.id },
            include: {
                user: {
                    select: { name: true, email: true, phone: true }
                }
            }
        });
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        res.json(report);
        
    } catch (error) {
        console.error('Get report error:', error);
        res.status(500).json({ error: 'Failed to get report' });
    }
};

exports.updateReportStatus = async (req, res) => {
    try {
        const { status } = req.body;
        
        const report = await prisma.report.update({
            where: { id: req.params.id },
            data: {
                status,
                resolvedAt: status === 'RESOLVED' ? new Date() : null
            }
        });
        
        // Notify user who submitted the report
        if (req.app.get('io')) {
            req.app.get('io').to(`user_${report.userId}`).emit('report-status-updated', {
                reportId: report.id,
                status: report.status
            });
        }
        
        res.json({ success: true, report });
        
    } catch (error) {
        console.error('Update report status error:', error);
        res.status(500).json({ error: 'Failed to update report status' });
    }
};

exports.getMyReports = async (req, res) => {
    try {
        const reports = await prisma.report.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' }
        });
        
        res.json(reports);
        
    } catch (error) {
        console.error('Get my reports error:', error);
        res.status(500).json({ error: 'Failed to get reports' });
    }
};