# backend/app/models/models.py
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, JSON, DECIMAL, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255))
    role = Column(String(50))  # admin, collector, household, ward_admin
    phone = Column(String(20))
    address = Column(Text)
    green_points = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Ward(Base):
    __tablename__ = "wards"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    zone = Column(String(100))
    code = Column(String(50), unique=True)
    total_population = Column(Integer, default=0)
    green_points = Column(Integer, default=0)
    latitude = Column(Float)
    longitude = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Household(Base):
    __tablename__ = "households"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    ward_id = Column(UUID(as_uuid=True), ForeignKey("wards.id"))
    house_number = Column(String(50))
    street = Column(String(255))
    latitude = Column(Float)
    longitude = Column(Float)
    green_points = Column(Integer, default=0)
    total_waste_kg = Column(Float, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Bin(Base):
    __tablename__ = "bins"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    qr_code = Column(String(255), unique=True, nullable=False)
    bin_type = Column(String(50))  # wet, dry, hazardous, electronic, community
    capacity_kg = Column(Float)
    current_fill_level = Column(Float, default=0)
    location_type = Column(String(50))  # household, community
    household_id = Column(UUID(as_uuid=True), ForeignKey("households.id"), nullable=True)
    ward_id = Column(UUID(as_uuid=True), ForeignKey("wards.id"))
    latitude = Column(Float)
    longitude = Column(Float)
    status = Column(String(50), default="active")  # active, full, maintenance
    last_emptied = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class SensorReading(Base):
    __tablename__ = "sensor_readings"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bin_id = Column(UUID(as_uuid=True), ForeignKey("bins.id"))
    fill_level = Column(Float)
    temperature = Column(Float)
    battery_level = Column(Float)
    status = Column(String(50))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class Collection(Base):
    __tablename__ = "collections"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bin_id = Column(UUID(as_uuid=True), ForeignKey("bins.id"))
    collector_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    weight_kg = Column(Float)
    segregation_quality = Column(Float)
    image_url = Column(String(500))
    ai_verified = Column(Boolean, default=False)
    ai_feedback = Column(JSON)
    points_awarded = Column(Integer, default=0)
    collection_time = Column(DateTime(timezone=True), server_default=func.now())

class SegregationVerification(Base):
    __tablename__ = "segregation_verifications"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collection_id = Column(UUID(as_uuid=True), ForeignKey("collections.id"))
    ai_confidence = Column(Float)
    detected_waste_types = Column(JSON)
    is_correct = Column(Boolean)
    points_awarded = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class PointTransaction(Base):
    __tablename__ = "point_transactions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    points = Column(Integer)
    transaction_type = Column(String(50))  # earned, redeemed, penalty
    reason = Column(Text)
    collection_id = Column(UUID(as_uuid=True), ForeignKey("collections.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Route(Base):
    __tablename__ = "routes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collector_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    route_data = Column(JSON)
    distance_km = Column(Float)
    estimated_time_minutes = Column(Integer)
    actual_time_minutes = Column(Integer)
    status = Column(String(50))
    created_date = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))

class WastePrediction(Base):
    __tablename__ = "waste_predictions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ward_id = Column(UUID(as_uuid=True), ForeignKey("wards.id"))
    predicted_date = Column(DateTime(timezone=True))
    predicted_weight_kg = Column(Float)
    confidence = Column(Float)
    factors = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())