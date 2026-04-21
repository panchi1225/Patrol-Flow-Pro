import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, collection, query, where, onSnapshot, addDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, uploadPhoto } from '../lib/firebase';
import { canUseFieldFeatures, canUseSafetyFeatures } from '../lib/permissions';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, AlertCircle, CheckCircle, Clock, MapPin, FileText, User, Camera, X } from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';

interface Finding {
  id: string;
  patrolId: string;
  siteId: string;
  type: string;
  urgency?: string;
  categoryMajor?: string;
  categoryMiddle?: string;
  categoryMinor?: string;
  categoryOtherReason?: string;
  description: string;
  location?: string;
  correctionInstruction?: string;
  deadline?: string;
  notes?: string;
  isRecurrence?: boolean;
  status: string;
  photoUrl?: string;
}

interface CorrectiveAction {
  id: string;
  findingId: string;
  date: string;
  description: string;
  inputter: string;
  photoUrl?: string;
}

interface Confirmation {
  id: string;
  findingId: string;
  date: string;
  confirmer: string;
  result: string;
  comment?: string;
}

const FindingDetail: React.FC = () => {
  const { findingId } = useParams<{ findingId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, isAuthReady } = useAuth();
  const [finding, setFinding] = useState<Finding | null>(null);
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [actionDescription, setActionDescription] = useState('');
  const [actionPhotoFile, setActionPhotoFile] = useState<File | null>(null);
  const [actionPhotoPreview, setActionPhotoPreview] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState('完了');
  const [confirmationComment, setConfirmationComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthReady || !profile || !findingId) return;

    const fetchFinding = async () => {
      try {
        const findingDoc = await getDoc(doc(db, 'findings', findingId));
        if (findingDoc.exists()) {
          setFinding({ id: findingDoc.id, ...findingDoc.data() } as Finding);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `findings/${findingId}`);
      }
    };

    fetchFinding();

    const qActions = query(collection(db, 'corrective_actions'), where('findingId', '==', findingId));
    const unsubscribeActions = onSnapshot(qActions, (snapshot) => {
      const actionData: CorrectiveAction[] = [];
      snapshot.forEach((doc) => {
        actionData.push({ id: doc.id, ...doc.data() } as CorrectiveAction);
      });
      actionData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActions(actionData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'corrective_actions'));

    const qConfirmations = query(collection(db, 'confirmations'), where('findingId', '==', findingId));
    const unsubscribeConfirmations = onSnapshot(qConfirmations, (snapshot) => {
      const confirmationData: Confirmation[] = [];
      snapshot.forEach((doc) => {
        confirmationData.push({ id: doc.id, ...doc.data() } as Confirmation);
      });
      confirmationData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setConfirmations(confirmationData);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'confirmations'));

    return () => {
      unsubscribeActions();
      unsubscribeConfirmations();
    };
  }, [isAuthReady, profile, findingId]);

  const handleActionPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setActionPhotoFile(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setActionPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearActionPhoto = () => {
    setActionPhotoFile(null);
    setActionPhotoPreview(null);
  };

  const handleAddAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !findingId) {
      setActionError('ユーザー情報または指摘事項IDが取得できません。');
      return;
    }
    if (!canUseFieldFeatures(profile.role)) {
      setActionError('この操作を実行する権限がありません。');
      return;
    }

    setSubmitting(true);
    setActionError(null);
    setActionStatus('入力確認中...');
    
    try {
      let photoUrl = '';
      if (actionPhotoFile) {
        setActionStatus('写真アップロード中...');
        try {
          const path = `actions/${profile.uid}/${Date.now()}_${actionPhotoFile.name}`;
          photoUrl = await uploadPhoto(actionPhotoFile, path);
          setActionStatus('写真URL取得中...');
        } catch (uploadError: any) {
          console.error("Photo upload failed:", uploadError);
          const errorMessage = uploadError.message || '写真のアップロードに失敗しました。権限やネットワークを確認してください。';
          setActionError(errorMessage);
          setSubmitting(false);
          setActionStatus(null);
          return;
        }
      }

      setActionStatus('Firestoreへ保存中...');
      await addDoc(collection(db, 'corrective_actions'), {
        findingId,
        date: new Date().toISOString(),
        description: actionDescription,
        inputter: profile.displayName,
        photoUrl,
      });

      // Update finding status to '確認待ち'
      await updateDoc(doc(db, 'findings', findingId), {
        status: '確認待ち'
      });

      setActionStatus('保存完了');
      setIsActionModalOpen(false);
      setActionDescription('');
      clearActionPhoto();
    } catch (err) {
      console.error("Save failed:", err);
      setActionStatus('保存失敗');
      setActionError('保存処理に失敗しました。必須項目や権限を確認してください。');
      try {
        handleFirestoreError(err, OperationType.CREATE, 'corrective_actions');
      } catch (e) {
        // handleFirestoreError throws, so we catch it to prevent crashing the app
      }
    } finally {
      setSubmitting(false);
      setTimeout(() => setActionStatus(null), 3000);
    }
  };

  const handleAddConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !findingId) return;
    if (!canUseSafetyFeatures(profile.role)) {
      alert('この操作を実行する権限がありません。');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'confirmations'), {
        findingId,
        date: new Date().toISOString(),
        confirmer: profile.displayName,
        result: confirmationResult,
        comment: confirmationComment,
      });

      // Update finding status based on result
      await updateDoc(doc(db, 'findings', findingId), {
        status: confirmationResult === '完了' ? '完了' : '再是正'
      });

      setIsConfirmationModalOpen(false);
      setConfirmationResult('完了');
      setConfirmationComment('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'confirmations');
      alert('確認結果の登録に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">読み込み中...</div>;
  if (!finding) return <div className="p-8 text-center text-red-500">指摘事項が見つかりません。</div>;

  const isOverdue = finding.deadline && isPast(parseISO(finding.deadline)) && finding.status !== '完了';

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate(`/patrols/${finding.patrolId}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <button onClick={handleBack} className="inline-flex items-center text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={20} className="mr-2" />
          戻る
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-100 p-4 rounded-xl">
              <AlertCircle className="text-blue-600" size={32} />
            </div>
            <div>
              <div className="flex items-center space-x-3 mb-1">
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  finding.status === '未対応' ? 'bg-red-100 text-red-700' :
                  finding.status === '対応中' ? 'bg-blue-100 text-blue-700' :
                  finding.status === '確認待ち' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {finding.status}
                </span>
                <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                  {finding.type}
                </span>
                {finding.urgency && (
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                    finding.urgency === '即時是正' ? 'bg-red-100 text-red-700 border border-red-200' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {finding.urgency}
                  </span>
                )}
                {isOverdue && (
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-600 text-white animate-pulse">
                    期限超過
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mt-2">{finding.description}</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-2">{finding.type === '好事例' ? '好事例詳細' : '指摘詳細'}</h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {finding.location && (
              <div>
                <p className="text-sm text-gray-500 mb-1">発生場所</p>
                <p className="font-medium text-gray-900 flex items-center">
                  <MapPin size={16} className="mr-2 text-gray-400" />
                  {finding.location}
                </p>
              </div>
            )}
            {finding.deadline && (
              <div>
                <p className="text-sm text-gray-500 mb-1">是正期限</p>
                <p className={`font-medium flex items-center ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                  <Clock size={16} className="mr-2" />
                  {format(parseISO(finding.deadline), 'yyyy/MM/dd')}
                </p>
              </div>
            )}
            {(finding.categoryMajor || finding.categoryMiddle || finding.categoryMinor) && (
              <div className="lg:col-span-2">
                <p className="text-sm text-gray-500 mb-1">分類</p>
                <div className="flex flex-wrap items-center gap-2">
                  {finding.categoryMajor && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium border border-gray-200">
                      {finding.categoryMajor}
                    </span>
                  )}
                  {finding.categoryMiddle && (
                    <>
                      <span className="text-gray-400">&gt;</span>
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium border border-gray-200">
                        {finding.categoryMiddle}
                      </span>
                    </>
                  )}
                  {finding.categoryMinor && (
                    <>
                      <span className="text-gray-400">&gt;</span>
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium border border-gray-200">
                        {finding.categoryMinor === 'その他' && finding.categoryOtherReason 
                          ? `その他（${finding.categoryOtherReason}）` 
                          : finding.categoryMinor}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
            {finding.correctionInstruction && (
              <div className="lg:col-span-2">
                <p className="text-sm text-gray-500 mb-1">是正内容（指示）</p>
                <p className="font-medium text-gray-900 bg-red-50 p-4 rounded-xl border border-red-100">
                  {finding.correctionInstruction}
                </p>
              </div>
            )}
            {finding.notes && (
              <div className="lg:col-span-2">
                <p className="text-sm text-gray-500 mb-1">備考</p>
                <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-xl border border-gray-100">{finding.notes}</p>
              </div>
            )}
            {finding.isRecurrence && (
              <div className="lg:col-span-2 bg-orange-50 border border-orange-200 p-4 rounded-xl flex items-center text-orange-800">
                <AlertCircle size={20} className="mr-2 shrink-0" />
                <span className="font-bold">再発案件</span>
              </div>
            )}
            {finding.photoUrl && (
              <div className="lg:col-span-2 mt-4">
                <p className="text-sm text-gray-500 mb-2">写真</p>
                <img src={finding.photoUrl} alt="指摘写真" className="max-w-full h-auto max-h-96 rounded-xl border border-gray-200" />
              </div>
            )}
          </div>
        </div>

        {finding.type !== '好事例' && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
              <div className="flex items-center justify-between mb-6 border-b pb-2">
                <h2 className="text-xl font-bold text-gray-900">是正対応履歴</h2>
                {canUseFieldFeatures(profile?.role) && finding.status !== '完了' && (
                  <button 
                    onClick={() => setIsActionModalOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    対応を登録
                  </button>
                )}
              </div>
              
              <ul className="space-y-4">
                {actions.map(action => (
                  <li key={action.id} className="border border-gray-200 rounded-xl p-5 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-gray-900 flex items-center">
                        <Clock size={16} className="mr-2 text-gray-400" />
                        {format(parseISO(action.date), 'yyyy/MM/dd')}
                      </span>
                      <span className="text-sm text-gray-500 flex items-center bg-white px-3 py-1 rounded-full border border-gray-200">
                        <User size={14} className="mr-1" />
                        {action.inputter}
                      </span>
                    </div>
                    <p className="text-gray-800 whitespace-pre-wrap">{action.description}</p>
                    {action.photoUrl && (
                      <div className="mt-3">
                        <img src={action.photoUrl} alt="対応写真" className="max-w-full h-auto max-h-64 rounded-xl border border-gray-200" />
                      </div>
                    )}
                  </li>
                ))}
                {actions.length === 0 && (
                  <li className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <FileText className="mx-auto mb-2 text-gray-400" size={24} />
                    是正対応の記録はありません
                  </li>
                )}
              </ul>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
              <div className="flex items-center justify-between mb-6 border-b pb-2">
                <h2 className="text-xl font-bold text-gray-900">是正確認履歴</h2>
                {canUseSafetyFeatures(profile?.role) && finding.status === '確認待ち' && (
                  <button 
                    onClick={() => setIsConfirmationModalOpen(true)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-sm"
                  >
                    確認結果を登録
                  </button>
                )}
              </div>
              
              <ul className="space-y-4">
                {confirmations.map(conf => (
                  <li key={conf.id} className={`border rounded-xl p-5 ${conf.result === '完了' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-gray-900 flex items-center">
                        <Clock size={16} className="mr-2 text-gray-400" />
                        {format(parseISO(conf.date), 'yyyy/MM/dd')}
                      </span>
                      <span className={`px-3 py-1 text-sm font-bold rounded-full shadow-sm ${conf.result === '完了' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                        {conf.result}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 flex items-center mb-3 bg-white/50 inline-flex px-3 py-1 rounded-full border border-gray-200">
                      <User size={14} className="mr-1" />
                      確認者: {conf.confirmer}
                    </div>
                    {conf.comment && (
                      <p className="text-gray-800 whitespace-pre-wrap mt-2 bg-white/50 p-3 rounded-lg border border-gray-200">{conf.comment}</p>
                    )}
                  </li>
                ))}
                {confirmations.length === 0 && (
                  <li className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <CheckCircle className="mx-auto mb-2 text-gray-400" size={24} />
                    確認記録はありません
                  </li>
                )}
              </ul>
            </div>
          </>
        )}
      </div>

      {/* Action Modal */}
      {isActionModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">是正対応の登録</h3>
              <button onClick={() => setIsActionModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            {actionError && (
              <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start">
                <AlertCircle size={20} className="mr-2 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}
            <form onSubmit={handleAddAction} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">対応内容 <span className="text-red-500">*</span></label>
                <textarea
                  required
                  rows={4}
                  value={actionDescription}
                  onChange={(e) => setActionDescription(e.target.value)}
                  placeholder="実施した是正内容を入力してください"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">写真</label>
                {actionPhotoPreview ? (
                  <div className="relative inline-block">
                    <img src={actionPhotoPreview} alt="Preview" className="max-w-full h-auto max-h-48 rounded-xl border border-gray-200" />
                    <button
                      type="button"
                      onClick={clearActionPhoto}
                      className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer block">
                    <Camera className="mx-auto text-gray-400 mb-2" size={24} />
                    <p className="text-sm font-medium text-gray-900">タップして写真を選択</p>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleActionPhotoChange}
                    />
                  </label>
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsActionModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {actionStatus || '登録中...'}
                    </>
                  ) : (
                    '登録する'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {isConfirmationModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">確認結果の登録</h3>
              <button onClick={() => setIsConfirmationModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddConfirmation} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">確認結果 <span className="text-red-500">*</span></label>
                <select
                  required
                  value={confirmationResult}
                  onChange={(e) => setConfirmationResult(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="完了">完了（是正を確認）</option>
                  <option value="再是正">再是正（不十分・やり直し）</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">コメント</label>
                <textarea
                  rows={3}
                  value={confirmationComment}
                  onChange={(e) => setConfirmationComment(e.target.value)}
                  placeholder="確認時のコメントや再是正の指示を入力してください"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsConfirmationModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  登録する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FindingDetail;
