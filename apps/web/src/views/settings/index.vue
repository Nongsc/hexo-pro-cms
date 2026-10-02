<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { message } from "@/utils/message";
import {
  getSystemConfig,
  saveSystemConfig,
  getGithubConfig,
  saveGithubConfig,
  getCosConfig,
  saveCosConfig,
  getConfigStatus,
  updateProfile,
  uploadAvatar
} from "@/api/settings";
import { getUserInfoApi } from "@/api/user";

defineOptions({ name: "SettingsIndex" });

const activeTab = ref("site");
const status = ref<any>({});

const siteForm = reactive({
  siteName: "",
  siteUrl: "",
  language: "zh-CN",
  timezone: "Asia/Shanghai"
});

const githubForm = reactive({
  token: "",
  owner: "",
  repo: "",
  branch: "master"
});

const cosForm = reactive({
  secretId: "",
  secretKey: "",
  bucket: "",
  region: "",
  customDomain: "",
  basePath: "images"
});

const profileForm = reactive({
  username: "",
  avatar: "",
  password: "",
  securityQuestion: "",
  securityAnswer: ""
});

async function loadAll() {
  const [s, g, c, st, u] = await Promise.all([
    getSystemConfig(),
    getGithubConfig(),
    getCosConfig(),
    getConfigStatus(),
    getUserInfoApi()
  ]);
  Object.assign(siteForm, s.data || {});
  Object.assign(githubForm, g.data || {});
  Object.assign(cosForm, c.data || {});
  status.value = st.data || {};
  const me = u.data || {};
  profileForm.username = me.username || "";
  profileForm.avatar = me.avatar || "";
  profileForm.securityQuestion = me.securityQuestion || "";
}

async function saveSite() {
  await saveSystemConfig(siteForm);
  message("站点信息已保存", { type: "success" });
}

async function saveGithub() {
  await saveGithubConfig(githubForm);
  message("GitHub 连接已保存", { type: "success" });
  const st: any = await getConfigStatus();
  status.value = st.data || {};
}

async function saveCos() {
  await saveCosConfig(cosForm);
  message("COS 配置已保存", { type: "success" });
  const st: any = await getConfigStatus();
  status.value = st.data || {};
}

async function saveProfile() {
  await updateProfile({
    username: profileForm.username,
    password: profileForm.password || undefined,
    securityQuestion: profileForm.securityQuestion,
    securityAnswer: profileForm.securityAnswer || undefined
  });
  message("用户资料已更新", { type: "success" });
}

async function onAvatarUpload(file: any) {
  // el-upload 的 http-request 回调参数是 UploadRequestOptions，原始文件在 options.file
  const raw = (file?.file || file?.raw) as File;
  if (!raw) return;
  const dataUri: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(raw);
  });
  const res: any = await uploadAvatar(dataUri);
  profileForm.avatar = res.data?.url || "";
  message("头像已更新", { type: "success" });
}

onMounted(loadAll);
</script>

<template>
  <div>
    <el-card shadow="never">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="站点信息" name="site">
          <el-alert
            v-if="!status.githubConnected"
            title="尚未配置 GitHub 连接，内容变更无法写入仓库"
            type="warning"
            :closable="false"
            class="mb-4"
          />
          <el-form :model="siteForm" label-width="120px" class="max-w-xl">
            <el-form-item label="站点名称">
              <el-input v-model="siteForm.siteName" />
            </el-form-item>
            <el-form-item label="站点地址">
              <el-input v-model="siteForm.siteUrl" placeholder="https://example.com" />
            </el-form-item>
            <el-form-item label="语言">
              <el-input v-model="siteForm.language" />
            </el-form-item>
            <el-form-item label="时区">
              <el-input v-model="siteForm.timezone" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveSite">保存</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="GitHub 连接" name="github">
          <el-form :model="githubForm" label-width="120px" class="max-w-xl">
            <el-form-item label="Personal Token">
              <el-input
                v-model="githubForm.token"
                type="password"
                show-password
                placeholder="ghp_xxx（需 repo 与 workflow 权限）"
              />
            </el-form-item>
            <el-form-item label="仓库所有者">
              <el-input v-model="githubForm.owner" placeholder="如 heywarms" />
            </el-form-item>
            <el-form-item label="仓库名">
              <el-input v-model="githubForm.repo" placeholder="如 my-hexo-blog" />
            </el-form-item>
            <el-form-item label="分支">
              <el-input v-model="githubForm.branch" placeholder="master / main" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveGithub">保存</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="腾讯云 COS" name="cos">
          <el-alert
            v-if="!status.cosConfigured"
            title="尚未配置 COS，图床上传不可用"
            type="warning"
            :closable="false"
            class="mb-4"
          />
          <el-form :model="cosForm" label-width="120px" class="max-w-xl">
            <el-form-item label="SecretId">
              <el-input v-model="cosForm.secretId" />
            </el-form-item>
            <el-form-item label="SecretKey">
              <el-input
                v-model="cosForm.secretKey"
                type="password"
                show-password
              />
            </el-form-item>
            <el-form-item label="Bucket">
              <el-input v-model="cosForm.bucket" placeholder="如 my-bucket-1250000000" />
            </el-form-item>
            <el-form-item label="Region">
              <el-input v-model="cosForm.region" placeholder="如 ap-guangzhou" />
            </el-form-item>
            <el-form-item label="自定义域名">
              <el-input v-model="cosForm.customDomain" placeholder="如 https://cdn.example.com" />
            </el-form-item>
            <el-form-item label="存储路径前缀">
              <el-input v-model="cosForm.basePath" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveCos">保存</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="用户资料" name="profile">
          <el-form :model="profileForm" label-width="120px" class="max-w-xl">
            <el-form-item label="头像">
              <div class="flex items-center gap-3">
                <el-avatar :size="56" :src="profileForm.avatar" />
                <el-upload :show-file-list="false" :http-request="onAvatarUpload" accept="image/*">
                  <el-button>上传头像</el-button>
                </el-upload>
              </div>
            </el-form-item>
            <el-form-item label="用户名">
              <el-input v-model="profileForm.username" />
            </el-form-item>
            <el-form-item label="新密码">
              <el-input
                v-model="profileForm.password"
                type="password"
                show-password
                placeholder="留空则不修改"
              />
            </el-form-item>
            <el-form-item label="安全问题">
              <el-input v-model="profileForm.securityQuestion" placeholder="用于找回密码" />
            </el-form-item>
            <el-form-item label="安全答案">
              <el-input v-model="profileForm.securityAnswer" placeholder="留空则不修改" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveProfile">保存</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>
