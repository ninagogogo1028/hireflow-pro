# HireFlow 项目交接文档

> 面向**接管本项目的新 AI 会话**。读完本文即可开始工作，不需要重新全量扫描代码库。
> 最后更新：2026-08-18（AI 服务端代理 · 任务 1a+1b 完成并验收：代理已部署且云端验证通过，**前端尚未切换，代码尚未提交**）

## 0. 新会话接管顺序

1. 读本文档
2. `git log --oneline -6` 与 `git status --short` 确认实际状态
3. **只读**完成当前任务真正需要的文件
4. 不要重新全量扫描项目，除非本文明确标注信息已过期
5. 沿用第 6 节已确认的架构决策，**不要每换一个会话就重新设计一次项目**

---

## 1. 产品当前定位

**HireFlow Pro** — 单机版轻量 ATS（招聘流程管理工具），纯前端、无后端、数据存在浏览器 localStorage。

当前服务的角色是**企业内部招聘专员**。四个模块：

| 模块 | 内容 |
|---|---|
| 仪表盘 | 累计简历 / 已入职 / 储备数 / 渠道排行（部分指标是硬编码假数据） |
| 招聘需求 & JD | 按「正式 HC / 实习生」分区管理职位，开启/关闭/删除 |
| 招聘流程 SOP | 7 列看板：初步筛选 → 发给LM → LM已确认 → 一/二/三面 → 入职确认 |
| 人才储备库 | 淘汰或直接入库人才，AI 职位对标、分配职位并激活 |

真正跑通且体验良好的亮点功能：**上传简历后调 Gemini 多模态自动回填姓名与联系方式**（`App.tsx:439-465`）。

产品成熟度：完成度不错、演示效果好的**原型**。UI 质量高于同阶段多数项目，但建立在三个撑不住的假设上：key 可放前端、数据只存本地、一个人只对应一个职位。

---

## 2. 双产品方向（已确认，2026-08-17）

### HireFlow HR
保留现有企业内部招聘 ATS 模型，面向中小企业 HR / 招聘团队。**当前仓库先作为这一方向的母体**，做安全化与基础架构整理。

### HireFlow Recruiter
未来从稳定母体分叉，面向独立猎头。

### 当前阶段硬约束
- **不同时开发两个版本**
- **不提前做 Recruiter 特有功能**（客户 BD、职位委托、推荐记录、佣金台账等）
- **不把 HR 模型硬改成猎头模型**
- 分叉前优先完成两版共同需要的基础设施与共享内核

### 为什么不能直接复制成猎头版
当前是「部门 + HC + 发给LM」的**甲方 HR 心智模型**。独立猎头的业务链条是：

```
客户公司(Client) → 职位委托(Mandate，含佣金率/结算条件/保证期)
  → 推荐(Submission，某候选人推给某客户的某职位，同一人可多次)
  → 面试 → Offer → 入职 → 保证期 → 开票/回款
```

核心差异：**候选人对猎头是长期资产、跨客户复用**，所以「候选人」与「某次推荐」必须是两个实体。当前 `Candidate` 内嵌单一 `jobId` + 单一 `status`（`types.ts:45-63`），一个人只能属于一个职位、只有一个状态。同一候选人明年推给另一个客户，只能复制一条新记录 → 简历库会脏。这是最深的一处耦合，越晚改越贵。

---

## 3. 技术栈与核心架构

```
React 19 + TypeScript + Vite 6
Tailwind CSS（CDN <script>，非构建集成）+ lucide-react
@google/genai（Gemini，浏览器端直连，无代理）  ← 前端仍在用，任务 2 才切换
Capacitor 8 → iOS / Android 原生壳
数据层：localStorage（key: hireflow_jobs / hireflow_candidates）
后端：Supabase（org `HireFlow` / project `hireflow-core`，Free Plan）
      Edge Function `ai-proxy` **已部署并云端验证通过**（见第 12 / 15 节）
      无 DB 表、无 Auth、无 Storage
```

⚠️ 注意当前是**过渡状态**：服务端代理已经在线可用，但**前端还没切过去**，仍走浏览器直连 Gemini。两条路并存，任务 2 才会真正切换并拔掉泄漏根因。

架构只有一层：**纯前端单体**。全部业务逻辑、状态、UI 都在 `App.tsx` 一个文件（1719 行）。无组件拆分、无路由、无状态管理库、无数据访问层。持久化是 `App.tsx:68-84` 两个 `useEffect` 全量 `JSON.stringify` 写入。约 40 个 `useState`。

工程化：**无测试、无 lint、无 CI**。

`index.html` 同时存在两套依赖来源：`:16-26` 的 importmap 从 esm.sh 拉 React/genai/lucide，而 `package.json` 又装了同样的 npm 包。构建时用 npm 那套，**importmap 是残留**。

### 关键文件

| 文件 | 作用 |
|---|---|
| `App.tsx` | 1719 行，整个应用（状态 + 逻辑 + 全部 UI + 4 个模态框） |
| `types.ts` | 领域模型全部定义在此 |
| `constants.tsx` | 种子数据 `INITIAL_JOBS` / `INITIAL_CANDIDATES` + `STATUS_LABELS` |
| `geminiService.ts` | 4 个 Gemini 调用函数 |
| `vite.config.ts` | ⚠️ `:13-16` 用 `define` 把 API key 明文内联进 bundle |
| `index.html` | Tailwind CDN、importmap 残留、引用了不存在的 `/index.css` |
| `capacitor.config.ts` | appId `com.hireflow.app`，webDir `dist` |
| `android/` `ios/` | Capacitor 原生工程，已纳入版本控制 |
| `tsconfig.json` | ⚠️ 已加 `exclude: ["supabase"]`，否则前端 `tsc --noEmit` 会因 Deno 全局报错 |
| `supabase/functions/ai-proxy/` | 服务端 AI 代理，三层结构，见第 15 节。**已部署上线，但代码未提交** |

---

## 4. 当前领域模型（`types.ts`）

```
CandidateStatus  NEW SCREENED LM_REVIEW LM_APPROVED
                 INTERVIEW_1/2/3 OFFER HIRED REJECTED BACKUP
                 （CONTACTED 已注释移除）
StageStatus      PENDING | APPROVED | FAILED      ← 与阶段正交，设计正确
JobType          FULL_TIME | INTERN

JobDemand    id title department description platforms[] createDate
             status(OPEN/CLOSED) type
Candidate    id name jobId? source status stageStatus isHighPotential
             resumeUrl? resumeFileName? contactInfo
             interviews[] onboardingInfo? notes[]
InterviewRecord  stage date interviewer feedback passed   ← 类型完整但无处录入
CandidateNote    id text timestamp
PlatformStats    platform count                            ← 未实现
```

**已定义但完全未实现：** `onboardingInfo`、`platforms`、`PlatformStats`、`InterviewRecord`（只在 `App.tsx:401` 初始化为 `[]`）。

**状态机断口：** `SCREENED` 与 `REJECTED` 有定义但看板无对应列（`kanbanStages` 硬编码在 `App.tsx:178-186`）。判「不通过」后唯一出口是「转储备」，不转则永久滞留；推进到 `HIRED` 后从看板消失且无「已入职」视图可找回。

---

## 5. 分叉原则与判据（已确认）

### 分叉节点不是日期，而是代码库状态
下面 4 件事完成、第 5 件尚未开始时分叉：

1. `App.tsx` 已拆分，UI 组件层与业务逻辑分离，共享组件已抽出
2. 数据访问层已抽象成接口，localStorage 只是其中一个实现
3. **Candidate 与「投递/推荐」已拆成两个实体**
4. AI 调用已移到服务端代理，key 不在前端
5. 尚未开始写 HR 的入职办理 / 猎头的佣金台账

### 关键前置建议
**分叉前就让 HR 版也采用「候选人 + 投递记录」两实体结构**（HR 叫 Application，猎头叫 Submission，形状一致）。这样两版共享同一候选人内核，分叉面只剩「职位+部门」对「委托+客户」这一侧。对 HR 版本身也是净收益（内部转岗、重复投递、老候选人再捞现在都做不了）。

### 分叉机制
- **用 git 分支分叉，不要复制文件夹。** 无共同祖先则任何共享修复只能手工搬运，一年后必然分裂
- 倾向结构：`shared/` + `apps/hr/` + `apps/recruiter/`，Vite alias 直接引用，**不用 npm workspace 发包**（单人维护，工具链摩擦不值得）
- 可在「母体基线完成」处打 tag（如 `baseline-pre-fork`）作为命名锚点

---

## 6. 已确认的重要架构决策

| # | 决策 | 状态 |
|---|---|---|
| 1 | 保留原 GitHub 仓库 `ninagogogo1028/hireflow-pro` 作为正式历史，不重新开始 | 已执行 |
| 2 | 本地用 `git reset --mixed origin/main` 接续历史，避免 unrelated histories | 已执行 |
| 3 | `android/` 与 `ios/` **纳入**版本控制（两版原生配置将各自演化，需可追溯） | 已执行 |
| 4 | 小而清晰、可回退的 commit，不做混杂大提交 | 进行中 |
| 5 | 后端选型 **Supabase**（Postgres + Auth + Storage + RLS + Edge Functions 一次解决多端同步、简历存储、key 泄漏三个问题） | **已确认并开始实施**（2026-08-18） |
| 6 | 分叉用 git 分支 + `shared/` 目录，不用 monorepo 工具链 | 待实施 |
| 7 | AI 层**不做 Gemini-only 设计**：业务层只表达任务，Provider 是可替换实现。未来可能接 OpenAI / Anthropic / DeepSeek / Kimi / 智谱 | 已确认，结构已落地 |
| 8 | 未来支持 **BYOK**（用户自带 Provider / API Key），但**本阶段不实现**，只保留接口边界 | 已确认，未实施 |
| 9 | 当前阶段**不做 Auth**；已接受「无法可靠验证调用方身份」这一结论，钱包兜底靠 Provider 侧硬额度上限 | 已确认 |
| 10 | 代理做完后**暂不重新部署 Netlify**，公开上线推迟到 Auth 完成之后 | 已确认 |

---

## 7. 两版共享 vs HR 特有

### 适合共享（分叉前应抽出）

**设计系统 —— 最强资产，但目前全是复制粘贴。** 4 处模态框共用同一骨架（`fixed inset-0 bg-slate-900/60 backdrop-blur-sm` + `rounded-3xl shadow-2xl animate-in zoom-in` + 彩色头部条 + 右上 X）；空状态（`border-2 border-dashed` + 淡化图标）重复约 5 次；另有统计卡片网格、带计数徽章的分区标题、看板列与卡片、侧边栏外壳。**不抽成组件，分叉后复制粘贴翻倍。**

**AI 层（`geminiService.ts` 整体）** — 调用范式统一（`responseMimeType: "application/json"` + `responseSchema` + try/catch 兜空值）：
- `parseResumeData` 机制 100% 共享，猎头版只需换 schema 提取更多字段
- `analyzeJD` 共享（目前**从未被调用**）
- `generateInterviewQuestions` 共享（目前**连 import 都没有**）
- `matchTalentToJob` 接口共享、**实现必须重写**：现在把整个储备库拼进 prompt（`App.tsx:475-477`），猎头版几千人塞不进，必须先检索再排序。**建议现在就把签名改成接收「已筛选的候选人集合」**，猎头版插入检索层时不用动调用方

**候选人实体** — `name/contactInfo/source/resumeUrl/notes/isHighPotential` 全共享；跟进记录机制（`App.tsx:225-243` 追加式、带时间戳、最新在顶）两版都要，猎头版需求更强。注意时间戳格式化在 `App.tsx:232` 和 `:371` 已重复一次，不抽出分叉后变四份。

**阶段与阶段内三态正交的设计** — 两版都继承，前提是把阶段列表变成**配置**而非硬编码。

**其余：** 持久化/数据访问抽象（目前不存在）、导入导出机制、多字段模糊搜索、Capacitor 工具链（appId 各自一份）。

### HR 特有，不应带进 Recruiter 版

| 内容 | 位置 | 猎头版对应 |
|---|---|---|
| `JobType: FULL_TIME/INTERN` + 实习生分区 | `App.tsx:998-1046` | 换成佣金模式（成功付费/预付定金）、职位级别 |
| 部门管理全套 | 状态、`App.tsx:329-342`、UI `:1459-1527` | 客户公司。下拉控件可改造成客户选择器，数据语义不迁移 |
| 人才库按 `job.department` 分组 | `App.tsx:314-317` | 按客户 / 职能 / 行业 |
| `LM_REVIEW` / `LM_APPROVED` | 枚举 | 「推给客户 / 客户通过筛选」。看着接近实则不同：这是猎头最关键的转化闸口，需独立推荐时间戳、推荐信、按客户维度通过率 |
| `onboardingInfo`（材料清单） | `types.ts:57-61` | 猎头只关心入职日期（触发佣金）、保证期起算、开票信息 |
| `platforms` / `PlatformStats` / 渠道排行 | `App.tsx:708-731` | 图表 UI 可复用，语义要换。`source` 枚举需整体替换——**「猎聘」对猎头是同行和工具，不是渠道** |
| `Candidate` 内嵌单一 `jobId` + 单一 `status` | `types.ts:45-63` | 见第 2 节，必须拆成两实体 |

---

## 8. Git 状态与历史

```
远端  origin  https://github.com/ninagogogo1028/hireflow-pro.git  (public, MIT)
分支  main    与 origin/main 同步（均在 e4616e1），upstream tracking 已设置
```

```
e4616e1  docs: add long-lived project handoff document           ← 本文档
4a2b8c8  build: add Capacitor iOS/Android native projects
96df831  feat: add data backup/restore and mobile responsive layout
8ecda7d  chore: harden .gitignore for secrets and build artifacts
50d6b24  feat: add local storage persistence                     ← 原 GitHub 历史
bb1a5b2  Initial commit: Open source release of HireFlow Pro      ← 原 GitHub 历史
```

Git 基线阶段那三笔的内容（`8ecda7d` / `96df831` / `4a2b8c8`）：
- `8ecda7d` — `.gitignore` 重组加固（+103/-9）：env 扩为 `.env`/`.env.*`、新增凭证与签名材料段、显式忽略 Capacitor 拷贝的 web 资源、原生构建产物。已用 `git check-ignore` 功能性验证
- `96df831` — `App.tsx`（+132/-56）：数据备份/恢复、移动端抽屉侧边栏+遮罩、全站响应式。`tsc --noEmit` 通过
- `4a2b8c8` — 73 个文件：Capacitor 原生工程 + `capacitor.config.ts`。提交前逐项确认无构建产物、无 web bundle、无 key、无 `.env`、无 keystore/证书/profile、无 `google-services.json`/`GoogleService-Info.plist`、无 DerivedData/xcuserdata、无本机绝对路径

**历史干净性已核实：** 两个原始 commit 的全部 28 个 blob 扫描过，**无任何真实密钥**。`README.md:53` 命中的是字面占位符 `your_actual_api_key_here`，无需处理。`.env.local`、`dist/`、原生 `public/` **从未进入历史**。

upstream tracking 已设置，`git push` 无需再带 `-u`。⚠️ 但按第 13 节，**任何 push 仍需用户明确指示**。

---

## 9. 当前工作区状态

```
git status --short →  M docs/HIREFLOW_PROJECT_HANDOFF.md
                      M tsconfig.json
                     ?? supabase/
HEAD: e4616e1（与 origin/main 同步）
tsc --noEmit: 通过（已 exclude supabase/）
deno check supabase/functions/ai-proxy/index.ts: 通过
```

⚠️ **任务 1a + 1b 的全部成果都还没提交。** 未提交的改动只有三项：

| 改动 | 说明 |
|---|---|
| 新增 `supabase/`（7 个文件） | 服务端代理，见第 15 节。**云端已部署**，但代码未进版本控制 |
| `tsconfig.json` 加 `exclude: ["supabase"]` | **必需**，否则服务端 Deno 文件会让前端 `tsc --noEmit` 报 4 处 `Cannot find name 'Deno'` |
| 本文档更新 | — |

注意一个反直觉的状态：**云端已经在跑的代码，本地还没 commit**。如果工作区丢失，需要用 `npx supabase functions download ai-proxy` 找回，或重写。**建议尽早提交。**

**前端与生产配置至今完全未动**（每轮都用 `git diff` 复核）：`App.tsx`、`geminiService.ts`、`vite.config.ts`、`package.json`、`package-lock.json`、`index.html` 六个文件零改动。App 当前行为与 Git 基线阶段完全一致，仍走浏览器直连 Gemini 的旧路径。

磁盘上存在但被正确忽略：`.env.local`（key 已吊销）、`dist/`、`android/app/src/main/assets/public/`、`ios/App/App/public/`。

---

## 10. 已知技术债、安全风险与待办

### P0 — 安全 / 数据丢失级

**1. API key 前端内联机制未修（泄漏根因）** —— 🔧 **修复进行中，任务 2 完成即解决，见第 12 节**
`vite.config.ts:13-16` 用 `define` 把 `GEMINI_API_KEY` 明文内联进 bundle。旧 key 已被用户吊销，但**机制未改，下一个 key 会以完全相同方式泄漏**。凡前端直连 LLM 的架构必然如此——key 没有藏身之处。

服务端代理已部署并验证可用（任务 1a + 1b），但**这两行 `define` 还在，前端仍走直连**。**本条到任务 2 完成才算解决。**

现状的一个好处：新 key 从一开始就只存在于 Supabase Secrets，**从未接触前端代码，也从未进入 Git 历史**。所以任务 2 不是"把 key 搬走"，而是"把前端那条直连路径拆掉"。

**2. 简历附件其实没有保存 —— 功能性 bug**
`App.tsx:366` 用 `URL.createObjectURL(file)` 生成 blob URL 存进记录。blob URL 生命周期绑定当前页面会话，**刷新即失效**。看板与人才库的简历链接下次打开全是死链，文件本体从未持久化。对猎头产品而言简历库就是全部资产。

**3. 一条坏数据永久白屏**
`App.tsx:69-74` 的 `JSON.parse(saved)` 无 try/catch 且跑在 `useState` 初始化里。localStorage 一旦写坏，每次启动都在同一行抛异常，**用户无任何自救路径**。配套问题：localStorage 上限 5–10MB，每次任何字段改动全量重写整个候选人数组，`QuotaExceededError` 无人捕获 → 静默丢数据。

**4. 数据导入零校验**
`App.tsx:518-534` 只判断 `Array.isArray` 就整体覆盖现有数据。**无确认弹窗、无备份、不可撤销**。备份/恢复功能本身成了最大的数据丢失来源。

**5. 候选人 PII 无保护**
姓名/电话/邮箱/简历明文存 localStorage，任何本机脚本或扩展可读；简历 base64 直传 Gemini（`App.tsx:451-452`）。猎头产品受 GDPR/个保法约束，需告知同意、保留期限、删除权 —— 目前全无。

任务 2 之后简历会改为流经自己的 Edge Function（服务端已确保不记录请求体，见第 15 节），**但 localStorage 明文存储与合规缺失两项不受影响，仍然成立**。

**6. AI 代理端点已公网可访问，钱包兜底只剩 Provider 侧额度上限**（2026-08-18 新增）
`ai-proxy` 已部署上线（URL 见第 12 节）。`verify_jwt = true` 拦住了无凭证请求，**但 anon key 设计上就是公开的，这不构成身份验证** —— 详见第 15 节安全姿态。

因此当前**唯一真实的金钱损失上限，是 Google 侧设置的硬额度上限**。若任务 0 中该上限尚未设置或设得过高，应尽快处理。相关缓解：只允许四个预定义任务（无自由 prompt 通道），大幅降低被当作免费通用 AI 白嫖的动机。

彻底解决要等 Auth。在那之前**不要把函数 URL 公开分发**，也不要重新部署 Netlify 公开站点（第 6 节决策 10）。

### P1 — 可用性 / 架构

- **Tailwind 走 CDN**（`index.html:8`）：官方标注不用于生产。Capacitor App **离线时界面完全失去样式**。同文件 `:27` 引用的 `/index.css` **不存在**（线上已验证 404）
- **1719 行单文件 + 约 40 个 useState**：任何协作或大改会立刻变成事故现场。`useState` + 全局 `useEffect` 序列化 → 改一条备注就重新序列化并渲染整棵树，候选人到几百量级输入明显卡顿
- **全局搜索只在看板页生效**：`filteredCandidates` 只被 pipeline 消费，在仪表盘/职位页输入毫无反应，用户会以为坏了
- **仪表盘一半是假数据**：`App.tsx:665` 「本年度目标 24/50」、`:682-683` 「42%」「同比上月提升 5%」全硬编码；`:695-697` 「生成最新诊断」按钮**没有 onClick**
- **AI 人才对标输入太薄**：只传 name + notes，不传简历内容/来源/历史面评，实际是在给备注打分
- **人才库部门分组基本失效**：直接入库的储备人才无 `jobId`，全落进「储备池 (未分配)」一个桶
- **AI 调用失败完全静默**（2026-08-18 记录，用户已指定为后续任务）：`geminiService.ts` 四个函数全部 `try/catch` 吞异常后返回空值（`null` / `[]`）。离线或出错时用户看到的是「点了没反应」，无任何提示。改服务端代理后**失败点从一个变两个**（Google 挂 + 自己的代理挂），本条重要性上升。代理已定义好中性错误码（`PROVIDER_TIMEOUT` / `PROVIDER_RATE_LIMITED` / `SERVER_MISCONFIGURED` 等）供前端区分展示，**但前端目前还没消费它们**
- **前端上传文件无大小校验**：`App.tsx:439-465` 对任意大小文件直接 `readAsDataURL` 读进内存转 base64。计划在任务 2 加客户端闸门（服务端闸门已在代理中实现）

### P2 — 细节缺陷（均已确认）

- `departments` 状态未持久化，刷新即丢，但 `App.tsx:420-423` 注释写着 "Permanently store"，行为与意图不符
- `App.tsx:472-473` 的 `if (!selectedJob) return` 在 `setIsMatchingLoading(true)` 之后 → 走到该分支 loading 永久卡住
- 全部 id 用 `Date.now()`，同毫秒批量操作会撞 ID → 建议 `crypto.randomUUID()`
- 所有确认交互用 `window.confirm`/`alert`，Capacitor 原生 WebView 内体验与样式不受控
- `App.tsx:1092` 的 `[string, any[]]` 类型标注放松了类型安全（`people`/`c` 退化为 `any`，该块内 Candidate 字段访问不再受检）→ 待收紧为 `[string, Candidate[]]`
- 磁盘上 `dist/` 与两个原生 `public/` 仍有含已吊销 key 的旧产物 → 建议在做服务端代理那轮一并清理（删除文件需用户确认）

---

## 11. Netlify 当前状态

```
https://hireflow-talentpool.netlify.app     Public，HTTP 200，仍在线
来源：Netlify Drop 手动拖拽上传，Published Jan 29
```

线上 `/assets/index-BWeSzOpL.js` 与本地 `dist/assets/index-BWeSzOpL.js` **sha256 完全一致**（`a0e922fbe3ee21c0`，539,903 字节），其中**含 1 处内联 Google API key**，与本地产物同一个 key。

该 key 用户已吊销。**无法从当前环境独立验证吊销生效**（到 `generativelanguage.googleapis.com` 的出网被阻断，HTTP 000）。

**用户决定：暂不删除、不重新部署，等 AI key 改成服务端代理后再处理。**

建议（供参考）：不要在改完 `define` 注入机制前重新部署，否则只是用新 key 重复同样的泄漏。正确顺序：删除或下线 → 完成服务端代理 → 重新部署干净版本。

---

## 12. AI 服务端代理迁移进度

总目标：**把 Gemini 调用改为服务端代理，消除 API key 前端内联机制**（P0-1，也是第 5 节分叉判据第 4 条）。

方案已定：**Supabase Edge Function**（对比过 Vercel Function 与自建 Node 代理）。选型理由是后端基础设施统一 —— Auth、DB、简历 Storage 之后都在 Supabase，不为了 AI 代理单独引入第二个供应商。

### 任务拆分与状态

| # | 任务 | 状态 |
|---|---|---|
| 0 | 用户后台准备：建 Supabase org/project、申请新 Gemini key、设额度上限、key 存入 Secrets | ✅ 已完成 |
| 1a | 服务端骨架（三层结构 + 本地可验证部分全部验证） | ✅ 已完成并验收 |
| 1b | 部署到 Supabase + 云端真实 Gemini 调用验证 | ✅ **已完成并验收（2026-08-18）** |
| 2 | 前端切到代理：改 `geminiService.ts`、删 `vite.config.ts:13-16`、加上传大小限制 | ⏸ **下一步，待用户批准** |
| 3 | 清理：移除 `@google/genai`、清 `index.html` importmap 残留、更新 README | ⏸ 未开始 |
| 4 | 删除含已吊销 key 的旧产物（`dist/` + 两个原生 `public/`），需单独确认 | ⏸ 未开始 |

⚠️ **代码全部未提交**（任务 1a + 1b 的成果都在工作区）。见第 9 节。

### 任务 0 已完成的事实（不要重复问用户）

- Supabase org `HireFlow`、project `hireflow-core`、Free Plan
- 新 Gemini key 已存入 Edge Function Secrets，名为 `GEMINI_API_KEY`
- 该 key **从未**进入前端代码、`.env.local` 或 Git 历史
- **不要要求用户提供 key 内容**

### 任务 1b 已完成的事实（云端环境，不要重复做）

```
project ref  dqntdqowwhhbbdblxcyj      region ap-southeast-1    ACTIVE_HEALTHY
函数 URL     https://dqntdqowwhhbbdblxcyj.supabase.co/functions/v1/ai-proxy
函数状态     slug=ai-proxy  status=ACTIVE  verify_jwt=true  version=1
后台入口     https://supabase.com/dashboard/project/dqntdqowwhhbbdblxcyj/functions
```

- CLI 已登录（用户本人在自己终端执行 `npx supabase login`，**未向 AI 提供任何 token**）
- 已 `link` 到上述 project ref，`supabase/.temp/` 存放 link 状态且已被 gitignore
- `config.toml` 的 `project_id` 已改为 `hireflow-core`。**这只是本地命名对齐，与远端 project ref 无关**，已实测改动后 link/deploy 仍指向正确项目
- **云端已验证可读取 `GEMINI_API_KEY`**（读不到会返回 `SERVER_MISCONFIGURED`，实际返回 200）
- ⚠️ **CLI 2.115.0 没有 `functions logs` 子命令**（只有 list/delete/download/deploy/new/serve）。**日志只能在网页后台看**，不要浪费时间找 CLI 命令

### 云端实测结果（任务 1b，全部使用构造的假数据）

| 验收项 | 结果 |
|---|---|
| 函数部署 | ✅ 5 个文件全部上传，`status=ACTIVE` |
| 云端读取 Secret | ✅ 真实调用成功即证明 |
| `parseResume` 真实调用 | ✅ HTTP 200，两次，3.9s / 4.8s |
| 返回结果正确性 | ✅ 姓名/邮箱/电话与构造的测试 PDF **逐字一致** |
| `matchTalentToJob` 真实调用 | ✅ HTTP 200，三个虚构候选人排序合理（95 / 85 / 40） |
| 自由 prompt 拒绝 | ✅ `task=prompt`、`task=chat` → 400 `UNSUPPORTED_TASK` |
| 大小上限 | ✅ 7MB 文件 → 413 `PAYLOAD_TOO_LARGE` |
| CORS | ✅ `capacitor://localhost` 放行；`evil.example.com` 无 ACAO 头 |
| `verify_jwt` 生效 | ✅ 不带凭证 → 401 `UNAUTHORIZED_NO_AUTH_HEADER`，函数代码未被执行 |
| 日志无 PII | ✅ **用户已在网页后台人工核查**：只有 event/task/provider/outcome/ms + boot/shutdown + 错误码，无 base64、姓名、邮箱、电话、key、简历正文 |
| 超时映射 | ⚠️ **云端未复现**（云端出网正常，无法自然触发）。任务 1a 本地已实测为 504 `PROVIDER_TIMEOUT` |

测试数据均为构造：手工生成的 801 字节 PDF（虚构人名 `Alex Testperson`、保留域名 `example.invalid`、虚构号段 `555-0100`）+ 虚构候选人「测试甲/乙/丙」。**未使用任何真实简历或候选人信息。**

### 一次已排除的误报（不要重新排查）

排查过一个 `403 预扣费额度失败，剩余 $0.077940 / 需要 $0.152212`。**已确认来自用户 Claude Code 所用的第三方中转站余额不足，与 HireFlow / Supabase / Gemini 完全无关**，用户已充值恢复。

结构性排除依据（对以后类似误报同样适用）：
- 上游 401/403 在 [gemini.ts:72-80](../supabase/functions/ai-proxy/providers/gemini.ts) 被映射为 HTTP **500**，不可能表现为 200
- [gemini.ts:139](../supabase/functions/ai-proxy/providers/gemini.ts) 对非 2xx 上游响应执行 `body.cancel()`，**上游原文从不读取**，所以上游报错文案在架构上无法穿透到客户端
- Google 的错误是英文结构化的（`PERMISSION_DENIED` / `RESOURCE_EXHAUSTED`），**Google Cloud 没有「预扣费余额」概念**（后付费+配额模型，非 USD 预付余额扣减）
- Supabase 网关错误形如 `{"code":"UNAUTHORIZED_NO_AUTH_HEADER"}`，英文且无金额字段

### 下一位 AI 应该从哪里开始

**任务 2：把前端切到代理。** 这是拔掉泄漏根因（`vite.config.ts:13-16`）的那一步。已知需要做的：

1. 改 `geminiService.ts` 内部实现为 `fetch` 调用代理，**四个导出函数签名保持不变**（`App.tsx` 不用动），并建议改名为中性的 `aiService.ts`
2. 删 `vite.config.ts:13-16` 两行 `define`，改用 `import.meta.env.VITE_AI_PROXY_URL`
3. `.env.local` 移除 `GEMINI_API_KEY`（磁盘上那把已吊销），新增代理地址与 anon key
4. **前端加上传文件大小校验**（`App.tsx:439-465` 目前完全没有）
5. **前后端 MIME 白名单对齐**：`App.tsx:445` 接受任意 `image/*`，服务端白名单是 pdf/png/jpeg/webp/heic/heif，gif/bmp 会被服务端 415 拒绝

⚠️ 任务 2 触及 `vite.config.ts`（生产配置）与 `App.tsx`，按第 13 节**开始前需用户再确认一次**。

⚠️ **本机到 Gemini 的出网被阻断**（`curl generativelanguage.googleapis.com` → HTTP 000，与第 11 节同一网络限制）。**但这不影响任务 2** —— 前端只需要连 Supabase（实测可达），Gemini 那一跳由云端函数完成。

如果用户希望先做别的，按性价比排序的备选：
1. AI 调用失败的用户提示（见第 10 节 P1，工作量小、体验收益明显；代理已提供中性错误码可直接消费）
2. 简历存储修复（P0-2，先落 IndexedDB 也比死链好）
3. localStorage 健壮性三处（P0-3 / P0-4）
4. `App.tsx` 拆分（分叉前单项价值最高，但工作量最大，建议在有测试后做）

---

## 13. 必须先征得用户确认的事项

以下动作**不得自行执行**：

- 架构变更、数据结构变更、大范围重构
- 删除文件
- 安装新依赖
- 修改生产配置（含 `vite.config.ts`）
- `git commit`
- **任何远程操作**：push / pull / merge / rebase / force push、远端仓库设置
- 创建新的功能性文件
- Netlify 上的任何操作

- **部署 Edge Function**（会让函数变成公网可访问，属对外动作）
- 在用户的 Supabase 后台做任何操作

另外，用户已明确以下几项当前**暂不处理**：
- **Netlify 站点**：推迟到 **Auth 完成之后**再重新部署（不是代理完成之后 —— 见第 6 节决策 10）
- **Auth / 用户系统**：本阶段不做
- **BYOK、多 Provider UI、接 DeepSeek/Kimi/智谱**：只保留接口边界，不实现
- **数据库迁移、简历持久化**：不在 AI 代理这几轮范围内

关于 Gemini key 的纪律：**不要要求用户提供 key 内容**。也不要用命令行设置 Secret（会让 key 进入 shell 历史），只让用户在 Supabase 网页后台粘贴。

---

## 14. 工作方式（小步执行）

- **一次只推进一个明确任务**
- 每个任务开始前先说明准备做什么
- **不因发现其他问题就顺手扩大修改范围**
- 发现新问题 → 记录进本文档第 10 节，除非阻塞当前任务否则不在本轮处理
- 优先保证项目安全、可回退、可验证，而不是一次完成很多工作
- 完成后停下等用户审核

### commit 纪律（已验证有效的流程）
1. `git add --dry-run <paths>` 先核对将暂存的文件清单
2. 汇报 diff 摘要 / 文件类型，确认范围符合本次 commit 主题
3. 发现范围外改动：
   - **纯类型标注、格式化、注释等零运行时影响**且与当前任务同批产生 → 可继续，但**必须显式报告**
   - **涉及业务行为、数据结构、状态流转、依赖、配置或安全边界** → **必须先停下确认**
4. `git add` 后再用 `git diff --cached` 复核
5. commit，**不 push**
6. 汇报 commit SHA、`git status --short`、`git log --oneline -N`

`Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>` 用户已确认保留在 commit message 中。

### 本文档更新时机
架构变化 / 数据模型变化 / 关键依赖增删 / 重大风险修复 / 项目阶段变化 / 做出需长期遵守的决策 / 下一步重点变化。

**纯格式调整、小型 UI 微调、无长期影响的小修复不要写进来**，避免污染。

### 主动交接
出现以下任一情况，主动告诉用户「**建议在这里 handoff 给新会话**」：上下文已很长、需反复重读已分析内容、开始重复分析已确认问题、即将进入新的大型开发阶段。

交接前：更新本文档 → 确认代码处于安全可理解状态 → 明确最后完成到哪里 → 明确是否有未提交修改 → 写清下一位应从哪个具体动作开始。**不要为了 handoff 再额外开发。**

---

## 15. AI 代理服务端结构（`supabase/functions/ai-proxy/`）

### 三层职责，以及未来换 Provider 时改哪一层

```
客户端  ──POST {task, input}──▶  index.ts        收发层    换 Provider 不改
                                    │
                                    ▼
                                 tasks.ts        任务层    换 Provider 基本不改
                                    │            （提示词 + 中性 JSON Schema）
                                    ▼
                                 provider.ts     契约层    换 Provider 不改
                                    │            （中性类型 + 错误码）
                                    ▼
                              providers/         实现层    ★ 只改这里
                                gemini.ts        （唯一知道 Gemini 的文件）
```

| 文件 | 行数 | 职责 |
|---|---|---|
| `index.ts` | 253 | CORS、方法校验、大小上限、限流、任务分发、超时策略、错误映射、无 PII 日志 |
| `tasks.ts` | 307 | 四个任务的提示词与返回结构 + 全部输入校验。**无任何 Gemini 痕迹** |
| `provider.ts` | 86 | 中性类型（`JsonSchema` / `Part` / `AiProvider`）、`ProxyError`、错误码、当前 Provider 常量 |
| `providers/index.ts` | 24 | Provider 解析（一个 switch，非注册表） |
| `providers/gemini.ts` | 192 | 唯一知道 Gemini endpoint / model 名 / schema 方言 / 凭证环境变量的文件 |

**四个任务全部已实现**：`parseResume`、`analyzeJD`、`matchTalentToJob`、`generateInterviewQuestions`（后两个前端目前未调用，但服务端已就绪）。

### 两个刻意的设计选择（不要"顺手改回去"）

**1. 所有 schema 都是顶层 object，即使调用方最终要的是数组。**
Gemini 允许顶层数组，但 OpenAI 的 structured outputs 等不允许。`matchTalentToJob` 与 `generateInterviewQuestions` 因此用 `{matches: [...]}` / `{questions: [...]}` 包一层，再由 `pick()` 拆开还原成数组返回给前端。**前端契约与今天完全一致**，但换 Provider 时不用重写任务定义。现在做零成本，以后做要改四处。

**2. 用 REST + `fetch`，不用 `@google/genai` SDK。**
服务端零第三方依赖，无需审计和升级。这也是为什么 `package.json` 不需要新增任何依赖。

### 错误码契约（前端应据此区分展示，目前尚未消费）

`BAD_REQUEST` `METHOD_NOT_ALLOWED` `PAYLOAD_TOO_LARGE` `UNSUPPORTED_TASK` `UNSUPPORTED_MEDIA_TYPE` `SERVER_MISCONFIGURED` `PROVIDER_ERROR` `PROVIDER_TIMEOUT` `PROVIDER_RATE_LIMITED` `INVALID_PROVIDER_OUTPUT`

这些码是**中性的**，换 Provider 后前端错误处理不用改。成功响应 `{data: ...}`，失败响应 `{error: {code, message}}`。

### 当前限制值（都可调）

| 项 | 值 | 位置 |
|---|---|---|
| 整体请求体 | 8 MB | `index.ts` `MAX_BODY_BYTES` |
| 单个文件（base64 后） | 6 MB | `tasks.ts` `MAX_FILE_BASE64_BYTES` |
| 单次候选人数 | 300（超出报错，**不静默截断**） | `tasks.ts` `MAX_CANDIDATES` |
| Provider 超时 | 60 秒 | `index.ts` `PROVIDER_TIMEOUT_MS` |
| 限流 | 30 次 / 分钟 / IP | `index.ts` `RATE_LIMIT_MAX_REQUESTS` |

支持的上传类型是**显式白名单**：pdf、png、jpeg、webp、heic、heif。前端目前接受任意 `image/*`，所以 gif/bmp 会被服务端以 `UNSUPPORTED_MEDIA_TYPE` 拒绝 —— 任务 2 需让前端白名单与此对齐。

### 安全姿态（准确表述，不要夸大）

**真正成立的：**
- Provider 凭证只存在 Supabase Secrets，不进任何客户端产物
- 只有四个预定义任务可调用，**无自由 prompt 通道** → 无法被当成通用 ChatGPT 白嫖（已实测：`{"task":"prompt"}` 被拒）
- 请求体永不写日志（已实测：日志只有 task/provider/outcome/code/ms）
- 上游错误响应体**不透传给客户端**，因为它可能回显提交内容 → 会泄漏候选人 PII

**只降低滥用概率，不构成身份验证：**
- CORS：能挡住其他网站在用户浏览器里发起的调用，**挡不住命令行直接请求**
- 限流：内存态、单实例。Edge 实例是临时且水平扩展的，所以实际上限比 30 松，且换 IP 即绕过
- `verify_jwt = true`：**当前几乎无安全价值** —— publishable anon key 随客户端发布，设计上就是公开的，能满足这个检查

**当前做不到：** 调用方身份验证。Auth 之前，任何拿到函数 URL + 公开 anon key 的人都能调用。**真正的钱包兜底是 Provider 侧的硬额度上限。**

**升级路径：** Auth 完成后，`verify_jwt = true` 开始有真实意义，函数内读取已认证用户即可，无需结构改动。

### 验证覆盖情况（1a 本地 + 1b 云端）

**本地已实测（任务 1a）：** CORS 白名单、方法校验、非法 JSON、信封结构、未知任务、自由 prompt 拒绝、四个任务的输入校验、三类大小上限、限流触发（第 31 次起 429）、缺 key 时 `SERVER_MISCONFIGURED`、超时映射为 504 `PROVIDER_TIMEOUT`、日志无 PII/无 key、`deno check` 与前端 `tsc --noEmit` 双通过。

**云端已实测（任务 1b）：** 见第 12 节表格。`parseResume` 与 `matchTalentToJob` 两个真实 Gemini 调用成功，**返回内容与构造的测试数据逐字一致 → schema 被 Gemini 正确遵守**。自由 prompt 拒绝、大小上限、CORS、`verify_jwt` 云端复验通过。日志无 PII 由用户在网页后台人工核查确认。

**仍未覆盖的两项：**
1. **云端超时路径**：云端出网正常，无法自然触发 60 秒超时。本地已验证映射正确，风险判断为低
2. **云端限流**：未在云端压测。且如安全姿态所述，内存态限流在水平扩展的 Edge 实例上本就比常量宽松，云端实测意义有限

### 与分叉方向的关系（第 5 节）

三层拆分刚好落在两版会分化的边界上：**任务层**是 HR 版与 Recruiter 版会分化的地方（猎头版简历解析要提取更多字段），**契约层与 Provider 层完全共享**。所以分叉时 `provider.ts` + `providers/` 进 `shared/`，`tasks.ts` 各版一份。

为此已做的零成本准备：**服务端所有命名都不含 "hr" 字样**，分叉时不用改名。

待定（等做数据库那轮再决定）：两版是否共用一个 Supabase 项目。这是数据隔离问题，不是 AI 问题。
