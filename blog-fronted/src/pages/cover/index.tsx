import { motion } from 'motion/react';

import { MotionLink } from '@/components/common';
import { springBtn, springSlow } from '@/lib/motion';

const btnCover =
  'inline-flex items-center gap-1.5 rounded-md border-[1.5px] border-accent/50 bg-transparent px-[1.125rem] py-2.5 font-[inherit] text-sm font-semibold text-white/80 backdrop-blur-sm transition-[border-color,color,background,box-shadow] duration-[250ms] hover:border-accent hover:bg-accent hover:text-white hover:shadow-lg hover:shadow-accent/30';

/**
 * 封面页 — 网站入口
 *
 * 全屏动态壁纸 + 头像 + 欢迎语 + 导航按钮。
 * 独立于 Layout，无顶栏/底栏。
 */
export default function Cover() {
  return (
    <main className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden">
      {/* 动态壁纸视频 — 全屏背景 */}
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

      {/* 内容 */}
      <div className="relative z-[1] flex flex-col items-center text-center">
        {/* 头像 + 呼吸光环 */}
        <motion.div
          className="relative mb-8"
          initial={{ scale: 0, opacity: 0, rotate: -15 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ ...springSlow, stiffness: 120, damping: 14, mass: 0.8 }}
        >
          <motion.div
            className="absolute -inset-4 rounded-full bg-white/20 blur-2xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.25, 0.55, 0.25] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -inset-8 rounded-full border border-white/15"
            animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
          />
          <img
            src="/head.jpg"
            alt="JasonLuo"
            className="relative h-40 w-40 rounded-full border-[3px] border-white/30 object-cover shadow-2xl shadow-black/30"
            draggable={false}
          />
        </motion.div>

        {/* 欢迎来到 */}
        <motion.p
          className="mb-2 text-sm font-medium uppercase tracking-[0.1em] text-white/70"
          initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ ...springSlow, delay: 0.15 }}
        >
          欢迎来到
        </motion.p>

        {/* 主标题 */}
        <motion.h1
          className="mb-3 text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold leading-[1.08] tracking-[-0.03em] text-white"
          initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ ...springSlow, delay: 0.25 }}
        >
          JasonLuo 的个人主页
        </motion.h1>

        {/* 副标题 */}
        <motion.p
          className="mb-10 max-w-md text-base leading-[1.65] text-white/60"
          initial={{ opacity: 0, y: 18, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ ...springSlow, delay: 0.4 }}
        >
          构建高性能 Web 体验的前端工程师
        </motion.p>

        {/* 按钮组 */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSlow, delay: 0.55 }}
        >
          <MotionLink
            to="/home"
            className={btnCover}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.94 }}
            transition={springBtn}
          >
            进入主页
          </MotionLink>
          <MotionLink
            to="/resume"
            className={btnCover}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.94 }}
            transition={springBtn}
          >
            查看简历
          </MotionLink>
          <MotionLink
            to="/blog"
            className={btnCover}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.94 }}
            transition={springBtn}
          >
            阅读博客
          </MotionLink>
          <motion.a
            href="https://github.com/luo6667"
            target="_blank"
            rel="noreferrer"
            className={btnCover}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.94 }}
            transition={springBtn}
          >
            <i className="iconfont icon-GitHub" /> GitHub
          </motion.a>
        </motion.div>
      </div>
    </main>
  );
}
