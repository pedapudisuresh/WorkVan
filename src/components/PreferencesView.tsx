import React, { useState, useEffect, useCallback } from 'react';
import { UserPreferences } from '../types';
import { MapPin, Bus, Car, Bike, Info, Search, Save, Check } from 'lucide-react';

interface PreferencesViewProps {
  prefs: UserPreferences;
  onUpdate: (prefs: UserPreferences) => void;
}

const AddressAutocomplete: React.FC<{
  label: string;
  value: string;
  placeholder: string;
  onChange: (val: string) => void;
}> = ({ label, value, placeholder, onChange }) => {
  const [input, setInput] = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setInput(value);
  }, [value]);

  const fetchSuggestions = useCallback(async (text: string) => {
    if (text.length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      const resp = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(text)}`);
      const data = await resp.json();
      if (data.predictions) {
        setSuggestions(data.predictions);
        setIsOpen(true);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    fetchSuggestions(val);
    if (!val) setIsOpen(false);
  };

  const selectSuggestion = (desc: string) => {
    setInput(desc);
    onChange(desc);
    setIsOpen(false);
  };

  return (
    <div className="space-y-2 relative">
      <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-2">
        <MapPin className="w-3 h-3" /> {label}
      </label>
      <div className="relative">
        <input 
          type="text"
          placeholder={placeholder}
          value={input}
          onChange={handleInputChange}
          onFocus={() => input.length >= 3 && setIsOpen(true)}
          className="w-full text-sm border-b-2 border-slate-100 py-2 focus:border-amber-500 transition-colors outline-none font-medium pr-8"
        />
        <Search className="absolute right-2 top-2.5 w-3.5 h-3.5 text-slate-300" />
      </div>
      
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 shadow-xl rounded overflow-hidden">
          {suggestions.map((s: any) => (
            <button
              key={s.place_id}
              onClick={() => selectSuggestion(s.description)}
              className="w-full text-left px-4 py-3 text-xs hover:bg-slate-50 border-b border-slate-50 last:border-0 truncate"
            >
              {s.description}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const PreferencesView: React.FC<PreferencesViewProps> = ({ prefs, onUpdate }) => {
  const [localPrefs, setLocalPrefs] = useState<UserPreferences>(prefs);
  const [isSaved, setIsSaved] = useState(false);

  // Keep local state in sync if parent prefs change (e.g. on mount or reset)
  useEffect(() => {
    setLocalPrefs(prefs);
  }, [prefs]);

  const updateField = (field: keyof UserPreferences, value: any) => {
    setLocalPrefs(prev => ({ ...prev, [field]: value }));
    setIsSaved(false); // Reset saved status on change
  };

  const handleSave = () => {
    onUpdate(localPrefs);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000); // Clear feedback after 3s
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <AddressAutocomplete 
          label="Home Origin"
          placeholder="2455 E 12th Ave, Vancouver"
          value={localPrefs.homeAddress}
          onChange={(val) => updateField('homeAddress', val)}
        />

        <AddressAutocomplete 
          label="Work Destination"
          placeholder="Waterfront Station, Downtown"
          value={localPrefs.workAddress}
          onChange={(val) => updateField('workAddress', val)}
        />
      </div>

      <div className="space-y-4">
        <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-4">Commute Mode</label>
        <div className="grid grid-cols-4 gap-3">
          {[
            { id: 'transit', label: 'Transit', icon: Bus },
            { id: 'driving', label: 'Driving', icon: Car },
            { id: 'bicycling', label: 'Biking', icon: Bike },
            { id: 'walking', label: 'Walking', icon: Info },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => updateField('commuteMode', mode.id)}
              className={`flex flex-col items-center justify-center p-4 rounded transition-all border ${
                localPrefs.commuteMode === mode.id
                  ? 'bg-slate-900 text-amber-500 border-slate-900 shadow-lg'
                  : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'
              }`}
            >
              <mode.icon className="w-5 h-5 mb-2" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{mode.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-100 p-6 rounded space-y-4">
        <div className="flex items-center gap-4">
          <input 
            type="number"
            min="0"
            max="120"
            value={localPrefs.bufferMinutes}
            onChange={(e) => updateField('bufferMinutes', parseInt(e.target.value) || 0)}
            className="w-20 font-mono text-sm font-bold text-amber-600 bg-white border border-slate-200 rounded px-3 py-1.5 focus:border-amber-500 outline-none"
          />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Minutes Buffer</span>
        </div>
        <p className="text-[10px] text-slate-400 font-medium italic">Geometric safety margin for consistent scheduling.</p>
      </div>

      <div className="pt-4 flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaved}
          className={`flex items-center gap-2 px-6 py-3 rounded font-bold uppercase tracking-widest text-xs transition-all shadow-sm ${
            isSaved 
              ? 'bg-green-500 text-white cursor-default' 
              : 'bg-amber-500 text-slate-900 hover:bg-amber-400 active:scale-95'
          }`}
        >
          {isSaved ? (
            <>
              <Check className="w-4 h-4" />
              Saved Profile
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Preferences
            </>
          )}
        </button>
      </div>
    </div>
  );
};

