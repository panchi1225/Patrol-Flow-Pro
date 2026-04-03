import { app } from './init';

// Cloud Storage は無料プラン等の制限で利用できない場合があるため、
// 画像をクライアント側でリサイズ・圧縮し、Base64文字列として返す方式に変更します。
// これにより、Firestoreのドキュメント内に直接画像データを保存します（1MB制限に注意）。

export const uploadPhoto = async (file: File, path: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Firestoreの1MB制限を回避するため、最大サイズを 800px に制限
        const MAX_SIZE = 800;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('画像の処理に失敗しました（Canvas未対応）。'));
          return;
        }
        
        // 白背景で塗りつぶす（透過PNG対策）
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        // JPEG形式で圧縮（品質: 0.6）
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        
        // Base64文字列のサイズが約800KBを超える場合はさらに圧縮
        if (dataUrl.length > 819200) {
           const smallerDataUrl = canvas.toDataURL('image/jpeg', 0.4);
           if (smallerDataUrl.length > 819200) {
              reject(new Error('画像サイズが大きすぎます。別の画像を選択するか、予め縮小してください。'));
              return;
           }
           resolve(smallerDataUrl);
        } else {
           resolve(dataUrl);
        }
      };
      
      img.onerror = () => reject(new Error('画像の読み込みに失敗しました。'));
      img.src = event.target?.result as string;
    };
    
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました。'));
    reader.readAsDataURL(file);
  });
};

// ダッシュボードのテスト用関数（不要になったため空の関数にするか、エラーを返す）
export const getStorageBucket = () => {
  return 'local-base64-mode';
};

export const testStorageConnection = async (uid: string, onProgress: (msg: string) => void) => {
  onProgress('Cloud Storageは使用せず、Base64エンコード方式で保存します。');
  return { success: true, path: 'local', url: 'data:image/jpeg;base64,...' };
};
