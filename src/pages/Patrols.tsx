import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Plus, ClipboardList, MapPin, Calendar, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Patrol {
  id: string;
  date: string;
  siteId: string;
  inspector: string;
  status: string;
  mainWork?: string;
}

interface Finding {
  id: string;
  patrolId: string;
  status: '未対応' | '確認待ち' | '再是正' | '完了';
}

interface Site {
  id: string;
  name: string;
  shortName: string;
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

const Patrols: React.FC = () => {
  const { profile, isAuthReady } = useAuth();
  const [patrols, setPatrols] = useState<Patrol[]>([]);
  const [sites, setSites] = useState<Record<string, Site>>({});
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthReady || !profile) return;

    const qPatrols = query(collection(db, 'patrols'), orderBy('date', 'desc'));
    const unsubscribePatrols = onSnapshot(qPatrols, (snapshot) => {
      const patrolData: Patrol[] = [];
      snapshot.forEach((doc) => {
        patrolData.push({ id: doc.id, ...doc.data() } as Patrol);
      });
      setPatrols(patrolData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'patrols'));

    const qSites = query(collection(db, 'sites'));
    const unsubscribeSites = onSnapshot(qSites, (snapshot) => {
      const siteData: Record<string, Site> = {};
      snapshot.forEach((doc) => {
        siteData[doc.id] = { id: doc.id, ...doc.data() } as Site;
      });
      setSites(siteData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sites'));

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
      unsubscribeSites();
      unsubscribeFindings();
    };
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
          <h1 className="text-3xl font-bold text-gray-900">パトロール記録</h1>
          <p className="text-gray-500 mt-2">実施済みのパトロール一覧</p>
        </div>
        {(profile?.role === 'admin' || profile?.role === 'safety') && (
          <Link
            to="/patrols/new"
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center shadow-sm w-full sm:w-auto justify-center"
          >
            <Plus size={20} className="mr-2" />
            新規登録
          </Link>
        )}
      </div>

      <div className="space-y-4">
        {patrols.map((patrol) => {
          const statusDisplay = getStatusDisplay(patrol.id, findings);
          return (
            <Link
              key={patrol.id}
              to={`/patrols/${patrol.id}`}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between group gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <span className={`px-3 py-1 text-xs font-medium rounded-full shrink-0 ${statusDisplay.className}`}>
                    {statusDisplay.label}
                  </span>
                  <span className="text-sm text-gray-500 flex items-center shrink-0">
                    <Calendar size={14} className="mr-1" />
                    {format(parseISO(patrol.date), 'yyyy/MM/dd')}
                  </span>
                </div>
                
                <h2 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1 mb-2">
                  {sites[patrol.siteId]?.name || '不明な現場'}
                </h2>
                
                <div className="flex flex-wrap items-center text-sm text-gray-600 gap-x-6 gap-y-2">
                  <div className="flex items-center">
                    <User size={16} className="mr-2 text-gray-400 shrink-0" />
                    <span>実施者: {patrol.inspector}</span>
                  </div>
                  {patrol.mainWork && (
                    <div className="flex items-center">
                      <span className="text-gray-400 mr-2">|</span>
                      <span className="truncate">主作業: {patrol.mainWork}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="hidden md:flex items-center text-blue-600 font-medium text-sm whitespace-nowrap">
                詳細を見る &rarr;
              </div>
            </Link>
          );
        })}

        {patrols.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
            <ClipboardList className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">パトロール記録がありません</h3>
            <p className="text-gray-500">
              {(profile?.role === 'admin' || profile?.role === 'safety') 
                ? '「新規登録」ボタンからパトロールを記録してください。'
                : '管理者がパトロールを記録するのをお待ちください。'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Patrols;
