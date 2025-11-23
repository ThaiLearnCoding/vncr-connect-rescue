export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
    placeAnswerSources?: {
        reviewSnippets?: unknown[];
    };
  };
}

export interface Demographics {
  totalPeople: number;
  pregnant: number;
  elderly: number;
  disabled: number;
  injured: number;
  children0to6: number;
  children6to14: number;
}

export interface EmergencyRequest {
  id: string;
  name: string; // Tên người liên hệ
  phone: string; // Số điện thoại
  originalLocationInput: string;
  verifiedLocation: string; // From Gemini
  coordinates: {
    lat: number;
    lng: number;
  } | null;
  needs: string;
  stuckDuration: string;
  demographics: Demographics;
  timestamp: number;
  status: 'pending' | 'viewed' | 'resolving' | 'resolved';
  priority: 'High' | 'Medium' | 'Low'; // Derived by Gemini
  groundingLinks: GroundingChunk[]; // Map links from Gemini
  aiAnalysis: string; // The text response from Gemini
}

export type AppMode = 'landing' | 'needy' | 'supporter';

export interface LocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
}