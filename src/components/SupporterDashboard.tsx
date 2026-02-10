import React, { useState, useMemo } from 'react';
import { EmergencyRequest } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Layers, Users, Filter, List, CheckCircle, X, PlayCircle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix icons (reusing the same logic from NeedyForm if we wanted, 
// but here we use DivIcon predominantly, except maybe default markers are not used)
// Note: We use DivIcon for everything here so standard markers are not as critical,
// but good to have if we fall back.

// Declare global is not needed anymore if we move away from window.L
// declare global {
//   interface Window {
//     L: any;
//   }
// }

// Helper Component for Map Refresh
const MapRefresher: React.FC = () => {
  const map = useMap();
  React.useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
  }, [map]);
  return null;
};

interface SupporterDashboardProps {
  requests: EmergencyRequest[];
  onUpdateRequest?: (req: EmergencyRequest) => void;
}

export const SupporterDashboard: React.FC<SupporterDashboardProps> = ({ requests, onUpdateRequest }) => {
  // Filter States
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [showResolved, setShowResolved] = useState(false);
  const [isFiltered, setIsFiltered] = useState(false);
  const [targetScrollId, setTargetScrollId] = useState<string | null>(null);

  // Auto-scroll effect when target changes (and list is theoretically updated)
  React.useEffect(() => {
    if (targetScrollId) {
      // Small timeout to allow render cycle to complete if filters just changed
      const timer = setTimeout(() => {
        const element = document.getElementById(`request-card-${targetScrollId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-4', 'ring-indigo-300');
          setTimeout(() => element.classList.remove('ring-4', 'ring-indigo-300'), 2000);
        }
        setTargetScrollId(null);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [targetScrollId, isFiltered, showResolved, filterPriority, filterLocation]); // Re-run if these change while target is pending

  // Rescue Modal State
  const [selectedReqForRescue, setSelectedReqForRescue] = useState<EmergencyRequest | null>(null);
  const [rescueMode, setRescueMode] = useState<'start' | 'finish'>('finish');
  const [rescueForm, setRescueForm] = useState({
    supporterName: '',
    supporterPhone: '',
    peopleRescued: 0,
    notes: ''
  });

  const supporterPhoneRef = React.useRef<HTMLInputElement>(null);

  const handleOpenRescueModal = (req: EmergencyRequest, mode: 'start' | 'finish') => {
    setSelectedReqForRescue(req);
    setRescueMode(mode);
    // Pre-fill people count just in case users want default
    setRescueForm({
      supporterName: '',
      supporterPhone: '',
      peopleRescued: req.demographics.totalPeople || 0,
      notes: ''
    });
  };

  const handleRescueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReqForRescue || !onUpdateRequest) return;

    // Phone Validation
    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(rescueForm.supporterPhone)) {
      if (supporterPhoneRef.current) {
        supporterPhoneRef.current.setCustomValidity("Số điện thoại không hợp lệ! Phải bắt đầu bằng số 0 và có 10 chữ số.");
        supporterPhoneRef.current.reportValidity();
      }
      return;
    }

    if (rescueMode === 'start') {
      const updatedReq: EmergencyRequest = {
        ...selectedReqForRescue,
        status: 'resolving',
        rescueInfo: {
          supporterName: rescueForm.supporterName,
          supporterPhone: rescueForm.supporterPhone,
          peopleRescued: 0, // Not rescued yet
          timestamp: Date.now(),
          notes: "Đang tiếp cận hiện trường..."
        }
      };
      onUpdateRequest(updatedReq);
    } else {
      const updatedReq: EmergencyRequest = {
        ...selectedReqForRescue,
        status: 'resolved',
        rescueInfo: {
          supporterName: rescueForm.supporterName,
          supporterPhone: rescueForm.supporterPhone,
          peopleRescued: Number(rescueForm.peopleRescued),
          timestamp: Date.now(),
          notes: rescueForm.notes
        }
      };
      onUpdateRequest(updatedReq);
    }

    setSelectedReqForRescue(null); // Close modal
  };

  // Extract unique locations for the dropdown
  const uniqueLocations = useMemo(() => {
    const locs = new Set(requests.map(r => r.verifiedLocation));
    return Array.from(locs).sort();
  }, [requests]);

  // Chart data
  const needsCount: Record<string, number> = {};
  requests.filter(r => r.status !== 'resolved').forEach(r => {
    const n = r.needs.toLowerCase();
    let category = "Khác";
    if (n.includes("mì") || n.includes("gạo") || n.includes("ăn") || n.includes("lương thực")) category = "Thực phẩm";
    else if (n.includes("nước") || n.includes("uống")) category = "Nước uống";
    else if (n.includes("thuốc") || n.includes("y tế") || n.includes("băng")) category = "Y tế";
    else if (n.includes("xuồng") || n.includes("thuyền") || n.includes("cứu") || n.includes("sơ tán")) category = "Sơ tán";
    else if (n.includes("áo") || n.includes("đèn")) category = "Vật dụng";

    needsCount[category] = (needsCount[category] || 0) + 1;
  });
  const chartData = Object.entries(needsCount).map(([name, value]) => ({ name, value }));
  const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  // Filtered Data for LIST view
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      // 1. Resolve State Filter
      if (!showResolved && req.status === 'resolved') return false;
      if (showResolved && req.status !== 'resolved') return false;

      // 2. UI Filters (only apply if isFiltered is true)
      if (isFiltered) {
        const matchesPriority = filterPriority === 'all' || req.priority === filterPriority;
        const matchesLocation = filterLocation === 'all' || req.verifiedLocation === filterLocation;
        return matchesPriority && matchesLocation;
      }
      return true;
    });
  }, [requests, filterPriority, filterLocation, isFiltered, showResolved]);

  const handleApplyFilter = () => {
    setIsFiltered(true);
  };

  // Helper to create cluster icon
  const createClusterCustomIcon = (cluster: any) => {
    const childMarkers = cluster.getAllChildMarkers();
    let totalPeopleInCluster = 0;
    // Inspect child properties (React-leaflet-cluster preserves props? Or we access options?)
    // childMarkers are internal Leaflet markers. We need to pass data through options.
    // However, react-leaflet renders components.
    // The standard MarkerClusterGroup uses basic L.Marker. 
    // We'll see if we can get totalPeople from attached data.
    // Actually, getting data out of child markers in React Leaflet Cluster custom icon function is tricky 
    // because the markers are created by React.

    // Simplification: Count number of markers (families).
    // Or if we can access the 'options' or 'props' of the marker.
    // In L.Marker created by react-leaflet, options might contain what we passed.

    // Let's iterate using simple count first, or try to access options.peopleCount if we can inject it.
    // We can inject it using `eventHandlers` or `icon` options? No.
    // We can use the native "title" or "alt" for data passing if desperate, but let's try direct property access used in the old code.
    // The old code: `totalPeopleInCluster += (m.options.peopleCount || 0);`
    // We can pass `peopleCount` prop to Marker? React-leaflet Marker props are passed to options? YES, extra props are passed to options.

    childMarkers.forEach((m: any) => {
      // Accessing options passed to the marker
      // specific custom props might not be passed through by react-leaflet, 
      // so we use 'title' as a reliable data vessel.
      if (m.options.title) {
        totalPeopleInCluster += parseInt(m.options.title);
      } else {
        totalPeopleInCluster += 1;
      }
    });

    let size = 40;
    let colorClass = "bg-red-400/90";

    if (totalPeopleInCluster > 50) {
      size = 60;
      colorClass = "bg-red-800/95";
    } else if (totalPeopleInCluster > 10) {
      size = 50;
      colorClass = "bg-red-600/90";
    }

    return L.divIcon({
      html: `<div class="${colorClass} text-white rounded-full flex items-center justify-center font-bold border-2 border-white/50 shadow-lg backdrop-blur-sm" style="width: ${size}px; height: ${size}px; font-size: ${size / 2.5}px;">${totalPeopleInCluster}</div>`,
      className: 'custom-cluster-icon bg-transparent border-none',
      iconSize: L.point(size, size)
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-8 animate-fade-in pb-20 relative">

      {/* Rescue Modal */}
      {selectedReqForRescue && (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up">
            <div className={`${rescueMode === 'start' ? 'bg-blue-600' : 'bg-green-600'} p-4 flex justify-between items-center text-white`}>
              <h3 className="font-bold text-lg flex items-center gap-2">
                {rescueMode === 'start' ? <PlayCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                {rescueMode === 'start' ? 'Xác Nhận Cứu Hộ (Tiếp cận)' : 'Báo Cáo Cứu Hộ Thành Công'}
              </h3>
              <button onClick={() => setSelectedReqForRescue(null)} className="hover:bg-white/20 p-1 rounded"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleRescueSubmit} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded border border-slate-200 text-sm">
                <span className="font-bold text-slate-700">Đang cứu hộ cho:</span> {selectedReqForRescue.name}
                <br />
                <span className="font-bold text-slate-700">Tại:</span> {selectedReqForRescue.verifiedLocation}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Tên người/đội cứu hộ</label>
                <input required className="w-full p-2 border rounded" placeholder="VD: Đội Cứu Hộ Số 1"
                  value={rescueForm.supporterName}
                  onChange={e => setRescueForm({ ...rescueForm, supporterName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Số điện thoại liên hệ</label>
                <input
                  required
                  type="tel"
                  ref={supporterPhoneRef}
                  className="w-full p-2 border rounded"
                  placeholder="09xxxx..."
                  value={rescueForm.supporterPhone}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                  onChange={e => setRescueForm({ ...rescueForm, supporterPhone: e.target.value })}
                />
              </div>

              {rescueMode === 'finish' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Số người đã cứu được</label>
                  <input required type="number" min="1" className="w-full p-2 border rounded font-bold text-lg"
                    value={rescueForm.peopleRescued}
                    onChange={e => setRescueForm({ ...rescueForm, peopleRescued: Number(e.target.value) })}
                  />
                </div>
              )}

              {rescueMode === 'finish' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Ghi chú thêm</label>
                  <textarea className="w-full p-2 border rounded" placeholder="Tình trạng nạn nhân, nơi đưa về..."
                    rows={2}
                    value={rescueForm.notes}
                    onChange={e => setRescueForm({ ...rescueForm, notes: e.target.value })}
                  />
                </div>
              )}

              <button type="submit" className={`w-full py-3 ${rescueMode === 'start' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'} text-white font-bold rounded-lg transition shadow-lg mt-2`}>
                {rescueMode === 'start' ? 'Bắt Đầu Di Chuyển / Cứu Hộ' : 'Xác Nhận Đã Cứu Xong'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Map Section */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden relative">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            Bản Đồ Phân Bố Người Cần Hỗ Trợ (Phú Yên)
          </h2>
        </div>

        <div className="w-full h-[600px] bg-slate-100 z-0">
          <MapContainer
            center={[13.088, 109.300]}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
          >
            <MapRefresher />
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MarkerClusterGroup
              chunkedLoading
              iconCreateFunction={createClusterCustomIcon}
              showCoverageOnHover={false}
              maxClusterRadius={50}
            >
              {requests.map(req => {
                if (!req.coordinates) return null;
                const peopleCount = req.demographics?.totalPeople || 1;

                // Color Logic
                let bgColor = 'bg-blue-500';
                let textColor = 'text-white';
                let borderColor = 'border-white';

                if (req.status === 'resolved') {
                  bgColor = 'bg-green-500';
                } else if (req.status === 'resolving') {
                  bgColor = 'bg-blue-500';
                } else if (req.priority === 'High') {
                  bgColor = 'bg-red-600';
                } else if (req.priority === 'Medium') {
                  bgColor = 'bg-orange-500';
                } else {
                  bgColor = 'bg-yellow-400';
                  textColor = 'text-slate-900';
                }

                const customIcon = L.divIcon({
                  html: `<div class="${bgColor} ${textColor} rounded-full flex items-center justify-center font-bold border-2 ${borderColor} shadow-md transform hover:scale-110 transition-transform" style="width: 30px; height: 30px; font-size: 14px;">${peopleCount}</div>`,
                  className: 'custom-pin-marker bg-transparent border-none',
                  iconSize: [30, 30]
                });

                return (
                  <Marker
                    key={req.id}
                    position={[req.coordinates.lat, req.coordinates.lng]}
                    icon={customIcon}
                    // Pass peopleCount via title for clustering calculation
                    title={peopleCount.toString()}
                  >
                    <Popup>
                      <div className="p-2 font-sans min-w-[240px]">
                        <h3 className="font-bold text-slate-800 text-base border-b pb-1 mb-2">{req.name}</h3>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${req.priority === 'High' ? 'bg-red-100 text-red-700' :
                            req.priority === 'Medium' ? 'bg-orange-100 text-orange-700' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                            Ưu tiên: {req.priority}
                          </span>
                          <span className="text-sm font-bold text-slate-700 flex items-center">{peopleCount} người</span>
                        </div>

                        <div className="mb-2">
                          <p className="text-xs font-bold text-slate-500 uppercase">Vị trí:</p>
                          <p className="text-sm text-slate-800 leading-tight">{req.verifiedLocation}</p>
                        </div>

                        <div className="mb-2">
                          <p className="text-xs font-bold text-slate-500 uppercase">Cần hỗ trợ:</p>
                          <p className="text-sm text-red-600 font-medium">{req.needs}</p>
                        </div>

                        {(req.images?.length || 0) > 0 && (
                          <div className="mb-2">
                            <p className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded inline-block border border-indigo-100">
                              📷 Có {req.images?.length} ảnh đính kèm
                            </p>
                          </div>
                        )}

                        <div className="bg-slate-50 p-2 rounded mt-2 border border-slate-100 grid grid-cols-1 gap-1">
                          {req.demographics.pregnant > 0 && <div className="text-pink-600 font-semibold text-xs">• {req.demographics.pregnant} Mẹ bầu</div>}
                          {(req.demographics.children0to6 + req.demographics.children6to14) > 0 && <div className="text-blue-600 font-semibold text-xs">• {(req.demographics.children0to6 + req.demographics.children6to14)} Trẻ em</div>}
                          {req.demographics.elderly > 0 && <div className="text-slate-600 font-semibold text-xs">• {req.demographics.elderly} Người cao tuổi</div>}
                          {req.demographics.injured > 0 && <div className="text-red-600 font-bold text-xs">• {req.demographics.injured} Người bị thương</div>}
                          {req.demographics.disabled > 0 && <div className="text-purple-600 font-semibold text-xs">• {req.demographics.disabled} Người khuyết tật</div>}
                        </div>

                        {req.status !== 'resolved' ? (
                          <div className="mt-2 text-[10px] text-right">
                            {req.status === 'resolving' && <span className="text-blue-600 font-bold mr-2">🔵 Đang có người đến cứu...</span>}
                            <span className="text-slate-400">{new Date(req.timestamp).toLocaleString('vi-VN')}</span>
                          </div>
                        ) : (
                          <div className="mt-2 text-[10px] text-slate-400 text-right">
                            {new Date(req.timestamp).toLocaleString('vi-VN')}
                          </div>
                        )}

                        <button
                          onClick={() => {
                            // Check if element exists currently
                            const element = document.getElementById(`request-card-${req.id}`);

                            if (element) {
                              // If visible, just scroll
                              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              element.classList.add('ring-4', 'ring-indigo-300');
                              setTimeout(() => element.classList.remove('ring-4', 'ring-indigo-300'), 2000);
                            } else {
                              // If not visible, force filters to show it
                              setFilterPriority('all');
                              setFilterLocation('all');
                              // If it's resolved but we hid resolved, show them.
                              // If it's NOT resolved but we checked "Show only resolved" (if that was the logic), toggle.
                              // Our current logic: showResolved checkbox means "Show Rescued Cases".
                              // If req is resolved, showResolved MUST be true.
                              // If req is NOT resolved, showResolved depends on filter logic.
                              // Actually, the filter says:
                              // if (!showResolved && req.status === 'resolved') return false; (Hides resolved)
                              // if (showResolved && req.status !== 'resolved') return false;  (Hides pending) => Wait, this means Is strictly Toggle?

                              if (req.status === 'resolved') {
                                setShowResolved(true);
                              } else {
                                setShowResolved(false);
                              }

                              setIsFiltered(true); // Force list to show
                              setTargetScrollId(req.id); // Queue scroll
                            }
                          }}
                          className="w-full mt-2 py-1.5 bg-white text-indigo-600 border border-indigo-600 text-xs font-bold rounded flex items-center justify-center gap-1 hover:bg-indigo-50 transition"
                        >
                          <List className="w-3 h-3" /> Xem chi tiết
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MarkerClusterGroup>
          </MapContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Main Feed with Filter */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="w-full md:w-1/3">
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Mức độ ưu tiên</label>
                <select
                  className="w-full p-2 rounded border border-slate-300 text-sm"
                  value={filterPriority}
                  onChange={(e) => { setFilterPriority(e.target.value); setIsFiltered(false); }}
                >
                  <option value="all">Tất cả</option>
                  <option value="High">Cao (Nguy hiểm)</option>
                  <option value="Medium">Trung bình</option>
                  <option value="Low">Thấp</option>
                </select>
              </div>

              <div className="flex items-center pt-5 pl-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 text-sm">
                  <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    checked={showResolved}
                    onChange={(e) => setShowResolved(e.target.checked)}
                  />
                  Hiển thị ca đã cứu
                </label>
              </div>

              <div className="w-full md:w-1/3">
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Khu vực (Phường/Xã)</label>
                <select
                  className="w-full p-2 rounded border border-slate-300 text-sm"
                  value={filterLocation}
                  onChange={(e) => { setFilterLocation(e.target.value); setIsFiltered(false); }}
                >
                  <option value="all">Tất cả khu vực</option>
                  {uniqueLocations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleApplyFilter}
                className="w-full md:w-auto px-6 py-2 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2"
              >
                <Filter className="w-4 h-4" /> Lọc Danh Sách
              </button>
            </div>
          </div>

          {!isFiltered ? (
            <div className="p-12 bg-slate-100 rounded-xl border border-dashed border-slate-300 text-center">
              <List className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Vui lòng chọn bộ lọc và nhấn "Lọc Danh Sách" để xem chi tiết các trường hợp hỗ trợ.</p>
              <p className="text-slate-400 text-sm mt-1">Bản đồ phía trên hiển thị tổng quan tất cả các điểm nóng.</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-12 bg-white rounded-xl border border-dashed border-slate-300 text-center text-slate-500">
              Không tìm thấy kết quả phù hợp với bộ lọc.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-700">Kết quả: {filteredRequests.length} trường hợp</h3>
              </div>
              {filteredRequests.map(req => (
                <div id={`request-card-${req.id}`} key={req.id} className={`bg-white rounded-xl p-5 shadow-sm border-l-4 transition-all hover:shadow-md ${req.priority === 'High' ? 'border-l-red-500' :
                  req.priority === 'Medium' ? 'border-l-orange-500' : 'border-l-yellow-400'
                  }`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-lg text-slate-800">{req.name}</h4>
                      <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                        <span className="flex items-center gap-1 font-bold bg-slate-100 px-2 py-1 rounded text-slate-700"><Users className="w-3 h-3" /> {req.demographics.totalPeople} người</span>
                        <span className="text-slate-400">|</span>
                        <span>{req.phone}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${req.priority === 'High' ? 'bg-red-100 text-red-700' :
                      req.priority === 'Medium' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                      Ưu tiên {req.priority}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm text-slate-700 border-t border-slate-100 pt-3">
                    <p><span className="font-semibold text-slate-500">Vị trí:</span> {req.verifiedLocation}</p>
                    <p><span className="font-semibold text-slate-500">Mắc kẹt:</span> {req.stuckDuration}</p>
                    <div className="col-span-1 md:col-span-2">
                      <span className="font-semibold text-slate-500">Cần hỗ trợ:</span>
                      <span className="ml-1 font-medium text-red-600">{req.needs}</span>
                    </div>
                  </div>

                  {/* Clean Demographics Bar */}
                  <div className="flex flex-wrap gap-3 text-xs mt-3 bg-slate-50 p-2 rounded">
                    {req.demographics.pregnant > 0 && <span className="text-pink-700 font-semibold px-2 py-0.5 bg-pink-100 rounded">Bà bầu: {req.demographics.pregnant}</span>}
                    {(req.demographics.children0to6 + req.demographics.children6to14) > 0 && <span className="text-blue-700 font-semibold px-2 py-0.5 bg-blue-100 rounded">Trẻ em: {req.demographics.children0to6 + req.demographics.children6to14}</span>}
                    {req.demographics.elderly > 0 && <span className="text-slate-700 font-semibold px-2 py-0.5 bg-slate-200 rounded">Người già: {req.demographics.elderly}</span>}
                    {req.demographics.injured > 0 && <span className="text-red-700 font-semibold px-2 py-0.5 bg-red-100 rounded">Bị thương: {req.demographics.injured}</span>}
                    {req.demographics.disabled > 0 && <span className="text-purple-700 font-semibold px-2 py-0.5 bg-purple-100 rounded">Khuyết tật: {req.demographics.disabled}</span>}
                  </div>

                  {req.notes && (
                    <div className="mt-3 bg-yellow-50 p-3 rounded border border-yellow-200 text-sm text-yellow-900 icon-text relative">
                      <span className="font-bold block text-xs uppercase mb-1 text-yellow-700">Ghi chú từ người dân:</span>
                      "{req.notes}"
                    </div>
                  )}

                  {req.images && req.images.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Hình ảnh hiện trường:</p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {req.images.map((img, idx) => (
                          <img key={idx} src={img} loading="lazy" alt={`Evidence ${idx}`} className="h-20 w-20 object-cover rounded-lg border border-slate-200 flex-shrink-0" />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end gap-2">
                    {req.status === 'pending' && (
                      <button
                        onClick={() => handleOpenRescueModal(req, 'start')}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded flex items-center gap-2 hover:bg-blue-700 transition shadow-sm"
                      >
                        <PlayCircle className="w-4 h-4" /> Bắt đầu cứu hộ
                      </button>
                    )}

                    {req.status === 'resolving' && (
                      <div className="flex gap-2 w-full justify-between items-center">
                        <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded border border-blue-100 animate-pulse">
                          🔵 Đang được cứu bởi: {req.rescueInfo?.supporterName}
                        </span>
                        <button
                          onClick={() => handleOpenRescueModal(req, 'finish')}
                          className="px-4 py-2 bg-green-600 text-white text-sm font-bold rounded flex items-center gap-2 hover:bg-green-700 transition shadow-sm"
                        >
                          <CheckCircle className="w-4 h-4" /> Xác nhận đã cứu xong
                        </button>
                      </div>
                    )}

                    {req.status === 'resolved' && (
                      <div className="px-4 py-2 bg-green-100 text-green-700 text-sm font-bold rounded flex items-center gap-2 border border-green-200">
                        <CheckCircle className="w-4 h-4" /> Đã được cứu bởi {req.rescueInfo?.supporterName}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: Analytics */}
        <div className="space-y-6">
          {/* Needs Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Phân loại Nhu cầu</h3>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} interval={0} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};