const Layout = () => import("@/layout/index.vue");

export default {
  path: "/posts",
  name: "Posts",
  component: Layout,
  redirect: "/posts/index",
  meta: {
    icon: "ep/document",
    title: "文章管理",
    rank: 1
  },
  children: [
    {
      path: "/posts/index",
      name: "PostsList",
      component: () => import("@/views/posts/index.vue"),
      meta: { title: "文章列表" }
    },
    {
      path: "/posts/editor/:id?",
      name: "PostEditor",
      component: () => import("@/views/posts/editor.vue"),
      meta: { title: "文章编辑", showLink: false }
    }
  ]
} satisfies RouteConfigsTable;
