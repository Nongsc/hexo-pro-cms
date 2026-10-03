<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { message } from "@/utils/message";
import {
  getPost,
  createPost,
  updatePost,
  getPostCategories,
  getPostTags
} from "@/api/posts";

defineOptions({ name: "PostEditor" });

const route = useRoute();
const router = useRouter();
const id = ref(route.params.id as string | undefined);
const saving = ref(false);
const loading = ref(false);

const categoryOptions = ref<{ label: string; value: string }[]>([]);
const tagOptions = ref<{ label: string; value: string }[]>([]);

const form = reactive({
  title: "",
  slug: "",
  categories: [] as string[],
  tags: [] as string[],
  content: "",
  status: "draft" as string
});

const frontmatterYaml = ref("");

function nowDateTime() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

async function loadMeta() {
  const [cats, tags] = await Promise.all([
    getPostCategories(),
    getPostTags()
  ]);
  categoryOptions.value = (cats.data || []).map((c: any) => ({
    label: c.name,
    value: c.name
  }));
  tagOptions.value = (tags.data || []).map((t: any) => ({
    label: t.name,
    value: t.name
  }));
}

async function load() {
  if (!id.value) return;
  loading.value = true;
  try {
    const res: any = await getPost(id.value);
    const p = res.data;
    form.title = p.title || "";
    form.slug = p.slug || "";
    form.categories = p.categories || [];
    form.tags = p.tags || [];
    form.content = p.content || "";
    form.status = p.status || "draft";
    frontmatterYaml.value = p.frontMatterYaml || "";
  } finally {
    loading.value = false;
  }
}

function onTitleInput() {
  if (!id.value && !form.slug) {
    form.slug = form.title
      .trim()
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
}

async function save() {
  if (!form.title) {
    message("请输入标题", { type: "warning" });
    return;
  }
  saving.value = true;
  try {
    const payload = {
      title: form.title,
      slug: form.slug,
      content: form.content,
      categories: form.categories,
      tags: form.tags,
      frontMatterYaml: frontmatterYaml.value,
      status: form.status
    };
    if (id.value) {
      await updatePost(id.value, payload);
    } else {
      await createPost(payload);
    }
    message("保存成功", { type: "success" });
    router.push("/posts/index");
  } finally {
    saving.value = false;
  }
}

function goBack() {
  router.push("/posts/index");
}

onMounted(async () => {
  if (!id.value) {
    frontmatterYaml.value = `date: ${nowDateTime()}\n`;
  }
  await loadMeta();
  await load();
});
</script>

<template>
  <div v-loading="loading">
    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span>{{ id ? "编辑文章" : "新建文章" }}</span>
          <div>
            <el-button @click="goBack">返回</el-button>
            <el-button type="primary" :loading="saving" @click="save">
              保存
            </el-button>
          </div>
        </div>
      </template>

      <el-form :model="form" label-width="90px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="标题" required>
              <el-input
                v-model="form.title"
                placeholder="文章标题"
                @input="onTitleInput"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="别名 slug">
              <el-input v-model="form.slug" placeholder="留空则按标题生成" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="分类">
              <el-select
                v-model="form.categories"
                multiple
                filterable
                allow-create
                default-first-option
                placeholder="选择或输入分类"
                class="w-full"
              >
                <el-option
                  v-for="o in categoryOptions"
                  :key="o.value"
                  :label="o.label"
                  :value="o.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="标签">
              <el-select
                v-model="form.tags"
                multiple
                filterable
                allow-create
                default-first-option
                placeholder="选择或输入标签"
                class="w-full"
              >
                <el-option
                  v-for="o in tagOptions"
                  :key="o.value"
                  :label="o.label"
                  :value="o.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="draft">草稿</el-radio>
            <el-radio value="published">发布</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="Front-matter">
          <el-input
            v-model="frontmatterYaml"
            type="textarea"
            :rows="6"
            placeholder="YAML 格式，如 date / cover / description / comments 等"
            class="font-mono"
          />
          <div class="text-xs text-gray-400 mt-1">
            Front-matter（YAML），会写入 .md 文件顶部；title / tags / categories 已由上方字段自动写入。
          </div>
        </el-form-item>

        <el-form-item label="正文">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="20"
            placeholder="支持 Markdown 语法"
            class="font-mono"
          />
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>
