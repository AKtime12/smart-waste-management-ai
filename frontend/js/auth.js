// Authentication Module
class AuthManager {
    constructor() { this.user = null; this.token = localStorage.getItem('token'); }

    async login(email, password) {
        try {
            const res = await fetch('http://localhost:5000/api/auth/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if(data.success) { this.token = data.token; this.user = data.user; localStorage.setItem('token', data.token); localStorage.setItem('user', JSON.stringify(data.user)); }
            return data;
        } catch(error) { return { success: false, error: 'Network error' }; }
    }

    // In auth.js, update the register method
async register(userData) {
    try {
        const res = await fetch('http://localhost:5000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        const data = await res.json();
        if (data.success) {
            this.token = data.token;
            this.user = data.user;
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
        }
        return data;
    } catch(error) {
        return { success: false, error: 'Network error' };
    }
}

    logout() { this.token = null; this.user = null; localStorage.clear(); window.location.href = '/login.html'; }

    isAuthenticated() { return !!this.token; }

    getUser() { return this.user || JSON.parse(localStorage.getItem('user') || '{}'); }
}

const auth = new AuthManager();