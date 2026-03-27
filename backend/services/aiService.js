/**
 * AI Service - Simplified Fallback Version
 * No TensorFlow dependency required
 */

class AIService {
    constructor() {
        console.log('AI Service initialized in fallback mode');
    }

    async classifyWaste(imageBuffer) {
        // Simple rule-based classification for demo
        return {
            success: true,
            category: 'ORGANIC',
            confidence: 85,
            suggestions: ['Compost it', 'Use for biogas', 'Great for garden'],
            timestamp: new Date().toISOString(),
            note: 'Using fallback classification (AI model not loaded)'
        };
    }

    getSuggestions(category) {
        const suggestions = {
            'ORGANIC': ['Start a compost bin at home', 'Use waste for gardening fertilizer', 'Perfect for biogas production'],
            'RECYCLABLE': ['Rinse before recycling', 'Separate paper, plastic, and glass', 'Flatten boxes to save space'],
            'NON_RECYCLABLE': ['Look for reusable alternatives', 'Check if item can be repaired', 'Reduce single-use items'],
            'HAZARDOUS': ['Handle with protective gloves', 'Take to special collection center', 'Never mix with regular waste']
        };
        return suggestions[category] || suggestions['NON_RECYCLABLE'];
    }
}

module.exports = AIService;
