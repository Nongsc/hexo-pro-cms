const Layout = () => import("@/layout/index.vue");

export default {
  path: "/deploy",
  name: "Deploy",
  component: Layout,
  redirect: "/deploy/index",
  meta: {
    icon: "ep/upload",
    title: "部署",
    rank: 5
  },
  children: [
    {
      path: "/deploy/index",
      name: "DeployIndex",
      component: () => import("@/views/deploy/index.vue"),
      meta: { title: "部署管理" }
    }
  ]
} satisfies RouteConfigsTable;
