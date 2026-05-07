import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, addDoc, doc, getDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, uploadPhoto } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Save, MapPin, Calendar, Camera, Info, X, AlertCircle, Repeat } from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';

interface Category {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
  parentId?: string;
}

interface PastFinding {
  id: string;
  createdAt: string;
  description: string;
  correctionInstruction?: string;
}

const FindingNew: React.FC = () => {
  const { patrolId } = useParams<{ patrolId: string }>();
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [patrolDate, setPatrolDate] = useState('');
  const [siteId, setSiteId] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [categoryLoadError, setCategoryLoadError] = useState<string | null>(null);

  // 再発案件関連
  const [pastFindings, setPastFindings] = useState<PastFinding[]>([]);
  const [selectedPastFindingId, setSelectedPastFindingId] = useState<string>('');
  const [isSearchingPastFindings, setIsSearchingPastFindings] = useState(false);

  // 分類マスタ
  const [majors, setMajors] = useState<Category[]>([]);

  const [formData, setFormData] = useState({
    type: '是正指示',
    urgency: '早期是正',
    categoryMajor: '',
    categoryMinor: '',
    categoryOtherReason: '',
    description: '',
    location: '',
    correctionInstruction: '',
    deadline: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    notes: '',
    isRecurrence: false,
    repeatSourceId: '',
    status: '未対応',
  });

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setCategoryLoadError(null);

        const majorQ = query(collection(db, 'category_major'), orderBy('order', 'asc'));
        const majorSnap = await getDocs(majorQ);
        setMajors(
          majorSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Category))
            .filter(d => d.isActive !== false)
        );

      } catch (err: any) {
        console.error('Failed to fetch categories:', err);
        setCategoryLoadError(err?.message || '分類マスタの読込に失敗しました。');
        setMajors([]);
      }
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchPatrol = async () => {
      if (!patrolId) return;

      try {
        const patrolDoc = await getDoc(doc(db, 'patrols', patrolId));
        if (patrolDoc.exists()) {
          const pData = patrolDoc.data();
          setSiteId(pData.siteId);
          setPatrolDate(pData.date);

          const siteDoc = await getDoc(doc(db, 'sites', pData.siteId));
          if (siteDoc.exists()) {
            setSiteName(siteDoc.data().name);
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `patrols/${patrolId}`);
      }
    };

    fetchPatrol();
  }, [patrolId]);

  useEffect(() => {
    const searchPastFindings = async () => {
      if (!siteId || !formData.categoryMinor || formData.categoryMinor === 'その他') {
        setPastFindings([]);
        setSelectedPastFindingId('');
        setFormData(prev => ({ ...prev, isRecurrence: false, repeatSourceId: '' }));
        return;
      }

      setIsSearchingPastFindings(true);

      try {
        const findingsRef = collection(db, 'findings');
        const q = query(
          findingsRef,
          where('siteId', '==', siteId),
          where('categoryMinor', '==', formData.categoryMinor),
          orderBy('createdAt', 'desc'),
          limit(5)
        );

        const querySnapshot = await getDocs(q);
        const findings: PastFinding[] = [];

        querySnapshot.forEach((docSnap) => {
          findings.push({
            id: docSnap.id,
            createdAt: docSnap.data().createdAt,
            description: docSnap.data().description,
            correctionInstruction: docSnap.data().correctionInstruction,
          });
        });

        setPastFindings(findings);
        setSelectedPastFindingId('');
        setFormData(prev => ({ ...prev, isRecurrence: false, repeatSourceId: '' }));
      } catch (err) {
        console.error('Failed to search past findings:', err);
        setPastFindings([]);
      } finally {
        setIsSearchingPastFindings(false);
      }
    };

    searchPastFindings();
  }, [siteId, formData.categoryMinor]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };

      if (name === 'type') {
        if (value === '好事例') {
          newData.urgency = 'なし';
          newData.deadline = '';
          newData.correctionInstruction = '';
          newData.status = '対象外';
          newData.isRecurrence = false;
          newData.repeatSourceId = '';
        } else if (value === '注意喚起') {
          newData.urgency = 'なし';
          newData.deadline = '';
          newData.correctionInstruction = '';
          newData.status = '未対応';
          newData.isRecurrence = false;
          newData.repeatSourceId = '';
        } else if (value === '是正指示' && prev.type !== '是正指示') {
          newData.urgency = '早期是正';
          newData.deadline = format(addDays(new Date(), 7), 'yyyy-MM-dd');
          newData.status = '未対応';
        }
      }

      if (name === 'urgency') {
        if (value === '即時是正') {
          newData.deadline = format(addDays(new Date(), 1), 'yyyy-MM-dd');
        } else if (value === '早期是正') {
          newData.deadline = format(addDays(new Date(), 7), 'yyyy-MM-dd');
        } else if (value === '期日指定' && !newData.deadline) {
          newData.deadline = format(new Date(), 'yyyy-MM-dd');
        } else if (value === '次回是正') {
          newData.deadline = '';
        }
      }

      if (name === 'categoryMajor') {
        newData.categoryMinor = '';
        newData.categoryOtherReason = '';
      }

      if (name === 'isRecurrence') {
        if (checked && selectedPastFindingId) {
          const selectedFinding = pastFindings.find(f => f.id === selectedPastFindingId);
          if (selectedFinding) {
            newData.description = selectedFinding.description;
            if (selectedFinding.correctionInstruction) {
              newData.correctionInstruction = selectedFinding.correctionInstruction;
            }
            newData.repeatSourceId = selectedFinding.id;
          }
        } else {
          newData.repeatSourceId = '';
        }
      }

      return newData;
    });
  };

  const handlePastFindingSelect = (findingId: string) => {
    setSelectedPastFindingId(findingId);

    if (formData.isRecurrence) {
      const selectedFinding = pastFindings.find(f => f.id === findingId);
      if (selectedFinding) {
        setFormData(prev => ({
          ...prev,
          description: selectedFinding.description,
          correctionInstruction: selectedFinding.correctionInstruction || prev.correctionInstruction,
          repeatSourceId: selectedFinding.id
        }));
      }
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profile || !user || !patrolId || !siteId) {
      setError('ユーザー情報またはパトロール情報が取得できません。');
      return;
    }

    setLoading(true);
    setError(null);
    setSubmitStatus('入力確認中...');

    try {
      let photoUrl = '';

      if (photoFile) {
        setSubmitStatus('写真情報確認中...');
        try {
          const path = `findings/${user.uid}/${Date.now()}_${photoFile.name}`;
          setSubmitStatus('写真アップロード中...');
          photoUrl = await uploadPhoto(photoFile, path);
          setSubmitStatus('写真URL取得中...');
        } catch (uploadError: any) {
          console.error('Photo upload failed:', uploadError);
          const errorMessage = uploadError.message || '写真のアップロードに失敗しました。権限やネットワークを確認してください。';
          setError(errorMessage);
          setLoading(false);
          setSubmitStatus(null);
          return;
        }
      }

      setSubmitStatus('Firestoreへ保存中...');

      const saveFormData = { ...formData };
      if (!saveFormData.isRecurrence) {
        delete (saveFormData as any).repeatSourceId;
      }

      await addDoc(collection(db, 'findings'), {
        ...saveFormData,
        patrolId,
        siteId,
        photoUrl,
        authorUid: user.uid,
        createdAt: new Date().toISOString()
      });

      setSubmitStatus('保存完了');
      navigate(`/patrols/${patrolId}`);
    } catch (err: any) {
      console.error('Save failed:', err);
      setSubmitStatus('保存失敗');
      const errorMessage = err.message || '保存処理に失敗しました。必須項目や権限を確認してください。';
      setError(errorMessage);

      try {
        handleFirestoreError(err, OperationType.CREATE, 'findings');
      } catch {
        // ここは何もしない
      }
    } finally {
      setLoading(false);
      setTimeout(() => setSubmitStatus(null), 3000);
    }
  };

  const isCorrection = formData.type === '是正指示';
  const isGoodPractice = formData.type === '好事例';

  const categoryOptions = Array.from(new Set([...majors.map(m => m.name), 'その他']));

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="mb-6">
        <button onClick={() => navigate(-1)} className="inline-flex items-center text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={20} className="mr-2" />
          戻る
        </button>
        <h1 className="text-3xl font-bold text-gray-900">指摘事項の追加</h1>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-wrap gap-4 items-center text-sm text-blue-900">
        <div className="flex items-center">
          <MapPin size={16} className="mr-1 opacity-70" />
          <span className="font-medium">{siteName || '読み込み中...'}</span>
        </div>
        <div className="flex items-center">
          <Calendar size={16} className="mr-1 opacity-70" />
          <span>{patrolDate ? format(parseISO(patrolDate), 'yyyy年MM月dd日') : '読み込み中...'}</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start">
          <AlertCircle size={20} className="mr-2 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-6 border-b pb-2">基本情報</h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                指摘区分 <span className="text-red-500">*</span>
              </label>
              <select
                name="type"
                required
                value={formData.type}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
              >
                <option value="是正指示">是正指示</option>
                <option value="注意喚起">注意喚起</option>
                <option value="好事例">好事例</option>
              </select>
              <div className="text-xs text-gray-500 flex items-start mt-1">
                <Info size={14} className="mr-1 shrink-0 mt-0.5" />
                <span>
                  {formData.type === '是正指示' && '対応が必要な指摘。期限管理の対象となります。'}
                  {formData.type === '注意喚起' && '周知・再注意を目的とする事項です。'}
                  {formData.type === '好事例' && '良い取り組みの記録です。是正対応は不要です。'}
                </span>
              </div>
            </div>

            {isCorrection && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  緊急度 <span className="text-red-500">*</span>
                </label>
                <select
                  name="urgency"
                  required
                  value={formData.urgency}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                >
                  <option value="即時是正">即時是正</option>
                  <option value="早期是正">早期是正</option>
                  <option value="期日指定">期日指定</option>
                  <option value="次回是正">次回是正</option>
                </select>
                <div className="text-xs text-gray-500 flex items-start mt-1">
                  <Info size={14} className="mr-1 shrink-0 mt-0.5" />
                  <span>
                    {formData.urgency === '即時是正' && '当日〜翌日までに是正が必要です。'}
                    {formData.urgency === '早期是正' && '1週間以内に是正が必要です。'}
                    {formData.urgency === '期日指定' && '個別に是正期限を指定します。'}
                    {formData.urgency === '次回是正' && '次回同作業時に是正が必要です。'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-6 border-b pb-2">分類</h2>

          <div className="space-y-8">
            <div>
              <label className="block text-base font-bold text-gray-900 mb-3">分類を選択してください</label>
              {categoryLoadError ? (
                <div className="text-sm text-red-600 p-4 bg-red-50 rounded-xl border border-red-200">
                  分類マスタの読込に失敗しました。{categoryLoadError}
                </div>
              ) : categoryOptions.length === 0 ? (
                <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  分類マスタが登録されていません。設定画面から分類を登録するか、初期データを投入してください。
                </div>
              ) : (
                <select
                  value={formData.categoryMajor}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    categoryMajor: e.target.value,
                    categoryMinor: e.target.value,
                    categoryOtherReason: ''
                  }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-base font-medium text-gray-900"
                >
                  <option value="">分類を選択してください</option>
                  {categoryOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
            </div>

{formData.categoryMinor === 'その他' && (
              <div className="pt-6 border-t-2 border-dashed border-gray-200 animate-in fade-in slide-in-from-top-4 duration-300">
                <label className="block text-base font-bold text-gray-900 mb-2">その他の理由 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="categoryOtherReason"
                  required
                  value={formData.categoryOtherReason}
                  onChange={handleChange}
                  placeholder="具体的な分類を入力してください"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>
        </section>

        {!isGoodPractice && pastFindings.length > 0 && (
          <section className="bg-amber-50 rounded-2xl shadow-sm border border-amber-200 p-6 md:p-8">
            <div className="flex items-start mb-4">
              <Repeat className="text-amber-600 mr-2 shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="text-lg font-bold text-amber-900">過去に同一現場・同一分類の指摘があります</h3>
                <p className="text-sm text-amber-800 mt-1">再発案件として登録する場合は、もとになる指摘を選択してチェックしてください。</p>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              {pastFindings.map((finding) => (
                <label
                  key={finding.id}
                  className={`block p-4 rounded-xl border cursor-pointer transition-colors ${
                    selectedPastFindingId === finding.id
                      ? 'bg-white border-amber-500 ring-1 ring-amber-500'
                      : 'bg-white/60 border-amber-200 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start">
                    <input
                      type="radio"
                      name="pastFindingSelection"
                      value={finding.id}
                      checked={selectedPastFindingId === finding.id}
                      onChange={() => handlePastFindingSelect(finding.id)}
                      className="mt-1 mr-3 text-amber-600 focus:ring-amber-500 border-gray-300"
                    />
                    <div>
                      <div className="text-xs text-gray-500 mb-1">
                        指摘日: {format(parseISO(finding.createdAt), 'yyyy年MM月dd日')}
                      </div>
                      <div className="text-sm text-gray-900 line-clamp-2">
                        {finding.description}
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {selectedPastFindingId && (
              <div className="flex items-center bg-white p-4 rounded-xl border border-amber-300 shadow-sm">
                <input
                  type="checkbox"
                  id="isRecurrence"
                  name="isRecurrence"
                  checked={formData.isRecurrence}
                  onChange={handleChange}
                  className="w-5 h-5 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                />
                <label htmlFor="isRecurrence" className="ml-3 block text-sm font-medium text-amber-900 cursor-pointer">
                  この指摘を再発案件として登録する
                </label>
              </div>
            )}
          </section>
        )}

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-6 border-b pb-2">内容</h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">発生場所</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="例: 3階 北側"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isGoodPractice ? '好事例の内容' : '指摘内容'} <span className="text-red-500">*</span>
              </label>
              <textarea
                name="description"
                required
                rows={3}
                value={formData.description}
                onChange={handleChange}
                placeholder={isGoodPractice ? '例: 通路が整理整頓されている' : '例: 足場の開口部に手すりがない'}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {formData.isRecurrence && (
                <p className="text-xs text-amber-600 mt-1">
                  ※過去の指摘内容が自動入力されています。必要に応じて編集してください。
                </p>
              )}
            </div>

            {isCorrection && (
              <>
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">是正内容（指示） <span className="text-red-500">*</span></label>
                  <textarea
                    name="correctionInstruction"
                    required
                    rows={2}
                    value={formData.correctionInstruction}
                    onChange={handleChange}
                    placeholder="例: 直ちに手すりを設置すること"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {formData.isRecurrence && (
                    <p className="text-xs text-amber-600 mt-1">
                      ※過去の是正内容が自動入力されています。必要に応じて編集してください。
                    </p>
                  )}
                </div>

                {formData.urgency === '期日指定' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">是正期限 <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      name="deadline"
                      required
                      value={formData.deadline}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}
              </>
            )}

            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
              <textarea
                name="notes"
                rows={2}
                value={formData.notes}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-6 border-b pb-2">写真</h2>

          {photoPreview ? (
            <div className="relative inline-block">
              <img src={photoPreview} alt="Preview" className="max-w-full h-auto max-h-64 rounded-xl border border-gray-200" />
              <button
                type="button"
                onClick={clearPhoto}
                className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          ) : (
            <label className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer block">
              <Camera className="mx-auto text-gray-400 mb-3" size={32} />
              <p className="text-sm font-medium text-gray-900">タップして写真を撮影・選択</p>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </label>
          )}
        </section>

        <div className="sticky bottom-6 bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-gray-200 flex flex-col sm:flex-row justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50 shadow-sm"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                {submitStatus || '保存中...'}
              </>
            ) : (
              <>
                <Save size={20} className="mr-2" />
                保存する
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FindingNew;
