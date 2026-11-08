# guojia · VIP 节点与权益

一个自用、人工维护的国家与节点支持范围页面。前端使用原生 HTML / CSS / JavaScript，服务端使用 **Cloudflare Pages Functions（Advanced Mode）+ D1**。无需外部探针、订阅接口或测速服务。

- 按套餐展示支持的国家和节点数量，不展示在线、故障、红绿状态或健康度。
- 每个国家 / 地区自动显示 emoji 国旗，支持同一国家添加多个节点。
- 为线路组独立勾选 VIP1、VIP2、VIP3，可设置备注、数量和显示排序。
- 后台添加、编辑、删除线路组，只需维护国家、名称、数量和 VIP 归属。
- 首页同时展示 VIP1、VIP2、VIP3 三档权益；地区与支持数量每 30 秒刷新，支持手动刷新和下方节点搜索。
- 后台路径固定为 `/admin`（也支持 `/admin/`）；账号、密码仅在服务端读取。
- 登录 cookie 为 HttpOnly、SameSite=Strict；线上 HTTPS 下使用 Secure；8 小时有效。修改密码或账号会使已有会话失效。
- 登录失败按来源 IP 限流：15 分钟最多 10 次尝试。
- 正式数据库初始为空，不会发布虚构的示例国家。

## 本版调整：只展示支持范围

- 将节点“在线”统一改为“支持”，例如“日本 · 支持 10 个”。设备权益中的“同时在线设备”仍保留，这是套餐允许的设备数。
- 取消运行状态概览、故障数量、红绿标识和状态着色，编号改为统一样式。
- 数量包含该 VIP 对应的所有节点，旧版标为故障的记录也计入支持范围。
- 后台移除状态选择及切换按钮；新增记录自动使用兼容值，编辑时保留旧字段，不改表结构或清除数据。
- 前台不展示管理备注，避免把历史维护说明带到支持范围页面；原备注数据保留在后台。
- 保留三档并列权益、国家分组、数量管理及节点编号。

覆盖代码并重新部署即可，无需执行 SQL、重新录入节点或修改环境变量。后台仍为 `/admin`。

## 首页：VIP 三档并列对比

标题为“VIP 节点与权益”，VIP1、VIP2、VIP3 三档同时展示，客户无需点击筛选即可比较：

| 权益 | VIP1 | VIP2 | VIP3 |
| --- | --- | --- | --- |
| 同时在线设备 | 1 台 | 2 台 | 3 台，300GB 套餐为 4 台 |
| Gemini / ChatGPT / Netflix 等 AI 与流媒体 | 不支持 | 不支持 | 支持 |
| 客户端平台 | Windows / iOS / Android / Mac | 同左 | 同左 |
| 节点地区与支持数量 | 根据后台勾选 VIP1 的组汇总 | 根据后台勾选 VIP2 的组汇总 | 根据后台勾选 VIP3 的组汇总 |

国家名称、国旗和支持节点数量来自现有数据库；不填充示例地区。所有历史记录都计入支持数量，不受原有状态字段影响。共有线路分别体现在所属等级中，全站总数不重复计算。

设备数和服务权益依据现有套餐说明写在 `public/index.html` 中；如果套餐政策变化，修改三个权益卡对应文案后重新部署即可。这些权益不随历史节点状态变化。

下方保留全部国家的线路组、编号与搜索。搜索只影响详细节点列表，不隐藏首屏权益对比。手机也保持三档并列显示。原有套餐外链继续可用，只突出对应卡片。

本版只调整首页展示，不改后台、鉴权、D1 表结构或现有数据。覆盖文件并重新部署，无需执行 SQL 或增加环境变量。

## 本次新增：国家分组与节点数量

后台每次添加一条“线路组”，填写：国家 / 地区、线路组名称、节点数量、适用 VIP 套餐、管理备注和排序。

例如：选择新加坡，名称“新加坡普通线路”，数量 `10`，勾选 VIP1 / VIP2 / VIP3，保存一次即可。前台会展示一张新加坡卡片，显示“支持 10 个”，下方自动列出 `01 02 03 04 05 06 07 08 09 10`。

- 每组数量支持 `1–200`，可以随时编辑数量。
- 同一国家的不同线路组自动合并到一张国家卡片，保留各组的名称、数量和适用套餐。
- 前台不判断运行状态；例如历史数据有 8 个可用、2 个故障，合计显示“支持 10 个”，不需要维护状态。
- 首屏三张权益卡各自按 VIP 归属统计地区与支持数量，不会把其他套餐专属的线路算进该卡片。无需点击筛选。
- 一个国家下的编号按当前显示的组顺序连续生成，搜索、数量或排序变化后可能重新编号；编号仅用于展示，不是客户端实际节点 ID。
- 每组超过 20 个时，前 20 个直接展示，其余可以点击展开，避免页面过长。
- 旧记录默认数量为 1，并自动按国家合并显示；可以直接编辑旧记录数量。多个原有记录不会被自动删除或合并数据库行，以免丢失原名称和备注。

## 已部署站点升级（无需改数据库）

1. 解压完整 ZIP，将全部文件按原目录覆盖到现有 GitHub 仓库根目录，提交后让现有 Pages 项目重新部署。
2. 保留现有 `ADMIN_USERNAME`、`ADMIN_PASSWORD` 服务端 Secrets，以及 D1 的 `DB` 绑定，不需要新增变量。后台固定为 `/admin` 或 `/admin/`。
3. 若还残留旧版 `ADMIN_PATH` 变量，可以删除；新代码完全不读取它。
4. 部署完成后登录 https://guojia-8yr.pages.dev/admin ，编辑旧记录或添加新的国家线路组并填写数量。

**已有站点无需执行任何初始化 SQL 或迁移。** 此版本复用现有 `metadata` 表，以 `node_quantity:记录ID` 保存组数量，节点和数量在同一个 D1 事务中保存；删除组时同步清理数量。没有数量记录的旧数据自动按 1 读取。

`wrangler.toml` 与 `migrations/0001_initial.sql` 均沿用上一版，不要删除、重建数据库或更换绑定。下文建库和初始化步骤仅供全新部署使用。本压缩包不包含生产数据库数据、实际账号密码或预览示例数据。

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

1. 输入或选择国家 / 地区；也可输入 `JP`、`US`、`HK` 等两位代码。
2. 填写线路组名，例如“东京普通线路”，再填写节点数量，例如 `10`。
3. 无需选择节点状态；前台展示支持范围，不做状态判断。
4. 勾选能使用该节点的套餐，至少勾选一个。
5. 选填管理备注和排序，保存。

国旗会在前台和后台节点列表中自动显示。数据立即写入 D1，前台在下次刷新时同步；手动点击“刷新”可以立即获取。备注在前台界面不展示，但现有公开接口仍包含该字段，不要填写连接密码等私密信息。

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

**套餐权限是独立勾选的，不会自动继承。** 如果一个节点三个套餐都能用，就同时勾选 VIP1、VIP2、VIP3。这个页面用于公开展示套餐覆盖范围，三档同时公开可见。`?vip=1/2/3` 只突出对应权益卡，不隐藏其他等级；页面不会验证付费订阅身份。实际节点使用权限仍由你的订阅系统控制。

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

测试使用 Node.js 内置 SQLite 模拟 D1 接口，覆盖真实 SQL、组数量保存与删除、事务回滚、旧数据兼容、国家聚合与VIP数量筛选、节点增删改、登录会话、鉴权、来源校验、字段验证及限流；没有第三方测试依赖。这不代替在你实际的 Cloudflare 账户中完成部署验收。

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
- **同步时间**：前台自动刷新周期为 30 秒，后台保存或前台手动刷新不需要重新部署。
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
