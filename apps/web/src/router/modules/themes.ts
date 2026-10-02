const Layout = () => import("@/layout/index.vue");

export default {
  path: "/themes",
  name: "Themes",
  component: Layout,
  redirect: "/themes/index",
  meta: {
    icon: "ep/brush",
    title: "主题管理",
    rank: 9
  },
  children: [
    {
      path: "/themes/index",
      name: "ThemesIndex",
      component: () => import("@/views/themes/index.vue"),
      meta: { title: "主题管理" }
    }
  ]
} satisfies RouteConfigsTable;
