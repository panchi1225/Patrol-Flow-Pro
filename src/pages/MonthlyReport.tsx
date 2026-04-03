import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { format, parseISO, startOfMonth, endOfMonth, isAfter, isBefore, isEqual } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Printer, FileText, AlertCircle, CheckCircle, Clock, Repeat, ThumbsUp, MapPin, Calendar, Search } from 'lucide-react';
import { cn } from '../components/Layout';

interface Site {
  id: string;
  name: string;
}

interface Patrol {
  id: string;
  siteId: string;
  date: string;
}

interface Finding {
  id: string;
  patrolId: string;
  status: string;
  type: string;
  deadline?: string;
  isRecurrence?: boolean;
  categoryMajor?: string;
  categoryMiddle?: string;
  categoryMinor?: string;
  description?: string;
}

export default function MonthlyReport() {
  const [sites, setSites] = useState<Site[]>([]);
  const [targetMonth, setTargetMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [reportData, setReportData] = useState<{
    patrols: Patrol[];
    findings: Finding[];
  } | null>(null);

  // 手入力欄のステート
  const [trendText, setTrendText] = useState('');
  const [warningText, setWarningText] = useState('');
  const [nextFocusText, setNextFocusText] = useState('');

  useEffect(() => {
    const fetchSites = async () => {
      try {
        const sitesSnapshot = await getDocs(query(collection(db, 'sites'), orderBy('name')));
        const sitesData = sitesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Site[];
        setSites(sitesData);
      } catch (err) {
        console.error('Error fetching sites:', err);
      }
    };
    fetchSites();
  }, []);

  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    try {
      // 対象年月の開始日と終了日を計算
      const [year, month] = targetMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = format(endOfMonth(new Date(parseInt(year), parseInt(month) - 1)), 'yyyy-MM-dd');

      // パトロールの取得
      let patrolsQuery = query(
        collection(db, 'patrols'),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      
      const patrolsSnapshot = await getDocs(patrolsQuery);
      let patrolsData = patrolsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Patrol[];

      // 現場でフィルタリング
      if (selectedSiteId !== 'all') {
        patrolsData = patrolsData.filter(p => p.siteId === selectedSiteId);
      }

      // 指摘事項の取得
      const findingsData: Finding[] = [];
      if (patrolsData.length > 0) {
        // FirestoreのINクエリは最大10件までのため、チャンクに分割して取得
        const patrolIds = patrolsData.map(p => p.id);
        const chunkSize = 10;
        for (let i = 0; i < patrolIds.length; i += chunkSize) {
          const chunk = patrolIds.slice(i, i + chunkSize);
          const findingsQuery = query(
            collection(db, 'findings'),
            where('patrolId', 'in', chunk)
          );
          const findingsSnapshot = await getDocs(findingsQuery);
          findingsSnapshot.docs.forEach(doc => {
            findingsData.push({ id: doc.id, ...doc.data() } as Finding);
          });
        }
      }

      setReportData({
        patrols: patrolsData,
        findings: findingsData
      });
    } catch (err) {
      console.error('Error generating report:', err);
      setError('報告データの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // 集計ロジック
  const calculateStats = () => {
    if (!reportData) return null;

    const { findings } = reportData;
    const issues = findings.filter(f => f.type !== '好事例');
    const totalFindings = issues.length;
    const uncompletedFindings = issues.filter(f => f.status !== '完了');
    const completedFindings = issues.filter(f => f.status === '完了');
    
    // 期限超過
    const today = format(new Date(), 'yyyy-MM-dd');
    const overdueFindings = uncompletedFindings.filter(f => f.deadline && isBefore(parseISO(f.deadline), parseISO(today)));
    
    // 再発
    const recurringFindings = issues.filter(f => f.isRecurrence);
    
    // 好事例
    const goodPractices = findings.filter(f => f.type === '好事例');
    
    // 是正確認済率
    const completionRate = totalFindings > 0 
      ? Math.round((completedFindings.length / totalFindings) * 100) 
      : 0;

    // 大分類別件数
    const majorCategoryCounts = issues.reduce((acc, curr) => {
      const cat = curr.categoryMajor || '未分類';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 現場別件数
    const siteCounts = reportData.patrols.reduce((acc, patrol) => {
      const site = sites.find(s => s.id === patrol.siteId)?.name || '不明な現場';
      const siteFindings = issues.filter(f => f.patrolId === patrol.id).length;
      acc[site] = (acc[site] || 0) + siteFindings;
      return acc;
    }, {} as Record<string, number>);

    // 状態別件数
    const statusCounts = issues.reduce((acc, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalFindings,
      uncompletedCount: uncompletedFindings.length,
      overdueCount: overdueFindings.length,
      recurringCount: recurringFindings.length,
      goodPracticeCount: goodPractices.length,
      completionRate,
      majorCategoryCounts,
      siteCounts,
      statusCounts,
      recurringFindings,
      overdueFindings,
      goodPractices
    };
  };

  const stats = calculateStats();
  const selectedSiteName = selectedSiteId === 'all' 
    ? '全現場' 
    : sites.find(s => s.id === selectedSiteId)?.name || '不明な現場';

  return (
    <div className="flex flex-col h-full">
      {/* 印刷時に非表示にするコントロールパネル */}
      <div className="print:hidden mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6 shrink-0 overflow-hidden max-w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <FileText className="mr-3 text-blue-600" size={28} />
              月次報告出力
            </h1>
            <p className="text-gray-500 mt-2">指定した年月の安全パトロール結果を集計し、報告書形式で出力します。</p>
          </div>
          <div className="flex flex-wrap w-full md:w-auto gap-3">
            <button
              onClick={handleGenerateReport}
              disabled={loading}
              className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm font-medium whitespace-nowrap flex-1 sm:flex-none"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              ) : (
                <Search size={18} className="mr-2" />
              )}
              報告を作成
            </button>
            <button
              onClick={handlePrint}
              disabled={!reportData}
              className="flex items-center justify-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm font-medium whitespace-nowrap flex-1 sm:flex-none"
            >
              <Printer size={18} className="mr-2 text-gray-500" />
              印刷 / PDF保存
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full">
          <div className="w-full min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-2">対象年月</label>
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar size={18} className="text-gray-400" />
              </div>
              <input
                type="month"
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                className="block w-full box-border pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-base m-0 truncate appearance-none"
                style={{ minWidth: 0, maxWidth: '100%' }}
              />
            </div>
          </div>
          <div className="w-full min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-2">対象現場</label>
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MapPin size={18} className="text-gray-400" />
              </div>
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className="block w-full box-border pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white text-base m-0 truncate"
              >
                <option value="all">すべての現場</option>
                {sites.map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
            <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* プレビューエリア（印刷対象） */}
      <div className="flex-1 overflow-y-auto print:overflow-visible">
        {reportData && stats ? (
          <div className="bg-white shadow-sm border border-gray-200 rounded-xl max-w-5xl mx-auto p-8 md:p-12 print:shadow-none print:border-none print:p-0 print:max-w-none">
            
            {/* 1. 基本情報 */}
            <div className="text-center mb-10 border-b-2 border-gray-800 pb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">安全パトロール月次報告書</h1>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end text-gray-700 font-medium text-lg gap-4">
                <div className="text-left">
                  <p>対象年月：{targetMonth.replace('-', '年')}月</p>
                  <p className="break-words whitespace-normal">対象現場：{selectedSiteName}</p>
                </div>
                <div className="text-left md:text-right shrink-0">
                  <p>作成日：{format(new Date(), 'yyyy年MM月dd日')}</p>
                </div>
              </div>
            </div>

            {/* 2. 主要集計 */}
            <div className="mb-10">
              <h2 className="text-xl font-bold text-gray-800 mb-4 border-l-4 border-blue-600 pl-3">主要集計</h2>
              <div className="grid grid-cols-3 gap-4 print:gap-2">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center print:border-gray-300">
                  <div className="text-sm text-gray-500 font-medium mb-1">総指摘件数</div>
                  <div className="text-3xl font-bold text-gray-900">{stats.totalFindings} <span className="text-base font-normal text-gray-500">件</span></div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center print:border-gray-300">
                  <div className="text-sm text-gray-500 font-medium mb-1">未完了件数</div>
                  <div className="text-3xl font-bold text-amber-600">{stats.uncompletedCount} <span className="text-base font-normal text-gray-500">件</span></div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center print:border-gray-300">
                  <div className="text-sm text-gray-500 font-medium mb-1">是正確認済率</div>
                  <div className="text-3xl font-bold text-green-600">{stats.completionRate} <span className="text-base font-normal text-gray-500">%</span></div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center print:border-gray-300">
                  <div className="text-sm text-gray-500 font-medium mb-1">期限超過件数</div>
                  <div className="text-3xl font-bold text-red-600">{stats.overdueCount} <span className="text-base font-normal text-gray-500">件</span></div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center print:border-gray-300">
                  <div className="text-sm text-gray-500 font-medium mb-1">再発案件件数</div>
                  <div className="text-3xl font-bold text-orange-600">{stats.recurringCount} <span className="text-base font-normal text-gray-500">件</span></div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center print:border-gray-300">
                  <div className="text-sm text-gray-500 font-medium mb-1">好事例件数</div>
                  <div className="text-3xl font-bold text-blue-600">{stats.goodPracticeCount} <span className="text-base font-normal text-gray-500">件</span></div>
                </div>
              </div>
            </div>

            {/* 3. 集計表示 */}
            <div className="mb-10 grid grid-cols-1 xl:grid-cols-2 gap-8 print:gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4 border-l-4 border-blue-600 pl-3">大分類別件数</h2>
                <table className="w-full text-sm border-collapse border border-gray-300">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-700">大分類</th>
                      <th className="border border-gray-300 px-4 py-2 text-right font-semibold text-gray-700 w-24">件数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(stats.majorCategoryCounts).length > 0 ? (
                      (Object.entries(stats.majorCategoryCounts) as [string, number][])
                        .sort((a, b) => b[1] - a[1])
                        .map(([category, count]) => (
                        <tr key={category}>
                          <td className="border border-gray-300 px-4 py-2 text-gray-800">{category}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right font-medium">{count}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="border border-gray-300 px-4 py-4 text-center text-gray-500">データがありません</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {selectedSiteId === 'all' && (
                <div>
                  <h2 className="text-xl font-bold text-gray-800 mb-4 border-l-4 border-blue-600 pl-3">現場別件数</h2>
                  <table className="w-full text-sm border-collapse border border-gray-300">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-700">現場名</th>
                        <th className="border border-gray-300 px-4 py-2 text-right font-semibold text-gray-700 w-24">件数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(stats.siteCounts).length > 0 ? (
                        (Object.entries(stats.siteCounts) as [string, number][])
                          .sort((a, b) => b[1] - a[1])
                          .map(([site, count]) => (
                          <tr key={site}>
                            <td className="border border-gray-300 px-4 py-2 text-gray-800">{site}</td>
                            <td className="border border-gray-300 px-4 py-2 text-right font-medium">{count}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="border border-gray-300 px-4 py-4 text-center text-gray-500">データがありません</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 注目案件リスト */}
            <div className="mb-10 space-y-8">
              {stats.overdueFindings.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-red-700 mb-4 border-l-4 border-red-600 pl-3 flex items-center">
                    <Clock className="mr-2" size={20} />
                    期限超過案件 ({stats.overdueFindings.length}件)
                  </h2>
                  <table className="w-full text-sm border-collapse border border-gray-300">
                    <thead className="bg-red-50">
                      <tr>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 w-24">期限</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">現場</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">指摘内容</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.overdueFindings.slice(0, 5).map(finding => {
                        const patrol = reportData.patrols.find(p => p.id === finding.patrolId);
                        const site = sites.find(s => s.id === patrol?.siteId);
                        return (
                          <tr key={finding.id}>
                            <td className="border border-gray-300 px-3 py-2 text-red-600 font-medium">{finding.dueDate ? format(parseISO(finding.dueDate), 'MM/dd') : '-'}</td>
                            <td className="border border-gray-300 px-3 py-2 text-gray-800">{site?.name || '不明'}</td>
                            <td className="border border-gray-300 px-3 py-2 text-gray-800 truncate max-w-xs">{finding.description}</td>
                          </tr>
                        );
                      })}
                      {stats.overdueFindings.length > 5 && (
                        <tr>
                          <td colSpan={3} className="border border-gray-300 px-3 py-2 text-center text-gray-500 bg-gray-50">他 {stats.overdueFindings.length - 5} 件</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {stats.recurringFindings.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-orange-700 mb-4 border-l-4 border-orange-600 pl-3 flex items-center">
                    <Repeat className="mr-2" size={20} />
                    再発案件 ({stats.recurringFindings.length}件)
                  </h2>
                  <table className="w-full text-sm border-collapse border border-gray-300">
                    <thead className="bg-orange-50">
                      <tr>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 w-24">日付</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">現場</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">指摘内容</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recurringFindings.slice(0, 5).map(finding => {
                        const patrol = reportData.patrols.find(p => p.id === finding.patrolId);
                        const site = sites.find(s => s.id === patrol?.siteId);
                        return (
                          <tr key={finding.id}>
                            <td className="border border-gray-300 px-3 py-2 text-gray-800">{patrol?.date ? format(parseISO(patrol.date), 'MM/dd') : '-'}</td>
                            <td className="border border-gray-300 px-3 py-2 text-gray-800">{site?.name || '不明'}</td>
                            <td className="border border-gray-300 px-3 py-2 text-gray-800 truncate max-w-xs">{finding.description}</td>
                          </tr>
                        );
                      })}
                      {stats.recurringFindings.length > 5 && (
                        <tr>
                          <td colSpan={3} className="border border-gray-300 px-3 py-2 text-center text-gray-500 bg-gray-50">他 {stats.recurringFindings.length - 5} 件</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {stats.goodPracticeCount > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-blue-700 mb-4 border-l-4 border-blue-600 pl-3 flex items-center">
                    <ThumbsUp className="mr-2" size={20} />
                    好事例 ({stats.goodPracticeCount}件)
                  </h2>
                  <table className="w-full text-sm border-collapse border border-gray-300">
                    <thead className="bg-blue-50">
                      <tr>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 w-24">日付</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">現場</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">内容</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.goodPractices.slice(0, 5).map(finding => {
                        const patrol = reportData.patrols.find(p => p.id === finding.patrolId);
                        const site = sites.find(s => s.id === patrol?.siteId);
                        return (
                          <tr key={finding.id}>
                            <td className="border border-gray-300 px-3 py-2 text-gray-800">{patrol?.date ? format(parseISO(patrol.date), 'MM/dd') : '-'}</td>
                            <td className="border border-gray-300 px-3 py-2 text-gray-800">{site?.name || '不明'}</td>
                            <td className="border border-gray-300 px-3 py-2 text-gray-800 truncate max-w-xs">{finding.description}</td>
                          </tr>
                        );
                      })}
                      {stats.goodPractices.length > 5 && (
                        <tr>
                          <td colSpan={3} className="border border-gray-300 px-3 py-2 text-center text-gray-500 bg-gray-50">他 {stats.goodPractices.length - 5} 件</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 4. 手入力欄 */}
            <div className="space-y-6 print:break-inside-avoid">
              <h2 className="text-xl font-bold text-gray-800 mb-4 border-l-4 border-blue-600 pl-3">所見・コメント</h2>
              
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 print:bg-transparent print:border-gray-300 print:p-2">
                <label className="block text-sm font-bold text-gray-700 mb-2 print:text-gray-900">今月の傾向</label>
                <textarea
                  value={trendText}
                  onChange={(e) => setTrendText(e.target.value)}
                  placeholder="今月の安全パトロールで見られた全体的な傾向を入力してください..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px] resize-y print:border-none print:resize-none print:p-0 print:bg-transparent print:min-h-0"
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 print:bg-transparent print:border-gray-300 print:p-2">
                <label className="block text-sm font-bold text-gray-700 mb-2 print:text-gray-900">要注意事項</label>
                <textarea
                  value={warningText}
                  onChange={(e) => setWarningText(e.target.value)}
                  placeholder="特に注意すべき事項、再発防止に向けた課題などを入力してください..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px] resize-y print:border-none print:resize-none print:p-0 print:bg-transparent print:min-h-0"
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 print:bg-transparent print:border-gray-300 print:p-2">
                <label className="block text-sm font-bold text-gray-700 mb-2 print:text-gray-900">来月の重点確認事項</label>
                <textarea
                  value={nextFocusText}
                  onChange={(e) => setNextFocusText(e.target.value)}
                  placeholder="来月のパトロールで重点的に確認する項目を入力してください..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px] resize-y print:border-none print:resize-none print:p-0 print:bg-transparent print:min-h-0"
                />
              </div>
            </div>

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 print:hidden">
            <FileText size={64} className="text-gray-300 mb-4" />
            <p className="text-lg">条件を指定して「報告を作成」ボタンをクリックしてください</p>
          </div>
        )}
      </div>
    </div>
  );
}
