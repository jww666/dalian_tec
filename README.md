# 大连家教地图

一个面向大连地区家教信息整理的静态网页。它从 Word 文档中提取家教需求的序号、地址、薪资、年级、科目、行政区和备注，并在网页中提供地图展示与筛选。

## 当前结构

- `index.html`：网页入口。
- `styles.css`：页面样式。
- `app.js`：筛选、列表、地图和高德地图加载逻辑。
- `data/tutors.js`：网页直接读取的数据。
- `data/tutors.json`：同一份数据，方便查看或二次处理。
- `scripts/parse_docx.py`：从 `D:\大连家教.docx` 解析数据。

## 使用方法

1. 先确认 `D:\大连家教.docx` 已保存成功，并且文件不是 0 字节。
2. 在本目录运行：

```powershell
python scripts\parse_docx.py "D:\大连家教.docx"
```

如果系统没有可用的 `python`，可以用 Codex 自带的 Python 路径运行，或让我帮你跑。

3. 打开 `index.html` 查看网页。

## 一键更新网页数据

以后你更新 Word 文档后，不是在 GitHub 网页里点 `.bat`，而是在你自己电脑的项目文件夹里双击：

```text
D:\github\-\update-and-push.bat
```

它会自动完成：

```text
读取 D:\大连家教.docx -> 生成 data/tutors.js/json -> 提交 Git -> 推送 GitHub -> GitHub Pages 自动更新
```

运行完成后，等待几十秒到两分钟，再打开：

```text
https://jww666.github.io/dalian_tec/
```

如果浏览器还是旧数据，按 `Ctrl + F5` 强制刷新。

## 高德地图 Key

网页可以不用 Key 先看列表和近似位置；如果要使用真实地图和地址解析，需要高德 Web 端 JavaScript API Key 和安全密钥 `securityJsCode`。不要把 Key 或安全密钥写进公开仓库。

打开网页后，把 Key 和安全密钥粘到右上角的输入框并点击“保存”，页面会自动加载高德地图。

如果直接双击 `index.html`，浏览器地址会是 `file://...`，高德的域名白名单/Referer 鉴权可能不认。推荐双击 `run-local.bat`，然后用浏览器访问：

```text
http://127.0.0.1:5173/
```

高德控制台里 Web 端 JS API Key 的域名白名单建议加入：

```text
localhost
127.0.0.1
jww666.github.io
```

注意：白名单只填域名，不填协议和路径。比如 GitHub Pages 页面是 `https://jww666.github.io/dalian_tec/`，高德白名单里应填 `jww666.github.io`，不要填 `https://jww666.github.io/dalian_tec/`。

如果希望群友打开网页就能直接看到地图，而不是自己输入 Key，可以编辑 `data/config.js`：

```js
window.PUBLIC_MAP_CONFIG = {
  amapKey: "你的高德 Web JS API Key",
  amapSecurityCode: "你的 securityJsCode",
  hideKeyInputs: true
};
```

注意：这个文件会公开给所有访问者，所以必须在高德控制台把 Key 限制为只允许你的 GitHub Pages 域名使用。

## 公开访问

这个项目是纯静态网页，适合用 GitHub Pages 公开访问。在仓库页面进入 `Settings` -> `Pages`，把 `Build and deployment` 设置为：

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`

保存后等待 GitHub 生成访问地址。公开部署时请使用高德控制台里的域名白名单限制 Key，只允许 `jww666.github.io`、`localhost`、`127.0.0.1` 等可信域名调用。

当前仓库名是 `dalian_tec`，GitHub Pages 地址通常会是：

```text
https://jww666.github.io/dalian_tec/
```

## 安全说明

- 页面不包含注册、登录、支付、聊天和预约系统，不收集访问者账号信息。
- 页面会对群消息文本做 HTML 转义，避免备注内容被当作代码执行。
- 高德 Key 和安全密钥只保存在访问者浏览器的 `localStorage`，不会提交到 GitHub。
- 如果要给所有人默认加载地图，建议新建一个只允许 GitHub Pages 域名使用的高德 Web JS API Key。

## GitHub 上传

你需要给我其中一种信息：

- 已经建好的 GitHub 仓库地址，例如 `https://github.com/你的用户名/dalian-tutor-map.git`
- 或者你让我教你新建仓库，我一步步带你做

如果你的电脑已经登录过 GitHub CLI 或配置过 Git，我可以直接帮你执行上传命令。

### 网页手动上传方法

如果电脑还没有安装 Git，可以先用 GitHub 网页上传：

1. 打开仓库页面。
2. 点击 `Add file` -> `Upload files`。
3. 上传这些文件和文件夹：`index.html`、`styles.css`、`app.js`、`README.md`、`.gitignore`、`data/`、`scripts/`。
4. 提交信息写 `init tutor map`，点击 `Commit changes`。

后续如果安装了 Git，可以在本目录运行：

```powershell
git init
git branch -M main
git remote add origin https://github.com/jww666/dalian_tec.git
git add index.html styles.css app.js README.md .gitignore data scripts
git commit -m "init tutor map"
git push -u origin main
```
