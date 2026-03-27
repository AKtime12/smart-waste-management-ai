// WebSocket Connection for Real-time Updates
class SocketManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.listeners = new Map();
    }

    connect() {
        if (this.socket && this.isConnected) return;

        this.socket = io('http://localhost:5000', {
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        this.socket.on('connect', () => {
            console.log('✅ WebSocket connected');
            this.isConnected = true;
            this.trigger('connect', {});
        });

        this.socket.on('disconnect', () => {
            console.log('❌ WebSocket disconnected');
            this.isConnected = false;
            this.trigger('disconnect', {});
        });

        this.socket.on('bin-update', (data) => {
            this.trigger('bin-update', data);
        });

        this.socket.on('collection-started', (data) => {
            this.trigger('collection-started', data);
        });

        this.socket.on('collection-completed', (data) => {
            this.trigger('collection-completed', data);
        });

        this.socket.on('new-report', (data) => {
            this.trigger('new-report', data);
        });

        this.socket.on('urgent-collection', (data) => {
            this.trigger('urgent-collection', data);
            this.showUrgentNotification(data);
        });

        this.socket.on('points-updated', (data) => {
            this.trigger('points-updated', data);
        });

        this.socket.on('tier-upgrade', (data) => {
            this.trigger('tier-upgrade', data);
            this.showTierUpgrade(data);
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
    }

    joinRoom(room) {
        if (this.socket && this.isConnected) {
            this.socket.emit('join', room);
        }
    }

    emit(event, data) {
        if (this.socket && this.isConnected) {
            this.socket.emit(event, data);
        }
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index !== -1) callbacks.splice(index, 1);
        }
    }

    trigger(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => callback(data));
        }
    }

    showUrgentNotification(data) {
        const notification = document.createElement('div');
        notification.className = 'notification notification-warning urgent';
        notification.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <div>
                <strong>Urgent Collection Needed!</strong>
                <p>Bin at ${data.location} is ${data.fillLevel}% full</p>
                <small>${data.distance.toFixed(1)} km away</small>
            </div>
            <button onclick="this.parentElement.remove()">×</button>
        `;
        document.body.appendChild(notification);
        
        // Play sound
        const audio = new Audio('/assets/sounds/urgent.mp3');
        audio.play().catch(e => console.log('Audio play failed'));
        
        setTimeout(() => notification.remove(), 10000);
    }

    showTierUpgrade(data) {
        const notification = document.createElement('div');
        notification.className = 'notification notification-success';
        notification.innerHTML = `
            <i class="fas fa-trophy"></i>
            <div>
                <strong>🎉 Congratulations!</strong>
                <p>You've reached ${data.newTier} Tier!</p>
                <small>${data.benefits.join(', ')}</small>
            </div>
        `;
        document.body.appendChild(notification);
        
        // Play success sound
        const audio = new Audio('/assets/sounds/success.mp3');
        audio.play().catch(e => console.log('Audio play failed'));
        
        setTimeout(() => notification.remove(), 8000);
    }
}

const socketManager = new SocketManager();