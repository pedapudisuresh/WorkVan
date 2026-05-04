import React, { useState, useEffect } from 'react';
import { WorkDay, UserPreferences, DAYS_OF_WEEK } from './types';
import { ScheduleView } from './components/ScheduleView';
import { PreferencesView } from './components/PreferencesView';
import { CommuteDashboard } from './components/CommuteDashboard';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Calendar, LayoutDashboard, Truck, MapPin } from 'lucide-react';

const DEFAULT_SCHEDULE: WorkDay[] = DAYS_OF_WEEK.map(day => ({
  day,
  enabled: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(day),
  startTime: '09:00',
  endTime: '17:00'
}));

const DEFAULT_PREFS: UserPreferences = {
  homeAddress: '',
  workAddress: '',
  commuteMode: 'transit',
  bufferMinutes: 15
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'schedule' | 'settings'>('dashboard');
  
  const [schedule, setSchedule] = useState<WorkDay[]>(() => {
    try {
      const saved = localStorage.getItem('workvan_schedule');
      const loaded = saved ? (JSON.parse(saved) as WorkDay[]) : DEFAULT_SCHEDULE;
      // Force sort by DAYS_OF_WEEK order
      return [...loaded].sort((a, b) => DAYS_OF_WEEK.indexOf(a.day) - DAYS_OF_WEEK.indexOf(b.day));
    } catch (e) {
      console.error("Failed to parse schedule", e);
      return DEFAULT_SCHEDULE;
    }
  });

  const [prefs, setPrefs] = useState<UserPreferences>(() => {
    try {
      const saved = localStorage.getItem('workvan_prefs');
      return saved ? JSON.parse(saved) : DEFAULT_PREFS;
    } catch (e) {
      console.error("Failed to parse preferences", e);
      return DEFAULT_PREFS;
    }
  });

  useEffect(() => {
    localStorage.setItem('workvan_schedule', JSON.stringify(schedule));
  }, [schedule]);

  useEffect(() => {
    localStorage.setItem('workvan_prefs', JSON.stringify(prefs));
  }, [prefs]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="h-16 sticky top-0 z-50 bg-slate-900 text-white flex items-center justify-between px-8 border-b border-slate-700">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 rounded-sm flex items-center justify-center font-bold text-slate-900">V</div>
            <div>
              <h1 className="text-xl font-bold tracking-tight uppercase">Work<span className="text-amber-500">Van</span></h1>
            </div>
          </div>
          
          <nav className="flex items-center bg-slate-800 p-1 rounded">
            {[
              { id: 'dashboard', icon: LayoutDashboard, label: 'Route' },
              { id: 'schedule', icon: Calendar, label: 'Hours' },
              { id: 'settings', icon: Settings, label: 'Prefs' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded transition-all text-xs font-semibold ${
                  activeTab === tab.id 
                    ? 'bg-slate-700 text-amber-500 shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline uppercase tracking-widest">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto flex gap-px bg-slate-200">
        <div className="flex-1 bg-white p-8 min-h-[calc(100vh-6rem)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between border-b pb-4 border-slate-100">
                    <div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-600 bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {prefs.workAddress ? prefs.workAddress.split(',')[0] : 'Remote Entry'}
                    </div>
                  </div>
                  <CommuteDashboard prefs={prefs} schedule={schedule} />
                </div>
              )}

              {activeTab === 'schedule' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Schedule Configuration</h2>
                    <h3 className="text-2xl font-bold tracking-tight text-slate-900">Weekly Work Hours</h3>
                  </div>
                  <ScheduleView schedule={schedule} onUpdate={setSchedule} />
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">User Configuration</h2>
                    <h3 className="text-2xl font-bold tracking-tight text-slate-900">Commute Preferences</h3>
                  </div>
                  <PreferencesView prefs={prefs} onUpdate={setPrefs} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Footer / Status */}
      <footer className="h-8 sticky bottom-0 z-50 bg-white border-t border-slate-200 px-8 flex items-center justify-between text-[10px] text-slate-400 font-medium">
        <div className="flex gap-4 items-center">
          <span className="flex items-center gap-1.5 uppercase font-bold text-slate-500">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> 
            Link: Active
          </span>
          <span className="border-l border-slate-200 pl-4">Vancouver, BC</span>
        </div>
        <div className="flex gap-6 uppercase tracking-widest">
          <span className="text-slate-300">Sync: OK</span>
          <span className="text-slate-800 font-bold">● System v1.02</span>
        </div>
      </footer>
    </div>
  );
}
