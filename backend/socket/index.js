/**
 * WebSocket Server - Real-time Communication Hub
 * Handles all WebSocket connections, events, and real-time data synchronization
 */

const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');

class SocketServer {
    constructor(server, options = {}) {
        this.io = socketIO(server, {
            cors: {
                origin: options.corsOrigin || process.env.FRONTEND_URL || 'http://localhost:3000',
                methods: ['GET', 'POST'],
                credentials: true
            },
            pingTimeout: options.pingTimeout || 60000,
            pingInterval: options.pingInterval || 25000,
            transports: ['websocket', 'polling']
        });
        
        // Storage for connected clients
        this.connectedClients = new Map();      // socketId -> clientInfo
        this.userSockets = new Map();            // userId -> Set of socketIds
        this.collectorLocations = new Map();     // collectorId -> location data
        this.binSubscribers = new Map();         // binId -> Set of socketIds
        this.areaCollectors = new Map();         // area -> Set of socketIds
        this.activeRoutes = new Map();            // collectorId -> route data
        this.binStatus = new Map();               // binId -> status data
        this.pendingEvents = new Map();           // eventId -> pending data
        
        // Statistics
        this.stats = {
            totalConnections: 0,
            activeConnections: 0,
            messagesSent: 0,
            messagesReceived: 0,
            errors: 0
        };
        
        this.initialize();
    }
    
    // =============================================
    // Initialization
    // =============================================
    
    initialize() {
        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
        });
        
        // Start periodic broadcasts
        this.startPeriodicBroadcasts();
        
        console.log('✅ WebSocket server initialized');
    }
    
    // =============================================
    // Connection Handling
    // =============================================
    
    handleConnection(socket) {
        this.stats.totalConnections++;
        this.stats.activeConnections++;
        
        console.log(`🔌 New client connected: ${socket.id} (Total: ${this.stats.activeConnections})`);
        
        // Send connection confirmation
        socket.emit('connected', {
            socketId: socket.id,
            timestamp: new Date().toISOString(),
            message: 'Connected to Smart Waste WebSocket Server'
        });
        
        // Authentication
        socket.on('authenticate', (data) => this.handleAuthentication(socket, data));
        
        // User room joining
        socket.on('join', (userId) => this.handleJoinRoom(socket, userId));
        socket.on('leave', (userId) => this.handleLeaveRoom(socket, userId));
        
        // Collector events
        socket.on('collector:location-update', (data) => this.handleCollectorLocationUpdate(socket, data));
        socket.on('collector:start-route', (data) => this.handleStartRoute(socket, data));
        socket.on('collector:complete-collection', (data) => this.handleCompleteCollection(socket, data));
        socket.on('collector:emergency', (data) => this.handleCollectorEmergency(socket, data));
        socket.on('collector:update-status', (data) => this.handleCollectorStatusUpdate(socket, data));
        
        // Bin events
        socket.on('bin:update', (data) => this.handleBinUpdate(socket, data));
        socket.on('bin:subscribe', (binId) => this.handleBinSubscribe(socket, binId));
        socket.on('bin:unsubscribe', (binId) => this.handleBinUnsubscribe(socket, binId));
        socket.on('bin:report-issue', (data) => this.handleBinIssue(socket, data));
        socket.on('bin:get-status', (binId) => this.handleGetBinStatus(socket, binId));
        
        // Report events
        socket.on('report:submit', (data) => this.handleReportSubmit(socket, data));
        socket.on('report:update-status', (data) => this.handleReportStatusUpdate(socket, data));
        socket.on('report:get-nearby', (data) => this.handleGetNearbyReports(socket, data));
        
        // Points and rewards events
        socket.on('points:update', (data) => this.handlePointsUpdate(socket, data));
        socket.on('reward:redeem', (data) => this.handleRewardRedeem(socket, data));
        socket.on('points:get-leaderboard', () => this.handleGetLeaderboard(socket));
        
        // Admin events
        socket.on('admin:get-stats', () => this.handleAdminStatsRequest(socket));
        socket.on('admin:get-predictions', () => this.handlePredictionsRequest(socket));
        socket.on('admin:assign-collector', (data) => this.handleAssignCollector(socket, data));
        socket.on('admin:broadcast', (data) => this.handleAdminBroadcast(socket, data));
        
        // Chat events
        socket.on('chat:message', (data) => this.handleChatMessage(socket, data));
        socket.on('chat:join-room', (room) => this.handleChatJoin(socket, room));
        socket.on('chat:leave-room', (room) => this.handleChatLeave(socket, room));
        socket.on('chat:typing', (data) => this.handleChatTyping(socket, data));
        
        // Heartbeat
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: new Date().toISOString() });
        });
        
        // Disconnect
        socket.on('disconnect', () => this.handleDisconnect(socket));
        
        // Error handling
        socket.on('error', (error) => {
            this.stats.errors++;
            console.error(`Socket error (${socket.id}):`, error);
            socket.emit('error', { message: 'Connection error', timestamp: new Date().toISOString() });
        });
    }
    
    // =============================================
    // Authentication & Room Management
    // =============================================
    
    handleAuthentication(socket, data) {
        const { userId, role, token, name, area, latitude, longitude, deviceInfo } = data;
        
        // Verify token
        if (!token) {
            socket.emit('error', { message: 'Authentication failed: Missing token' });
            return;
        }
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.id !== userId) {
                socket.emit('error', { message: 'Authentication failed: Invalid token' });
                return;
            }
        } catch (error) {
            socket.emit('error', { message: 'Authentication failed: Token invalid' });
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
            deviceInfo: deviceInfo,
            connectedAt: new Date(),
            lastActivity: new Date()
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
        
        // For collectors, join area-specific room and store location
        if (role === 'COLLECTOR') {
            if (area) {
                socket.join(`area_${area}`);
                if (!this.areaCollectors.has(area)) {
                    this.areaCollectors.set(area, new Set());
                }
                this.areaCollectors.get(area).add(socket.id);
            }
            
            if (latitude && longitude) {
                this.collectorLocations.set(userId, {
                    lat: latitude,
                    lng: longitude,
                    lastUpdate: new Date(),
                    socketId: socket.id,
                    status: 'active'
                });
            }
        }
        
        // For households, join ward room if available
        if (role === 'HOUSEHOLD' && area) {
            socket.join(`ward_${area}`);
        }
        
        // Send authentication success
        socket.emit('authenticated', {
            success: true,
            message: 'Authenticated successfully',
            socketId: socket.id,
            userId: userId,
            role: role,
            connectedAt: new Date().toISOString(),
            activeConnections: this.stats.activeConnections
        });
        
        // Broadcast user online status
        this.broadcast('user:online', {
            userId: userId,
            role: role,
            name: name,
            timestamp: new Date().toISOString()
        });
        
        console.log(`✅ User ${userId} (${role}) authenticated (Socket: ${socket.id})`);
    }
    
    handleJoinRoom(socket, userId) {
        if (userId) {
            socket.join(`user_${userId}`);
            socket.emit('room-joined', { 
                room: `user_${userId}`,
                success: true,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    handleLeaveRoom(socket, userId) {
        if (userId) {
            socket.leave(`user_${userId}`);
            socket.emit('room-left', { 
                room: `user_${userId}`,
                success: true,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    // =============================================
    // Collector Events
    // =============================================
    
    handleCollectorLocationUpdate(socket, data) {
        const { collectorId, latitude, longitude, routeProgress, speed, bearing, status } = data;
        
        this.stats.messagesReceived++;
        
        // Update stored location
        this.collectorLocations.set(collectorId, {
            lat: latitude,
            lng: longitude,
            routeProgress: routeProgress || 0,
            speed: speed || 0,
            bearing: bearing || 0,
            status: status || 'active',
            lastUpdate: new Date(),
            socketId: socket.id
        });
        
        // Get collector info
        const collector = this.getClientByUserId(collectorId);
        
        // Broadcast to all clients (for tracking)
        this.broadcast('collector:location-changed', {
            collectorId: collectorId,
            name: collector?.name || 'Collector',
            location: { lat: latitude, lng: longitude },
            routeProgress: routeProgress,
            speed: speed,
            bearing: bearing,
            status: status,
            timestamp: new Date().toISOString()
        });
        
        // Send to specific area if collector has assigned area
        if (collector && collector.area) {
            this.io.to(`area_${collector.area}`).emit('collector:nearby', {
                collectorId: collectorId,
                name: collector.name,
                location: { lat: latitude, lng: longitude },
                distance: null,
                eta: this.calculateETA(collector.area, { lat: latitude, lng: longitude }),
                timestamp: new Date().toISOString()
            });
        }
        
        // Update admin dashboard
        this.io.to('role_ADMIN').emit('collector:location-update', {
            collectorId: collectorId,
            location: { lat: latitude, lng: longitude },
            lastUpdate: new Date().toISOString()
        });
        
        socket.emit('location-updated', { success: true });
    }
    
    handleStartRoute(socket, data) {
        const { collectorId, route, totalBins, estimatedTime, routeId, startLocation } = data;
        
        this.stats.messagesReceived++;
        
        // Store active route
        this.activeRoutes.set(collectorId, {
            routeId: routeId || this.generateRouteId(),
            route: route,
            totalBins: totalBins,
            completedBins: 0,
            estimatedTime: estimatedTime,
            startTime: new Date(),
            startLocation: startLocation,
            status: 'active'
        });
        
        // Notify admin
        this.io.to('role_ADMIN').emit('collector:route-started', {
            collectorId: collectorId,
            routeId: routeId,
            route: route,
            totalBins: totalBins,
            estimatedTime: estimatedTime,
            startedAt: new Date().toISOString()
        });
        
        // Notify area residents
        const collector = this.getClientByUserId(collectorId);
        if (collector && collector.area) {
            this.io.to(`area_${collector.area}`).emit('collector:approaching', {
                collectorId: collectorId,
                collectorName: collector.name,
                estimatedArrival: estimatedTime,
                message: `🚛 ${collector.name} will be in your area in approximately ${estimatedTime} minutes`,
                routeId: routeId,
                timestamp: new Date().toISOString()
            });
        }
        
        socket.emit('route-started', { 
            success: true, 
            routeId: routeId,
            message: 'Route started successfully',
            timestamp: new Date().toISOString()
        });
    }
    
    handleCompleteCollection(socket, data) {
        const { 
            collectorId, binId, householdId, points, wasteWeight, 
            segregationQuality, imageUrl, notes, collectionTime 
        } = data;
        
        this.stats.messagesReceived++;
        
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
        
        // Update bin status
        if (this.binStatus.has(binId)) {
            const bin = this.binStatus.get(binId);
            bin.fillLevel = 0;
            bin.isFull = false;
            bin.lastCollected = new Date();
            bin.lastCollector = collectorId;
            this.binStatus.set(binId, bin);
        }
        
        // Notify household
        if (householdId) {
            const pointsMessage = points > 0 ? `You earned +${points} points!` : '';
            const qualityMessage = segregationQuality === 'EXCELLENT' ? 'Great job on proper segregation!' : 
                                   segregationQuality === 'GOOD' ? 'Good segregation. Keep improving!' :
                                   'Please improve your segregation next time.';
            
            this.emitToUser(householdId, 'collection:completed', {
                collectorId: collectorId,
                binId: binId,
                points: points,
                wasteWeight: wasteWeight,
                quality: segregationQuality,
                imageUrl: imageUrl,
                message: `🎉 Collection completed! ${pointsMessage} ${qualityMessage}`,
                timestamp: new Date().toISOString()
            });
        }
        
        // Notify bin subscribers
        this.io.to(`bin_${binId}`).emit('bin:collected', {
            binId: binId,
            collectorId: collectorId,
            weight: wasteWeight,
            quality: segregationQuality,
            timestamp: new Date().toISOString(),
            fillLevel: 0
        });
        
        // Notify admin
        this.io.to('role_ADMIN').emit('collection:completed', {
            collectorId: collectorId,
            collectorName: this.getClientByUserId(collectorId)?.name,
            binId: binId,
            householdId: householdId,
            points: points,
            weight: wasteWeight,
            quality: segregationQuality,
            timestamp: new Date().toISOString()
        });
        
        // Update leaderboard
        this.updateLeaderboard();
        
        socket.emit('collection-recorded', {
            success: true,
            points: points,
            message: `Collection recorded successfully! +${points} points`,
            timestamp: new Date().toISOString()
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
            completedAt: new Date().toISOString()
        });
        
        // Notify collector
        this.emitToUser(collectorId, 'collector:route-completed', {
            routeId: route.routeId,
            totalBins: route.totalBins,
            duration: duration,
            message: `✅ Route completed! You collected ${route.totalBins} bins in ${duration} minutes.`,
            timestamp: new Date().toISOString()
        });
        
        // Clear active route
        this.activeRoutes.delete(collectorId);
    }
    
    handleCollectorEmergency(socket, data) {
        const { collectorId, emergencyType, location, message, imageUrl } = data;
        
        this.stats.messagesReceived++;
        
        const emergencyData = {
            collectorId: collectorId,
            collectorName: this.getClientByUserId(collectorId)?.name,
            emergencyType: emergencyType,
            location: location,
            message: message,
            imageUrl: imageUrl,
            timestamp: new Date().toISOString(),
            urgent: true
        };
        
        // Notify admin immediately
        this.io.to('role_ADMIN').emit('collector:emergency', emergencyData);
        
        // Also notify nearby collectors (within 1km)
        const nearbyCollectors = this.getNearbyCollectors(location.lat, location.lng, 1);
        nearbyCollectors.forEach(collector => {
            if (collector.userId !== collectorId) {
                this.emitToUser(collector.userId, 'collector:emergency-nearby', {
                    ...emergencyData,
                    distance: collector.distance,
                    message: `🚨 Emergency alert from nearby collector! ${message || emergencyType}`
                });
            }
        });
        
        socket.emit('emergency-reported', { 
            success: true,
            message: 'Emergency alert sent',
            timestamp: new Date().toISOString()
        });
    }
    
    handleCollectorStatusUpdate(socket, data) {
        const { collectorId, status, reason } = data;
        
        // Update collector location status
        if (this.collectorLocations.has(collectorId)) {
            const location = this.collectorLocations.get(collectorId);
            location.status = status;
            this.collectorLocations.set(collectorId, location);
        }
        
        // Notify admin
        this.io.to('role_ADMIN').emit('collector:status-changed', {
            collectorId: collectorId,
            status: status,
            reason: reason,
            timestamp: new Date().toISOString()
        });
        
        socket.emit('status-updated', { success: true });
    }
    
    // =============================================
    // Bin Events
    // =============================================
    
    handleBinUpdate(socket, data) {
        const { binId, fillLevel, isFull, location, temperature, humidity, lastUpdated, wasteType } = data;
        
        this.stats.messagesReceived++;
        
        // Check if bin just became full
        const previousStatus = this.binStatus.get(binId);
        const wasFull = previousStatus?.isFull || false;
        
        // Store bin status
        this.binStatus.set(binId, {
            fillLevel: fillLevel,
            isFull: isFull,
            location: location,
            temperature: temperature,
            humidity: humidity,
            wasteType: wasteType,
            lastUpdated: lastUpdated || new Date(),
            lastCollected: previousStatus?.lastCollected
        });
        
        // Broadcast to bin subscribers
        this.io.to(`bin_${binId}`).emit('bin:status-update', {
            binId: binId,
            fillLevel: fillLevel,
            isFull: isFull,
            location: location,
            temperature: temperature,
            humidity: humidity,
            wasteType: wasteType,
            timestamp: new Date().toISOString()
        });
        
        // If bin becomes full, trigger alerts
        if (isFull && !wasFull) {
            this.handleBinFull(binId, fillLevel, location, wasteType);
        }
        
        // If bin fill level crosses 80%, send warning
        if (fillLevel >= 80 && fillLevel < 90 && (!wasFull || fillLevel > previousStatus?.fillLevel)) {
            this.handleBinWarning(binId, fillLevel, location);
        }
        
        // Broadcast general bin update for tracking
        this.broadcast('bin:update', {
            binId: binId,
            fillLevel: fillLevel,
            isFull: isFull,
            location: location,
            wasteType: wasteType,
            timestamp: new Date().toISOString()
        });
        
        socket.emit('bin-updated', { success: true });
    }
    
    handleBinFull(binId, fillLevel, location, wasteType) {
        const alertData = {
            binId: binId,
            fillLevel: fillLevel,
            location: location,
            wasteType: wasteType,
            message: `⚠️ URGENT: Bin at ${location.locality || location.address || location} is ${fillLevel}% full! Needs immediate collection.`,
            priority: 'high',
            timestamp: new Date().toISOString()
        };
        
        // Notify all collectors in the area
        this.io.to('role_COLLECTOR').emit('bin:urgent', alertData);
        
        // Notify admin
        this.io.to('role_ADMIN').emit('bin:full-alert', alertData);
        
        // Notify area residents
        if (location.ward) {
            this.io.to(`ward_${location.ward}`).emit('bin:area-alert', {
                ...alertData,
                message: `⚠️ Bin in your area is full. Please use alternative bins.`
            });
        }
    }
    
    handleBinWarning(binId, fillLevel, location) {
        this.io.to('role_COLLECTOR').emit('bin:warning', {
            binId: binId,
            fillLevel: fillLevel,
            location: location,
            message: `⚠️ Bin at ${location.locality || location} is ${fillLevel}% full. Schedule collection soon.`,
            priority: 'medium',
            timestamp: new Date().toISOString()
        });
    }
    
    handleBinSubscribe(socket, binId) {
        socket.join(`bin_${binId}`);
        
        if (!this.binSubscribers.has(binId)) {
            this.binSubscribers.set(binId, new Set());
        }
        this.binSubscribers.get(binId).add(socket.id);
        
        // Send current bin status immediately
        if (this.binStatus.has(binId)) {
            const status = this.binStatus.get(binId);
            socket.emit('bin:current-status', {
                binId: binId,
                ...status,
                timestamp: new Date().toISOString()
            });
        }
        
        socket.emit('bin:subscribed', { 
            binId: binId,
            success: true,
            message: `Subscribed to bin ${binId} updates`
        });
    }
    
    handleBinUnsubscribe(socket, binId) {
        socket.leave(`bin_${binId}`);
        
        if (this.binSubscribers.has(binId)) {
            this.binSubscribers.get(binId).delete(socket.id);
        }
        
        socket.emit('bin:unsubscribed', { 
            binId: binId,
            success: true,
            message: `Unsubscribed from bin ${binId} updates`
        });
    }
    
    handleBinIssue(socket, data) {
        const { binId, issueType, description, imageUrl, reportedBy } = data;
        
        this.stats.messagesReceived++;
        
        const issueData = {
            binId: binId,
            issueType: issueType,
            description: description,
            imageUrl: imageUrl,
            reportedBy: reportedBy,
            timestamp: new Date().toISOString()
        };
        
        // Notify admin
        this.io.to('role_ADMIN').emit('bin:issue-reported', issueData);
        
        // Notify maintenance team
        this.io.to('role_MAINTENANCE').emit('bin:maintenance-needed', issueData);
        
        socket.emit('issue-reported', { 
            success: true,
            message: 'Issue reported successfully',
            timestamp: new Date().toISOString()
        });
    }
    
    handleGetBinStatus(socket, binId) {
        if (this.binStatus.has(binId)) {
            socket.emit('bin:status-response', {
                binId: binId,
                ...this.binStatus.get(binId),
                timestamp: new Date().toISOString()
            });
        } else {
            socket.emit('bin:status-response', {
                binId: binId,
                error: 'Bin not found',
                timestamp: new Date().toISOString()
            });
        }
    }
    
    // =============================================
    // Report Events
    // =============================================
    
    handleReportSubmit(socket, data) {
        const { reportId, userId, location, description, imageUrl, latitude, longitude, reportType, contactInfo } = data;
        
        this.stats.messagesReceived++;
        
        const reportData = {
            reportId: reportId,
            userId: userId,
            userName: this.getClientByUserId(userId)?.name,
            location: location,
            description: description,
            imageUrl: imageUrl,
            coordinates: { lat: latitude, lng: longitude },
            reportType: reportType,
            contactInfo: contactInfo,
            timestamp: new Date().toISOString(),
            status: 'PENDING'
        };
        
        // Notify nearby collectors
        this.notifyNearbyCollectors(latitude, longitude, reportData);
        
        // Notify admin
        this.io.to('role_ADMIN').emit('report:new', reportData);
        
        // Confirm to user
        this.emitToUser(userId, 'report:submitted', {
            reportId: reportId,
            message: 'Your report has been submitted. Authorities have been notified.',
            trackingUrl: `/tracking/${reportId}`,
            timestamp: new Date().toISOString()
        });
        
        socket.emit('report-submitted', { 
            success: true,
            reportId: reportId,
            message: 'Report submitted successfully'
        });
    }
    
    handleReportStatusUpdate(socket, data) {
        const { reportId, status, resolvedBy, notes, resolutionImage, assignedTo } = data;
        
        this.stats.messagesReceived++;
        
        const statusData = {
            reportId: reportId,
            status: status,
            resolvedBy: resolvedBy,
            notes: notes,
            resolutionImage: resolutionImage,
            assignedTo: assignedTo,
            timestamp: new Date().toISOString()
        };
        
        // Broadcast status update
        this.broadcast('report:status-updated', statusData);
        
        // Notify the user who submitted the report
        if (data.userId) {
            const statusMessages = {
                'IN_PROGRESS': 'Your report is being addressed by our team',
                'RESOLVED': '✅ Your reported issue has been resolved. Thank you for helping keep our city clean!',
                'REJECTED': 'Your report was reviewed and could not be verified. Please submit more details if issue persists.',
                'ASSIGNED': `Your report has been assigned to ${assignedTo}`
            };
            
            this.emitToUser(data.userId, 'report:status-updated', {
                reportId: reportId,
                status: status,
                message: statusMessages[status] || `Report status updated to: ${status}`,
                notes: notes,
                timestamp: new Date().toISOString()
            });
        }
        
        socket.emit('status-updated', { success: true });
    }
    
    handleGetNearbyReports(socket, data) {
        const { lat, lng, radius = 2, status = 'PENDING' } = data;
        
        // This would normally query the database
        // For WebSocket, we'll emit a request to the client to fetch from API
        socket.emit('nearby-reports-request', {
            coordinates: { lat, lng },
            radius: radius,
            status: status,
            timestamp: new Date().toISOString()
        });
    }
    
    // =============================================
    // Points & Rewards Events
    // =============================================
    
    handlePointsUpdate(socket, data) {
        const { userId, points, reason, newTotal, transactionId, metadata } = data;
        
        this.stats.messagesReceived++;
        
        const pointsData = {
            points: points,
            reason: reason,
            newTotal: newTotal,
            transactionId: transactionId,
            metadata: metadata,
            timestamp: new Date().toISOString()
        };
        
        // Notify user
        this.emitToUser(userId, 'points:updated', pointsData);
        
        // Check for tier upgrade
        const newTier = this.checkTierUpgrade(newTotal);
        if (newTier) {
            this.emitToUser(userId, 'points:tier-upgrade', {
                tier: newTier,
                points: newTotal,
                message: `🎉 Congratulations! You've reached ${newTier} Tier!`,
                benefits: this.getTierBenefits(newTier),
                timestamp: new Date().toISOString()
            });
        }
        
        // Update leaderboard
        this.updateLeaderboard();
        
        socket.emit('points-updated', { success: true });
    }
    
    handleRewardRedeem(socket, data) {
        const { userId, rewardId, rewardName, points, status, redemptionCode, expiresAt, qrCode } = data;
        
        this.stats.messagesReceived++;
        
        const redemptionData = {
            rewardId: rewardId,
            rewardName: rewardName,
            points: points,
            status: status,
            redemptionCode: redemptionCode,
            expiresAt: expiresAt,
            qrCode: qrCode,
            timestamp: new Date().toISOString()
        };
        
        // Notify user
        this.emitToUser(userId, 'reward:redeemed', {
            ...redemptionData,
            message: `You successfully redeemed ${rewardName} for ${points} points!`
        });
        
        // Notify admin
        this.io.to('role_ADMIN').emit('reward:redeemed', {
            userId: userId,
            userName: this.getClientByUserId(userId)?.name,
            rewardId: rewardId,
            rewardName: rewardName,
            points: points,
            timestamp: new Date().toISOString()
        });
        
        socket.emit('reward-redeemed', { 
            success: true,
            redemptionCode: redemptionCode,
            message: `Successfully redeemed ${rewardName}!`
        });
    }
    
    handleGetLeaderboard(socket) {
        // Emit request to fetch leaderboard from database
        socket.emit('leaderboard-request', {
            timestamp: new Date().toISOString()
        });
    }
    
    // =============================================
    // Admin Events
    // =============================================
    
    handleAdminStatsRequest(socket) {
        const stats = {
            connections: {
                total: this.stats.totalConnections,
                active: this.stats.activeConnections,
                byRole: this.getConnectionsByRole(),
                byArea: this.getConnectionsByArea()
            },
            collectors: {
                active: this.collectorLocations.size,
                onRoute: this.activeRoutes.size,
                locations: Array.from(this.collectorLocations.values())
            },
            bins: {
                total: this.binStatus.size,
                full: Array.from(this.binStatus.values()).filter(b => b.isFull).length,
                warning: Array.from(this.binStatus.values()).filter(b => b.fillLevel >= 80 && !b.isFull).length
            },
            messages: {
                sent: this.stats.messagesSent,
                received: this.stats.messagesReceived,
                errors: this.stats.errors
            },
            timestamp: new Date().toISOString()
        };
        
        socket.emit('admin:stats', stats);
    }
    
    handlePredictionsRequest(socket) {
        const predictions = this.generatePredictions();
        socket.emit('admin:predictions', predictions);
    }
    
    handleAssignCollector(socket, data) {
        const { collectorId, area, binIds, routeId, startTime } = data;
        
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
            startTime: startTime,
            message: `You have been assigned to ${area} area with ${binIds.length} bins`,
            timestamp: new Date().toISOString()
        });
        
        // Notify admin
        socket.emit('collector-assigned', { 
            success: true,
            collectorId: collectorId,
            area: area,
            message: `Collector assigned successfully`
        });
    }
    
    handleAdminBroadcast(socket, data) {
        const { message, type, target, targetId } = data;
        
        const broadcastData = {
            message: message,
            type: type,
            from: 'admin',
            timestamp: new Date().toISOString()
        };
        
        if (target === 'all') {
            this.broadcast('admin:broadcast', broadcastData);
        } else if (target === 'role') {
            this.io.to(`role_${targetId}`).emit('admin:broadcast', broadcastData);
        } else if (target === 'user') {
            this.emitToUser(targetId, 'admin:broadcast', broadcastData);
        } else if (target === 'area') {
            this.io.to(`area_${targetId}`).emit('admin:broadcast', broadcastData);
        }
        
        socket.emit('broadcast-sent', { 
            success: true,
            message: 'Broadcast sent successfully'
        });
    }
    
    // =============================================
    // Chat Events
    // =============================================
    
    handleChatMessage(socket, data) {
        const { room, message, userId, userName, messageType, attachment } = data;
        
        this.stats.messagesReceived++;
        this.stats.messagesSent++;
        
        const chatMessage = {
            id: this.generateMessageId(),
            userId: userId,
            userName: userName,
            message: message,
            messageType: messageType || 'text',
            attachment: attachment,
            timestamp: new Date().toISOString(),
            room: room
        };
        
        if (room === 'global') {
            this.broadcast('chat:message', chatMessage);
        } else if (room === 'area') {
            const collector = this.getClientByUserId(userId);
            if (collector && collector.area) {
                this.io.to(`area_${collector.area}`).emit('chat:message', chatMessage);
            }
        } else if (room === 'team') {
            this.io.to('role_COLLECTOR').emit('chat:message', chatMessage);
        } else {
            this.io.to(room).emit('chat:message', chatMessage);
        }
        
        socket.emit('message-sent', { success: true, messageId: chatMessage.id });
    }
    
    handleChatJoin(socket, room) {
        socket.join(room);
        socket.emit('chat:joined', { 
            room: room, 
            success: true,
            timestamp: new Date().toISOString()
        });
        
        // Notify others in the room
        socket.to(room).emit('chat:user-joined', {
            userId: this.getClientBySocketId(socket.id)?.userId,
            timestamp: new Date().toISOString()
        });
    }
    
    handleChatLeave(socket, room) {
        socket.leave(room);
        socket.emit('chat:left', { 
            room: room, 
            success: true,
            timestamp: new Date().toISOString()
        });
        
        // Notify others in the room
        socket.to(room).emit('chat:user-left', {
            userId: this.getClientBySocketId(socket.id)?.userId,
            timestamp: new Date().toISOString()
        });
    }
    
    handleChatTyping(socket, data) {
        const { room, userId, userName, isTyping } = data;
        
        socket.to(room).emit('chat:typing', {
            userId: userId,
            userName: userName,
            isTyping: isTyping,
            timestamp: new Date().toISOString()
        });
    }
    
    // =============================================
    // Helper Methods
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
    
    getConnectionsByRole() {
        const roles = {};
        for (const client of this.connectedClients.values()) {
            roles[client.role] = (roles[client.role] || 0) + 1;
        }
        return roles;
    }
    
    getConnectionsByArea() {
        const areas = {};
        for (const client of this.connectedClients.values()) {
            if (client.area) {
                areas[client.area] = (areas[client.area] || 0) + 1;
            }
        }
        return areas;
    }
    
    getNearbyCollectors(lat, lng, radiusKm = 2) {
        const nearby = [];
        
        for (const [collectorId, location] of this.collectorLocations) {
            const distance = this.calculateDistance(lat, lng, location.lat, location.lng);
            if (distance <= radiusKm) {
                nearby.push({
                    userId: collectorId,
                    distance: distance,
                    location: { lat: location.lat, lng: location.lng },
                    status: location.status
                });
            }
        }
        
        return nearby.sort((a, b) => a.distance - b.distance);
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
    
    calculateETA(area, currentLocation) {
        // Simplified ETA calculation
        return Math.floor(Math.random() * 15) + 5; // 5-20 minutes
    }
    
    generateRouteId() {
        return `RTE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    generateMessageId() {
        return `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
    
    generatePredictions() {
        const predictions = [];
        const areas = ['Downtown', 'Suburb', 'Industrial', 'Residential', 'Commercial'];
        
        for (let i = 1; i <= 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            
            predictions.push({
                date: date.toLocaleDateString(),
                isWeekend: isWeekend,
                predictions: areas.map(area => ({
                    area: area,
                    predictedWaste: Math.floor(Math.random() * 500) + 200,
                    requiredTrucks: Math.floor(Math.random() * 5) + 2,
                    confidence: 0.75 + Math.random() * 0.2
                }))
            });
        }
        
        return predictions;
    }
    
    notifyNearbyCollectors(lat, lng, reportData) {
        const nearbyCollectors = this.getNearbyCollectors(lat, lng, 2);
        
        for (const collector of nearbyCollectors) {
            this.emitToUser(collector.userId, 'report:nearby', {
                ...reportData,
                distance: collector.distance.toFixed(1),
                message: `📋 New waste report ${collector.distance.toFixed(1)}km away from your location`
            });
        }
        
        return nearbyCollectors;
    }
    
    updateLeaderboard() {
        this.broadcast('leaderboard:updated', {
            timestamp: new Date().toISOString(),
            message: 'Leaderboard has been updated'
        });
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
                timestamp: new Date().toISOString()
            };
            this.broadcast('system:stats', stats);
        }, 30000);
        
        // Broadcast active collector locations every 10 seconds
        setInterval(() => {
            const locations = Array.from(this.collectorLocations.entries()).map(([id, loc]) => ({
                collectorId: id,
                name: this.getClientByUserId(id)?.name,
                location: { lat: loc.lat, lng: loc.lng },
                status: loc.status,
                routeProgress: loc.routeProgress,
                lastUpdate: loc.lastUpdate
            }));
            this.broadcast('collector:locations', locations);
        }, 10000);
        
        // Broadcast bin status every 30 seconds
        setInterval(() => {
            const bins = Array.from(this.binStatus.entries()).map(([id, status]) => ({
                binId: id,
                fillLevel: status.fillLevel,
                isFull: status.isFull,
                location: status.location,
                lastUpdated: status.lastUpdated
            }));
            this.broadcast('bin:batch-update', bins);
        }, 30000);
    }
    
    // =============================================
    // Public Methods for External Use
    // =============================================
    
    emitToUser(userId, event, data) {
        this.io.to(`user_${userId}`).emit(event, data);
        this.stats.messagesSent++;
    }
    
    emitToRole(role, event, data) {
        this.io.to(`role_${role}`).emit(event, data);
        this.stats.messagesSent++;
    }
    
    emitToArea(area, event, data) {
        this.io.to(`area_${area}`).emit(event, data);
        this.stats.messagesSent++;
    }
    
    emitToBin(binId, event, data) {
        this.io.to(`bin_${binId}`).emit(event, data);
        this.stats.messagesSent++;
    }
    
    broadcast(event, data) {
        this.io.emit(event, data);
        this.stats.messagesSent++;
    }
    
    handleDisconnect(socket) {
        this.stats.activeConnections--;
        
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
            if (client.role === 'COLLECTOR') {
                if (client.area) {
                    const areaCollectors = this.areaCollectors.get(client.area);
                    if (areaCollectors) {
                        areaCollectors.delete(socket.id);
                    }
                }
                this.collectorLocations.delete(client.userId);
                this.activeRoutes.delete(client.userId);
            }
            
            // Remove from connected clients
            this.connectedClients.delete(socket.id);
            
            // Broadcast user offline status
            this.broadcast('user:offline', {
                userId: client.userId,
                role: client.role,
                name: client.name,
                timestamp: new Date().toISOString()
            });
            
            console.log(`🔌 User ${client.userId} (${client.role}) disconnected (Active: ${this.stats.activeConnections})`);
        }
        
        // Remove from bin subscribers
        for (const [binId, subscribers] of this.binSubscribers) {
            if (subscribers.has(socket.id)) {
                subscribers.delete(socket.id);
            }
        }
    }
    
    // =============================================
    // Statistics Methods
    // =============================================
    
    getStats() {
        return {
            connections: {
                total: this.stats.totalConnections,
                active: this.stats.activeConnections,
                byRole: this.getConnectionsByRole(),
                byArea: this.getConnectionsByArea()
            },
            collectors: {
                active: this.collectorLocations.size,
                onRoute: this.activeRoutes.size
            },
            bins: {
                monitored: this.binStatus.size,
                full: Array.from(this.binStatus.values()).filter(b => b.isFull).length
            },
            messages: {
                sent: this.stats.messagesSent,
                received: this.stats.messagesReceived,
                errors: this.stats.errors
            },
            uptime: process.uptime()
        };
    }
    
    resetStats() {
        this.stats = {
            totalConnections: 0,
            activeConnections: 0,
            messagesSent: 0,
            messagesReceived: 0,
            errors: 0
        };
    }
    
    close() {
        if (this.io) {
            this.io.close();
            console.log('WebSocket server closed');
        }
    }
}

module.exports = SocketServer;