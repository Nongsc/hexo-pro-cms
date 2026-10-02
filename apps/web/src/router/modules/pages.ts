const Layout = () => import("@/layout/index.vue");

export default {
  path: "/pages",
  name: "Pages",
  component: Layout,
  redirect: "/pages/index",
  meta: {
    icon: "ep/document-copy",
    title: "页面管理",
    rank: 2
  },
  children: [
    {
      path: "/pages/index",
      name: "PagesList",
      component: () => import("@/views/pages/index.vue"),
      meta: { title: "页面列表" }
    },
    {
      path: "/pages/editor/:id?",
      name: "PageEditor",
      component: () => import("@/views/pages/editor.vue"),
      meta: { title: "页面编辑", showLink: false }
    }
  ]
} satisfies RouteConfigsTable;
