import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Settings, 
  Bell,
  CreditCard,
  Shield,
  Edit3,
  Sparkles
} from "lucide-react";
import { User as UserEntity } from "@/entities/User";
import { ShoppingProfile } from "@/entities/ShoppingProfile";

const categories = [
  "electronics", "fashion", "home", "beauty", 
  "sports", "books", "food", "travel"
];

export default function Profile() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    shopping_preferences: [],
    monthly_budget: 1000,
    notification_preferences: {
      price_drops: true,
      deal_alerts: true,
      delivery_updates: true
    }
  });

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await UserEntity.me();
      setUser(userData);
      
      const profiles = await ShoppingProfile.filter({ created_by: userData.email });
      if (profiles.length > 0) {
        setProfile(profiles[0]);
        setFormData({
          shopping_preferences: profiles[0].shopping_preferences || [],
          monthly_budget: profiles[0].budget_limits?.monthly_budget || 1000,
          notification_preferences: profiles[0].notification_preferences || {
            price_drops: true,
            deal_alerts: true,
            delivery_updates: true
          }
        });
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  const handleSave = async () => {
    try {
      const profileData = {
        shopping_preferences: formData.shopping_preferences,
        budget_limits: {
          monthly_budget: formData.monthly_budget
        },
        notification_preferences: formData.notification_preferences
      };

      if (profile) {
        await ShoppingProfile.update(profile.id, profileData);
      } else {
        await ShoppingProfile.create(profileData);
      }
      
      setIsEditing(false);
      loadUserData();
    } catch (error) {
      console.error("Error saving profile:", error);
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

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-6xl mx-auto">
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
                {user?.full_name || 'Your Profile'}
              </h1>
              <p className="text-gray-600">{user?.email}</p>
              <Badge className="mt-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                Zuno Member since Jan 2024
              </Badge>
            </div>
          </div>
          
          <Button
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            className={`px-6 rounded-2xl ${
              isEditing 
                ? 'bg-emerald-600 hover:bg-emerald-700' 
                : 'bg-indigo-600 hover:bg-indigo-700'
            } text-white`}
          >
            {isEditing ? (
              <>Save Changes</>
            ) : (
              <>
                <Edit3 className="w-4 h-4 mr-2" />
                Edit Profile
              </>
            )}
          </Button>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Profile Settings */}
          <div className="lg:col-span-2 space-y-8">
            {/* Shopping Preferences */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900">Shopping Preferences</h3>
                  <p className="text-gray-500">Help us personalize your experience</p>
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

            {/* Budget Settings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900">Budget Management</h3>
                  <p className="text-gray-500">Set and track your spending limits</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <Label className="text-gray-900 mb-2 block font-medium">Monthly Budget</Label>
                  <Input
                    type="number"
                    value={formData.monthly_budget}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      monthly_budget: parseInt(e.target.value)
                    }))}
                    disabled={!isEditing}
                    className="bg-gray-50 border-gray-200 text-gray-900 rounded-2xl"
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center p-6 bg-emerald-50 rounded-2xl border border-emerald-200">
                    <div className="text-3xl font-bold text-emerald-600">${formData.monthly_budget}</div>
                    <div className="text-gray-600 font-medium">Budget</div>
                  </div>
                  <div className="text-center p-6 bg-blue-50 rounded-2xl border border-blue-200">
                    <div className="text-3xl font-bold text-blue-600">$847</div>
                    <div className="text-gray-600 font-medium">Spent</div>
                  </div>
                  <div className="text-center p-6 bg-purple-50 rounded-2xl border border-purple-200">
                    <div className="text-3xl font-bold text-purple-600">${formData.monthly_budget - 847}</div>
                    <div className="text-gray-600 font-medium">Remaining</div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Notifications */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
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
              transition={{ duration: 0.6, delay: 0.4 }}
              className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm"
            >
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Account Overview</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Total savings</span>
                  <span className="text-emerald-600 font-bold text-lg">$2,847</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Deals found</span>
                  <span className="text-gray-900 font-semibold">156</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Active subscriptions</span>
                  <span className="text-gray-900 font-semibold">5</span>
                </div>
              </div>
            </motion.div>

            {/* AI Insights */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white"
            >
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5" />
                <h3 className="text-xl font-semibold">AI Insights</h3>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                  <p className="text-white/90 text-sm">
                    💡 You save most on electronics purchases
                  </p>
                </div>
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                  <p className="text-white/90 text-sm">
                    📈 Your spending is 15% below budget
                  </p>
                </div>
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
                loadUserData();
              }}
              className="border-gray-200 text-gray-700 hover:bg-gray-100 px-8 rounded-2xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 rounded-2xl"
            >
              Save Changes
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}