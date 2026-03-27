// backend/services/sensorService.js
class SensorService {
    constructor() {
        this.bins = [];
        this.sensorIntervals = [];
    }

    // Initialize sensors for all public bins
    async initializeSensors(bins) {
        this.bins = bins;
        
        // Start monitoring each bin
        bins.forEach(bin => {
            this.monitorBin(bin);
        });
        
        console.log(`✅ Monitoring ${bins.length} bins`);
    }

    // Monitor a single bin with simulated sensor data
    monitorBin(bin) {
        // Update every 30 seconds
        const interval = setInterval(() => {
            this.updateBinFillLevel(bin);
        }, 30000);
        
        this.sensorIntervals.push(interval);
    }

    // Simulate sensor reading
    async updateBinFillLevel(bin) {
        try {
            // Simulate gradual filling
            let newFillLevel = bin.currentFill + (Math.random() * 2);
            
            // Add random usage spikes
            if (Math.random() > 0.8) {
                newFillLevel += Math.random() * 5;
            }
            
            newFillLevel = Math.min(newFillLevel, 100);
            
            // Check if bin just became full
            const wasFull = bin.currentFill >= 90;
            const isNowFull = newFillLevel >= 90;
            
            // Update bin
            bin.currentFill = newFillLevel;
            bin.isFull = newFillLevel >= 90;
            bin.lastUpdated = new Date();
            
            // Save to database
            await this.saveBinStatus(bin);
            
            // Trigger alerts if needed
            if (!wasFull && isNowFull) {
                await this.handleBinFull(bin);
            }
            
            // Send real-time update
            this.sendBinUpdate(bin);
            
            return bin;
            
        } catch (error) {
            console.error(`Sensor error for bin ${bin.id}:`, error);
        }
    }

    // Handle bin full event
    async handleBinFull(bin) {
        console.log(`⚠️ Bin ${bin.id} is FULL! (${bin.currentFill}%)`);
        
        // Create urgent collection request
        const collectionRequest = {
            binId: bin.id,
            location: { lat: bin.latitude, lng: bin.longitude },
            fillLevel: bin.currentFill,
            urgency: 'HIGH',
            timestamp: new Date(),
            estimatedWaste: bin.capacity * (bin.currentFill / 100)
        };
        
        // Find nearby collectors
        const nearbyCollectors = await this.findNearbyCollectors(bin);
        
        // Notify collectors
        await this.notifyCollectors(nearbyCollectors, collectionRequest);
        
        // Add to admin dashboard
        await this.addToUrgentList(collectionRequest);
        
        // Trigger route re-optimization
        await this.triggerRouteOptimization(bin);
        
        return collectionRequest;
    }

    // Find collectors within 2km radius
    async findNearbyCollectors(bin) {
        try {
            const collectors = await this.getActiveCollectors();
            
            const nearby = collectors.filter(collector => {
                const distance = this.calculateDistance(
                    bin.latitude, bin.longitude,
                    collector.latitude, collector.longitude
                );
                return distance <= 2; // 2km radius
            });
            
            return nearby.sort((a, b) => a.distance - b.distance);
            
        } catch (error) {
            console.error('Error finding nearby collectors:', error);
            return [];
        }
    }

    // Send push notification to collectors
    async notifyCollectors(collectors, collectionRequest) {
        collectors.forEach(collector => {
            // Send WebSocket notification
            if (global.io) {
                global.io.to(`collector_${collector.id}`).emit('urgent-collection', {
                    binId: collectionRequest.binId,
                    location: collectionRequest.location,
                    fillLevel: collectionRequest.fillLevel,
                    urgency: collectionRequest.urgency,
                    estimatedWaste: collectionRequest.estimatedWaste,
                    distance: collector.distance
                });
            }
            
            // Send SMS if configured
            if (collector.phone) {
                this.sendSMS(collector.phone, `Urgent: Bin full at ${collectionRequest.location}. Needs immediate collection!`);
            }
        });
        
        console.log(`📢 Notified ${collectors.length} collectors about full bin`);
    }

    // Trigger route re-optimization
    async triggerRouteOptimization(fullBin) {
        // Get all full bins
        const fullBins = await this.getFullBins();
        
        // Get active collectors
        const collectors = await this.getActiveCollectors();
        
        // Re-optimize routes for all collectors
        for (let collector of collectors) {
            const nearbyBins = fullBins.filter(bin => 
                this.calculateDistance(
                    collector.latitude, collector.longitude,
                    bin.latitude, bin.longitude
                ) <= 5
            );
            
            if (nearbyBins.length > 0) {
                await this.optimizeCollectorRoute(collector, nearbyBins);
            }
        }
    }

    // Calculate distance between two points (Haversine formula)
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    toRad(degrees) {
        return degrees * Math.PI / 180;
    }

    // Save bin status to database
    async saveBinStatus(bin) {
        // Implementation depends on your database
        // For now, just log
        console.log(`💾 Bin ${bin.id} updated: ${bin.currentFill}% full`);
    }

    // Send real-time update via WebSocket
    sendBinUpdate(bin) {
        if (global.io) {
            global.io.emit('bin-update', {
                id: bin.id,
                fillLevel: bin.currentFill,
                isFull: bin.isFull,
                location: { lat: bin.latitude, lng: bin.longitude },
                timestamp: new Date()
            });
        }
    }

    // Send SMS (placeholder)
    async sendSMS(phoneNumber, message) {
        console.log(`📱 SMS to ${phoneNumber}: ${message}`);
        // Integrate Twilio or other SMS service here
    }

    // Get active collectors from database
    async getActiveCollectors() {
        // Implementation depends on your database
        return [];
    }

    // Get all full bins
    async getFullBins() {
        return this.bins.filter(bin => bin.isFull);
    }

    // Optimize collector route
    async optimizeCollectorRoute(collector, bins) {
        // Call route optimization service
        console.log(`🔄 Optimizing route for collector ${collector.id} with ${bins.length} bins`);
    }

    // Add to urgent list
    async addToUrgentList(collectionRequest) {
        if (global.io) {
            global.io.emit('urgent-bin-added', collectionRequest);
        }
    }
}

module.exports = SensorService;