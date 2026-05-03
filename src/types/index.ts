export interface WorkDay {
  day: string;
  enabled: boolean;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

export interface UserPreferences {
  homeAddress: string;
  workAddress: string;
  commuteMode: 'transit' | 'driving' | 'bicycling' | 'walking';
  bufferMinutes: number; // Extra time before work
}

export interface RouteEstimate {
  duration: number; // seconds
  departureTime: number; // unix timestamp
  arrivalTime: number; // unix timestamp
  summary: string;
  steps: any[];
}

export const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];
