// API Client
const API_BASE_URL = 'http://localhost:5000/api';

class APIClient {
    constructor() { this.token = localStorage.getItem('token'); }

    setToken(token) { this.token = token; if(token) localStorage.setItem('token', token); else localStorage.removeItem('token'); }

    async request(endpoint, options = {}) {
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        if(this.token) headers['Authorization'] = `Bearer ${this.token}`;
        try {
            const res = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
            const data = await res.json();
            if(!res.ok) throw new Error(data.error || 'Request failed');
            return data;
        } catch(error) { console.error('API Error:', error); throw error; }
    }

    // Auth
    async login(email, password) { return this.request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); }
    async register(userData) { return this.request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }); }
    async getProfile() { return this.request('/auth/profile'); }

    // Waste
    async classifyWaste(imageData) { return this.request('/waste/classify', { method: 'POST', body: JSON.stringify({ image: imageData }) }); }
    async getCollections() { return this.request('/waste/collections'); }
    async getTips() { return this.request('/waste/tips'); }

    // Admin
    async getDashboardStats() { return this.request('/admin/dashboard'); }
    async getAnalytics() { return this.request('/admin/analytics'); }

    // Collector
    async getAssignedBins() { return this.request('/collector/bins'); }
    async getFullBins() { return this.request('/collector/bins/full'); }
    async scanBin(qrCode) { return this.request('/collector/scan', { method: 'POST', body: JSON.stringify({ qrCode }) }); }
    async getOptimizedRoute() { return this.request('/collector/route'); }
    async getLiveStats() { return this.request('/tracking/stats'); }
    async getActiveCollectors() { return this.request('/tracking/collectors'); }
    async getBins() { return this.request('/tracking/bins'); }
    async getWardStats() { return this.request('/rewards/wards'); }
}

const api = new APIClient();