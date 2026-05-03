import React from 'react';
import { WorkDay, DAYS_OF_WEEK } from '../types';
import { Clock, CheckCircle2, Circle } from 'lucide-react';

interface ScheduleViewProps {
  schedule: WorkDay[];
  onUpdate: (schedule: WorkDay[]) => void;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ schedule, onUpdate }) => {
  const toggleDay = (index: number) => {
    const newSchedule = [...schedule];
    newSchedule[index].enabled = !newSchedule[index].enabled;
    onUpdate(newSchedule);
  };

  const updateTime = (index: number, field: 'startTime' | 'endTime', value: string) => {
    const newSchedule = [...schedule];
    newSchedule[index][field] = value;
    onUpdate(newSchedule);
  };

  const formatTo12h = (time: string) => {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  return (
    <div className="space-y-2 max-w-2xl">
      {schedule.map((day, index) => (
        <div 
          key={day.day}
          className={`group flex items-center gap-6 p-3 rounded border transition-all ${
            day.enabled 
              ? 'bg-amber-50 border-amber-200 shadow-sm' 
              : 'bg-slate-50 border-slate-100 opacity-50 grayscale'
          }`}
        >
          {/* Left: Checkbox */}
          <button 
            onClick={() => toggleDay(index)} 
            className="focus:outline-none flex-shrink-0"
          >
            {day.enabled ? (
              <div className="w-5 h-5 bg-slate-900 rounded-sm flex items-center justify-center">
                <div className="w-2 h-2 bg-amber-500 rounded-full" />
              </div>
            ) : (
              <div className="w-5 h-5 border-2 border-slate-200 rounded-sm" />
            )}
          </button>

          {/* Middle: Day Name */}
          <div className="w-28 flex-shrink-0">
            <span className={`font-sans font-bold text-sm ${day.enabled ? 'text-slate-900' : 'text-slate-400'}`}>
              {day.day}
            </span>
          </div>

          {/* Right: Times (beside each other) */}
          <div className={`flex items-center gap-8 flex-1 transition-opacity ${day.enabled ? 'opacity-100' : 'opacity-20 pointer-events-none'}`}>
            <div className="flex items-center gap-3">
              <span className="text-[10px] items-center uppercase tracking-widest text-slate-400 font-bold">In</span>
              <div className="flex flex-col">
                <input 
                  type="time" 
                  value={day.startTime}
                  onChange={(e) => updateTime(index, 'startTime', e.target.value)}
                  className="bg-transparent border-b border-slate-200 py-1 font-mono text-sm focus:border-amber-500 outline-none w-24 text-center"
                />
                <span className="text-[9px] font-bold text-amber-600 mt-0.5 text-center">{formatTo12h(day.startTime)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] items-center uppercase tracking-widest text-slate-400 font-bold">Out</span>
              <div className="flex flex-col">
                <input 
                  type="time" 
                  value={day.endTime}
                  onChange={(e) => updateTime(index, 'endTime', e.target.value)}
                  className="bg-transparent border-b border-slate-200 py-1 font-mono text-sm focus:border-amber-500 outline-none w-24 text-center"
                />
                <span className="text-[9px] font-bold text-amber-600 mt-0.5 text-center">{formatTo12h(day.endTime)}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
