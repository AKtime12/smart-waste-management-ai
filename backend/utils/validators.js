/**
 * Validators - Input Validation Utilities
 * Provides comprehensive validation functions for all data types
 */

const validator = require('validator');

// =============================================
// User Validation
// =============================================

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {Object} Validation result
 */
function validateEmail(email) {
    if (!email) {
        return { valid: false, error: 'Email is required' };
    }
    
    if (!validator.isEmail(email)) {
        return { valid: false, error: 'Invalid email format' };
    }
    
    if (email.length > 255) {
        return { valid: false, error: 'Email too long (max 255 characters)' };
    }
    
    return { valid: true };
}

/**
 * Validate password
 * @param {string} password - Password to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
function validatePassword(password, options = {}) {
    const {
        minLength = 6,
        maxLength = 100,
        requireUppercase = false,
        requireLowercase = false,
        requireNumbers = false,
        requireSpecialChars = false
    } = options;
    
    if (!password) {
        return { valid: false, error: 'Password is required' };
    }
    
    if (password.length < minLength) {
        return { valid: false, error: `Password must be at least ${minLength} characters` };
    }
    
    if (password.length > maxLength) {
        return { valid: false, error: `Password must be less than ${maxLength} characters` };
    }
    
    if (requireUppercase && !/[A-Z]/.test(password)) {
        return { valid: false, error: 'Password must contain at least one uppercase letter' };
    }
    
    if (requireLowercase && !/[a-z]/.test(password)) {
        return { valid: false, error: 'Password must contain at least one lowercase letter' };
    }
    
    if (requireNumbers && !/[0-9]/.test(password)) {
        return { valid: false, error: 'Password must contain at least one number' };
    }
    
    if (requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        return { valid: false, error: 'Password must contain at least one special character' };
    }
    
    return { valid: true };
}

/**
 * Validate name
 * @param {string} name - Name to validate
 * @returns {Object} Validation result
 */
function validateName(name) {
    if (!name) {
        return { valid: false, error: 'Name is required' };
    }
    
    if (name.length < 2) {
        return { valid: false, error: 'Name must be at least 2 characters' };
    }
    
    if (name.length > 100) {
        return { valid: false, error: 'Name must be less than 100 characters' };
    }
    
    if (!/^[a-zA-Z\s\-']+$/.test(name)) {
        return { valid: false, error: 'Name can only contain letters, spaces, hyphens, and apostrophes' };
    }
    
    return { valid: true };
}

/**
 * Validate phone number
 * @param {string} phone - Phone number to validate
 * @returns {Object} Validation result
 */
function validatePhone(phone) {
    if (!phone) {
        return { valid: true }; // Phone is optional
    }
    
    const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{3,4}[-\s\.]?[0-9]{4}$/;
    
    if (!phoneRegex.test(phone)) {
        return { valid: false, error: 'Invalid phone number format' };
    }
    
    return { valid: true };
}

/**
 * Validate address
 * @param {string} address - Address to validate
 * @returns {Object} Validation result
 */
function validateAddress(address) {
    if (!address) {
        return { valid: true }; // Address is optional
    }
    
    if (address.length < 5) {
        return { valid: false, error: 'Address must be at least 5 characters' };
    }
    
    if (address.length > 500) {
        return { valid: false, error: 'Address must be less than 500 characters' };
    }
    
    return { valid: true };
}

/**
 * Validate user role
 * @param {string} role - Role to validate
 * @returns {Object} Validation result
 */
function validateRole(role) {
    const validRoles = ['ADMIN', 'COLLECTOR', 'HOUSEHOLD', 'OPEN_USER'];
    
    if (!role) {
        return { valid: false, error: 'Role is required' };
    }
    
    if (!validRoles.includes(role)) {
        return { valid: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` };
    }
    
    return { valid: true };
}

// =============================================
// Location Validation
// =============================================

/**
 * Validate latitude
 * @param {number} lat - Latitude to validate
 * @returns {Object} Validation result
 */
function validateLatitude(lat) {
    if (lat === undefined || lat === null) {
        return { valid: false, error: 'Latitude is required' };
    }
    
    if (typeof lat !== 'number') {
        return { valid: false, error: 'Latitude must be a number' };
    }
    
    if (lat < -90 || lat > 90) {
        return { valid: false, error: 'Latitude must be between -90 and 90' };
    }
    
    return { valid: true };
}

/**
 * Validate longitude
 * @param {number} lng - Longitude to validate
 * @returns {Object} Validation result
 */
function validateLongitude(lng) {
    if (lng === undefined || lng === null) {
        return { valid: false, error: 'Longitude is required' };
    }
    
    if (typeof lng !== 'number') {
        return { valid: false, error: 'Longitude must be a number' };
    }
    
    if (lng < -180 || lng > 180) {
        return { valid: false, error: 'Longitude must be between -180 and 180' };
    }
    
    return { valid: true };
}

/**
 * Validate coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Object} Validation result
 */
function validateCoordinates(lat, lng) {
    const latValidation = validateLatitude(lat);
    if (!latValidation.valid) return latValidation;
    
    const lngValidation = validateLongitude(lng);
    if (!lngValidation.valid) return lngValidation;
    
    return { valid: true };
}

// =============================================
// Bin Validation
// =============================================

/**
 * Validate bin type
 * @param {string} binType - Bin type to validate
 * @returns {Object} Validation result
 */
function validateBinType(binType) {
    const validTypes = ['ORGANIC', 'RECYCLABLE', 'NON_RECYCLABLE', 'HAZARDOUS'];
    
    if (!binType) {
        return { valid: false, error: 'Bin type is required' };
    }
    
    if (!validTypes.includes(binType)) {
        return { valid: false, error: `Invalid bin type. Must be one of: ${validTypes.join(', ')}` };
    }
    
    return { valid: true };
}

/**
 * Validate fill level
 * @param {number} fillLevel - Fill level to validate
 * @returns {Object} Validation result
 */
function validateFillLevel(fillLevel) {
    if (fillLevel === undefined || fillLevel === null) {
        return { valid: false, error: 'Fill level is required' };
    }
    
    if (typeof fillLevel !== 'number') {
        return { valid: false, error: 'Fill level must be a number' };
    }
    
    if (fillLevel < 0 || fillLevel > 100) {
        return { valid: false, error: 'Fill level must be between 0 and 100' };
    }
    
    return { valid: true };
}

/**
 * Validate bin capacity
 * @param {number} capacity - Capacity to validate
 * @returns {Object} Validation result
 */
function validateBinCapacity(capacity) {
    if (capacity === undefined || capacity === null) {
        return { valid: true }; // Optional, defaults to 100
    }
    
    if (typeof capacity !== 'number') {
        return { valid: false, error: 'Capacity must be a number' };
    }
    
    if (capacity < 10 || capacity > 1000) {
        return { valid: false, error: 'Capacity must be between 10 and 1000' };
    }
    
    return { valid: true };
}

/**
 * Validate QR code
 * @param {string} qrCode - QR code to validate
 * @returns {Object} Validation result
 */
// Validate QR code (allows JSON format)
function validateQRCode(qrCode) {
    if (!qrCode) {
        return { valid: false, error: 'QR code is required' };
    }
    
    // Allow JSON format (household QR codes)
    try {
        JSON.parse(qrCode);
        return { valid: true }; // Valid JSON, accept it
    } catch(e) {
        // Not JSON, validate as simple string
        if (qrCode.length < 5 || qrCode.length > 500) {
            return { valid: false, error: 'QR code must be between 5 and 500 characters' };
        }
        
        const validPattern = /^[A-Za-z0-9\-_]+$/;
        if (!validPattern.test(qrCode)) {
            return { valid: false, error: 'QR code can only contain letters, numbers, hyphens, and underscores' };
        }
        
        return { valid: true };
    }
}
/**
 * Validate ward name
 * @param {string} ward - Ward name to validate
 * @returns {Object} Validation result
 */
function validateWard(ward) {
    if (!ward) {
        return { valid: false, error: 'Ward name is required' };
    }
    
    if (ward.length < 2 || ward.length > 100) {
        return { valid: false, error: 'Ward name must be between 2 and 100 characters' };
    }
    
    return { valid: true };
}

/**
 * Validate locality
 * @param {string} locality - Locality to validate
 * @returns {Object} Validation result
 */
function validateLocality(locality) {
    if (!locality) {
        return { valid: false, error: 'Locality is required' };
    }
    
    if (locality.length < 2 || locality.length > 200) {
        return { valid: false, error: 'Locality must be between 2 and 200 characters' };
    }
    
    return { valid: true };
}

// =============================================
// Collection Validation
// =============================================

/**
 * Validate waste weight
 * @param {number} weight - Waste weight in kg
 * @returns {Object} Validation result
 */
function validateWasteWeight(weight) {
    if (weight === undefined || weight === null) {
        return { valid: true }; // Optional
    }
    
    if (typeof weight !== 'number') {
        return { valid: false, error: 'Waste weight must be a number' };
    }
    
    if (weight < 0 || weight > 1000) {
        return { valid: false, error: 'Waste weight must be between 0 and 1000 kg' };
    }
    
    return { valid: true };
}

/**
 * Validate segregation quality
 * @param {string} quality - Segregation quality
 * @returns {Object} Validation result
 */
function validateSegregationQuality(quality) {
    const validQualities = ['EXCELLENT', 'GOOD', 'POOR', 'FAILED'];
    
    if (!quality) {
        return { valid: false, error: 'Segregation quality is required' };
    }
    
    if (!validQualities.includes(quality)) {
        return { valid: false, error: `Invalid quality. Must be one of: ${validQualities.join(', ')}` };
    }
    
    return { valid: true };
}

/**
 * Validate points
 * @param {number} points - Points to validate
 * @returns {Object} Validation result
 */
function validatePoints(points) {
    if (points === undefined || points === null) {
        return { valid: true }; // Optional
    }
    
    if (typeof points !== 'number') {
        return { valid: false, error: 'Points must be a number' };
    }
    
    if (points < 0 || points > 10000) {
        return { valid: false, error: 'Points must be between 0 and 10000' };
    }
    
    return { valid: true };
}

// =============================================
// Report Validation
// =============================================

/**
 * Validate report description
 * @param {string} description - Report description
 * @returns {Object} Validation result
 */
function validateReportDescription(description) {
    if (!description) {
        return { valid: false, error: 'Description is required' };
    }
    
    if (description.length < 5) {
        return { valid: false, error: 'Description must be at least 5 characters' };
    }
    
    if (description.length > 1000) {
        return { valid: false, error: 'Description must be less than 1000 characters' };
    }
    
    return { valid: true };
}

/**
 * Validate report status
 * @param {string} status - Report status
 * @returns {Object} Validation result
 */
function validateReportStatus(status) {
    const validStatuses = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];
    
    if (!status) {
        return { valid: false, error: 'Status is required' };
    }
    
    if (!validStatuses.includes(status)) {
        return { valid: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` };
    }
    
    return { valid: true };
}

/**
 * Validate report type
 * @param {string} type - Report type
 * @returns {Object} Validation result
 */
function validateReportType(type) {
    const validTypes = ['WASTE', 'BIN_DAMAGE', 'ILLEGAL_DUMPING', 'MISSED_COLLECTION', 'OTHER'];
    
    if (!type) {
        return { valid: true }; // Optional
    }
    
    if (!validTypes.includes(type)) {
        return { valid: false, error: `Invalid report type. Must be one of: ${validTypes.join(', ')}` };
    }
    
    return { valid: true };
}

// =============================================
// Reward Validation
// =============================================

/**
 * Validate reward name
 * @param {string} name - Reward name
 * @returns {Object} Validation result
 */
function validateRewardName(name) {
    if (!name) {
        return { valid: false, error: 'Reward name is required' };
    }
    
    if (name.length < 3 || name.length > 100) {
        return { valid: false, error: 'Reward name must be between 3 and 100 characters' };
    }
    
    return { valid: true };
}

/**
 * Validate reward description
 * @param {string} description - Reward description
 * @returns {Object} Validation result
 */
function validateRewardDescription(description) {
    if (!description) {
        return { valid: true }; // Optional
    }
    
    if (description.length > 500) {
        return { valid: false, error: 'Description must be less than 500 characters' };
    }
    
    return { valid: true };
}

/**
 * Validate reward category
 * @param {string} category - Reward category
 * @returns {Object} Validation result
 */
function validateRewardCategory(category) {
    const validCategories = ['vouchers', 'products', 'experiences'];
    
    if (!category) {
        return { valid: false, error: 'Category is required' };
    }
    
    if (!validCategories.includes(category)) {
        return { valid: false, error: `Invalid category. Must be one of: ${validCategories.join(', ')}` };
    }
    
    return { valid: true };
}

/**
 * Validate reward points
 * @param {number} points - Points required
 * @returns {Object} Validation result
 */
function validateRewardPoints(points) {
    if (points === undefined || points === null) {
        return { valid: false, error: 'Points are required' };
    }
    
    if (typeof points !== 'number') {
        return { valid: false, error: 'Points must be a number' };
    }
    
    if (points < 10 || points > 10000) {
        return { valid: false, error: 'Points must be between 10 and 10000' };
    }
    
    return { valid: true };
}

/**
 * Validate stock quantity
 * @param {number} stock - Stock quantity
 * @returns {Object} Validation result
 */
function validateStock(stock) {
    if (stock === undefined || stock === null) {
        return { valid: true }; // Optional, defaults to 100
    }
    
    if (typeof stock !== 'number') {
        return { valid: false, error: 'Stock must be a number' };
    }
    
    if (stock < 0 || stock > 10000) {
        return { valid: false, error: 'Stock must be between 0 and 10000' };
    }
    
    return { valid: true };
}

// =============================================
// ID Validation
// =============================================

/**
 * Validate MongoDB/ObjectId style ID
 * @param {string} id - ID to validate
 * @param {string} field - Field name for error message
 * @returns {Object} Validation result
 */
function validateId(id, field = 'ID') {
    if (!id) {
        return { valid: false, error: `${field} is required` };
    }
    
    if (typeof id !== 'string') {
        return { valid: false, error: `${field} must be a string` };
    }
    
    // UUID v4 pattern
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    // CUID pattern
    const cuidPattern = /^c[0-9a-z]{24}$/;
    
    if (!uuidPattern.test(id) && !cuidPattern.test(id) && id.length < 10) {
        return { valid: false, error: `Invalid ${field} format` };
    }
    
    return { valid: true };
}

// =============================================
// Date Validation
// =============================================

/**
 * Validate date
 * @param {string|Date} date - Date to validate
 * @returns {Object} Validation result
 */
function validateDate(date) {
    if (!date) {
        return { valid: false, error: 'Date is required' };
    }
    
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
        return { valid: false, error: 'Invalid date format' };
    }
    
    return { valid: true, value: parsedDate };
}

/**
 * Validate date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Object} Validation result
 */
function validateDateRange(startDate, endDate) {
    const startValidation = validateDate(startDate);
    if (!startValidation.valid) return startValidation;
    
    const endValidation = validateDate(endDate);
    if (!endValidation.valid) return endValidation;
    
    if (new Date(startDate) > new Date(endDate)) {
        return { valid: false, error: 'Start date must be before end date' };
    }
    
    return { valid: true };
}

// =============================================
// Pagination Validation
// =============================================

/**
 * Validate page number
 * @param {number} page - Page number
 * @returns {Object} Validation result
 */
function validatePage(page) {
    let pageNum = parseInt(page);
    if (isNaN(pageNum) || pageNum < 1) {
        pageNum = 1;
    }
    
    return { valid: true, value: pageNum };
}

/**
 * Validate limit
 * @param {number} limit - Items per page
 * @param {number} maxLimit - Maximum allowed limit
 * @returns {Object} Validation result
 */
function validateLimit(limit, maxLimit = 100) {
    let limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1) {
        limitNum = 20;
    }
    if (limitNum > maxLimit) {
        limitNum = maxLimit;
    }
    
    return { valid: true, value: limitNum };
}

// =============================================
// Query Parameters Validation
// =============================================

/**
 * Validate sort field
 * @param {string} sort - Sort field
 * @param {Array} allowedFields - Allowed sort fields
 * @returns {Object} Validation result
 */
function validateSortField(sort, allowedFields = ['createdAt', 'points', 'name']) {
    if (!sort) {
        return { valid: true, value: '-createdAt' };
    }
    
    let direction = 'asc';
    let field = sort;
    
    if (sort.startsWith('-')) {
        direction = 'desc';
        field = sort.substring(1);
    }
    
    if (!allowedFields.includes(field)) {
        return { valid: false, error: `Invalid sort field. Allowed: ${allowedFields.join(', ')}` };
    }
    
    return { valid: true, value: { field, direction } };
}

/**
 * Validate search query
 * @param {string} query - Search query
 * @returns {Object} Validation result
 */
function validateSearchQuery(query) {
    if (!query) {
        return { valid: true };
    }
    
    if (query.length < 2) {
        return { valid: false, error: 'Search query must be at least 2 characters' };
    }
    
    if (query.length > 100) {
        return { valid: false, error: 'Search query too long (max 100 characters)' };
    }
    
    // Sanitize query to prevent injection
    const sanitized = query.replace(/[^\w\s\-]/g, '');
    
    return { valid: true, value: sanitized };
}

// =============================================
// Complete Validation Objects
// =============================================

/**
 * Validate complete user registration data
 * @param {Object} data - User registration data
 * @returns {Object} Validation result
 */
function validateUserRegistration(data) {
    const { email, password, name, phone, address, role, latitude, longitude } = data;
    
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) return emailValidation;
    
    const passwordValidation = validatePassword(password, { minLength: 6 });
    if (!passwordValidation.valid) return passwordValidation;
    
    const nameValidation = validateName(name);
    if (!nameValidation.valid) return nameValidation;
    
    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid) return phoneValidation;
    
    const addressValidation = validateAddress(address);
    if (!addressValidation.valid) return addressValidation;
    
    const roleValidation = validateRole(role);
    if (!roleValidation.valid) return roleValidation;
    
    if (latitude && longitude) {
        const coordinatesValidation = validateCoordinates(latitude, longitude);
        if (!coordinatesValidation.valid) return coordinatesValidation;
    }
    
    return { valid: true };
}

/**
 * Validate complete bin data
 * @param {Object} data - Bin data
 * @returns {Object} Validation result
 */
function validateBin(data) {
    const { qrCode, binType, latitude, longitude, ward, locality, capacity } = data;
    
    const qrValidation = validateQRCode(qrCode);
    if (!qrValidation.valid) return qrValidation;
    
    const binTypeValidation = validateBinType(binType);
    if (!binTypeValidation.valid) return binTypeValidation;
    
    const coordinatesValidation = validateCoordinates(latitude, longitude);
    if (!coordinatesValidation.valid) return coordinatesValidation;
    
    const wardValidation = validateWard(ward);
    if (!wardValidation.valid) return wardValidation;
    
    const localityValidation = validateLocality(locality);
    if (!localityValidation.valid) return localityValidation;
    
    const capacityValidation = validateBinCapacity(capacity);
    if (!capacityValidation.valid) return capacityValidation;
    
    return { valid: true };
}

/**
 * Validate complete collection data
 * @param {Object} data - Collection data
 * @returns {Object} Validation result
 */
function validateCollection(data) {
    const { binId, householdId, wasteWeight, segregationQuality, pointsAwarded } = data;
    
    const binIdValidation = validateId(binId, 'Bin ID');
    if (!binIdValidation.valid) return binIdValidation;
    
    if (householdId) {
        const householdValidation = validateId(householdId, 'Household ID');
        if (!householdValidation.valid) return householdValidation;
    }
    
    const weightValidation = validateWasteWeight(wasteWeight);
    if (!weightValidation.valid) return weightValidation;
    
    const qualityValidation = validateSegregationQuality(segregationQuality);
    if (!qualityValidation.valid) return qualityValidation;
    
    const pointsValidation = validatePoints(pointsAwarded);
    if (!pointsValidation.valid) return pointsValidation;
    
    return { valid: true };
}

/**
 * Validate complete report data
 * @param {Object} data - Report data
 * @returns {Object} Validation result
 */
function validateReport(data) {
    const { description, latitude, longitude, type } = data;
    
    const descriptionValidation = validateReportDescription(description);
    if (!descriptionValidation.valid) return descriptionValidation;
    
    const coordinatesValidation = validateCoordinates(latitude, longitude);
    if (!coordinatesValidation.valid) return coordinatesValidation;
    
    const typeValidation = validateReportType(type);
    if (!typeValidation.valid) return typeValidation;
    
    return { valid: true };
}

/**
 * Validate complete reward data
 * @param {Object} data - Reward data
 * @returns {Object} Validation result
 */
function validateReward(data) {
    const { name, description, points, category, stock } = data;
    
    const nameValidation = validateRewardName(name);
    if (!nameValidation.valid) return nameValidation;
    
    const descriptionValidation = validateRewardDescription(description);
    if (!descriptionValidation.valid) return descriptionValidation;
    
    const pointsValidation = validateRewardPoints(points);
    if (!pointsValidation.valid) return pointsValidation;
    
    const categoryValidation = validateRewardCategory(category);
    if (!categoryValidation.valid) return categoryValidation;
    
    const stockValidation = validateStock(stock);
    if (!stockValidation.valid) return stockValidation;
    
    return { valid: true };
}

// =============================================
// Sanitization Functions
// =============================================

/**
 * Sanitize user input
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
    if (!input) return '';
    return input.trim().replace(/[<>]/g, '');
}

/**
 * Sanitize HTML content
 * @param {string} html - HTML to sanitize
 * @returns {string} Sanitized HTML
 */
function sanitizeHTML(html) {
    if (!html) return '';
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
               .replace(/on\w+="[^"]*"/g, '');
}

/**
 * Escape special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeString(str) {
    if (!str) return '';
    return str.replace(/[\\'"\n\r\t]/g, function(match) {
        const escapes = {
            '\\': '\\\\',
            "'": "\\'",
            '"': '\\"',
            '\n': '\\n',
            '\r': '\\r',
            '\t': '\\t'
        };
        return escapes[match];
    });
}

// =============================================
// Export all validators
// =============================================

module.exports = {
    // User validators
    validateEmail,
    validatePassword,
    validateName,
    validatePhone,
    validateAddress,
    validateRole,
    validateUserRegistration,
    
    // Location validators
    validateLatitude,
    validateLongitude,
    validateCoordinates,
    
    // Bin validators
    validateBinType,
    validateFillLevel,
    validateBinCapacity,
    validateQRCode,
    validateWard,
    validateLocality,
    validateBin,
    
    // Collection validators
    validateWasteWeight,
    validateSegregationQuality,
    validatePoints,
    validateCollection,
    
    // Report validators
    validateReportDescription,
    validateReportStatus,
    validateReportType,
    validateReport,
    
    // Reward validators
    validateRewardName,
    validateRewardDescription,
    validateRewardCategory,
    validateRewardPoints,
    validateStock,
    validateReward,
    
    // ID validators
    validateId,
    
    // Date validators
    validateDate,
    validateDateRange,
    
    // Pagination validators
    validatePage,
    validateLimit,
    validateSortField,
    validateSearchQuery,
    
    // Sanitization
    sanitizeInput,
    sanitizeHTML,
    escapeString
};