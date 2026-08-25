import CoverContent from './CoverContent';

/**
 * 封面页 — 网站入口（Server Component）
 *
 * 全屏动态壁纸 + 暗色遮罩走 SSR，动画内容（头像/欢迎语/按钮）由
 * CoverContent（client 子组件）渲染。独立于 Layout，无顶栏/底栏。
 */
export default function Cover() {
  return (
    <main className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-[#191613]">
      {/* 动态壁纸视频 — 全屏背景（加载失败时显示深色底色，保证白色文字可读） */}
      <video
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        src="https://duoduowallpaper.fp.ps.netease.com/file/69bb69891f71e9c2b64c6336EcvtVzXo07"
        autoPlay
        loop
        muted
        playsInline
      />

      {/* 暗色遮罩 — 保证文字可读 */}
      <div className="pointer-events-none absolute inset-0 bg-black/40" />

      <CoverContent />
    </main>
  );
}
