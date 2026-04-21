import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { isAdmin } from '../lib/permissions';
import { Plus, Edit2, Check, X, AlertCircle, Power, PowerOff, ChevronUp, ChevronDown, Database } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../contexts/AuthContext';

const CATEGORY_SEED = [
  {
    name: "安全管理体制・教育",
    middles: [
      { name: "安全指示・周知", minors: ["作業前周知不足", "指示内容不明確", "重点事項未周知"] },
      { name: "KY・TBM", minors: ["KY未実施", "KY内容不十分", "TBM未実施", "危険予知が具体的でない"] },
      { name: "作業手順・施工計画", minors: ["手順書未整備", "手順逸脱", "計画と実作業不一致"] },
      { name: "資格・教育・新規入場", minors: ["資格確認不足", "新規入場教育不足", "教育記録未整備"] },
      { name: "指揮命令系統", minors: ["作業責任者不明", "合図者未配置", "連絡系統不明"] },
      { name: "点検・巡視・是正管理", minors: ["点検未実施", "点検記録不足", "是正未フォロー", "再発防止不足"] }
    ]
  },
  {
    name: "整理整頓・通路",
    middles: [
      { name: "通路確保", minors: ["通路狭小", "通路閉塞", "迂回路未設定"] },
      { name: "足元管理", minors: ["段差放置", "ぬかるみ", "滑りやすい床面"] },
      { name: "整理整頓", minors: ["資材散乱", "工具放置", "不要物放置"] },
      { name: "清掃", minors: ["土砂堆積", "泥汚れ放置", "粉じん堆積"] },
      { name: "仮置き管理", minors: ["仮置き場所不適切", "通路へのはみ出し", "区画不明"] },
      { name: "転倒防止", minors: ["ケーブル放置", "ホース横断", "養生不足"] }
    ]
  },
  {
    name: "墜落・転落",
    middles: [
      { name: "高所作業", minors: ["保護具未使用", "足場上作業不安全", "安全帯取付設備不良"] },
      { name: "手すり・囲い", minors: ["手すり未設置", "手すり外しっぱなし", "中さん欠落"] },
      { name: "開口部", minors: ["開口部養生不足", "蓋未固定", "立入防止不足"] },
      { name: "昇降設備", minors: ["はしご固定不足", "昇降設備未設置", "昇降方法不適切"] },
      { name: "親綱・墜落制止用器具", minors: ["親綱未設置", "フック不使用", "取付先不適切"] },
      { name: "法肩・端部", minors: ["法肩近接作業", "端部表示不足", "転落防止柵不足"] }
    ]
  },
  {
    name: "飛来・落下・落下物",
    middles: [
      { name: "上下作業", minors: ["上下同時作業", "上下作業調整不足", "立入禁止措置不良"] },
      { name: "工具・資材落下", minors: ["工具落下防止未実施", "資材固定不足", "置き方不良"] },
      { name: "仮設物落下", minors: ["シート固定不足", "仮設材落下", "部材脱落"] },
      { name: "積載物・荷崩れ", minors: ["荷崩れ", "積み方不良", "荷締め不足"] },
      { name: "飛散防止", minors: ["切断片飛散", "防護養生不足", "飛散防止ネット不足"] },
      { name: "第三者への落下", minors: ["通行箇所上部作業", "下部立入管理不足", "防護棚未設置"] }
    ]
  },
  {
    name: "重機・建設機械",
    middles: [
      { name: "作業半径内立入", minors: ["作業半径内立入", "接近防止不足", "合図者不在"] },
      { name: "バックホウ", minors: ["用途外使用", "旋回範囲管理不足", "バケット下立入"] },
      { name: "クレーン・クレーン機能付重機", minors: ["吊荷下立入", "過負荷", "アウトリガー張り出し不足"] },
      { name: "点検・整備", minors: ["始業点検未実施", "整備不良", "油漏れ"] },
      { name: "乗降・離席", minors: ["乗降時転落", "離席時措置不足", "無人状態放置"] },
      { name: "誘導・合図", minors: ["誘導員不在", "合図不統一", "無線連絡不足"] }
    ]
  },
  {
    name: "車両・搬入出・運搬",
    middles: [
      { name: "搬入出管理", minors: ["搬入経路不明", "搬入時間調整不足", "出入口管理不足"] },
      { name: "後退・切返し", minors: ["後退誘導不足", "死角確認不足", "接触危険"] },
      { name: "ダンプ運搬", minors: ["過積載", "飛散防止不足", "荷台確認不足"] },
      { name: "車両動線", minors: ["人車分離不足", "一方通行未設定", "交錯動線"] },
      { name: "駐車・停車", minors: ["駐車位置不適切", "輪止め未使用", "傾斜地駐車不安全"] },
      { name: "荷下ろし・積込み", minors: ["荷下ろし位置不適切", "玉外し危険", "荷崩れ"] }
    ]
  },
  {
    name: "吊り作業・玉掛け",
    middles: [
      { name: "玉掛け作業", minors: ["玉掛け方法不適切", "掛け角度不良", "掛け本数不足"] },
      { name: "吊具・用具", minors: ["ワイヤ損傷", "シャックル不適", "吊具点検不足"] },
      { name: "吊荷管理", minors: ["吊荷下立入", "荷振れ", "荷の姿勢不安定"] },
      { name: "合図・連絡", minors: ["合図者不明", "合図不統一", "無線連絡不足"] },
      { name: "荷重・能力管理", minors: ["定格荷重超過", "能力確認不足", "重量不明"] },
      { name: "揚重計画", minors: ["吊り位置不適切", "作業手順不足", "接触防止不足"] }
    ]
  },
  {
    name: "仮設設備・足場・開口部",
    middles: [
      { name: "足場組立・使用", minors: ["足場材不足", "足場板未固定", "作業床不備"] },
      { name: "支保・控え", minors: ["控え不足", "緊結不足", "倒壊防止不足"] },
      { name: "開口部養生", minors: ["開口部蓋未設置", "養生破損", "表示不足"] },
      { name: "仮囲い・バリケード", minors: ["仮囲い破損", "区画不明", "立入防止不足"] },
      { name: "仮設通路・階段", minors: ["階段手すり不足", "踏面不良", "通路幅不足"] },
      { name: "照明・仮設電源", minors: ["照度不足", "配線露出", "仮設設備不良"] }
    ]
  },
  {
    name: "掘削・土工・地山・法面",
    middles: [
      { name: "掘削作業", minors: ["掘削手順不良", "掘削範囲管理不足", "近接作業危険"] },
      { name: "法面・地山管理", minors: ["法面崩壊恐れ", "浮石", "湧水"] },
      { name: "土留め・山留め", minors: ["支保不足", "土留め未設置", "変状確認不足"] },
      { name: "埋設物・地下障害物", minors: ["埋設物確認不足", "試掘不足", "損傷リスク"] },
      { name: "重機併用土工", minors: ["接触危険", "誘導不足", "作業半径内立入"] },
      { name: "盛土・敷均し・締固め", minors: ["締固め不足", "転倒危険", "施工範囲管理不足"] }
    ]
  },
  {
    name: "河川区域・水際・出水対応",
    middles: [
      { name: "水際作業", minors: ["転落危険", "救命具未着用", "立入範囲不明"] },
      { name: "出水時対応", minors: ["出水時退避基準不明", "退避遅れ", "警戒不足"] },
      { name: "水位・気象確認", minors: ["水位確認不足", "降雨情報未確認", "上流情報不足"] },
      { name: "舟運・流下物", minors: ["流下物接近", "漂流物管理不足", "航行注意不足"] },
      { name: "仮締切・締切設備", minors: ["仮締切不備", "越流リスク", "点検不足"] },
      { name: "緊急連絡・退避", minors: ["連絡体制不備", "退避経路不明", "避難誘導不足"] }
    ]
  },
  {
    name: "第三者災害防止・交通管理",
    middles: [
      { name: "通行人対策", minors: ["歩行者導線不備", "立入防止不足", "案内不足"] },
      { name: "交通誘導警備", minors: ["誘導員不在", "配置不適切", "合図不統一"] },
      { name: "出入口管理", minors: ["出入口見通し不良", "誘導不足", "徐行表示不足"] },
      { name: "公衆災害防止", minors: ["飛散対策不足", "落下対策不足", "騒音対策不足"] },
      { name: "工事案内・規制表示", minors: ["看板不足", "案内不明瞭", "規制表示不足"] },
      { name: "第三者との接触防止", minors: ["車両接触危険", "バック時危険", "死角管理不足"] }
    ]
  },
  {
    name: "保護具・服装",
    middles: [
      { name: "ヘルメット", minors: ["未着用", "あご紐未使用", "損傷品使用"] },
      { name: "安全帯・墜落制止用器具", minors: ["未使用", "フック未掛け", "装着不適切"] },
      { name: "安全靴・長靴", minors: ["未着用", "不適切な履物", "破損"] },
      { name: "反射材・視認性", minors: ["ベスト未着用", "反射材不足", "夜間視認性不足"] },
      { name: "手袋・保護メガネ", minors: ["未着用", "不適切選定", "破損"] },
      { name: "服装管理", minors: ["袖口不適", "だぶつき", "巻き込まれ危険"] }
    ]
  },
  {
    name: "熱中症・体調管理",
    middles: [
      { name: "WBGT管理", minors: ["測定未実施", "記録不足", "基準未活用"] },
      { name: "休憩・作業時間管理", minors: ["休憩不足", "連続作業", "休憩所未整備"] },
      { name: "水分・塩分補給", minors: ["補給不足", "補給設備不足", "周知不足"] },
      { name: "健康観察", minors: ["体調確認未実施", "声掛け不足", "異常時対応遅れ"] },
      { name: "暑熱順化・教育", minors: ["教育不足", "新規入場者配慮不足", "周知不足"] },
      { name: "保冷・装備", minors: ["空調服未使用", "冷却具不足", "日陰確保不足"] }
    ]
  }
];

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Category {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
  parentId?: string; // middleの場合はmajorId, minorの場合はmiddleId
}

export default function CategoryMaster() {
  const { profile } = useAuth();
  const [majors, setMajors] = useState<Category[]>([]);
  const [middles, setMiddles] = useState<Category[]>([]);
  const [minors, setMinors] = useState<Category[]>([]);

  const [selectedMajorId, setSelectedMajorId] = useState<string | null>(null);
  const [selectedMiddleId, setSelectedMiddleId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const [newItemName, setNewItemName] = useState('');
  const [addingTo, setAddingTo] = useState<'major' | 'middle' | 'minor' | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'category_major'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category));
      setMajors(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'category_major');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedMajorId) {
      setMiddles([]);
      return;
    }
    const q = query(collection(db, 'category_middle'), where('majorId', '==', selectedMajorId), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, parentId: d.data().majorId, ...d.data() } as Category));
      setMiddles(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'category_middle');
    });
    return () => unsubscribe();
  }, [selectedMajorId]);

  useEffect(() => {
    if (!selectedMiddleId) {
      setMinors([]);
      return;
    }
    const q = query(collection(db, 'category_minor'), where('middleId', '==', selectedMiddleId), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, parentId: d.data().middleId, ...d.data() } as Category));
      setMinors(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'category_minor');
    });
    return () => unsubscribe();
  }, [selectedMiddleId]);

  const handleAdd = async (level: 'major' | 'middle' | 'minor') => {
    if (!newItemName.trim()) {
      setError('分類名を入力してください');
      return;
    }

    try {
      const collectionName = `category_${level}`;
      const items = level === 'major' ? majors : level === 'middle' ? middles : minors;
      const nextOrder = items.length > 0 ? Math.max(...items.map(i => i.order)) + 1 : 1;

      const data: any = {
        name: newItemName.trim(),
        order: nextOrder,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (level === 'middle') {
        if (!selectedMajorId) return;
        data.majorId = selectedMajorId;
      } else if (level === 'minor') {
        if (!selectedMiddleId) return;
        data.middleId = selectedMiddleId;
      }

      // 重複チェック
      const q = level === 'major' 
        ? query(collection(db, collectionName), where('name', '==', data.name))
        : level === 'middle'
          ? query(collection(db, collectionName), where('name', '==', data.name), where('majorId', '==', data.majorId))
          : query(collection(db, collectionName), where('name', '==', data.name), where('middleId', '==', data.middleId));
      
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setError('同階層に同じ名前の分類が既に存在します');
        return;
      }

      const docRef = await addDoc(collection(db, collectionName), data);
      
      // 追加後に自動選択する
      if (level === 'major') {
        setSelectedMajorId(docRef.id);
        setSelectedMiddleId(null);
      } else if (level === 'middle') {
        setSelectedMiddleId(docRef.id);
      }

      setAddingTo(null);
      setNewItemName('');
      setError(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `category_${level}`);
    }
  };

  const handleUpdate = async (level: 'major' | 'middle' | 'minor', id: string) => {
    if (!editName.trim()) {
      setError('分類名を入力してください');
      return;
    }

    try {
      const collectionName = `category_${level}`;
      
      // 重複チェック (自分自身は除く)
      let q;
      if (level === 'major') {
        q = query(collection(db, collectionName), where('name', '==', editName.trim()));
      } else if (level === 'middle') {
        q = query(collection(db, collectionName), where('name', '==', editName.trim()), where('majorId', '==', selectedMajorId));
      } else {
        q = query(collection(db, collectionName), where('name', '==', editName.trim()), where('middleId', '==', selectedMiddleId));
      }

      const snapshot = await getDocs(q);
      const duplicate = snapshot.docs.find(d => d.id !== id);
      if (duplicate) {
        setError('同階層に同じ名前の分類が既に存在します');
        return;
      }

      await updateDoc(doc(db, collectionName, id), {
        name: editName.trim(),
        updatedAt: serverTimestamp(),
      });
      setEditingId(null);
      setError(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `category_${level}/${id}`);
    }
  };

  const handleToggleActive = async (level: 'major' | 'middle' | 'minor', id: string, currentActive: boolean) => {
    try {
      const collectionName = `category_${level}`;
      await updateDoc(doc(db, collectionName, id), {
        isActive: !currentActive,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `category_${level}/${id}`);
    }
  };

  const handleMove = async (level: 'major' | 'middle' | 'minor', items: Category[], index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === items.length - 1) return;

    const currentItem = items[index];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const targetItem = items[targetIndex];

    try {
      const collectionName = `category_${level}`;
      // orderを入れ替える
      await updateDoc(doc(db, collectionName, currentItem.id), {
        order: targetItem.order,
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, collectionName, targetItem.id), {
        order: currentItem.order,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `category_${level}`);
    }
  };

  const startEditing = (item: Category) => {
    setEditingId(item.id);
    setEditName(item.name);
    setError(null);
  };

  const handleSeedData = async () => {
    setIsSeeding(true);
    setError(null);
    
    try {
      // 1. 既存データの全削除
      const majorDocs = await getDocs(collection(db, 'category_major'));
      const middleDocs = await getDocs(collection(db, 'category_middle'));
      const minorDocs = await getDocs(collection(db, 'category_minor'));

      const deletePromises = [
        ...majorDocs.docs.map(d => deleteDoc(d.ref)),
        ...middleDocs.docs.map(d => deleteDoc(d.ref)),
        ...minorDocs.docs.map(d => deleteDoc(d.ref))
      ];
      await Promise.all(deletePromises);

      // 2. 初期データの投入
      let majorOrder = 1;
      for (const major of CATEGORY_SEED) {
        const majorRef = await addDoc(collection(db, 'category_major'), {
          name: major.name,
          order: majorOrder++,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        const majorId = majorRef.id;

        let middleOrder = 1;
        for (const middle of major.middles) {
          const middleRef = await addDoc(collection(db, 'category_middle'), {
            name: middle.name,
            majorId: majorId,
            order: middleOrder++,
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          const middleId = middleRef.id;

          let minorOrder = 1;
          for (const minorName of middle.minors) {
            await addDoc(collection(db, 'category_minor'), {
              name: minorName,
              middleId: middleId,
              order: minorOrder++,
              isActive: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }
      }
    } catch (err) {
      console.error(err);
      setError('初期データの投入中にエラーが発生しました。');
    } finally {
      setIsSeeding(false);
    }
  };

  const renderList = (
    level: 'major' | 'middle' | 'minor',
    items: Category[],
    selectedId: string | null,
    onSelect: (id: string) => void,
    title: string
  ) => {
    return (
      <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h2 className="font-bold text-gray-800">{title}</h2>
          <button
            onClick={() => {
              setAddingTo(level);
              setNewItemName('');
              setError(null);
            }}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="追加"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {addingTo === level && (
            <div className="p-3 mb-2 bg-blue-50 rounded-lg border border-blue-100">
              <div className="space-y-2">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="分類名"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    onClick={() => setAddingTo(null)}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 rounded"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={() => handleAdd(level)}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          )}

          {items.length === 0 && addingTo !== level ? (
            <div className="p-4 text-center text-sm text-gray-500">
              登録されていません
            </div>
          ) : (
            <ul className="space-y-1">
              {items.map((item, index) => (
                <li key={item.id}>
                  {editingId === item.id ? (
                    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          autoFocus
                        />
                        <div className="flex justify-end space-x-2 pt-2">
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 text-gray-500 hover:bg-gray-200 rounded"
                          >
                            <X size={16} />
                          </button>
                          <button
                            onClick={() => handleUpdate(level, item.id)}
                            className="p-1.5 text-green-600 hover:bg-green-100 rounded"
                          >
                            <Check size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors border",
                        selectedId === item.id
                          ? "bg-blue-50 border-blue-200"
                          : "bg-white border-transparent hover:border-gray-200 hover:bg-gray-50",
                        !item.isActive && "opacity-60 bg-gray-50"
                      )}
                      onClick={() => onSelect(item.id)}
                    >
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <span className="text-xs font-mono text-gray-400 w-6 text-right shrink-0">{item.order}</span>
                        <span className={cn(
                          "text-sm break-words whitespace-normal",
                          item.isActive ? "text-gray-900 font-medium" : "text-gray-500 line-through"
                        )}>
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0 ml-2">
                        <div className="flex flex-col mr-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMove(level, items, index, 'up');
                            }}
                            disabled={index === 0}
                            className="p-1 text-gray-400 hover:text-gray-800 hover:bg-gray-200 rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors"
                            title="上へ移動"
                          >
                            <ChevronUp size={20} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMove(level, items, index, 'down');
                            }}
                            disabled={index === items.length - 1}
                            className="p-1 text-gray-400 hover:text-gray-800 hover:bg-gray-200 rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors"
                            title="下へ移動"
                          >
                            <ChevronDown size={20} />
                          </button>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(item);
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="編集"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleActive(level, item.id, item.isActive);
                          }}
                          className={cn(
                            "p-1.5 rounded transition-colors",
                            item.isActive 
                              ? "text-gray-400 hover:text-red-600 hover:bg-red-50" 
                              : "text-red-500 hover:text-green-600 hover:bg-green-50"
                          )}
                          title={item.isActive ? "使用停止" : "再開"}
                        >
                          {item.isActive ? <PowerOff size={16} /> : <Power size={16} />}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-6rem)]">
      <div className="mb-6 shrink-0 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">指摘分類マスタ管理</h1>
          <p className="text-gray-500 mt-2">大分類・中分類・小分類の階層構造を管理します。</p>
        </div>
        {isAdmin(profile?.role) && (
          <button
            onClick={handleSeedData}
            disabled={isSeeding}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm text-sm font-medium"
          >
            {isSeeding ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700 mr-2"></div>
                投入中...
              </>
            ) : (
              <>
                <Database size={16} className="mr-2 text-gray-500" />
                初期データ投入
              </>
            )}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 shrink-0">
          <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
          <p className="text-red-800 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <X size={20} />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-6 pb-12">
        {/* 大分類 */}
        <div className="h-[400px] md:h-[500px]">
          {renderList('major', majors, selectedMajorId, (id) => {
            setSelectedMajorId(id);
            setSelectedMiddleId(null);
          }, '大分類')}
        </div>

        {/* 中分類 */}
        <div className={cn("h-[400px] md:h-[500px] transition-opacity", !selectedMajorId && "opacity-50 pointer-events-none")}>
          {renderList('middle', middles, selectedMiddleId, setSelectedMiddleId, '中分類')}
        </div>

        {/* 小分類 */}
        <div className={cn("h-[400px] md:h-[500px] transition-opacity", !selectedMiddleId && "opacity-50 pointer-events-none")}>
          {renderList('minor', minors, null, () => {}, '小分類')}
        </div>
      </div>
    </div>
  );
}
