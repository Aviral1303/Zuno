// ShoppingProfile entity for managing user shopping preferences
export class ShoppingProfile {
  constructor(data = {}) {
    this.id = data.id || null;
    this.created_by = data.created_by || '';
    this.shopping_preferences = data.shopping_preferences || [];
    this.budget_limits = data.budget_limits || { monthly_budget: 1000 };
    this.loyalty_programs = data.loyalty_programs || [];
    this.notification_preferences = data.notification_preferences || {
      price_drops: true,
      deal_alerts: true,
      delivery_updates: true
    };
    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
  }

  // Mock method to get profiles with filters
  static async filter(filters = {}) {
    // This would typically make an API call
    // For now, return mock data
    if (filters.created_by) {
      return [
        new ShoppingProfile({
          id: '1',
          created_by: filters.created_by,
          shopping_preferences: ['electronics', 'fashion'],
          budget_limits: { monthly_budget: 1000 },
          notification_preferences: {
            price_drops: true,
            deal_alerts: true,
            delivery_updates: false
          }
        })
      ];
    }
    return [];
  }

  // Mock method to update shopping profile
  static async update(id, data) {
    // This would typically make an API call
    console.log('Updating shopping profile:', id, data);
    return { success: true };
  }

  // Mock method to create shopping profile
  static async create(data) {
    // This would typically make an API call
    console.log('Creating shopping profile:', data);
    return { success: true, id: '1' };
  }

  // Mock method to get profile by ID
  static async getById(id) {
    // This would typically make an API call
    return new ShoppingProfile({
      id: id,
      created_by: 'user@example.com',
      shopping_preferences: ['electronics', 'fashion'],
      budget_limits: { monthly_budget: 1000 }
    });
  }
}
