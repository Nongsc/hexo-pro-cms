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
  date: "",
  cover: "",
  description: "",
  content: "",
  status: "draft" as string
});

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
    const fm = p.frontMatter || {};
    form.date = fm.date || "";
    form.cover = fm.cover || "";
    form.description = fm.description || "";
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
      frontMatter: {
        date: form.date,
        cover: form.cover,
        description: form.description
      },
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

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="发布日期">
              <el-date-picker
                v-model="form.date"
                type="datetime"
                placeholder="选择日期时间"
                value-format="YYYY-MM-DD HH:mm:ss"
                class="w-full"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-radio-group v-model="form.status">
                <el-radio value="draft">草稿</el-radio>
                <el-radio value="published">发布</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="封面图">
          <el-input
            v-model="form.cover"
            placeholder="封面图片 URL（可从图床复制）"
          />
        </el-form-item>

        <el-form-item label="摘要">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            placeholder="文章摘要/描述（可选）"
          />
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
