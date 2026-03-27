/**
 * QR Code Service - Generation & Verification
 * Handles QR code creation, validation, and scanning
 */

const QRCode = require('qrcode');
const crypto = require('crypto');

class QRService {
    constructor() {
        this.qrConfig = {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            },
            errorCorrectionLevel: 'H'
        };
        
        this.prefixes = {
            BIN: 'SWM-BIN',
            HOUSEHOLD: 'SWM-HH',
            COLLECTOR: 'SWM-COL',
            REPORT: 'SWM-RPT'
        };
    }

    // =============================================
    // QR Code Generation
    // =============================================

    async generateBinQR(binData) {
        const qrData = {
            type: 'BIN',
            version: '1.0',
            id: binData.id,
            qrCode: binData.qrCode,
            binType: binData.binType,
            location: {
                lat: binData.latitude,
                lng: binData.longitude
            },
            ward: binData.ward,
            locality: binData.locality,
            createdAt: new Date().toISOString(),
            checksum: this.generateChecksum(binData)
        };

        const qrString = JSON.stringify(qrData);
        const qrImage = await this.generateQRImage(qrString);
        
        return {
            qrData: qrString,
            qrImage: qrImage,
            qrCode: binData.qrCode,
            metadata: qrData
        };
    }

    async generateHouseholdQR(householdData) {
        const qrData = {
            type: 'HOUSEHOLD',
            version: '1.0',
            id: householdData.id,
            name: householdData.name,
            address: householdData.address,
            qrCode: householdData.qrCode,
            points: householdData.points || 0,
            tier: householdData.tier || 'BASIC',
            createdAt: new Date().toISOString(),
            checksum: this.generateChecksum(householdData)
        };

        const qrString = JSON.stringify(qrData);
        const qrImage = await this.generateQRImage(qrString);
        
        return {
            qrData: qrString,
            qrImage: qrImage,
            qrCode: householdData.qrCode,
            metadata: qrData
        };
    }

    async generateCollectorQR(collectorData) {
        const qrData = {
            type: 'COLLECTOR',
            version: '1.0',
            id: collectorData.id,
            name: collectorData.name,
            area: collectorData.area,
            employeeId: collectorData.employeeId,
            createdAt: new Date().toISOString(),
            checksum: this.generateChecksum(collectorData)
        };

        const qrString = JSON.stringify(qrData);
        const qrImage = await this.generateQRImage(qrString);
        
        return {
            qrData: qrString,
            qrImage: qrImage,
            qrCode: collectorData.qrCode,
            metadata: qrData
        };
    }

    async generateReportQR(reportData) {
        const qrData = {
            type: 'REPORT',
            version: '1.0',
            id: reportData.id,
            location: {
                lat: reportData.latitude,
                lng: reportData.longitude
            },
            description: reportData.description,
            status: reportData.status,
            createdAt: new Date().toISOString(),
            checksum: this.generateChecksum(reportData)
        };

        const qrString = JSON.stringify(qrData);
        const qrImage = await this.generateQRImage(qrString);
        
        return {
            qrData: qrString,
            qrImage: qrImage,
            qrCode: reportData.qrCode,
            metadata: qrData
        };
    }

    async generateQRImage(data) {
        try {
            const qrCode = await QRCode.toDataURL(data, this.qrConfig);
            return qrCode;
        } catch (error) {
            console.error('QR generation error:', error);
            throw new Error('Failed to generate QR code');
        }
    }

    async generateQRBuffer(data) {
        try {
            const buffer = await QRCode.toBuffer(data, this.qrConfig);
            return buffer;
        } catch (error) {
            console.error('QR buffer generation error:', error);
            throw new Error('Failed to generate QR buffer');
        }
    }

    // =============================================
    // QR Code Validation
    // =============================================

    async validateQR(qrString) {
        try {
            // Parse QR data
            let qrData;
            try {
                qrData = JSON.parse(qrString);
            } catch {
                // If not JSON, treat as simple QR code
                return {
                    valid: true,
                    type: 'SIMPLE',
                    data: { code: qrString }
                };
            }

            // Validate version
            if (qrData.version !== '1.0') {
                return {
                    valid: false,
                    error: 'Unsupported QR version'
                };
            }

            // Validate checksum
            const isValidChecksum = this.validateChecksum(qrData);
            if (!isValidChecksum) {
                return {
                    valid: false,
                    error: 'Invalid QR code checksum'
                };
            }

            // Validate based on type
            switch (qrData.type) {
                case 'BIN':
                    return await this.validateBinQR(qrData);
                case 'HOUSEHOLD':
                    return await this.validateHouseholdQR(qrData);
                case 'COLLECTOR':
                    return await this.validateCollectorQR(qrData);
                case 'REPORT':
                    return await this.validateReportQR(qrData);
                default:
                    return {
                        valid: false,
                        error: 'Unknown QR type'
                    };
            }

        } catch (error) {
            console.error('QR validation error:', error);
            return {
                valid: false,
                error: 'Invalid QR code format'
            };
        }
    }

    async validateBinQR(qrData) {
        // Check required fields
        const requiredFields = ['id', 'qrCode', 'binType', 'location'];
        for (const field of requiredFields) {
            if (!qrData[field]) {
                return {
                    valid: false,
                    error: `Missing field: ${field}`
                };
            }
        }

        // Validate bin type
        const validTypes = ['ORGANIC', 'RECYCLABLE', 'NON_RECYCLABLE', 'HAZARDOUS'];
        if (!validTypes.includes(qrData.binType)) {
            return {
                valid: false,
                error: 'Invalid bin type'
            };
        }

        // Validate location
        if (typeof qrData.location.lat !== 'number' || typeof qrData.location.lng !== 'number') {
            return {
                valid: false,
                error: 'Invalid location data'
            };
        }

        return {
            valid: true,
            type: 'BIN',
            data: qrData
        };
    }

    async validateHouseholdQR(qrData) {
        const requiredFields = ['id', 'name', 'qrCode'];
        for (const field of requiredFields) {
            if (!qrData[field]) {
                return {
                    valid: false,
                    error: `Missing field: ${field}`
                };
            }
        }

        return {
            valid: true,
            type: 'HOUSEHOLD',
            data: qrData
        };
    }

    async validateCollectorQR(qrData) {
        const requiredFields = ['id', 'name', 'employeeId'];
        for (const field of requiredFields) {
            if (!qrData[field]) {
                return {
                    valid: false,
                    error: `Missing field: ${field}`
                };
            }
        }

        return {
            valid: true,
            type: 'COLLECTOR',
            data: qrData
        };
    }

    async validateReportQR(qrData) {
        const requiredFields = ['id', 'location'];
        for (const field of requiredFields) {
            if (!qrData[field]) {
                return {
                    valid: false,
                    error: `Missing field: ${field}`
                };
            }
        }

        return {
            valid: true,
            type: 'REPORT',
            data: qrData
        };
    }

    // =============================================
    // Checksum Operations
    // =============================================

    generateChecksum(data) {
        const relevantData = {
            id: data.id,
            type: data.type,
            timestamp: data.createdAt || new Date().toISOString()
        };
        
        const stringData = JSON.stringify(relevantData);
        return crypto.createHash('sha256').update(stringData).digest('hex').substring(0, 16);
    }

    validateChecksum(qrData) {
        if (!qrData.checksum) return false;
        
        const computedChecksum = this.generateChecksum(qrData);
        return qrData.checksum === computedChecksum;
    }

    // =============================================
    // QR Code Batch Operations
    // =============================================

    async generateBatchBinQR(bins) {
        const results = [];
        for (const bin of bins) {
            const qr = await this.generateBinQR(bin);
            results.push(qr);
        }
        return results;
    }

    async generateBatchHouseholdQR(households) {
        const results = [];
        for (const household of households) {
            const qr = await this.generateHouseholdQR(household);
            results.push(qr);
        }
        return results;
    }

    // =============================================
    // QR Code Decoding
    // =============================================

    async decodeQR(qrImage) {
        try {
            // This would require a QR decoding library
            // For now, placeholder implementation
            const decoded = await this.simulateDecode(qrImage);
            return decoded;
        } catch (error) {
            console.error('QR decode error:', error);
            throw new Error('Failed to decode QR code');
        }
    }

    async simulateDecode(qrImage) {
        // Placeholder for actual QR decoding
        // In production, use a library like jsQR
        return {
            success: true,
            data: 'Sample QR data',
            format: 'QR_CODE'
        };
    }

    // =============================================
    // QR Code Utility Methods
    // =============================================

    generateQRCode() {
        const timestamp = Date.now();
        const random = crypto.randomBytes(4).toString('hex');
        return `${this.prefixes.BIN}-${timestamp}-${random}`;
    }

    generateHouseholdQRCode() {
        const timestamp = Date.now();
        const random = crypto.randomBytes(4).toString('hex');
        return `${this.prefixes.HOUSEHOLD}-${timestamp}-${random}`;
    }

    generateCollectorQRCode() {
        const timestamp = Date.now();
        const random = crypto.randomBytes(4).toString('hex');
        return `${this.prefixes.COLLECTOR}-${timestamp}-${random}`;
    }

    generateReportQRCode() {
        const timestamp = Date.now();
        const random = crypto.randomBytes(4).toString('hex');
        return `${this.prefixes.REPORT}-${timestamp}-${random}`;
    }

    extractIdFromQR(qrString) {
        try {
            const qrData = JSON.parse(qrString);
            return qrData.id || qrData.qrCode;
        } catch {
            return qrString;
        }
    }

    getQRType(qrString) {
        try {
            const qrData = JSON.parse(qrString);
            return qrData.type;
        } catch {
            return 'SIMPLE';
        }
    }

    // =============================================
    // QR Code Template Generation
    // =============================================

    generateQRWithLogo(data, logoUrl) {
        // This would require advanced QR generation
        // Placeholder for now
        return this.generateQRImage(data);
    }

    generateQRWithCustomStyle(data, style) {
        const config = {
            ...this.qrConfig,
            color: {
                dark: style.darkColor || '#000000',
                light: style.lightColor || '#ffffff'
            },
            width: style.width || 300
        };
        
        return QRCode.toDataURL(data, config);
    }

    // =============================================
    // Export/Import
    // =============================================

    exportQRData(qrCodes) {
        return {
            version: '1.0',
            exportDate: new Date().toISOString(),
            qrCodes: qrCodes,
            totalCount: qrCodes.length
        };
    }

    importQRData(exportData) {
        if (exportData.version !== '1.0') {
            throw new Error('Incompatible export version');
        }
        return exportData.qrCodes;
    }

    // =============================================
    // Analytics
    // =============================================

    getQRStats(qrCodes) {
        const stats = {
            total: qrCodes.length,
            byType: {
                BIN: 0,
                HOUSEHOLD: 0,
                COLLECTOR: 0,
                REPORT: 0,
                SIMPLE: 0
            },
            generatedToday: 0,
            lastGenerated: null
        };
        
        const today = new Date().toDateString();
        
        for (const qr of qrCodes) {
            const type = this.getQRType(qr.qrData || qr);
            stats.byType[type] = (stats.byType[type] || 0) + 1;
            
            if (qr.createdAt) {
                const createdDate = new Date(qr.createdAt).toDateString();
                if (createdDate === today) {
                    stats.generatedToday++;
                }
                
                if (!stats.lastGenerated || new Date(qr.createdAt) > new Date(stats.lastGenerated)) {
                    stats.lastGenerated = qr.createdAt;
                }
            }
        }
        
        return stats;
    }

    // =============================================
    // QR Code Verification
    // =============================================

    verifyQRIntegrity(qrData, storedData) {
        if (qrData.checksum !== storedData.checksum) {
            return false;
        }
        
        if (qrData.id !== storedData.id) {
            return false;
        }
        
        return true;
    }

    getQRExpiration(qrData) {
        if (!qrData.createdAt) return null;
        
        const created = new Date(qrData.createdAt);
        const expiration = new Date(created);
        expiration.setDate(created.getDate() + 30); // 30 days validity
        
        return expiration;
    }

    isQRExpired(qrData) {
        const expiration = this.getQRExpiration(qrData);
        if (!expiration) return false;
        
        return new Date() > expiration;
    }

    // =============================================
    // QR Code Print Format
    // =============================================

    generatePrintFormat(qrData, label) {
        return {
            qrImage: qrData.qrImage,
            label: label,
            instructions: 'Scan this QR code to record waste collection',
            additionalInfo: {
                type: qrData.metadata.type,
                id: qrData.metadata.id,
                generated: new Date().toISOString()
            }
        };
    }

    generateBatchPrintFormat(qrCodes) {
        return qrCodes.map(qr => this.generatePrintFormat(qr, qr.metadata.name || qr.metadata.id));
    }
}

module.exports = QRService;