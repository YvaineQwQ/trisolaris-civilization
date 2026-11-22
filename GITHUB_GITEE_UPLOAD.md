# 上传代码到 GitHub / Gitee

## 当前网络诊断（2026-11-22）

- `github.com` DNS 可解析，TCP 443 可连接，但 HTTPS 请求超时（本机同样打不开）。
- 这是网络链路/代理问题，不是游戏或仓库问题；普通浏览器和 git 都会受影响。
- 同一时间 **Gitee、GitCode、Netlify 均可正常访问**。

所以建议：

## 方案 A：上传到 Gitee（国内可访问，最省事）

1. 打开 <https://gitee.com/>，注册/登录
2. 右上角“+” → 新建仓库，填名称（如 `trisolaris-civilization`），不要勾选初始化 README
3. 本机安装 Git for Windows（<https://git-scm.com/download/win>）后，在源码目录执行：
   ```
   git init
   git add .
   git commit -m "TRISOLARIS v1.4"
   git branch -M main
   git remote add origin https://gitee.com/<你的用户名>/trisolaris-civilization.git
   git push -u origin main
   ```
4. 也可以在 Gitee 网页用“上传文件”把解压后的源码上传（不要上传 node_modules/dist/release/artifacts，本包已排除）

## 方案 B：GitCode / Codeberg（也可访问）

操作与 Gitee 相同，把 remote 换成对应平台的仓库地址即可。

## 方案 C：GitHub（需要先恢复访问）

GitHub 当前 HTTPS 超时，需要：
- 使用代理/VPN 后重试（Edge 或系统代理均可）；或换手机热点/其他网络测试
- 代理下让 git 也走代理：
  ```
  git config --global http.proxy http://127.0.0.1:7890
  git config --global https.proxy http://127.0.0.1:7890
  ```
- 能打开 GitHub 后：新建仓库 → 本地执行
  ```
  git init
  git add .
  git commit -m "TRISOLARIS v1.4"
  git branch -M main
  git remote add origin https://github.com/<你的用户名>/<仓库名>.git
  git push -u origin main
  ```
- 不想用命令行：安装 GitHub Desktop 登录后 Add local repository → Publish repository。

## 上传前须知

- 不要把 `node_modules/`、`dist/`、`release/`、`artifacts/` 提交进仓库（本源码包已排除）。
- 仓库包含游戏源码、文档、测试与 public 素材（约 40–50MB）；若要更小，可删除 `public/events/`、`public/textures/`、`public/images/v13/` 中的大图，但游戏内对应素材会缺失。
- 在线试玩：把 `release/TRISOLARIS-v1.4-netlify-drop.zip` 拖到 <https://app.netlify.com/drop>，可得到公开链接，与 GitHub 无关。
