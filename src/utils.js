// Utility functions for the application

/**
 * Creates a URL for a given page name
 * @param {string} pageName - The name of the page
 * @returns {string} The URL path for the page
 */
export function createPageUrl(pageName) {
  const pageMap = {
    'Landing': '/',
    'Dashboard': '/dashboard',
    'Profile': '/profile',
    'Chat': '/chat',
    'DealHunter': '/deal-hunter',
    'PriceTracker': '/price-tracker',
    'GiftPlanner': '/gift-planner',
    'BudgetAdvisor': '/budget-advisor',
    'Subscriptions': '/subscriptions'
  };
  
  return pageMap[pageName] || '/';
}
