# backend/app/services/iot_service.py
import asyncio
import random
from datetime import datetime
import logging
from typing import Dict, List
import json

logger = logging.getLogger(__name__)

class IoTService:
    def __init__(self):
        self.monitoring = False
        self.bins = {}  # Store bin status
        self.simulation_task = None
        
    async def start_monitoring(self):
        """Start monitoring IoT sensors"""
        self.monitoring = True
        self.simulation_task = asyncio.create_task(self._simulate_sensors())
        logger.info("IoT monitoring started")
    
    async def stop_monitoring(self):
        """Stop monitoring"""
        self.monitoring = False
        if self.simulation_task:
            self.simulation_task.cancel()
        logger.info("IoT monitoring stopped")
    
    async def _simulate_sensors(self):
        """Simulate sensor readings"""
        while self.monitoring:
            try:
                # Simulate fill level changes for all bins
                for bin_id in list(self.bins.keys()):
                    current = self.bins[bin_id].get('fill_level', 0)
                    
                    # Random fill rate (0-5% per cycle)
                    increase = random.uniform(0, 5)
                    new_level = min(100, current + increase)
                    
                    self.bins[bin_id].update({
                        'fill_level': new_level,
                        'temperature': random.uniform(20, 35),
                        'battery': random.uniform(80, 100),
                        'timestamp': datetime.now().isoformat(),
                        'status': 'full' if new_level >= 80 else 'active'
                    })
                    
                    # Notify if bin becomes full
                    if new_level >= 80 and current < 80:
                        await self._notify_bin_full(bin_id)
                
                # Add some random new bins
                if random.random() < 0.1:  # 10% chance
                    await self._add_random_bin()
                
            except Exception as e:
                logger.error(f"Error in sensor simulation: {e}")
            
            await asyncio.sleep(10)  # Update every 10 seconds
    
    async def register_bin(self, bin_id: str, initial_data: dict):
        """Register a new bin for monitoring"""
        self.bins[bin_id] = {
            'fill_level': 0,
            'temperature': 25,
            'battery': 100,
            'status': 'active',
            'timestamp': datetime.now().isoformat(),
            **initial_data
        }
        logger.info(f"Bin {bin_id} registered for monitoring")
    
    async def get_bin_status(self, bin_id: str) -> dict:
        """Get real-time bin status"""
        if bin_id in self.bins:
            return self.bins[bin_id]
        return {
            'fill_level': 0,
            'status': 'unknown',
            'error': 'Bin not found'
        }
    
    async def get_full_bins(self, threshold: float = 80) -> List[Dict]:
        """Get all bins that need collection"""
        full_bins = []
        for bin_id, data in self.bins.items():
            if data.get('fill_level', 0) >= threshold:
                full_bins.append({
                    'id': bin_id,
                    'fill_level': data['fill_level'],
                    'location': data.get('location', {}),
                    'status': data['status']
                })
        return full_bins
    
    async def _notify_bin_full(self, bin_id: str):
        """Notify that a bin is full"""
        logger.info(f"Bin {bin_id} is now FULL at {self.bins[bin_id]['fill_level']}%")
        # In production, this would trigger notifications
    
    async def _add_random_bin(self):
        """Add a random bin for simulation"""
        bin_id = f"BIN{random.randint(1000, 9999)}"
        await self.register_bin(bin_id, {
            'location': {
                'lat': random.uniform(28.4, 28.7),
                'lon': random.uniform(77.0, 77.3)
            },
            'type': random.choice(['wet', 'dry', 'community'])
        })