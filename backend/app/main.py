# backend/app/main.py
from fastapi import FastAPI, Request, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from contextlib import asynccontextmanager
import logging
import uuid
from datetime import datetime, timedelta
from typing import List, Optional
import json
import os
import qrcode
from io import BytesIO
import base64

from app.api import auth, users, bins, collections, routes, analytics
from app.core.database import engine, SessionLocal
from app.core.config import settings
from app.services.ai_service import AIService
from app.services.iot_service import IoTService
from app.services.route_optimizer import RouteOptimizer
from app.services.points_service import PointsService
from app.models import models

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Templates for simple web interface
templates = Jinja2Templates(directory="templates")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting AI Waste Management System...")
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    
    # Initialize services
    app.state.ai_service = AIService()
    app.state.iot_service = IoTService()
    app.state.route_optimizer = RouteOptimizer()
    app.state.points_service = PointsService()
    
    # Start IoT monitoring
    await app.state.iot_service.start_monitoring()
    
    logger.info("System started successfully")
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    await app.state.iot_service.stop_monitoring()
    await engine.dispose()

app = FastAPI(
    title="AI Waste Management System",
    description="Intelligent waste management with AI-powered segregation",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(bins.router, prefix="/api/bins", tags=["Bins"])
app.include_router(collections.router, prefix="/api/collections", tags=["Collections"])
app.include_router(routes.router, prefix="/api/routes", tags=["Routes"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])

# Simple web interface
@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return templates.TemplateResponse(
        "index.html", 
        {"request": request, "title": "AI Waste Management System"}
    )

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    return templates.TemplateResponse(
        "dashboard.html",
        {"request": request, "title": "Dashboard"}
    )

@app.get("/generate_qr/{bin_id}")
async def generate_qr(bin_id: str):
    """Generate QR code for a bin"""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(f"waste-bin:{bin_id}")
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    return JSONResponse({"qr_code": f"data:image/png;base64,{img_str}"})

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "database": "connected",
            "ai_service": "loaded",
            "iot_service": "running"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)