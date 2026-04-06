// Enhanced Agent API Service with Real Backend Integration
class AgentAPIService {
    constructor() {
        this.baseURL = window.location.origin.includes('localhost') 
            ? 'http://localhost:3000/api' 
            : '/api';
        this.token = localStorage.getItem('agentToken');
        this.agentData = JSON.parse(localStorage.getItem('agentData') || 'null');
        this.init();
    }

    // Initialize and check authentication
    async init() {
        if (this.token && this.agentData) {
            // Verify token is still valid
            try {
                const response = await this.verifyToken();
                if (!response.success) {
                    this.logout();
                }
            } catch (error) {
                console.warn('Token verification failed:', error);
            }
        }
    }

    // Enhanced Authentication
    async login(phone, password) {
        try {
            this.showLoading(true);
            
            const response = await fetch(`${this.baseURL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, password })
            });

            const data = await response.json();

            if (data.success) {
                this.token = data.data.token;
                this.agentData = data.data.agent;
                
                localStorage.setItem('agentToken', this.token);
                localStorage.setItem('agentData', JSON.stringify(data.data.agent));
                
                return { 
                    success: true, 
                    token: this.token, 
                    agent: data.data.agent 
                };
            } else {
                return { 
                    success: false, 
                    message: data.message || 'Login failed' 
                };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { 
                success: false, 
                message: 'Network error. Please try again.' 
            };
        } finally {
            this.showLoading(false);
        }
    }

    // Enhanced Registration with ₵45 fee
    async register(agentData) {
        try {
            this.showLoading(true);
            
            const response = await fetch(`${this.baseURL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...agentData,
                    registrationFee: 45 // Explicitly set registration fee
                })
            });

            const data = await response.json();

            if (data.success) {
                this.token = data.data.token;
                this.agentData = data.data.agent;
                
                localStorage.setItem('agentToken', this.token);
                localStorage.setItem('agentData', JSON.stringify(data.data.agent));
                
                return { 
                    success: true, 
                    message: 'Registration successful!',
                    agent: data.data.agent,
                    token: data.data.token
                };
            } else {
                return { 
                    success: false, 
                    message: data.message 
                };
            }
        } catch (error) {
            console.error('Registration error:', error);
            return { 
                success: false, 
                message: 'Registration failed. Please try again.' 
            };
        } finally {
            this.showLoading(false);
        }
    }

    // OTP Verification
    async verifyOTP(phone, otp) {
        try {
            const response = await fetch(`${this.baseURL}/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, otp })
            });

            const data = await response.json();

            if (data.success) {
                this.token = data.data.token;
                this.agentData = data.data.agent;
                
                localStorage.setItem('agentToken', this.token);
                localStorage.setItem('agentData', JSON.stringify(data.data.agent));
                
                return { 
                    success: true, 
                    token: this.token, 
                    agent: data.data.agent 
                };
            } else {
                return { 
                    success: false, 
                    message: data.message 
                };
            }
        } catch (error) {
            return { 
                success: false, 
                message: 'OTP verification failed' 
            };
        }
    }

    // Send OTP
    async sendOTP(phone) {
        try {
            const response = await fetch(`${this.baseURL}/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            return { 
                success: false, 
                message: 'Failed to send OTP' 
            };
        }
    }

    // Enhanced Dashboard Data
    async getDashboard() {
        try {
            if (!this.isAuthenticated()) {
                throw new Error('Not authenticated');
            }

            const response = await fetch(`${this.baseURL}/agents/dashboard`, {
                headers: { 
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                // Update local agent data
                this.agentData = { ...this.agentData, ...data.data.agent };
                localStorage.setItem('agentData', JSON.stringify(this.agentData));
                
                return data;
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.warn('API failed, using local data:', error.message);
            return this.getLocalDashboard();
        }
    }

    // Get earnings chart data
    async getEarningsChart(period = '7d') {
        try {
            const response = await fetch(`${this.baseURL}/agents/earnings-chart?period=${period}`, {
                headers: { 
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Chart error:', error);
            return this.getMockChartData(period);
        }
    }

    // Enhanced Price Management
    async updatePrices(prices) {
        try {
            const response = await fetch(`${this.baseURL}/agents/pricing`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ prices })
            });

            const data = await response.json();

            if (data.success) {
                return { 
                    success: true, 
                    message: 'Prices updated successfully',
                    updated: data.data.updatedCount
                };
            } else {
                return { 
                    success: false, 
                    message: data.message 
                };
            }
        } catch (error) {
            console.error('Update prices error:', error);
            return { 
                success: false, 
                message: 'Failed to update prices' 
            };
        }
    }

    // Apply global margin
    async applyGlobalMargin(margin) {
        try {
            const response = await fetch(`${this.baseURL}/agents/pricing/apply-margin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ margin })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Apply margin error:', error);
            return { 
                success: false, 
                message: 'Failed to apply margin' 
            };
        }
    }

    // Apply pricing strategy
    async applyPricingStrategy(strategy) {
        try {
            const response = await fetch(`${this.baseURL}/agents/pricing/apply-strategy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ strategy })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Apply strategy error:', error);
            return { 
                success: false, 
                message: 'Failed to apply pricing strategy' 
            };
        }
    }

    // Enhanced Withdrawal System (min ₵15)
    async requestWithdrawal(amount) {
        try {
            if (amount < 15) {
                return { 
                    success: false, 
                    message: 'Minimum withdrawal amount is ₵15' 
                };
            }

            const response = await fetch(`${this.baseURL}/agents/withdraw`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ amount })
            });

            const data = await response.json();

            if (data.success) {
                // Update local balance
                this.agentData.balance = data.data.availableBalance;
                localStorage.setItem('agentData', JSON.stringify(this.agentData));
                
                return { 
                    success: true, 
                    message: 'Withdrawal request submitted',
                    transactionId: data.data.transactionId
                };
            } else {
                return { 
                    success: false, 
                    message: data.message 
                };
            }
        } catch (error) {
            console.error('Withdrawal error:', error);
            return { 
                success: false, 
                message: 'Withdrawal request failed' 
            };
        }
    }

    // Get withdrawal history
    async getWithdrawals(status = 'all', limit = 50) {
        try {
            const response = await fetch(
                `${this.baseURL}/agents/withdrawals?status=${status}&limit=${limit}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Get withdrawals error:', error);
            return this.getLocalWithdrawals();
        }
    }

    // Enhanced Profile Management
    async updateProfile(profileData) {
        try {
            const response = await fetch(`${this.baseURL}/agents/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(profileData)
            });

            const data = await response.json();

            if (data.success) {
                // Update local data and token
                this.agentData = { ...this.agentData, ...profileData };
                this.token = data.data.token || this.token;
                
                localStorage.setItem('agentData', JSON.stringify(this.agentData));
                localStorage.setItem('agentToken', this.token);
                
                return { 
                    success: true, 
                    message: 'Profile updated successfully',
                    agent: this.agentData,
                    token: this.token
                };
            } else {
                return { 
                    success: false, 
                    message: data.message 
                };
            }
        } catch (error) {
            console.error('Update profile error:', error);
            return { 
                success: false, 
                message: 'Failed to update profile' 
            };
        }
    }

    // Update password
    async updatePassword(currentPassword, newPassword) {
        try {
            const response = await fetch(`${this.baseURL}/agents/password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Update password error:', error);
            return { 
                success: false, 
                message: 'Failed to update password' 
            };
        }
    }

    // Get notifications
    async getNotifications(unreadOnly = false) {
        try {
            const response = await fetch(
                `${this.baseURL}/agents/notifications?unread=${unreadOnly}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Get notifications error:', error);
            return this.getLocalNotifications();
        }
    }

    // Mark notification as read
    async markNotificationRead(notificationId) {
        try {
            const response = await fetch(
                `${this.baseURL}/agents/notifications/${notificationId}/read`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Mark notification read error:', error);
            return { 
                success: false, 
                message: 'Failed to mark notification as read' 
            };
        }
    }

    // Get agent orders
    async getAgentOrders(status = null, limit = 20) {
        try {
            let url = `${this.baseURL}/agents/orders?limit=${limit}`;
            if (status) url += `&status=${status}`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Get orders error:', error);
            return this.getLocalOrders();
        }
    }

    // Generate promo code
    async generatePromoCode(discount = 5, expiration = '30d') {
        try {
            const response = await fetch(`${this.baseURL}/agents/store/promo-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ discount, expiration })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Generate promo code error:', error);
            return { 
                success: false, 
                message: 'Failed to generate promo code' 
            };
        }
    }

    // Utility Methods
    isAuthenticated() {
        return !!this.token && !!this.agentData;
    }

    async verifyToken() {
        try {
            const response = await fetch(`${this.baseURL}/agents/profile`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            return await response.json();
        } catch (error) {
            return { success: false };
        }
    }

    logout() {
        this.token = null;
        this.agentData = null;
        localStorage.removeItem('agentToken');
        localStorage.removeItem('agentData');
        window.location.href = 'agent-login.html';
    }

    // Helper methods
    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    // Local fallback methods
    getLocalDashboard() {
        const agent = this.agentData || JSON.parse(localStorage.getItem('agentData') || '{}');
        const orders = JSON.parse(localStorage.getItem('agentOrders') || '[]');
        const withdrawals = JSON.parse(localStorage.getItem('agentWithdrawals') || '[]');
        
        const agentOrders = orders.filter(order => order.agentId === agent.id);
        const recentOrders = agentOrders.slice(-10).reverse();
        
        const stats = {
            totalEarnings: agent.totalEarnings || 0,
            totalSales: agent.totalSales || 0,
            availableBalance: agent.balance || 0,
            monthlyEarnings: this.calculateMonthlyEarnings(agentOrders),
            pendingWithdrawals: withdrawals.filter(w => w.status === 'pending')
                .reduce((sum, w) => sum + w.amount, 0)
        };

        return {
            success: true,
            data: {
                agent: agent,
                stats: stats,
                recentOrders: recentOrders,
                recentWithdrawals: withdrawals.filter(w => w.agentId === agent.id).slice(-5).reverse(),
                products: window.AgentPricingManager?.getAllProducts() || []
            }
        };
    }

    // Mock data for fallback
    getMockChartData(period) {
        const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
        const labels = [];
        const data = [];
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
            data.push(Math.random() * 50 + 10); // Random earnings between 10-60
        }
        
        return {
            success: true,
            data: {
                labels,
                data,
                totalPeriodEarnings: data.reduce((a, b) => a + b, 0),
                averageDailyEarnings: (data.reduce((a, b) => a + b, 0) / days).toFixed(2)
            }
        };
    }

    calculateMonthlyEarnings(orders) {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        return orders
            .filter(order => {
                const orderDate = new Date(order.createdAt);
                return orderDate.getMonth() === currentMonth && 
                       orderDate.getFullYear() === currentYear;
            })
            .reduce((sum, order) => sum + (order.agentProfit || 0), 0);
    }
}

// Initialize the API service globally
window.AgentAPI = new AgentAPIService();