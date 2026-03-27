/**
 * SMS Service for Alert Notifications
 * Integrates with Twilio or other SMS providers
 */

const axios = require('axios');

class SMSService {
    constructor(config = {}) {
        this.provider = config.provider || 'twilio';
        this.accountSid = config.accountSid || process.env.TWILIO_ACCOUNT_SID;
        this.authToken = config.authToken || process.env.TWILIO_AUTH_TOKEN;
        this.fromNumber = config.fromNumber || process.env.TWILIO_PHONE_NUMBER;
        this.apiKey = config.apiKey || process.env.SMS_API_KEY;
        this.isEnabled = !!(this.accountSid || this.apiKey);
        
        // Rate limiting
        this.sentCounts = new Map(); // phone -> { count, resetTime }
        this.maxPerDay = 10;
        this.maxPerHour = 3;
        
        // Templates
        this.templates = this.initializeTemplates();
    }
    
    initializeTemplates() {
        return {
            bin_full: {
                template: "⚠️ URGENT: Bin at {location} is {fillLevel}% full. Needs immediate collection!",
                priority: "high"
            },
            collection_reminder: {
                template: "♻️ Reminder: Your waste collection is scheduled for tomorrow at {time}. Please separate your waste properly!",
                priority: "normal"
            },
            points_earned: {
                template: "🎉 Great job! You earned {points} points for proper waste segregation! Total points: {total}",
                priority: "normal"
            },
            reward_available: {
                template: "🏆 New reward available: {rewardName} for {points} points. Redeem now!",
                priority: "normal"
            },
            reward_redeemed: {
                template: "🎁 Congratulations! You've redeemed {rewardName}. Your redemption code: {code}",
                priority: "high"
            },
            report_confirmation: {
                template: "📋 Report #{reportId} submitted successfully. Authorities have been notified.",
                priority: "normal"
            },
            report_resolved: {
                template: "✅ Your report at {location} has been resolved. Thank you for helping keep our city clean!",
                priority: "high"
            },
            collection_completed: {
                template: "✅ Waste collection completed! +{points} points earned. Keep up the good work!",
                priority: "normal"
            },
            tier_upgrade: {
                template: "🏆 Congratulations! You've reached {tier} Tier! Enjoy your new benefits!",
                priority: "high"
            },
            emergency_alert: {
                template: "🚨 EMERGENCY: {message}. Please take immediate action.",
                priority: "urgent"
            },
            festival_prediction: {
                template: "🤖 AI Prediction: {festival} expected to increase waste by {increase}% in your area. Extra trucks deployed.",
                priority: "normal"
            }
        };
    }
    
    // =============================================
    // Rate Limiting
    // =============================================
    
    canSendSMS(phoneNumber) {
        const now = new Date();
        const phoneData = this.sentCounts.get(phoneNumber);
        
        if (!phoneData) {
            return true;
        }
        
        // Check daily limit
        const dayReset = new Date(phoneData.dayReset);
        if (now > dayReset) {
            return true;
        }
        
        if (phoneData.dayCount >= this.maxPerDay) {
            return false;
        }
        
        // Check hourly limit
        if (phoneData.hourCount >= this.maxPerHour) {
            return false;
        }
        
        return true;
    }
    
    updateRateLimit(phoneNumber) {
        const now = new Date();
        const phoneData = this.sentCounts.get(phoneNumber);
        
        if (!phoneData) {
            this.sentCounts.set(phoneNumber, {
                dayCount: 1,
                hourCount: 1,
                dayReset: new Date(now.setDate(now.getDate() + 1)),
                hourReset: new Date(now.setHours(now.getHours() + 1))
            });
            return;
        }
        
        phoneData.dayCount++;
        phoneData.hourCount++;
        this.sentCounts.set(phoneNumber, phoneData);
    }
    
    // =============================================
    // SMS Sending Methods
    // =============================================
    
    async sendSMS(phoneNumber, message, options = {}) {
        if (!this.isEnabled) {
            console.log('📱 SMS disabled. Would send:', message);
            return { success: true, simulated: true, message: 'SMS disabled - simulation only' };
        }
        
        if (!this.canSendSMS(phoneNumber)) {
            return { 
                success: false, 
                error: 'Rate limit exceeded',
                message: 'Too many messages sent. Please try again later.'
            };
        }
        
        try {
            let response;
            
            if (this.provider === 'twilio') {
                response = await this.sendViaTwilio(phoneNumber, message);
            } else {
                response = await this.sendViaGenericAPI(phoneNumber, message);
            }
            
            if (response.success) {
                this.updateRateLimit(phoneNumber);
            }
            
            return response;
            
        } catch (error) {
            console.error('SMS send error:', error);
            return { success: false, error: error.message };
        }
    }
    
    async sendViaTwilio(phoneNumber, message) {
        const twilio = require('twilio');
        const client = twilio(this.accountSid, this.authToken);
        
        try {
            const result = await client.messages.create({
                body: message,
                from: this.fromNumber,
                to: phoneNumber
            });
            
            return {
                success: true,
                messageId: result.sid,
                status: result.status
            };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    async sendViaGenericAPI(phoneNumber, message) {
        // Example for other SMS providers
        const response = await axios.post('https://api.smsprovider.com/send', {
            api_key: this.apiKey,
            to: phoneNumber,
            from: this.fromNumber,
            message: message
        });
        
        if (response.data.status === 'success') {
            return {
                success: true,
                messageId: response.data.message_id
            };
        }
        
        return { success: false, error: response.data.error };
    }
    
    // =============================================
    // Template-based Messages
    // =============================================
    
    sendTemplateSMS(phoneNumber, templateName, data) {
        const template = this.templates[templateName];
        if (!template) {
            return this.sendSMS(phoneNumber, `[SmartWaste] ${JSON.stringify(data)}`);
        }
        
        let message = template.template;
        for (const [key, value] of Object.entries(data)) {
            message = message.replace(`{${key}}`, value);
        }
        
        return this.sendSMS(phoneNumber, `[SmartWaste] ${message}`);
    }
    
    // =============================================
    // Specific Notification Methods
    // =============================================
    
    async notifyBinFull(phoneNumber, binData) {
        return this.sendTemplateSMS(phoneNumber, 'bin_full', {
            location: binData.location,
            fillLevel: binData.fillLevel
        });
    }
    
    async notifyCollectionReminder(phoneNumber, collectionData) {
        return this.sendTemplateSMS(phoneNumber, 'collection_reminder', {
            time: collectionData.time
        });
    }
    
    async notifyPointsEarned(phoneNumber, pointsData) {
        return this.sendTemplateSMS(phoneNumber, 'points_earned', {
            points: pointsData.points,
            total: pointsData.total
        });
    }
    
    async notifyRewardAvailable(phoneNumber, rewardData) {
        return this.sendTemplateSMS(phoneNumber, 'reward_available', {
            rewardName: rewardData.name,
            points: rewardData.points
        });
    }
    
    async notifyRewardRedeemed(phoneNumber, redemptionData) {
        return this.sendTemplateSMS(phoneNumber, 'reward_redeemed', {
            rewardName: redemptionData.rewardName,
            code: redemptionData.code
        });
    }
    
    async notifyReportSubmitted(phoneNumber, reportData) {
        return this.sendTemplateSMS(phoneNumber, 'report_confirmation', {
            reportId: reportData.id
        });
    }
    
    async notifyReportResolved(phoneNumber, reportData) {
        return this.sendTemplateSMS(phoneNumber, 'report_resolved', {
            location: reportData.location
        });
    }
    
    async notifyCollectionCompleted(phoneNumber, collectionData) {
        return this.sendTemplateSMS(phoneNumber, 'collection_completed', {
            points: collectionData.points
        });
    }
    
    async notifyTierUpgrade(phoneNumber, tierData) {
        return this.sendTemplateSMS(phoneNumber, 'tier_upgrade', {
            tier: tierData.tier
        });
    }
    
    async notifyEmergency(phoneNumber, emergencyData) {
        return this.sendTemplateSMS(phoneNumber, 'emergency_alert', {
            message: emergencyData.message
        });
    }
    
    async notifyFestivalPrediction(phoneNumber, predictionData) {
        return this.sendTemplateSMS(phoneNumber, 'festival_prediction', {
            festival: predictionData.festival,
            increase: predictionData.increase
        });
    }
    
    // =============================================
    // Bulk SMS
    // =============================================
    
    async sendBulkSMS(phoneNumbers, message, options = {}) {
        const results = [];
        
        for (const phone of phoneNumbers) {
            const result = await this.sendSMS(phone, message, options);
            results.push({ phone, ...result });
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        return results;
    }
    
    async sendTemplateBulkSMS(phoneNumbers, templateName, data) {
        const results = [];
        
        for (const phone of phoneNumbers) {
            const result = await this.sendTemplateSMS(phone, templateName, data);
            results.push({ phone, ...result });
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        return results;
    }
    
    // =============================================
    // Analytics & Reporting
    // =============================================
    
    getStatistics() {
        const stats = {
            totalSent: 0,
            byTemplate: {},
            successRate: 0,
            rateLimits: {}
        };
        
        for (const [phone, data] of this.sentCounts) {
            stats.totalSent += data.dayCount;
            stats.rateLimits[phone] = {
                today: data.dayCount,
                thisHour: data.hourCount,
                maxPerDay: this.maxPerDay,
                maxPerHour: this.maxPerHour
            };
        }
        
        return stats;
    }
    
    resetRateLimit(phoneNumber) {
        if (phoneNumber) {
            this.sentCounts.delete(phoneNumber);
        } else {
            this.sentCounts.clear();
        }
    }
    
    updateTemplates(newTemplates) {
        this.templates = { ...this.templates, ...newTemplates };
    }
    
    setRateLimits(maxPerDay, maxPerHour) {
        this.maxPerDay = maxPerDay;
        this.maxPerHour = maxPerHour;
    }
}

module.exports = SMSService;