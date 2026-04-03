import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, query, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Save } from 'lucide-react';
import { format } from 'date-fns';

interface Site {
  id: string;
  name: string;
}

const PatrolNew: React.FC = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    siteId: '',
    inspector: profile?.displayName || '',
    mainWork: '',
    weather: '',
    notes: '',
    status: 'draft',
  });

  useEffect(() => {
    const fetchSites = async () => {
      try {
        const q = query(collection(db, 'sites'));
        const querySnapshot = await getDocs(q);
        const siteData: Site[] = [];
        querySnapshot.forEach((doc) => {
          siteData.push({ id: doc.id, name: doc.data().name });
        });
        setSites(siteData);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'sites');
      }
    };
    fetchSites();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !user) return;
    
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'patrols'), {
        ...formData,
        authorUid: user.uid,
        createdAt: new Date().toISOString()
      });
      navigate(`/patrols/${docRef.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'patrols');
      alert('保存に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="mb-6">
        <button onClick={() => navigate(-1)} className="inline-flex items-center text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={20} className="mr-2" />
          戻る
        </button>
        <h1 className="text-3xl font-bold text-gray-900">新規パトロール登録</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">実施日 <span className="text-red-500">*</span></label>
              <input
                type="date"
                name="date"
                required
                value={formData.date}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">現場 <span className="text-red-500">*</span></label>
              <select
                name="siteId"
                required
                value={formData.siteId}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">選択してください</option>
                {sites.map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">実施者 <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="inspector"
                required
                value={formData.inspector}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">天候</label>
              <input
                type="text"
                name="weather"
                value={formData.weather}
                onChange={handleChange}
                placeholder="例: 晴れ、気温25度"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">当日の主作業</label>
              <input
                type="text"
                name="mainWork"
                value={formData.mainWork}
                onChange={handleChange}
                placeholder="例: 鉄筋組立、型枠解体"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">特記事項</label>
              <textarea
                name="notes"
                rows={4}
                value={formData.notes}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
            >
              <Save size={20} className="mr-2" />
              保存して次へ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PatrolNew;
