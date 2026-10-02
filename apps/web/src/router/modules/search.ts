const Layout = () => import("@/layout/index.vue");

export default {
  path: "/search",
  name: "Search",
  component: Layout,
  redirect: "/search/index",
  meta: {
    icon: "ep/search",
    title: "全局搜索",
    rank: 8
  },
  children: [
    {
      path: "/search/index",
      name: "SearchIndex",
      component: () => import("@/views/search/index.vue"),
      meta: { title: "全局搜索" }
    }
  ]
} satisfies RouteConfigsTable;
