import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, Calendar, User, ClipboardList, ArrowLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Site {
  id: string;
  name: string;
  shortName: string;
  client: string;
  location: string;
  manager: string;
  startDate: string;
  endDate: string;
  notes: string;
}

interface Patrol {
  id: string;
  date: string;
  inspector: string;
  status: string;
}

interface Finding {
  id: string;
  patrolId: string;
  status: '未対応' | '確認待ち' | '再是正' | '完了';
}

const getStatusDisplay = (patrolId: string, findings: Finding[]) => {
  const patrolFindings = findings.filter(f => f.patrolId === patrolId);
  
  if (patrolFindings.length === 0) {
    return { label: '指摘事項なし', className: 'bg-gray-100 text-gray-700' };
  }

  const hasUnresolved = patrolFindings.some(f => f.status === '未対応');
  const hasPending = patrolFindings.some(f => f.status === '確認待ち' || f.status === '再是正');
  const allCompleted = patrolFindings.every(f => f.status === '完了');

  if (hasUnresolved) {
    return { label: '是正対応未実施', className: 'bg-red-100 text-red-700' };
  } else if (hasPending) {
    return { label: '是正対応済', className: 'bg-yellow-100 text-yellow-700' };
  } else if (allCompleted) {
    return { label: '是正対応確認済', className: 'bg-green-100 text-green-700' };
  }

  return { label: '状態不明', className: 'bg-gray-100 text-gray-700' };
};

const SiteDetail: React.FC = () => {
  const { siteId } = useParams<{ siteId: string }>();
  const { profile, isAuthReady } = useAuth();
  const [site, setSite] = useState<Site | null>(null);
  const [patrols, setPatrols] = useState<Patrol[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthReady || !profile || !siteId) return;

    const fetchSite = async () => {
      try {
        const siteDoc = await getDoc(doc(db, 'sites', siteId));
        if (siteDoc.exists()) {
          setSite({ id: siteDoc.id, ...siteDoc.data() } as Site);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `sites/${siteId}`);
      }
    };

    fetchSite();

    const qPatrols = query(collection(db, 'patrols'), where('siteId', '==', siteId));
    const unsubscribePatrols = onSnapshot(qPatrols, (snapshot) => {
      const patrolData: Patrol[] = [];
      snapshot.forEach((doc) => {
        patrolData.push({ id: doc.id, ...doc.data() } as Patrol);
      });
      // Sort by date descending
      patrolData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPatrols(patrolData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'patrols'));

    const qFindings = query(collection(db, 'findings'));
    const unsubscribeFindings = onSnapshot(qFindings, (snapshot) => {
      const findingData: Finding[] = [];
      snapshot.forEach((doc) => {
        findingData.push({ id: doc.id, ...doc.data() } as Finding);
      });
      setFindings(findingData);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'findings'));

    return () => {
      unsubscribePatrols();
      unsubscribeFindings();
    };
  }, [isAuthReady, profile, siteId]);

  if (loading) return <div className="p-8 text-center text-gray-500">読み込み中...</div>;
  if (!site) return <div className="p-8 text-center text-red-500">現場が見つかりません。</div>;

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <button onClick={() => window.history.back()} className="inline-flex items-center text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={20} className="mr-2" />
          戻る
        </button>
        <div className="flex items-center space-x-4">
          <div className="bg-blue-100 p-4 rounded-xl">
            <MapPin className="text-blue-600" size={32} />
          </div>
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <span className="bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full font-medium">
                {site.shortName}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{site.name}</h1>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">現場情報</h2>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-y-4 gap-x-8">
              <div>
                <p className="text-sm text-gray-500 mb-1">発注者</p>
                <p className="font-medium text-gray-900">{site.client || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">現場責任者</p>
                <p className="font-medium text-gray-900 flex items-center">
                  <User size={16} className="mr-2 text-gray-400" />
                  {site.manager || '-'}
                </p>
              </div>
              <div className="lg:col-span-2">
                <p className="text-sm text-gray-500 mb-1">工事場所</p>
                <p className="font-medium text-gray-900">{site.location || '-'}</p>
              </div>
              <div className="lg:col-span-2">
                <p className="text-sm text-gray-500 mb-1">工期</p>
                <p className="font-medium text-gray-900 flex items-center">
                  <Calendar size={16} className="mr-2 text-gray-400" />
                  {site.startDate ? format(parseISO(site.startDate), 'yyyy/MM/dd') : '-'} 
                  {' 〜 '} 
                  {site.endDate ? format(parseISO(site.endDate), 'yyyy/MM/dd') : '-'}
                </p>
              </div>
              {site.notes && (
                <div className="lg:col-span-2 mt-2">
                  <p className="text-sm text-gray-500 mb-1">備考</p>
                  <p className="text-gray-700 whitespace-pre-wrap">{site.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h2 className="text-xl font-bold text-gray-900">パトロール履歴</h2>
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
                {patrols.length}件
              </span>
            </div>
            
            <ul className="space-y-4">
              {patrols.slice(0, 5).map(patrol => (
                <li key={patrol.id}>
                  <Link to={`/patrols/${patrol.id}`} className="block border border-gray-200 rounded-xl p-5 hover:bg-gray-50 transition-colors group">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className={`text-xs px-3 py-1 rounded-full font-medium ${getStatusDisplay(patrol.id, findings).className}`}>
                            {getStatusDisplay(patrol.id, findings).label}
                          </span>
                          <span className="font-medium text-gray-900 flex items-center">
                            <Calendar size={14} className="mr-1 text-gray-400" />
                            {format(parseISO(patrol.date), 'yyyy/MM/dd')}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 flex items-center">
                          <User size={14} className="mr-1 text-gray-400" />
                          実施者: {patrol.inspector}
                        </div>
                      </div>
                      <div className="hidden sm:flex text-blue-600 font-medium text-sm whitespace-nowrap">
                        詳細 &rarr;
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
              {patrols.length === 0 && (
                <li className="text-sm text-gray-500 text-center py-4">履歴がありません</li>
              )}
            </ul>
            {patrols.length > 5 && (
              <Link to="/patrols" className="block text-center text-sm text-blue-600 font-medium mt-4 hover:underline">
                すべて見る
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiteDetail;
