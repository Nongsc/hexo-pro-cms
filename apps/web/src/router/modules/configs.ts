const Layout = () => import("@/layout/index.vue");

export default {
  path: "/configs",
  name: "Configs",
  component: Layout,
  redirect: "/configs/index",
  meta: {
    icon: "ep/setting",
    title: "配置管理",
    rank: 4
  },
  children: [
    {
      path: "/configs/index",
      name: "ConfigsIndex",
      component: () => import("@/views/configs/index.vue"),
      meta: { title: "配置管理" }
    }
  ]
} satisfies RouteConfigsTable;
