/**
 * AI Waste Classification Module
 * Uses pre-trained MobileNet model for waste classification
 * Provides real-time camera classification and fallback support
 */

// ============================================
// CONFIGURATION
// ============================================
let model = null;
let isModelLoaded = false;
let isLoading = false;
let videoStream = null;
let classificationInterval = null;
let currentUser = null;

// Classification categories
const WASTE_CATEGORIES = {
    ORGANIC: {
        name: 'ORGANIC',
        color: '#10B981',
        icon: '🍎',
        points: 10,
        suggestions: [
            'Compost it for garden fertilizer',
            'Use for biogas production',
            'Great for vermicomposting',
            'Reduces landfill methane emissions'
        ]
    },
    RECYCLABLE: {
        name: 'RECYCLABLE',
        color: '#3B82F6',
        icon: '♻️',
        points: 15,
        suggestions: [
            'Rinse before recycling',
            'Separate by material type',
            'Flatten to save space',
            'Remove caps and lids'
        ]
    },
    NON_RECYCLABLE: {
        name: 'NON_RECYCLABLE',
        color: '#F59E0B',
        icon: '🗑️',
        points: 0,
        suggestions: [
            'Try to reduce usage of these items',
            'Find reusable alternatives',
            'Proper landfill disposal required'
        ]
    },
    HAZARDOUS: {
        name: 'HAZARDOUS',
        color: '#EF4444',
        icon: '⚠️',
        points: 0,
        suggestions: [
            'Handle with protective gloves',
            'Dispose at special collection center',
            'Do NOT mix with regular waste',
            'Contact hazardous waste facility'
        ]
    }
};

// Keywords for mapping MobileNet predictions
const KEYWORDS = {
    ORGANIC: ['apple', 'banana', 'orange', 'fruit', 'vegetable', 'leaf', 'food', 'plant', 'flower'],
    RECYCLABLE: ['bottle', 'can', 'plastic', 'glass', 'paper', 'cardboard', 'container', 'packaging'],
    HAZARDOUS: ['battery', 'chemical', 'paint', 'medical', 'syringe', 'electronic', 'ewaste']
};

// ============================================
// MODEL LOADING
// ============================================

/**
 * Load the pre-trained MobileNet model
 * @returns {Promise<boolean>} Success status
 */
async function loadAIModel() {
    // Check if already loaded
    if (isModelLoaded && model) {
        console.log('✅ AI Model already loaded');
        updateAIStatus('ready');
        return true;
    }
    
    // Prevent multiple simultaneous loads
    if (isLoading) {
        console.log('⏳ Model already loading...');
        await waitForModelLoad();
        return isModelLoaded;
    }
    
    isLoading = true;
    updateAIStatus('loading');
    
    try {
        console.log('🔄 Loading MobileNet model...');
        
        // Check if mobilenet is available
        if (typeof mobilenet === 'undefined') {
            throw new Error('MobileNet library not loaded. Check if script is included.');
        }
        
        // Load the model
        model = await mobilenet.load({
            version: 2,
            alpha: 1.0
        });
        
        isModelLoaded = true;
        console.log('✅ AI Model loaded successfully!');
        updateAIStatus('ready');
        
        return true;
        
    } catch (error) {
        console.error('❌ Failed to load AI model:', error);
        updateAIStatus('error', error.message);
        isModelLoaded = false;
        model = null;
        return false;
        
    } finally {
        isLoading = false;
    }
}

/**
 * Wait for model to finish loading
 * @returns {Promise<void>}
 */
async function waitForModelLoad() {
    while (isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

/**
 * Update AI status display
 * @param {string} status - 'loading', 'ready', 'error'
 * @param {string} message - Optional error message
 */
function updateAIStatus(status, message = '') {
    const statusElement = document.getElementById('ai-status');
    if (!statusElement) return;
    
    switch(status) {
        case 'loading':
            statusElement.innerHTML = '<span class="status-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading AI...</span>';
            break;
        case 'ready':
            statusElement.innerHTML = '<span class="status-success"><i class="fas fa-check-circle"></i> AI Ready</span>';
            break;
        case 'error':
            statusElement.innerHTML = `<span class="status-error"><i class="fas fa-exclamation-triangle"></i> AI Error: ${message}</span>`;
            break;
        default:
            statusElement.innerHTML = '<span class="status-warning"><i class="fas fa-microchip"></i> AI Initializing</span>';
    }
}

// ============================================
// WASTE CLASSIFICATION
// ============================================

/**
 * Classify waste from an image element
 * @param {HTMLImageElement|HTMLVideoElement} imageElement - Image or video element
 * @returns {Promise<Object>} Classification result
 */
async function classifyWaste(imageElement) {
    // Ensure model is loaded
    if (!isModelLoaded) {
        const loaded = await loadAIModel();
        if (!loaded) {
            showClassificationError('AI model not available. Please refresh the page.');
            return getFallbackClassification();
        }
    }
    
    // Show loading state
    showClassificationLoading();
    
    try {
        // Validate input
        if (!imageElement) {
            throw new Error('No image element provided');
        }
        
        // Get predictions from MobileNet
        const predictions = await model.classify(imageElement);
        
        if (!predictions || predictions.length === 0) {
            throw new Error('No predictions received');
        }
        
        const topPrediction = predictions[0];
        
        // Map to waste category
        const wasteCategory = mapToWasteCategory(topPrediction.className);
        wasteCategory.confidence = topPrediction.probability * 100;
        wasteCategory.rawPrediction = topPrediction.className;
        
        // Display result
        displayClassificationResult(wasteCategory);
        
        // Play sound feedback
        playResultSound(wasteCategory.isCorrect);
        
        // Update points if correct segregation
        if (wasteCategory.isCorrect) {
            await updatePoints(wasteCategory);
        }
        
        return wasteCategory;
        
    } catch (error) {
        console.error('Classification failed:', error);
        showClassificationError(error.message);
        return getFallbackClassification();
    }
}

/**
 * Map MobileNet prediction to waste category
 * @param {string} label - MobileNet class label
 * @returns {Object} Waste category object
 */
function mapToWasteCategory(label) {
    const labelLower = label.toLowerCase();
    
    // Check for organic keywords
    for (const keyword of KEYWORDS.ORGANIC) {
        if (labelLower.includes(keyword)) {
            return {
                ...WASTE_CATEGORIES.ORGANIC,
                isCorrect: true,
                confidence: 85
            };
        }
    }
    
    // Check for recyclable keywords
    for (const keyword of KEYWORDS.RECYCLABLE) {
        if (labelLower.includes(keyword)) {
            return {
                ...WASTE_CATEGORIES.RECYCLABLE,
                isCorrect: true,
                confidence: 90
            };
        }
    }
    
    // Check for hazardous keywords
    for (const keyword of KEYWORDS.HAZARDOUS) {
        if (labelLower.includes(keyword)) {
            return {
                ...WASTE_CATEGORIES.HAZARDOUS,
                isCorrect: false,
                confidence: 80
            };
        }
    }
    
    // Default to non-recyclable
    return {
        ...WASTE_CATEGORIES.NON_RECYCLABLE,
        isCorrect: false,
        confidence: 60,
        note: 'Could not confidently classify'
    };
}

/**
 * Get fallback classification when AI fails
 * @returns {Object} Fallback classification result
 */
function getFallbackClassification() {
    return {
        ...WASTE_CATEGORIES.ORGANIC,
        isCorrect: true,
        confidence: 50,
        note: 'Using fallback classification',
        suggestions: ['Please manually select waste type', 'AI model temporarily unavailable']
    };
}

// ============================================
// DISPLAY FUNCTIONS
// ============================================

/**
 * Show loading state in result container
 */
function showClassificationLoading() {
    const resultDiv = document.getElementById('classification-result');
    if (resultDiv) {
        resultDiv.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p>🤖 Analyzing waste...</p>
            </div>
        `;
    }
}

/**
 * Show classification error
 * @param {string} message - Error message
 */
function showClassificationError(message) {
    const resultDiv = document.getElementById('classification-result');
    if (resultDiv) {
        resultDiv.innerHTML = `
            <div class="error-container">
                <i class="fas fa-exclamation-circle"></i>
                <p>❌ Failed to classify: ${message}</p>
                <button onclick="retryClassification()" class="btn-small">Try Again</button>
            </div>
        `;
    }
}

/**
 * Display classification result with animations
 * @param {Object} wasteCategory - Classification result
 */
function displayClassificationResult(wasteCategory) {
    const resultDiv = document.getElementById('classification-result');
    if (!resultDiv) return;
    
    const confidencePercent = Math.round(wasteCategory.confidence);
    const categoryClass = wasteCategory.category.toLowerCase();
    
    resultDiv.innerHTML = `
        <div class="result-card ${categoryClass}" style="animation: slideIn 0.5s ease">
            <div class="result-header">
                <div class="result-icon">${wasteCategory.icon}</div>
                <div class="result-title">
                    <h3>${wasteCategory.name}</h3>
                    <p class="confidence">${confidencePercent}% confidence</p>
                </div>
            </div>
            
            <div class="confidence-bar-container">
                <div class="confidence-bar">
                    <div class="confidence-fill" style="width: ${confidencePercent}%; background: ${wasteCategory.color}"></div>
                </div>
            </div>
            
            <div class="suggestions">
                <strong><i class="fas fa-lightbulb"></i> Tips:</strong>
                <ul>
                    ${wasteCategory.suggestions.map(s => `<li>${s}</li>`).join('')}
                </ul>
            </div>
            
            <div class="result-badge ${wasteCategory.isCorrect ? 'success' : 'warning'}">
                <i class="fas ${wasteCategory.isCorrect ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
                ${wasteCategory.isCorrect ? '✓ Proper Segregation' : '⚠️ Wrong Bin! Check suggestions'}
            </div>
            
            ${wasteCategory.note ? `<div class="note">📝 ${wasteCategory.note}</div>` : ''}
        </div>
    `;
}

// ============================================
// REAL-TIME CAMERA CLASSIFICATION
// ============================================

/**
 * Start real-time classification from camera feed
 */
async function startRealTimeClassification() {
    try {
        // Stop any existing classification
        stopRealTimeClassification();
        
        // Request camera access
        videoStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } // Use back camera on mobile
        });
        
        const video = document.getElementById('video-feed');
        if (!video) {
            throw new Error('Video element not found');
        }
        
        video.srcObject = videoStream;
        await video.play();
        
        // Start classification interval
        classificationInterval = setInterval(async () => {
            if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
                await classifyWaste(video);
            }
        }, 2000);
        
        console.log('📹 Real-time classification started');
        
    } catch (error) {
        console.error('Camera access failed:', error);
        showClassificationError('Camera access denied or not supported');
    }
}

/**
 * Stop real-time classification
 */
function stopRealTimeClassification() {
    if (classificationInterval) {
        clearInterval(classificationInterval);
        classificationInterval = null;
    }
    
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    
    const video = document.getElementById('video-feed');
    if (video) {
        video.srcObject = null;
    }
    
    console.log('📹 Real-time classification stopped');
}

// ============================================
// POINTS & REWARDS
// ============================================

/**
 * Update user points based on classification
 * @param {Object} wasteCategory - Classification result
 */
async function updatePoints(wasteCategory) {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await fetch('http://localhost:5000/api/points/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                points: wasteCategory.points,
                reason: `Proper segregation: ${wasteCategory.name}`,
                metadata: { category: wasteCategory.name, confidence: wasteCategory.confidence }
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log(`🎉 +${wasteCategory.points} points earned!`);
            
            // Show points animation
            showPointsAnimation(wasteCategory.points);
            
            // Update display
            const pointsElement = document.getElementById('user-points');
            if (pointsElement) {
                pointsElement.textContent = data.totalPoints;
            }
        }
    } catch (error) {
        console.error('Failed to update points:', error);
    }
}

/**
 * Show points earned animation
 * @param {number} points - Points earned
 */
function showPointsAnimation(points) {
    const animation = document.createElement('div');
    animation.className = 'points-animation';
    animation.innerHTML = `<i class="fas fa-star"></i> +${points} points!`;
    animation.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #22c55e, #16a34a);
        color: white;
        padding: 1rem 2rem;
        border-radius: 3rem;
        font-weight: bold;
        z-index: 1000;
        animation: floatUp 1s ease forwards;
        pointer-events: none;
    `;
    document.body.appendChild(animation);
    
    setTimeout(() => {
        animation.remove();
    }, 1000);
}

// ============================================
// SOUND FEEDBACK
// ============================================

/**
 * Play sound based on classification result
 * @param {boolean} isCorrect - Whether segregation is correct
 */
function playResultSound(isCorrect) {
    try {
        const audio = new Audio();
        if (isCorrect) {
            audio.src = '/assets/sounds/success.mp3';
        } else {
            audio.src = '/assets/sounds/warning.mp3';
        }
        audio.volume = 0.3;
        audio.play().catch(e => console.log('Audio play failed:', e));
    } catch (e) {
        // Silent fail - audio not critical
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Retry classification (called from error state)
 */
async function retryClassification() {
    await loadAIModel();
    const video = document.getElementById('video-feed');
    if (video && video.srcObject) {
        await classifyWaste(video);
    }
}

/**
 * Get current AI model status
 * @returns {Object} Model status
 */
function getAIStatus() {
    return {
        loaded: isModelLoaded,
        loading: isLoading,
        modelType: 'MobileNet V2',
        version: '1.0.0'
    };
}

// ============================================
// EXPORTS (for module usage)
// ============================================

// Make functions available globally
window.loadAIModel = loadAIModel;
window.classifyWaste = classifyWaste;
window.startRealTimeClassification = startRealTimeClassification;
window.stopRealTimeClassification = stopRealTimeClassification;
window.retryClassification = retryClassification;
window.getAIStatus = getAIStatus;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Load model in background
    loadAIModel();
    
    // Add CSS animations if not present
    if (!document.querySelector('#ai-animations')) {
        const style = document.createElement('style');
        style.id = 'ai-animations';
        style.textContent = `
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            @keyframes floatUp {
                0% {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1);
                }
                100% {
                    opacity: 0;
                    transform: translate(-50%, -150%) scale(1.2);
                }
            }
            
            .loading-spinner {
                width: 40px;
                height: 40px;
                border: 3px solid #e2e8f0;
                border-top-color: #22c55e;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                margin: 1rem auto;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            .result-card {
                background: white;
                border-radius: 1rem;
                padding: 1.5rem;
                margin: 1rem 0;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            
            .result-header {
                display: flex;
                align-items: center;
                gap: 1rem;
                margin-bottom: 1rem;
            }
            
            .result-icon {
                font-size: 2.5rem;
            }
            
            .result-title h3 {
                margin: 0;
                font-size: 1.1rem;
            }
            
            .result-title p {
                margin: 0;
                font-size: 0.75rem;
                color: #64748b;
            }
            
            .confidence-bar-container {
                margin: 1rem 0;
            }
            
            .confidence-bar {
                background: #e2e8f0;
                border-radius: 9999px;
                overflow: hidden;
                height: 8px;
            }
            
            .confidence-fill {
                height: 100%;
                transition: width 0.3s ease;
            }
            
            .suggestions {
                background: #f8fafc;
                padding: 0.75rem;
                border-radius: 0.5rem;
                margin: 1rem 0;
            }
            
            .suggestions ul {
                margin: 0.5rem 0 0 1rem;
                font-size: 0.875rem;
                color: #475569;
            }
            
            .result-badge {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.5rem 1rem;
                border-radius: 2rem;
                font-size: 0.875rem;
                font-weight: 500;
            }
            
            .result-badge.success {
                background: #dcfce7;
                color: #16a34a;
            }
            
            .result-badge.warning {
                background: #fef3c7;
                color: #d97706;
            }
            
            .status-success {
                color: #22c55e;
            }
            
            .status-error {
                color: #ef4444;
            }
            
            .status-loading {
                color: #f59e0b;
            }
            
            .status-warning {
                color: #f59e0b;
            }
        `;
        document.head.appendChild(style);
    }
});

// Log initialization
console.log('🤖 AI Module initialized. Using MobileNet pre-trained model.');