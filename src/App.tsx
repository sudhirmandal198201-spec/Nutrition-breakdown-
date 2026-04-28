/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  History, 
  User, 
  BarChart3, 
  Droplet, 
  Apple, 
  Search, 
  Mic, 
  Camera, 
  Activity,
  Calculator,
  LogOut,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Lightbulb,
  Moon,
  Sun,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  doc, 
  updateDoc, 
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db, auth } from './lib/firebase';
import { cn, formatNumber } from './lib/utils';
import { UserProfile, Meal, WaterLog, NutritionAnalysis } from './types';
import { analyzeFoodByImage, analyzeFoodByText, getWeeklyReport, getDietSuggestions } from './lib/gemini';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import Dropzone from 'react-dropzone';
import ReactMarkdown from 'react-markdown';

// View Types
type View = 'dashboard' | 'meals' | 'plan' | 'profile' | 'reports';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // Data State
  const [meals, setMeals] = useState<Meal[]>([]);
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [todayWater, setTodayWater] = useState(0);

  // Auth Effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Fetch or create profile
        const profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (profileDoc.exists()) {
          setProfile(profileDoc.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            createdAt: new Date().toISOString(),
            goal: 'maintenance',
            activityLevel: 'moderate'
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!user) return;

    const todayStr = new Date().toISOString().split('T')[0];
    
    const mealsQuery = query(
      collection(db, 'meals'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeMeals = onSnapshot(mealsQuery, (snapshot) => {
      const mealData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meal));
      setMeals(mealData);
    });

    const waterQuery = query(
      collection(db, 'waterLogs'),
      where('userId', '==', user.uid),
      where('date', '==', todayStr)
    );

    const unsubscribeWater = onSnapshot(waterQuery, (snapshot) => {
      const logs = snapshot.docs.map(doc => doc.data() as WaterLog);
      const total = logs.reduce((acc, curr) => acc + curr.amountMl, 0);
      setTodayWater(total);
    });

    return () => {
      unsubscribeMeals();
      unsubscribeWater();
    };
  }, [user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className={cn("min-h-screen transition-colors duration-300", darkMode ? "bg-zinc-950 text-zinc-100" : "bg-[#F8FAFC] text-slate-800")}>
      {/* Navigation */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 z-50 md:top-0 md:bottom-auto px-8 h-16 flex items-center border-t md:border-t-0 md:border-b transition-colors",
        darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200"
      )}>
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="hidden md:flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold">N</div>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              NutriScope <span className="text-emerald-600 font-medium text-xs ml-1">by Karn Mandal</span>
            </span>
          </div>
          
          <div className="flex items-center justify-around flex-1 md:flex-none md:gap-12">
            <NavIcon icon={BarChart3} label="Overview" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
            <NavIcon icon={Apple} label="Meals" active={currentView === 'meals'} onClick={() => setCurrentView('meals')} />
            <NavIcon icon={Plus} label="Track" active={false} onClick={() => setCurrentView('meals')} highlight />
            <NavIcon icon={FileText} label="Reports" active={currentView === 'reports'} onClick={() => setCurrentView('reports')} />
            <NavIcon icon={User} label="Profile" active={currentView === 'profile'} onClick={() => setCurrentView('profile')} />
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="w-10 h-10 rounded-full border-2 border-emerald-500 overflow-hidden bg-slate-100 flex items-center justify-center">
              {user.photoURL ? <img src={user.photoURL} alt="" /> : <span className="text-emerald-700 font-bold text-xs">KM</span>}
            </div>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-6 pb-24 md:pt-24 md:pb-12 px-6 max-w-7xl mx-auto flex-1">
        <AnimatePresence mode="wait">
          {currentView === 'dashboard' && (
            <DashboardView 
              key="dashboard"
              user={user}
              meals={meals}
              water={todayWater}
              profile={profile as UserProfile}
              darkMode={darkMode}
              onLogWater={(amount: number) => addWater(user.uid, amount)}
            />
          )}
          {currentView === 'meals' && (
            <MealView 
              key="meals"
              user={user}
              meals={meals}
              darkMode={darkMode}
            />
          )}
          {currentView === 'profile' && (
            <ProfileView 
              key="profile"
              user={user}
              profile={profile as UserProfile}
              onUpdateProfile={(data: Partial<UserProfile>) => updateProfile(user.uid, data)}
              darkMode={darkMode}
            />
          )}
          {currentView === 'reports' && (
            <ReportsView 
              key="reports"
              meals={meals}
              profile={profile as UserProfile}
              darkMode={darkMode}
            />
          )}
        </AnimatePresence>
      </main>

      <footer className={cn(
        "hidden md:flex h-10 px-8 items-center justify-between text-[10px] uppercase tracking-widest font-bold border-t transition-colors",
        darkMode ? "bg-zinc-950 border-zinc-900 text-zinc-600" : "bg-white border-slate-100 text-slate-400"
      )}>
        <p>© 2026 NutriScope AI • v2.4.0</p>
        <p>Regional Database: India/South Asia Enabled • Developed by Karn Mandal</p>
      </footer>
    </div>
  );
}

// Helper Components & Views

function NavIcon({ icon: Icon, label, active, onClick, highlight }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all group",
        highlight ? "bg-emerald-500 text-white p-3 rounded-full -mt-10 md:mt-0 shadow-lg shadow-emerald-500/30" : "p-2",
        active && !highlight ? "text-emerald-500" : "text-zinc-500"
      )}
    >
      <Icon size={highlight ? 24 : 20} className={cn("transition-transform group-hover:scale-110")} />
      {!highlight && <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>}
    </button>
  );
}

function LoginView({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-6 text-zinc-900">
      <div className="max-w-md w-full bg-white rounded-3xl p-10 shadow-xl shadow-emerald-500/10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Activity size={32} />
          </div>
          <h1 className="text-3xl font-bold mb-2 tracking-tight">NutriScope</h1>
          <p className="text-zinc-500">Track your nutrition with AI precision.</p>
        </div>
        <button 
          onClick={onLogin}
          className="w-full flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5 invert" alt="" />
          Continue with Google
        </button>
        <div className="mt-8 text-center border-t pt-6">
          <p className="text-xs text-zinc-400 font-medium">Developed by Karn Mandal</p>
        </div>
      </div>
    </div>
  );
}

function DashboardView({ user, meals, water, profile, darkMode, onLogWater }: any) {
  const today = new Date().toISOString().split('T')[0];
  const todayMeals = meals.filter((m: Meal) => m.date === today);
  
  const consumed = todayMeals.reduce((acc: number, m: Meal) => acc + (m.totalCalories || 0), 0);
  const target = calculateCalorieTarget(profile);
  
  const macros = todayMeals.reduce((acc: any, m: Meal) => {
    m.foods.forEach(f => {
      acc.protein += f.protein || 0;
      acc.carbs += f.carbs || 0;
      acc.fat += f.fat || 0;
    });
    return acc;
  }, { protein: 0, carbs: 0, fat: 0 });

  const macroTarget = {
    protein: (target * 0.25) / 4,
    carbs: (target * 0.45) / 4,
    fat: (target * 0.3) / 9
  };

  const bmi = calculateBMI(profile?.weight || 0, profile?.height || 0);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-fr"
    >
      {/* Column 1-3: Daily Intake Stats */}
      <section className={cn(
        "md:col-span-3 md:row-span-4 rounded-3xl p-6 border shadow-sm",
        darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-100"
      )}>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-6">Daily Intake</h3>
        <div className="space-y-6">
          <div>
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Calories</span>
              <span className="text-lg font-bold">{formatNumber(consumed, 0)} / {formatNumber(target, 0)} <span className="text-[10px] text-slate-400 font-medium">kcal</span></span>
            </div>
            <div className={cn("h-2 rounded-full overflow-hidden", darkMode ? "bg-zinc-800" : "bg-slate-100")}>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((consumed/target)*100, 100)}%` }}
                className="h-full bg-emerald-500" 
              />
            </div>
          </div>
          
          <div className="space-y-4 pt-4">
            <NutrientBar label="Protein" current={macros.protein} target={macroTarget.protein} color="bg-blue-500" darkMode={darkMode} />
            <NutrientBar label="Carbs" current={macros.carbs} target={macroTarget.carbs} color="bg-amber-500" darkMode={darkMode} />
            <NutrientBar label="Fats" current={macros.fat} target={macroTarget.fat} color="bg-rose-500" darkMode={darkMode} />
          </div>

          <div className="mt-10 pt-10 border-t border-slate-50 dark:border-zinc-800">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Water Tracker</h3>
            <div className="flex gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((idx) => {
                const filled = water >= idx * 500;
                const partial = !filled && water > (idx - 1) * 500;
                return (
                  <div 
                    key={idx}
                    className={cn(
                      "w-8 h-10 border rounded flex items-end justify-center py-1 transition-all",
                      filled ? "bg-blue-100 border-blue-200" : "bg-transparent border-slate-200 opacity-40"
                    )}
                  >
                    {(filled || partial) && (
                      <div 
                        className="bg-blue-500 rounded-sm w-4" 
                        style={{ height: filled ? '100%' : `${((water % 500) / 500) * 100}%` }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between items-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{water}ml / 2500ml</p>
              <button onClick={() => onLogWater(250)} className="text-blue-500 hover:text-blue-600 transition-colors">
                <Plus size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Column 4-9: Hero Analysis Result / Latest Meal */}
      <section className={cn(
        "md:col-span-6 md:row-span-4 rounded-3xl p-8 relative overflow-hidden text-white shadow-xl bg-emerald-900 border border-emerald-800"
      )}>
        <div className="relative z-10 h-full flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className="bg-emerald-400/20 text-emerald-300 text-[10px] font-bold px-2 py-1 rounded-md uppercase mb-3 block w-fit border border-emerald-400/10">Live AI Analysis</span>
              <h2 className="text-3xl font-bold leading-tight font-display">
                {todayMeals.length > 0 
                  ? todayMeals[0].foods[0].name.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                  : "Start Tracking\nToday's Meals"}
              </h2>
              <p className="text-emerald-100/70 text-sm mt-3 font-medium">
                {todayMeals.length > 0 ? `Detected: Regional Indian ${todayMeals[0].type}` : "Take a photo or Type your meal"}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 text-center border border-white/10 min-w-[80px]">
              <div className="text-3xl font-bold">{todayMeals.length > 0 ? todayMeals[0].healthScore : "--"}</div>
              <div className="text-[10px] uppercase tracking-widest text-emerald-300 mt-1">Score</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-auto">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
              <span className="block text-emerald-300 text-[10px] uppercase font-bold mb-1 tracking-widest">Efficiency</span>
              <span className="text-lg font-bold italic font-display">Optimal</span>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
              <span className="block text-rose-300 text-[10px] uppercase font-bold mb-1 tracking-widest">Total Cal</span>
              <span className="text-lg font-bold">{consumed}</span>
            </div>
            <div className="hidden md:flex bg-emerald-400 text-emerald-950 p-4 rounded-2xl font-bold text-center flex-col justify-center cursor-pointer hover:bg-emerald-300 transition-colors">
              <span className="text-[10px] uppercase tracking-tighter opacity-70">Weekly Insight</span>
              <span className="text-sm underline">View Report</span>
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl"></div>
        <div className="absolute right-8 top-1/2 -translate-y-1/2 w-48 h-48 bg-white/5 rounded-full border border-white/10 flex items-center justify-center opacity-20">
          <div className="w-32 h-32 rounded-full border-4 border-dashed border-emerald-400"></div>
        </div>
      </section>

      {/* Column 10-12: Vital Stats */}
      <section className={cn(
        "md:col-span-3 md:row-span-2 rounded-3xl p-6 border shadow-sm",
        darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-100"
      )}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded flex items-center justify-center">
            <Activity size={16} />
          </div>
          <h3 className="text-sm font-bold">Vital Stats</h3>
        </div>
        <div className="space-y-6">
          <div className="flex justify-between items-end">
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">BMI Index</span>
            <div className="text-right">
              <span className="text-xl font-bold">{bmi.toFixed(1)}</span>
              <span className="block text-[9px] text-emerald-500 font-bold uppercase tracking-widest mt-1">{getBMIStatus(bmi)}</span>
            </div>
          </div>
          <div className="flex justify-between items-end">
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Goal</span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 capitalize">{profile?.goal?.replace('_', ' ')}</span>
          </div>
        </div>
      </section>

      {/* Column 10-12: Alerts */}
      <section className={cn(
        "md:col-span-3 md:row-span-2 rounded-3xl p-6 border shadow-sm",
        darkMode ? "bg-zinc-900 border-zinc-800" : "bg-rose-50 border-rose-100"
      )}>
        <h3 className={cn(
          "text-sm font-bold mb-4 flex items-center gap-2",
          darkMode ? "text-rose-400" : "text-rose-900"
        )}>
          <AlertCircle size={16} />
          Health Alerts
        </h3>
        <div className="space-y-3">
          {macros.protein < macroTarget.protein * 0.4 && (
            <div className="text-[10px] font-bold text-rose-800 dark:text-rose-300 bg-rose-200/50 dark:bg-rose-900/30 p-3 rounded-xl border border-rose-200/50">
              Low Protein: Add dal or paneer to your next meal.
            </div>
          )}
          {bmi > 25 && (
            <div className="text-[10px] font-bold text-rose-800 dark:text-rose-300 bg-rose-200/50 dark:bg-rose-900/30 p-3 rounded-xl border border-rose-200/50">
              BMI Alert: Focus on fiber-rich complex carbs.
            </div>
          )}
          {todayMeals.length === 0 && (
            <div className="text-[10px] font-bold text-slate-500 bg-slate-200/50 p-3 rounded-xl border border-slate-200/50 italic">
              No alerts found today. Log a meal to see improvements.
            </div>
          )}
        </div>
      </section>

      {/* Column 1-6: Weekly Insight Chart */}
      <section className={cn(
        "md:col-span-6 md:row-span-2 rounded-3xl p-6 border shadow-sm",
        darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-100"
      )}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-sm font-bold">Weekly Nutrition</h3>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Consistency: 92%</span>
        </div>
        <div className="flex items-end justify-between h-24 gap-4 px-2">
          {[40, 65, 55, 80, 95, 30, 20].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                className={cn(
                  "w-full rounded-t-lg transition-all group-hover:opacity-80",
                  h > 70 ? "bg-emerald-500" : "bg-emerald-100 dark:bg-emerald-900/30"
                )}
              />
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Column 7-9: Smart Planner */}
      <section className={cn(
        "md:col-span-3 md:row-span-2 rounded-3xl p-6 text-white shadow-xl bg-indigo-600 border border-indigo-500"
      )}>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-indigo-200 mb-4">Smart Planner</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3 border-b border-indigo-500 pb-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1"></div>
            <div>
              <p className="text-xs font-bold">Next Suggestion</p>
              <p className="text-[10px] text-indigo-100 mt-1">Paneer Salad w/ Seeds</p>
            </div>
          </div>
          <button className="w-full bg-white text-indigo-600 py-3 rounded-xl text-xs font-bold font-display shadow-lg active:scale-95 transition-all">
            Get Meal Plan
          </button>
        </div>
      </section>

      {/* Column 10-12: Achievements */}
      <section className={cn(
        "md:col-span-3 md:row-span-2 rounded-3xl p-6 border shadow-sm flex flex-col justify-between",
        darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-100"
      )}>
        <h3 className="text-sm font-bold">Achievements</h3>
        <div className="flex gap-2 justify-center">
          <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center text-xl shadow-sm border border-amber-100/50" title="Streak">🔥</div>
          <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-xl shadow-sm border border-emerald-100/50" title="Protein">💪</div>
          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-xl shadow-sm border border-blue-100/50" title="Hydrated">💧</div>
          <div className="w-10 h-10 bg-slate-50 border-2 border-dashed border-slate-200 rounded-full flex items-center justify-center text-xs text-slate-300">+2</div>
        </div>
        <p className="text-[9px] text-slate-400 font-medium text-center uppercase tracking-tight mt-2">Earn 50 XP for healthy dinner!</p>
      </section>
    </motion.div>
  );
}

function NutrientBar({ label, current, target, color, darkMode }: any) {
  const percent = Math.min((current / target) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] uppercase tracking-wider font-semibold">
        <span className="text-zinc-500">{label}</span>
        <span>{formatNumber(current, 0)}g / {formatNumber(target, 0)}g</span>
      </div>
      <div className={cn("h-1.5 w-full rounded-full overflow-hidden", darkMode ? "bg-zinc-800" : "bg-zinc-100")}>
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className={cn("h-full", color)}
        />
      </div>
    </div>
  );
}

function InsightCard({ icon: Icon, title, desc, color, darkMode }: any) {
  return (
    <div className={cn("p-4 rounded-2xl flex gap-4 items-start shadow-sm", darkMode ? "bg-zinc-900" : "bg-white")}>
      <div className={cn("mt-1", color)}>
        <Icon size={18} />
      </div>
      <div>
        <p className="font-bold text-sm">{title}</p>
        <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function MealView({ user, meals, darkMode }: any) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<NutritionAnalysis | null>(null);
  const [inputText, setInputText] = useState("");
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');
  const [isListening, setIsListening] = useState(false);

  const startVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const result = await analyzeFoodByImage(base64, file.type);
        setAnalysisResult(result);
        setIsAnalyzing(false);
      };
    } catch (error) {
      console.error("Analysis failed:", error);
      setIsAnalyzing(false);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeFoodByText(inputText);
      setAnalysisResult(result);
      setIsAnalyzing(false);
    } catch (error) {
       console.error(error);
       setIsAnalyzing(false);
    }
  };

  const saveMeal = async () => {
    if (!analysisResult) return;
    try {
      await addDoc(collection(db, 'meals'), {
        userId: user.uid,
        date: new Date().toISOString().split('T')[0],
        type: mealType,
        foods: analysisResult.foods,
        totalCalories: analysisResult.totalCalories,
        healthScore: analysisResult.healthScore,
        timestamp: new Date().toISOString()
      });
      setAnalysisResult(null);
      setInputText("");
      alert("Meal saved successfully!");
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      <section className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Log Your Meal</h1>
          <p className="text-zinc-500">Fast analysis with AI recognition.</p>
        </div>

        <div className="flex gap-2 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800">
           {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(t => (
             <button
               key={t}
               onClick={() => setMealType(t)}
               className={cn(
                 "flex-1 py-2 px-4 rounded-xl text-sm font-semibold capitalize transition-all",
                 mealType === t 
                  ? "bg-white dark:bg-zinc-700 shadow-sm text-emerald-500" 
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
               )}
             >
               {t}
             </button>
           ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Dropzone onDrop={onDrop} multiple={false}>
              {({ getRootProps, getInputProps }) => (
                <div 
                  {...getRootProps()} 
                  className={cn(
                    "border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all",
                    darkMode ? "border-zinc-800 hover:border-emerald-500/50" : "border-zinc-200 hover:border-emerald-500 bg-white"
                  )}
                >
                  <input {...getInputProps()} />
                  <Camera className="mx-auto mb-4 text-emerald-500" size={32} />
                  <p className="font-bold">Snap a Photo</p>
                  <p className="text-xs text-zinc-500 mt-1">AI will detect the foods for you.</p>
                </div>
              )}
            </Dropzone>
          </div>

          <form onSubmit={handleTextSubmit} className={cn("md:col-span-2 rounded-3xl p-6 relative flex items-center gap-3", darkMode ? "bg-zinc-900" : "bg-white shadow-sm")}>
             <button 
               type="button"
               onClick={startVoiceInput}
               className={cn("transition-colors", isListening ? "text-red-500 animate-pulse" : "text-zinc-400 hover:text-emerald-500")}
             >
               <Mic size={20} />
             </button>
             <input 
               value={inputText}
               onChange={(e) => setInputText(e.target.value)}
               placeholder="Say: 'I ate 2 eggs and a bowl of dal'"
               className="flex-1 bg-transparent border-none outline-none text-sm focus:ring-0"
             />
             <button type="submit" disabled={isAnalyzing} className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all disabled:opacity-50">
               {isAnalyzing ? <Activity className="animate-spin" size={18} /> : <ChevronRight size={18} />}
             </button>
          </form>
        </div>

        {analysisResult && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn("rounded-3xl p-8 space-y-6 shadow-xl", darkMode ? "bg-zinc-900 border border-emerald-500/20" : "bg-white border border-emerald-100")}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold">Analysis Results</h3>
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full text-xs font-bold">
                Health Score: {analysisResult.healthScore}
              </div>
            </div>

            <div className="grid gap-4">
              {analysisResult.foods.map((food, i) => (
                <div key={i} className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-4">
                  <div>
                    <p className="font-bold capitalize">{food.name}</p>
                    <p className="text-xs text-zinc-500">{food.quantity}</p>
                  </div>
                  <div className="flex gap-4 text-xs font-medium uppercase tracking-tighter">
                     <span>P: {food.protein}g</span>
                     <span>C: {food.carbs}g</span>
                     <span>F: {food.fat}g</span>
                     <span className="text-emerald-500 font-bold">{food.calories} kcal</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-2xl flex gap-3">
               <Lightbulb className="text-emerald-500 shrink-0" size={20} />
               <div>
                  <p className="text-sm font-bold text-emerald-800 dark:text-emerald-400">Smart Suggestion</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-500 mt-0.5">{analysisResult.suggestions[0]}</p>
               </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setAnalysisResult(null)}
                className="flex-1 py-4 px-6 rounded-2xl font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200"
              >
                Cancel
              </button>
              <button 
                onClick={saveMeal}
                className="flex-[2] py-4 px-6 rounded-2xl font-bold bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600"
              >
                Log Meal
              </button>
            </div>
          </motion.div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Recent History</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {meals.map((meal: any) => (
            <div key={meal.id} className={cn("rounded-3xl p-6 shadow-sm", darkMode ? "bg-zinc-900" : "bg-white")}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest">{new Date(meal.timestamp).toLocaleDateString()}</p>
                  <h4 className="font-bold capitalize">{meal.type}</h4>
                </div>
                <div className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-bold">
                  Score: {meal.healthScore}
                </div>
              </div>
              <ul className="space-y-2 mb-4">
                {meal.foods.slice(0, 3).map((f: any, i: any) => (
                  <li key={i} className="text-xs text-zinc-500 flex justify-between">
                    <span className="capitalize">{f.name}</span>
                    <span>{f.calories} kcal</span>
                  </li>
                ))}
                {meal.foods.length > 3 && <li className="text-[10px] text-zinc-400 italic">+{meal.foods.length - 3} more items</li>}
              </ul>
              <div className="pt-4 border-t border-zinc-50 dark:border-zinc-800 flex justify-between items-center">
                <span className="text-emerald-500 font-bold">{meal.totalCalories} kcal</span>
                <button className="text-xs text-zinc-400 hover:text-emerald-500 transition-colors uppercase tracking-widest font-semibold flex items-center gap-1">
                  View Details <ChevronRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </motion.div>
  );
}

function ProfileView({ user, profile, onUpdateProfile, darkMode }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<UserProfile>>({ ...profile });
  const [suggestions, setSuggestions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({ ...profile });
    }
  }, [profile]);

  const handleUpdate = async () => {
    await onUpdateProfile(formData);
    setIsEditing(false);
  };

  const generateAITips = async () => {
    if (!profile) return;
    setIsGenerating(true);
    const tips = await getDietSuggestions(profile);
    setSuggestions(tips);
    setIsGenerating(false);
  };

  const bmi = calculateBMI(profile?.weight || 0, profile?.height || 0);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <section className={cn("rounded-3xl p-8 relative overflow-hidden", darkMode ? "bg-zinc-900 shadow-emerald-500/5 shadow-2xl" : "bg-white shadow-xl shadow-zinc-200/50")}>
        <div className="flex flex-col md:flex-row gap-8 items-center md:items-start relative z-10">
          <div className="w-32 h-32 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center p-1 border-4 border-emerald-500 ring-8 ring-emerald-500/10 shrink-0">
            <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.displayName}`} className="w-full h-full rounded-full" alt="" />
          </div>
          
          <div className="flex-1 text-center md:text-left space-y-2">
            <h1 className="text-3xl font-bold">{user.displayName}</h1>
            <p className="text-zinc-500">{user.email}</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-4">
              <Badge icon={Activity} label={`${profile?.goal?.replace('_', ' ') || 'Goal'}`} darkMode={darkMode} />
              <Badge icon={TrendingUp} label={`BMI: ${bmi.toFixed(1)}`} darkMode={darkMode} />
            </div>
          </div>

          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="px-6 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all active:scale-95 shrink-0"
          >
            {isEditing ? "Cancel" : "Edit Profile"}
          </button>
        </div>

        {isEditing && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-8 pt-8 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden"
          >
            <Input label="Age" type="number" value={formData.age} onChange={(v: string) => setFormData({...formData, age: parseInt(v)})} darkMode={darkMode} />
            <Input label="Weight (kg)" type="number" value={formData.weight} onChange={(v: string) => setFormData({...formData, weight: parseFloat(v)})} darkMode={darkMode} />
            <Input label="Height (cm)" type="number" value={formData.height} onChange={(v: string) => setFormData({...formData, height: parseFloat(v)})} darkMode={darkMode} />
            <Select label="Gender" value={formData.gender} options={['male', 'female', 'other']} onChange={(v: string) => setFormData({...formData, gender: v as any})} darkMode={darkMode} />
            <Select label="Goal" value={formData.goal} options={['weight_loss', 'maintenance', 'weight_gain']} onChange={(v: string) => setFormData({...formData, goal: v as any})} darkMode={darkMode} />
            <Select label="Activity" value={formData.activityLevel} options={['sedentary', 'light', 'moderate', 'active', 'very_active']} onChange={(v: string) => setFormData({...formData, activityLevel: v as any})} darkMode={darkMode} />
            <div className="md:col-span-2">
              <button 
                onClick={handleUpdate}
                className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600"
              >
                Save Changes
              </button>
            </div>
          </motion.div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className={cn("rounded-3xl p-8 space-y-6", darkMode ? "bg-zinc-900" : "bg-white")}>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calculator className="text-emerald-500" />
            Health Metrics
          </h2>
          <div className="grid grid-cols-2 gap-4">
             <MetricCard label="BMI" value={bmi.toFixed(1)} status={getBMIStatus(bmi)} darkMode={darkMode} />
             <MetricCard label="Calorie Goal" value={`${Math.round(calculateCalorieTarget(profile))}`} status="Daily Target" darkMode={darkMode} />
             <MetricCard label="Proteins" value={`${Math.round((calculateCalorieTarget(profile) * 0.25) / 4)}g`} status="Recommended" darkMode={darkMode} />
             <MetricCard label="Hydration" value="2.5 - 3L" status="Daily Target" darkMode={darkMode} />
          </div>
        </section>

        <section className={cn("rounded-3xl p-8 space-y-6", darkMode ? "bg-zinc-900" : "bg-white")}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Lightbulb className="text-amber-500" />
              AI Diet Insights
            </h2>
            <button 
              onClick={generateAITips}
              disabled={isGenerating}
              className="text-xs font-bold uppercase tracking-wider text-emerald-500 hover:underline disabled:opacity-50"
            >
              {isGenerating ? "Analyzing..." : "Regenerate Tips"}
            </button>
          </div>
          
          <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed">
            {suggestions ? (
              <ReactMarkdown>{suggestions}</ReactMarkdown>
            ) : (
              <div className="text-zinc-500 italic py-12 text-center flex flex-col items-center gap-4">
                 <Activity className="animate-pulse" size={48} />
                 <p>Click "Regenerate Tips" to get personalized suggestions based on your profile.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </motion.div>
  );
}

function ReportsView({ meals, profile, darkMode }: any) {
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);
  const reportRef = React.useRef<HTMLDivElement>(null);

  const generateReport = async () => {
    if (!profile) return;
    setLoading(true);
    const result = await getWeeklyReport(meals, profile);
    setReport(result);
    setLoading(false);
  };

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    const { default: html2canvas } = await import('html2canvas');
    const { default: jsPDF } = await import('jspdf');
    
    const canvas = await html2canvas(reportRef.current);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF();
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save('nutriscope-report.pdf');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      <div className="text-center max-w-2xl mx-auto space-y-4">
         <h1 className="text-4xl font-bold tracking-tight">Smart Nutrition Report</h1>
         <p className="text-zinc-500">Comprehensive analysis of your eating habits and long-term trends.</p>
         <div className="flex justify-center gap-4 mt-6">
           <button 
             onClick={generateReport}
             disabled={loading}
             className="px-8 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
           >
             {loading ? "Analyzing My Data..." : "Generate Full Report"}
           </button>
           {report && (
             <button 
               onClick={downloadPDF}
               className="px-8 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-95"
             >
               Download PDF
             </button>
           )}
         </div>
      </div>

      {report && (
        <motion.div 
          ref={reportRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("rounded-3xl p-10 max-w-4xl mx-auto shadow-2xl", darkMode ? "bg-zinc-900 border border-emerald-500/20" : "bg-white border border-emerald-100")}
        >
          <div className="grow-0 flex justify-between items-start mb-8 border-b border-zinc-100 dark:border-zinc-800 pb-6">
            <div>
              <h2 className="text-2xl font-bold">Nutrition Insights</h2>
              <p className="text-zinc-500 text-sm">Powered by NutriScope AI</p>
            </div>
            <Activity className="text-emerald-500" size={32} />
          </div>
          <div className="prose dark:prose-invert max-w-none">
            <ReactMarkdown>{report}</ReactMarkdown>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
        <StatChart title="Calorie Distribution" type="pie" darkMode={darkMode} />
        <StatChart title="Daily Nutrition Trend" type="bar" darkMode={darkMode} />
      </div>
    </motion.div>
  );
}

function StatChart({ title, type, darkMode }: any) {
  return (
    <div className={cn("rounded-3xl p-8 space-y-4", darkMode ? "bg-zinc-900" : "bg-white")}>
       <h3 className="font-bold flex items-center justify-between">
         {title}
         <TrendingUp size={16} className="text-emerald-500" />
       </h3>
       <div className="h-64 flex items-center justify-center bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-dashed border-zinc-100 dark:border-zinc-800">
         <span className="text-xs text-zinc-400 font-mono tracking-widest uppercase">Visualizing {type}...</span>
       </div>
    </div>
  );
}

// Low level helpers

async function addWater(uid: string, amount: number) {
  await addDoc(collection(db, 'waterLogs'), {
    userId: uid,
    date: new Date().toISOString().split('T')[0],
    amountMl: amount,
    timestamp: serverTimestamp()
  });
}

function calculateCalorieTarget(profile: UserProfile): number {
  if (!profile || !profile.weight || !profile.height || !profile.age) return 2000;
  
  let bmr = 0;
  if (profile.gender === 'male') {
    bmr = 88.362 + (13.397 * profile.weight) + (4.799 * profile.height) - (5.677 * profile.age);
  } else {
    bmr = 447.593 + (9.247 * profile.weight) + (3.098 * profile.height) - (4.330 * profile.age);
  }

  const multipliers: any = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9
  };

  let tdee = bmr * (multipliers[profile.activityLevel || 'moderate']);
  
  if (profile.goal === 'weight_loss') tdee -= 500;
  if (profile.goal === 'weight_gain') tdee += 500;

  return tdee;
}

function calculateBMI(weight = 0, height = 0): number {
  if (!weight || !height) return 0;
  const heightM = height / 100;
  return weight / (heightM * heightM);
}

function getBMIStatus(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Healthy Weight";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

function getMealIcon(type: string) {
  switch(type) {
    case 'breakfast': return <Sun size={20} />;
    case 'lunch': return <Activity size={20} />;
    case 'dinner': return <Moon size={20} />;
    default: return <Apple size={20} />;
  }
}

async function updateProfile(uid: string, data: Partial<UserProfile>) {
  await updateDoc(doc(db, 'users', uid), data);
}

function Badge({ icon: Icon, label, darkMode }: any) {
  return (
    <div className={cn("flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-tight", darkMode ? "bg-zinc-800 text-emerald-400" : "bg-emerald-50 text-emerald-600")}>
      <Icon size={14} />
      {label}
    </div>
  );
}

function Input({ label, type, value, onChange, darkMode }: any) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">{label}</label>
      <input 
        type={type} 
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)} 
        className={cn(
          "w-full p-4 rounded-2xl border outline-none transition-all focus:ring-2 focus:ring-emerald-500", 
          darkMode ? "bg-zinc-800 border-zinc-700" : "bg-slate-50 border-slate-200"
        )} 
      />
    </div>
  );
}

function Select({ label, value, options, onChange, darkMode }: any) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">{label}</label>
      <select 
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)} 
        className={cn(
          "w-full p-4 rounded-2xl border outline-none appearance-none transition-all focus:ring-2 focus:ring-emerald-500", 
          darkMode ? "bg-zinc-800 border-zinc-700" : "bg-slate-50 border-slate-200"
        )}
      >
        {options.map((opt: string) => (
          <option key={opt} value={opt}>{opt.replace('_', ' ')}</option>
        ))}
      </select>
    </div>
  );
}

function MetricCard({ label, value, status, darkMode }: any) {
  return (
    <div className={cn(
      "p-4 rounded-2xl border transition-all hover:scale-105", 
      darkMode ? "bg-zinc-800/50 border-zinc-700" : "bg-white border-slate-100 shadow-sm"
    )}>
       <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">{label}</p>
       <p className="text-xl font-bold mt-1 tracking-tight">{value}</p>
       <p className="text-[10px] text-emerald-500 font-bold mt-1 uppercase tracking-tighter">{status}</p>
    </div>
  );
}
