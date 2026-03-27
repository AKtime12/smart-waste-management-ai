module.exports = {
    USER_ROLES: {
        ADMIN: 'ADMIN',
        COLLECTOR: 'COLLECTOR',
        HOUSEHOLD: 'HOUSEHOLD',
        OPEN_USER: 'OPEN_USER'
    },
    
    BIN_TYPES: {
        ORGANIC: 'ORGANIC',
        RECYCLABLE: 'RECYCLABLE',
        NON_RECYCLABLE: 'NON_RECYCLABLE',
        HAZARDOUS: 'HAZARDOUS'
    },
    
    SEGREGATION_QUALITY: {
        EXCELLENT: 'EXCELLENT',
        GOOD: 'GOOD',
        POOR: 'POOR',
        FAILED: 'FAILED'
    },
    
    REPORT_STATUS: {
        PENDING: 'PENDING',
        IN_PROGRESS: 'IN_PROGRESS',
        RESOLVED: 'RESOLVED',
        REJECTED: 'REJECTED'
    },
    
    POINTS_CONFIG: {
        EXCELLENT_MULTIPLIER: 2,
        GOOD_MULTIPLIER: 1.5,
        POOR_MULTIPLIER: 0.5,
        BASE_POINTS: 10,
        WEIGHT_BONUS_PER_KG: 0.2
    },
    
    REWARD_TIERS: {
        GOLD: { minPoints: 1000, multiplier: 2.0 },
        SILVER: { minPoints: 500, multiplier: 1.5 },
        BRONZE: { minPoints: 200, multiplier: 1.2 },
        BASIC: { minPoints: 0, multiplier: 1.0 }
    },
    
    FESTIVALS: [
        { name: 'Diwali', date: '2024-10-31', multiplier: 2.5 },
        { name: 'Christmas', date: '2024-12-25', multiplier: 1.8 },
        { name: 'New Year', date: '2025-01-01', multiplier: 2.0 }
    ]
};