# backend/app/api/collections.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import uuid
from datetime import datetime
import shutil
import os

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.models import Collection, Bin, User, SegregationVerification, PointTransaction
from app.services.ai_service import AIService
from app.services.points_service import PointsService
from pydantic import BaseModel

router = APIRouter()

class CollectionResponse(BaseModel):
    id: str
    bin_id: str
    weight_kg: float
    segregation_quality: float
    points_awarded: int
    collection_time: datetime

@router.post("/collections/scan")
async def scan_and_collect(
    request: Request,
    bin_qr: str,
    weight_kg: float,
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Find bin by QR code
    result = await db.execute(
        select(Bin).where(Bin.qr_code == bin_qr)
    )
    bin = result.scalar_one_or_none()
    if not bin:
        raise HTTPException(status_code=404, detail="Bin not found")
    
    # Create collection record
    collection = Collection(
        id=uuid.uuid4(),
        bin_id=bin.id,
        collector_id=current_user.id,
        weight_kg=weight_kg,
        collection_time=datetime.now()
    )
    db.add(collection)
    await db.flush()
    
    # Save image temporarily
    image_path = f"data/collections/{collection.id}.jpg"
    os.makedirs("data/collections", exist_ok=True)
    with open(image_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)
    
    collection.image_url = image_path
    await db.commit()
    
    # Analyze with AI in background
    background_tasks.add_task(
        analyze_collection,
        str(collection.id),
        image_path,
        str(bin.id),
        str(current_user.id),
        request.app.state.ai_service,
        request.app.state.points_service,
        db
    )
    
    return {
        "message": "Collection recorded, analysis in progress",
        "collection_id": str(collection.id)
    }

async def analyze_collection(
    collection_id: str,
    image_path: str,
    bin_id: str,
    collector_id: str,
    ai_service: AIService,
    points_service: PointsService,
    db: AsyncSession
):
    try:
        # Read image
        with open(image_path, "rb") as f:
            image_bytes = f.read()
        
        # AI Analysis
        ai_result = await ai_service.analyze_waste_image(image_bytes)
        
        # Create verification record
        async with db.begin():
            # Get collection
            result = await db.execute(
                select(Collection).where(Collection.id == collection_id)
            )
            collection = result.scalar_one()
            
            # Get bin to find household
            bin_result = await db.execute(
                select(Bin).where(Bin.id == bin_id)
            )
            bin = bin_result.scalar_one()
            
            # Award points if correct
            if ai_result['is_correct']:
                points_result = await points_service.award_points(
                    collector_id,
                    {'bin_type': bin.bin_type},
                    ai_result
                )
                points_awarded = points_result['points_earned']
            else:
                points_result = await points_service.apply_penalty(
                    collector_id,
                    "Poor segregation detected"
                )
                points_awarded = points_result['points_penalty']
            
            # Update collection
            collection.ai_verified = True
            collection.ai_feedback = ai_result
            collection.segregation_quality = ai_result['confidence'] * 100
            collection.points_awarded = points_awarded
            
            # Create verification record
            verification = SegregationVerification(
                id=uuid.uuid4(),
                collection_id=collection_id,
                ai_confidence=ai_result['confidence'],
                detected_waste_types=ai_result['detected_types'],
                is_correct=ai_result['is_correct'],
                points_awarded=ai_result['points_awarded']
            )
            db.add(verification)
            
            # Create point transaction
            transaction = PointTransaction(
                id=uuid.uuid4(),
                user_id=collector_id,
                points=points_awarded,
                transaction_type='earned' if points_awarded > 0 else 'penalty',
                reason=ai_result['is_correct'] and 'Proper segregation' or 'Poor segregation',
                collection_id=collection_id
            )
            db.add(transaction)
        
        print(f"Analysis complete for collection {collection_id}")
        
    except Exception as e:
        print(f"Error in background analysis: {e}")

@router.get("/collections/household/{household_id}", response_model=List[CollectionResponse])
async def get_household_collections(
    household_id: str,
    db: AsyncSession = Depends(get_db)
):
    # Find bins for household
    bin_result = await db.execute(
        select(Bin).where(Bin.household_id == household_id)
    )
    bins = bin_result.scalars().all()
    bin_ids = [b.id for b in bins]
    
    # Get collections
    if bin_ids:
        result = await db.execute(
            select(Collection)
            .where(Collection.bin_id.in_(bin_ids))
            .order_by(Collection.collection_time.desc())
        )
        collections = result.scalars().all()
        return collections
    
    return []