# 上传代码到 GitHub / Gitee

## 当前网络诊断（2026-11-22）

- github.com 的 DNS 可解析、TCP 443 可连接，但 HTTPS 请求超时 → 本机浏览器打不开 GitHub 是网络链路/代理问题，不是游戏或浏览器故障。
- 同一时间 Gitee、GitCode、Netlify 均可访问。
- 因此：代码建议先传到 Gitee/GitCode；游戏试玩用 Netlify。

## 源码包

`release/TRISOLARIS-v1.4-source.zip`（约 49MB，已排除 node_modules/dist/release/artifacts）
解压后包含 README、src、public、tests、scripts、docs、启动脚本与上传说明。

## 方案 A：Gitee（推荐，国内可直连）

1. 登录 <https://gitee.com/> → 新建仓库（不要勾选初始化 README）
2. 安装 Git for Windows 后，在解压后的源码目录执行：
   ```
   git init
   git add .
   git commit -m "TRISOLARIS v1.4"
   git branch -M main
   git remote add origin https://gitee.com/<用户名>/<仓库名>.git
   git push -u origin main
   ```
3. 或在 Gitee 网页用“上传文件”上传源码（不要上传 node_modules/dist/release/artifacts）。

## 方案 B：GitCode / Codeberg

与 Gitee 相同，把 remote 换成对应平台仓库地址；本机均可访问。

## 方案 C：GitHub（需先恢复网络）

1. 使用 VPN/代理后再打开 GitHub（手机热点或其他网络也可测试）
2. 让 git 走代理：
   ```
   git config --global http.proxy http://127.0.0.1:7890
   git config --global https.proxy http://127.0.0.1:7890
   ```
3. 新建仓库后：
   ```
   git init
   git add .
   git commit -m "TRISOLARIS v1.4"
   git branch -M main
   git remote add origin https://github.com/<用户名>/<仓库名>.git
   git push -u origin main
   ```
4. 或用 GitHub Desktop：Add local repository → Publish repository。

## 在线试玩（与 GitHub 无关）

把 `release/TRISOLARIS-v1.4-netlify-drop.zip` 拖到 <https://app.netlify.com/drop>，即可得到公开链接。
