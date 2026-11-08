# guojia · VIP 节点与权益

一个自用的简洁权益展示页。基于原生 HTML / CSS / JavaScript、Cloudflare Pages Functions Advanced Mode 与 D1，后台固定为 `/admin`。

## 本版首页

只保留标题、VIP1 / VIP2 / VIP3 三张并列权益卡，以及底部的节点继承说明。

- 卡片展示支持的国家、各国家数量、该等级总数量、同时在线设备和支持服务。
- 删除全站总览、刷新按钮、搜索、检查时间、国家明细、线路组、节点编号列表及长段说明。
- 不显示运行状态或故障标识，统一使用“支持 X 个”。
- 页面每 30 秒自动获取数据；没有真实数据时显示待发布，不使用示例国家填充。
- 原有套餐外链 `?vip=1/2/3` 继续可用，只突出对应卡片，三档始终并列。

| 权益 | VIP1 | VIP2 | VIP3 |
| --- | --- | --- | --- |
| 同时在线设备 | 1 台 | 2 台 | 通常 3 台；300GB 套餐 4 台 |
| Gemini / ChatGPT / Netflix 等 AI 与流媒体 | 不支持 | 不支持 | 支持 |
| 客户端平台 | Windows / iOS / Android / Mac | 同左 | 同左 |
| 支持的节点 | VIP1 起的节点 | 包含 VIP1，再加 VIP2 起的节点 | 包含 VIP1 / VIP2，再加 VIP3 节点 |

设备与服务文案基于现有套餐说明，写在 `public/index.html` 中。国家、数量由后台维护。

## 节点自动向上包含

底部说明为：**VIP2 包含 VIP1 全部节点；VIP3 包含 VIP1、VIP2 全部节点。**

后台添加国家时，选择“最低支持套餐”即可：

- **VIP1 起**：VIP1、VIP2、VIP3 都会包含。
- **VIP2 起**：VIP2、VIP3 包含，VIP1 不包含。
- **仅 VIP3**：只在 VIP3 显示。

例如：日本 5 个和新加坡 5 个选 VIP1 起，美国 4 个和越南 3 个选 VIP2 起，香港 6 个选仅 VIP3，则三档分别支持 10、17、23 个节点，地区也相应包含。

旧记录无需修改或重新录入。如果旧版勾选多个等级，按其中最低等级理解。比如 `[1,3]` 现在表示 VIP1 起，VIP2 也自动继承。同一条线路不会因勾选多个等级重复累加；若曾人为创建多条重复记录，本项目无法判断它们是否代表相同真实节点，需要在后台自行核对。

## 已部署站点升级

1. 解压完整 ZIP，将全部文件按原目录覆盖到原 GitHub 仓库根目录，提交并重新部署现有 Pages 项目。
2. 保留原来的 `ADMIN_USERNAME`、`ADMIN_PASSWORD` 两个服务端 Secrets 及 D1 的 `DB` 绑定，后台仍为 `/admin`。
3. 无需新增变量、执行 SQL 或迁移，不要初始化、删除或重建生产数据库。
4. 数量仍复用现有 `metadata` 表保存，旧记录默认数量为 1。历史状态字段保留但不影响前台统计。

`wrangler.toml`、建表 SQL、鉴权和服务端读写逻辑沿用上一版。旧版 `ADMIN_PATH` 无需设置。管理备注不显示在前台界面，但现有公开接口仍包含该字段，请勿存放敏感信息。

29 项测试通过，覆盖向上继承、国家聚合、旧多选数据、去重计数、数量保存、旧数据、登录鉴权及事务回滚。浏览器已验证精简首页与后台最低套餐选择和保存。压缩包不包含生产数据或预览示例数据。

以下建库和初始化步骤仅供全新部署使用；已有站点按上面的升级步骤处理即可。

## 部署方法（Cloudflare Pages + GitHub）

### 1. 上传到 GitHub

把 **本 README 同级的全部项目文件和文件夹** 上传到你的仓库：

https://github.com/krililrify/guojia

仓库根目录应该直接有 `package.json`、`wrangler.toml`、`public/`、`migrations/`，不要再套一层 `guojia/`。需要保留 `.gitignore` 与 `.dev.vars.example`；不要上传真实密码文件 `.dev.vars`。

### 2. 创建 D1 数据库

在 Cloudflare 控制台进入 **存储和数据库 → D1 SQL 数据库 → 创建数据库**，名称建议为 `guojia-status`。

复制它的 **Database ID**，打开仓库中的 `wrangler.toml`，把：

```toml
database_id = "REPLACE_WITH_YOUR_D1_DATABASE_ID"
```

替换成实际 ID。如果数据库名不同，也要修改 `database_name`。保留 `binding = "DB"`，这是代码使用的绑定名称。

### 3. 初始化数据库

在 D1 数据库的 **Console / 控制台** 内粘贴并运行 `migrations/0001_initial.sql` 的全部 SQL。

这一步会创建节点表、登录限流表和更新时间表。首次部署前需要执行一次；SQL 使用 `IF NOT EXISTS`，再次执行不会清空现有节点。

也可以在安装 Node.js 后通过命令行创建并初始化：

```bash
npm install
npx wrangler login
npx wrangler d1 create guojia-status
# 把返回的数据库 ID 填入 wrangler.toml，然后运行：
npm run db:remote
```

**控制台执行 SQL 和命令行迁移二选一即可。**

### 4. 创建 Pages 项目

Cloudflare 控制台 → **Workers 和 Pages → 创建 → Pages → 连接 Git / 导入现有 Git 存储库**。选择 `krililrify/guojia`。

设置：

| 项目 | 值 |
| --- | --- |
| 生产分支 | `main`（或你的默认分支） |
| 框架预设 | None / 无 |
| 构建命令 | 留空 |
| 构建输出目录 | `public` |
| 根目录 | 留空，即仓库根目录 |

项目名称可以使用 `guojia`；如果名称已被占用，选择其他名称即可。不要创建成 Workers 项目。本项目的 `public/_worker.js` 是 **Pages Advanced Mode** 服务端入口。

`wrangler.toml` 已声明 D1 绑定；Cloudflare 会据此绑定数据库，无需在控制台再创建同名绑定。若调整绑定，确保最终名称为 `DB` 且指向刚创建的数据库。

### 5. 设置两个管理员 Secrets

在 Pages 项目 → **设置 → 变量和机密 / Variables and Secrets** 添加生产环境配置，两个变量都选择 Secret / 机密类型：

| 变量名 | 示例 | 说明 |
| --- | --- | --- |
| `ADMIN_USERNAME` | 你自行设置的账号 | 必须作为 Secret / 机密保存 |
| `ADMIN_PASSWORD` | 你自行设置的随机长密码 | **至少 16 个字符，必须作为 Secret / 机密保存** |

后台路径永久固定为 `/admin`，不需要路径环境变量。Secret 的配置值不要带引号。项目没有内置生产账号或密码；`.dev.vars.example` 仅是本地开发占位示例，不可作为生产凭据。

设置完成后，在部署页面选择 **重新部署 / Retry deployment**，让新变量生效。若你使用预览部署，也需要为预览环境单独配置变量和数据库；建议使用独立预览数据库，避免测试操作修改生产数据。

> 除这两个登录 Secrets 外，只需设置 D1 的 `DB` 绑定。不要把账号密码写进 HTML、GitHub 仓库或前端环境变量。

### 6. 访问并添加节点

假设你的实际域名是 `https://你的站点.pages.dev`：

- 前台：`https://你的站点.pages.dev/`
- 后台：`https://你的站点.pages.dev/admin`（或 `/admin/`）

登录后：

1. 输入或选择国家 / 地区，也可以填写 `JP`、`SG` 等两位代码。
2. 填写线路组名称与节点数量（1–200）。
3. 选择最低支持套餐：VIP1 起、VIP2 起或仅 VIP3。
4. 选填管理备注、排序，保存。

国旗会在前台和后台节点列表中自动显示。数据立即写入 D1，前台在下次自动更新时同步，也可以刷新浏览器立即获取。备注在前台界面不展示，但现有公开接口仍包含该字段，不要填写连接密码等私密信息。

## 在套餐介绍里添加链接

把下面的域名替换为部署后的真实域名：

| 你的套餐 | 使用链接 |
| --- | --- |
| VIP1 20GB | `https://你的域名/?vip=1` |
| VIP2 50GB | `https://你的域名/?vip=2` |
| VIP3 20GB / 50GB / 110GB / 300GB | `https://你的域名/?vip=3` |

支持 HTML 的套餐描述可加入：

```html
<!-- VIP1 套餐 -->
<a href="https://你的域名/?vip=1" target="_blank" rel="noopener noreferrer">🌍 查看本套餐国家与支持节点</a>

<!-- VIP2 套餐 -->
<a href="https://你的域名/?vip=2" target="_blank" rel="noopener noreferrer">🌍 查看本套餐国家与支持节点</a>

<!-- 所有 VIP3 套餐 -->
<a href="https://你的域名/?vip=3" target="_blank" rel="noopener noreferrer">🌍 查看本套餐国家与支持节点</a>
```

如果你的套餐系统不允许 HTML，请使用其编辑器的“插入链接”功能，粘贴相应 URL。

**节点权益自动向上继承。** 最低等级为 VIP1 的线路计入 VIP1 / VIP2 / VIP3；最低等级为 VIP2 的线路计入 VIP2 / VIP3；最低等级为 VIP3 的线路只计入 VIP3。旧版多选记录按最低勾选等级理解，每条记录在每档中仅计算一次。`?vip=1/2/3` 只突出对应权益卡，不隐藏其他等级。此项目只负责展示，不会修改实际订阅平台中的节点访问权限。

## 本地开发

需要 Node.js 22.13 或更新版本。推荐 Node.js 24 LTS。

```bash
npm install
cp .dev.vars.example .dev.vars
# 编辑 .dev.vars，设置你自己的账号、至少 16 位密码；后台固定为 /admin。
# wrangler.toml 也需要填写有效的数据库 ID。
npm run db:local
npm run dev
```

Wrangler 通常会输出 `http://localhost:8788`。本地数据库和生产数据库相互独立。`npm run db:local` 初始化本地库，`npm run db:remote` 初始化生产库，不要混淆。

```bash
npm test
```

测试使用 Node.js 内置 SQLite 模拟 D1 接口，覆盖真实 SQL、组数量保存与删除、事务回滚、旧数据兼容、国家聚合、VIP向上继承与去重计数、节点增删改、登录会话、鉴权、来源校验、字段验证及限流；没有第三方测试依赖。这不代替在你实际的 Cloudflare 账户中完成部署验收。

也可以通过 Wrangler 部署：

```bash
npx wrangler login
npm run deploy
```

首次部署会提示选择或创建 Pages 项目。若项目实际名称不是 `guojia`，同步修改 `wrangler.toml` 的 `name`，或者显式使用 `npx wrangler pages deploy public --project-name 你的Pages项目名`。通过控制台设置机密后需要重新部署。不要使用控制台拖拽静态文件的方式代替完整 Git / Wrangler 部署。

## 常见问题

- **后台显示 503 / 配置未完成**：检查 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 两个生产 Secrets，密码不少于 16 个字符，然后重新部署。
- **前台提示数据库未绑定 / 服务不可用**：检查 `wrangler.toml` 数据库 ID、`DB` 绑定，以及是否已经执行初始化 SQL。
- **后台 404**：后台固定为 `/admin` 或 `/admin/`；`/admin.html` 仍不可直接访问。如果 `/admin` 返回 404，请确认 Pages 已部署此版本，并且构建输出目录为 `public`。
- **前台无节点**：初始数据库为空；登录后台添加节点，并确认勾选了对应套餐。
- **emoji 国旗显示为字母**：由操作系统的 emoji 字体决定，部分 Windows 环境可能显示国家代码；国家名称和支持数量仍正常显示。
- **修改代码后数据是否丢失**：节点存储在 D1，正常重新部署不会清空；不要删除数据库或改变绑定到其他库。
- **同步时间**：前台自动刷新周期为 30 秒，后台保存或刷新浏览器不需要重新部署。
- **支持范围说明**：此页只展示国家与支持数量，不展示或检测运行状态。
- **旧会话仍有效吗**：退出会清除本浏览器 cookie；修改账号或密码会使所有已发出的会话失效。密码轮换后重新部署生效。

## 文件结构

```text
public/
  index.html          前台
  admin.html          后台模板（仅由 /admin 或 /admin/ 访问）
  app.js              前后台交互
  styles.css          响应式样式
  countries.js        国家数据与 emoji 国旗
  status-model.js     国家分组、节点数量汇总与套餐筛选
  _worker.js          Pages Functions 服务端、鉴权和数据库读写
  favicon.svg         图标
migrations/
  0001_initial.sql    数据库初始化
tests/                使用真实 SQLite 的接口测试
wrangler.toml         Pages 和 D1 配置
.dev.vars.example     本地登录变量示例
```

修改页面品牌文字可编辑 `public/index.html` 和 `public/admin.html` 中的“节点服务”。不需要修改后端。

技术依据：[Pages Advanced Mode](https://developers.cloudflare.com/pages/functions/advanced-mode/)、[D1 绑定](https://developers.cloudflare.com/pages/functions/bindings/)、[Pages Wrangler 配置](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)、[Git 集成](https://developers.cloudflare.com/pages/configuration/git-integration/)。
