import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Star, Calendar, MapPin, FileText, Filter } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Finding {
  id: string;
  patrolId: string;
  siteId: string;
  type: string;
  description: string;
  categoryMajor?: string;
  categoryMiddle?: string;
  categoryMinor?: string;
  categoryOtherReason?: string;
  createdAt: string;
}

interface Site {
  id: string;
  name: string;
  shortName: string;
}

const GoodPractices: React.FC = () => {
  const { profile, isAuthReady } = useAuth();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [sites, setSites] = useState<Record<string, Site>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterSite, setFilterSite] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');

  useEffect(() => {
    if (!isAuthReady || !profile) return;

    const qFindings = query(
      collection(db, 'findings'),
      where('type', '==', '好事例')
    );

    const unsubscribeFindings = onSnapshot(qFindings, (snapshot) => {
      const findingData: Finding[] = [];
      snapshot.forEach((doc) => {
        findingData.push({ id: doc.id, ...doc.data() } as Finding);
      });
      // Sort by createdAt descending
      findingData.sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setFindings(findingData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'findings'));

    const qSites = query(collection(db, 'sites'));
    const unsubscribeSites = onSnapshot(qSites, (snapshot) => {
      const siteData: Record<string, Site> = {};
      snapshot.forEach((doc) => {
        siteData[doc.id] = { id: doc.id, ...doc.data() } as Site;
      });
      setSites(siteData);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sites'));

    return () => {
      unsubscribeFindings();
      unsubscribeSites();
    };
  }, [isAuthReady, profile]);

  if (loading) return <div className="p-8 text-center text-gray-500">読み込み中...</div>;

  // Extract unique months and categories for filter options
  const months = Array.from(new Set(findings.map(f => f.createdAt ? f.createdAt.substring(0, 7) : ''))).filter(Boolean).sort().reverse();
  const categories = Array.from(new Set(findings.map(f => f.categoryMajor))).filter(Boolean) as string[];

  // Apply filters
  const filteredFindings = findings.filter(f => {
    const matchSite = filterSite ? f.siteId === filterSite : true;
    const matchMonth = filterMonth ? f.createdAt?.startsWith(filterMonth) : true;
    const matchCategory = filterCategory ? f.categoryMajor === filterCategory : true;
    return matchSite && matchMonth && matchCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Star className="text-yellow-500 mr-3" size={32} />
            好事例一覧
          </h1>
          <p className="text-gray-500 mt-2">現場で見つかった良い取り組みの記録</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:flex-wrap gap-4 sm:items-center">
        <div className="flex items-center text-gray-500 sm:mr-2">
          <Filter size={18} className="mr-2" />
          <span className="text-sm font-medium">絞り込み:</span>
        </div>
        
        <select
          value={filterSite}
          onChange={(e) => setFilterSite(e.target.value)}
          className="w-full sm:w-auto flex-1 bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5"
        >
          <option value="">すべての現場</option>
          {Object.values(sites).map(site => (
            <option key={(site as any).id} value={(site as any).id}>{(site as any).name}</option>
          ))}
        </select>

        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="w-full sm:w-auto flex-1 bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5"
        >
          <option value="">すべての期間</option>
          {months.map(month => (
            <option key={month as string} value={month as string}>{(month as string).replace('-', '年')}月</option>
          ))}
        </select>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="w-full sm:w-auto flex-1 bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5"
        >
          <option value="">すべての大分類</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="space-y-4">
        {filteredFindings.map((finding) => {
          const site = sites[finding.siteId];
          
          return (
            <Link
              key={finding.id}
              to={`/findings/${finding.id}`}
              className="block bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 flex items-center">
                      <Star size={12} className="mr-1" />
                      好事例
                    </span>
                    <span className="text-sm font-medium text-gray-700 flex items-center bg-gray-100 px-3 py-1 rounded-full">
                      <MapPin size={14} className="mr-1 text-gray-500" />
                      {site?.name || '不明な現場'}
                    </span>
                    {finding.createdAt && (
                      <span className="text-sm text-gray-500 flex items-center">
                        <Calendar size={14} className="mr-1" />
                        {format(parseISO(finding.createdAt), 'yyyy/MM/dd')}
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {finding.description}
                  </h3>
                  
                  {(finding.categoryMajor || finding.categoryMiddle || finding.categoryMinor) && (
                    <div className="flex flex-wrap items-center text-xs text-gray-500 gap-1 mt-2">
                      {finding.categoryMajor && <span className="bg-gray-50 px-2 py-1 rounded border border-gray-100">{finding.categoryMajor}</span>}
                      {finding.categoryMiddle && <><span className="text-gray-300">&gt;</span><span className="bg-gray-50 px-2 py-1 rounded border border-gray-100">{finding.categoryMiddle}</span></>}
                      {finding.categoryMinor && <><span className="text-gray-300">&gt;</span><span className="bg-gray-50 px-2 py-1 rounded border border-gray-100">{finding.categoryMinor === 'その他' && finding.categoryOtherReason ? `その他（${finding.categoryOtherReason}）` : finding.categoryMinor}</span></>}
                    </div>
                  )}
                </div>
                
                <div className="hidden sm:flex text-blue-600 font-medium text-sm items-center whitespace-nowrap">
                  <FileText size={16} className="mr-1" />
                  詳細を見る &rarr;
                </div>
              </div>
            </Link>
          );
        })}

        {filteredFindings.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
            <Star className="mx-auto text-gray-300 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">好事例が見つかりません</h3>
            <p className="text-gray-500">条件に一致する好事例の記録はありません。</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoodPractices;
