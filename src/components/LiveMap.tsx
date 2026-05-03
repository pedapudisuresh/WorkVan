import React, { useEffect, useRef, useState } from 'react';

interface LiveMapProps {
  center: { lat: number; lng: number };
  busLocations: any[];
  zoom?: number;
}

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

export const LiveMap: React.FC<LiveMapProps> = ({ center, busLocations, zoom = 12 }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMap = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    if (window.google && window.google.maps) {
      setIsLoaded(true);
      return;
    }

    // Check if script is already injected and loading
    const existingScript = document.querySelector(`script[src*="maps.googleapis.com/maps/api/js"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => setIsLoaded(true));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&v=beta`;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsLoaded(true);
    document.head.appendChild(script);

    return () => {
      // Keep script but maybe cleanup map instance if needed
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    if (!googleMap.current) {
      googleMap.current = new window.google.maps.Map(mapRef.current, {
        center,
        zoom,
        styles: [
          {
            "featureType": "all",
            "elementType": "labels.text.fill",
            "stylers": [{"color": "#ffffff"}]
          },
          {
            "featureType": "all",
            "elementType": "labels.text.stroke",
            "stylers": [{"color": "#000000"}, {"lightness": 13}]
          },
          {
            "featureType": "administrative",
            "elementType": "geometry.fill",
            "stylers": [{"color": "#000000"}]
          },
          {
            "featureType": "administrative",
            "elementType": "geometry.stroke",
            "stylers": [{"color": "#144b53"}, {"lightness": 14}, {"weight": 1.4}]
          },
          {
            "featureType": "landscape",
            "elementType": "all",
            "stylers": [{"color": "#08304b"}]
          },
          {
            "featureType": "poi",
            "elementType": "geometry",
            "stylers": [{"color": "#0c4152"}, {"lightness": 5}]
          },
          {
            "featureType": "road.highway",
            "elementType": "geometry.fill",
            "stylers": [{"color": "#000000"}]
          },
          {
            "featureType": "road.highway",
            "elementType": "geometry.stroke",
            "stylers": [{"color": "#0b434f"}, {"lightness": 25}]
          },
          {
            "featureType": "road.arterial",
            "elementType": "geometry.fill",
            "stylers": [{"color": "#000000"}]
          },
          {
            "featureType": "road.arterial",
            "elementType": "geometry.stroke",
            "stylers": [{"color": "#0b3d51"}, {"lightness": 16}]
          },
          {
            "featureType": "road.local",
            "elementType": "geometry",
            "stylers": [{"color": "#000000"}]
          },
          {
            "featureType": "transit",
            "elementType": "all",
            "stylers": [{"color": "#146474"}]
          },
          {
            "featureType": "water",
            "elementType": "all",
            "stylers": [{"color": "#021019"}]
          }
        ]
      });
    } else {
      googleMap.current.setCenter(center);
    }
  }, [isLoaded, center, zoom]);

  useEffect(() => {
    if (!isLoaded || !googleMap.current) return;

    // Clear old markers
    markers.current.forEach(m => m.setMap(null));
    markers.current = [];

    // Add bus markers
    busLocations.forEach(bus => {
      const marker = new window.google.maps.Marker({
        position: { lat: bus.Latitude, lng: bus.Longitude },
        map: googleMap.current,
        title: `Bus ${bus.VehicleNo} - Route ${bus.RouteNo}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: '#F59E0B',
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#FFFFFF',
          scale: 8
        },
        label: {
          text: bus.RouteNo,
          color: 'white',
          fontSize: '10px',
          fontWeight: 'bold'
        }
      });
      markers.current.push(marker);
    });
  }, [isLoaded, busLocations]);

  return (
    <div 
      ref={mapRef} 
      className="w-full h-[400px] rounded border border-slate-700 bg-slate-900 overflow-hidden shadow-inner"
    />
  );
};
