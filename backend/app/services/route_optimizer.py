# backend/app/services/route_optimizer.py
import numpy as np
from typing import List, Dict, Tuple
import logging
from datetime import datetime
import random

logger = logging.getLogger(__name__)

class RouteOptimizer:
    def __init__(self):
        self.speed_kmh = 30  # Average speed in km/h
        self.collection_time_per_bin = 5  # Minutes per bin
        
    async def optimize_route(
        self,
        start_location: Tuple[float, float],
        bins: List[Dict],
        max_bins: int = 10
    ) -> Dict:
        """
        Optimize collection route using nearest neighbor algorithm
        """
        try:
            if not bins:
                return {
                    "route": [],
                    "total_distance": 0,
                    "estimated_time": 0,
                    "bins_count": 0
                }
            
            # Sort bins by priority (fill level)
            bins = sorted(bins, key=lambda x: x.get('fill_level', 0), reverse=True)
            
            # Limit number of bins
            bins = bins[:max_bins]
            
            # Start point
            current_location = start_location
            route = []
            total_distance = 0
            unvisited = bins.copy()
            
            while unvisited:
                # Find nearest unvisited bin
                nearest = None
                min_distance = float('inf')
                
                for bin in unvisited:
                    bin_loc = (bin.get('latitude', 0), bin.get('longitude', 0))
                    distance = self._calculate_distance(current_location, bin_loc)
                    
                    if distance < min_distance:
                        min_distance = distance
                        nearest = bin
                
                if nearest:
                    route.append(nearest)
                    total_distance += min_distance
                    current_location = (nearest.get('latitude', 0), nearest.get('longitude', 0))
                    unvisited.remove(nearest)
            
            # Calculate return distance to start
            if route:
                return_distance = self._calculate_distance(
                    current_location,
                    start_location
                )
                total_distance += return_distance
            
            # Calculate time
            travel_time = (total_distance / self.speed_kmh) * 60  # minutes
            collection_time = len(route) * self.collection_time_per_bin
            total_time = travel_time + collection_time
            
            return {
                "route": route,
                "total_distance_km": round(total_distance, 2),
                "estimated_time_minutes": int(total_time),
                "bins_count": len(route),
                "optimization_quality": "high" if len(route) > 0 else "low"
            }
            
        except Exception as e:
            logger.error(f"Error optimizing route: {e}")
            return {
                "error": str(e),
                "route": [],
                "total_distance": 0,
                "estimated_time": 0
            }
    
    def _calculate_distance(self, point1: Tuple[float, float], point2: Tuple[float, float]) -> float:
        """Calculate distance between two points (simplified)"""
        # Simple Euclidean distance (approximate km)
        lat1, lon1 = point1
        lat2, lon2 = point2
        
        # Rough conversion: 1 degree ≈ 111 km
        lat_dist = (lat1 - lat2) * 111
        lon_dist = (lon1 - lon2) * 111 * np.cos(np.radians((lat1 + lat2) / 2))
        
        return np.sqrt(lat_dist**2 + lon_dist**2)
    
    async def get_traffic_factor(self, location: Tuple[float, float], time: datetime = None) -> float:
        """Get traffic factor for a location (simulated)"""
        # Simulate traffic based on time
        if time is None:
            time = datetime.now()
        
        hour = time.hour
        
        # Rush hours (8-10 AM, 5-8 PM)
        if (8 <= hour <= 10) or (17 <= hour <= 20):
            return random.uniform(1.5, 2.0)
        # Day time
        elif 10 <= hour <= 17:
            return random.uniform(1.2, 1.5)
        # Night
        else:
            return random.uniform(1.0, 1.2)