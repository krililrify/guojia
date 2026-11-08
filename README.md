# guojia · VIP 节点与权益（斜角标签版）

原生 HTML / CSS / JavaScript + Cloudflare Pages Functions Advanced Mode + D1。后台固定 `/admin`。

## 本次 UI 调整

- 在线设备数从独立信息区移到卡片右上角的斜角横幅，例如“1 台在线”“3–4 台在线”。
- 标题、套餐介绍、服务说明与地区区块标题居中，地区名称与数量按两端对齐，方便扫读。
- 优化柔和配色、卡片边框和留白；保留桌面三列、手机单列自适应。
- 设备补充说明保留在套餐标题区下方，可在后台清空。
- 后台配置和数据结构均不变。修改“同时在线设备数”后，前台斜角横幅自动同步。

覆盖全部文件并重新部署即可，无需 SQL、数据库迁移或新增环境变量。后台仍为 `/admin`，36 项现有测试通过。

## 既有功能

- 加宽三档卡片，减少桌面两侧留白，字号与卡片内部间距同步增大。
- 桌面为三列，手机（680px 及以下）为单列竖排，保持文本可读，无需横向滑动。
- VIP2 的“且包含 VIP1 全部节点”、VIP3 的“且包含 VIP1、VIP2 全部节点”紧跟各自的支持节点数量，不再放在页面底部。
- 继续只展示三档权益卡，不恢复下方总览、搜索、编号列表或运行状态。
- 增加后台“卡片权益设置”，设备数等文案不再需要修改代码。

## 后台修改设备数与卡片权益

1. 访问 `/admin` 并使用现有账号密码登录。
2. 展开顶部的 **卡片权益设置**。
3. 分别修改 VIP1、VIP2、VIP3 的配置。
4. 点击 **保存三档卡片权益**。前台最多约 30 秒自动更新；刷新浏览器可立即获取。

可配置字段：

| 字段 | 示例 | 说明 |
| --- | --- | --- |
| 卡片简介 | 轻量入门 | 卡片标题上方的小字 |
| 同时在线设备数 | `1`、`5`、`3–4`、`4-8` | 正整数或从小到大的区间，数字上限 999；单位固定为台 |
| 设备补充说明 | 300GB 套餐支持 4 台 | 可清空，清空后隐藏 |
| 服务类别 | AI 与流媒体 | 用于“支持 / 不支持”后面的文字 |
| 具体服务 | Gemini / ChatGPT / Netflix | 可清空 |
| 支持平台 | Windows / iOS / Android / Mac | 可清空 |
| 是否支持上述服务 | 支持 / 不支持 | 直接控制前台对应文案 |

保存的是整套三档配置。点击“重新载入已保存配置”会在确认后覆盖当前未保存的草稿。管理节点时不会重置尚未保存的权益草稿。

没有保存过配置的旧站点会显示默认权益：VIP1 为 1 台、VIP2 为 2 台、VIP3 为 3–4 台（默认说明为 300GB 套餐支持 4 台）；VIP1/2 默认不支持 AI 与流媒体，VIP3 默认支持。之后以你在后台保存的配置为准，重新部署不会覆盖数据库中已保存的配置。

国家和节点数量仍由下方线路组管理，不能在卡片文案里手填。VIP1 / VIP2 / VIP3 标题和节点继承规则固定。

## 节点自动向上包含

后台线路组选择最低支持套餐即可：

- VIP1 起：三档都包含。
- VIP2 起：VIP2、VIP3 包含。
- 仅 VIP3：只在 VIP3 中显示。

旧多选记录按最低勾选等级理解，同一条记录在每档只计算一次。支持数量不受历史运行状态影响。此项目仅展示权益，不会替你修改订阅平台的实际节点访问权限。

## 已部署站点覆盖升级

1. 将完整 ZIP 中全部文件按原路径覆盖到现有 GitHub 仓库根目录并提交。
2. 等待现有 Cloudflare Pages 项目部署完成。
3. 保留 `ADMIN_USERNAME`、`ADMIN_PASSWORD` 两个服务端 Secrets 和现有 D1 绑定 `DB`。后台路径仍为 `/admin`，不要设置 `ADMIN_PATH`。
4. 登录后台，展开卡片权益设置后修改并保存。

**无需执行 SQL、迁移、重建数据库或重新录入节点，也无需新增环境变量。** 卡片配置复用现有 `metadata` 表中的 `vip_card_settings` 记录，节点数量继续使用原有记录，表结构保持原样。配置和更新时间在同一个事务内保存。

新增 `public/vip-config.js` 是共享的默认权益与校验模块，不包含管理员账号密码。`GET /api/status` 在原有节点响应中增加 `cards` 配置。后台读取、保存配置分别为 `GET /admin/api/settings`、`PUT /admin/api/settings`，受现有登录及请求来源验证保护。

管理备注不在前台界面展示，但现有公开接口仍包含该字段，请勿填写敏感信息。

## 验证

36 项自动测试通过，包括默认配置与旧库兼容、登录和跨站保护、设备数及服务配置保存后公开同步、无效输入拒绝、事务回滚，以及既有节点管理和继承统计。浏览器已验证后台修改设备数和说明后前台读取到新值，并检查手机布局无横向溢出。

测试只使用本地 SQLite，不操作生产数据库。压缩包不包含预览节点、测试时保存的配置或真实账号密码。

以下初始化步骤仅适用于全新部署；已部署站点直接按上面的覆盖升级流程处理。

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
  status-model.js     国家聚合与套餐向上继承
  vip-config.js       三档卡片默认权益与配置校验
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
