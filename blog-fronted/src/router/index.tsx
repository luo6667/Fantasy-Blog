import { lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { PageSuspense } from '@/components/common'
import Layout from '@/router/Layout'

// 懒加载页面 —— 首屏仅加载当前路由的 chunk
const Cover = lazy(() => import('@/pages/cover'))
const Home = lazy(() => import('@/pages/home'))
const Blog = lazy(() => import('@/pages/blog'))
const BlogDetail = lazy(() => import('@/pages/blog-detail'))
const Admin = lazy(() => import('@/pages/admin'))
const ArticleEditor = lazy(() => import('@/pages/admin/ArticleEditor'))
const Resume = lazy(() => import('@/pages/resume'))
const About = lazy(() => import('@/pages/about'))
const NotFound = lazy(() => import('@/pages/not-found'))

/**
 * 路由配置模块
 *
 * 所有路由定义集中在此维护。
 * 页面组件均采用 React.lazy 懒加载，配合 PageSuspense 提供加载骨架屏。
 * /      → Cover 封面页（独立，无 Layout）
 * /home  → Home 主页（Layout 内）
 *
 * 全局状态（登录态、主题）由 zustand store 提供，无需 Provider 包裹。
 */
export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 封面页 — 独立全屏，无顶栏/底栏 */}
        <Route
          index
          element={
            <PageSuspense>
              <Cover />
            </PageSuspense>
          }
        />
        {/* 主站页面 — Layout 包裹 */}
        <Route element={<Layout />}>
          <Route
            path="home"
            element={
              <PageSuspense>
                <Home />
              </PageSuspense>
            }
          />
          <Route
            path="blog"
            element={
              <PageSuspense>
                <Blog />
              </PageSuspense>
            }
          />
          <Route
            path="blog/:id"
            element={
              <PageSuspense>
                <BlogDetail />
              </PageSuspense>
            }
          />
          <Route
            path="resume"
            element={
              <PageSuspense>
                <Resume />
              </PageSuspense>
            }
          />
          <Route
            path="about"
            element={
              <PageSuspense>
                <About />
              </PageSuspense>
            }
          />
          <Route
            path="admin"
            element={
              <PageSuspense>
                <Admin />
              </PageSuspense>
            }
          />
          <Route
            path="admin/new"
            element={
              <PageSuspense>
                <ArticleEditor />
              </PageSuspense>
            }
          />
          <Route
            path="admin/edit/:id"
            element={
              <PageSuspense>
                <ArticleEditor />
              </PageSuspense>
            }
          />
        </Route>
        {/* 兜底：未匹配任何路由 → 404（独立于 Layout） */}
        <Route
          path="*"
          element={
            <PageSuspense>
              <NotFound />
            </PageSuspense>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
