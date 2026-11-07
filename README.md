# guojia · 节点状态中心

一个自用、人工维护的国家与节点状态页面。前端使用原生 HTML / CSS / JavaScript，服务端使用 **Cloudflare Pages Functions（Advanced Mode）+ D1**。无需外部探针、订阅接口或测速服务。

- 简洁状态页，绿点表示可用，红点表示故障，同时显示文字状态。
- 每个国家 / 地区自动显示 emoji 国旗，支持同一国家添加多个节点。
- 为节点独立勾选 VIP1、VIP2、VIP3，可设备注和显示排序。
- 后台添加、编辑、删除节点，一键切换状态。
- 前台每 30 秒刷新数据，支持手动刷新、国家搜索和套餐过滤。
- 后台路径固定为 `/admin`（也支持 `/admin/`）；账号、密码仅在服务端读取。
- 登录 cookie 为 HttpOnly、SameSite=Strict；线上 HTTPS 下使用 Secure；8 小时有效。修改密码或账号会使已有会话失效。
- 登录失败按来源 IP 限流：15 分钟最多 10 次尝试。
- 正式数据库初始为空，不会发布虚构的示例国家。

## 已部署站点升级（本次修复）

1. 将本次修改提交到原仓库并部署到现有 Pages 项目，不要创建新项目。
2. 删除 Cloudflare 中旧的 `ADMIN_PATH` 变量；保留现有 `ADMIN_USERNAME`、`ADMIN_PASSWORD` Secrets 和 D1 的 `DB` 绑定。若预览环境也设置了旧变量，一并删除。
3. 等待 Git 集成部署完成；若变量在部署后才更改，重新部署最新提交以使配置生效。
4. 访问 https://guojia-8yr.pages.dev/admin 或 https://guojia-8yr.pages.dev/admin/ ，使用现有账号密码重新登录。

此次升级无需数据库迁移或初始化，**不要对已有生产数据库执行后文的新站初始化步骤**，不要删除数据库或更换绑定。`wrangler.toml` 与 `migrations/0001_initial.sql` 均保持原样。

旧代码只有在自定义路径变量存在且格式有效时才注册后台路由，缺失或配置不匹配时访问 `/admin` 会返回 404。现在前后端统一使用 `/admin/api/*`，HMAC 签名仅依赖服务器端账号和密码；旧版本 cookie 将失效，重新登录即可。残留的旧路径变量也不会影响新路由或签名。

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
2. 填写节点名，例如“日本 · 东京 01”；仅展示国家时，可以直接填“日本”。
3. 选择“可用”或“故障”。
4. 勾选能使用该节点的套餐，至少勾选一个。
5. 选填公开备注和排序，保存。

国旗会在前台和后台节点列表中自动显示。数据立即写入 D1，前台在下次刷新时同步；手动点击“刷新”可以立即获取。所有备注均对前台访客公开，不要填写连接密码等私密信息。

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
<a href="https://你的域名/?vip=1" target="_blank" rel="noopener noreferrer">🌍 查看本套餐国家与节点状态</a>

<!-- VIP2 套餐 -->
<a href="https://你的域名/?vip=2" target="_blank" rel="noopener noreferrer">🌍 查看本套餐国家与节点状态</a>

<!-- 所有 VIP3 套餐 -->
<a href="https://你的域名/?vip=3" target="_blank" rel="noopener noreferrer">🌍 查看本套餐国家与节点状态</a>
```

如果你的套餐系统不允许 HTML，请使用其编辑器的“插入链接”功能，粘贴相应 URL。

**套餐权限是独立勾选的，不会自动继承。** 如果一个节点三个套餐都能用，就同时勾选 VIP1、VIP2、VIP3。这个页面用于公开展示套餐覆盖范围，查询参数只是筛选；用户可以切换到其他套餐查看，页面不会验证付费订阅身份。实际节点使用权限仍由你的订阅系统控制。

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

测试使用 Node.js 内置 SQLite 模拟 D1 接口，覆盖真实 SQL、节点增删改、登录会话、鉴权、来源校验、字段验证及限流；没有第三方测试依赖。这不代替在你实际的 Cloudflare 账户中完成部署验收。

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
- **emoji 国旗显示为字母**：由操作系统的 emoji 字体决定，部分 Windows 环境可能显示国家代码；国家名称和服务状态仍正常显示。
- **修改代码后数据是否丢失**：节点存储在 D1，正常重新部署不会清空；不要删除数据库或改变绑定到其他库。
- **同步时间**：前台自动刷新周期为 30 秒，后台保存或前台手动刷新不需要重新部署。
- **不是实时探针**：故障和恢复均由你手动切换，不会自动测速或连接节点。
- **旧会话仍有效吗**：退出会清除本浏览器 cookie；修改账号或密码会使所有已发出的会话失效。密码轮换后重新部署生效。

## 文件结构

```text
public/
  index.html          前台
  admin.html          后台模板（仅由 /admin 或 /admin/ 访问）
  app.js              前后台交互
  styles.css          响应式样式
  countries.js        国家数据与 emoji 国旗
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
