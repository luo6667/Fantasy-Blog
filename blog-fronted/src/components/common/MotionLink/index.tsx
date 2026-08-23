'use client';

import { motion } from 'motion/react';
import Link from 'next/link';

/**
 * 可动画的 Next.js Link
 *
 * 结合 motion 的 whileHover / whileTap / variants 与路由跳转。
 * 首页、封面页、导航栏共用，避免各处重复 `motion.create(Link)`。
 */
const MotionLink = motion.create(Link);

export default MotionLink;
