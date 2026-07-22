# 今天困不困

一个简洁、手机优先的中文白天困倦记录工具。点一次即可自动保存本地日期、时间和困倦状态，方便之后与华为手表中的睡眠时长对照。

## 功能

- 三个大按钮快速记录“清醒 / 有点困 / 很困”
- 同一天可多次记录，支持立即撤销和单条删除
- 查看最近 7 天、14 天或 30 天的历史
- 最近 7 天三种状态计数与横向条形统计
- 数据保存在浏览器 `localStorage`
- 导出 CSV、导出 JSON，以及导入 CSV/JSON 备份
- 清空数据前连续两次确认
- 支持浅色/深色模式、键盘操作和屏幕阅读器
- 可安装、可离线使用的 PWA

## 在本地运行

不要直接双击 `index.html`。`file://` 页面无法正常注册 Service Worker，因此不能完整测试安装和离线功能。

请在项目目录中启动一个本地静态服务器。任选一种方式：

### 使用 Python

```bash
python -m http.server 8080
```

然后打开 <http://localhost:8080/>。

Windows 如果 `python` 命令不可用，可以尝试：

```bash
py -m http.server 8080
```

### 使用 VS Code

安装并启用 Live Server 扩展，然后在 `index.html` 上选择 **Open with Live Server**。

> `localhost` 被浏览器视为安全环境，可以正常测试 Service Worker。用手机通过局域网 IP 访问电脑上的 HTTP 服务时，部分浏览器会因不是 HTTPS 而拒绝安装 PWA；手机测试建议部署到 GitHub Pages。

## 安装到手机

### Android（Chrome / Edge）

1. 用浏览器打开已部署的 HTTPS 地址。
2. 如果页面显示“安装到手机”，点击它；也可以打开浏览器菜单。
3. 选择“安装应用”或“添加到主屏幕”。

### iPhone / iPad（Safari）

1. 用 Safari 打开已部署的 HTTPS 地址。
2. 点击“分享”。
3. 选择“添加到主屏幕”，再点击“添加”。

首次在线打开后，应用外壳会被缓存；之后可以离线启动和记录。

## 部署到 GitHub Pages

1. 新建一个 GitHub 仓库，把本目录中的文件和 `icons` 文件夹提交并推送到仓库根目录。
2. 在仓库中进入 **Settings → Pages**。
3. 在 **Build and deployment** 下选择 **Deploy from a branch**。
4. 选择要部署的分支（通常是 `main`）和根目录 `/ (root)`，然后保存。
5. 等待部署完成，打开 GitHub Pages 提供的 HTTPS 地址。

项目中的资源、Manifest、Service Worker 注册和缓存路径都使用相对路径，适用于 `https://用户名.github.io/仓库名/` 这样的 GitHub Pages 子目录。若更新了缓存资源，请同时修改 `service-worker.js` 中的 `CACHE_NAME`，让已安装版本及时获取新文件。

## 数据保存与备份

- 所有记录只保存在当前设备、当前浏览器、当前站点地址对应的 `localStorage` 中，不会上传到服务器。
- 刷新页面或离线使用不会丢失记录；但清除浏览器站点数据、卸载时选择删除数据、使用无痕模式，或更换浏览器/设备都会导致本地记录不可用。
- GitHub Pages 仓库名或域名变化会产生新的站点存储空间，旧地址中的数据不会自动迁移。
- 建议定期导出 JSON 作为完整备份；CSV 更适合用 Excel、Numbers 或表格软件查看和分析。
- 导入时会保留现有数据，并根据“时间 + 状态”跳过重复记录。
- CSV 使用 UTF-8 BOM，通常可直接在中文版 Excel 中正确显示中文。

## 文件说明

- `index.html`：页面结构和无障碍语义
- `styles.css`：响应式界面、浅色/深色模式
- `app.js`：记录、统计、导入导出与本地存储逻辑
- `manifest.json`：PWA 名称、显示方式和图标
- `service-worker.js`：离线缓存
- `icons/`：本地 PWA 图标

本项目不依赖外部字体、图标库、网络资源、后端或数据库。
