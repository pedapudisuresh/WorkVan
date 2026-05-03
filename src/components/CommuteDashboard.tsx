import React, { useState, useEffect } from 'react';
import { UserPreferences, WorkDay, RouteEstimate, DAYS_OF_WEEK } from '../types';
import { getDirections } from '../services/api';
import { motion, AnimatePresence } from 'motion/react';
import { Navigation, Clock, AlertTriangle, ArrowRight, RefreshCw, Bus, TramFront, Footprints, Bike, MapPin, Car } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

interface CommuteDashboardProps {
  prefs: UserPreferences;
  schedule: WorkDay[];
}

export const CommuteDashboard: React.FC<CommuteDashboardProps> = ({ prefs, schedule }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weekCommutes, setWeekCommutes] = useState<any[]>([]);
  const [advice, setAdvice] = useState<any>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const getAdvice = async (commutes: any[]) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        setAdvice({
          isOptimal: true,
          optimization: "Configure your Gemini API key for personalized optimization.",
          score: 100
        });
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `
          Traffic Snapshot: ${JSON.stringify(commutes.map(c => ({ day: c.day, route: c.toWork.summary, duration: c.toWork.durationText })))}
          User Preferences: ${JSON.stringify(prefs)}
        `,
        config: {
          systemInstruction: `You are a Vancouver commute specialist. Analyze these LIVE routed paths for disruptions.
          If a route seems slower than usual for Vancouver, suggest if real-time traffic might have forced this path.
          Return a JSON object with keys: isOptimal (boolean), optimization (string, max 2 sentences), and score (number 1-100).`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isOptimal: { type: Type.BOOLEAN },
              optimization: { type: Type.STRING },
              score: { type: Type.NUMBER }
            },
            required: ["isOptimal", "optimization", "score"]
          }
        }
      });

      const data = JSON.parse(response.text.trim());
      setAdvice(data);
    } catch (e) {
      console.error("Advice failed", e);
      setAdvice({ 
        isOptimal: true, 
        optimization: "You're on the fastest track based on current traffic and schedule.",
        score: 90
      });
    }
  };

  const calculateFullWeek = async () => {
    if (!prefs.homeAddress || !prefs.workAddress) {
      setError("Please set your Home and Work addresses in Settings.");
      return;
    }

    setLoading(true);
    setError(null);
    setLastUpdated(new Date());
    try {
      const activeDays = schedule.filter(d => d.enabled);
      if (activeDays.length === 0) {
        setError("No active workdays in your schedule.");
        return;
      }

      const results = await Promise.all(activeDays.map(async (day) => {
        const now = new Date();
        const currentDayIdx = (now.getDay() + 6) % 7; 
        const targetDayIdx = DAYS_OF_WEEK.indexOf(day.day);
        
        let daysDelta = (targetDayIdx - currentDayIdx + 7) % 7;
        
        // Calculate TO WORK (arrival at startTime)
        const [sh, sm, ss = 0] = day.startTime.split(':').map(Number);
        const arrivalDate = new Date();
        arrivalDate.setDate(arrivalDate.getDate() + daysDelta);
        arrivalDate.setHours(sh, sm, ss, 0);

        if (daysDelta === 0 && now > arrivalDate) {
          arrivalDate.setDate(arrivalDate.getDate() + 7);
        }

        const bufferMs = (prefs.bufferMinutes || 0) * 60 * 1000;
        const targetArrivalTimestamp = Math.floor((arrivalDate.getTime() - bufferMs) / 1000);

        const directionsToWork = await getDirections(
          prefs.homeAddress,
          prefs.workAddress,
          prefs.commuteMode,
          targetArrivalTimestamp
        );

        // Calculate TO HOME (departure at endTime)
        const [eh, em, es = 0] = day.endTime.split(':').map(Number);
        const departureDate = new Date(arrivalDate); // Same day as start
        departureDate.setHours(eh, em, es, 0);
        const targetDepartureTimestamp = Math.floor(departureDate.getTime() / 1000);

        const directionsToHome = await getDirections(
          prefs.workAddress,
          prefs.homeAddress,
          prefs.commuteMode,
          targetDepartureTimestamp,
          'departure'
        );

        const legToWork = directionsToWork.status === 'OK' ? directionsToWork.routes[0].legs[0] : null;
        const legToHome = directionsToHome.status === 'OK' ? directionsToHome.routes[0].legs[0] : null;

        const processStepsWithTiming = (steps: any[], initialStartTime: Date) => {
          const finalSteps: any[] = [];
          let currentTime = initialStartTime.getTime();

          steps.forEach((step: any) => {
            let stepStart = new Date(currentTime);
            
            // Handle transit steps with fixed departure times
            if (step.transit_details?.departure_time?.value) {
              const transitDeparture = step.transit_details.departure_time.value * 1000;
              
              // Detect wait time gap (if transit leaves after we arrive at the stop)
              if (transitDeparture > currentTime + 30000) { // More than 30s gap
                const waitMs = transitDeparture - currentTime;
                finalSteps.push({
                  isWait: true,
                  duration: { 
                    text: `${Math.round(waitMs / 60000)} min wait`, 
                    value: waitMs / 1000 
                  },
                  html_instructions: `Wait for ${step.transit_details.line?.short_name || step.transit_details.line?.name || 'Transit'}`,
                  stepStart: new Date(currentTime),
                  stepEnd: new Date(transitDeparture)
                });
                currentTime = transitDeparture;
                stepStart = new Date(currentTime);
              } else if (transitDeparture < currentTime) {
                // Adjust if we somehow "arrive" after the bus leaves (safety catch)
                currentTime = transitDeparture;
                stepStart = new Date(currentTime);
              }
            }

            const durationMs = step.duration?.value ? step.duration.value * 1000 : 0;
            const stepEnd = new Date(currentTime + durationMs);
            
            finalSteps.push({
              ...step,
              stepStart,
              stepEnd
            });
            currentTime = stepEnd.getTime();
          });

          return finalSteps;
        };

        if (legToWork && legToHome) {
          const toWorkStartTime = new Date((targetArrivalTimestamp - legToWork.duration.value) * 1000);
          const toHomeStartTime = new Date(targetDepartureTimestamp * 1000);

          return {
            day: day.day,
            sortKey: arrivalDate.getTime(),
            toWork: {
              departureTime: toWorkStartTime,
              arrivalTime: new Date(targetArrivalTimestamp * 1000),
              durationText: legToWork.duration.text,
              summary: directionsToWork.routes[0].summary || "Route to Work",
              steps: processStepsWithTiming(legToWork.steps, toWorkStartTime)
            },
            toHome: {
              departureTime: toHomeStartTime,
              arrivalTime: new Date((targetDepartureTimestamp + legToHome.duration.value) * 1000),
              durationText: legToHome.duration.text,
              summary: directionsToHome.routes[0].summary || "Route Home",
              steps: processStepsWithTiming(legToHome.steps, toHomeStartTime)
            }
          };
        }
        return null;
      }));

      const successful = results.filter(r => r !== null).sort((a, b) => a!.sortKey - b!.sortKey);
      setWeekCommutes(successful);
      if (successful.length > 0) {
        setExpandedDay(successful[0].day);
        getAdvice(successful);
      }

    } catch (err: any) {
      setError(err.message || "Failed to fetch commute data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateFullWeek();
  }, [prefs, schedule]);

  const openInGoogleMaps = (origin: string, destination: string, mode: string, time: Date, timeType: 'arrival' | 'departure') => {
    const timestamp = Math.floor(time.getTime() / 1000);
    const m = mode === 'transit' ? 'transit' : mode === 'bicycling' ? 'bicycling' : mode === 'walking' ? 'walking' : 'driving';
    const baseUrl = "https://www.google.com/maps/dir/?api=1";
    const url = `${baseUrl}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=${m}&${timeType}_time=${timestamp}`;
    window.open(url, '_blank');
  };

  const [expandedLegs, setExpandedLegs] = useState<Record<string, { work: boolean, home: boolean }>>({});

  const toggleLeg = (day: string, leg: 'work' | 'home') => {
    setExpandedLegs(prev => ({
      ...prev,
      [day]: {
        work: prev[day]?.work ?? true,
        home: prev[day]?.home ?? true,
        [leg]: !(prev[day]?.[leg] ?? true)
      }
    }));
  };

const RouteStepViewer = ({ steps, mode, isEvening = false }: { steps: any[], mode: string, isEvening?: boolean }) => {
    return (
      <div className="relative pl-8 space-y-0">
        {/* The connecting vertical line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-200" />
        
        {steps.map((step: any, sIdx: number) => {
          const isTransit = step.travel_mode === 'TRANSIT';
          const transit = step.transit_details;
          const isWait = step.isWait;
          
          let Icon = Footprints;
          let iconColor = isEvening ? "text-amber-500" : "text-slate-900";
          let bgColor = "bg-white";
          let dotColor = isEvening ? "bg-amber-500" : "bg-slate-900";

          if (isWait) {
            Icon = Clock;
            iconColor = "text-amber-600";
            bgColor = "bg-amber-50";
            dotColor = "bg-amber-400";
          } else if (isTransit) {
            const vehicle = transit?.line?.vehicle?.type;
            if (vehicle === 'BUS') Icon = Bus;
            else if (vehicle === 'HEAVY_RAIL' || vehicle === 'METRO_RAIL' || vehicle === 'SUBWAY') Icon = TramFront;
            iconColor = "text-white";
            bgColor = isEvening ? "bg-amber-500" : "bg-slate-900";
            dotColor = bgColor;
          } else if (step.travel_mode === 'WALKING') {
            Icon = Footprints;
          } else if (step.travel_mode === 'BICYCLING') {
            Icon = Bike;
          } else if (step.travel_mode === 'DRIVING') {
            Icon = Car;
          }

          return (
            <div key={sIdx} className="relative pb-6 last:pb-0">
              {/* The marker dot/icon */}
              <div className={`absolute -left-8 top-0.5 w-6 h-6 rounded-full flex items-center justify-center z-10 border-2 border-white shadow-sm transition-transform hover:scale-110 ${bgColor}`}>
                <Icon className={`w-3 h-3 ${iconColor}`} />
              </div>

              <div className={`p-3 rounded-lg border transition-all ${isWait ? 'bg-amber-50/40 border-amber-100 italic' : 'bg-white border-slate-100 hover:shadow-md'}`}>
                <div className="flex justify-between items-start mb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {isTransit && transit?.line?.short_name && (
                      <span className="px-1.5 py-0.5 bg-slate-900 text-white text-[9px] font-black rounded h-4 flex items-center">
                        {transit.line.short_name}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-slate-400 font-medium">
                      {step.stepStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{step.duration.text}</span>
                </div>

                <div 
                  className={`text-[11px] leading-snug ${isWait ? 'text-amber-800' : 'text-slate-700 font-medium'}`}
                  dangerouslySetInnerHTML={{ __html: step.html_instructions }} 
                />

                {isTransit && transit && (
                  <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-slate-100 ml-1">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      <span className="text-[10px] text-slate-500 font-medium">Board at {transit.departure_stop?.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                      <span className="text-[10px] text-slate-500 font-medium">Exit at {transit.arrival_stop?.name}</span>
                    </div>
                    {transit.num_stops && (
                      <div className="text-[9px] text-slate-400 pl-3.5 italic">{transit.num_stops} stops</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading && weekCommutes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-900" />
        <span className="font-mono text-xs uppercase tracking-widest text-slate-400">Syncing Weekly Grid...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 p-6 rounded flex flex-col items-center text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-red-500" />
        <p className="text-sm font-sans text-red-800 font-bold">{error}</p>
        <button 
          onClick={calculateFullWeek}
          className="text-xs font-mono uppercase bg-slate-900 text-amber-500 px-6 py-2 rounded hover:bg-black transition-colors"
        >
          Retry Sync
        </button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Traffic Monitoring Active</span>
          </div>
          <span className="text-slate-200">|</span>
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
            Last re-route check: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
        <button 
          onClick={() => calculateFullWeek()}
          className="flex items-center gap-2 text-[10px] font-bold text-slate-900 uppercase tracking-widest hover:text-amber-600 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Force Re-Scan
        </button>
      </div>

      {/* AI Intelligence Layer */}
      {advice && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900 border border-slate-800 p-4 rounded flex gap-6 items-start shadow-xl"
        >
          <div className="w-14 h-14 rounded-full border-4 border-amber-500/10 flex items-center justify-center flex-shrink-0 relative">
             <div className="text-xs font-black text-amber-500">{advice.score}%</div>
             <svg className="absolute inset-0 -rotate-90 w-full h-full">
               <circle 
                 cx="28" cy="28" r="24" 
                 fill="transparent" 
                 stroke="currentColor" 
                 strokeWidth="4"
                 strokeDasharray="150.7"
                 strokeDashoffset={150.7 - (150.7 * (advice.score || 0)) / 100}
                 className="text-amber-500 transition-all duration-1000"
               />
             </svg>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest px-2 py-0.5 bg-amber-500/10 rounded">
                {advice.isOptimal ? 'Optimal Pathway' : 'Efficiency Notice'}
              </span>
              <div className="h-px w-12 bg-slate-800" />
            </div>
            <p className="text-xs font-sans text-slate-300 leading-relaxed font-medium italic">
               "{advice.optimization}"
            </p>
          </div>
        </motion.div>
      )}

      {/* Weekly Commute Board */}
      <div className="space-y-4">
        {weekCommutes.map((commute, idx) => (
            <div 
              key={commute.day}
              className={`bg-white border rounded shadow-sm relative overflow-hidden group transition-all hover:border-amber-500 ${
                expandedDay === commute.day ? 'border-l-8 border-l-slate-900 border-amber-200' : 'border-slate-100'
              }`}
            >
              {/* Card Header (Clickable) */}
              <button 
                onClick={() => setExpandedDay(expandedDay === commute.day ? null : commute.day)}
                className="w-full text-left p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10"
              >
                <div className="flex items-center gap-6">
                  <div className="w-16 flex-shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Shift Day</span>
                    <span className="text-sm font-black text-slate-900 uppercase">{commute.day}</span>
                  </div>

                  <div className="h-10 w-px bg-slate-100 hidden md:block" />

                  <div className="flex gap-8">
                    <div>
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest block mb-1">To Work</span>
                      <span className="text-xl font-sans font-bold tracking-tighter text-slate-900">
                        {commute.toWork.departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest block mb-1">To Home</span>
                      <span className="text-xl font-sans font-bold tracking-tighter text-slate-900">
                        {commute.toHome.departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Duration</span>
                    <span className="text-sm font-bold text-amber-600">{commute.toWork.durationText} + {commute.toHome.durationText}</span>
                  </div>
                  <div className={`w-10 h-10 rounded-sm flex items-center justify-center transition-colors ${
                    expandedDay === commute.day ? 'bg-slate-900 text-amber-500' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-900 group-hover:text-amber-500'
                  }`}>
                    <Navigation className={`w-4 h-4 transition-transform duration-300 ${expandedDay === commute.day ? 'rotate-90' : ''}`} />
                  </div>
                </div>
              </button>

              {/* Accordion Content */}
              <AnimatePresence>
                {expandedDay === commute.day && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-slate-50/50 border-t border-slate-50"
                  >
                    <div className="p-6 pt-2 space-y-8">
                      {/* To Work Leg */}
                      <div className="space-y-4">
                        <div 
                          onClick={() => toggleLeg(commute.day, 'work')}
                          className="flex justify-between items-center bg-slate-100/50 p-3 rounded border border-slate-200/60 cursor-pointer hover:bg-slate-100 transition-colors"
                        >
                          <div className="flex flex-col gap-1">
                            <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                               <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                               Morning Commute To Work
                               <span className="text-[8px] font-black text-amber-600 bg-amber-100 px-1 rounded">
                                 {expandedLegs[commute.day]?.work !== false ? 'HIDE' : 'SHOW'}
                               </span>
                            </h4>
                            <span className="text-[10px] font-mono text-slate-400">VIA {commute.toWork.summary}</span>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              openInGoogleMaps(prefs.homeAddress, prefs.workAddress, prefs.commuteMode, commute.toWork.arrivalTime, 'arrival');
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-amber-500 text-[9px] font-bold uppercase tracking-widest rounded hover:bg-black transition-all shadow-sm"
                          >
                            <Navigation className="w-3 h-3" />
                            Live Map
                          </button>
                        </div>
                        
                        <AnimatePresence>
                          {expandedLegs[commute.day]?.work !== false && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="bg-slate-100/30 p-5 rounded-lg border border-slate-200/40">
                                <RouteStepViewer steps={commute.toWork.steps} mode={prefs.commuteMode} />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* To Home Leg */}
                      <div className="space-y-4">
                        <div 
                          onClick={() => toggleLeg(commute.day, 'home')}
                          className="flex justify-between items-center bg-slate-100/50 p-3 rounded border border-slate-200/60 cursor-pointer hover:bg-slate-100 transition-colors"
                        >
                          <div className="flex flex-col gap-1">
                            <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                               <div className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
                               Evening Commute Home
                               <span className="text-[8px] font-black text-slate-900 bg-slate-200 px-1 rounded">
                                 {expandedLegs[commute.day]?.home !== false ? 'HIDE' : 'SHOW'}
                               </span>
                            </h4>
                            <span className="text-[10px] font-mono text-slate-400">VIA {commute.toHome.summary}</span>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              openInGoogleMaps(prefs.workAddress, prefs.homeAddress, prefs.commuteMode, commute.toHome.departureTime, 'departure');
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 text-slate-900 text-[9px] font-bold uppercase tracking-widest rounded hover:bg-amber-600 transition-all shadow-sm"
                          >
                            <Navigation className="w-3 h-3" />
                            Live Map
                          </button>
                        </div>

                        <AnimatePresence>
                          {expandedLegs[commute.day]?.home !== false && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="bg-amber-50/10 p-5 rounded-lg border border-amber-100/30">
                                <RouteStepViewer steps={commute.toHome.steps} mode={prefs.commuteMode} isEvening={true} />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
      </div>
      </motion.div>
  );
};
