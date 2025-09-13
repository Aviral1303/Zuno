// User entity for managing user data
export class User {
  constructor(data = {}) {
    this.id = data.id || null;
    this.email = data.email || '';
    this.full_name = data.full_name || '';
    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
  }

  // Mock method to get current user
  static async me() {
    // This would typically make an API call
    // For now, return mock data
    return new User({
      id: '1',
      email: 'user@example.com',
      full_name: 'John Doe',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: new Date().toISOString()
    });
  }

  // Mock method to update user
  static async update(id, data) {
    // This would typically make an API call
    console.log('Updating user:', id, data);
    return { success: true };
  }

  // Mock method to create user
  static async create(data) {
    // This would typically make an API call
    console.log('Creating user:', data);
    return { success: true, id: '1' };
  }
}
