export default () => ({
  port: parseInt(process.env.PORT || '4300', 10),
  webOrigin: process.env.WEB_ORIGIN || 'http://localhost:8848',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me-please',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  github: {
    token: process.env.GITHUB_TOKEN || '',
    owner: process.env.GITHUB_OWNER || '',
    repo: process.env.GITHUB_REPO || '',
    branch: process.env.GITHUB_BRANCH || 'master',
  },
  cos: {
    secretId: process.env.COS_SECRET_ID || '',
    secretKey: process.env.COS_SECRET_KEY || '',
    bucket: process.env.COS_BUCKET || '',
    region: process.env.COS_REGION || '',
    customDomain: process.env.COS_CUSTOM_DOMAIN || '',
  },
});
