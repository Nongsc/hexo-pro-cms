const Layout = () => import("@/layout/index.vue");

export default {
  path: "/recycle",
  name: "Recycle",
  component: Layout,
  redirect: "/recycle/index",
  meta: {
    icon: "ep/delete",
    title: "回收站",
    rank: 7
  },
  children: [
    {
      path: "/recycle/index",
      name: "RecycleIndex",
      component: () => import("@/views/recycle/index.vue"),
      meta: { title: "回收站" }
    }
  ]
} satisfies RouteConfigsTable;
