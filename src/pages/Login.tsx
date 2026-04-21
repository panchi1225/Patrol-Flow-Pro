import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthError, sendPasswordReset, signInWithEmailPassword } from '../lib/firebase';
import { ShieldCheck } from 'lucide-react';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError(null);
      setInfoMessage(null);
      await signInWithEmailPassword(email, password);
      navigate('/');
    } catch (err) {
      if (err instanceof AuthError) {
        setError(err.message);
      } else {
        setError('ログインに失敗しました。管理者にお問い合わせください');
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setError('会社メールアドレスを入力してください');
      return;
    }

    try {
      setResetLoading(true);
      setError(null);
      setInfoMessage(null);
      await sendPasswordReset(email);
      setInfoMessage('パスワード再設定メールを送信しました');
    } catch (err) {
      if (err instanceof AuthError) {
        setError(err.message);
      } else {
        setError('パスワード再設定メールの送信に失敗しました');
        console.error(err);
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-8">
        <div className="flex justify-center">
          <div className="bg-blue-100 p-4 rounded-full">
            <ShieldCheck size={48} className="text-blue-600" />
          </div>
        </div>
        
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Patrol Flow</h1>
          <p className="text-gray-500">会社メールアドレスでログインしてください</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">
            {error}
          </div>
        )}

        {infoMessage && (
          <div className="bg-green-50 text-green-700 p-4 rounded-lg text-sm">
            {infoMessage}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              会社メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="example@company.co.jp"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || resetLoading}
            className="w-full bg-blue-600 text-white font-semibold py-4 px-6 rounded-xl hover:bg-blue-700 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        <button
          type="button"
          onClick={handlePasswordReset}
          disabled={loading || resetLoading}
          className="w-full text-blue-700 font-medium py-3 rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-50"
        >
          {resetLoading ? '送信中...' : 'パスワードを忘れた場合'}
        </button>
      </div>
    </div>
  );
};

export default Login;
