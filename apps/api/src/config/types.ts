export interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

export interface CosConfig {
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
  customDomain: string;
  basePath: string;
}

export interface DeployConfig {
  workflowId: string;
  ref: string;
  autoTrigger: boolean;
}

export interface SystemConfig {
  siteName: string;
  siteUrl: string;
  language: string;
  timezone: string;
}
