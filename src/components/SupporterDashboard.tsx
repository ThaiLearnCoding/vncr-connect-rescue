import React, { useState, useEffect, useRef, useMemo } from 'react';
import { EmergencyRequest } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Layers, Users, Filter, List } from 'lucide-react';

declare global {
  interface Window {
    L: any;
  }
}

interface SupporterDashboardProps {
  requests: EmergencyRequest[];
}

export const SupporterDashboard: React.FC<SupporterDashboardProps> = ({ requests }) => {
  // Filter States
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [isFiltered, setIsFiltered] = useState(false);

  // Map References
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const clusterGroupRef = useRef<any>(null);

  // Extract unique locations for the dropdown
  const uniqueLocations = useMemo(() => {
    const locs = new Set(requests.map(r => r.verifiedLocation));
    return Array.from(locs).sort();
  }, [requests]);

  // Chart data
  const needsCount: Record<string, number> = {};
  requests.forEach(r => {
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
    if (!isFiltered) return []; // Empty if not filtered yet
    return requests.filter(req => {
      const matchesPriority = filterPriority === 'all' || req.priority === filterPriority;
      const matchesLocation = filterLocation === 'all' || req.verifiedLocation === filterLocation;
      return matchesPriority && matchesLocation;
    });
  }, [requests, filterPriority, filterLocation, isFiltered]);

  const handleApplyFilter = () => {
    setIsFiltered(true);
  };

  // Map Initialization and Update
  useEffect(() => {
    if (!mapContainerRef.current || !window.L) return;

    if (!mapInstanceRef.current) {
      const map = window.L.map(mapContainerRef.current).setView([13.088, 109.300], 12); // Default Tuy Hoa, Phu Yen

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      mapInstanceRef.current = map;

      // Initialize MarkerClusterGroup with RED theme logic
      const markers = window.L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 50,
        iconCreateFunction: function (cluster: any) {
          const childMarkers = cluster.getAllChildMarkers();
          let totalPeopleInCluster = 0;
          childMarkers.forEach((m: any) => {
            totalPeopleInCluster += (m.options.peopleCount || 0);
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

          return window.L.divIcon({
            html: `<div class="${colorClass} text-white rounded-full flex items-center justify-center font-bold border-2 border-white/50 shadow-lg backdrop-blur-sm" style="width: ${size}px; height: ${size}px; font-size: ${size / 2.5}px;">${totalPeopleInCluster}</div>`,
            className: 'custom-cluster-icon bg-transparent border-none',
            iconSize: window.L.point(size, size)
          });
        }
      });
      clusterGroupRef.current = markers;
      map.addLayer(markers);
    }

    const clusterGroup = clusterGroupRef.current;
    if (clusterGroup) {
      clusterGroup.clearLayers();

      requests.forEach(req => {
        if (req.coordinates) {
          const { lat, lng } = req.coordinates;
          const peopleCount = req.demographics?.totalPeople || 1;

          // Color Logic based on Priority
          let bgColor = 'bg-blue-500';
          let textColor = 'text-white';
          let borderColor = 'border-white';

          if (req.priority === 'High') {
            bgColor = 'bg-red-600';
          } else if (req.priority === 'Medium') {
            bgColor = 'bg-orange-500';
          } else {
            bgColor = 'bg-yellow-400';
            textColor = 'text-slate-900';
            borderColor = 'border-white';
          }

          // --- BUILD POPUP HTML CONTENT ---
          const childrenCount = (req.demographics.children0to6 || 0) + (req.demographics.children6to14 || 0);
          let demographicsHtml = '';

          if (req.demographics.pregnant > 0) demographicsHtml += `<div class="flex items-center gap-1 text-pink-600 font-semibold text-xs mt-1"><span>• ${req.demographics.pregnant} Mẹ bầu</span></div>`;
          if (childrenCount > 0) demographicsHtml += `<div class="flex items-center gap-1 text-blue-600 font-semibold text-xs mt-1"><span>• ${childrenCount} Trẻ em</span></div>`;
          if (req.demographics.elderly > 0) demographicsHtml += `<div class="flex items-center gap-1 text-slate-600 font-semibold text-xs mt-1"><span>• ${req.demographics.elderly} Người cao tuổi</span></div>`;
          if (req.demographics.injured > 0) demographicsHtml += `<div class="flex items-center gap-1 text-red-600 font-bold text-xs mt-1"><span>• ${req.demographics.injured} Người bị thương</span></div>`;
          if (req.demographics.disabled > 0) demographicsHtml += `<div class="flex items-center gap-1 text-purple-600 font-semibold text-xs mt-1"><span>• ${req.demographics.disabled} Người khuyết tật</span></div>`;

          const popupContent = `
                <div class="p-2 font-sans min-w-[240px]">
                    <h3 class="font-bold text-slate-800 text-base border-b pb-1 mb-2">${req.name}</h3>
                    <div class="flex items-center gap-2 mb-2">
                         <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${req.priority === 'High' ? 'bg-red-100 text-red-700' :
              req.priority === 'Medium' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-800'
            }">Ưu tiên: ${req.priority}</span>
                         <span class="text-sm font-bold text-slate-700 flex items-center">${peopleCount} người</span>
                    </div>
                    
                    <div class="mb-2">
                        <p class="text-xs font-bold text-slate-500 uppercase">Vị trí:</p>
                        <p class="text-sm text-slate-800 leading-tight">${req.verifiedLocation}</p>
                    </div>

                    <div class="mb-2">
                        <p class="text-xs font-bold text-slate-500 uppercase">Cần hỗ trợ:</p>
                        <p class="text-sm text-red-600 font-medium">${req.needs}</p>
                    </div>

                    ${demographicsHtml ? `<div class="bg-slate-50 p-2 rounded mt-2 border border-slate-100">${demographicsHtml}</div>` : ''}

                    <div class="mt-2 text-[10px] text-slate-400 text-right">
                        ${new Date(req.timestamp).toLocaleString('vi-VN')}
                    </div>
                </div>
                `;

          const markerIcon = window.L.divIcon({
            html: `<div class="${bgColor} ${textColor} rounded-full flex items-center justify-center font-bold border-2 ${borderColor} shadow-md transform hover:scale-110 transition-transform" style="width: 30px; height: 30px; font-size: 14px;">${peopleCount}</div>`,
            className: 'custom-pin-marker bg-transparent border-none',
            iconSize: window.L.point(30, 30)
          });

          const marker = window.L.marker([lat, lng], {
            icon: markerIcon,
            peopleCount: peopleCount
          });

          marker.bindPopup(popupContent);
          clusterGroup.addLayer(marker);
        }
      });

      if (requests.length > 0) {
        const bounds = window.L.latLngBounds(requests.map(r => r.coordinates ? [r.coordinates.lat, r.coordinates.lng] : null).filter(Boolean));
        if (bounds.isValid()) {
          mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    }
  }, [requests]);

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-8 animate-fade-in pb-20">

      {/* Map Section */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden relative">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            Bản Đồ Phân Bố Người Cần Hỗ Trợ (Phú Yên)
          </h2>
        </div>

        <div ref={mapContainerRef} className="w-full h-[600px] bg-slate-100 z-0" />
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
              <div className="w-full md:w-1/2">
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
                <div key={req.id} className={`bg-white rounded-xl p-5 shadow-sm border-l-4 transition-all hover:shadow-md ${req.priority === 'High' ? 'border-l-red-500' :
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