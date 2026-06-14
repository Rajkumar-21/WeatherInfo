import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { GoogleGenAI } from '@google/genai';
import { 
  CloudRain, 
  Thermometer, 
  Wind, 
  Droplets, 
  Sprout, 
  MapPin, 
  Calendar, 
  Loader2,
  ChevronRight,
  TrendingUp,
  Search
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

// Fix Leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface LocationData {
  locationName: string;
  current: {
    temperature: number;
    condition: string;
    rainfall: number;
    humidity: number;
    windSpeed: number;
  };
  forecast: Array<{
    month: string;
    temperature: number;
    rainfall: number;
    cropStage: string;
    description: string;
  }>;
  recommendations: string[];
  suitableCrops: string[];
}

function MapEvents({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMapEvents({});
  useEffect(() => {
    map.flyTo(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function App() {
  const [position, setPosition] = useState<[number, number]>([20.5937, 78.9629]); // Default to India
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'current' | 'forecast' | 'crops'>('current');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const results = await response.json();
      
      if (results && results.length > 0) {
        const { lat, lon } = results[0];
        const newLat = parseFloat(lat);
        const newLng = parseFloat(lon);
        handleLocationSelect(newLat, newLng);
        setSearchQuery('');
      } else {
        setError("Location not found. Please try another search term.");
      }
    } catch (err) {
      setError("Failed to search for location.");
    } finally {
      setIsSearching(false);
    }
  };

  const fetchLocationData = async (lat: number, lng: number) => {
    setLoading(true);
    setError(null);
    try {
      const prompt = `
        You are an expert agricultural meteorologist. I need detailed weather and crop prediction data for the location at Latitude: ${lat}, Longitude: ${lng}.
        Use the googleMaps tool to identify this location, its geography, and typical climate.
        
        Provide a realistic forecast and crop prediction for this specific region.
        Format your ENTIRE response as a single JSON code block (wrapped in \`\`\`json and \`\`\`). Do not include any other text.
        
        The JSON must have exactly this structure:
        {
          "locationName": "Name of the region/city/country",
          "current": {
            "temperature": 25, // in Celsius
            "condition": "Sunny/Cloudy/Rainy etc.",
            "rainfall": 0, // in mm
            "humidity": 60, // percentage
            "windSpeed": 15 // km/h
          },
          "forecast": [
            // Provide 6 months of data starting from the current month
            { "month": "April", "temperature": 26, "rainfall": 50, "cropStage": "Planting", "description": "Good conditions for sowing." }
          ],
          "recommendations": ["Recommendation 1", "Recommendation 2"],
          "suitableCrops": ["Crop 1", "Crop 2"]
        }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: lat,
                longitude: lng
              }
            }
          }
        }
      });

      const text = response.text || '';
      const jsonMatch = text.match(/\`\`\`json\n([\s\S]*?)\n\`\`\`/);
      
      if (jsonMatch && jsonMatch[1]) {
        const parsedData = JSON.parse(jsonMatch[1]);
        setData(parsedData);
      } else {
        // Fallback if the model didn't wrap in markdown properly
        try {
          const parsedData = JSON.parse(text);
          setData(parsedData);
        } catch (e) {
          console.error("Failed to parse JSON:", text);
          throw new Error("Failed to parse the response from the AI.");
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while fetching data.");
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setPosition([lat, lng]);
    fetchLocationData(lat, lng);
  };

  // Fetch initial data for default location
  useEffect(() => {
    fetchLocationData(position[0], position[1]);
  }, []);

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Map Section */}
      <div className="relative flex-1 h-1/2 md:h-full z-0">
        <MapContainer 
          center={position} 
          zoom={5} 
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
          <Marker position={position} />
          <MapEvents onLocationSelect={handleLocationSelect} />
          <MapUpdater center={position} />
        </MapContainer>

        {/* Overlay Search */}
        <div className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 z-[400] w-full max-w-md px-4">
          <form 
            onSubmit={handleSearch}
            className="bg-slate-900/80 backdrop-blur-md p-2 rounded-full border border-slate-700/50 shadow-xl flex items-center gap-2"
          >
            <div className="pl-3 text-slate-400 hidden sm:block">
              <Search className="w-5 h-5" />
            </div>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search location or click map..."
              className="flex-1 bg-transparent border-none outline-none text-slate-100 placeholder:text-slate-500 text-sm font-medium px-2 sm:px-0"
            />
            <button 
              type="submit" 
              disabled={isSearching || !searchQuery.trim()}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors"
            >
              {isSearching ? '...' : 'Search'}
            </button>
          </form>
          <div className="mt-2 text-center hidden sm:block">
            <span className="text-xs font-medium text-white/80 bg-slate-900/60 px-3 py-1 rounded-full backdrop-blur-sm border border-slate-700/50 shadow-sm">
              Click anywhere on the map to analyze location
            </span>
          </div>
        </div>
      </div>

      {/* Sidebar Section */}
      <div className="w-full md:w-[450px] h-1/2 md:h-full bg-slate-900/95 backdrop-blur-xl border-t md:border-t-0 md:border-l border-slate-800 flex flex-col z-10 shadow-2xl relative">
        {loading && (
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
            <p className="text-emerald-400 font-medium animate-pulse">Analyzing geographical data...</p>
          </div>
        )}

        {error && (
          <div className="p-6 m-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400">
            <p className="font-medium mb-1">Analysis Failed</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
        )}

        {data && !error && (
          <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="p-8 pb-6 border-b border-slate-800/50 bg-gradient-to-b from-slate-800/30 to-transparent">
              <h1 className="text-2xl font-semibold tracking-tight mb-2 text-white">{data.locationName}</h1>
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <MapPin className="w-4 h-4" />
                <span>{position[0].toFixed(4)}°, {position[1].toFixed(4)}°</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex p-4 gap-2 border-b border-slate-800/50">
              {(['current', 'forecast', 'crops'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-200 capitalize ${
                    activeTab === tab 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner' 
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Content Area */}
            <div className="p-6 flex-1">
              <AnimatePresence mode="wait">
                {activeTab === 'current' && (
                  <motion.div
                    key="current"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-6xl font-light tracking-tighter text-white">
                          {data.current.temperature}°
                        </p>
                        <p className="text-emerald-400 font-medium mt-2 text-lg">
                          {data.current.condition}
                        </p>
                      </div>
                      <div className="w-24 h-24 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full flex items-center justify-center border border-emerald-500/20">
                        <Thermometer className="w-10 h-10 text-emerald-400" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4">
                      <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50">
                        <div className="flex items-center gap-3 text-slate-400 mb-3">
                          <Droplets className="w-5 h-5 text-blue-400" />
                          <span className="text-sm font-medium">Humidity</span>
                        </div>
                        <p className="text-2xl font-semibold text-white">{data.current.humidity}%</p>
                      </div>
                      <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50">
                        <div className="flex items-center gap-3 text-slate-400 mb-3">
                          <Wind className="w-5 h-5 text-teal-400" />
                          <span className="text-sm font-medium">Wind</span>
                        </div>
                        <p className="text-2xl font-semibold text-white">{data.current.windSpeed} km/h</p>
                      </div>
                      <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 col-span-2">
                        <div className="flex items-center gap-3 text-slate-400 mb-3">
                          <CloudRain className="w-5 h-5 text-indigo-400" />
                          <span className="text-sm font-medium">Rainfall</span>
                        </div>
                        <p className="text-2xl font-semibold text-white">{data.current.rainfall} mm</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'forecast' && (
                  <motion.div
                    key="forecast"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-6 uppercase tracking-wider">6-Month Temperature Trend</h3>
                      <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={data.forecast} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                              itemStyle={{ color: '#e2e8f0' }}
                            />
                            <Area type="monotone" dataKey="temperature" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTemp)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Monthly Breakdown</h3>
                      {data.forecast.map((month, idx) => (
                        <div key={idx} className="bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50 flex items-center justify-between group hover:bg-slate-800/50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-700">
                              <Calendar className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div>
                              <p className="font-medium text-white">{month.month}</p>
                              <p className="text-sm text-slate-400">{month.rainfall}mm rain</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-semibold text-white">{month.temperature}°</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'crops' && (
                  <motion.div
                    key="crops"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                        <Sprout className="w-4 h-4" /> Suitable Crops
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {data.suitableCrops.map((crop, idx) => (
                          <span key={idx} className="px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-sm font-medium">
                            {crop}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" /> Growth Timeline
                      </h3>
                      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-700 before:to-transparent">
                        {data.forecast.map((month, idx) => (
                          <div key={idx} className="relative flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center z-10 shrink-0 mt-1">
                              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                            </div>
                            <div className="flex-1 bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-emerald-400">{month.month}</span>
                                <span className="text-xs font-medium px-2.5 py-1 bg-slate-900 rounded-md text-slate-300 border border-slate-700/50">{month.cropStage}</span>
                              </div>
                              <p className="text-sm text-slate-400 leading-relaxed">{month.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">Expert Recommendations</h3>
                      <div className="space-y-3">
                        {data.recommendations.map((rec, idx) => (
                          <div key={idx} className="flex gap-3 items-start bg-slate-800/20 p-4 rounded-2xl border border-slate-700/30">
                            <ChevronRight className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-slate-300 leading-relaxed">{rec}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
