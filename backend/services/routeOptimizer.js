// backend/services/routeOptimizer.js
const axios = require('axios');

class RouteOptimizer {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async optimizeRoute(collectorLocation, bins, trafficData = null) {
        try {
            // 1. Filter bins that need collection
            const urgentBins = bins.filter(b => b.fillLevel > 80);
            const normalBins = bins.filter(b => b.fillLevel > 50 && b.fillLevel <= 80);
            const lowBins = bins.filter(b => b.fillLevel <= 50);
            
            // 2. Prioritize based on fill level
            const prioritizedBins = [...urgentBins, ...normalBins, ...lowBins];
            
            // 3. Add weights based on fill level
            const weightedBins = prioritizedBins.map(bin => ({
                ...bin,
                weight: this.getBinWeight(bin.fillLevel)
            }));
            
            // 4. Get distance matrix with traffic consideration
            const distanceMatrix = await this.getDistanceMatrixWithTraffic(
                collectorLocation, 
                weightedBins,
                trafficData
            );
            
            // 5. Solve TSP with weighted priority
            const optimizedRoute = this.solveWeightedTSP(distanceMatrix, weightedBins);
            
            // 6. Calculate estimated time with traffic
            const estimatedTime = this.calculateTimeWithTraffic(optimizedRoute, trafficData);
            
            // 7. Generate step-by-step instructions
            const instructions = this.generateInstructions(optimizedRoute);
            
            return {
                success: true,
                route: optimizedRoute,
                totalDistance: optimizedRoute.totalDistance,
                totalTime: estimatedTime,
                binsCount: optimizedRoute.bins.length,
                urgentBinsCount: urgentBins.length,
                fuelSaved: this.calculateFuelSavings(optimizedRoute),
                carbonSaved: this.calculateCarbonSavings(optimizedRoute),
                instructions: instructions,
                mapUrl: this.generateMapUrl(optimizedRoute)
            };
            
        } catch (error) {
            console.error('Route optimization error:', error);
            return this.fallbackRoute(collectorLocation, bins);
        }
    }

    getBinWeight(fillLevel) {
        if (fillLevel > 80) return 10;    // Highest priority
        if (fillLevel > 60) return 7;
        if (fillLevel > 40) return 4;
        if (fillLevel > 20) return 2;
        return 1;
    }

    async getDistanceMatrixWithTraffic(origin, destinations, trafficData) {
        try {
            const origins = `${origin.lat},${origin.lng}`;
            const dests = destinations.map(d => `${d.latitude},${d.longitude}`).join('|');
            
            // Google Maps Distance Matrix API with traffic
            const response = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
                params: {
                    origins: origins,
                    destinations: dests,
                    key: this.apiKey,
                    departure_time: 'now',
                    traffic_model: 'best_guess'
                }
            });
            
            if (response.data.status === 'OK') {
                const elements = response.data.rows[0].elements;
                return destinations.map((dest, index) => ({
                    ...dest,
                    distance: elements[index].distance.value,
                    duration: elements[index].duration_in_traffic?.value || elements[index].duration.value,
                    durationText: elements[index].duration_in_traffic?.text || elements[index].duration.text
                }));
            }
            
            throw new Error('Distance matrix failed');
            
        } catch (error) {
            // Fallback to straight-line distance
            return destinations.map(dest => ({
                ...dest,
                distance: this.calculateDistance(origin, dest),
                duration: this.calculateDistance(origin, dest) / 50 * 60 // 50km/h
            }));
        }
    }

    solveWeightedTSP(distanceMatrix, bins) {
        // Greedy algorithm with priority weights
        let currentLocation = distanceMatrix[0]; // Start from collector
        let visited = new Set();
        let route = [currentLocation];
        let totalDistance = 0;
        
        while (visited.size < bins.length) {
            let bestNext = null;
            let bestScore = -Infinity;
            
            for (let bin of distanceMatrix) {
                if (!visited.has(bin.id)) {
                    // Score = weight / distance
                    const score = bin.weight / (this.getDistance(currentLocation, bin) + 0.1);
                    if (score > bestScore) {
                        bestScore = score;
                        bestNext = bin;
                    }
                }
            }
            
            if (bestNext) {
                totalDistance += this.getDistance(currentLocation, bestNext);
                route.push(bestNext);
                visited.add(bestNext.id);
                currentLocation = bestNext;
            }
        }
        
        // Return to start
        totalDistance += this.getDistance(currentLocation, distanceMatrix[0]);
        
        return {
            bins: route,
            totalDistance: totalDistance,
            totalDuration: totalDistance / 50 * 60 // 50km/h average
        };
    }

    calculateTimeWithTraffic(route, trafficData) {
        // Add traffic multipliers
        let totalTime = route.totalDuration;
        
        if (trafficData) {
            const trafficMultiplier = this.getTrafficMultiplier(trafficData);
            totalTime *= trafficMultiplier;
        }
        
        // Add time for collection (5 mins per bin)
        totalTime += route.bins.length * 5;
        
        return totalTime;
    }

    getTrafficMultiplier(trafficData) {
        const hour = new Date().getHours();
        
        // Peak hours: 8-10am, 5-7pm
        if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19)) {
            return 1.5;
        }
        
        // Moderate traffic: 7-8am, 4-5pm, 7-8pm
        if ((hour >= 7 && hour < 8) || (hour >= 16 && hour < 17) || (hour >= 19 && hour < 20)) {
            return 1.2;
        }
        
        return 1.0;
    }

    generateInstructions(route) {
        const instructions = [];
        let currentTime = new Date();
        
        for (let i = 0; i < route.bins.length; i++) {
            const bin = route.bins[i];
            const travelTime = i > 0 ? this.getTravelTime(route.bins[i-1], bin) : 0;
            currentTime = new Date(currentTime.getTime() + travelTime * 60 * 1000);
            
            instructions.push({
                step: i + 1,
                action: i === 0 ? 'Start from current location' : `Travel to ${bin.locality}`,
                binId: bin.id,
                binType: bin.binType,
                fillLevel: bin.fillLevel,
                estimatedTime: currentTime.toLocaleTimeString(),
                duration: travelTime,
                distance: this.getDistance(i > 0 ? route.bins[i-1] : route.bins[0], bin),
                urgency: bin.fillLevel > 80 ? 'URGENT' : 'Normal'
            });
        }
        
        return instructions;
    }

    calculateFuelSavings(route) {
        // 10% fuel savings from optimized route
        const originalDistance = route.totalDistance * 1.2; // 20% longer without optimization
        const saved = originalDistance - route.totalDistance;
        return (saved / 1000) * 0.1; // 0.1L per km
    }

    calculateCarbonSavings(route) {
        // 2.3kg CO2 per liter of diesel
        const fuelSaved = this.calculateFuelSavings(route);
        return fuelSaved * 2.3;
    }

    generateMapUrl(route) {
        const waypoints = route.bins.map(b => `${b.latitude},${b.longitude}`).join('|');
        return `https://www.google.com/maps/dir/?api=1&origin=${route.bins[0].latitude},${route.bins[0].longitude}&destination=${route.bins[route.bins.length-1].latitude},${route.bins[route.bins.length-1].longitude}&waypoints=${waypoints}&travelmode=driving`;
    }

    calculateDistance(point1, point2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(point2.latitude - point1.latitude);
        const dLon = this.toRad(point2.longitude - point1.longitude);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(this.toRad(point1.latitude)) * Math.cos(this.toRad(point2.latitude)) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    getTravelTime(bin1, bin2) {
        const distance = this.calculateDistance(bin1, bin2);
        return distance / 50 * 60; // 50km/h average speed
    }

    toRad(degrees) {
        return degrees * Math.PI / 180;
    }

    fallbackRoute(collectorLocation, bins) {
        return {
            success: true,
            route: {
                bins: bins.sort((a, b) => b.fillLevel - a.fillLevel),
                totalDistance: 'N/A',
                totalDuration: 'N/A'
            },
            totalDistance: 'N/A',
            totalTime: 'N/A',
            binsCount: bins.length,
            urgentBinsCount: bins.filter(b => b.fillLevel > 80).length,
            instructions: [{ step: 1, action: 'Use fallback route', note: 'Google Maps API key needed for optimal routing' }]
        };
    }
}

module.exports = RouteOptimizer;