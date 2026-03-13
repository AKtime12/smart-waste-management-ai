# backend/app/api/analytics.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import List
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.models import Collection, User, Bin, Ward, PointTransaction
from app.services.ai_service import AIService
from app.services.points_service import PointsService
from pydantic import BaseModel

router = APIRouter()

class DashboardStats(BaseModel):
    total_bins: int
    full_bins: int
    collections_today: int
    green_points_issued: int
    total_waste_collected: float
    avg_segregation_rate: float

class PredictionResponse(BaseModel):
    date: str
    predicted_weight: float
    confidence: float

@router.get("/analytics/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db)
):
    # Total bins
    total_result = await db.execute(select(func.count()).select_from(Bin))
    total_bins = total_result.scalar()
    
    # Full bins
    full_result = await db.execute(
        select(func.count()).select_from(Bin).where(Bin.current_fill_level >= 80)
    )
    full_bins = full_result.scalar()
    
    # Collections today
    today = datetime.now().date()
    collections_result = await db.execute(
        select(func.count()).select_from(Collection)
        .where(func.date(Collection.collection_time) == today)
    )
    collections_today = collections_result.scalar()
    
    # Points issued today
    points_result = await db.execute(
        select(func.sum(PointTransaction.points))
        .where(func.date(PointTransaction.created_at) == today)
    )
    green_points = points_result.scalar() or 0
    
    # Total waste collected today
    waste_result = await db.execute(
        select(func.sum(Collection.weight_kg))
        .where(func.date(Collection.collection_time) == today)
    )
    total_waste = waste_result.scalar() or 0
    
    # Average segregation quality
    seg_result = await db.execute(
        select(func.avg(Collection.segregation_quality))
        .where(Collection.segregation_quality.isnot(None))
    )
    avg_seg = seg_result.scalar() or 0
    
    return {
        "total_bins": total_bins or 0,
        "full_bins": full_bins or 0,
        "collections_today": collections_today or 0,
        "green_points_issued": green_points or 0,
        "total_waste_collected": round(total_waste, 2),
        "avg_segregation_rate": round(avg_seg, 2)
    }

@router.get("/analytics/predictions", response_model=List[PredictionResponse])
async def get_predictions(
    ward_id: str = None,
    days: int = 7,
    db: AsyncSession = Depends(get_db),
    ai_service: AIService = Depends(lambda: request.app.state.ai_service)
):
    predictions = await ai_service.predict_waste_generation(ward_id or "default", days)
    return predictions

@router.get("/analytics/leaderboard")
async def get_leaderboard(
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    points_service: PointsService = Depends(lambda: request.app.state.points_service)
):
    leaderboard = await points_service.get_leaderboard(limit=limit)
    return leaderboard

@router.get("/analytics/ward-performance")
async def get_ward_performance(
    db: AsyncSession = Depends(get_db)
):
    # Get all wards with stats
    result = await db.execute(
        select(Ward)
    )
    wards = result.scalars().all()
    
    performance = []
    for ward in wards:
        # Get collections for this ward
        collections_result = await db.execute(
            select(Collection)
            .join(Bin)
            .where(Bin.ward_id == ward.id)
            .where(Collection.collection_time >= datetime.now() - timedelta(days=30))
        )
        collections = collections_result.scalars().all()
        
        total_waste = sum(c.weight_kg for c in collections)
        avg_quality = sum(c.segregation_quality for c in collections) / len(collections) if collections else 0
        
        performance.append({
            "ward_id": str(ward.id),
            "ward_name": ward.name,
            "total_waste_kg": round(total_waste, 2),
            "avg_segregation_quality": round(avg_quality, 2),
            "green_points": ward.green_points,
            "collections_count": len(collections)
        })
    
    return sorted(performance, key=lambda x: x['green_points'], reverse=True)