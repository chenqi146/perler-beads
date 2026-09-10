/**
 * 浏览器端 AI 抠图（@imgly/background-removal）
 * 动态导入，避免首屏加载大模型。
 */

export type AiMattingProgress = {
  key: string;
  current: number;
  total: number;
};

export async function removeImageBackground(
  imageSrc: string,
  onProgress?: (p: AiMattingProgress) => void
): Promise<string> {
  const { removeBackground } = await import('@imgly/background-removal');

  const blob = await removeBackground(imageSrc, {
    // 须与 peer onnxruntime-web@1.21.0 一致；模型/wasm 走官方 CDN
    model: 'isnet_quint8',
    device: 'cpu',
    proxyToWorker: false,
    output: {
      format: 'image/png',
      quality: 0.9,
    },
    progress: (key, current, total) => {
      onProgress?.({ key, current, total });
    },
  });

  // 将透明底合成到白底，方便后续拼豆映射与预览
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建画布');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('抠图结果加载失败'));
    img.src = src;
  });
}
