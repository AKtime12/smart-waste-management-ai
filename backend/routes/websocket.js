const socketIO = require('socket.io');

class WebSocketManager {
    constructor(server) {
        this.io = socketIO(server, {
            cors: {
                origin: process.env.FRONTEND_URL || 'http://localhost:3000',
                methods: ['GET', 'POST'],
                credentials: true
            },
            pingTimeout: 60000,
            pingInterval: 25000
        });
        
        this.connectedClients = new Map(); // Store connected clients by socketId
        this.userSockets = new Map();       // Store socket IDs by userId
        this.collectorLocations = new Map(); // Store collector locations
        this.binSubscribers = new Map();     // Store bin subscribers
        this.areaCollectors = new Map();     // Store collectors by area
        
        this.init();
    }
    
    init() {
        this.io.on('connection', (socket) => {
            console.log(`🔌 New client connected: ${socket.id}`);
            
            // Authentication
            socket.on('authenticate', (data) => this.handleAuthentication(socket, data));
            
            // User room joining
            socket.on('join', (userId) => this.handleJoinRoom(socket, userId));
            
            // Collector events
            socket.on('collector:location-update', (data) => this.handleCollectorLocationUpdate(socket, data));
            socket.on('collector:start-route', (data) => this.handleStartRoute(socket, data));
            socket.on('collector:complete-collection', (data) => this.handleCompleteCollection(socket, data));
            socket.on('collector:emergency', (data) => this.handleCollectorEmergency(socket, data));
            
            // Bin events
            socket.on('bin:update', (data) => this.handleBinUpdate(socket, data));
            socket.on('bin:subscribe', (binId) => this.handleBinSubscribe(socket, binId));
            socket.on('bin:unsubscribe', (binId) => this.handleBinUnsubscribe(socket, binId));
            socket.on('bin:report-issue', (data) => this.handleBinIssue(socket, data));
            
            // Report events
            socket.on('report:submit', (data) => this.handleReportSubmit(socket, data));
            socket.on('report:update-status', (data) => this.handleReportStatusUpdate(socket, data));
            
            // Points and rewards events
            socket.on('points:update', (data) => this.handlePointsUpdate(socket, data));
            socket.on('reward:redeem', (data) => this.handleRewardRedeem(socket, data));
            
            // Admin events
            socket.on('admin:get-stats', () => this.handleAdminStatsRequest(socket));
            socket.on('admin:get-predictions', () => this.handlePredictionsRequest(socket));
            socket.on('admin:assign-collector', (data) => this.handleAssignCollector(socket, data));
            
            // Chat events
            socket.on('chat:message', (data) => this.handleChatMessage(socket, data));
            socket.on('chat:join-room', (room) => this.handleChatJoin(socket, room));
            
            // Disconnect
            socket.on('disconnect', () => this.handleDisconnect(socket));
        });
        
        // Start periodic broadcasts
        this.startPeriodicBroadcasts();
    }
    
    // =============================================
    // Authentication & Room Management
    // =============================================
    
    handleAuthentication(socket, data) {
        const { userId, role, token, name, area, latitude, longitude } = data;
        
        if (!userId || !token) {
            socket.emit('error', { message: 'Authentication failed: Missing credentials' });
            return;
        }
        
        // Store client info
        const clientInfo = {
            socketId: socket.id,
            userId: userId,
            role: role,
            name: name,
            area: area,
            latitude: latitude,
            longitude: longitude,
            connectedAt: new Date()
        };
        
        this.connectedClients.set(socket.id, clientInfo);
        
        // Map userId to socketId
        if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId).add(socket.id);
        
        // Join user-specific room
        socket.join(`user_${userId}`);
        
        // Join role-specific room
        socket.join(`role_${role}`);
        
        // For collectors, join area-specific room
        if (role === 'COLLECTOR' && area) {
            socket.join(`area_${area}`);
            if (!this.areaCollectors.has(area)) {
                this.areaCollectors.set(area, new Set());
            }
            this.areaCollectors.get(area).add(socket.id);
            
            // Store location
            if (latitude && longitude) {
                this.collectorLocations.set(userId, {
                    lat: latitude,
                    lng: longitude,
                    lastUpdate: new Date(),
                    socketId: socket.id
                });
            }
        }
        
        socket.emit('authenticated', {
            success: true,
            message: 'Authenticated successfully',
            socketId: socket.id,
            connectedAt: new Date()
        });
        
        // Broadcast user online status
        this.broadcast('user:online', {
            userId: userId,
            role: role,
            name: name,
            timestamp: new Date()
        });
        
        console.log(`✅ User ${userId} (${role}) authenticated`);
    }
    
    handleJoinRoom(socket, userId) {
        if (userId) {
            socket.join(`user_${userId}`);
            socket.emit('room-joined', { 
                room: `user_${userId}`,
                success: true 
            });
        }
    }
    
    // =============================================
    // Collector Events
    // =============================================
    
    handleCollectorLocationUpdate(socket, data) {
        const { collectorId, latitude, longitude, routeProgress, speed, bearing } = data;
        
        // Update stored location
        this.collectorLocations.set(collectorId, {
            lat: latitude,
            lng: longitude,
            routeProgress: routeProgress || 0,
            speed: speed || 0,
            bearing: bearing || 0,
            lastUpdate: new Date()
        });
        
        // Get collector info
        const collector = this.getClientByUserId(collectorId);
        
        // Broadcast to admin and tracking page
        this.broadcast('collector:location-changed', {
            collectorId: collectorId,
            name: collector?.name || 'Collector',
            location: { lat: latitude, lng: longitude },
            routeProgress: routeProgress,
            speed: speed,
            bearing: bearing,
            timestamp: new Date()
        });
        
        // Also send to specific area
        if (collector && collector.area) {
            this.io.to(`area_${collector.area}`).emit('collector:nearby', {
                collectorId: collectorId,
                location: { lat: latitude, lng: longitude },
                distance: null
            });
        }
    }
    
    handleStartRoute(socket, data) {
        const { collectorId, route, totalBins, estimatedTime, routeId } = data;
        
        // Store active route
        if (!this.activeRoutes) this.activeRoutes = new Map();
        this.activeRoutes.set(collectorId, {
            routeId: routeId,
            route: route,
            totalBins: totalBins,
            completedBins: 0,
            estimatedTime: estimatedTime,
            startTime: new Date(),
            status: 'active'
        });
        
        // Notify admin
        this.io.to('role_ADMIN').emit('collector:route-started', {
            collectorId: collectorId,
            routeId: routeId,
            route: route,
            totalBins: totalBins,
            estimatedTime: estimatedTime,
            startedAt: new Date()
        });
        
        // Notify area residents
        const collector = this.getClientByUserId(collectorId);
        if (collector && collector.area) {
            this.io.to(`area_${collector.area}`).emit('collector:approaching', {
                collectorId: collectorId,
                estimatedArrival: estimatedTime,
                message: `🚛 Collector will be in your area in approximately ${estimatedTime} minutes`,
                routeId: routeId
            });
        }
        
        socket.emit('route-started', { 
            success: true, 
            routeId: routeId,
            message: 'Route started successfully'
        });
    }
    
    handleCompleteCollection(socket, data) {
        const { collectorId, binId, householdId, points, wasteWeight, segregationQuality, imageUrl, notes } = data;
        
        // Update route progress
        if (this.activeRoutes && this.activeRoutes.has(collectorId)) {
            const route = this.activeRoutes.get(collectorId);
            route.completedBins++;
            this.activeRoutes.set(collectorId, route);
            
            // Check if route is complete
            if (route.completedBins >= route.totalBins) {
                this.handleRouteComplete(collectorId, route);
            }
        }
        
        // Notify household
        if (householdId) {
            this.emitToUser(householdId, 'collection:completed', {
                collectorId: collectorId,
                binId: binId,
                points: points,
                wasteWeight: wasteWeight,
                quality: segregationQuality,
                imageUrl: imageUrl,
                message: `🎉 You earned +${points} points for ${segregationQuality} segregation!`,
                timestamp: new Date()
            });
            
            // Send push notification
            this.sendPushNotification(householdId, {
                title: 'Collection Completed! 🎉',
                body: `You earned +${points} points for proper waste segregation`,
                icon: '/assets/icons/icon-192x192.png',
                url: '/dashboard/household.html',
                data: { points, quality: segregationQuality }
            });
        }
        
        // Update bin status for subscribers
        this.io.to(`bin_${binId}`).emit('bin:collected', {
            binId: binId,
            collectorId: collectorId,
            weight: wasteWeight,
            quality: segregationQuality,
            timestamp: new Date(),
            fillLevel: 0
        });
        
        // Notify admin
        this.io.to('role_ADMIN').emit('collection:completed', {
            collectorId: collectorId,
            binId: binId,
            householdId: householdId,
            points: points,
            weight: wasteWeight,
            quality: segregationQuality,
            timestamp: new Date()
        });
        
        // Create notification in database (would be saved to DB)
        this.createNotification({
            userId: householdId,
            title: 'Collection Completed',
            message: `Your waste was collected. +${points} points earned!`,
            type: 'collection',
            data: { points, quality: segregationQuality }
        });
        
        // Update leaderboard
        this.updateLeaderboard();
        
        socket.emit('collection-recorded', {
            success: true,
            points: points,
            message: `Collection recorded successfully! +${points} points`
        });
    }
    
    handleRouteComplete(collectorId, route) {
        const duration = Math.floor((new Date() - route.startTime) / 60000); // minutes
        
        // Notify admin
        this.io.to('role_ADMIN').emit('collector:route-completed', {
            collectorId: collectorId,
            routeId: route.routeId,
            totalBins: route.totalBins,
            completedBins: route.completedBins,
            duration: duration,
            completedAt: new Date()
        });
        
        // Notify collector
        this.emitToUser(collectorId, 'collector:route-completed', {
            routeId: route.routeId,
            totalBins: route.totalBins,
            duration: duration,
            message: `✅ Route completed! You collected ${route.totalBins} bins in ${duration} minutes.`
        });
        
        // Clear active route
        this.activeRoutes.delete(collectorId);
    }
    
    handleCollectorEmergency(socket, data) {
        const { collectorId, emergencyType, location, message } = data;
        
        // Notify admin immediately
        this.io.to('role_ADMIN').emit('collector:emergency', {
            collectorId: collectorId,
            emergencyType: emergencyType,
            location: location,
            message: message,
            timestamp: new Date(),
            urgent: true
        });
        
        // Also notify nearby collectors
        this.broadcast('collector:emergency-nearby', {
            collectorId: collectorId,
            location: location,
            message: `🚨 Emergency alert from collector! Type: ${emergencyType}`,
            timestamp: new Date()
        });
        
        // Create urgent notification
        this.createNotification({
            title: '🚨 Collector Emergency',
            message: `Collector ${collectorId} reported: ${message || emergencyType}`,
            type: 'emergency',
            priority: 'high'
        });
        
        socket.emit('emergency-reported', { success: true });
    }
    
    // =============================================
    // Bin Events
    // =============================================
    
    handleBinUpdate(socket, data) {
        const { binId, fillLevel, isFull, location, temperature, humidity, lastUpdated } = data;
        
        // Check if bin just became full
        const wasFull = this.binStatus?.get(binId)?.isFull || false;
        
        // Store bin status
        if (!this.binStatus) this.binStatus = new Map();
        this.binStatus.set(binId, {
            fillLevel: fillLevel,
            isFull: isFull,
            location: location,
            temperature: temperature,
            humidity: humidity,
            lastUpdated: lastUpdated || new Date()
        });
        
        // Broadcast to bin subscribers
        this.io.to(`bin_${binId}`).emit('bin:status-update', {
            binId: binId,
            fillLevel: fillLevel,
            isFull: isFull,
            location: location,
            temperature: temperature,
            humidity: humidity,
            timestamp: new Date()
        });
        
        // If bin becomes full, trigger alerts
        if (isFull && !wasFull) {
            this.handleBinFull(binId, fillLevel, location);
        }
        
        // If bin fill level crosses 80%, send warning
        if (fillLevel >= 80 && fillLevel < 90) {
            this.handleBinWarning(binId, fillLevel, location);
        }
        
        // Broadcast general bin update
        this.broadcast('bin:update', {
            binId: binId,
            fillLevel: fillLevel,
            isFull: isFull,
            location: location,
            timestamp: new Date()
        });
    }
    
    handleBinFull(binId, fillLevel, location) {
        // Notify all collectors in the area
        this.io.to('role_COLLECTOR').emit('bin:urgent', {
            binId: binId,
            fillLevel: fillLevel,
            location: location,
            message: `⚠️ URGENT: Bin at ${location.locality || location} is ${fillLevel}% full! Needs immediate collection.`,
            priority: 'high',
            timestamp: new Date()
        });
        
        // Notify admin
        this.io.to('role_ADMIN').emit('bin:full-alert', {
            binId: binId,
            fillLevel: fillLevel,
            location: location,
            timestamp: new Date()
        });
        
        // Create notification
        this.createNotification({
            title: '⚠️ Bin Full Alert',
            message: `Bin at ${location.locality || location} is ${fillLevel}% full and needs immediate collection`,
            type: 'bin_full',
            priority: 'high',
            data: { binId, fillLevel, location }
        });
    }
    
    handleBinWarning(binId, fillLevel, location) {
        // Notify collectors about bin getting full
        this.io.to('role_COLLECTOR').emit('bin:warning', {
            binId: binId,
            fillLevel: fillLevel,
            location: location,
            message: `⚠️ Bin at ${location.locality || location} is ${fillLevel}% full. Schedule collection soon.`,
            priority: 'medium',
            timestamp: new Date()
        });
    }
    
    handleBinSubscribe(socket, binId) {
        socket.join(`bin_${binId}`);
        
        if (!this.binSubscribers.has(binId)) {
            this.binSubscribers.set(binId, new Set());
        }
        this.binSubscribers.get(binId).add(socket.id);
        
        // Send current bin status immediately
        if (this.binStatus && this.binStatus.has(binId)) {
            const status = this.binStatus.get(binId);
            socket.emit('bin:current-status', {
                binId: binId,
                ...status
            });
        }
        
        socket.emit('bin:subscribed', { 
            binId: binId,
            success: true 
        });
    }
    
    handleBinUnsubscribe(socket, binId) {
        socket.leave(`bin_${binId}`);
        
        if (this.binSubscribers.has(binId)) {
            this.binSubscribers.get(binId).delete(socket.id);
        }
        
        socket.emit('bin:unsubscribed', { 
            binId: binId,
            success: true 
        });
    }
    
    handleBinIssue(socket, data) {
        const { binId, issueType, description, imageUrl } = data;
        
        // Notify admin
        this.io.to('role_ADMIN').emit('bin:issue-reported', {
            binId: binId,
            issueType: issueType,
            description: description,
            imageUrl: imageUrl,
            reportedBy: this.getClientBySocketId(socket.id)?.userId,
            timestamp: new Date()
        });
        
        // Notify maintenance team
        this.io.to('role_MAINTENANCE').emit('bin:maintenance-needed', {
            binId: binId,
            issueType: issueType,
            description: description,
            timestamp: new Date()
        });
        
        socket.emit('issue-reported', { 
            success: true,
            message: 'Issue reported successfully' 
        });
    }
    
    // =============================================
    // Report Events
    // =============================================
    
    handleReportSubmit(socket, data) {
        const { reportId, userId, location, description, imageUrl, latitude, longitude, reportType } = data;
        
        // Notify nearby collectors
        this.notifyNearbyCollectors(latitude, longitude, {
            reportId: reportId,
            location: location,
            description: description,
            imageUrl: imageUrl,
            reportType: reportType,
            timestamp: new Date()
        });
        
        // Notify admin
        this.io.to('role_ADMIN').emit('report:new', {
            reportId: reportId,
            userId: userId,
            location: location,
            description: description,
            imageUrl: imageUrl,
            reportType: reportType,
            timestamp: new Date()
        });
        
        // Confirm to user
        this.emitToUser(userId, 'report:submitted', {
            reportId: reportId,
            message: 'Your report has been submitted. Authorities have been notified.',
            timestamp: new Date()
        });
        
        // Create notification
        this.createNotification({
            title: 'New Report Submitted',
            message: `A new ${reportType} report has been submitted at ${location}`,
            type: 'report',
            data: { reportId, location }
        });
        
        socket.emit('report-submitted', { 
            success: true,
            reportId: reportId 
        });
    }
    
    handleReportStatusUpdate(socket, data) {
        const { reportId, status, resolvedBy, notes, resolutionImage } = data;
        
        // Broadcast status update
        this.broadcast('report:status-updated', {
            reportId: reportId,
            status: status,
            resolvedBy: resolvedBy,
            notes: notes,
            resolutionImage: resolutionImage,
            timestamp: new Date()
        });
        
        // Notify the user who submitted the report
        if (data.userId) {
            const statusMessages = {
                'IN_PROGRESS': 'Your report is being addressed',
                'RESOLVED': 'Your reported issue has been resolved. Thank you!',
                'REJECTED': 'Your report was reviewed and could not be verified'
            };
            
            this.emitToUser(data.userId, 'report:status-updated', {
                reportId: reportId,
                status: status,
                message: statusMessages[status] || `Report status updated to: ${status}`,
                notes: notes,
                timestamp: new Date()
            });
        }
        
        socket.emit('status-updated', { success: true });
    }
    
    // =============================================
    // Points & Rewards Events
    // =============================================
    
    handlePointsUpdate(socket, data) {
        const { userId, points, reason, newTotal, transactionId } = data;
        
        // Notify user
        this.emitToUser(userId, 'points:updated', {
            points: points,
            reason: reason,
            newTotal: newTotal,
            transactionId: transactionId,
            timestamp: new Date()
        });
        
        // Check for tier upgrade
        const newTier = this.checkTierUpgrade(newTotal);
        if (newTier) {
            this.emitToUser(userId, 'points:tier-upgrade', {
                tier: newTier,
                points: newTotal,
                message: `🎉 Congratulations! You've reached ${newTier} Tier!`,
                benefits: this.getTierBenefits(newTier),
                timestamp: new Date()
            });
        }
        
        // Update leaderboard
        this.updateLeaderboard();
        
        // Create notification
        this.createNotification({
            userId: userId,
            title: 'Points Earned!',
            message: `You earned ${points} points for ${reason}`,
            type: 'points',
            data: { points, newTotal, reason }
        });
        
        socket.emit('points-updated', { success: true });
    }
    
    handleRewardRedeem(socket, data) {
        const { userId, rewardId, rewardName, points, status, redemptionCode, expiresAt } = data;
        
        // Notify user
        this.emitToUser(userId, 'reward:redeemed', {
            rewardId: rewardId,
            rewardName: rewardName,
            points: points,
            status: status,
            redemptionCode: redemptionCode,
            expiresAt: expiresAt,
            message: `You successfully redeemed ${rewardName} for ${points} points!`,
            timestamp: new Date()
        });
        
        // Notify admin
        this.io.to('role_ADMIN').emit('reward:redeemed', {
            userId: userId,
            rewardId: rewardId,
            rewardName: rewardName,
            points: points,
            timestamp: new Date()
        });
        
        // Create notification
        this.createNotification({
            userId: userId,
            title: 'Reward Redeemed! 🎁',
            message: `You redeemed ${rewardName} for ${points} points`,
            type: 'reward',
            data: { rewardId, rewardName, points, redemptionCode }
        });
        
        socket.emit('reward-redeemed', { 
            success: true,
            redemptionCode: redemptionCode 
        });
    }
    
    checkTierUpgrade(points) {
        if (points >= 1000) return 'PLATINUM';
        if (points >= 500) return 'GOLD';
        if (points >= 200) return 'SILVER';
        if (points >= 100) return 'BRONZE';
        return null;
    }
    
    getTierBenefits(tier) {
        const benefits = {
            'PLATINUM': ['30% discount on all rewards', 'Priority collection', 'Exclusive events', 'Free eco-products'],
            'GOLD': ['20% discount on all rewards', 'Priority collection', 'Exclusive offers'],
            'SILVER': ['10% discount on rewards', 'Priority collection'],
            'BRONZE': ['5% discount on selected rewards', 'Early access to new rewards']
        };
        return benefits[tier] || [];
    }
    
    // =============================================
    // Admin Events
    // =============================================
    
    handleAdminStatsRequest(socket) {
        const stats = {
            totalUsers: this.userSockets.size,
            activeCollectors: Array.from(this.connectedClients.values())
                .filter(c => c.role === 'COLLECTOR').length,
            activeHouseholds: Array.from(this.connectedClients.values())
                .filter(c => c.role === 'HOUSEHOLD').length,
            onlineAdmins: Array.from(this.connectedClients.values())
                .filter(c => c.role === 'ADMIN').length,
            fullBins: this.binStatus ? Array.from(this.binStatus.values())
                .filter(b => b.isFull).length : 0,
            activeRoutes: this.activeRoutes ? this.activeRoutes.size : 0,
            timestamp: new Date()
        };
        
        socket.emit('admin:stats', stats);
    }
    
    handlePredictionsRequest(socket) {
        const predictions = this.generatePredictions();
        socket.emit('admin:predictions', predictions);
    }
    
    handleAssignCollector(socket, data) {
        const { collectorId, area, binIds, routeId } = data;
        
        // Update collector's area
        const collector = this.getClientByUserId(collectorId);
        if (collector) {
            collector.area = area;
            this.connectedClients.set(collector.socketId, collector);
            
            // Join area room
            const collectorSocket = this.io.sockets.sockets.get(collector.socketId);
            if (collectorSocket) {
                collectorSocket.join(`area_${area}`);
            }
            
            // Update area collectors map
            if (!this.areaCollectors.has(area)) {
                this.areaCollectors.set(area, new Set());
            }
            this.areaCollectors.get(area).add(collector.socketId);
        }
        
        // Notify collector
        this.emitToUser(collectorId, 'collector:assigned', {
            area: area,
            binIds: binIds,
            routeId: routeId,
            message: `You have been assigned to ${area} area with ${binIds.length} bins`,
            timestamp: new Date()
        });
        
        // Notify admin
        socket.emit('collector-assigned', { 
            success: true,
            collectorId: collectorId,
            area: area 
        });
    }
    
    // =============================================
    // Chat Events
    // =============================================
    
    handleChatMessage(socket, data) {
        const { room, message, userId, userName } = data;
        
        const chatMessage = {
            id: Date.now().toString(),
            userId: userId,
            userName: userName,
            message: message,
            timestamp: new Date(),
            room: room
        };
        
        if (room === 'global') {
            this.broadcast('chat:message', chatMessage);
        } else {
            this.io.to(room).emit('chat:message', chatMessage);
        }
        
        // Store message (would save to DB)
        console.log(`💬 Chat message in ${room}: ${userName}: ${message}`);
    }
    
    handleChatJoin(socket, room) {
        socket.join(room);
        socket.emit('chat:joined', { room: room, success: true });
    }
    
    // =============================================
    // Helper Methods
    // =============================================
    
    async notifyNearbyCollectors(latitude, longitude, report) {
        const collectors = Array.from(this.connectedClients.values())
            .filter(client => client.role === 'COLLECTOR' && client.latitude && client.longitude);
        
        const nearbyCollectors = [];
        
        collectors.forEach(collector => {
            const distance = this.calculateDistance(
                latitude, longitude,
                collector.latitude, collector.longitude
            );
            
            if (distance <= 2) { // Within 2km
                nearbyCollectors.push({
                    collectorId: collector.userId,
                    distance: distance.toFixed(1)
                });
                
                this.emitToUser(collector.userId, 'report:nearby', {
                    ...report,
                    distance: distance.toFixed(1),
                    message: `📋 New waste report ${distance.toFixed(1)}km away from your location`
                });
            }
        });
        
        return nearbyCollectors;
    }
    
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    generatePredictions() {
        const predictions = [];
        const areas = ['Downtown', 'Suburb', 'Industrial', 'Residential', 'Commercial'];
        const festivals = [
            { name: 'Diwali', date: '2024-10-31', multiplier: 2.5 },
            { name: 'Christmas', date: '2024-12-25', multiplier: 1.8 },
            { name: 'New Year', date: '2025-01-01', multiplier: 2.0 }
        ];
        
        for (let i = 1; i <= 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const festival = festivals.find(f => f.date === dateStr);
            
            predictions.push({
                date: date.toLocaleDateString(),
                isWeekend: isWeekend,
                festival: festival ? festival.name : null,
                predictions: areas.map(area => ({
                    area: area,
                    predictedWaste: Math.floor(Math.random() * 500) + 200,
                    requiredTrucks: Math.floor(Math.random() * 5) + 2,
                    confidence: 0.75 + Math.random() * 0.2,
                    recommendation: this.getRecommendation(area, isWeekend, festival)
                }))
            });
        }
        
        return predictions;
    }
    
    getRecommendation(area, isWeekend, festival) {
        if (festival) return `Increase collection by 2x for ${festival.name} celebrations`;
        if (isWeekend) return `Add 1 extra truck for weekend collection`;
        if (area === 'Downtown') return `Monitor commercial waste volume`;
        return `Regular collection sufficient`;
    }
    
    startPeriodicBroadcasts() {
        // Broadcast live stats every 30 seconds
        setInterval(() => {
            const stats = {
                totalOnline: this.connectedClients.size,
                activeCollectors: Array.from(this.connectedClients.values())
                    .filter(c => c.role === 'COLLECTOR').length,
                activeHouseholds: Array.from(this.connectedClients.values())
                    .filter(c => c.role === 'HOUSEHOLD').length,
                timestamp: new Date()
            };
            this.broadcast('system:stats', stats);
        }, 30000);
        
        // Broadcast active collector locations every 10 seconds
        setInterval(() => {
            const locations = Array.from(this.collectorLocations.entries()).map(([id, loc]) => ({
                collectorId: id,
                location: { lat: loc.lat, lng: loc.lng },
                lastUpdate: loc.lastUpdate
            }));
            this.broadcast('collector:locations', locations);
        }, 10000);
    }
    
    async createNotification(data) {
        // In production, save to database
        console.log('📢 Notification:', data);
        
        // Broadcast if system-wide
        if (!data.userId) {
            this.broadcast('notification:new', data);
        } else {
            this.emitToUser(data.userId, 'notification:new', data);
        }
    }
    
    async sendPushNotification(userId, notification) {
        // In production, send actual push notification
        console.log(`📱 Push to ${userId}:`, notification);
        
        // Emit via WebSocket as fallback
        this.emitToUser(userId, 'push:notification', notification);
    }
    
    updateLeaderboard() {
        this.broadcast('leaderboard:updated', {
            timestamp: new Date(),
            message: 'Leaderboard has been updated'
        });
    }
    
    // =============================================
    // Utility Methods
    // =============================================
    
    getClientBySocketId(socketId) {
        return this.connectedClients.get(socketId);
    }
    
    getClientByUserId(userId) {
        const socketIds = this.userSockets.get(userId);
        if (socketIds && socketIds.size > 0) {
            const firstSocketId = Array.from(socketIds)[0];
            return this.connectedClients.get(firstSocketId);
        }
        return null;
    }
    
    emitToUser(userId, event, data) {
        this.io.to(`user_${userId}`).emit(event, data);
    }
    
    emitToRole(role, event, data) {
        this.io.to(`role_${role}`).emit(event, data);
    }
    
    emitToArea(area, event, data) {
        this.io.to(`area_${area}`).emit(event, data);
    }
    
    emitToBin(binId, event, data) {
        this.io.to(`bin_${binId}`).emit(event, data);
    }
    
    broadcast(event, data) {
        this.io.emit(event, data);
    }
    
    handleDisconnect(socket) {
        console.log(`🔌 Client disconnected: ${socket.id}`);
        
        const client = this.connectedClients.get(socket.id);
        if (client) {
            // Remove from user sockets map
            const userSockets = this.userSockets.get(client.userId);
            if (userSockets) {
                userSockets.delete(socket.id);
                if (userSockets.size === 0) {
                    this.userSockets.delete(client.userId);
                }
            }
            
            // Remove from area collectors if collector
            if (client.role === 'COLLECTOR' && client.area) {
                const areaCollectors = this.areaCollectors.get(client.area);
                if (areaCollectors) {
                    areaCollectors.delete(socket.id);
                }
                this.collectorLocations.delete(client.userId);
            }
            
            // Remove from connected clients
            this.connectedClients.delete(socket.id);
            
            // Broadcast user offline status
            this.broadcast('user:offline', {
                userId: client.userId,
                role: client.role,
                name: client.name,
                timestamp: new Date()
            });
            
            console.log(`User ${client.userId} (${client.role}) disconnected`);
        }
        
        // Remove from bin subscribers
        for (const [binId, subscribers] of this.binSubscribers) {
            if (subscribers.has(socket.id)) {
                subscribers.delete(socket.id);
            }
        }
    }
    
    getConnectedClients() {
        return Array.from(this.connectedClients.values());
    }
    
    getActiveCollectorLocations() {
        return Array.from(this.collectorLocations.entries()).map(([id, loc]) => ({
            collectorId: id,
            location: { lat: loc.lat, lng: loc.lng },
            lastUpdate: loc.lastUpdate,
            routeProgress: loc.routeProgress
        }));
    }
    
    getBinStatus() {
        return this.binStatus ? Array.from(this.binStatus.entries()) : [];
    }
    
    getActiveRoutes() {
        return this.activeRoutes ? Array.from(this.activeRoutes.entries()) : [];
    }
}

module.exports = WebSocketManager;