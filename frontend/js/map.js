// Google Maps Integration with Real-time Bin Tracking
let map;
let markers = [];
let directionsService;
let directionsRenderer;

// Initialize Map
function initMap() {
    const center = { lat: 28.6139, lng: 77.2090 }; // Delhi
    
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 12,
        center: center,
        styles: mapStyles // Custom styles
    });
    
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({ map: map });
    
    // Load bins
    loadBins();
    
    // Get user location
    getUserLocation();
}

// Load bins with fill levels
async function loadBins() {
    try {
        const bins = await api.getBins();
        
        bins.forEach(bin => {
            const marker = new google.maps.Marker({
                position: { lat: bin.latitude, lng: bin.longitude },
                map: map,
                icon: getBinIcon(bin.fillLevel),
                title: `${bin.type} Bin - ${bin.fillLevel}% full`
            });
            
            // Info window
            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div class="bin-info">
                        <h4>${bin.type} Waste</h4>
                        <p>Fill Level: ${bin.fillLevel}%</p>
                        <div class="fill-bar">
                            <div class="fill-level" style="width: ${bin.fillLevel}%"></div>
                        </div>
                        <p>Location: ${bin.locality}</p>
                        ${bin.fillLevel > 80 ? '<p class="urgent">⚠️ Urgent Collection Needed!</p>' : ''}
                    </div>
                `
            });
            
            marker.addListener('click', () => {
                infoWindow.open(map, marker);
            });
            
            markers.push(marker);
        });
        
        // Auto-refresh every 30 seconds
        setTimeout(loadBins, 30000);
        
    } catch (error) {
        console.error('Failed to load bins:', error);
    }
}

// Get bin icon based on fill level
function getBinIcon(fillLevel) {
    let color;
    if (fillLevel > 80) color = 'red';
    else if (fillLevel > 50) color = 'orange';
    else color = 'green';
    
    return {
        url: `http://maps.google.com/mapfiles/ms/icons/${color}-dot.png`,
        scaledSize: new google.maps.Size(32, 32)
    };
}

// Get user location
function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            map.setCenter(userLocation);
            
            new google.maps.Marker({
                position: userLocation,
                map: map,
                icon: {
                    url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                    scaledSize: new google.maps.Size(40, 40)
                },
                title: 'Your Location'
            });
        });
    }
}

// Optimize route for collector
async function optimizeRoute() {
    const bins = await api.getFullBins();
    const collectorLocation = await getCollectorLocation();
    
    const waypoints = bins.slice(0, 10).map(bin => ({
        location: new google.maps.LatLng(bin.latitude, bin.longitude),
        stopover: true
    }));
    
    const request = {
        origin: collectorLocation,
        destination: collectorLocation,
        waypoints: waypoints,
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING
    };
    
    directionsService.route(request, (result, status) => {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
            showRouteSummary(result);
        }
    });
}

// Map styles for better visualization
const mapStyles = [
    {
        featureType: 'poi',
        stylers: [{ visibility: 'off' }]
    },
    {
        featureType: 'transit',
        stylers: [{ visibility: 'off' }]
    }
];

// Real-time bin updates via WebSocket
const socket = io('http://localhost:5000');
socket.on('bin-update', (bin) => {
    updateBinMarker(bin);
    showNotification(`Bin ${bin.id} is ${bin.fillLevel}% full`);
});





