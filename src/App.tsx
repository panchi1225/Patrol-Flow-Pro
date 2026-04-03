import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sites from './pages/Sites';
import SiteDetail from './pages/SiteDetail';
import SiteNew from './pages/SiteNew';
import Patrols from './pages/Patrols';
import PatrolDetail from './pages/PatrolDetail';
import PatrolNew from './pages/PatrolNew';
import IncompleteFindings from './pages/IncompleteFindings';
import FindingDetail from './pages/FindingDetail';
import FindingNew from './pages/FindingNew';
import GoodPractices from './pages/GoodPractices';
import Recurrences from './pages/Recurrences';
import Analytics from './pages/Analytics';
import MonthlyReport from './pages/MonthlyReport';
import Users from './pages/Users';

import CategoryMaster from './pages/CategoryMaster';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthReady } = useAuth();
  
  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">読み込み中...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

function ErrorFallback({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm max-w-lg w-full">
        <h2 className="text-2xl font-bold text-red-600 mb-4">エラーが発生しました</h2>
        <pre className="bg-gray-100 p-4 rounded-lg text-sm text-gray-800 overflow-auto whitespace-pre-wrap mb-6">
          {error.message}
        </pre>
        <button
          onClick={resetErrorBoundary}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          再読み込み
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              
              <Route path="sites">
                <Route index element={<Sites />} />
                <Route path="new" element={<SiteNew />} />
                <Route path=":siteId" element={<SiteDetail />} />
              </Route>
              
              <Route path="patrols">
                <Route index element={<Patrols />} />
                <Route path="new" element={<PatrolNew />} />
                <Route path=":patrolId" element={<PatrolDetail />} />
                <Route path=":patrolId/findings/new" element={<FindingNew />} />
              </Route>
              
              <Route path="findings">
                <Route path="incomplete" element={<IncompleteFindings />} />
                <Route path="good-practices" element={<GoodPractices />} />
                <Route path="recurrences" element={<Recurrences />} />
                <Route path=":findingId" element={<FindingDetail />} />
              </Route>
              
              <Route path="analytics" element={<Analytics />} />
              <Route path="monthly-report" element={<MonthlyReport />} />
              
              <Route path="categories" element={<CategoryMaster />} />
              
              <Route path="users" element={<Users />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
