const crypto = require('crypto');

// Generate random ID
exports.generateId = (prefix = '') => {
    const random = crypto.randomBytes(8).toString('hex');
    return prefix ? `${prefix}_${random}` : random;
};

// Format date
exports.formatDate = (date, format = 'full') => {
    const d = new Date(date);
    if (format === 'date') {
        return d.toLocaleDateString();
    }
    if (format === 'time') {
        return d.toLocaleTimeString();
    }
    return d.toLocaleString();
};

// Calculate distance between two coordinates (Haversine formula)
exports.calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

// Format currency
exports.formatCurrency = (amount, currency = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency
    }).format(amount);
};

// Truncate text
exports.truncate = (text, length = 100) => {
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
};

// Generate QR code data
exports.generateQRData = (type, data) => {
    return JSON.stringify({
        type: type,
        data: data,
        timestamp: new Date().toISOString(),
        version: '1.0'
    });
};

// Validate email
exports.isValidEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

// Validate phone
exports.isValidPhone = (phone) => {
    const re = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,3}[)]?[-\s.]?[0-9]{3,4}[-\s.]?[0-9]{4}$/;
    return re.test(phone);
};

// Calculate carbon savings
exports.calculateCarbonSavings = (wasteWeight, wasteType) => {
    const factors = {
        ORGANIC: 0.5,
        RECYCLABLE: 0.8,
        NON_RECYCLABLE: 0.2,
        HAZARDOUS: 0.1
    };
    return wasteWeight * (factors[wasteType] || 0.3);
};

// Get time of day
exports.getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 20) return 'evening';
    return 'night';
};

// Generate greeting
exports.getGreeting = (name) => {
    const timeOfDay = exports.getTimeOfDay();
    const greetings = {
        morning: 'Good morning',
        afternoon: 'Good afternoon',
        evening: 'Good evening',
        night: 'Good night'
    };
    return `${greetings[timeOfDay]}, ${name}!`;
};