import React, { useState, useEffect } from 'react';
import { EmergencyRequest, AppMode, LocationState } from './types';
import { Header } from './components/Header';
import { Landing } from './components/Landing';
import { NeedyForm } from './components/NeedyForm';
import { SupporterDashboard } from './components/SupporterDashboard';

// --- MOCK DATA GENERATOR FOR PHU YEN ---
const generateMockData = (): EmergencyRequest[] => {
  const requests: EmergencyRequest[] = [];

  // Coordinates bounding box for Tuy Hoa & surrounding land (avoiding sea to the East)
  const MIN_LAT = 13.02;
  const MAX_LAT = 13.16;
  const MIN_LNG = 109.18;
  const MAX_LNG = 109.305; // Cap at 109.305 to stay off the beach/ocean

  const locations = [
    "Phường 1, TP. Tuy Hòa", "Phường 2, TP. Tuy Hòa",
    "Phường 3, TP. Tuy Hòa", "Phường 4, TP. Tuy Hòa",
    "Phường 5, TP. Tuy Hòa", "Phường 6, TP. Tuy Hòa",
    "Phường 7, TP. Tuy Hòa", "Phường 8, TP. Tuy Hòa",
    "Phường 9, TP. Tuy Hòa", "Phường Phú Lâm, TP. Tuy Hòa",
    "Phường Phú Thạnh, TP. Tuy Hòa", "Phường Phú Đông, TP. Tuy Hòa",
    "Xã Bình Kiến, TP. Tuy Hòa", "Xã Hòa Kiến, TP. Tuy Hòa",
    "Xã An Phú, TP. Tuy Hòa", "Thị trấn Phú Hòa, Huyện Phú Hòa",
    "Xã Hòa An, Huyện Phú Hòa", "Xã Hòa Thắng, Huyện Phú Hòa",
    "Thị trấn Hòa Vinh, Thị xã Đông Hòa", "Phường Hòa Hiệp Bắc, Thị xã Đông Hòa"
  ];

  const firstNames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương"];
  const middleNames = ["Văn", "Thị", "Hữu", "Đức", "Ngọc", "Minh", "Thanh", "Hoàng", "Quang", "Xuân"];
  const lastNames = ["An", "Bình", "Cường", "Dũng", "Em", "Hương", "Hùng", "Lan", "Mai", "Nam", "Phúc", "Quân", "Sơn", "Thảo", "Tùng", "Vinh", "Hoa", "Trang"];
  const needsList = [
    "Mì tôm, nước sạch", "Cần sơ tán gấp", "Thuốc hạ sốt, men tiêu hóa",
    "Áo phao, đèn pin", "Lương thực khô, nước uống", "Sữa cho em bé, tã lót",
    "Băng gạc y tế, thuốc sát trùng", "Gạo, mắm, muối", "Nước sạch, bánh mì"
  ];

  // 150 requests to hit target of ~500-600 people
  for (let i = 0; i < 150; i++) {
    // Generate safe coordinates on land
    const lat = MIN_LAT + Math.random() * (MAX_LAT - MIN_LAT);
    const lng = MIN_LNG + Math.random() * (MAX_LNG - MIN_LNG);

    // Demographics randomizer (weighted to average ~3-4 people per family)
    const basePeople = Math.floor(Math.random() * 4) + 1; // 1-4 people base
    const hasPregnant = Math.random() > 0.9 ? 1 : 0;
    const hasElderly = Math.random() > 0.7 ? Math.floor(Math.random() * 2) + 1 : 0;
    const hasKids = Math.random() > 0.6 ? Math.floor(Math.random() * 3) + 1 : 0;
    const hasInjured = Math.random() > 0.9 ? 1 : 0;

    const totalPeople = basePeople + hasPregnant + hasElderly + hasKids + hasInjured;

    // Priority calculation logic simulation
    let prio: 'High' | 'Medium' | 'Low' = 'Low';
    if (hasInjured || hasPregnant || totalPeople > 6) prio = 'High';
    else if (hasElderly || hasKids || totalPeople > 4) prio = 'Medium';

    const locString = locations[Math.floor(Math.random() * locations.length)];

    requests.push({
      id: `id-${i}`,
      name: `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${middleNames[Math.floor(Math.random() * middleNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
      phone: `09${Math.floor(Math.random() * 100000000)}`,
      originalLocationInput: locString,
      verifiedLocation: locString,
      coordinates: {
        lat: lat,
        lng: lng
      },
      needs: needsList[Math.floor(Math.random() * needsList.length)],
      stuckDuration: `${Math.floor(Math.random() * 48) + 1} giờ`,
      demographics: {
        totalPeople: totalPeople,
        pregnant: hasPregnant,
        elderly: hasElderly,
        disabled: Math.random() > 0.95 ? 1 : 0,
        injured: hasInjured,
        children0to6: Math.floor(hasKids / 2),
        children6to14: Math.ceil(hasKids / 2)
      },
      timestamp: Date.now() - Math.floor(Math.random() * 172800000), // Last 48 hours
      status: 'pending',
      priority: prio,
      groundingLinks: [],
      aiAnalysis: ""
    });
  }

  return requests;
};

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('landing');

  // Initialize with the mock data set for Phu Yen
  const [requests, setRequests] = useState<EmergencyRequest[]>(() => generateMockData());

  const [showNotification, setShowNotification] = useState(false);
  const [locationState, setLocationState] = useState<LocationState>({
    latitude: null,
    longitude: null,
    error: null
  });

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationState({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            error: null
          });
        },
        (error) => {
          console.warn("Geolocation denied or unavailable", error);
          setLocationState(prev => ({ ...prev, error: "Không thể lấy vị trí GPS" }));
        }
      );
    }
  }, []);

  const handleNewRequest = (req: EmergencyRequest) => {
    setRequests(prev => [req, ...prev]);
    // Stay in Needy mode to confirm processing
    // setMode('supporter'); 
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 5000);
  };

  const handleUpdateRequest = (updatedReq: EmergencyRequest) => {
    setRequests(prev => prev.map(req => req.id === updatedReq.id ? updatedReq : req));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Header mode={mode} setMode={setMode} />

      <main className="container mx-auto py-8">
        {mode === 'landing' && <Landing setMode={setMode} />}

        {mode === 'needy' && (
          <div className="animate-slide-up">
            <NeedyForm onSubmit={handleNewRequest} locationState={locationState} />
          </div>
        )}

        {mode === 'supporter' && (
          <div className="animate-fade-in">
            <SupporterDashboard requests={requests} onUpdateRequest={handleUpdateRequest} />
          </div>
        )}
      </main>

      {showNotification && (
        <div className="fixed bottom-8 right-8 bg-green-600 text-white px-6 py-4 rounded-lg shadow-xl animate-bounce flex items-center z-[500]">
          <span className="font-bold">Đã gửi thành công!</span>
          <span className="ml-2">Đội cứu hộ đã nhận được thông tin.</span>
        </div>
      )}
    </div>
  );
};

export default App;