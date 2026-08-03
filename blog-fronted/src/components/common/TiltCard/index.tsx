import { motion, useMotionValue, useTransform } from 'motion/react';
import { type ReactNode, useCallback } from 'react';

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  /** 倾斜强度，默认 8（度） */
  tiltDegree?: number;
}

/**
 * 3D 倾斜卡片组件
 *
 * 鼠标在卡片上移动时，卡片会朝向鼠标方向轻微 3D 旋转，
 * 离开时弹性回正。类似 Apple TV 的视差卡片效果。
 */
export default function TiltCard({ children, className = '', tiltDegree = 8 }: TiltCardProps) {
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const rotateX = useTransform(mouseY, [0, 1], [tiltDegree, -tiltDegree]);
  const rotateY = useTransform(mouseX, [0, 1], [-tiltDegree, tiltDegree]);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      mouseX.set((e.clientX - rect.left) / rect.width);
      mouseY.set((e.clientY - rect.top) / rect.height);
    },
    [mouseX, mouseY],
  );

  const onMouseLeave = useCallback(() => {
    mouseX.set(0.5);
    mouseY.set(0.5);
  }, [mouseX, mouseY]);

  return (
    <motion.div
      className={className}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
        perspective: 800,
      }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
    >
      {children}
    </motion.div>
  );
}
