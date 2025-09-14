import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Bell,
  Edit3,
  Sparkles,
  LogOut,
  AlertCircle,
  CheckCircle,
  DollarSign,
  Loader2
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { validateIncome, validateBudget, validateRequired } from "../utils/validation";
import { useNavigate } from "react-router-dom";

const categories = [
  "electronics", "fashion", "home", "beauty", 
  "sports", "books", "food", "travel"
];

const incomeTypes = [
  { value: "monthly", label: "Monthly" },
  { value: "annual", label: "Annual" }
];

export default function Profile() {
  const { user, profile, updateProfile, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    income_amount: '',
    income_type: 'monthly',
    monthly_budget: '',
    shopping_preferences: [],
    notification_preferences: {
      price_drops: true,
      deal_alerts: true,
      delivery_updates: true
    }
  });

  useEffect(() => {
    if (user) {
      const defaultIncome = (profile && profile.income_amount != null && profile.income_amount !== '') 
        ? profile.income_amount 
        : 1000;
      const defaultIncomeType = (profile && profile.income_type) ? profile.income_type : 'monthly';
      const defaultBudget = (profile && profile.monthly_budget != null && profile.monthly_budget !== '')
        ? profile.monthly_budget
        : 2000;

      setFormData({
        full_name: user.user_metadata?.full_name || '',
        income_amount: String(defaultIncome),
        income_type: defaultIncomeType,
        monthly_budget: String(defaultBudget),
        shopping_preferences: profile?.shopping_preferences || [],
        notification_preferences: profile?.notification_preferences || {
          price_drops: true,
          deal_alerts: true,
          delivery_updates: true
        }
      });
    }
  }, [user, profile]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/signin');
    }
  }, [user, authLoading, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    newErrors.full_name = validateRequired(formData.full_name, 'Full name');
    if (formData.income_amount) {
      newErrors.income_amount = validateIncome(formData.income_amount);
    }
    if (formData.monthly_budget) {
      newErrors.monthly_budget = validateBudget(formData.monthly_budget);
    }
    
    // Remove null errors
    Object.keys(newErrors).forEach(key => {
      if (newErrors[key] === null) {
        delete newErrors[key];
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const profileData = {
        full_name: formData.full_name,
        income_amount: formData.income_amount ? parseFloat(formData.income_amount) : null,
        income_type: formData.income_type,
        monthly_budget: formData.monthly_budget ? parseFloat(formData.monthly_budget) : null,
        shopping_preferences: formData.shopping_preferences,
        notification_preferences: formData.notification_preferences
      };

      const { error } = await updateProfile(profileData);
      
      if (error) {
        setErrors({ general: error.message });
      } else {
        setIsEditing(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (error) {
      setErrors({ general: 'An unexpected error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const togglePreference = (category) => {
    setFormData(prev => ({
      ...prev,
      shopping_preferences: prev.shopping_preferences.includes(category)
        ? prev.shopping_preferences.filter(p => p !== category)
        : [...prev.shopping_preferences, category]
    }));
  };

  const toggleNotification = (type) => {
    setFormData(prev => ({
      ...prev,
      notification_preferences: {
        ...prev.notification_preferences,
        [type]: !prev.notification_preferences[type]
      }
    }));
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Success Message */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3"
          >
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-green-700 text-sm">Profile updated successfully!</p>
          </motion.div>
        )}

        {/* Error Message */}
        {errors.general && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-700 text-sm">{errors.general}</p>
          </motion.div>
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-between mb-8 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-3xl p-8"
        >
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg">
              <User className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-gray-900 mb-2">
                {formData.full_name || 'Your Profile'}
              </h1>
              <p className="text-gray-600">{user.email}</p>
              <Badge className="mt-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                Zuno Member
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="border-gray-200 text-gray-700 hover:bg-gray-100 px-4 rounded-2xl"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
            <Button
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              disabled={loading}
              className={`px-6 rounded-2xl ${
                isEditing 
                  ? 'bg-emerald-600 hover:bg-emerald-700' 
                  : 'bg-indigo-600 hover:bg-indigo-700'
              } text-white`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                <>Save Changes</>
              ) : (
                <>
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Profile
                </>
              )}
            </Button>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Profile Settings */}
          <div className="lg:col-span-2 space-y-8">
            {/* Personal Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900">Personal Information</h3>
                  <p className="text-gray-500">Manage your basic profile details</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-gray-900 mb-2 block font-medium">Full Name</Label>
                  <Input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`bg-gray-50 border-gray-200 text-gray-900 rounded-2xl ${
                      errors.full_name ? 'border-red-300 bg-red-50' : ''
                    }`}
                    placeholder="Enter your full name"
                  />
                  {errors.full_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.full_name}</p>
                  )}
                </div>
                <div>
                  <Label className="text-gray-900 mb-2 block font-medium">Email Address</Label>
                  <Input
                    type="email"
                    value={user.email}
                    disabled
                    className="bg-gray-100 border-gray-200 text-gray-500 rounded-2xl cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
                </div>
              </div>
            </motion.div>

            {/* Financial Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900">Financial Information</h3>
                  <p className="text-gray-500">Help us provide better budget recommendations</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-gray-900 mb-2 block font-medium">Income Amount</Label>
                  <Input
                    type="number"
                    name="income_amount"
                    value={formData.income_amount}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`bg-gray-50 border-gray-200 text-gray-900 rounded-2xl ${
                      errors.income_amount ? 'border-red-300 bg-red-50' : ''
                    }`}
                    placeholder="Enter your income"
                  />
                  {errors.income_amount && (
                    <p className="mt-1 text-sm text-red-600">{errors.income_amount}</p>
                  )}
                </div>
                <div>
                  <Label className="text-gray-900 mb-2 block font-medium">Income Type</Label>
                  <select
                    name="income_type"
                    value={formData.income_type}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 text-gray-900 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {incomeTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-gray-900 mb-2 block font-medium">Monthly Budget Limit</Label>
                  <Input
                    type="number"
                    name="monthly_budget"
                    value={formData.monthly_budget}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`bg-gray-50 border-gray-200 text-gray-900 rounded-2xl ${
                      errors.monthly_budget ? 'border-red-300 bg-red-50' : ''
                    }`}
                    placeholder="Enter your monthly budget"
                  />
                  {errors.monthly_budget && (
                    <p className="mt-1 text-sm text-red-600">{errors.monthly_budget}</p>
                  )}
                </div>
                <div>
                  <Label className="text-gray-900 mb-2 block font-medium">Primary Currency</Label>
                  <Input
                    type="text"
                    value="USD"
                    disabled
                    className="bg-gray-100 border-gray-200 text-gray-500 rounded-2xl cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-gray-500">Currently fixed to USD</p>
                </div>
              </div>
            </motion.div>

            {/* Shopping Preferences */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900">Shopping Preferences</h3>
                  <p className="text-gray-500">Select your preferred shopping categories</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => isEditing && togglePreference(category)}
                    disabled={!isEditing}
                    className={`p-4 rounded-2xl text-sm font-medium capitalize transition-all duration-200 ${
                      formData.shopping_preferences.includes(category)
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${!isEditing && 'cursor-default'}`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Notifications */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center">
                  <Bell className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900">Notification Settings</h3>
                  <p className="text-gray-500">Stay updated with relevant alerts</p>
                </div>
              </div>
              
              <div className="space-y-4">
                {Object.entries(formData.notification_preferences).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div>
                      <div className="text-gray-900 font-medium capitalize">
                        {key.replace('_', ' ')}
                      </div>
                      <div className="text-gray-500 text-sm">
                        Get notified about {key.replace('_', ' ').toLowerCase()}
                      </div>
                    </div>
                    <Switch
                      checked={value}
                      onCheckedChange={() => isEditing && toggleNotification(key)}
                      disabled={!isEditing}
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Account Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm"
            >
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Account Overview</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Profile completion</span>
                  <span className="text-indigo-600 font-bold text-lg">
                    {Math.round(((formData.full_name ? 1 : 0) + 
                                (formData.income_amount ? 1 : 0) + 
                                (formData.monthly_budget ? 1 : 0) + 
                                (formData.shopping_preferences.length > 0 ? 1 : 0)) / 4 * 100)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Selected categories</span>
                  <span className="text-gray-900 font-semibold">{formData.shopping_preferences.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Notifications enabled</span>
                  <span className="text-gray-900 font-semibold">
                    {Object.values(formData.notification_preferences).filter(Boolean).length}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* AI Insights */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white"
            >
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5" />
                <h3 className="text-xl font-semibold">Profile Tips</h3>
              </div>
              <div className="space-y-3">
                {!formData.income_amount && (
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <p className="text-white/90 text-sm">
                      💡 Add your income for better budget recommendations
                    </p>
                  </div>
                )}
                {formData.shopping_preferences.length === 0 && (
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <p className="text-white/90 text-sm">
                      🎯 Select shopping categories to get personalized deals
                    </p>
                  </div>
                )}
                {formData.shopping_preferences.length > 0 && formData.income_amount && (
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <p className="text-white/90 text-sm">
                      ✨ Your profile is looking great! Ready for smart shopping
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {isEditing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center gap-4 mt-8"
          >
            <Button
              variant="outline"
              onClick={() => {
                setIsEditing(false);
                setErrors({});
                // Reset form data
                if (user) {
                  setFormData({
                    full_name: user.user_metadata?.full_name || '',
                    income_amount: profile?.income_amount || '',
                    income_type: profile?.income_type || 'monthly',
                    monthly_budget: profile?.monthly_budget || '',
                    shopping_preferences: profile?.shopping_preferences || [],
                    notification_preferences: profile?.notification_preferences || {
                      price_drops: true,
                      deal_alerts: true,
                      delivery_updates: true
                    }
                  });
                }
              }}
              className="border-gray-200 text-gray-700 hover:bg-gray-100 px-8 rounded-2xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 rounded-2xl"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
