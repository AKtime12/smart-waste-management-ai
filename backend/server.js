/**
 * Smart Waste Management System - Main Server
 * Express.js Backend with WebSocket, Database, and AI Integration
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

// Import WebSocket Manager
const WebSocketManager = require('./routes/websocket');

// Import Services
const AnalyticsService = require('./services/analyticsService');
const NotificationService = require('./services/notificationService');
const QRService = require('./services/qrService');
const BlockchainService = require('./services/blockchainService');
const SMSService = require('./services/smsService');
const AIService = require('./services/aiService');
const RouteOptimizer = require('./services/routeOptimizer');
const PredictionService = require('./services/predictionService');
const SensorService = require('./services/sensorService');
const RewardsService = require('./services/rewardsService');

// Import Routes
const authRoutes = require('./routes/auth');
const wasteRoutes = require('./routes/waste');
const collectorRoutes = require('./routes/collector');
const adminRoutes = require('./routes/admin');
const reportRoutes = require('./routes/report');
const rewardsRoutes = require('./routes/rewards');
const trackingRoutes = require('./routes/tracking');
const notificationsRoutes = require('./routes/notifications');
const factoryRoutes = require('./routes/factory');

// Import Database
const { prisma } = require('./database/db');

// Import Middleware
const { limiter, authLimiter } = require('./middleware/rateLimiter');

// Initialize Express App
const app = express();
const server = http.createServer(app);

// =============================================
// WebSocket Initialization
// =============================================
const wsManager = new WebSocketManager(server);

// =============================================
// Service Initialization
// =============================================
const analyticsService = new AnalyticsService();
const notificationService = new NotificationService(wsManager);
const qrService = new QRService();
const blockchainService = new BlockchainService();
const smsService = new SMSService({
    provider: process.env.SMS_PROVIDER || 'twilio',
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_PHONE_NUMBER
});
const aiService = new AIService();
const routeOptimizer = new RouteOptimizer(process.env.GOOGLE_MAPS_API_KEY);
const predictionService = new PredictionService();
const sensorService = new SensorService();
const rewardsService = new RewardsService();

// =============================================
// Middleware Configuration
// =============================================

// CORS Configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parser Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static Files
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate Limiting
app.use('/api/auth', authLimiter);
app.use('/api', limiter);

// Request Logging (Development only)
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.url}`);
        next();
    });
}

// =============================================
// Make Services Available to Routes
// =============================================
app.set('wsManager', wsManager);
app.set('analyticsService', analyticsService);
app.set('notificationService', notificationService);
app.set('qrService', qrService);
app.set('blockchainService', blockchainService);
app.set('smsService', smsService);
app.set('aiService', aiService);
app.set('routeOptimizer', routeOptimizer);
app.set('predictionService', predictionService);
app.set('sensorService', sensorService);
app.set('rewardsService', rewardsService);
app.set('prisma', prisma);

// =============================================
// API Routes
// =============================================

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
            websocket: wsManager ? 'active' : 'inactive',
            database: prisma ? 'connected' : 'disconnected',
            ai: aiService.model ? 'ready' : 'loading',
            blockchain: 'active',
            predictions: 'active'
        },
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
    });
});

// API Info
app.get('/api', (req, res) => {
    res.json({
        name: 'Smart Waste Management System API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            waste: '/api/waste',
            collector: '/api/collector',
            admin: '/api/admin',
            report: '/api/report',
            rewards: '/api/rewards',
            tracking: '/api/tracking',
            notifications: '/api/notifications'
        },
        documentation: '/api/docs'
    });
});

// API Documentation (Swagger-like)
app.get('/api/docs', (req, res) => {
    res.json({
        openapi: '3.0.0',
        info: {
            title: 'Smart Waste Management API',
            version: '1.0.0',
            description: 'AI-Powered Waste Management System API'
        },
        servers: [
            {
                url: `http://localhost:${process.env.PORT || 5000}`,
                description: 'Development server'
            }
        ],
        paths: {
            '/api/auth/login': { post: { summary: 'User login' } },
            '/api/auth/register': { post: { summary: 'User registration' } },
            '/api/waste/classify': { post: { summary: 'AI waste classification' } },
            '/api/collector/scan': { post: { summary: 'Scan QR code' } },
            '/api/collector/route': { get: { summary: 'Get optimized route' } },
            '/api/admin/dashboard': { get: { summary: 'Admin dashboard stats' } },
            '/api/report/submit': { post: { summary: 'Submit waste report' } },
            '/api/rewards/redeem': { post: { summary: 'Redeem reward' } }
        }
    });
});

// Register Routes
app.use('/api/auth', authRoutes);
app.use('/api/waste', wasteRoutes);
app.use('/api/collector', collectorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/rewards', rewardsRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/factory', factoryRoutes);

// =============================================
// Frontend Routes (SPA Support)
// =============================================

// Serve HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/register.html'));
});

app.get('/dashboard/:role', (req, res) => {
    const { role } = req.params;
    const validRoles = ['admin', 'collector', 'household'];
    if (validRoles.includes(role)) {
        res.sendFile(path.join(__dirname, `../frontend/dashboard/${role}.html`));
    } else {
        res.status(404).sendFile(path.join(__dirname, '../frontend/404.html'));
    }
});

app.get('/pages/:page', (req, res) => {
    const { page } = req.params;
    const validPages = ['scanner', 'report', 'tracking', 'rewards', 'leaderboard'];
    if (validPages.includes(page)) {
        res.sendFile(path.join(__dirname, `../frontend/pages/${page}.html`));
    } else {
        res.status(404).sendFile(path.join(__dirname, '../frontend/404.html'));
    }
});

// 404 Handler for unmatched routes
app.use((req, res) => {
    if (req.accepts('html')) {
        res.status(404).sendFile(path.join(__dirname, '../frontend/404.html'));
    } else {
        res.status(404).json({ error: 'Not Found' });
    }
});

// =============================================
// Error Handling Middleware
// =============================================

// 404 Error Handler
app.use((req, res, next) => {
    const error = new Error('Not Found');
    error.status = 404;
    next(error);
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';
    
    // Don't expose stack traces in production
    const response = {
        error: message,
        status: status,
        timestamp: new Date().toISOString()
    };
    
    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }
    
    res.status(status).json(response);
});

// =============================================
// Create Uploads Directory if Not Exists
// =============================================
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('📁 Created uploads directory');
}

// =============================================
// Database Connection Check
// =============================================
async function checkDatabaseConnection() {
    try {
        await prisma.$queryRaw`SELECT 1`;
        console.log('✅ Database connected successfully');
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        process.exit(1);
    }
}

// =============================================
// Initialize Sensor Service
// =============================================
async function initializeSensorService() {
    try {
        const bins = await prisma.qRBin.findMany();
        if (bins.length > 0) {
            await sensorService.initializeSensors(bins);
            console.log(`✅ Sensor service initialized with ${bins.length} bins`);
        }
    } catch (error) {
        console.error('❌ Sensor service initialization failed:', error.message);
    }
}

// =============================================
// Graceful Shutdown
// =============================================
async function gracefulShutdown() {
    console.log('\n🛑 Shutting down gracefully...');
    
    // Close WebSocket connections
    if (wsManager && wsManager.io) {
        wsManager.io.close(() => {
            console.log('WebSocket server closed');
        });
    }
    
    // Close database connection
    await prisma.$disconnect();
    console.log('Database connection closed');
    
    // Exit process
    process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// =============================================
// Start Server
// =============================================
const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        // Check database connection
        await checkDatabaseConnection();
        
        // Initialize sensor service
        await initializeSensorService();
        
        // Start server
        server.listen(PORT, () => {
            console.log(`
╔══════════════════════════════════════════════════════════════╗
║     🚀 Smart Waste Management System Server Started!        ║
╠══════════════════════════════════════════════════════════════╣
║  📡 Server:      http://localhost:${PORT}                    ║
║  🔌 WebSocket:   ws://localhost:${PORT}                      ║
║  🌐 Frontend:    http://localhost:3000                       ║
║  📊 API Docs:    http://localhost:${PORT}/api/docs           ║
║  ❤️  Health:      http://localhost:${PORT}/health            ║
╠══════════════════════════════════════════════════════════════╣
║  🤖 AI Service:     ${aiService.model ? '✅ Ready' : '⏳ Loading...'}              ║
║  🗄️  Database:      ✅ Connected                              ║
║  🔌 WebSocket:      ✅ Active                                 ║
║  📱 SMS Service:    ${smsService.isEnabled ? '✅ Enabled' : '⚠️ Disabled (Simulation)'}  ║
║  🔗 Blockchain:     ✅ Active                                 ║
║  🗺️  Maps API:      ${process.env.GOOGLE_MAPS_API_KEY ? '✅ Configured' : '⚠️ Not Configured'}        ║
╚══════════════════════════════════════════════════════════════╝
            `);
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();

// =============================================
// Export for Testing
// =============================================
module.exports = { app, server, wsManager };