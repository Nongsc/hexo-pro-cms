const Layout = () => import("@/layout/index.vue");

export default {
  path: "/settings",
  name: "Settings",
  component: Layout,
  redirect: "/settings/index",
  meta: {
    icon: "ep/tools",
    title: "系统设置",
    rank: 6
  },
  children: [
    {
      path: "/settings/index",
      name: "SettingsIndex",
      component: () => import("@/views/settings/index.vue"),
      meta: { title: "系统设置" }
    }
  ]
} satisfies RouteConfigsTable;
