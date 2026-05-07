import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, onSnapshot, deleteDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { canUseSafetyFeatures } from '../lib/permissions';
import { useAuth } from '../contexts/AuthContext';
import { ClipboardList, Calendar, User, ArrowLeft, MapPin, Plus, AlertCircle, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Patrol {
  id: string;
  date: string;
  siteId: string;
  inspector: string;
  mainWork: string;
  weather: string;
  notes: string;
  status: string;
}

interface Site {
  id: string;
  name: string;
  shortName: string;
}

interface Finding {
  id: string;
  type: string;
  description: string;
  status: string;
  urgency?: string;
}

const getStatusDisplay = (status: string) => {
  switch (status) {
    case 'draft': return { label: '下書き', className: 'bg-gray-100 text-gray-700' };
    case 'registered': return { label: '登録済', className: 'bg-blue-100 text-blue-700' };
    case 'following': return { label: 'フォロー中', className: 'bg-yellow-100 text-yellow-700' };
    case 'completed': return { label: '完了', className: 'bg-green-100 text-green-700' };
    default: return { label: '下書き', className: 'bg-gray-100 text-gray-700' };
  }
};

const PatrolDetail: React.FC = () => {
  const { patrolId } = useParams<{ patrolId: string }>();
  const { profile, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const [patrol, setPatrol] = useState<Patrol | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthReady || !profile || !patrolId) return;

    const fetchPatrolAndSite = async () => {
      try {
        const patrolDoc = await getDoc(doc(db, 'patrols', patrolId));
        if (patrolDoc.exists()) {
          const patrolData = { id: patrolDoc.id, ...patrolDoc.data() } as Patrol;
          setPatrol(patrolData);

          const siteDoc = await getDoc(doc(db, 'sites', patrolData.siteId));
          if (siteDoc.exists()) {
            setSite({ id: siteDoc.id, ...siteDoc.data() } as Site);
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `patrols/${patrolId}`);
      }
    };

    fetchPatrolAndSite();

    const qFindings = query(collection(db, 'findings'), where('patrolId', '==', patrolId));
    const unsubscribeFindings = onSnapshot(qFindings, (snapshot) => {
      const findingData: Finding[] = [];
      snapshot.forEach((doc) => {
        findingData.push({ id: doc.id, ...doc.data() } as Finding);
      });
      setFindings(findingData);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'findings'));

    return () => unsubscribeFindings();
  }, [isAuthReady, profile, patrolId]);

  if (loading) return <div className="p-8 text-center text-gray-500">読み込み中...</div>;
  if (!patrol) return <div className="p-8 text-center text-red-500">パトロール記録が見つかりません。</div>;


  const handleDeletePatrol = async () => {
    if (!patrolId || !canUseSafetyFeatures(profile?.role)) return;
    if (!window.confirm('このパトロール記録を削除します。紐づく指摘記録も削除されます。よろしいですか？')) return;
    try {
      const findingsSnap = await getDocs(query(collection(db, 'findings'), where('patrolId', '==', patrolId)));
      await Promise.all(findingsSnap.docs.map((d) => deleteDoc(d.ref)));
      await deleteDoc(doc(db, 'patrols', patrolId));
      navigate('/patrols');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `patrols/${patrolId}`);
    }
  };
  const handleExportPatrolSummaryPdf = () => {
    if (!patrol) return;
    const inspectedAt = format(parseISO(patrol.date), 'yyyy/MM/dd');
    const issueRows = issues.map((f, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${f.type}</td>
        <td>${f.status}</td>
        <td>${f.urgency ?? '-'}</td>
        <td>${(f.description || '-').replace(/</g, '&lt;')}</td>
      </tr>
    `).join('');
    const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8" />
      <title>パトロール結果</title>
      <style>
        @page { size: A4 portrait; margin: 12mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 11px; color: #111827; }
        h1 { font-size: 18px; margin: 0 0 12px; } h2 { font-size: 13px; margin: 12px 0 6px; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; } th, td { border: 1px solid #d1d5db; padding: 4px; vertical-align: top; word-break: break-word; }
        th { background: #f3f4f6; } .note { white-space: pre-wrap; border: 1px solid #d1d5db; padding: 6px; min-height: 48px; }
      </style></head><body>
      <h1>パトロール結果報告書</h1>
      <div class="meta">
        <div><strong>現場名:</strong> ${site?.name ?? '-'}</div><div><strong>実施日:</strong> ${inspectedAt}</div>
        <div><strong>実施者:</strong> ${patrol.inspector || '-'}</div><div><strong>天候:</strong> ${patrol.weather || '-'}</div>
      </div>
      <h2>当日の主作業</h2><div class="note">${(patrol.mainWork || '-').replace(/</g, '&lt;')}</div>
      <h2>指摘事項（${issues.length}件）</h2>
      <table><thead><tr><th style="width:6%">No</th><th style="width:14%">区分</th><th style="width:14%">状態</th><th style="width:14%">緊急度</th><th>内容</th></tr></thead>
      <tbody>${issueRows || '<tr><td colspan="5">指摘事項なし</td></tr>'}</tbody></table>
      <h2>特記事項</h2><div class="note">${(patrol.notes || '-').replace(/</g, '&lt;')}</div>
      </body></html>`;
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1200');
    if (!printWindow) {
      alert('PDF出力ウィンドウを開けませんでした。ポップアップブロックを解除してください。');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const issues = findings.filter(f => f.type !== '好事例');
  const goodPractices = findings.filter(f => f.type === '好事例');

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <button onClick={() => window.history.back()} className="inline-flex items-center text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={20} className="mr-2" />
          戻る
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-100 p-4 rounded-xl shrink-0">
              <ClipboardList className="text-blue-600" size={32} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusDisplay(patrol.status).className}`}>
                  {getStatusDisplay(patrol.status).label}
                </span>
                <span className="text-sm text-gray-500 flex items-center">
                  <Calendar size={14} className="mr-1" />
                  {format(parseISO(patrol.date), 'yyyy/MM/dd')}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center">
                <MapPin size={24} className="mr-2 text-gray-400 shrink-0" />
                <span className="line-clamp-1">{site?.name || '不明な現場'}</span>
              </h1>
            </div>
          </div>
          {canUseSafetyFeatures(profile?.role) && (
            <button onClick={handleDeletePatrol} className="bg-red-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-red-700 transition-colors flex items-center">
              <Trash2 size={16} className="mr-1" />削除
            </button>
          )}
          <button
            onClick={handleExportPatrolSummaryPdf}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-700 transition-colors flex items-center"
          >
            現場向けPDF出力
          </button>
          {canUseSafetyFeatures(profile?.role) && patrol.status === 'draft' && (
            <Link
              to={`/patrols/${patrol.id}/findings/new`}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center shadow-sm w-full sm:w-auto justify-center shrink-0"
            >
              <Plus size={20} className="mr-2" />
              指摘事項を追加
            </Link>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">パトロール情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">実施者</p>
              <p className="font-medium text-gray-900 flex items-center">
                <User size={16} className="mr-2 text-gray-400" />
                {patrol.inspector}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">天候</p>
              <p className="font-medium text-gray-900">{patrol.weather || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">当日の主作業</p>
              <p className="font-medium text-gray-900">{patrol.mainWork || '-'}</p>
            </div>
            {patrol.notes && (
              <div className="md:col-span-2 xl:col-span-4">
                <p className="text-sm text-gray-500 mb-1">特記事項</p>
                <p className="text-gray-700 whitespace-pre-wrap">{patrol.notes}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4 border-b pb-2">
            <h2 className="text-xl font-bold text-gray-900">指摘事項一覧</h2>
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
              {issues.length}件
            </span>
          </div>
          
          <div className="space-y-4">
            {issues.map(finding => (
              <Link key={finding.id} to={`/findings/${finding.id}`} className="block border border-gray-200 rounded-xl p-5 hover:bg-gray-50 transition-colors group">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        finding.status === '未対応' ? 'bg-red-100 text-red-700' :
                        finding.status === '対応中' ? 'bg-blue-100 text-blue-700' :
                        finding.status === '確認待ち' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {finding.status}
                      </span>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                        {finding.type}
                      </span>
                      {finding.urgency && finding.urgency !== 'なし' && (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          finding.urgency === '即時是正' ? 'bg-red-100 text-red-700 border border-red-200' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {finding.urgency}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-900 font-bold text-lg line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">{finding.description}</p>
                    
                    {finding.deadline && (
                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar size={14} className="mr-1" />
                        期限: {format(parseISO(finding.deadline), 'yyyy/MM/dd')}
                      </div>
                    )}
                  </div>
                  <div className="hidden sm:flex text-blue-600 font-medium text-sm whitespace-nowrap">
                    詳細 &rarr;
                  </div>
                </div>
              </Link>
            ))}
            {issues.length === 0 && (
              <div className="text-center py-8">
                <AlertCircle className="mx-auto text-gray-400 mb-2" size={32} />
                <p className="text-gray-500">指摘事項は登録されていません。</p>
              </div>
            )}
          </div>
        </div>

        {goodPractices.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h2 className="text-xl font-bold text-gray-900">好事例一覧</h2>
              <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                {goodPractices.length}件
              </span>
            </div>
            
            <div className="space-y-4">
              {goodPractices.map(finding => (
                <Link key={finding.id} to={`/findings/${finding.id}`} className="block border border-gray-200 rounded-xl p-5 hover:bg-gray-50 transition-colors group">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                          {finding.type}
                        </span>
                      </div>
                      <p className="text-gray-900 font-bold text-lg line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">{finding.description}</p>
                    </div>
                    <div className="hidden sm:flex text-blue-600 font-medium text-sm whitespace-nowrap">
                      詳細 &rarr;
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatrolDetail;
