import { WorkDay, UserPreferences, RouteEstimate } from '../types';

export async function getDirections(
  origin: string,
  destination: string,
  mode: string,
  time?: number,
  timeType: 'arrival' | 'departure' = 'arrival'
): Promise<any> {
  const params = new URLSearchParams({ 
    origin, 
    destination, 
    mode,
    alternatives: 'true' 
  });
  
  if (time) {
    params.append(timeType === 'arrival' ? 'arrival_time' : 'departure_time', time.toString());
  }
  
  const response = await fetch(`/api/directions?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch directions');
  }
  return response.json();
}

export async function getTranslinkEstimates(stopNo: string): Promise<any> {
  const response = await fetch(`/api/translink/stops/${stopNo}/estimates`);
  if (!response.ok) {
    throw new Error('Failed to fetch Translink estimates');
  }
  return response.json();
}
