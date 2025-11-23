import { GroundingChunk, Demographics } from "../types";

// NOTE: This service has been migrated from Gemini AI to OpenStreetMap + Rule-based Logic
// to allow the app to run without an API Key.

interface AnalysisResult {
  text: string;
  groundingChunks: GroundingChunk[];
  priority: 'High' | 'Medium' | 'Low';
  coordinates: { lat: number; lng: number } | null;
}

// 1. Rule-based Priority Calculation
const calculatePriority = (demographics: Demographics, needs: string): 'High' | 'Medium' | 'Low' => {
  const { pregnant, injured, disabled, children0to6, children6to14, elderly } = demographics;
  const needsLower = needs.toLowerCase();

  // High Priority Rules
  if (pregnant > 0 || injured > 0 || disabled > 0 || children0to6 > 0) {
    return 'High';
  }
  const urgentKeywords = ['sơ tán', 'cấp cứu', 'nguy hiểm', 'chảy máu', 'vỡ', 'trôi', 'mái nhà', 'bệnh', 'sắp sinh', 'ngập sâu', 'mắc kẹt'];
  if (urgentKeywords.some(kw => needsLower.includes(kw))) {
    return 'High';
  }

  // Medium Priority Rules
  if (children6to14 > 0 || elderly > 0) {
    return 'Medium';
  }
  const mediumKeywords = ['đói', 'khát', 'hết', 'cạn', 'thuốc', 'gạo', 'nước', 'sữa'];
  if (mediumKeywords.some(kw => needsLower.includes(kw))) {
    return 'Medium';
  }

  // Default Low
  return 'Low';
};

// 2. OpenStreetMap Nominatim API for Reverse Geocoding (Coords -> Address)
const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: { 'User-Agent': 'VNCR-Connect-Rescue/1.0' }
    });
    const data = await response.json();
    return data.display_name || "Vị trí đã định vị từ tọa độ";
  } catch (e) {
    console.error("Reverse geocode failed", e);
    return "";
  }
};

// 3. OpenStreetMap Nominatim API for Forward Geocoding (Search Address -> Coords)
const searchLocation = async (query: string): Promise<{ lat: number, lng: number, display_name: string } | null> => {
  try {
    // Search specifically in Vietnam
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=vn&limit=1`, {
      headers: { 'User-Agent': 'VNCR-Connect-Rescue/1.0' }
    });
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        display_name: data[0].display_name
      };
    }
    return null;
  } catch (e) {
    console.error("Location search failed", e);
    return null;
  }
};

// Helper: Convert DMS to Decimal Degrees
function convertDMSToDD(degrees: number, minutes: number, seconds: number, direction: string): number {
  let dd = degrees + minutes / 60 + seconds / (60 * 60);
  if (direction === "S" || direction === "W") {
    dd = dd * -1;
  }
  return dd;
}

// Helper: Parse Coordinates from Input (Supports Decimal and DMS)
function parseCoordinatesFromInput(input: string): { lat: number, lng: number } | null {
  // A. Try Decimal pattern: 13.123, 109.123
  const decimalRegex = /(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/;
  const decimalMatch = input.match(decimalRegex);
  if (decimalMatch) {
    return { lat: parseFloat(decimalMatch[1]), lng: parseFloat(decimalMatch[2]) };
  }

  // B. Try DMS pattern: 13°02'10.7"N 109°18'48.0"E
  // Improved regex to handle various symbols (degrees, quotes, smart quotes) and spacing
  const dmsRegex = /(\d+)[°º\s]+(\d+)[′'’\s]+(\d+(\.\d+)?)["″”]?\s*([NS])[,;\s]+(\d+)[°º\s]+(\d+)[′'’\s]+(\d+(\.\d+)?)["″”]?\s*([EW])/i;

  const dmsMatch = input.match(dmsRegex);

  if (dmsMatch) {
    const latDeg = parseFloat(dmsMatch[1]);
    const latMin = parseFloat(dmsMatch[2]);
    const latSec = parseFloat(dmsMatch[3]);
    const latDir = dmsMatch[5].toUpperCase();

    const lngDeg = parseFloat(dmsMatch[6]);
    const lngMin = parseFloat(dmsMatch[7]);
    const lngSec = parseFloat(dmsMatch[8]);
    const lngDir = dmsMatch[10].toUpperCase();

    const lat = convertDMSToDD(latDeg, latMin, latSec, latDir);
    const lng = convertDMSToDD(lngDeg, lngMin, lngSec, lngDir);

    return { lat, lng };
  }

  return null;
}

export const analyzeEmergencyReport = async (
  locationInput: string,
  needsInput: string,
  demographics: Demographics,
  userCoords: { lat: number | null; lng: number | null }
): Promise<AnalysisResult> => {

  // A. Determine Priority
  const priority = calculatePriority(demographics, needsInput);

  // B. Determine Coordinates and Verified Location
  let coordinates = null;
  let verifiedLocation = locationInput; // Default fallback to user text

  // STRATEGY: 
  // 1. Check if user EXPLICITLY provided coordinates in text. 
  //    If yes, use them (Override browser GPS, as user might be reporting for others).
  // 2. If no coordinates in text, use Browser GPS if available.
  // 3. Fallback to text search (Nominatim).

  // Step 1: Parse text
  const parsedCoords = parseCoordinatesFromInput(locationInput);

  if (parsedCoords) {
    coordinates = parsedCoords;
    // Get address name from these coordinates
    const address = await reverseGeocode(coordinates.lat, coordinates.lng);
    if (address) verifiedLocation = address;
  }
  // Step 2: Browser GPS
  else if (userCoords.lat && userCoords.lng) {
    coordinates = { lat: userCoords.lat, lng: userCoords.lng };
    const address = await reverseGeocode(userCoords.lat, userCoords.lng);
    if (address) verifiedLocation = address;
  }
  // Step 3: Text Search
  else {
    const searchResult = await searchLocation(locationInput);
    if (searchResult) {
      coordinates = { lat: searchResult.lat, lng: searchResult.lng };
      verifiedLocation = searchResult.display_name;
    }
  }

  // Generate a simple summary string
  const summary = `Yêu cầu hỗ trợ từ ${verifiedLocation}. Mức độ: ${priority}. Nhu cầu: ${needsInput}. Tổng ${demographics.totalPeople} người.`;

  return {
    text: summary,
    groundingChunks: [], // Feature removed (no AI)
    priority,
    coordinates
  };
};

export const generateRegionalSummary = async (): Promise<string> => {
  return "Tính năng tóm tắt AI đang tạm tắt. Vui lòng xem bản đồ và biểu đồ thống kê để phân tích tình hình.";
}

export const findLocationCoordinates = async (query: string): Promise<{ lat: number, lng: number } | null> => {
  // Also try to parse coordinates in the search bar
  const parsed = parseCoordinatesFromInput(query);
  if (parsed) return parsed;

  const result = await searchLocation(query);
  if (result) {
    return { lat: result.lat, lng: result.lng };
  }
  return null;
}