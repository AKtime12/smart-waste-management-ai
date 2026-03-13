# backend/app/api/routes.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Tuple
from datetime import datetime
import uuid

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.models import Route, User, Bin
from app.services.route_optimizer import RouteOptimizer
from app.services.iot_service import IoTService
from pydantic import BaseModel

router = APIRouter()

class RouteRequest(BaseModel):
    start_lat: float
    start_lon: float
    max_bins: int = 10
    ward_id: str = None

class RouteResponse(BaseModel):
    route: List[dict]
    total_distance_km: float
    estimated_time_minutes: int
    bins_count: int

@router.post("/routes/optimize", response_model=RouteResponse)
async def optimize_route(
    request: RouteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    route_optimizer: RouteOptimizer = Depends(lambda: request.app.state.route_optimizer),
    iot_service: IoTService = Depends(lambda: request.app.state.iot_service)
):
    # Get bins that need collection
    full_bins = await iot_service.get_full_bins()
    
    # Convert to format needed for optimizer
    bins_for_route = []
    for bin_data in full_bins:
        # Get bin details from database if needed
        result = await db.execute(
            select(Bin).where(Bin.id == bin_data['id'])
        )
        bin = result.scalar_one_or_none()
        if bin:
            bins_for_route.append({
                'id': str(bin.id),
                'latitude': bin.latitude,
                'longitude': bin.longitude,
                'fill_level': bin_data['fill_level'],
                'bin_type': bin.bin_type
            })
    
    # Optimize route
    result = await route_optimizer.optimize_route(
        (request.start_lat, request.start_lon),
        bins_for_route,
        request.max_bins
    )
    
    # Save route to database
    route = Route(
        id=uuid.uuid4(),
        collector_id=current_user.id,
        route_data=result,
        distance_km=result['total_distance_km'],
        estimated_time_minutes=result['estimated_time_minutes'],
        status='planned',
        created_date=datetime.now()
    )
    db.add(route)
    await db.commit()
    
    return result

@router.post("/routes/{route_id}/start")
async def start_route(
    route_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Route).where(Route.id == route_id)
    )
    route = result.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    route.status = 'in_progress'
    await db.commit()
    
    return {"message": "Route started"}

@router.post("/routes/{route_id}/complete")
async def complete_route(
    route_id: str,
    actual_time: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Route).where(Route.id == route_id)
    )
    route = result.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    route.status = 'completed'
    route.actual_time_minutes = actual_time
    route.completed_at = datetime.now()
    await db.commit()
    
    return {"message": "Route completed"}