import React from 'react';
    import { AppMode } from '../types';
    import { AlertCircle, HeartHandshake } from 'lucide-react';
    
    interface LandingProps {
      setMode: (mode: AppMode) => void;
    }
    
    export const Landing: React.FC<LandingProps> = ({ setMode }) => {
      return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 space-y-8 animate-fade-in">
          <div className="text-center max-w-2xl">
            <h2 className="text-4xl md:text-5xl font-extrabold text-slate-800 mb-4">
              Mạng lưới Cứu trợ Khẩn cấp
            </h2>
            <p className="text-lg text-slate-600">
              Kết nối người gặp nạn với đội cứu hộ và các nhà hảo tâm.
              Hỗ trợ bởi trí tuệ nhân tạo xác thực vị trí chính xác.
            </p>
          </div>
    
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
            {/* Needy Card */}
            <button
              onClick={() => setMode('needy')}
              className="group relative flex flex-col items-center p-8 bg-white border-2 border-red-100 rounded-2xl shadow-xl hover:shadow-2xl hover:border-red-500 transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="p-4 bg-red-100 rounded-full mb-6 group-hover:bg-red-500 transition-colors">
                <AlertCircle className="w-12 h-12 text-red-600 group-hover:text-white" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Tôi Cần Giúp Đỡ</h3>
              <p className="text-slate-500 text-center">
                Gửi vị trí và nhu cầu của bạn lên bản đồ khẩn cấp. Chúng tôi dùng AI để gửi vị trí chính xác cho đội cứu hộ.
              </p>
            </button>
    
            {/* Supporter Card */}
            <button
              onClick={() => setMode('supporter')}
              className="group relative flex flex-col items-center p-8 bg-white border-2 border-blue-100 rounded-2xl shadow-xl hover:shadow-2xl hover:border-blue-500 transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="p-4 bg-blue-100 rounded-full mb-6 group-hover:bg-blue-500 transition-colors">
                <HeartHandshake className="w-12 h-12 text-blue-600 group-hover:text-white" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Tôi Muốn Hỗ Trợ</h3>
              <p className="text-slate-500 text-center">
                Xem thống kê thời gian thực, xác định các khu vực nguy cấp và điều phối nguồn lực hỗ trợ.
              </p>
            </button>
          </div>
        </div>
      );
    };