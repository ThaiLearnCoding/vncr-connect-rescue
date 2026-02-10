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
  needyName?: string; // Tên cụ thể của người cần cứu (nếu khác người báo tin)
}

export interface RescueInfo {
  supporterName: string;
  supporterPhone: string;
  peopleRescued: number;
  timestamp: number;
  notes?: string;
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
  images?: string[]; // Base64 of uploaded images
  rescueInfo?: RescueInfo; // Thông tin cứu hộ sau khi hoàn thành
  notes?: string; // Ghi chú thêm từ người cần cứu
}

export type AppMode = 'landing' | 'needy' | 'supporter';

export interface LocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
}