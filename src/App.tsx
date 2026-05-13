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
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  doc, 
  getDoc, 
  setDoc, 
  handleFirestoreError, 
  OperationType,
  serverTimestamp,
  getDocs,
  collection,
  User
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
  [{ name: "Barbell Bench Press", icon: "Dumbbell", pool: "chest" }, ...pick(POOLS.chest, 2), ...pick(POOLS.triceps, 2), ...pick(POOLS.abs, 1)],
  [...pick(POOLS.back, 2), ...pick(POOLS.biceps, 2), ...pick(POOLS.abs, 1)],
  [{ name: "Barbell Bench Press", icon: "Dumbbell", pool: "chest" }, ...pick(POOLS.shoulders, 2), ...pick(POOLS.abs, 1)],
  pick(POOLS.legs, 4)
];

// --- Components ---
const PBBlock = ({ exName, pbs }: { exName: string, pbs: Record<string, PB> }) => {
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
      <div className="text-[10px] text-gym-accent font-bold uppercase mb-2 flex items-center gap-1">
        <Trophy className="w-3 h-3" /> Best: {pb.bestWeight}kg × {pb.bestReps} <span className="opacity-50 ml-1">({pb.bestDate})</span>
      </div>
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
    </div>
  );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  
  const [currentDays, setCurrentDays] = useState<Exercise[][]>(buildPlan());
  const [personalBests, setPersonalBests] = useState<Record<string, PB>>({});
  const [activeWeek, setActiveWeek] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<'workout' | 'library'>('workout');
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({});
  const [flashMessage, setFlashMessage] = useState<Record<string, string>>({});

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

    const loadData = async () => {
      setDataLoading(true);
      try {
        // Load Workout
        const workoutDoc = await getDoc(doc(db, `users/${currentUser.uid}/workout/current`));
        if (workoutDoc.exists()) {
          setCurrentDays(workoutDoc.data().days);
        }

        // Load PBs
        const pbsSnap = await getDocs(collection(db, `users/${currentUser.uid}/pbs`));
        const pbs: Record<string, PB> = {};
        pbsSnap.forEach(d => {
          pbs[d.id] = d.data() as PB;
        });
        setPersonalBests(pbs);

        // Load Settings
        const settingsDoc = await getDoc(doc(db, `users/${currentUser.uid}/profile/settings`));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          if (data.activeWeek !== undefined) setActiveWeek(data.activeWeek);
          if (data.activeView) setActiveView(data.activeView as any);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'users');
      } finally {
        setDataLoading(false);
      }
    };

    loadData();
  }, [currentUser]);

  const saveWorkout = async (days: Exercise[][]) => {
    if (!currentUser) return;
    try {
      await setDoc(doc(db, `users/${currentUser.uid}/workout/current`), {
        days,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'workout');
    }
  };

  const saveSettings = async (settings: any) => {
    if (!currentUser) return;
    try {
      await setDoc(doc(db, `users/${currentUser.uid}/profile/settings`), {
        ...settings,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'profile/settings');
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
    const newWeight = parseFloat(weight) || 0;
    const newReps = parseInt(reps) || 0;
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    
    const existing = personalBests[exName];
    let isNewPB = false;

    if (!existing) {
      isNewPB = true;
    } else {
      if (newWeight > existing.bestWeight) {
        isNewPB = true;
      } else if (newWeight === existing.bestWeight && newReps > existing.bestReps) {
        isNewPB = true;
      }
    }

    const updatedPB: PB = {
      exerciseName: exName,
      lastWeight: newWeight,
      lastReps: newReps,
      lastDate: dateStr,
      bestWeight: isNewPB ? newWeight : (existing?.bestWeight || newWeight),
      bestReps: isNewPB ? newReps : (existing?.bestReps || newReps),
      bestDate: isNewPB ? dateStr : (existing?.bestDate || dateStr)
    };

    setPersonalBests(prev => ({ ...prev, [exName]: updatedPB }));
    setFlashMessage(prev => ({ ...prev, [exName]: isNewPB ? '🏆 NEW PB!' : '✓ SAVED' }));
    
    try {
      await setDoc(doc(db, `users/${currentUser.uid}/pbs/${exName}`), {
        ...updatedPB,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `pbs/${exName}`);
    }

    setTimeout(() => setFlashMessage(prev => {
      const next = { ...prev };
      delete next[exName];
      return next;
    }), 1500);
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

      {/* Tabs */}
      <nav className="flex overflow-x-auto gap-2 mb-8 no-scrollbar bg-white/5 p-2 rounded-2xl border border-white/10">
        {WEEKS.map((w, i) => (
          <button
            key={w}
            onClick={() => {
              const week = activeWeek === i ? null : i;
              setActiveWeek(week);
              setActiveView('workout');
              saveSettings({ activeWeek: week, activeView: 'workout' });
            }}
            className={`px-5 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border shrink-0 ${
              activeView === 'workout' && activeWeek === i
                ? "bg-gym-accent border-gym-accent-hover text-white font-bold shadow-lg shadow-gym-accent/20"
                : "bg-white/10 border-white/10 text-white/70 hover:bg-white/15 cursor-pointer"
            }`}
          >
            {w}
          </button>
        ))}
        <button
          onClick={() => {
            setActiveView('library');
            setActiveWeek(null);
            saveSettings({ activeWeek: null, activeView: 'library' });
          }}
          className={`px-5 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border shrink-0 flex items-center gap-2 ${
            activeView === 'library'
              ? "bg-gym-accent border-gym-accent-hover text-white font-bold shadow-lg shadow-gym-accent/20"
              : "bg-white/10 border-white/10 text-white/70 hover:bg-white/15 cursor-pointer"
          }`}
        >
          <Search className="w-4 h-4" />
          Library
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
                          <PBBlock exName={ex.name} pbs={personalBests} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
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
                                      const w = (document.getElementById(`w-${di}-${ei}`) as HTMLInputElement)?.value;
                                      const r = (document.getElementById(`r-${di}-${ei}`) as HTMLInputElement)?.value;
                                      handleSaveSet(ex.name, w, r);
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
