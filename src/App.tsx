import { useState, useEffect } from 'react';
import { 
  ChevronDown, 
  Dumbbell, 
  Flame, 
  RotateCcw, 
  Trophy, 
  ArrowLeftRight, 
  ArrowDown, 
  Activity, 
  ArrowUp, 
  ArrowUpCircle, 
  RotateCw,
  Search,
  RefreshCw,
  LogOut,
  User as UserIcon,
  Loader2,
  History,
  Scale,
  TrendingUp,
  Plus,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs,
  handleFirestoreError, 
  OperationType,
  serverTimestamp,
  collection,
  User,
  deleteDoc,
  writeBatch,
  onSnapshot
} from './lib/firebase';
import { Exercise, POOLS } from './data/exercises';

// --- Types ---
interface PB {
  lastWeight: number;
  lastReps: number;
  lastDate: string;
  bestWeight: number;
  bestReps: number;
  bestDate: string;
  exerciseName: string;
}

interface WeightEntry {
  id?: string;
  weight: number;
  date: string;
  timestamp: any;
}

interface SessionSet {
  id?: string;
  exerciseName: string;
  weight: number;
  reps: number;
  date: string;
  timestamp: any;
}

const DAY_CONFIG = [
  { label: "Day 1", name: "Push", icon: <Dumbbell className="w-5 h-5 text-[#85B7EB]" />, bg: "bg-[#1a3a5c]", border: "border-[#85B7EB]/30", text: "text-[#85B7EB]" },
  { label: "Day 2", name: "Pull", icon: <ArrowUp className="w-5 h-5 text-[#5DCAA5]" />, bg: "bg-[#0d3326]", border: "border-[#5DCAA5]/30", text: "text-[#5DCAA5]" },
  { label: "Day 3", name: "Shoulders", icon: <ArrowUpCircle className="w-5 h-5 text-[#EF9F27]" />, bg: "bg-[#3d2800]", border: "border-[#EF9F27]/30", text: "text-[#EF9F27]" },
  { label: "Day 4", name: "Legs", icon: <Flame className="w-5 h-5 text-[#ED93B1]" />, bg: "bg-[#3d1228]", border: "border-[#ED93B1]/30", text: "text-[#ED93B1]" },
];

const WEEKS = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"];

const iconMap: Record<string, any> = {
  Dumbbell, ArrowLeftRight, ArrowDown, Activity, ArrowUp, ArrowUpCircle, RotateCw, RefreshCw
};

// --- Helpers ---
const pick = (arr: any[], n: number) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);

const buildPlan = () => [
  // Day 1: 1 Bench + 2 Chest + 2 Triceps + 1 Abs = 6
  [{ name: "Barbell Bench Press", icon: "Dumbbell", pool: "chest" }, ...pick(POOLS.chest, 2), ...pick(POOLS.triceps, 2), ...pick(POOLS.abs, 1)],
  // Day 2: 3 Back + 2 Biceps + 1 Abs = 6
  [...pick(POOLS.back, 3), ...pick(POOLS.biceps, 2), ...pick(POOLS.abs, 1)],
  // Day 3: 1 Bench + 4 Shoulders + 1 Abs = 6
  [{ name: "Barbell Bench Press", icon: "Dumbbell", pool: "chest" }, ...pick(POOLS.shoulders, 4), ...pick(POOLS.abs, 1)],
  // Day 4: 5 Legs + 1 Abs = 6
  [...pick(POOLS.legs, 5), ...pick(POOLS.abs, 1)]
];

// --- Components ---
const PBBlock = ({ exName, pbs, showLatest = true }: { exName: string, pbs: Record<string, PB>, showLatest?: boolean }) => {
  const pb = pbs[exName];
  if (!pb) {
    return (
      <div className="mt-3 p-3 rounded-xl bg-gym-accent/5 border border-gym-accent/20">
        <div className="text-[10px] text-gym-accent font-bold uppercase mb-1 tracking-wider">No History</div>
        <div className="text-xs text-white/20">Save a set to track progress</div>
      </div>
    );
  }

  return (
    <div className="mt-3 p-3 rounded-xl bg-gym-accent/5 border border-gym-accent/20">
      <div className={`text-[10px] text-gym-accent font-bold uppercase flex items-center gap-1 ${showLatest ? 'mb-2' : ''}`}>
        <Trophy className="w-3 h-3" /> Best: {pb.bestWeight}kg × {pb.bestReps} <span className="opacity-50 ml-1">({pb.bestDate})</span>
      </div>
      
      {showLatest && (
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-0.5">
            <span className="text-xl font-bold text-white">{pb.lastWeight}</span>
            <span className="text-[10px] text-white/40 uppercase font-bold">kg</span>
          </div>
          <div className="text-white/20 text-lg">×</div>
          <div className="flex items-baseline gap-0.5">
            <span className="text-xl font-bold text-white">{pb.lastReps}</span>
            <span className="text-[10px] text-white/40 uppercase font-bold">reps</span>
          </div>
          <div className="ml-auto text-[10px] text-white/30">Latest: {pb.lastDate}</div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  
  const [currentDays, setCurrentDays] = useState<Exercise[][]>(buildPlan());
  const [personalBests, setPersonalBests] = useState<Record<string, PB>>({});
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [sessionSets, setSessionSets] = useState<SessionSet[]>([]);
  const [activeWeek, setActiveWeek] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<'workout' | 'library' | 'progress' | 'session'>('workout');
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({});
  const [flashMessage, setFlashMessage] = useState<Record<string, string>>({});
  const [newWeight, setNewWeight] = useState<string>("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Data Sync
  useEffect(() => {
    if (!currentUser) return;

    const workoutPath = `users/${currentUser.uid}/workout/current`;
    const settingsPath = `users/${currentUser.uid}/profile/settings`;
    const setsPath = `users/${currentUser.uid}/sets`;
    const pbsPath = `users/${currentUser.uid}/pbs`;
    const weightPath = `users/${currentUser.uid}/weightEntries`;

    // Static Load for Workout & Settings
    const loadStatic = async () => {
      try {
        const [wDoc, sDoc] = await Promise.all([
          getDoc(doc(db, workoutPath)),
          getDoc(doc(db, settingsPath))
        ]);

        if (wDoc.exists()) {
          const data = wDoc.data();
          if (data.days) {
            if (!Array.isArray(data.days)) {
              const daysArr: Exercise[][] = [];
              for (let i = 0; i < 4; i++) daysArr.push(data.days[`d${i}`] || []);
              setCurrentDays(daysArr);
            } else {
              setCurrentDays(data.days as Exercise[][]);
            }
          }
        }

        if (sDoc.exists()) {
          const data = sDoc.data();
          if (data.activeWeek !== undefined) setActiveWeek(data.activeWeek);
          if (data.activeView) setActiveView(data.activeView as any);
        }
      } catch (err) {
        console.error("Static Load error:", err);
      }
    };

    loadStatic();

    // Real-time listeners for Session Data
    const unsubscribeSets = onSnapshot(collection(db, setsPath), (snapshot) => {
      const sets: SessionSet[] = [];
      snapshot.forEach(d => sets.push({ id: d.id, ...d.data() } as SessionSet));
      setSessionSets(sets.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0)));
    }, (err) => console.error("Sets listener error:", err));

    const unsubscribePbs = onSnapshot(collection(db, pbsPath), (snapshot) => {
      const pbs: Record<string, PB> = {};
      snapshot.forEach(d => { pbs[d.id] = d.data() as PB; });
      setPersonalBests(pbs);
    }, (err) => console.error("PBs listener error:", err));

    const unsubscribeWeight = onSnapshot(collection(db, weightPath), (snapshot) => {
      const weights: WeightEntry[] = [];
      snapshot.forEach(d => {
        const data = d.data();
        if (data && typeof data.weight === 'number') {
          weights.push({ 
            id: d.id, 
            weight: data.weight,
            date: data.date || new Date().toISOString().split('T')[0],
            timestamp: data.timestamp
          });
        }
      });
      
      const sorted = weights.sort((a, b) => {
        const dateA = new Date(a.date).getTime() || 0;
        const dateB = new Date(b.date).getTime() || 0;
        if (dateA !== dateB) return dateA - dateB;
        
        const getTs = (ts: any) => {
          if (!ts) return 0;
          if (typeof ts.toMillis === 'function') return ts.toMillis();
          if (ts.seconds) return ts.seconds * 1000;
          return 0;
        };
        return getTs(a.timestamp) - getTs(b.timestamp);
      });
      
      setWeightHistory([...sorted]);
    }, (err) => {
      console.error("Weight snapshot error:", err);
    });

    return () => {
      unsubscribeSets();
      unsubscribePbs();
      unsubscribeWeight();
    };
  }, [currentUser]);

  const saveWorkout = async (days: Exercise[][]) => {
    if (!currentUser) return;
    const path = `users/${currentUser.uid}/workout/current`;
    try {
      // Map 2D array to object to avoid "Nested arrays are not supported" error in Firestore
      const daysObj: Record<string, Exercise[]> = {};
      days.forEach((day, i) => {
        daysObj[`d${i}`] = day;
      });
      
      await setDoc(doc(db, path), {
        days: daysObj,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const saveSettings = async (settings: any) => {
    if (!currentUser) return;
    const path = `users/${currentUser.uid}/profile/settings`;
    try {
      await setDoc(doc(db, path), {
        ...settings,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => auth.signOut();

  const handleShuffle = () => {
    if (!confirm("This will generate a new set of exercises. Continue?")) return;
    const newPlan = buildPlan();
    setCurrentDays(newPlan);
    setExpandedDays({});
    saveWorkout(newPlan);
  };

  const handleSwap = (dayIndex: number, exIndex: number) => {
    const day = [...currentDays[dayIndex]];
    const ex = day[exIndex];
    if (!ex.pool || !POOLS[ex.pool]) return;

    const pool = POOLS[ex.pool];
    const otherExercises = pool.filter(e => e.name !== ex.name && !day.some(d => d.name === e.name));
    
    if (otherExercises.length === 0) {
      alert("No more exercises left in this category to swap!");
      return;
    }
    
    const newEx = otherExercises[Math.floor(Math.random() * otherExercises.length)];
    day[exIndex] = newEx;
    
    const nextCurrentDays = [...currentDays];
    nextCurrentDays[dayIndex] = day;
    setCurrentDays(nextCurrentDays);
    saveWorkout(nextCurrentDays);
  };

  const handleSaveSet = async (exName: string, weight: string, reps: string) => {
    if (!weight || !currentUser) return;
    const nWeight = parseFloat(weight) || 0;
    const nReps = parseInt(reps) || 0;
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const fullDate = new Date().toISOString().split('T')[0];
    
    const existing = personalBests[exName];
    let isNewPB = false;

    if (!existing) {
      isNewPB = true;
    } else {
      if (nWeight > existing.bestWeight) {
        isNewPB = true;
      } else if (nWeight === existing.bestWeight && nReps > existing.bestReps) {
        isNewPB = true;
      }
    }

    const updatedPB: PB = {
      exerciseName: exName,
      lastWeight: nWeight,
      lastReps: nReps,
      lastDate: dateStr,
      bestWeight: isNewPB ? nWeight : (existing?.bestWeight || nWeight),
      bestReps: isNewPB ? nReps : (existing?.bestReps || nReps),
      bestDate: isNewPB ? dateStr : (existing?.bestDate || dateStr)
    };

    setPersonalBests(prev => ({ ...prev, [exName]: updatedPB }));
    setFlashMessage(prev => ({ ...prev, [exName]: isNewPB ? '🏆 NEW PB!' : '✓ SAVED' }));
    
    const setId = `${fullDate}-${exName}-${Date.now()}`;
    
    const newSet: SessionSet = {
      exerciseName: exName,
      weight: nWeight,
      reps: nReps,
      date: fullDate,
      timestamp: { seconds: Math.floor(Date.now() / 1000) }
    };

    // Optimistic Update
    setSessionSets(prev => [...prev, newSet]);
    
    try {
      const pbsPath = `users/${currentUser.uid}/pbs/${exName}`;
      const setsPath = `users/${currentUser.uid}/sets/${setId}`;
      
      const p1 = setDoc(doc(db, pbsPath), {
        ...updatedPB,
        updatedAt: serverTimestamp()
      });

      const p2 = setDoc(doc(db, setsPath), {
        exerciseName: exName,
        weight: nWeight,
        reps: nReps,
        date: fullDate,
        timestamp: serverTimestamp()
      });

      await Promise.all([p1, p2]);
    } catch (err) {
      // Revert optimistic update if needed, but for now just log
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}/save-set`);
    }

    setTimeout(() => setFlashMessage(prev => {
      const next = { ...prev };
      delete next[exName];
      return next;
    }), 1500);
  };

  const handleDeleteSet = async (setId: string) => {
    if (!currentUser) return;
    try {
      await deleteDoc(doc(db, `users/${currentUser.uid}/sets/${setId}`));
      // The real-time listener will update the UI automatically
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUser.uid}/sets/${setId}`);
    }
  };

  const handleClearHistory = async () => {
    if (!currentUser) return;
    
    try {
      setDataLoading(true);
      setShowClearConfirm(false);
      
      // Optimistically clear ONLY session sets from UI
      setSessionSets([]);
      
      const userId = currentUser.uid;
      const setsPath = `users/${userId}/sets`;
      
      // Only fetch sets to delete
      const snap = await getDocs(collection(db, setsPath));
      
      if (!snap.empty) {
        const batch = writeBatch(db);
        let count = 0;
        snap.forEach(d => {
          batch.delete(d.ref);
          count++;
        });
        await batch.commit();
        console.log(`Cleared ${count} session recordings.`);
      }

      // Clear any temporary input values in elements
      const inputs = document.querySelectorAll('input');
      inputs.forEach((input: any) => {
        if (input.type === 'number' || input.type === 'text') {
          input.value = "";
        }
      });

    } catch (err) {
      console.error("Failed to clear session history:", err);
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUser.uid}/sets-wipe`);
    } finally {
      setDataLoading(false);
    }
  };

  const [isSavingWeight, setIsSavingWeight] = useState(false);
  const [weightFlash, setWeightFlash] = useState("");

  const handleSaveWeight = async () => {
    if (!newWeight || !currentUser || isSavingWeight) return;
    
    const w = parseFloat(newWeight);
    if (isNaN(w) || w <= 0) {
      setWeightFlash("Invalid weight");
      setTimeout(() => setWeightFlash(""), 2000);
      return;
    }

    setIsSavingWeight(true);
    const date = new Date().toISOString().split('T')[0];
    
    const entry: Omit<WeightEntry, 'id'> = { 
      weight: w, 
      date, 
      timestamp: serverTimestamp() 
    };
    
    try {
      const weightCol = collection(db, `users/${currentUser.uid}/weightEntries`);
      const docId = `w-${Date.now()}`;
      
      await setDoc(doc(db, `users/${currentUser.uid}/weightEntries`, docId), entry);
      
      setNewWeight("");
      setWeightFlash("✓ SAVED");
      
      // Simple feedback: focus the graph or just keep the flash
      setTimeout(() => setWeightFlash(""), 2000);
    } catch (err) {
      console.error("Error saving weight:", err);
      setWeightFlash("Error saving");
      setTimeout(() => setWeightFlash(""), 3000);
    } finally {
      setIsSavingWeight(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-gym-accent animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-neutral-900/80 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-10 shadow-2xl"
        >
          <div className="w-20 h-20 bg-gym-accent rounded-[1.5rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-gym-accent/30">
            <Dumbbell className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-4 uppercase">Gym Tracker <span className="text-gym-accent">Pro</span></h1>
          <p className="text-white/50 mb-10 leading-relaxed">Your ultimate companion for tracking gains, hitting PBs, and dynamic workout generation.</p>
          <button 
            onClick={handleLogin}
            className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-gym-accent hover:text-white transition-all transform active:scale-95 flex items-center justify-center gap-3 cursor-pointer shadow-xl"
          >
            <UserIcon className="w-5 h-5" />
            Login with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative z-10 max-w-6xl mx-auto px-5 py-8 pb-20">
      {/* Header */}
      <header className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gym-accent rounded-xl flex items-center justify-center shadow-lg shadow-gym-accent/20">
            <Dumbbell className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight uppercase">Gym Tracker <span className="text-gym-accent">Pro</span></h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end mr-2 text-right">
            <span className="text-[10px] uppercase font-black text-white/30 tracking-widest leading-none mb-1">Authenticated as</span>
            <span className="text-xs font-bold text-white/70">{currentUser.displayName}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="p-3 bg-white/5 border border-white/10 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
          <button 
            onClick={handleShuffle}
            className="p-3 bg-gym-accent/10 border border-gym-accent/20 rounded-xl text-gym-accent hover:bg-gym-accent/20 transition-all cursor-pointer"
            title="Reshuffle Plan"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Tabs / Navigation */}
      <nav className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div className="relative col-span-2 md:col-span-1">
          <select 
            value={activeWeek === null ? "" : activeWeek}
            onChange={(e) => {
              const val = e.target.value;
              const week = val === "" ? null : parseInt(val);
              setActiveWeek(week);
              setActiveView('workout');
              saveSettings({ activeWeek: week, activeView: 'workout' });
            }}
            className={`w-full appearance-none bg-white/5 border border-white/10 rounded-2xl px-5 py-3 pr-12 text-sm font-bold transition-all focus:outline-none focus:border-gym-accent focus:bg-white/10 cursor-pointer ${
              activeView === 'workout' && activeWeek !== null ? 'text-white border-gym-accent/40 bg-gym-accent/5' : 'text-white/50'
            }`}
          >
            <option value="" className="bg-[#0a0a0a]">-- Select Week --</option>
            {WEEKS.map((w, i) => (
              <option key={w} value={i} className="bg-[#0a0a0a]">
                Week {i + 1}
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/30">
            <ChevronDown className="w-5 h-5" />
          </div>
        </div>

        <button
          onClick={() => {
            setActiveView('library');
            setActiveWeek(null);
            saveSettings({ activeWeek: null, activeView: 'library' });
          }}
          className={`w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all border flex items-center justify-center gap-2 cursor-pointer ${
            activeView === 'library'
              ? "bg-gym-accent border-gym-accent-hover text-white shadow-lg shadow-gym-accent/20"
              : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
          }`}
        >
          <Search className="w-4 h-4" />
          Library
        </button>

        <button
          onClick={() => {
            setActiveView('progress');
            setActiveWeek(null);
            saveSettings({ activeWeek: null, activeView: 'progress' });
          }}
          className={`w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all border flex items-center justify-center gap-2 cursor-pointer ${
            activeView === 'progress'
              ? "bg-gym-accent border-gym-accent-hover text-white shadow-lg shadow-gym-accent/20"
              : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
          }`}
        >
          <Scale className="w-4 h-4" />
          Progress
        </button>

        <button
          onClick={() => {
            setActiveView('session');
            setActiveWeek(null);
            saveSettings({ activeWeek: null, activeView: 'session' });
          }}
          className={`w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all border flex items-center justify-center gap-2 cursor-pointer ${
            activeView === 'session'
              ? "bg-gym-accent border-gym-accent-hover text-white shadow-lg shadow-gym-accent/20"
              : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
          }`}
        >
          <History className="w-4 h-4" />
          Session
        </button>
      </nav>

      {/* Main Content */}
      <main className="space-y-3">
        <AnimatePresence mode="wait">
          {dataLoading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 text-gym-accent animate-spin" />
            </motion.div>
          ) : activeView === 'library' ? (
            <motion.div 
              key="library"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="pb-12"
            >
              {[
                { title: 'Main Lift', list: [{ name: "Barbell Bench Press", icon: "Dumbbell", pool: "chest" }] },
                ...Object.entries(POOLS).map(([key, list]) => ({ title: key, list }))
              ].map(section => (
                <div key={section.title} className="mb-8">
                  <h3 className="text-sm font-black text-gym-accent uppercase tracking-widest mb-6 ml-1 flex items-center gap-3 border-b border-gym-accent/20 pb-4">
                    <div className="w-2 h-2 bg-gym-accent rounded-full animate-pulse" />
                    {section.title}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {section.list.map(ex => {
                      const Icon = iconMap[ex.icon] || Dumbbell;
                      return (
                        <div key={ex.name} className="bg-neutral-900/90 border border-white/5 rounded-2xl p-4 shadow-xl">
                          <div className="flex items-center gap-3 mb-1">
                            <Icon className="w-4 h-4 text-white/30" />
                            <span className="font-semibold text-sm">{ex.name}</span>
                          </div>
                          <PBBlock exName={ex.name} pbs={personalBests} showLatest={false} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </motion.div>
          ) : activeView === 'progress' ? (
            <motion.div 
              key="progress"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-neutral-900/95 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                  <div>
                    <h3 className="text-xl font-bold flex items-center gap-2 mb-1">
                      <TrendingUp className="w-5 h-5 text-gym-accent" />
                      Weight Tracker
                    </h3>
                    <p className="text-sm text-white/40">Visualise your body weight progress over time</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative group">
                      <input 
                        type="number"
                        inputMode="decimal"
                        placeholder="Enter weight (kg)"
                        value={newWeight}
                        onChange={(e) => setNewWeight(e.target.value)}
                        disabled={isSavingWeight}
                        className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-gym-accent focus:bg-white/10 transition-all w-32 sm:w-40 disabled:opacity-50"
                      />
                      <AnimatePresence>
                        {weightFlash && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.8, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: 10 }}
                            className={`absolute -bottom-8 left-0 right-0 text-center text-[10px] font-black uppercase tracking-widest ${weightFlash.includes('Error') || weightFlash.includes('Invalid') ? 'text-red-500' : 'text-gym-accent'}`}
                          >
                            {weightFlash}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <button 
                      onClick={handleSaveWeight}
                      disabled={isSavingWeight || !newWeight}
                      className="bg-gym-accent hover:bg-gym-accent-hover text-white px-5 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                      {isSavingWeight ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                      )}
                      {isSavingWeight ? 'Saving...' : 'Add Weight'}
                    </button>
                  </div>
                </div>

                <div className="h-[350px] w-full">
                  {weightHistory.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center bg-white/5 rounded-2xl border border-white/5 border-dashed">
                      <TrendingUp className="w-12 h-12 text-white/10 mb-2" />
                      <p className="text-white/20 font-bold text-sm">Add your weight to see your progress graph</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weightHistory} margin={{ top: 20, right: 20, left: -10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          stroke="#ffffff33" 
                          fontSize={10} 
                          tickLine={false}
                          axisLine={false}
                          dy={15}
                          minTickGap={40}
                          tickFormatter={(str) => {
                            if (!str) return '---';
                            try {
                              const date = new Date(str);
                              if (isNaN(date.getTime())) return str;
                              return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                            } catch (e) {
                              return str;
                            }
                          }}
                        />
                        <YAxis 
                          domain={['auto', 'auto']} 
                          stroke="#ffffff33" 
                          fontSize={10} 
                          tickLine={false}
                          axisLine={false}
                          width={30}
                          tickFormatter={(val) => `${val}`}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#111111', 
                            borderColor: '#ffffff10', 
                            borderRadius: '16px',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                            padding: '12px'
                          }}
                          itemStyle={{ color: '#00D1FF', fontWeight: 'bold' }}
                          labelStyle={{ color: '#ffffff50', fontSize: '10px', textTransform: 'uppercase', fontWeight: '900', marginBottom: '4px' }}
                          labelFormatter={(str) => {
                            if (!str) return 'Unknown Date';
                            try {
                              const date = new Date(str);
                              if (isNaN(date.getTime())) return str;
                              return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
                            } catch (e) {
                              return str;
                            }
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="weight" 
                          stroke="#00D1FF" 
                          strokeWidth={4} 
                          dot={{ fill: '#00D1FF', r: 5, strokeWidth: 2, stroke: '#111111' }}
                          activeDot={{ r: 7, stroke: '#ffffff', strokeWidth: 3 }}
                          animationDuration={1500}
                          isAnimationActive={true}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {weightHistory.slice(-4).reverse().map((entry, i) => (
                  <div key={entry.id || i} className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center group relative">
                    <div className="text-[10px] uppercase font-black text-white/30 mb-1">
                      {(() => {
                        if (!entry.date) return 'Unknown';
                        const parts = entry.date.split('-').map(Number);
                        if (parts.length !== 3) return entry.date;
                        const date = new Date(parts[0], parts[1] - 1, parts[2]);
                        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                      })()}
                    </div>
                    <div className="text-xl font-black text-white">{entry.weight}kg</div>
                    {entry.id && (
                      <button 
                        onClick={async () => {
                          if (!currentUser) return;
                          try {
                            await deleteDoc(doc(db, `users/${currentUser.uid}/weightEntries/${entry.id}`));
                          } catch (err) {
                            handleFirestoreError(err, OperationType.DELETE, `weightEntries/${entry.id}`);
                          }
                        }}
                        className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg cursor-pointer"
                        title="Delete entry"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          ) : activeView === 'session' ? (
            <motion.div 
              key="session"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8 pb-20"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2 mb-1">
                    <History className="w-5 h-5 text-gym-accent" />
                    Workout History
                  </h3>
                  <p className="text-sm text-white/40">Review your past performance and sessions</p>
                </div>
                
                {sessionSets.length > 0 && (
                  <div className="flex items-center gap-2">
                    <AnimatePresence mode="wait">
                      {!showClearConfirm ? (
                        <motion.button
                          key="main-btn"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          onClick={() => setShowClearConfirm(true)}
                          disabled={dataLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Clear All Session Data
                        </motion.button>
                      ) : (
                        <motion.div 
                          key="confirm-btns"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="flex items-center gap-2 bg-red-500/5 p-1 rounded-xl border border-red-500/20"
                        >
                          <button
                            onClick={handleClearHistory}
                            disabled={dataLoading}
                            className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                          >
                            {dataLoading ? 'Wiping...' : 'Confirm Wipe'}
                          </button>
                          <button
                            onClick={() => setShowClearConfirm(false)}
                            disabled={dataLoading}
                            className="px-3 py-1.5 bg-white/5 text-white/50 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {sessionSets.length === 0 ? (
                <div className="py-20 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                  <Dumbbell className="w-12 h-12 text-white/10 mx-auto mb-4" />
                  <p className="text-white/30 font-medium">No sets recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-12">
                  {Object.entries(
                    [...sessionSets].reduce((acc, set) => {
                      if (!acc[set.date]) acc[set.date] = [];
                      acc[set.date].push(set);
                      return acc;
                    }, {} as Record<string, SessionSet[]>)
                  )
                  .sort((a, b) => b[0].localeCompare(a[0])) // Newest date first
                      .map(([date, setsByDate]) => {
                        const setsForDate = setsByDate as SessionSet[];
                        return (
                          <div key={date} className="space-y-6">
                            <div className="flex items-center gap-4">
                              <div className="h-px flex-1 bg-white/5" />
                              <h4 className="text-[10px] font-black text-gym-accent uppercase tracking-[0.4em] whitespace-nowrap bg-gym-accent/5 px-4 py-2 rounded-full border border-gym-accent/20">
                                  {(() => {
                                    if (!date) return 'Unknown Date';
                                    const parts = date.split('-').map(Number);
                                    if (parts.length !== 3) return date;
                                    return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('en-GB', { 
                                      weekday: 'long', 
                                      day: 'numeric', 
                                      month: 'long' 
                                    });
                                  })()}
                              </h4>
                              <div className="h-px flex-1 bg-white/5" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {Object.entries(
                                setsForDate.reduce((acc, set) => {
                                  if (!acc[set.exerciseName]) acc[set.exerciseName] = [];
                                  acc[set.exerciseName].push(set);
                                  return acc;
                                }, {} as Record<string, SessionSet[]>)
                              ).map(([name, exerciseSets]) => {
                                const sets = exerciseSets as SessionSet[];
                                return (
                                  <motion.div 
                                    key={name}
                                    layout
                                    className="bg-neutral-900 border border-white/10 rounded-3xl overflow-hidden shadow-xl"
                                  >
                                    <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
                                      <h4 className="font-bold text-sm flex items-center gap-2">
                                        <Activity className="w-3.5 h-3.5 text-gym-accent" />
                                        {name}
                                      </h4>
                                      <span className="text-[10px] text-white/30 font-black">{sets.length} Sets</span>
                                    </div>
                                    <div className="p-4 space-y-2">
                                      {sets.map((set, idx) => (
                                        <div key={idx} className="flex items-center justify-between bg-white/[0.03] p-3 rounded-xl border border-white/5 group relative">
                                          <div className="flex items-center gap-4">
                                            <div className="flex items-baseline gap-1.5">
                                              <span className="text-xl font-black text-white tabular-nums">{set.weight}</span>
                                              <span className="text-[10px] text-white/30 uppercase font-bold tracking-tighter">kg</span>
                                            </div>
                                            <div className="flex items-baseline gap-1.5">
                                              <span className="text-lg font-bold text-white/70 tabular-nums">{set.reps}</span>
                                              <span className="text-[10px] text-white/30 uppercase font-bold tracking-tighter">reps</span>
                                            </div>
                                          </div>
                                          
                                          {set.id && (
                                            <button 
                                              onClick={() => handleDeleteSet(set.id!)}
                                              className="p-2 text-white/10 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                                              title="Delete entry"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                </div>
              )}
            </motion.div>
          ) : activeWeek !== null ? (
            <motion.div 
              key={`week-${activeWeek}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-3"
            >
              {DAY_CONFIG.map((day, di) => (
                <div key={di} className="group">
                  <button
                    onClick={() => setExpandedDays(prev => ({ ...prev, [di]: !prev[di] }))}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all cursor-pointer ${day.bg} ${day.border} border active:scale-[0.98]`}
                  >
                    {day.icon}
                    <span className={`font-bold text-sm ${day.text}`}>{day.label} : {day.name}</span>
                    <ChevronDown className={`ml-auto w-5 h-5 transition-transform duration-300 ${expandedDays[di] ? 'rotate-180' : ''} text-white/30`} />
                  </button>
                  
                  <AnimatePresence>
                    {expandedDays[di] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0, marginTop: 0 }}
                        animate={{ height: "auto", opacity: 1, marginTop: 12 }}
                        exit={{ height: 0, opacity: 0, marginTop: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {currentDays[di]?.map((ex, ei) => {
                            const Icon = iconMap[ex.icon] || Dumbbell;
                            return (
                              <motion.div 
                                key={`${ei}-${ex.name}`} 
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: ei * 0.05 }}
                                className="bg-neutral-900/95 border border-white/10 rounded-2xl p-5 shadow-2xl backdrop-blur-md flex flex-col"
                              >
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-3">
                                    <Icon className="w-4 h-4 text-white/40" />
                                    <h4 className="font-bold text-base line-clamp-1">{ex.name}</h4>
                                    <button 
                                      onClick={() => handleSwap(di, ei)}
                                      className="p-1.5 hover:bg-white/10 rounded-lg text-white/30 hover:text-gym-accent transition-colors cursor-pointer"
                                      title="Swap Exercise"
                                    >
                                      <RefreshCw className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <AnimatePresence>
                                    {flashMessage[ex.name] && (
                                      <motion.span 
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        className="text-[10px] font-black text-gym-accent bg-gym-accent/10 px-2 py-0.5 rounded-md whitespace-nowrap"
                                      >
                                        {flashMessage[ex.name]}
                                      </motion.span>
                                    )}
                                  </AnimatePresence>
                                </div>
                                
                                <div className="flex gap-2 mb-4 mt-auto">
                                  <input 
                                    type="number"
                                    inputMode="decimal"
                                    placeholder="kg"
                                    id={`w-${di}-${ei}`}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-lg font-bold placeholder:text-white/10 focus:outline-none focus:border-gym-accent focus:bg-white/10 transition-all min-w-0"
                                  />
                                  <input 
                                    type="number"
                                    inputMode="numeric"
                                    placeholder="reps"
                                    id={`r-${di}-${ei}`}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-lg font-bold placeholder:text-white/10 focus:outline-none focus:border-gym-accent focus:bg-white/10 transition-all min-w-0"
                                  />
                                  <button 
                                    onClick={() => {
                                      const wInput = document.getElementById(`w-${di}-${ei}`) as HTMLInputElement;
                                      const rInput = document.getElementById(`r-${di}-${ei}`) as HTMLInputElement;
                                      const w = wInput?.value;
                                      const r = rInput?.value;
                                      if (w && r) {
                                        handleSaveSet(ex.name, w, r);
                                        if (wInput) wInput.value = "";
                                        if (rInput) rInput.value = "";
                                      }
                                    }}
                                    className="bg-gym-accent hover:bg-gym-accent-hover text-white px-4 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-lg shadow-gym-accent/30 cursor-pointer uppercase font-black"
                                  >
                                    Save
                                  </button>
                                </div>

                                <PBBlock exName={ex.name} pbs={personalBests} />
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-24 text-center opacity-40 px-8"
            >
              <div className="w-16 h-16 bg-gym-accent/10 rounded-full flex items-center justify-center mb-6">
                <Flame className="w-8 h-8 text-gym-accent" />
              </div>
              <h2 className="text-xl font-bold mb-2">Ready to crush it?</h2>
              <p className="text-sm">Select a week from the navigation above to start tracking your progress.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
