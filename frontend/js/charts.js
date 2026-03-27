let collectionChart;
let compositionChart;

function initCharts() {
    // Collection Trends Chart
    const ctx1 = document.getElementById('collection-chart').getContext('2d');
    collectionChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: getLast30Days(),
            datasets: [
                {
                    label: 'Collections',
                    data: generateRandomData(30, 100, 300),
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Waste (kg)',
                    data: generateRandomData(30, 500, 1500),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#e5e7eb'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
    
    // Waste Composition Chart
    const ctx2 = document.getElementById('composition-chart').getContext('2d');
    compositionChart = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: ['Organic', 'Recyclable', 'Non-Recyclable', 'Hazardous'],
            datasets: [{
                data: [45, 30, 20, 5],
                backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.raw}%`;
                        }
                    }
                }
            }
        }
    });
}

function updateCharts() {
    // Update with real data from API
    collectionChart.data.datasets[0].data = generateRandomData(30, 100, 300);
    collectionChart.data.datasets[1].data = generateRandomData(30, 500, 1500);
    collectionChart.update();
}

function generateRandomData(points, min, max) {
    return Array.from({ length: points }, () => 
        Math.floor(Math.random() * (max - min + 1) + min)
    );
}

function getLast30Days() {
    const dates = [];
    for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toLocaleDateString());
    }
    return dates;
}