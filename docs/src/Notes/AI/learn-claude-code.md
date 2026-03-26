---
updateTime: '2026-03-26 07:54'
tags: AI
---
# learn-claude-code：Harness 工程学习笔记

> 仓库地址：[shareAI-lab/learn-claude-code](https://github.com/shareAI-lab/learn-claude-code)

## 一、核心观点：模型即 Agent

在讨论如何构建 Agent 之前，需要先厘清一个根本性的概念：

**Agent 是一个模型，不是框架，不是 Prompt Chain，也不是拖拽式工作流。**

Agent 本质上是一个神经网络——经过数十亿次梯度更新在行动序列数据上训练过的 Transformer，它能感知环境、推理目标、并采取行动。这个定义从 AI 领域诞生之初就没有变过：

- 2013 年 DeepMind DQN 打 Atari 游戏，**那个模型就是 Agent**
- 2019 年 OpenAI Five 击败 Dota 2 世界冠军，**那五个神经网络就是 Agent**
- 2024-2025 年 Claude/GPT 作为 Coding Agent，读代码库、写实现、Debug，**那个大模型就是 Agent**

所有里程碑都有同一个真相：**"Agent" 从来不是周围的代码，Agent 永远是那个模型。**

### 伪 Agent 的问题

市面上充斥着"AI Agent 平台"——拖拽工作流、Prompt 链编排、节点图。这些东西本质上是 Rube Goldberg 机器：用 if-else 分支和硬编码路由逻辑把 LLM API 拼凑在一起，LLM 只是一个美化了的文本补全节点。

这不是 Agent，这是"带妄想的 Shell 脚本"。**你无法靠堆积过程逻辑来工程化出智能，智能是学出来的，不是编程编出来的。**

---

## 二、从"开发 Agent"到"开发 Harness"

既然智能已经在模型里，那工程师的工作是什么？

答案是：**构建 Harness（载具）**。

```
Harness = 工具 + 知识 + 观察接口 + 行动接口 + 权限边界

    工具：文件 I/O、Shell、网络、数据库、浏览器
    知识：产品文档、领域参考、API 规范、风格指南
    观察：git diff、错误日志、浏览器状态、传感器数据
    行动：CLI 命令、API 调用、UI 交互
    权限：沙箱、审批工作流、信任边界
```

**模型做决策，Harness 执行；模型推理，Harness 提供上下文。模型是驾驶员，Harness 是车。**

这个模式是通用的：
- Coding Agent = 模型 + IDE/终端/文件系统
- 农业 Agent = 模型 + 土壤/天气传感器 + 灌溉控制
- 酒店 Agent = 模型 + 预订系统 + 宾客沟通渠道

Harness 因领域而变，Agent（模型）跨领域泛化。

---

## 三、为什么以 Claude Code 为研究对象

Claude Code 是目前最优雅、最完整的 Agent Harness 实现，因为它**不尝试替代 Agent**：
- 不强加僵硬的工作流
- 不用复杂决策树代替模型推理
- 给模型工具、知识、上下文管理和权限边界，然后退后一步

Claude Code 的本质：

```
Claude Code = 一个 Agent Loop
            + 工具（bash、read、write、edit、glob、grep、browser...）
            + 按需技能加载
            + 上下文压缩
            + 子 Agent 派生
            + 带依赖图的任务系统
            + 带异步邮箱的团队协作
            + 并行执行的 Worktree 隔离
            + 权限治理
```

这就是全部架构。每一个组件都是 Harness 机制，而不是智能本身。

---

## 四、核心 Agent Loop

最小化的 Agent Loop 只需要这几行 Python：

```python
def agent_loop(messages):
    while True:
        response = client.messages.create(
            model=MODEL, system=SYSTEM,
            messages=messages, tools=TOOLS,
        )
        messages.append({"role": "assistant",
                         "content": response.content})

        if response.stop_reason != "tool_use":
            return   # 模型决定停止，返回文本

        results = []
        for block in response.content:
            if block.type == "tool_use":
                output = TOOL_HANDLERS[block.name](**block.input)
                results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": output,
                })
        messages.append({"role": "user", "content": results})
```

**模型决定何时调用工具、何时停止；代码只负责执行模型的请求。**

这个 Loop 本身不变，12 个 Session 都是在它之上叠加一层 Harness 机制。

---

## 五、12 个渐进式 Session

| Session | 主题 | 口诀 |
|---------|------|------|
| s01 | Agent Loop | *一个循环 + Bash 就够了* |
| s02 | 工具使用 | *添加工具只需添加一个 Handler* |
| s03 | TodoWrite 计划 | *没有计划的 Agent 会漂移* |
| s04 | 子 Agent | *拆分大任务；每个子任务有干净的上下文* |
| s05 | 技能加载 | *按需加载知识，而不是预先加载* |
| s06 | 上下文压缩 | *上下文会填满；你需要腾出空间* |
| s07 | 任务系统 | *把大目标拆成小任务，排序，持久化到磁盘* |
| s08 | 后台任务 | *后台运行慢操作；Agent 继续思考* |
| s09 | Agent 团队 | *任务太大时，委托给队友* |
| s10 | 团队协议 | *队友需要共享的沟通规则* |
| s11 | 自主 Agent | *队友自己扫描任务板并认领任务* |
| s12 | Worktree 隔离 | *每个人在自己的目录工作，互不干扰* |

学习路径分四个阶段：
- **Phase 1（THE LOOP）**：s01 → s02，掌握基础循环
- **Phase 2（PLANNING & KNOWLEDGE）**：s03 → s06，计划与知识管理
- **Phase 3（PERSISTENCE）**：s07 → s08，持久化与后台任务
- **Phase 4（TEAMS）**：s09 → s12，多 Agent 协作

---

## 六、几个核心 Harness 机制

### 1. 子 Agent（s04）
主 Agent 上下文会随时间膨胀。通过将子任务委托给拥有**独立 messages[] 的子 Agent**，可以保持主对话干净，防止上下文爆炸。

### 2. 技能按需加载（s05）
不要在 System Prompt 里一次性注入所有领域知识。通过 `tool_result` 按需注入，Agent 知道有哪些技能可用，需要时再拉取。

### 3. 上下文压缩（s06）
三层压缩策略：
- **Offload**：把大块内容写入文件系统，上下文只保留指针
- **Reduce**：对历史内容摘要压缩
- **Isolate**：通过子 Agent 切片，每次只携带最小上下文

### 4. 任务系统（s07）
基于文件的 CRUD 任务图，支持依赖关系。这是多 Agent 协作的基础：任务持久化到磁盘，多个 Agent 可以协调认领和完成任务。

### 5. 权限治理
沙箱文件访问、破坏性操作需要审批、在 Agent 和外部系统之间强制信任边界。

---

## 七、个人思考

这个仓库最有价值的地方不在于代码，而在于**思维方式的转变**：

工程师的职责是**构建模型能有效运转的环境**，而不是试图把智能编程进去。上下文越清晰、工具越原子、知识越精准，模型的智能表达就越充分。

对比自己之前写的 [Agent 架构笔记](./Agent.md)，这个仓库提供了一个非常系统的工程化视角：
- 用 `Harness = 工具 + 知识 + 观察 + 行动 + 权限` 这个公式统一了所有 Agent 场景
- 每个 Session 只增加一个机制，保持 Loop 不变，这种设计思路很值得借鉴
- Task 系统 + Worktree 隔离解决了长任务和并行执行的核心问题

> 相关项目：
> - [Kode Agent CLI](https://github.com/shareAI-lab/Kode-cli) — 开源 Coding Agent，支持 GLM/MiniMax/DeepSeek
> - [claw0](https://github.com/shareAI-lab/claw0) — 常驻 Agent Harness，支持心跳、Cron、IM 多渠道
