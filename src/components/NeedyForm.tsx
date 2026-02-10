import React, { useState, useEffect, useRef } from 'react';
import { EmergencyRequest, LocationState, Demographics } from '../types';
import { analyzeEmergencyReport } from '../services/geminiService';
import { Loader2, Navigation, Clock, MessageSquare, Phone, Users, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Custom Map Pin Icon (Matching Supporter Dashboard style)
const createPinIcon = () => {
  return L.divIcon({
    html: `<div class="bg-red-600 text-white rounded-full flex items-center justify-center border-2 border-white shadow-lg animate-bounce" style="width: 32px; height: 32px;">
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
           </div>`,
    className: 'custom-pin-icon bg-transparent border-none',
    iconSize: [32, 42],
    iconAnchor: [16, 42]
  });
};

interface LocationMarkerProps {
  position: { lat: number; lng: number } | null;
  setPosition: (pos: { lat: number; lng: number }) => void;
}

const LocationMarker: React.FC<LocationMarkerProps> = ({ position, setPosition }) => {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, map.getZoom());
    }
  }, [map]);

  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position ? <Marker position={position} icon={createPinIcon()} /> : null;
};

interface NeedyFormProps {
  onSubmit: (request: EmergencyRequest) => void;
  locationState: LocationState;
}

export const NeedyForm: React.FC<NeedyFormProps> = ({ onSubmit, locationState }) => {
  const phoneInputRef = React.useRef<HTMLInputElement>(null);
  const totalPeopleInputRef = React.useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    locationDesc: '',
    needs: '',
    duration: '',
    notes: '',
  });

  // Always map mode now as per request
  const [pinnedLocation, setPinnedLocation] = useState<{ lat: number, lng: number } | null>(null);

  // Update pinned location when GPS becomes available, if not set
  useEffect(() => {
    if (locationState.latitude && locationState.longitude && !pinnedLocation) {
      setPinnedLocation({ lat: locationState.latitude, lng: locationState.longitude });
    }
  }, [locationState.latitude, locationState.longitude]);

  const [demographics, setDemographics] = useState<Demographics>({
    totalPeople: 1,
    pregnant: 0,
    elderly: 0,
    disabled: 0,
    injured: 0,
    children0to6: 0,
    children6to14: 0,
    needyName: '',
  });

  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      if (e.target.files.length + selectedImages.length > 5) {
        alert("Chỉ được chọn tối đa 5 ảnh.");
        return;
      }

      const files = Array.from(e.target.files);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setSelectedImages(prev => [...prev, reader.result as string].slice(0, 5));
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Refs for custom validation focus
  const mapValidationRef = useRef<HTMLInputElement>(null);

  // Clear map validation error when location is selected
  useEffect(() => {
    if (pinnedLocation && mapValidationRef.current) {
      mapValidationRef.current.setCustomValidity("");
    }
  }, [pinnedLocation]);

  const handleInvalid = (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Custom message for "required" attributes when form submission is triggered
    if (e.currentTarget.validity.valueMissing) {
      e.currentTarget.setCustomValidity("Thiếu thông tin! Vui lòng điền nội dung vào ô này.");
    }
  };

  const handleInputResetValidity = (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.setCustomValidity("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset validity for map check
    if (mapValidationRef.current) mapValidationRef.current.setCustomValidity("");

    // Map Validation (Always Active)
    if (!pinnedLocation) {
      // Use a hidden input or similar to hook validation? Or just alert as fallback if no ref.
      // But user wanted custom error messages.
      alert("Thiếu thông tin! Vui lòng ghim vị trí của bạn trên bản đồ.");
      return;
    }

    // Phone Validation
    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(formData.phone)) {
      if (phoneInputRef.current) {
        phoneInputRef.current.setCustomValidity("Kiểm tra lại nội dung! Số điện thoại phải có 10 chữ số và bắt đầu bằng số 0.");
        phoneInputRef.current.reportValidity();
      }
      return;
    }

    // Demographics Validation
    const totalSpecial = demographics.pregnant + demographics.elderly + demographics.disabled + demographics.injured + demographics.children0to6 + demographics.children6to14;
    // Note: Comparison logic based on user request. 
    // They asked: "tổng số người ở diện đặc biệt phải nhỏ hơn hoặc bằng tổng số người cần hỗ trợ"
    if (totalSpecial > demographics.totalPeople) {
      if (totalPeopleInputRef.current) {
        totalPeopleInputRef.current.setCustomValidity(`Kiểm tra lại nội dung! Tổng số người thuộc các nhóm ưu tiên (${totalSpecial}) không được vượt quá tổng số người báo cáo (${demographics.totalPeople}).`);
        totalPeopleInputRef.current.reportValidity();
      }
      return;
    }

    setIsSubmitting(true);
    setStatusMsg('Hệ thống đang xử lý vị trí và đánh giá mức độ ưu tiên...');
    setErrorMsg('');

    try {
      let finalLocationInput = "";
      let finalUserCoords = pinnedLocation;

      const analysis = await analyzeEmergencyReport(
        finalLocationInput,
        formData.needs,
        demographics,
        finalUserCoords
      );

      const newRequest: EmergencyRequest = {
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: formData.name,
        phone: formData.phone,
        originalLocationInput: `Ghim trên bản đồ [${pinnedLocation?.lat.toFixed(5)}, ${pinnedLocation?.lng.toFixed(5)}]`, // Only map input now
        verifiedLocation: analysis.coordinates ? (analysis.text.split('. ')[0].replace('Yêu cầu hỗ trợ từ ', '') || analysis.text) : "Vị trí đã ghim",
        coordinates: analysis.coordinates,
        needs: formData.needs,
        stuckDuration: formData.duration,
        demographics: demographics,
        timestamp: Date.now(),
        status: 'pending',
        priority: analysis.priority,
        groundingLinks: analysis.groundingChunks,
        aiAnalysis: analysis.text,
        images: selectedImages,
        notes: formData.notes
      };

      onSubmit(newRequest);
      setIsSuccess(true);

      // Reset form
      setFormData({
        name: '',
        phone: '',
        locationDesc: '',
        needs: '',
        duration: '',
        notes: '',
      });
      setSelectedImages([]);
      setPinnedLocation(null);
      // Wait a moment then maybe reset success state if we want user to submit another?
      // Or we keep Success state until user clicks "Back".

    } catch (error) {
      console.error(error);
      setErrorMsg('Đã xảy ra lỗi khi gửi yêu cầu. Vui lòng kiểm tra kết nối mạng và thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoChange = (field: keyof Demographics, value: string) => {
    const num = parseInt(value) || 0;
    setDemographics(prev => ({ ...prev, [field]: num }));
  };

  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-6 animate-fade-in">
        <div className="bg-white rounded-xl shadow-lg border border-green-100 p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Đã gửi yêu cầu thành công!</h2>
            <p className="text-slate-600 mt-2">Hệ thống đã nhận được thông tin và vị trí của bạn. Vui lòng giữ liên lạc và bình tĩnh chờ đợi.</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-sm text-slate-500">
            <p>Đội cứu trợ sẽ liên hệ với bạn qua số điện thoại đã cung cấp sớm nhất có thể.</p>
          </div>
          <button
            onClick={() => setIsSuccess(false)}
            className="px-6 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition w-full md:w-auto"
          >
            Gửi yêu cầu khác
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <div className="bg-white rounded-xl shadow-lg border border-red-100 overflow-hidden">
        <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-3">
          <div className="bg-red-500 text-white p-2 rounded-full">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-red-900">Gửi Yêu Cầu Cứu Trợ</h2>
            <p className="text-sm text-red-700">Cung cấp thông tin chi tiết để đội cứu hộ tiếp cận nhanh nhất.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {errorMsg && (
            <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-2">
              <span className="font-bold">⚠️ Lỗi:</span> {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Họ tên / Tên nhóm</label>
              <input
                required
                type="text"
                className="w-full p-3 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition"
                placeholder="Ví dụ: Nguyễn Văn A, Gia đình ông B"
                value={formData.name}
                onInvalid={handleInvalid}
                onInput={handleInputResetValidity}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Số điện thoại liên hệ</label>
              <div className="relative">
                <Phone className="absolute top-3 left-3 text-slate-400 w-5 h-5" />
                <input
                  required
                  ref={phoneInputRef}
                  type="tel"
                  className="w-full pl-10 p-3 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition"
                  placeholder="0912..."
                  value={formData.phone}
                  onInvalid={handleInvalid}
                  onInput={handleInputResetValidity}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
          </div>


          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Vị trí hiện tại (Chạm vào bản đồ để ghim)</label>
            <div className="rounded-lg border border-slate-300 overflow-hidden relative">
              {/* Hidden input for HTML5 validity check of Map Pin */}
              <input
                ref={mapValidationRef}
                className="sr-only"
                required
                value={pinnedLocation ? "pinned" : ""}
                onChange={() => { }}
                onInvalid={(e) => {
                  if (e.currentTarget.validity.valueMissing) {
                    e.currentTarget.setCustomValidity('Thiếu thông tin! Vui lòng chọn vị trí trên bản đồ.');
                  }
                }}
                onInput={handleInputResetValidity}
              />
              <div className="h-64 w-full bg-slate-100 z-0">
                <MapContainer
                  center={(locationState.latitude && locationState.longitude) ? { lat: locationState.latitude, lng: locationState.longitude } : { lat: 13.0882, lng: 109.3149 }}
                  zoom={13}
                  style={{ height: '100%', width: '100%', cursor: 'crosshair' }} // Explicit cursor for better UX
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <LocationMarker position={pinnedLocation} setPosition={setPinnedLocation} />
                </MapContainer>
              </div>
              <div className="p-2 bg-slate-50 text-xs text-slate-600 text-center border-t border-slate-200">
                {pinnedLocation ?
                  `Đã chọn: ${pinnedLocation.lat.toFixed(5)}, ${pinnedLocation.lng.toFixed(5)}` :
                  "Chạm vào bản đồ để ghim vị trí của bạn"
                }
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Hình ảnh hiện trường (Tùy chọn, tối đa 5)</label>

            {selectedImages.length > 0 && (
              <div className="grid grid-cols-5 gap-2 mb-3">
                {selectedImages.map((img, idx) => (
                  <div key={idx} className="relative group aspect-square">
                    <img src={img} alt={`Preview ${idx}`} className="w-full h-full object-cover rounded-lg border border-slate-200" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center text-xs shadow-sm hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className={`border-2 border-dashed rounded-lg p-4 text-center transition ${selectedImages.length >= 5 ? 'bg-slate-100 border-slate-300 cursor-not-allowed' : 'border-slate-300 hover:border-red-400 bg-slate-50 cursor-pointer'}`}>
              <input
                type="file"
                accept="image/*"
                id="image-upload"
                className="hidden"
                onChange={handleImageUpload}
                disabled={selectedImages.length >= 5}
                multiple
              />
              <label htmlFor="image-upload" className={`w-full h-full block ${selectedImages.length >= 5 ? 'cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}>
                <div className="flex flex-col items-center gap-2 py-2">
                  <ImageIcon className={`w-8 h-8 ${selectedImages.length >= 5 ? 'text-slate-300' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${selectedImages.length >= 5 ? 'text-slate-400' : 'text-slate-600'}`}>
                    {selectedImages.length >= 5 ? 'Đã đạt giới hạn 5 ảnh' : 'Nhấn để tải ảnh lên'}
                  </span>
                  <span className="text-xs text-slate-400">Giúp đội cứu hộ đánh giá tình hình tốt hơn</span>
                </div>
              </label>
            </div>
          </div>

          {/* Demographic Section */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 mb-3 border-b border-slate-200 pb-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-800">Thông tin Nhân khẩu học</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="col-span-2 md:col-span-4">
                <label className="text-sm font-semibold text-slate-700">Tên người cần cứu (nếu không phải là bạn)</label>
                <input
                  type="text"
                  className="w-full p-2 mt-1 rounded border border-slate-300 bg-white text-slate-700"
                  placeholder="Để trống nếu là chính bạn"
                  value={demographics.needyName || ''}
                  onChange={(e) => setDemographics({ ...demographics, needyName: e.target.value })}
                />
              </div>

              <div className="col-span-2 md:col-span-4">
                <label className="text-sm font-semibold text-slate-700">Tổng số người cần cứu trợ</label>
                <input
                  ref={totalPeopleInputRef}
                  type="number" min="1" required
                  className="w-full p-2 mt-1 rounded border border-slate-300 bg-white text-slate-700 focus:ring-red-500"
                  value={demographics.totalPeople}
                  onInvalid={(e) => {
                    if (e.currentTarget.validity.valueMissing) {
                      e.currentTarget.setCustomValidity('Thiếu thông tin! Phải có ít nhất 1 người.');
                    }
                  }}
                  onInput={handleInputResetValidity}
                  onChange={(e) => handleDemoChange('totalPeople', e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Bà bầu</label>
                <input type="number" min="0" className="w-full p-2 mt-1 rounded border border-slate-300 bg-white text-slate-700"
                  value={demographics.pregnant} onChange={(e) => handleDemoChange('pregnant', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Người cao tuổi</label>
                <input type="number" min="0" className="w-full p-2 mt-1 rounded border border-slate-300 bg-white text-slate-700"
                  value={demographics.elderly} onChange={(e) => handleDemoChange('elderly', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Người khuyết tật</label>
                <input type="number" min="0" className="w-full p-2 mt-1 rounded border border-slate-300 bg-white text-slate-700"
                  value={demographics.disabled} onChange={(e) => handleDemoChange('disabled', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Người bị thương</label>
                <input type="number" min="0" className="w-full p-2 mt-1 rounded border border-slate-300 bg-white text-slate-700"
                  value={demographics.injured} onChange={(e) => handleDemoChange('injured', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Trẻ em (0-6 tuổi)</label>
                <input type="number" min="0" className="w-full p-2 mt-1 rounded border border-slate-300 bg-white text-slate-700"
                  value={demographics.children0to6} onChange={(e) => handleDemoChange('children0to6', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Trẻ em (6-14 tuổi)</label>
                <input type="number" min="0" className="w-full p-2 mt-1 rounded border border-slate-300 bg-white text-slate-700"
                  value={demographics.children6to14} onChange={(e) => handleDemoChange('children6to14', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Nhu cầu cấp thiết</label>
              <div className="relative">
                <MessageSquare className="absolute top-3 left-3 text-slate-400 w-5 h-5" />
                <input
                  required
                  type="text"
                  className="w-full pl-10 p-3 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition"
                  placeholder="Ví dụ: Mì tôm, nước, thuốc hạ sốt"
                  value={formData.needs}
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Thiếu thông tin! Vui lòng cho biết nhu cầu cần hỗ trợ.')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                  onChange={(e) => setFormData({ ...formData, needs: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Đã mắc kẹt bao lâu?</label>
              <div className="relative">
                <Clock className="absolute top-3 left-3 text-slate-400 w-5 h-5" />
                <input
                  required
                  type="text"
                  className="w-full pl-10 p-3 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition"
                  placeholder="Ví dụ: 1 ngày, 5 giờ"
                  value={formData.duration}
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Thiếu thông tin! Vui lòng ước lượng thời gian mắc kẹt.')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Ghi chú thêm (Tình trạng sức khỏe, đặc điểm nhận dạng...)</label>
            <textarea
              rows={3}
              className="w-full p-3 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition"
              placeholder="Nhập thêm thông tin chi tiết nếu cần..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-4 rounded-xl font-bold text-white shadow-md transition-all transform hover:-translate-y-0.5
              ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 hover:shadow-lg'}`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="animate-spin w-5 h-5" />
                {statusMsg}
              </span>
            ) : (
              "GỬI YÊU CẦU CỨU TRỢ"
            )}
          </button>
        </form >
      </div >
    </div >
  );
};