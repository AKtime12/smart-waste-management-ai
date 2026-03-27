const { body, validationResult } = require('express-validator');

// Validation rules
const validateLogin = [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
];

const validateRegister = [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').notEmpty().withMessage('Name is required')
];

const validateBin = [
    body('qrCode').notEmpty().withMessage('QR code is required'),
    body('binType').isIn(['ORGANIC', 'RECYCLABLE', 'NON_RECYCLABLE', 'HAZARDOUS']),
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 })
];

const validateReport = [
    body('description').notEmpty().withMessage('Description is required'),
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 })
];

// Middleware to check validation results
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

module.exports = {
    validateLogin,
    validateRegister,
    validateBin,
    validateReport,
    handleValidationErrors
};