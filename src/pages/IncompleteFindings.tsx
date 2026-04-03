import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, Clock, MapPin, FileText, Filter } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';

interface Finding {
  id: string;
  patrolId: string;
  siteId: string;
  type: string;
  description: string;
  deadline?: string;
  status: string;
  urgency?: string;
}

interface Site {
  id: string;
  name: string;
  shortName: string;
}

const IncompleteFindings: React.FC = () => {
  const { profile, isAuthReady } = useAuth();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [sites, setSites] = useState<Record<string, Site>>({});
  const [loading, setLoading] = useState(true);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const isOverdueFilter = searchParams.get('filter') === 'overdue';

  useEffect(() => {
    if (!isAuthReady || !profile) return;

    const qFindings = query(
      collection(db, 'findings'),
      where('status', 'in', ['未対応', '対応中', '確認待ち', '再是正'])
    );

    const unsubscribeFindings = onSnapshot(qFindings, (snapshot) => {
      const findingData: Finding[] = [];
      snapshot.forEach((doc) => {
        findingData.push({ id: doc.id, ...doc.data() } as Finding);
      });
      // Sort by deadline (overdue first, then soonest)
      findingData.sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
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

  const filteredFindings = isOverdueFilter 
    ? findings.filter(f => f.deadline && isPast(parseISO(f.deadline)))
    : findings;

  // Group findings by site
  const findingsBySite = filteredFindings.reduce((acc, finding) => {
    if (!acc[finding.siteId]) {
      acc[finding.siteId] = [];
    }
    acc[finding.siteId].push(finding);
    return acc;
  }, {} as Record<string, Finding[]>);

  const toggleFilter = () => {
    if (isOverdueFilter) {
      searchParams.delete('filter');
    } else {
      searchParams.set('filter', 'overdue');
    }
    setSearchParams(searchParams);
    setSelectedSiteId(null); // Reset selected site when filter changes
  };

  const renderSiteList = () => {
    const siteIdsWithFindings = Object.keys(findingsBySite);

    if (siteIdsWithFindings.length === 0) {
      return (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <AlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 mb-2">未完了の指摘事項はありません</h3>
          <p className="text-gray-500">すべての指摘事項が完了しています。</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {siteIdsWithFindings.map(siteId => {
          const siteFindings = findingsBySite[siteId];
          const site = sites[siteId];
          const overdueCount = siteFindings.filter(f => f.deadline && isPast(parseISO(f.deadline))).length;

          return (
            <button
              key={siteId}
              onClick={() => setSelectedSiteId(siteId)}
              className="w-full text-left bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center justify-between group gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full font-medium">
                    {site?.shortName || '不明'}
                  </span>
                  {overdueCount > 0 && (
                    <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                      期限超過: {overdueCount}件
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors mb-2">
                  {site?.name || '不明な現場'}
                </h2>
                <div className="text-sm text-gray-600 flex items-center">
                  <AlertCircle size={16} className="mr-1 text-gray-400" />
                  未完了: {siteFindings.length}件
                </div>
              </div>
              <div className="hidden sm:flex text-blue-600 font-medium text-sm whitespace-nowrap">
                指摘一覧を見る &rarr;
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderFindingList = () => {
    if (!selectedSiteId) return null;
    const siteFindings = findingsBySite[selectedSiteId] || [];
    const site = sites[selectedSiteId];

    return (
      <div className="space-y-6">
        <div className="mb-4">
          <button 
            onClick={() => setSelectedSiteId(null)}
            className="text-sm text-blue-600 hover:underline flex items-center"
          >
            &larr; 現場一覧に戻る
          </button>
        </div>
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{site?.name || '不明な現場'}</h2>
            <p className="text-gray-500 mt-1">
              {isOverdueFilter ? '期限超過の指摘事項' : '未完了の指摘事項'}: {siteFindings.length}件
            </p>
          </div>
          <button
            onClick={toggleFilter}
            className={`w-full sm:w-auto justify-center inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
              isOverdueFilter 
                ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' 
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Filter size={16} className="mr-2" />
            {isOverdueFilter ? '期限超過のみ表示中' : 'すべて表示中'}
          </button>
        </div>

        <div className="space-y-4">
          {siteFindings.map((finding) => {
            const isOverdue = finding.deadline && isPast(parseISO(finding.deadline));
            
            return (
              <Link
                key={finding.id}
                to={`/findings/${finding.id}`}
                className="block bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        finding.status === '未対応' ? 'bg-red-100 text-red-700' :
                        finding.status === '対応中' ? 'bg-blue-100 text-blue-700' :
                        finding.status === '確認待ち' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {finding.status}
                      </span>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                        {finding.type}
                      </span>
                      {finding.urgency && (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          finding.urgency === '即時是正' ? 'bg-red-100 text-red-700 border border-red-200' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {finding.urgency}
                        </span>
                      )}
                      {isOverdue && (
                        <span className="px-2 py-1 text-xs font-bold rounded-full bg-red-600 text-white animate-pulse">
                          期限超過
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {finding.description}
                    </h3>
                    
                    <div className="flex flex-wrap items-center text-sm text-gray-600 gap-4">
                      {finding.deadline && (
                        <div className={`flex items-center ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                          <Clock size={16} className="mr-1" />
                          期限: {format(parseISO(finding.deadline), 'yyyy/MM/dd')}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="hidden sm:flex text-blue-600 font-medium text-sm items-center whitespace-nowrap">
                    <FileText size={16} className="mr-1" />
                    詳細・対応 &rarr;
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {!selectedSiteId && (
        <>
          <div className="mb-4">
            <Link to="/" className="text-sm text-blue-600 hover:underline flex items-center">
              &larr; ダッシュボードに戻る
            </Link>
          </div>
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">未完了一覧</h1>
              <p className="text-gray-500 mt-2">対応が必要な指摘事項がある現場</p>
            </div>
            <button
              onClick={toggleFilter}
              className={`w-full sm:w-auto justify-center inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
                isOverdueFilter 
                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' 
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Filter size={16} className="mr-2" />
              {isOverdueFilter ? '期限超過のみ表示中' : 'すべて表示中'}
            </button>
          </div>
          {renderSiteList()}
        </>
      )}
      {selectedSiteId && renderFindingList()}
    </div>
  );
};

export default IncompleteFindings;
