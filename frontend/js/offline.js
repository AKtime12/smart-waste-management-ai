// Offline Mode Support
class OfflineManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.pendingRequests = [];
        this.init();
    }

    init() {
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        // Load pending requests from storage
        this.loadPendingRequests();
    }

    handleOnline() {
        this.isOnline = true;
        this.showNotification('Back online! Syncing data...', 'success');
        this.syncPendingRequests();
    }

    handleOffline() {
        this.isOnline = false;
        this.showNotification('You are offline. Changes will be saved when you reconnect.', 'warning');
    }

    async syncPendingRequests() {
        const requests = this.getPendingRequests();
        
        for (const request of requests) {
            try {
                const response = await fetch(request.url, {
                    method: request.method,
                    headers: request.headers,
                    body: request.body
                });
                
                if (response.ok) {
                    this.removePendingRequest(request.id);
                }
            } catch (error) {
                console.error('Failed to sync request:', error);
            }
        }
        
        this.showNotification('All pending requests synced!', 'success');
    }

    async queueRequest(url, options = {}) {
        if (this.isOnline) {
            try {
                return await fetch(url, options);
            } catch (error) {
                this.saveRequest(url, options);
                throw new Error('Request queued for later');
            }
        } else {
            this.saveRequest(url, options);
            throw new Error('You are offline. Request saved for later.');
        }
    }

    saveRequest(url, options) {
        const request = {
            id: Date.now(),
            url,
            method: options.method || 'GET',
            headers: options.headers,
            body: options.body,
            timestamp: new Date().toISOString()
        };
        
        const pending = this.getPendingRequests();
        pending.push(request);
        localStorage.setItem('pending_requests', JSON.stringify(pending));
        
        this.showNotification('Request saved. Will sync when online.', 'info');
    }

    getPendingRequests() {
        const stored = localStorage.getItem('pending_requests');
        return stored ? JSON.parse(stored) : [];
    }

    removePendingRequest(id) {
        const pending = this.getPendingRequests();
        const filtered = pending.filter(r => r.id !== id);
        localStorage.setItem('pending_requests', JSON.stringify(filtered));
    }

    loadPendingRequests() {
        const pending = this.getPendingRequests();
        if (pending.length > 0) {
            this.showNotification(`${pending.length} pending requests waiting to sync`, 'info');
        }
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

const offlineManager = new OfflineManager();

// Cache API for static assets
if ('caches' in window) {
    const CACHE_NAME = 'smartwaste-v1';
    const urlsToCache = [
        '/',
        '/css/style.css',
        '/css/dashboard.css',
        '/js/api.js',
        '/js/auth.js',
        '/assets/icons/icon-192x192.png'
    ];

    self.addEventListener('install', event => {
        event.waitUntil(
            caches.open(CACHE_NAME)
                .then(cache => cache.addAll(urlsToCache))
        );
    });

    self.addEventListener('fetch', event => {
        event.respondWith(
            caches.match(event.request)
                .then(response => response || fetch(event.request))
        );
    });
}