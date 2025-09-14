// Email validation
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email) return 'Email is required'
  if (!emailRegex.test(email)) return 'Please enter a valid email address'
  return null
}

// Password validation
export const validatePassword = (password) => {
  if (!password) return 'Password is required'
  if (password.length < 8) return 'Password must be at least 8 characters long'
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter'
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number'
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return 'Password must contain at least one symbol'
  return null
}

// Confirm password validation
export const validateConfirmPassword = (password, confirmPassword) => {
  if (!confirmPassword) return 'Please confirm your password'
  if (password !== confirmPassword) return 'Passwords do not match'
  return null
}

// Full name validation
export const validateFullName = (fullName) => {
  if (!fullName) return 'Full name is required'
  if (fullName.trim().length < 2) return 'Full name must be at least 2 characters long'
  if (!/^[a-zA-Z\s]+$/.test(fullName)) return 'Full name can only contain letters and spaces'
  return null
}

// Income validation
export const validateIncome = (income) => {
  if (!income) return 'Income is required'
  const numIncome = parseFloat(income)
  if (isNaN(numIncome) || numIncome < 0) return 'Income must be a positive number'
  return null
}

// Budget validation
export const validateBudget = (budget) => {
  if (!budget) return 'Budget limit is required'
  const numBudget = parseFloat(budget)
  if (isNaN(numBudget) || numBudget < 0) return 'Budget must be a positive number'
  return null
}

// Generic required field validation
export const validateRequired = (value, fieldName) => {
  if (!value || value.toString().trim() === '') {
    return `${fieldName} is required`
  }
  return null
}
