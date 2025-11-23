import React, { useState } from 'react';
import { EmergencyRequest, LocationState, Demographics } from '../types';
import { analyzeEmergencyReport } from '../services/geminiService';
import { Loader2, MapPin, Navigation, Clock, MessageSquare, Phone, Users } from 'lucide-react';

interface NeedyFormProps {
  onSubmit: (request: EmergencyRequest) => void;
  locationState: LocationState;
}

export const NeedyForm: React.FC<NeedyFormProps> = ({ onSubmit, locationState }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    locationDesc: '',
    needs: '',
    duration: '',
  });

  const [demographics, setDemographics] = useState<Demographics>({
    totalPeople: 1,
    pregnant: 0,
    elderly: 0,
    disabled: 0,
    injured: 0,
    children0to6: 0,
    children6to14: 0,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMsg('Hệ thống đang xử lý vị trí và đánh giá mức độ ưu tiên...');

    try {
      const analysis = await analyzeEmergencyReport(
        formData.locationDesc,
        formData.needs,
        demographics,
        { lat: locationState.latitude, lng: locationState.longitude }
      );

      const newRequest: EmergencyRequest = {
        id: crypto.randomUUID(),
        name: formData.name,
        phone: formData.phone,
        originalLocationInput: formData.locationDesc,
        verifiedLocation: analysis.coordinates ? analysis.text.split('. ')[0].replace('Yêu cầu hỗ trợ từ ', '') : formData.locationDesc, 
        coordinates: analysis.coordinates,
        needs: formData.needs,
        stuckDuration: formData.duration,
        demographics: demographics,
        timestamp: Date.now(),
        status: 'pending',
        priority: analysis.priority,
        groundingLinks: analysis.groundingChunks,
        aiAnalysis: analysis.text
      };

      onSubmit(newRequest);
    } catch (error) {
      console.error(error);
      setStatusMsg('Lỗi khi gửi. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoChange = (field: keyof Demographics, value: string) => {
    const num = parseInt(value) || 0;
    setDemographics(prev => ({...prev, [field]: num}));
  };

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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Họ tên / Tên nhóm</label>
              <input 
                required
                type="text" 
                className="w-full p-3 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition"
                placeholder="Ví dụ: Nguyễn Văn A, Gia đình ông B"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Số điện thoại liên hệ</label>
              <div className="relative">
                <Phone className="absolute top-3 left-3 text-slate-400 w-5 h-5" />
                <input 
                  required
                  type="tel" 
                  className="w-full pl-10 p-3 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition"
                  placeholder="0912..."
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Vị trí hiện tại (Mô tả cụ thể)
              {locationState.latitude && <span className="ml-2 text-xs text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded">✓ Đã có GPS</span>}
            </label>
            <div className="relative">
              <MapPin className="absolute top-3 left-3 text-slate-400 w-5 h-5" />
              <textarea 
                required
                rows={2}
                className="w-full pl-10 p-3 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition"
                placeholder="Ví dụ: Số 123 đường A, gần trường tiểu học B, nước ngập tầng 1..."
                value={formData.locationDesc}
                onChange={(e) => setFormData({...formData, locationDesc: e.target.value})}
              />
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
                    <label className="text-sm font-semibold text-slate-700">Tổng số người cần cứu trợ</label>
                    <input 
                        type="number" min="1" required
                        className="w-full p-2 mt-1 rounded border border-slate-300 bg-white text-slate-700 focus:ring-red-500"
                        value={demographics.totalPeople}
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
                  onChange={(e) => setFormData({...formData, needs: e.target.value})}
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
                  onChange={(e) => setFormData({...formData, duration: e.target.value})}
                />
              </div>
            </div>
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
        </form>
      </div>
    </div>
  );
};