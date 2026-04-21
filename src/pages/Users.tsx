import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { AppRole, canManageUsers } from '../lib/permissions';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Shield, User as UserIcon, AlertCircle } from 'lucide-react';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
}

const ROLES = [
  { value: 'admin', label: '管理者' },
  { value: 'safety', label: '安全担当' },
  { value: 'field', label: '現場担当' },
  { value: 'viewer', label: '閲覧者' },
];

const Users: React.FC = () => {
  const { profile, isAuthReady } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthReady || !profile) return;

    // Only admins can view the user list
    if (!canManageUsers(profile.role as AppRole)) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userData: UserProfile[] = [];
      snapshot.forEach((doc) => {
        userData.push({ uid: doc.id, ...doc.data() } as UserProfile);
      });
      setUsers(userData);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    return () => unsubscribe();
  }, [isAuthReady, profile]);

  const handleRoleChange = async (uid: string, newRole: string) => {
    // Prevent changing own role to avoid accidental lockout
    if (uid === profile?.uid) {
      alert('自身の権限は変更できません。');
      return;
    }

    setUpdatingId(uid);
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
      alert('権限の更新に失敗しました。');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">読み込み中...</div>;

  if (!canManageUsers(profile?.role as AppRole | undefined)) {
    return (
      <div className="p-12 text-center">
        <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
        <h3 className="text-xl font-bold text-gray-900 mb-2">アクセス権限がありません</h3>
        <p className="text-gray-500 mb-6">このページを表示するには管理者権限が必要です。</p>
        <Link to="/" className="text-blue-600 hover:underline">ダッシュボードに戻る</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <Link to="/" className="text-sm text-blue-600 hover:underline flex items-center">
          &larr; ダッシュボードに戻る
        </Link>
      </div>
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Shield className="mr-3 text-blue-600" size={32} />
          ユーザー管理
        </h1>
        <p className="text-gray-500 mt-2">システムを利用するユーザーの権限を設定します</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">ユーザー名</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">メールアドレス</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">権限</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.uid} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="bg-blue-100 p-2 rounded-full mr-3 shrink-0">
                        <UserIcon size={16} className="text-blue-600" />
                      </div>
                      <span className="font-medium text-gray-900">{user.displayName || '名称未設定'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {user.email}
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.uid, e.target.value)}
                      disabled={updatingId === user.uid || user.uid === profile.uid}
                      className={`px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        user.uid === profile.uid 
                          ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed' 
                          : 'bg-white border-gray-300 text-gray-900 cursor-pointer'
                      }`}
                    >
                      {ROLES.map(role => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                    {updatingId === user.uid && (
                      <span className="ml-2 text-xs text-blue-600 animate-pulse">更新中...</span>
                    )}
                    {user.uid === profile.uid && (
                      <span className="ml-2 text-xs text-gray-400">（自身）</span>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                    ユーザーが見つかりません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Users;
