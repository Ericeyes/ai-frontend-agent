"""内置的 9 个方案方向。hint 描述的是结构与视觉上的具体决策，而不是形容词堆砌。"""

from app.schemas import VariantSpec

DEFAULT_VARIANTS: list[VariantSpec] = [
    VariantSpec(
        key="minimal",
        label="极简",
        hint=(
            "单文件实现，不做子组件拆分，事件与状态逻辑直接内联在组件内；"
            "视觉上大留白、1px 细边框、中性灰配色、无阴影，仅靠字号与间距建立层级。"
        ),
    ),
    VariantSpec(
        key="enterprise",
        label="企业级",
        hint=(
            "完整定义 Props、状态与领域类型，展示逻辑与容器逻辑（校验、提交、数据整形）在同一文件内分区但职责分离；"
            "稳健的蓝灰配色、清晰的标题层级、适中的信息密度，适合后台管理场景。"
        ),
    ),
    VariantSpec(
        key="expressive",
        label="表现力",
        hint=(
            "允许少量装饰性元素（渐变、徽标、装饰图形），交互反馈更明显（hover 抬升、按下缩放）；"
            "高饱和强调色、大圆角、过渡动画、非对称布局。"
        ),
    ),
    VariantSpec(
        key="data-dense",
        label="数据密集",
        hint=(
            "以表格或列表为主视图，信息按语义分组，表头与列对齐关系明确；"
            "紧凑间距、表头背景区分、斑马纹或分割线强化行阅读。"
        ),
    ),
    VariantSpec(
        key="mobile-first",
        label="移动优先",
        hint=(
            "堆叠布局优先，所有可点击控件触控目标不小于 44px，主操作按钮放在底部操作区；"
            "全宽卡片、大字号、单列滚动，先保证小屏体验再向上适配。"
        ),
    ),
    VariantSpec(
        key="a11y-strict",
        label="无障碍优先",
        hint=(
            "为交互元素显式写出 aria-* 关系（aria-describedby / aria-controls / aria-live）并显式管理焦点（打开时聚焦、关闭时归还）；"
            "状态用图标加文字而非仅颜色传达，配色自检正文对比度不低于 4.5:1。"
        ),
    ),
    VariantSpec(
        key="headless-ready",
        label="无头组件",
        hint=(
            "逻辑与渲染分离：暴露 render props（React）或作用域插槽（Vue）让调用方接管标记，组件内部只保留状态与行为；"
            "样式最小化，仅通过 CSS 变量 token 提供可覆盖的默认外观。"
        ),
    ),
    VariantSpec(
        key="animation-forward",
        label="动效优先",
        hint=(
            "为状态切换编排过渡：进入/退出、列表增删使用 transition 或 animation，统一时长与缓动曲线；"
            "所有动画都包在 prefers-reduced-motion: reduce 的降级分支中。"
        ),
    ),
    VariantSpec(
        key="legacy-safe",
        label="兼容优先",
        hint=(
            "避免可选链、空值合并、顶层 await 等较新语法，兼容性注释写明支持的运行时基线；"
            "保守 CSS，不使用 :has()、容器查询等新选择器，优先 flex 与传统选择器实现。"
        ),
    ),
]
