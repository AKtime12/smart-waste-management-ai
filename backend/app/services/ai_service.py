# backend/app/services/ai_service.py
import numpy as np
from PIL import Image
import io
import logging
from datetime import datetime, timedelta
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
import joblib
import os
import json
import random

logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        self.waste_categories = ['wet', 'dry', 'hazardous', 'recyclable', 'electronic']
        self.segregation_model = None
        self.load_models()
        
    def load_models(self):
        """Load or create AI models"""
        try:
            # Try to load existing model
            model_path = 'ml_models/segregation_model.pkl'
            if os.path.exists(model_path):
                self.segregation_model = joblib.load(model_path)
                logger.info("Loaded existing segregation model")
            else:
                # Create a simple model for demonstration
                self._create_demo_model()
                logger.info("Created demo segregation model")
        except Exception as e:
            logger.error(f"Error loading models: {e}")
            self._create_demo_model()
    
    def _create_demo_model(self):
        """Create a simple model for demonstration"""
        # Create a simple random forest for demo
        self.segregation_model = RandomForestClassifier(n_estimators=10, random_state=42)
        
        # Generate dummy training data
        X_train = np.random.rand(100, 10)  # 10 features
        y_train = np.random.randint(0, 2, 100)  # Binary classification
        
        self.segregation_model.fit(X_train, y_train)
        
        # Save model
        os.makedirs('ml_models', exist_ok=True)
        joblib.dump(self.segregation_model, 'ml_models/segregation_model.pkl')
    
    async def analyze_waste_image(self, image_bytes: bytes) -> dict:
        """
        Analyze waste image and determine segregation quality
        """
        try:
            # Convert bytes to image
            image = Image.open(io.BytesIO(image_bytes))
            
            # Resize for processing
            image = image.resize((224, 224))
            
            # Convert to numpy array
            img_array = np.array(image) / 255.0
            
            # Extract features (simplified for demo)
            features = self._extract_features(img_array)
            
            # Predict segregation quality
            if self.segregation_model:
                # Get prediction probability
                pred_proba = self.segregation_model.predict_proba([features])[0]
                confidence = float(max(pred_proba))
                is_correct = confidence > 0.7
            else:
                # Simulate for demo
                confidence = random.uniform(0.5, 0.95)
                is_correct = confidence > 0.7
            
            # Generate detected waste types
            detected_types = {}
            for category in self.waste_categories:
                detected_types[category] = random.uniform(0, 0.3)
            
            # Ensure primary category has higher value
            primary_idx = random.randint(0, len(self.waste_categories) - 1)
            detected_types[self.waste_categories[primary_idx]] = confidence
            
            # Normalize
            total = sum(detected_types.values())
            for cat in detected_types:
                detected_types[cat] = round(detected_types[cat] / total, 3)
            
            # Calculate points
            points = self._calculate_points(is_correct, detected_types)
            
            return {
                "detected_types": detected_types,
                "primary_type": self.waste_categories[primary_idx],
                "confidence": round(confidence, 3),
                "is_correct": is_correct,
                "points_awarded": points,
                "analysis_timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error analyzing image: {e}")
            return {
                "error": str(e),
                "is_correct": False,
                "points_awarded": 0
            }
    
    def _extract_features(self, img_array):
        """Extract simple features from image"""
        features = [
            np.mean(img_array),  # Average brightness
            np.std(img_array),   # Contrast
            np.mean(img_array[:, :, 0]),  # Red channel
            np.mean(img_array[:, :, 1]),  # Green channel
            np.mean(img_array[:, :, 2]),  # Blue channel
            np.mean(img_array[::2, ::2]),  # Downsampled mean
            np.std(img_array[::2, ::2]),   # Downsampled std
            np.sum(img_array > 0.5),       # Bright pixels
            np.sum(img_array < 0.2),       # Dark pixels
            np.mean(np.abs(np.diff(img_array, axis=0)))  # Edge measure
        ]
        return np.array(features)
    
    def _calculate_points(self, is_correct: bool, detected_types: dict) -> int:
        """Calculate green points based on segregation quality"""
        from app.core.config import settings
        
        if not is_correct:
            return settings.PENALTY_POINTS
        
        base_points = settings.POINTS_PER_CORRECT_SEGREGATION
        
        # Bonus for proper hazardous/electronic waste handling
        hazardous_level = detected_types.get('hazardous', 0)
        electronic_level = detected_types.get('electronic', 0)
        
        bonus = 0
        if hazardous_level < 0.1:
            bonus += settings.BONUS_POINTS_HAZARDOUS
        if electronic_level < 0.1:
            bonus += settings.BONUS_POINTS_HAZARDOUS
        
        return base_points + bonus
    
    async def predict_waste_generation(self, ward_id: str, days_ahead: int = 7) -> list:
        """Predict waste generation for next N days"""
        predictions = []
        base_weight = random.uniform(100, 500)  # Base weight in kg
        
        for i in range(days_ahead):
            date = datetime.now() + timedelta(days=i)
            
            # Add patterns
            day_of_week = date.weekday()
            month = date.month
            
            # Weekend effect
            weekend_multiplier = 1.3 if day_of_week >= 5 else 1.0
            
            # Seasonal effect
            seasonal_multiplier = 1.2 if month in [12, 1, 6] else 1.0  # Summer/winter holidays
            
            # Random variation
            random_factor = random.uniform(0.8, 1.2)
            
            predicted = base_weight * weekend_multiplier * seasonal_multiplier * random_factor
            
            predictions.append({
                "date": date.strftime("%Y-%m-%d"),
                "predicted_weight": round(predicted, 2),
                "lower_bound": round(predicted * 0.8, 2),
                "upper_bound": round(predicted * 1.2, 2),
                "confidence": round(random.uniform(0.7, 0.95), 2)
            })
        
        return predictions
    
    async def detect_anomalies(self, household_data: list) -> list:
        """Detect anomalies in waste generation"""
        anomalies = []
        
        if len(household_data) < 7:
            return anomalies
        
        # Convert to DataFrame
        df = pd.DataFrame(household_data)
        df['weight'] = pd.to_numeric(df['weight'])
        
        # Calculate moving average and std
        df['rolling_mean'] = df['weight'].rolling(window=7).mean()
        df['rolling_std'] = df['weight'].rolling(window=7).std()
        
        # Detect anomalies (3 standard deviations)
        for idx, row in df.iterrows():
            if pd.notna(row['rolling_mean']) and pd.notna(row['rolling_std']):
                upper_bound = row['rolling_mean'] + 3 * row['rolling_std']
                
                if row['weight'] > upper_bound:
                    anomalies.append({
                        "date": row['date'],
                        "weight": float(row['weight']),
                        "expected": float(row['rolling_mean']),
                        "deviation": float(row['weight'] - row['rolling_mean']),
                        "severity": "high" if row['weight'] > 5 * row['rolling_mean'] else "medium"
                    })
        
        return anomalies