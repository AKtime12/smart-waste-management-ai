// Push Notification Service
class NotificationService {
    constructor() {
        this.isSupported = 'Notification' in window;
        this.isGranted = false;
        this.init();
    }

    async init() {
        if (!this.isSupported) {
            console.log('Notifications not supported');
            return;
        }

        if (Notification.permission === 'granted') {
            this.isGranted = true;
        } else if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            this.isGranted = permission === 'granted';
        }
    }

    show(title, options = {}) {
        if (!this.isSupported || !this.isGranted) return;

        const defaultOptions = {
            icon: '/assets/icons/icon-192x192.png',
            badge: '/assets/icons/icon-72x72.png',
            vibrate: [200, 100, 200],
            silent: false
        };

        const notification = new Notification(title, { ...defaultOptions, ...options });

        notification.onclick = () => {
            if (options.url) {
                window.focus();
                window.location.href = options.url;
            }
            notification.close();
        };

        setTimeout(() => notification.close(), 5000);
    }

    showBinFull(bin) {
        this.show(`⚠️ Bin Full Alert!`, {
            body: `Bin at ${bin.location} is ${bin.fillLevel}% full. Needs immediate collection!`,
            url: '/pages/tracking.html',
            tag: 'bin-full'
        });
    }

    showCollectionCompleted(collection) {
        this.show(`✅ Collection Completed!`, {
            body: `You earned +${collection.points} points for proper segregation!`,
            url: '/dashboard/household.html',
            tag: 'collection'
        });
    }

    showNewReport(report) {
        this.show(`📋 New Report Submitted`, {
            body: `New waste report at ${report.location}`,
            url: '/dashboard/admin.html',
            tag: 'report'
        });
    }

    showTierUpgrade(tier) {
        this.show(`🏆 Tier Upgrade!`, {
            body: `Congratulations! You've reached ${tier.name} Tier! ${tier.benefits}`,
            url: '/pages/rewards.html',
            tag: 'tier'
        });
    }

    showPrediction(prediction) {
        this.show(`🤖 AI Prediction`, {
            body: `${prediction.area} expected to generate ${prediction.predictedVolume}kg waste tomorrow`,
            url: '/dashboard/admin.html',
            tag: 'prediction'
        });
    }

    showReminder() {
        this.show(`♻️ Recycling Reminder`, {
            body: `Don't forget to separate your waste today! Earn points for proper segregation.`,
            url: '/dashboard/household.html',
            tag: 'reminder'
        });
    }
}

const notificationService = new NotificationService();

// Request permission on user interaction
document.addEventListener('click', () => {
    if (Notification.permission === 'default') {
        notificationService.init();
    }
}, { once: true });