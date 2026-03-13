# backend/app/api/bins.py
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List
import uuid
from datetime import datetime
import random

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.models import Bin, User, Ward, Household
from app.services.iot_service import IoTService
from pydantic import BaseModel

router = APIRouter()

class BinCreate(BaseModel):
    bin_type: str
    capacity_kg: float
    location_type: str
    ward_id: str
    household_id: str = None
    latitude: float
    longitude: float

class BinResponse(BaseModel):
    id: str
    qr_code: str
    bin_type: str
    current_fill_level: float
    status: str
    location_type: str

class BinStatus(BaseModel):
    fill_level: float
    temperature: float
    battery: float
    status: str

@router.post("/bins", response_model=BinResponse)
async def create_bin(
    bin_data: BinCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    iot_service: IoTService = Depends(lambda: request.app.state.iot_service)
):
    # Generate unique QR code
    qr_code = f"BIN{random.randint(10000, 99999)}"
    
    # Create bin
    bin = Bin(
        id=uuid.uuid4(),
        qr_code=qr_code,
        bin_type=bin_data.bin_type,
        capacity_kg=bin_data.capacity_kg,
        location_type=bin_data.location_type,
        ward_id=bin_data.ward_id,
        household_id=bin_data.household_id,
        latitude=bin_data.latitude,
        longitude=bin_data.longitude,
        status='active',
        current_fill_level=0
    )
    
    db.add(bin)
    await db.commit()
    await db.refresh(bin)
    
    # Register with IoT service
    await iot_service.register_bin(str(bin.id), {
        'location': {'lat': bin_data.latitude, 'lon': bin_data.longitude},
        'type': bin_data.bin_type
    })
    
    return bin

@router.get("/bins", response_model=List[BinResponse])
async def get_bins(
    ward_id: str = None,
    status: str = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Bin)
    if ward_id:
        query = query.where(Bin.ward_id == ward_id)
    if status:
        query = query.where(Bin.status == status)
    
    result = await db.execute(query)
    bins = result.scalars().all()
    return bins

@router.get("/bins/full", response_model=List[dict])
async def get_full_bins(
    threshold: float = 80,
    db: AsyncSession = Depends(get_db),
    iot_service: IoTService = Depends(lambda: request.app.state.iot_service)
):
    # Get from IoT service for real-time data
    full_bins = await iot_service.get_full_bins(threshold)
    return full_bins

@router.get("/bins/{bin_id}/status", response_model=BinStatus)
async def get_bin_status(
    bin_id: str,
    iot_service: IoTService = Depends(lambda: request.app.state.iot_service)
):
    status = await iot_service.get_bin_status(bin_id)
    return BinStatus(**status)

@router.post("/bins/{bin_id}/empty")
async def mark_bin_emptied(
    bin_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Update bin
    stmt = (
        update(Bin)
        .where(Bin.id == bin_id)
        .values(
            current_fill_level=0,
            last_emptied=datetime.now(),
            status='active'
        )
    )
    await db.execute(stmt)
    await db.commit()
    
    return {"message": "Bin marked as emptied"}