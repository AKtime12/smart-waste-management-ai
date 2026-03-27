/**
 * QR Bin Model
 * Represents waste bins with QR codes and sensors
 */

const { prisma } = require('../database/db');

class QRBinModel {
    /**
     * Create a new QR bin
     * @param {Object} binData - Bin data
     * @returns {Promise<Object>} Created bin
     */
    static async create(binData) {
        return await prisma.qRBin.create({
            data: {
                qrCode: binData.qrCode,
                binType: binData.binType,
                latitude: binData.latitude,
                longitude: binData.longitude,
                ward: binData.ward,
                locality: binData.locality,
                capacity: binData.capacity || 100,
                currentFill: binData.currentFill || 0,
                isFull: binData.isFull || false
            }
        });
    }

    /**
     * Find bin by ID
     * @param {string} id - Bin ID
     * @returns {Promise<Object>} Bin object
     */
    static async findById(id) {
        return await prisma.qRBin.findUnique({
            where: { id },
            include: {
                collections: {
                    orderBy: { collectionTime: 'desc' },
                    take: 20,
                    include: {
                        household: {
                            select: { name: true, address: true }
                        },
                        collector: {
                            select: { name: true }
                        }
                    }
                }
            }
        });
    }

    /**
     * Find bin by QR code
     * @param {string} qrCode - QR code
     * @returns {Promise<Object>} Bin object
     */
    static async findByQRCode(qrCode) {
        return await prisma.qRBin.findUnique({
            where: { qrCode }
        });
    }

    /**
     * Get all bins with filters
     * @param {Object} filters - Filter options
     * @returns {Promise<Array>} List of bins
     */
    static async findAll(filters = {}) {
        const { ward, binType, isFull, minFill, maxFill, page = 1, limit = 50 } = filters;
        
        const where = {};
        if (ward) where.ward = ward;
        if (binType) where.binType = binType;
        if (isFull !== undefined) where.isFull = isFull;
        if (minFill !== undefined) where.currentFill = { gte: minFill };
        if (maxFill !== undefined) where.currentFill = { ...where.currentFill, lte: maxFill };
        
        return await prisma.qRBin.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { currentFill: 'desc' }
        });
    }

    /**
     * Get bins by location (within radius)
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {number} radius - Radius in km
     * @returns {Promise<Array>} List of bins within radius
     */
    static async findByLocation(lat, lng, radius = 5) {
        // This is a simplified version. In production, use PostGIS or similar
        const bins = await prisma.qRBin.findMany();
        
        const { calculateDistance } = require('../utils/helpers');
        
        return bins.filter(bin => {
            const distance = calculateDistance(lat, lng, bin.latitude, bin.longitude);
            return distance <= radius;
        });
    }

    /**
     * Get bins that need collection (full or near full)
     * @returns {Promise<Array>} List of bins needing collection
     */
    static async getBinsNeedingCollection() {
        return await prisma.qRBin.findMany({
            where: {
                OR: [
                    { isFull: true },
                    { currentFill: { gte: 80 } }
                ]
            },
            orderBy: { currentFill: 'desc' }
        });
    }

    /**
     * Update bin status
     * @param {string} id - Bin ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Updated bin
     */
    static async update(id, updateData) {
        const data = {
            ...updateData,
            lastUpdated: new Date()
        };
        
        // Auto-set isFull based on fill level
        if (data.currentFill !== undefined) {
            data.isFull = data.currentFill >= 90;
        }
        
        return await prisma.qRBin.update({
            where: { id },
            data
        });
    }

    /**
     * Update bin fill level (from sensor)
     * @param {string} id - Bin ID
     * @param {number} fillLevel - New fill level
     * @returns {Promise<Object>} Updated bin
     */
    static async updateFillLevel(id, fillLevel) {
        const wasFull = await this.isFull(id);
        const isNowFull = fillLevel >= 90;
        
        const bin = await this.update(id, { currentFill: fillLevel });
        
        // If bin just became full, trigger alert
        if (!wasFull && isNowFull) {
            await this.triggerFullAlert(bin);
        }
        
        return bin;
    }

    /**
     * Check if bin is full
     * @param {string} id - Bin ID
     * @returns {Promise<boolean>} True if bin is full
     */
    static async isFull(id) {
        const bin = await prisma.qRBin.findUnique({
            where: { id },
            select: { isFull: true }
        });
        return bin?.isFull || false;
    }

    /**
     * Trigger bin full alert
     * @param {Object} bin - Bin object
     */
    static async triggerFullAlert(bin) {
        // This would emit WebSocket events and create notifications
        console.log(`⚠️ Bin ${bin.id} (${bin.locality}) is FULL!`);
        
        // In production, you would:
        // 1. Emit WebSocket event to collectors in the area
        // 2. Create notification records
        // 3. Send SMS alerts if configured
    }

    /**
     * Delete bin
     * @param {string} id - Bin ID
     * @returns {Promise<Object>} Deleted bin
     */
    static async delete(id) {
        return await prisma.qRBin.delete({
            where: { id }
        });
    }

    /**
     * Get bin statistics by ward
     * @returns {Promise<Array>} Ward statistics
     */
    static async getWardStats() {
        return await prisma.qRBin.groupBy({
            by: ['ward'],
            _count: { id: true },
            _avg: { currentFill: true },
            _sum: { capacity: true }
        });
    }

    /**
     * Get sensor history for bin
     * @param {string} id - Bin ID
     * @param {number} days - Number of days
     * @returns {Promise<Array>} Sensor data
     */
    static async getSensorHistory(id, days = 7) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        return await prisma.sensorData.findMany({
            where: {
                binId: id,
                timestamp: { gte: startDate }
            },
            orderBy: { timestamp: 'asc' }
        });
    }
}

module.exports = QRBinModel;