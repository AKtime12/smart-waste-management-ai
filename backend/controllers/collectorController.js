const { prisma } = require('../database/db');

// =============================================
// Get assigned bins
// =============================================
exports.getAssignedBins = async (req, res) => {
    try {
        const bins = await prisma.qRBin.findMany({
            where: { isFull: false },
            take: 20,
            select: {
                id: true,
                qrCode: true,
                binType: true,
                locality: true,
                currentFill: true,
                isFull: true,
                latitude: true,
                longitude: true,
                ward: true
            }
        });
        res.json(bins);
    } catch (error) {
        console.error('Get assigned bins error:', error);
        res.json([]);
    }
};

// =============================================
// Get full bins (urgent)
// =============================================
exports.getFullBins = async (req, res) => {
    try {
        const bins = await prisma.qRBin.findMany({
            where: { isFull: true },
            select: {
                id: true,
                qrCode: true,
                binType: true,
                locality: true,
                currentFill: true,
                isFull: true,
                latitude: true,
                longitude: true
            }
        });
        res.json(bins);
    } catch (error) {
        console.error('Get full bins error:', error);
        res.json([]);
    }
};

// =============================================
// Scan QR code and record collection
// =============================================
exports.scanQR = async (req, res) => {
    try {
        const { qrData, binId, householdId, wasteWeight, segregationQuality } = req.body;
        
        console.log('📡 scanQR received:', { qrData, binId, householdId, wasteWeight, segregationQuality });
        
        // =============================================
        // CASE 1: This is a collection recording (has wasteWeight)
        // =============================================
        if (wasteWeight !== undefined) {
            // Calculate points
            let points = 10;
            if (segregationQuality === 'EXCELLENT') points = 20;
            else if (segregationQuality === 'GOOD') points = 10;
            else if (segregationQuality === 'POOR') points = 2;
            else if (segregationQuality === 'FAILED') points = 0;
            
            // Add weight bonus (1 point per 5kg)
            points += Math.floor(wasteWeight / 5);
            
            // ---------- Validate / create bin ----------
            let finalBinId = binId;
            
            // If no binId given, try to find by QR code
            if (!finalBinId && qrData) {
                const existingBin = await prisma.qRBin.findFirst({
                    where: { qrCode: qrData }
                });
                if (existingBin) {
                    finalBinId = existingBin.id;
                }
            }
            
            // If still no bin, try to get any existing bin
            if (!finalBinId) {
                const anyBin = await prisma.qRBin.findFirst();
                if (anyBin) {
                    finalBinId = anyBin.id;
                } else {
                    // No bins at all – create a default bin
                    const defaultBin = await prisma.qRBin.create({
                        data: {
                            qrCode: 'DEFAULT_BIN',
                            binType: 'GENERAL',
                            locality: 'Default',
                            latitude: 0,
                            longitude: 0,
                            ward: 'Default',
                            capacity: 100,
                            currentFill: 0,
                            isFull: false
                        }
                    });
                    finalBinId = defaultBin.id;
                    console.log('✅ Created default bin with ID:', finalBinId);
                }
            }
            
            // ---------- Validate household (if provided) ----------
            let finalHouseholdId = householdId;
            let householdExists = true;
            if (finalHouseholdId) {
                const userExists = await prisma.user.findUnique({
                    where: { id: finalHouseholdId }
                });
                if (!userExists) {
                    console.warn(`⚠️ Household ID ${finalHouseholdId} not found, will not award points.`);
                    householdExists = false;
                    finalHouseholdId = null; // Don't try to update points
                }
            }
            
            // ---------- Create collection record ----------
            const collection = await prisma.collection.create({
                data: {
                    binId: finalBinId,
                    householdId: finalHouseholdId,
                    collectorId: req.user.id,
                    wasteWeight: wasteWeight,
                    segregationQuality: segregationQuality,
                    pointsAwarded: points,
                    aiVerified: false,
                    factoryVerified: false
                }
            });
            
            // ---------- Award points only if household exists and points > 0 ----------
            if (householdExists && finalHouseholdId && points > 0) {
                await prisma.user.update({
                    where: { id: finalHouseholdId },
                    data: { points: { increment: points } }
                });
                
                await prisma.pointTransaction.create({
                    data: {
                        userId: finalHouseholdId,
                        points: points,
                        reason: `Waste collection - ${segregationQuality} segregation`,
                        collectionId: collection.id,
                        type: 'COLLECTION'
                    }
                });
                
                console.log(`✅ Awarded ${points} points to household ${finalHouseholdId}`);
            } else {
                console.log(`⚠️ No points awarded (household missing or points = 0)`);
            }
            
            return res.json({
                success: true,
                points: householdExists ? points : 0,
                collectionId: collection.id,
                message: householdExists 
                    ? `Collection recorded! +${points} points` 
                    : `Collection recorded (household not found, no points awarded)`
            });
        }
        
        // =============================================
        // CASE 2: This is a QR scan request (no wasteWeight)
        // =============================================
        
        // Parse QR data to extract household info
        let householdInfo = null;
        try {
            const parsed = JSON.parse(qrData);
            if (parsed.userId || parsed.name) {
                householdInfo = parsed;
                console.log('🏠 Household QR detected:', householdInfo);
            }
        } catch(e) {
            console.log('Simple QR code (not JSON) - value:', qrData);
        }
        
        // Try to find bin by QR code
        let bin = null;
        if (qrData) {
            bin = await prisma.qRBin.findFirst({
                where: { qrCode: qrData },
                select: { id: true, binType: true, locality: true, currentFill: true, ward: true }
            });
        }
        
        // If no bin found, return a default bin for demo (but this will not be used for actual collection)
        if (!bin) {
            // Try to get any existing bin from database
            const anyBin = await prisma.qRBin.findFirst();
            if (anyBin) {
                bin = {
                    id: anyBin.id,
                    binType: anyBin.binType,
                    locality: anyBin.locality,
                    currentFill: anyBin.currentFill,
                    ward: anyBin.ward
                };
            } else {
                // Fallback to hardcoded demo (only for display)
                bin = {
                    id: 'demo',
                    binType: 'ORGANIC',
                    locality: 'Green Society',
                    currentFill: 65,
                    ward: 'Ward A'
                };
            }
        }
        
        res.json({
            success: true,
            bin: bin,
            household: householdInfo,
            points: 10,
            message: householdInfo ? 'Household QR scanned' : 'Bin QR scanned'
        });
        
    } catch (error) {
        console.error('❌ Scan QR error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================
// Complete Collection (Alternative endpoint)
// =============================================
exports.completeCollection = async (req, res) => {
    try {
        const { wasteWeight, segregationQuality } = req.body;
        
        let points = 10;
        if (segregationQuality === 'EXCELLENT') points = 20;
        else if (segregationQuality === 'GOOD') points = 10;
        else if (segregationQuality === 'POOR') points = 2;
        
        points += Math.floor(wasteWeight / 5);
        
        // Ensure a bin exists
        let bin = await prisma.qRBin.findFirst();
        if (!bin) {
            bin = await prisma.qRBin.create({
                data: {
                    qrCode: 'DEFAULT_BIN',
                    binType: 'GENERAL',
                    locality: 'Default',
                    latitude: 0,
                    longitude: 0,
                    ward: 'Default',
                    capacity: 100,
                    currentFill: 0,
                    isFull: false
                }
            });
        }
        
        const collection = await prisma.collection.create({
            data: {
                binId: bin.id,
                collectorId: req.user.id,
                wasteWeight: wasteWeight,
                segregationQuality: segregationQuality,
                pointsAwarded: points,
                aiVerified: false,
                factoryVerified: false
            }
        });
        
        res.json({
            success: true,
            points: points,
            collectionId: collection.id,
            message: 'Collection recorded successfully'
        });
        
    } catch (error) {
        console.error('Complete collection error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================
// Get optimized route
// =============================================
exports.getOptimizedRoute = async (req, res) => {
    try {
        const bins = await prisma.qRBin.findMany({
            where: { isFull: true },
            take: 10,
            select: {
                id: true,
                binType: true,
                locality: true,
                currentFill: true,
                latitude: true,
                longitude: true
            }
        });
        
        res.json({
            success: true,
            steps: bins.map((b, i) => ({
                step: i + 1,
                action: `Collect from ${b.locality}`,
                binId: b.id,
                binType: b.binType,
                fillLevel: b.currentFill,
                location: { lat: b.latitude, lng: b.longitude },
                distance: '0.5 km'
            })),
            totalBins: bins.length,
            estimatedTime: bins.length * 5,
            completedBins: 0
        });
    } catch (error) {
        console.error('Get optimized route error:', error);
        res.json({ success: true, steps: [], totalBins: 0 });
    }
};

// =============================================
// Optimize route (alias)
// =============================================
exports.optimizeRoute = exports.getOptimizedRoute;

// =============================================
// Get collection history
// =============================================
exports.getCollectionHistory = async (req, res) => {
    try {
        const history = await prisma.collection.findMany({
            where: { collectorId: req.user.id },
            orderBy: { collectionTime: 'desc' },
            take: 20,
            include: {
                bin: {
                    select: { binType: true, locality: true }
                },
                household: {
                    select: { name: true, address: true }
                }
            }
        });
        
        const formatted = history.map(h => ({
            id: h.id,
            binType: h.bin?.binType || 'General',
            location: h.bin?.locality || 'N/A',
            householdName: h.household?.name,
            wasteWeight: h.wasteWeight,
            segregationQuality: h.segregationQuality,
            pointsAwarded: h.pointsAwarded,
            collectionTime: h.collectionTime
        }));
        
        res.json(formatted);
    } catch (error) {
        console.error('Get collection history error:', error);
        res.json([]);
    }
};

// =============================================
// Get collector stats
// =============================================
exports.getCollectorStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const collections = await prisma.collection.findMany({
            where: { collectorId: req.user.id }
        });
        
        const todayCollections = collections.filter(c => new Date(c.collectionTime) >= today);
        const totalPoints = collections.reduce((sum, c) => sum + (c.pointsAwarded || 0), 0);
        const totalWeight = collections.reduce((sum, c) => sum + (c.wasteWeight || 0), 0);
        
        res.json({
            totalCollections: collections.length,
            todayCollections: todayCollections.length,
            totalPoints: totalPoints,
            totalWeight: totalWeight.toFixed(1),
            averageEfficiency: 85
        });
    } catch (error) {
        console.error('Get collector stats error:', error);
        res.json({ 
            totalCollections: 0, 
            todayCollections: 0, 
            totalPoints: 0, 
            totalWeight: 0,
            averageEfficiency: 0
        });
    }
};

// =============================================
// Update current location (real-time)
// =============================================
exports.updateLocation = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        
        await prisma.user.update({
            where: { id: req.user.id },
            data: { latitude, longitude }
        });
        
        res.json({ 
            success: true, 
            message: 'Location updated',
            location: { latitude, longitude }
        });
    } catch (error) {
        console.error('Update location error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};