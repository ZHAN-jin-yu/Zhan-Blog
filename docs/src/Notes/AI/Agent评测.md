---
updateTime: '2026-07-19 15:00'
tags: AI
---
# 揭秘 AI Agent 评测（Demystifying Evals for AI Agents）

> 原文：[Demystifying evals for AI agents — Anthropic Engineering](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)（2026-01-09 发布）
>
> 作者：Mikaela Grace, Jeremy Hadfield, Rodrigo Olivares, Jiri De Jonghe

让 Agent 变得有用的那些能力——自主性、智能、灵活性——同时也让它变得难以评测。这篇文章是 Anthropic 结合自身内部实践（Claude Code、Claude for Chrome 等）和与前沿客户合作总结出的 Agent 评测方法论。

本文不是全文翻译，而是我的阅读笔记：**前半部分梳理原文框架，后半部分是我自己的思考和一个动手实践的最小 Eval 实现**。

## 一、为什么需要评测

没有评测的团队很容易陷入**被动循环**：问题只在生产环境暴露，修了一个 bug 又引入另一个，无法区分"真实退化"和"随机噪声"，只能"瞎猜 + 手测"。

评测的价值会随 Agent 生命周期**复利式增长**：

- **开发早期**：逼迫团队明确定义"成功是什么"。两个工程师读同一份需求文档，对边界情况的理解可能完全不同，eval 套件能消除这种歧义。
- **上线之后**：提供回归保障，每次改动可以在数百个场景上自动验证。
- **模型升级时**：有 eval 的团队几天就能完成新模型的适配与切换，没有 eval 的团队要数周。
- **免费获得的副产品**：基线、回归测试、延迟/token 消耗/单任务成本/错误率等指标的长期追踪。
- **跨团队沟通**：eval 是产品与研究团队之间"带宽最高"的沟通渠道，定义了研究者可以优化的指标。

::: tip 我的思考
评测的成本是 upfront 可见的，收益是滞后累积的——这和写单元测试的处境一模一样。历史上"TDD 值不值"的争论在 Agent 时代会以"要不要先写 eval"的形式重演一遍。区别在于：传统代码的行为是确定的，人肉测试勉强可行；而 Agent 是非确定性的，**没有 eval 你甚至无法描述它的行为**，更别说改进了。eval 对 Agent 不是可选项，是认知工具。
:::

## 二、评测的基本结构

一个 eval 就是给 AI 一个输入，然后对其输出应用打分逻辑。文章聚焦**自动化评测**（不依赖真实用户）。

核心术语：

| 术语 | 定义 |
| --- | --- |
| **Task（任务）** | 一个测试用例，有明确的输入和成功标准 |
| **Trial（试验）** | 对任务的一次尝试。模型输出有随机性，需多次 trial 得到稳定结果 |
| **Grader（评分器）** | 对 Agent 表现某方面打分的逻辑。一个任务可有多个 grader，每个含多条断言（assertions） |
| **Transcript（轨迹）** | 一次 trial 的完整记录：输出、工具调用、推理过程、中间结果 |
| **Outcome（结果）** | trial 结束时环境的最终状态。订票 Agent 嘴上说"已预订"不算数，SQL 数据库里存在预订记录才算 |
| **Evaluation Harness（评测框架）** | 端到端运行 eval 的基础设施：提供指令与工具、并发跑任务、记录步骤、打分、聚合结果 |
| **Agent Harness / Scaffold（Agent 载具）** | 让模型能以 Agent 方式行动的系统：处理输入、编排工具调用、返回结果。**评测"一个 Agent"时，实际评测的是 harness + 模型的组合体** |
| **Evaluation Suite（评测套件）** | 为测量特定能力而设计的任务集合，如客服套件覆盖退款、取消、升级等场景 |

单轮 eval 很简单：prompt → response → 打分。而 Agent eval 复杂得多：Agent 跨多轮使用工具、修改环境状态、根据中间结果自适应调整——**错误会传播和复利**。更麻烦的是，前沿模型可能找到超出静态 eval 预期的创造性方案：Opus 4.5 在 τ2-bench 的订机票任务中发现了政策漏洞，按评测标准"失败"了，但实际上给了用户更好的解决方案。

## 三、三类评分器（Grader）

Agent 评测通常组合使用三种 grader，分别针对 transcript 或 outcome 的不同部分。

### 1. 基于代码的 Grader

- **方法**：字符串匹配（精确/正则/模糊）、二元测试（fail-to-pass / pass-to-pass）、静态分析（lint、类型、安全）、结果验证、工具调用验证、transcript 分析（轮数、token 用量）
- **优点**：快、便宜、客观、可复现、易调试
- **缺点**：对"合法但不匹配预期模式"的输出很脆弱；缺乏细腻度；不适合主观任务

### 2. 基于模型的 Grader

- **方法**：Rubric 打分、自然语言断言、成对比较、参考答案对比、多评委共识
- **优点**：灵活、可扩展、能捕捉细腻差异、处理开放式任务
- **缺点**：非确定性、比代码贵、**需要与人类评分校准才能保证准确**

### 3. 人工 Grader

- **方法**：领域专家评审、众包判断、抽样检查、A/B 测试、标注者间一致性（inter-annotator agreement）
- **优点**：黄金标准质量；用于校准模型 grader
- **缺点**：贵、慢、需要规模化获取专家

打分聚合方式：加权（总分过阈值）、二元（全部 grader 通过才算过）、或混合。

::: tip 我的思考
三类 grader 的选择本质上是**成本-信噪比-规模的权衡**。我的经验法则是：能用代码验证的绝不用 LLM，能用 LLM 的绝不请人。但要注意一个陷阱：代码 grader 的"客观"有时是假的——正则匹配期望答案时，你隐含假设了解空间是已知的，而 Agent 的解空间往往超出你的想象（τ2-bench 的政策漏洞就是例子）。所以**代码 grader 评"底线"（不能违反什么），LLM grader 评"上限"（做得有多好）**，这个分工比较稳健。
:::

## 四、能力评测 vs 回归评测

- **Capability Eval（能力/质量评测）**：回答"这个 Agent 能做好什么？"。通过率应该**从低开始**，瞄准 Agent 吃力的任务，给团队一座要爬的山。
- **Regression Eval（回归评测）**：回答"Agent 以前会做的现在还会吗？"。通过率应接近 **100%**，分数下降即报警。

两者要同时跑。当能力评测的通过率被"爬山"爬到很高时，它可以**毕业**成为回归套件——曾经测量"我们能不能做到"的任务，转而测量"我们还能不能稳定做到"。

## 五、按 Agent 类型的评测方法

### Coding Agent

代码天然适合确定性 grader：代码能跑吗？测试过了吗？

- **SWE-bench Verified**：给 Agent 真实 GitHub issue，跑测试套件打分——修复失败测试且不破坏已有测试才算过。一年内 LLM 从 40% 涨到 80%+。
- **Terminal-Bench**：端到端技术任务，如从源码编译 Linux 内核、训练 ML 模型。
- 在通过/失败的测试之外，还可以加代码质量启发式规则和带 rubric 的模型 grader 来评估工具调用方式。

一个理论上的评测配置示例：

```yaml
task:
  id: "fix-auth-bypass_1"
  desc: "Fix authentication bypass when password field is empty and ..."
  graders:
    - type: deterministic_tests
      required: [test_empty_pw_rejected.py, test_null_pw_rejected.py]
    - type: llm_rubric
      rubric: prompts/code_quality.md
    - type: static_analysis
      commands: [ruff, mypy, bandit]
    - type: state_check
      expect:
        security_logs: {event_type: "auth_blocked"}
    - type: tool_calls
      required:
        - {tool: read_file, params: {path: "src/auth/*"}}
        - {tool: edit_file}
        - {tool: run_tests}
  tracked_metrics:
    - type: transcript
      metrics: [n_turns, n_toolcalls, n_total_tokens]
    - type: latency
      metrics: [time_to_first_token, output_tokens_per_sec, time_to_last_token]
```

实际中不需要这么多 grader，通常单测验证正确性 + LLM rubric 评估代码质量即可，其余按需添加。

### 对话式 Agent

客服、销售、教练类 Agent 的独特挑战：**交互质量本身也是被评测的一部分**。

- 成功是多维的：工单解决了吗（state check）？10 轮内完成了吗（transcript 约束）？语气恰当吗（LLM rubric）？
- 通常需要**第二个 LLM 扮演用户**。τ-Bench 和 τ2-Bench 就是这种方式：一个模型演用户人设，Agent 在零售、航空订票等场景中导航。Anthropic 内部的对齐审计 Agent 也用此方法做对抗性长对话压力测试。

```yaml
graders:
  - type: llm_rubric
    rubric: prompts/support_quality.md
    assertions:
      - "Agent showed empathy for customer's frustration"
      - "Resolution was clearly explained"
      - "Agent's response grounded in fetch_policy tool results"
  - type: state_check
    expect:
      tickets: {status: resolved}
      refunds: {status: processed}
  - type: tool_calls
    required:
      - {tool: verify_identity}
      - {tool: process_refund, params: {amount: "<=100"}}
      - {tool: send_confirmation}
  - type: transcript
    max_turns: 10
```

### 研究型 Agent

输出是答案或报告，"全面""有来源""正确"的标准取决于上下文，没有单测式的二元信号。

挑战：专家对"综述是否全面"会有分歧；ground truth 随参考内容变化而漂移；输出越长越开放，出错空间越大。

策略是**组合 grader**：
- **Groundedness 检查**：论断是否有检索来源支撑
- **Coverage 检查**：好答案必须包含的关键事实清单
- **来源质量检查**：引用的来源是否权威，而非只是第一个检索到的
- 有客观答案的任务（"X 公司 Q3 营收是多少？"）可以直接精确匹配

LLM rubric 需要频繁地与专家人工判断校准。BrowseComp 是一个典型基准：问题被设计得"容易验证、难以解决"。

### Computer Use Agent

通过截图、鼠标、键盘与 GUI 交互。评测需要在真实/沙箱环境中运行 Agent，然后检查最终结果：

- **WebArena**：浏览器任务，用 URL 和页面状态检查 + 后端状态验证（确认订单真的下了，而不只是出现了确认页面）。
- **OSWorld**：完整操作系统控制，评测脚本检查文件系统状态、应用配置、数据库内容、UI 元素属性。

Browser Agent 有个实际权衡：**DOM 交互快但费 token，截图交互慢但省 token**。Anthropic 在 Claude for Chrome 中专门做了 eval 来检查 Agent 是否为当前上下文选对了工具。

## 六、非确定性与 pass@k / pass^k

Agent 行为在多次运行间有波动，每个任务有自己的成功率。两个互补指标：

- **pass@k**：k 次尝试中至少成功一次的概率。k 增大，分数上升（"射门次数"多了）。写代码时通常关心 pass@1（一次做对）；有些场景只要一次成功即可。
- **pass^k**：k 次尝试全部成功的概率。k 增大，分数下降。单次成功率 75%，跑 3 次全过的概率是 \(0.75^3 \approx 42\%\)。**面向用户的 Agent 更看重这个**——用户期望每次都可靠。

两个指标在 k=1 时相同，k 越大越分化（k=10 时 pass@k 趋近 100%，pass^k 趋近 0）。选哪个取决于产品需求。

::: tip 我的思考：可靠性的乘法诅咒
pass^k 背后藏着一个更深刻的数学事实：**长链路 Agent 的可靠性是乘法衰减的**。假设一个 Agent 工作流有 10 个串行步骤，每步成功率 95%（已经很高了），整体成功率只有 \(0.95^{10} \approx 60\%\)。这解释了为什么 demo 里惊艳的 Agent 放到真实长任务上就翻车，也解释了我在 [Agent 架构笔记](./Agent.md)里记录的 MainAgent 长任务"降智、偷懒、直接退出"问题——除了上下文爆炸，还有成功率沿链路的复利式衰减。pass^k 本质上是把这种乘法衰减变成可测量的指标。反过来，它也指明了工程方向：**与其把单步成功率从 95% 优化到 97%，不如把链路砍短一半**。
:::

## 七、从零到一的实践路线图（重点）

### Step 0：尽早开始

不需要等几百个任务。**20-50 个来自真实失败的简单任务就是很好的起点**。早期系统每次改动效果明显（effect size 大），小样本就足够检测。拖得越久，eval 越难建——早期产品需求自然就是测试用例，拖久了就得从线上系统逆向工程"成功标准"。

### Step 1：从你手动测的东西开始

把每次发版前手动验证的行为、用户常试的任务、bug 追踪器和支持队列里的失败案例转化为测试用例。按用户影响排优先级。

### Step 2：写无歧义的任务，配参考解

好任务的标准：**两个领域专家独立判断会得出相同的通过/失败结论**，且专家自己能做对这个任务。任务规格中的歧义会变成指标中的噪声。

- grader 检查的一切都应该在任务描述中写清楚。Terminal-Bench 的审计发现过：任务要求写脚本但没说文件路径，测试却假设了特定路径，Agent 因此"背锅"失败。
- **前沿模型在多次 trial 下 0% 通过率（pass@100 = 0），通常说明任务坏了，而不是模型不行**。
- 每个任务配一个能通过所有 grader 的参考解，既证明任务可解，也验证 grader 配置正确。

### Step 3：构建平衡的问题集

**单面 eval 导致单面优化**。只测"该搜索时是否搜索"，就会得到一个对什么都搜索的 Agent。Anthropic 在给 Claude.ai 做网页搜索 eval 时就踩过这个坑：需要同时覆盖"该搜的查询"（查天气）和"不该搜的查询"（"谁创立了苹果？"），在欠触发和过触发之间找平衡，反复打磨 prompt 和 eval。

### Step 4：构建健壮的 eval harness 和稳定环境

- eval 中的 Agent 应与生产中的 Agent 基本一致。
- 每次 trial 从干净环境开始，做到**隔离**。残留文件、缓存、资源耗尽会导致"基础设施抖动"被误记为"Agent 失败"。
- 共享状态还可能**虚增**成绩：内部 eval 中曾发现 Claude 通过查看前几次 trial 留下的 git 历史获得不公平优势。
- 多个 trial 因同一环境限制（如 CPU 内存）失败，这些 trial 就不是独立的，结果失去统计意义。

### Step 5：用心设计 grader

- 优先确定性 grader，必要时用 LLM grader，谨慎用人工 grader 做额外验证。
- **不要检查"Agent 是否按特定步骤执行"（如固定的工具调用顺序）**——Agent 经常找到设计者没想到的合法路径。评"它产出了什么"，而不是"它走了哪条路"，避免惩罚创造力。
- 多组成部分的任务要**给部分分数**：正确识别问题、验证了客户身份但退款失败的客服 Agent，明显好于第一步就失败的。结果应体现这种连续的成功谱系。
- LLM-as-judge 需要与人类专家密切校准；给模型"退路"（信息不足时返回 "Unknown"）以避免幻觉；用清晰结构化的 rubric，**每个维度用独立的 judge** 分别评，而非一个 judge 评所有维度。

评分体系中的隐性 bug 很致命：
- Opus 4.5 在 CORE-Bench 上最初只得 42%，后来研究者发现多处问题：评分死板（期望 "96.124991…" 时把 "96.12" 判错）、任务规格含糊、随机任务无法精确复现。修复后飙到 95%。
- METR 的时间跨度基准中有些任务要求 Agent 优化到"声明的阈值"，但评分要求**超过**该阈值——照着指令做的 Claude 被罚，无视指令的模型反而得分更高。

另外，要让 grader **抗作弊**：通过评测必须真正解决问题，而非钻空子。

### Step 6：读 Transcript！

不读 transcript 就不知道 grader 工作得好不好。任务失败时，transcript 会告诉你是 Agent 真犯了错，还是 grader 拒绝了合法解。**失败应该"看起来公平"**：能清楚看出 Agent 错在哪、为什么错。当分数不涨时，需要确信是 Agent 的问题而不是 eval 的问题。读 transcript 是 Agent 开发的关键技能。

### Step 7：警惕能力评测饱和

通过率 100% 的 eval 只能追回归，提供不了改进信号。SWE-Bench Verified 一年内从 30% 冲到 80%+，接近饱和。接近饱和时进展会显得放缓——只剩最难的任务，**大的能力提升在分数上只体现为小涨幅**。代码评审公司 Qodo 最初对 Opus 4.5 不感冒，因为他们的一次性编码 eval 捕捉不到长时复杂任务上的进步，后来专门开发了新的 agentic eval 框架才看清。

原则：**在有人深入细节、读过 transcript 之前，不要对 eval 分数照单全收。**

### Step 8：长期维护，开放贡献

eval 套件是活的工件，需要持续投入和明确归属。Anthropic 验证有效的模式：

- 专门的 evals 团队拥有核心基础设施
- 领域专家和产品团队贡献大部分 eval 任务，并自己运行评测
- 让评测的拥有和迭代像维护单元测试一样成为日常
- **Eval 驱动开发**：在 Agent 还做不到时就先建 eval 定义目标能力，然后迭代到达标。内部常做"赌几个月后模型能力"的功能，低通过率起步的 capability eval 让这些赌注可视化，新模型发布时跑一遍就知道哪些赌赢了
- 离产品需求和用户最近的人最适合定义成功——产品经理、客服、销售都可以用 Claude Code 以 PR 形式贡献 eval 任务，让他们做！

## 八、动手实践：一个最小的 Eval 实现

原文的框架讲完了，但纸上得来终觉浅。我用 Python 写一个不到 80 行的最小 eval，把 **task → trial → grader → transcript → 聚合指标** 的完整闭环跑一遍。场景选一个最简单的 coding 任务：让 Agent 修复一个有 bug 的函数。

```python
import json
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

# ---------- 1. Task：定义输入与成功标准 ----------
@dataclass
class Task:
    id: str
    prompt: str                 # 给 Agent 的任务描述
    test_code: str              # 确定性 grader 用的测试

# ---------- 2. 一次 trial 的完整轨迹 ----------
@dataclass
class Transcript:
    task_id: str
    trial: int
    agent_output: str = ""      # Agent 生成的代码
    n_turns: int = 0
    passed: bool = False
    grader_detail: str = ""

# ---------- 3. Agent：实际中替换为你的 Agent 调用 ----------
def run_agent(prompt: str, workdir: Path) -> tuple[str, int]:
    """
    真实场景里这里是完整的 agent loop（模型 + 工具调用）。
    为了演示，这里直接模拟一次调用。
    """
    # response = client.messages.create(...)  # 伪代码
    agent_code = "def add(a, b):\n    return a + b\n"  # 假设 Agent 的产出
    (workdir / "solution.py").write_text(agent_code)
    return agent_code, 1

# ---------- 4. Code Grader：跑测试验证 outcome ----------
def grade(task: Task, workdir: Path) -> tuple[bool, str]:
    test_file = workdir / "test_solution.py"
    test_file.write_text(task.test_code)
    result = subprocess.run(
        ["python", "-m", "pytest", str(test_file), "-q"],
        capture_output=True, text=True, cwd=workdir,
    )
    return result.returncode == 0, result.stdout[-300:]

# ---------- 5. Eval Harness：跑 k 次 trial 并聚合 ----------
def run_eval(task: Task, k: int = 4) -> list[Transcript]:
    transcripts = []
    for i in range(k):
        with tempfile.TemporaryDirectory() as tmp:  # 关键：每次 trial 隔离环境
            workdir = Path(tmp)
            t = Transcript(task_id=task.id, trial=i)
            t.agent_output, t.n_turns = run_agent(task.prompt, workdir)
            t.passed, t.grader_detail = grade(task, workdir)
            transcripts.append(t)
    return transcripts

# ---------- 组装 ----------
if __name__ == "__main__":
    task = Task(
        id="fix-add-func",
        prompt="solution.py 中的 add 函数实现有误，请修复它",
        test_code="""
from solution import add
def test_add(): assert add(1, 2) == 3
def test_add_negative(): assert add(-1, -1) == -2
""",
    )
    results = run_eval(task, k=4)

    passes = sum(t.passed for t in results)
    print(f"pass@1 = {passes / len(results):.0%}")       # 单次成功率
    print(f"pass@k = {int(passes > 0)}")                  # k 次内至少成功一次
    print(f"pass^k = {int(passes == len(results))}")      # k 次全部成功
    # 保存全部 transcript 供人工审查
    Path("transcripts.json").write_text(
        json.dumps([t.__dict__ for t in results], indent=2, ensure_ascii=False)
    )
```

这个玩具实现虽然简陋，但已经包含了原文强调的几个关键设计：

1. **环境隔离**：每次 trial 用独立的临时目录（对应 Step 4），避免共享状态污染
2. **Outcome 验证**：grader 检查的是"测试是否通过"这个最终状态，而不是 Agent 的输出长什么样（对应 Step 5"评产出而非路径"）
3. **多 trial 聚合**：一次通过不算数，跑 k 次看分布（对应第六节的非确定性）
4. **Transcript 落盘**：所有轨迹保存成 JSON，供人工审查（对应 Step 6）

把它变成真实 eval 只需要替换 `run_agent`：接入你的 Agent SDK，让它在临时目录里真实地读写文件、跑命令。grader 部分可以按需叠加 LLM rubric。

## 九、我总结的评测反模式

结合原文案例和我自己踩过的坑，整理一份" eval 设计反模式清单"，写完 eval 后对着自查一遍：

| 反模式 | 症状 | 解药 |
| --- | --- | --- |
| **路径检查** | Agent 用了意料之外的合法方案，被判失败 | 评 outcome，不评 tool call 序列 |
| **全或无评分** | 完成 80% 的 Agent 和 0% 的得一样分 | 多 grader 拆分维度，给部分分数 |
| **单面测试集** | 优化后 Agent 行为极端化（见啥都搜索） | 正反案例配对，测"该做"也测"不该做" |
| **环境污染** | 分数忽高忽低，或莫名虚高（偷看 git 历史） | 每 trial 干净环境起步，检查隔离性 |
| **无参考解** | pass@100 = 0%，分不清是任务坏了还是模型不行 | 每个任务先自己解一遍，验证 grader |
| **分数迷信** | 拿 42% 就断定模型不行（CORE-Bench 教训） | 深挖细节、读 transcript 之前不采信分数 |
| **eval 一劳永逸** | 模型和产品演进后，eval 测的已是过期行为 | 明确 owner，像维护单测一样持续迭代 |
| **rubric 一把抓** | 一个 judge 评所有维度，结果不稳定 | 每个维度独立 judge，定期人工校准 |

## 十、评测与其他手段的配合（瑞士奶酪模型）

自动化 eval 只是理解 Agent 的手段之一，完整图景需要多种方法组合：

| 方法 | 优点 | 缺点 |
| --- | --- | --- |
| **自动化 eval** | 迭代快、完全可复现、不影响用户、可每次 commit 运行、规模化测试 | 前期投入大；需持续维护防漂移；与真实使用不匹配时产生虚假信心 |
| **生产监控** | 真实用户行为、捕捉合成 eval 遗漏的问题、ground truth | 被动（问题先到用户才知道）；信号嘈杂；缺少打分基准 |
| **A/B 测试** | 衡量真实用户结果（留存、任务完成率）、控制混杂因素 | 慢（数天到数周才显著）、只测已部署的改动、对"为什么"信号少 |
| **用户反馈** | 暴露意料之外的问题、带真实案例 | 稀疏且自我选择、偏向严重问题、用户很少解释原因、不自动化 |
| **人工读 transcript** | 建立失败模式直觉、捕捉自动化检查遗漏的细腻质量问题 | 耗时、不可扩展、覆盖不一致、只有定性信号 |
| **系统性人工研究** | 黄金标准质量、处理主观任务、为模型 grader 提供校准信号 | 贵且慢、难以频繁运行、评分者分歧需调和、复杂领域需专家 |

各方法对应不同阶段：上线前和 CI/CD 阶段以自动化 eval 为第一道防线；上线后生产监控检测分布漂移；流量足够后用 A/B 测试验证重大改动；用户反馈和 transcript 抽查作为持续的补漏手段；人工研究留给 LLM grader 校准和主观输出评估。

像安全工程中的**瑞士奶酪模型**：没有单层能拦住所有问题，多层叠加后，从一层漏掉的失败会被另一层接住。

## 十一、Eval 框架生态

附录提到的工具：

- **Harbor**：容器化环境跑 Agent，任务与 grader 有标准化格式，Terminal-Bench 2.0 等基准通过其 registry 分发
- **Braintrust**：离线评测 + 生产可观测性 + 实验追踪，自带 `autoevals` 评分库
- **LangSmith**：tracing + 离线/在线评测 + 数据集管理，与 LangChain 生态深度集成
- **Langfuse**：上述能力的自托管开源替代，适合有数据驻留要求的团队
- **Arize Phoenix / AX**：开源 LLM tracing 与评测平台 + SaaS 扩展

框架只是加速器，**框架的好坏取决于你跑什么样的 eval 任务**。快速选一个顺手的工作流，然后把精力投入到测试用例和 grader 的迭代质量上。

## 十二、我的几点深度思考

### 1. Eval 也会"坏"：先怀疑仪器，再怀疑实验对象

CORE-Bench 的案例（42% → 95%）给了我很大震撼。物理实验里有个常识：当实验结果违背理论预期时，物理学家的第一反应是检查仪器，而不是推翻理论。Agent 评测也应该建立同样的本能——**分数异常时，先审计测量系统，再下结论**。

这意味着 eval 本身需要被"测试"：参考解验证（Step 2）、人工抽查 transcript（Step 6）、grader 与人类判断的校准，本质上都是"测量系统的质量管理"。一个没有被审计过的 eval，它的分数和随机数没有太大区别。

### 2. "评产出 vs 评路径"是旧争论的新战场

熟悉单元测试的人会发现，这场争论早就打过一遍了：Classicist TDD（状态验证）vs Mockist TDD（交互验证）。过度使用 mock 验证"是否调用了某方法、参数是什么、顺序对不对"，会导致测试与实现强耦合，重构即破防——这就是 Martin Fowler 在 *Mocks Aren't Stubs* 里讨论的老问题。

Agent eval 把这个问题放大了一个数量级：**人类程序员的解空间是有限的几条路径，而 Agent 的解空间近乎连续**。你预设的"正确路径"（工具调用序列）在 Agent 看来只是无数合法路径中的一条。所以原文"grade what it produced, not the path it took"这条原则，在 Agent 语境下不是最佳实践，是生存必需。工具调用验证（`tool_calls` grader）只应用于**有硬性合规要求的环节**（比如退款前必须验证身份），而不是用来描述期望的工作流程。

### 3. Eval 是需求文档的可执行形态

原文 Step 0-2 串起来看，其实是在说一件事：**写 eval 的过程就是把模糊的产品直觉编译成可执行规格的过程**。"两个工程师读同一份 spec 会有不同理解"这个问题，传统软件靠评审和原型解决，而 eval 直接把歧义变成了噪声可见的指标——任务写不清楚，pass 率就没法看。

这和我在 [Skills 系统设计](./后端开发中的Skills系统设计.md)里的实践是同构的：用大模型能理解的方式（规则、文档、示例）把"我们期望的行为"显式化。区别在于 Skills 是**事前的约束**，eval 是**事后的验证**，两者配合才完整。Eval 驱动开发 = Skills 约束 + TDD 在 Agent 时代的合体。

### 4. 分层评测：给 MainAgent/SubAgent 架构的启发

我之前在 [Agent 架构笔记](./Agent.md)里记录的 MainAgent + SubAgent 架构，恰好可以套用测试金字塔的思路做分层评测：

- **SubAgent 层 = 单元测试**：每个 SubAgent 职责单一（读文件、改代码、跑命令），输入输出明确，适合确定性 grader，pass 率应接近 100%
- **MainAgent 编排层 = 集成测试**：测任务分解是否合理、SubAgent 结果是否正确聚合，可以用 transcript 约束（轮数上限、不许重复调用）+ LLM rubric
- **端到端 = E2E 测试**：用户视角的最终 outcome，用状态检查 + LLM rubric

这样的好处是**故障定位快**：端到端失败时，先看哪一层的分数掉了，而不是直接在几百轮的总 transcript 里捞针。Harness 负责流程编排的架构（Harness + Agent 模式）天然适合这种分层——因为编排逻辑是代码，代码可以单测；只有真正需要智能决策的部分才交给模型、用模型 grader 评。

### 5. 读 Transcript 为什么无法外包给 AI

一个自然的想法是：既然读 transcript 这么累，能不能让 LLM 来读？部分可以（比如用 LLM 做失败聚类、异常检测），但**核心环节不行**，原因是 bootstrapping 问题：

设计好 eval 依赖对 Agent 行为的直觉 → 直觉只能从大量真实 transcript 中来 → 如果让 AI 替读，你拿到的只是经过它"压缩"的结论，而压缩的有损部分恰恰是你还没形成直觉、不知道重要的那部分。

这和资深工程师 Code Review 一个道理：静态扫描能抓格式问题，但"这个设计以后会出事"的判断只能来自人读过的无数烂代码。读 transcript 是 Agent 开发者的"代码阅读量"，省不掉。

## 十三、总结

全文要点浓缩：

1. 尽早开始，别等完美套件——20-50 个真实失败任务即可起步
2. 任务要无歧义、有参考解、正反案例平衡
3. 组合多种 grader：能确定性的就确定性，必须主观判断的用 LLM + 人工校准
4. 评产出而非路径，给部分分数，抗作弊
5. **读 transcript！** 分数在有人深挖之前不可轻信
6. 关注饱和，能力 eval 和回归 eval 分开管理
7. eval 是核心组件而非事后补票，用 eval 驱动开发

最后记住两个心智模型：**瑞士奶酪模型**（没有单一手段能拦住所有问题，多层防御）和**乘法诅咒**（长链路可靠性 = 各步成功率的乘积，优化链路长度比优化单点更划算）。
