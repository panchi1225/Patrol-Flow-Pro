import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { canUseSafetyFeatures } from '../lib/permissions';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Clock, FileText } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';

const Dashboard: React.FC = () => {
  const { profile, user, isAuthReady } = useAuth();
  const [stats, setStats] = useState({
    totalIncomplete: 0,
    overdue: 0,
    totalPatrols: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthReady || !profile) return;

    const findingsRef = collection(db, 'findings');
    const patrolsRef = collection(db, 'patrols');

    const qFindings = query(findingsRef, where('status', 'in', ['未対応', '対応中', '確認待ち', '再是正']));
    
    const unsubscribeFindings = onSnapshot(qFindings, (snapshot) => {
      let incomplete = 0;
      let overdue = 0;
      const now = new Date();

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.type === '好事例') return;
        
        incomplete++;
        if (data.deadline && isPast(parseISO(data.deadline))) {
          overdue++;
        }
      });

      setStats(prev => ({ ...prev, totalIncomplete: incomplete, overdue }));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'findings'));

    const qPatrols = query(patrolsRef);
    const unsubscribePatrols = onSnapshot(qPatrols, (snapshot) => {
      setStats(prev => ({ ...prev, totalPatrols: snapshot.size }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'patrols'));

    return () => {
      unsubscribeFindings();
      unsubscribePatrols();
    };
  }, [isAuthReady, profile]);

  if (loading) return <div className="p-8 text-center text-gray-500">読み込み中...</div>;

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="text-gray-500 mt-2">現在のパトロール状況と未完了タスク</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center text-center">
          <div className="bg-red-100 p-4 rounded-full mb-4">
            <AlertTriangle className="text-red-600" size={32} />
          </div>
          <h2 className="text-lg font-semibold text-gray-700">期限超過の指摘</h2>
          <p className="text-4xl font-bold text-red-600 mt-2">{stats.overdue}</p>
          <Link to="/findings/incomplete?filter=overdue" className="mt-4 text-blue-600 hover:underline text-sm font-medium">
            詳細を見る &rarr;
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center text-center">
          <div className="bg-orange-100 p-4 rounded-full mb-4">
            <Clock className="text-orange-600" size={32} />
          </div>
          <h2 className="text-lg font-semibold text-gray-700">未完了の指摘</h2>
          <p className="text-4xl font-bold text-orange-600 mt-2">{stats.totalIncomplete}</p>
          <Link to="/findings/incomplete" className="mt-4 text-blue-600 hover:underline text-sm font-medium">
            一覧を見る &rarr;
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center text-center">
          <div className="bg-blue-100 p-4 rounded-full mb-4">
            <FileText className="text-blue-600" size={32} />
          </div>
          <h2 className="text-lg font-semibold text-gray-700">パトロール記録</h2>
          <p className="text-4xl font-bold text-blue-600 mt-2">{stats.totalPatrols}</p>
          <Link to="/patrols" className="mt-4 text-blue-600 hover:underline text-sm font-medium">
            パトロール一覧へ &rarr;
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-12">
        <h2 className="text-xl font-bold text-gray-900 mb-6">クイックアクション</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {canUseSafetyFeatures(profile?.role) && (
            <Link 
              to="/patrols/new"
              className="bg-blue-600 text-white rounded-xl p-6 flex items-center justify-between hover:bg-blue-700 transition-colors shadow-sm"
            >
              <div>
                <h3 className="font-bold text-lg">新規パトロール登録</h3>
                <p className="text-blue-100 text-sm mt-1">現場パトロールを開始する</p>
              </div>
              <div className="bg-blue-500 p-3 rounded-full">
                <FileText size={24} />
              </div>
            </Link>
          )}
          
          <Link 
            to="/sites"
            className="bg-white border border-gray-200 text-gray-800 rounded-xl p-6 flex items-center justify-between hover:bg-gray-50 transition-colors shadow-sm"
          >
            <div>
              <h3 className="font-bold text-lg">現場一覧</h3>
              <p className="text-gray-500 text-sm mt-1">登録されている現場の確認・管理</p>
            </div>
            <div className="bg-gray-100 p-3 rounded-full">
              <CheckCircle size={24} className="text-gray-600" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
