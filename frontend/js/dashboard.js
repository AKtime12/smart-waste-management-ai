// Common Dashboard Functions
async function loadDashboardStats() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:5000/api/admin/dashboard', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if(document.getElementById('total-users')) document.getElementById('total-users').textContent = (data.totalUsers || 0).toLocaleString();
        if(document.getElementById('total-collections')) document.getElementById('total-collections').textContent = (data.totalCollections || 0).toLocaleString();
        if(document.getElementById('total-points')) document.getElementById('total-points').textContent = (data.totalPoints || 0).toLocaleString();
        if(document.getElementById('carbon-saved')) document.getElementById('carbon-saved').textContent = (data.carbonSaved || 0).toFixed(1);
        return data;
    } catch(e) { console.error('Failed to load dashboard stats:', e); return null; }
}

function updateDateTime() {
    const el = document.getElementById('date-time');
    if(el) { const now = new Date(); el.innerHTML = `<i class="far fa-calendar-alt"></i> ${now.toLocaleDateString()} <i class="far fa-clock"></i> ${now.toLocaleTimeString()}`; }
}

function showNotification(message, type) {
    const n = document.createElement('div');
    n.className = `notification notification-${type}`;
    n.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i><span>${message}</span><button onclick="this.parentElement.remove()">×</button>`;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 5000);
}

function logout() { localStorage.clear(); window.location.href = '/login.html'; }
function toggleSidebar() { document.getElementById('sidebar')?.classList.toggle('open'); }