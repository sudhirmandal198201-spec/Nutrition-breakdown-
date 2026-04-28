export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  height?: number;
  weight?: number;
  goal?: 'weight_loss' | 'maintenance' | 'weight_gain';
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  allergies?: string[];
  createdAt: string;
}

export interface FoodItem {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  vitamins?: string[];
  minerals?: string[];
}

export interface Meal {
  id?: string;
  userId: string;
  date: string; // YYYY-MM-DD
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foods: FoodItem[];
  totalCalories: number;
  healthScore: number;
  imageUrl?: string;
  timestamp: string;
}

export interface WaterLog {
  id?: string;
  userId: string;
  date: string;
  amountMl: number;
}

export interface NutritionAnalysis {
  foods: FoodItem[];
  totalCalories: number;
  healthScore: number;
  suggestions: string[];
  warnings: string[];
  alternatives: string[];
}
