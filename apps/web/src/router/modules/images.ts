const Layout = () => import("@/layout/index.vue");

export default {
  path: "/images",
  name: "Images",
  component: Layout,
  redirect: "/images/index",
  meta: {
    icon: "ep/picture",
    title: "图床管理",
    rank: 3
  },
  children: [
    {
      path: "/images/index",
      name: "ImagesList",
      component: () => import("@/views/images/index.vue"),
      meta: { title: "图床管理" }
    }
  ]
} satisfies RouteConfigsTable;
