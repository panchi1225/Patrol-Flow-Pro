import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { BarChart3, AlertCircle, CheckCircle, Clock, Repeat, Star, Filter } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList
} from 'recharts';

interface Finding {
  id: string;
  siteId: string;
  type: string;
  categoryMajor: string;
  status: string;
  deadline: string;
  isRecurrence: boolean;
  createdAt: string;
}

interface Site {
  id: string;
  name: string;
}

const Analytics: React.FC = () => {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  // 絞り込みステート
  const [filterPeriod, setFilterPeriod] = useState<string>('');
  const [filterSite, setFilterSite] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const sitesSnapshot = await getDocs(collection(db, 'sites'));
        const sitesData: Site[] = [];
        sitesSnapshot.forEach((doc) => {
          sitesData.push({ id: doc.id, name: doc.data().name });
        });
        setSites(sitesData);

        const findingsSnapshot = await getDocs(collection(db, 'findings'));
        const findingsData: Finding[] = [];
        findingsSnapshot.forEach((doc) => {
          const data = doc.data();
          findingsData.push({
            id: doc.id,
            siteId: data.siteId,
            type: data.type,
            categoryMajor: data.categoryMajor,
            status: data.status,
            deadline: data.deadline,
            isRecurrence: data.isRecurrence || false,
            createdAt: data.createdAt,
          });
        });
        setFindings(findingsData);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // フィルタリング処理
  const filteredFindings = useMemo(() => {
    return findings.filter(finding => {
      if (filterPeriod && !finding.createdAt.startsWith(filterPeriod)) return false;
      if (filterSite && finding.siteId !== filterSite) return false;
      if (filterType && finding.type !== filterType) return false;
      if (filterStatus && finding.status !== filterStatus) return false;
      if (filterCategory && finding.categoryMajor !== filterCategory) return false;
      return true;
    });
  }, [findings, filterPeriod, filterSite, filterType, filterStatus, filterCategory]);

  // --- 基本集計データ ---
  const totalCount = filteredFindings.length;
  const incompleteCount = filteredFindings.filter(f => f.status !== '完了').length;
  const recurrenceCount = filteredFindings.filter(f => f.isRecurrence).length;
  const goodPracticeCount = filteredFindings.filter(f => f.type === '好事例').length;
  
  const today = new Date().toISOString().split('T')[0];
  const overdueCount = filteredFindings.filter(f => 
    f.type === '是正指示' && 
    f.status !== '完了' && 
    f.deadline && 
    f.deadline < today
  ).length;

  const completedCount = filteredFindings.filter(f => f.status === '完了').length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // --- グラフ用データ生成 ---
  const monthlyData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredFindings.forEach(f => {
      const month = f.createdAt.substring(0, 7);
      counts[month] = (counts[month] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name: name.replace('-', '/'), count }));
  }, [filteredFindings]);

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredFindings.forEach(f => {
      if (f.categoryMajor) counts[f.categoryMajor] = (counts[f.categoryMajor] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count }));
  }, [filteredFindings]);

  const siteData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredFindings.forEach(f => {
      const siteName = sites.find(s => s.id === f.siteId)?.name || '不明';
      counts[siteName] = (counts[siteName] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count }));
  }, [filteredFindings, sites]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredFindings.forEach(f => {
      if (f.status) counts[f.status] = (counts[f.status] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count }));
  }, [filteredFindings]);

  const recurrenceCategoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredFindings.filter(f => f.isRecurrence).forEach(f => {
      if (f.categoryMajor) counts[f.categoryMajor] = (counts[f.categoryMajor] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count }));
  }, [filteredFindings]);

  const overdueSiteData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredFindings.filter(f => f.type === '是正指示' && f.status !== '完了' && f.deadline && f.deadline < today).forEach(f => {
      const siteName = sites.find(s => s.id === f.siteId)?.name || '不明';
      counts[siteName] = (counts[siteName] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count }));
  }, [filteredFindings, sites, today]);

  // フィルター用の選択肢
  const periods = Array.from(new Set(findings.map(f => f.createdAt.substring(0, 7)))).sort().reverse();
  const types = Array.from(new Set(findings.map(f => f.type))).filter(Boolean);
  const statuses = Array.from(new Set(findings.map(f => f.status))).filter(Boolean);
  const categories = Array.from(new Set(findings.map(f => f.categoryMajor))).filter(Boolean);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // グラフの共通スタイル設定
  const axisStyle = { fontSize: 13, fill: '#4b5563', fontWeight: 500 };
  const gridStyle = { stroke: '#f3f4f6', strokeDasharray: '3 3' };
  const tooltipStyle = { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '8px 12px' };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <BarChart3 className="mr-3 text-blue-600" size={28} />
          集計・分析
        </h1>
      </div>

      {/* 1. 絞り込み条件 */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center text-gray-700 font-bold mb-4">
          <Filter size={18} className="mr-2" />
          絞り込み条件
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[160px]">
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-gray-50"
            >
              <option value="">すべての期間</option>
              {periods.map(p => <option key={p as string} value={p as string}>{(p as string).replace('-', '年')}月</option>)}
            </select>
          </div>

          <div className="flex-1 min-w-[160px]">
            <select
              value={filterSite}
              onChange={(e) => setFilterSite(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-gray-50"
            >
              <option value="">すべての現場</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="flex-1 min-w-[160px]">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-gray-50"
            >
              <option value="">すべての大分類</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex-1 min-w-[160px]">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-gray-50"
            >
              <option value="">すべての指摘区分</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="flex-1 min-w-[160px]">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-gray-50"
            >
              <option value="">すべての状態</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex-none">
            <button
              onClick={() => {
                setFilterPeriod('');
                setFilterSite('');
                setFilterType('');
                setFilterStatus('');
                setFilterCategory('');
              }}
              disabled={!(filterPeriod || filterSite || filterType || filterStatus || filterCategory)}
              className="h-full px-6 py-2.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors whitespace-nowrap"
            >
              条件クリア
            </button>
          </div>
        </div>
      </div>

      {/* 2. KPIカード */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
          <div className="text-sm font-bold text-gray-500 mb-2 whitespace-nowrap">総指摘件数</div>
          <div className="text-3xl font-bold text-gray-900 leading-none flex items-baseline justify-center">{totalCount} <span className="text-sm font-medium text-gray-500 ml-1">件</span></div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
          <div className="flex items-center justify-center text-sm font-bold text-orange-600 mb-2 whitespace-nowrap">
            <AlertCircle size={16} className="mr-1.5 shrink-0" /> 未完了
          </div>
          <div className="text-3xl font-bold text-orange-600 leading-none flex items-baseline justify-center">{incompleteCount} <span className="text-sm font-medium text-orange-400 ml-1">件</span></div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
          <div className="flex items-center justify-center text-sm font-bold text-red-600 mb-2 whitespace-nowrap">
            <Clock size={16} className="mr-1.5 shrink-0" /> 期限超過
          </div>
          <div className="text-3xl font-bold text-red-600 leading-none flex items-baseline justify-center">{overdueCount} <span className="text-sm font-medium text-red-400 ml-1">件</span></div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
          <div className="flex items-center justify-center text-sm font-bold text-amber-600 mb-2 whitespace-nowrap">
            <Repeat size={16} className="mr-1.5 shrink-0" /> 再発案件
          </div>
          <div className="text-3xl font-bold text-amber-600 leading-none flex items-baseline justify-center">{recurrenceCount} <span className="text-sm font-medium text-amber-400 ml-1">件</span></div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
          <div className="flex items-center justify-center text-sm font-bold text-green-600 mb-2 whitespace-nowrap">
            <Star size={16} className="mr-1.5 shrink-0" /> 好事例
          </div>
          <div className="text-3xl font-bold text-green-600 leading-none flex items-baseline justify-center">{goodPracticeCount} <span className="text-sm font-medium text-green-400 ml-1">件</span></div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
          <div className="flex items-center justify-center text-sm font-bold text-blue-600 mb-2 whitespace-nowrap">
            <CheckCircle size={16} className="mr-1.5 shrink-0" /> 是正確認済
          </div>
          <div className="text-3xl font-bold text-blue-600 leading-none flex items-baseline justify-center">{completionRate} <span className="text-sm font-medium text-blue-400 ml-1">%</span></div>
        </div>
      </div>

      {/* 3. グラフ群 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* 月別指摘件数 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <h3 className="text-lg font-bold text-gray-800 mb-6 text-center">月別指摘件数</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 20, right: 20, bottom: 0, left: -20 }}>
                <CartesianGrid {...gridStyle} vertical={false} />
                <XAxis dataKey="name" tick={axisStyle} axisLine={{ stroke: '#d1d5db' }} tickLine={false} dy={10} />
                <YAxis allowDecimals={false} tick={axisStyle} axisLine={false} tickLine={false} dx={-10} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f9fafb' }} />
                <Bar dataKey="count" name="件数" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  <LabelList dataKey="count" position="top" fill="#4b5563" fontSize={13} fontWeight={600} dy={-5} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 状態別件数 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <h3 className="text-lg font-bold text-gray-800 mb-6 text-center">状態別件数</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} margin={{ top: 20, right: 20, bottom: 0, left: -20 }}>
                <CartesianGrid {...gridStyle} vertical={false} />
                <XAxis dataKey="name" tick={axisStyle} axisLine={{ stroke: '#d1d5db' }} tickLine={false} dy={10} />
                <YAxis allowDecimals={false} tick={axisStyle} axisLine={false} tickLine={false} dx={-10} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f9fafb' }} />
                <Bar dataKey="count" name="件数" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={64}>
                  <LabelList dataKey="count" position="top" fill="#4b5563" fontSize={13} fontWeight={600} dy={-5} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 大分類別件数 (横棒) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <h3 className="text-lg font-bold text-gray-800 mb-6 text-center">大分類別件数（上位10件）</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 20 }}>
                <CartesianGrid {...gridStyle} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={120} tick={axisStyle} axisLine={{ stroke: '#d1d5db' }} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f9fafb' }} />
                <Bar dataKey="count" name="件数" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  <LabelList dataKey="count" position="right" fill="#4b5563" fontSize={13} fontWeight={600} dx={5} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 現場別件数 (横棒) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <h3 className="text-lg font-bold text-gray-800 mb-6 text-center">現場別件数（上位10件）</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={siteData.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 20 }}>
                <CartesianGrid {...gridStyle} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={120} tick={axisStyle} axisLine={{ stroke: '#d1d5db' }} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f9fafb' }} />
                <Bar dataKey="count" name="件数" fill="#8b5cf6" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  <LabelList dataKey="count" position="right" fill="#4b5563" fontSize={13} fontWeight={600} dx={5} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 再発案件（大分類別） */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <h3 className="text-lg font-bold text-gray-800 mb-6 text-center">再発が多い大分類（上位8件）</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={recurrenceCategoryData.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 20 }}>
                <CartesianGrid {...gridStyle} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={120} tick={axisStyle} axisLine={{ stroke: '#d1d5db' }} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f9fafb' }} />
                <Bar dataKey="count" name="再発件数" fill="#f59e0b" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  <LabelList dataKey="count" position="right" fill="#4b5563" fontSize={13} fontWeight={600} dx={5} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 期限超過（現場別） */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <h3 className="text-lg font-bold text-gray-800 mb-6 text-center">期限超過が多い現場（上位8件）</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overdueSiteData.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 20 }}>
                <CartesianGrid {...gridStyle} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={120} tick={axisStyle} axisLine={{ stroke: '#d1d5db' }} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f9fafb' }} />
                <Bar dataKey="count" name="期限超過件数" fill="#ef4444" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  <LabelList dataKey="count" position="right" fill="#4b5563" fontSize={13} fontWeight={600} dx={5} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Analytics;
