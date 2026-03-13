# backend/app/services/points_service.py
from typing import Dict, List
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class PointsService:
    def __init__(self):
        self.points_multiplier = {
            'wet': 1.0,
            'dry': 1.0,
            'hazardous': 1.5,
            'electronic': 1.5,
            'community': 2.0
        }
        
    async def award_points(
        self,
        user_id: str,
        collection_data: Dict,
        verification_data: Dict
    ) -> Dict:
        """
        Award points based on segregation quality
        """
        try:
            base_points = verification_data.get('points_awarded', 0)
            
            # Apply multiplier based on bin type
            bin_type = collection_data.get('bin_type', 'wet')
            multiplier = self.points_multiplier.get(bin_type, 1.0)
            
            total_points = int(base_points * multiplier)
            
            # Bonus for consistent good behavior
            consistency_bonus = await self._check_consistency(user_id)
            total_points += consistency_bonus
            
            return {
                "user_id": user_id,
                "points_earned": total_points,
                "base_points": base_points,
                "multiplier": multiplier,
                "consistency_bonus": consistency_bonus,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error awarding points: {e}")
            return {
                "error": str(e),
                "points_earned": 0
            }
    
    async def apply_penalty(
        self,
        user_id: str,
        reason: str,
        severity: str = 'medium'
    ) -> Dict:
        """
        Apply penalty for poor segregation
        """
        penalty_points = {
            'low': -2,
            'medium': -5,
            'high': -10
        }
        
        points = penalty_points.get(severity, -5)
        
        return {
            "user_id": user_id,
            "points_penalty": points,
            "reason": reason,
            "severity": severity,
            "timestamp": datetime.now().isoformat()
        }
    
    async def get_leaderboard(self, ward_id: str = None, limit: int = 10) -> List[Dict]:
        """
        Get top performing users/wards
        """
        # Simulate leaderboard data
        leaderboard = []
        
        for i in range(limit):
            leaderboard.append({
                "rank": i + 1,
                "name": f"User/Ward {i + 1}",
                "points": 1000 - (i * 50),
                "segregation_rate": round(95 - (i * 3), 1),
                "collections": 50 - (i * 2)
            })
        
        return leaderboard
    
    async def _check_consistency(self, user_id: str) -> int:
        """Check if user has consistent good behavior"""
        # In production, query database for history
        # For demo, return random bonus
        import random
        return random.choice([0, 2, 5])