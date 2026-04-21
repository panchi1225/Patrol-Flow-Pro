import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { canUseSafetyFeatures } from '../lib/permissions';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Plus, MapPin, Calendar, User, Building2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Site {
  id: string;
  name: string;
  shortName: string;
  client: string;
  manager: string;
  startDate: string;
  endDate: string;
  location?: string;
}

const Sites: React.FC = () => {
  const { profile, isAuthReady } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthReady || !profile) return;

    const q = query(collection(db, 'sites'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const siteData: Site[] = [];
      snapshot.forEach((doc) => {
        siteData.push({ id: doc.id, ...doc.data() } as Site);
      });
      setSites(siteData);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sites'));

    return () => unsubscribe();
  }, [isAuthReady, profile]);

  if (loading) return <div className="p-8 text-center text-gray-500">読み込み中...</div>;

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <Link to="/" className="text-sm text-blue-600 hover:underline flex items-center">
          &larr; ダッシュボードに戻る
        </Link>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center flex-wrap gap-4">
            現場一覧
            {canUseSafetyFeatures(profile?.role) && (
              <Link
                to="/sites/new"
                className="text-sm bg-blue-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center shadow-sm"
              >
                <Plus size={18} className="mr-1" />
                新規登録
              </Link>
            )}
          </h1>
          <p className="text-gray-500 mt-2">登録されている現場の管理</p>
        </div>
      </div>

      <div className="space-y-4">
        {sites.map((site) => (
          <Link
            key={site.id}
            to={`/sites/${site.id}`}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between group gap-4"
          >
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <span className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full font-medium shrink-0">
                  {site.shortName}
                </span>
                <h2 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                  {site.name}
                </h2>
              </div>
              
              <div className="flex flex-wrap items-center text-sm text-gray-600 gap-x-6 gap-y-2 mb-2">
                <div className="flex items-center">
                  <Building2 size={16} className="mr-2 text-gray-400 shrink-0" />
                  <span>{site.client || '発注者未設定'}</span>
                </div>
                <div className="flex items-center">
                  <User size={16} className="mr-2 text-gray-400 shrink-0" />
                  <span>{site.manager || '責任者未設定'}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center text-sm text-gray-600 gap-y-2">
                <div className="flex items-center mr-4">
                  <Calendar size={16} className="mr-2 text-gray-400 shrink-0" />
                  <span>
                    {site.startDate ? format(parseISO(site.startDate), 'yyyy/MM/dd') : '-'} 
                    {' 〜 '} 
                    {site.endDate ? format(parseISO(site.endDate), 'yyyy/MM/dd') : '-'}
                  </span>
                </div>
                {site.location && (
                  <div className="flex items-center">
                    <MapPin size={16} className="mr-1 text-gray-400 shrink-0" />
                    <span className="truncate">{site.location}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="hidden md:flex items-center text-blue-600 font-medium text-sm whitespace-nowrap">
              詳細を見る &rarr;
            </div>
          </Link>
        ))}

        {sites.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
            <MapPin className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">現場が登録されていません</h3>
            <p className="text-gray-500">
              {canUseSafetyFeatures(profile?.role)
                ? '「新規登録」ボタンから現場を追加してください。'
                : '管理者が現場を登録するのをお待ちください。'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sites;
