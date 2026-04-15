# React-P1 工程化配置完整指南（ESLint 10 + Flat Config）

---

## 第一部分：顶层鸟瞰

### 背景问题
这个项目在搭建一个使用 **pnpm monorepo** 的 React 项目，并配置了基于 **ESLint 10 新版 Flat Config** 格式的代码规范工具链。

### 关键区别：为什么你的配置和旧文档不一样？

| 对比项 | 旧文档（ESLint 8） | 你的项目（ESLint 10） |
|--------|------------------|---------------------|
| **配置文件格式** | `.eslintrc.json`（JSON 格式） | `eslint.config.mts`（TypeScript/ES Module） |
| **配置方式** | 对象配置（extends, plugins） | 数组配置（Flat Config） |
| **是否支持旧格式** | 支持 | **不支持**（ESLint 10 完全移除） |
| **依赖运行时** | 不需要 | 需要 `jiti`（运行 .mts 文件） |
| **配置复杂度** | 简单直观 | 更灵活但学习曲线高 |

**重要：** ESLint 9.0+ 引入 Flat Config，ESLint 10 完全移除了旧格式支持。你的项目用的是 **ESLint 10.2.0**，所以必须使用 Flat Config。

### 宏观图

```
React-P1/
├── packages/               # Monorepo 子包目录（目前为空）
├── .prettierrc.json       # Prettier 配置
├── eslint.config.mts      # ESLint 10 Flat Config（TypeScript 格式）
├── package.json           # 根 package.json
├── pnpm-lock.yaml         # pnpm 依赖锁定文件
└── pnpm-workspace.yaml    # pnpm workspace 配置
```

**工具链作用：**

| 工具 | 解决什么问题 | 版本 |
|------|-------------|------|
| **pnpm workspace** | Monorepo 包管理 | 10.33.0 |
| **ESLint** | 代码质量检查 | 10.2.0（新版 Flat Config） |
| **Prettier** | 代码格式统一 | 3.8.3 |
| **TypeScript ESLint** | TypeScript 代码检查 | 8.58.2 |
| **jiti** | 运行 .mts 配置文件 | 2.6.1 |

---

## 第二部分：实战步骤

### 步骤 1：初始化 pnpm workspace

**做了什么：** 配置 pnpm workspace，启用 monorepo 模式。

**完整代码：**

创建文件 `pnpm-workspace.yaml`：

```yaml
packages:
  - 'packages/*'
```

**注意点：**
- 这是 YAML 格式，注意冒号后有空格
- `'packages/*'` 表示 packages 下所有子目录都是独立的包

---

### 步骤 2：初始化 ESLint（ESLint 10 版本）

**做了什么：** 安装 ESLint 10 并初始化 Flat Config 格式配置。

**完整代码：**

```bash
# 安装 ESLint
pnpm add -D eslint

# 初始化 ESLint（会生成 eslint.config.mjs 或 eslint.config.mts）
npx eslint --init
```

**初始化过程的选项：**

| 问题 | 选择 |
|------|------|
| How would you like to use ESLint? | To check syntax and find problems |
| What type of modules does your project use? | JavaScript modules (import/export) |
| Which framework does your project use? | None |
| Does your project use TypeScript? | **Yes** |
| Where does your code run? | Browser |
| Config file format? | **JavaScript** |
| Install dependencies? | Yes |
| Which package manager? | **pnpm** |

**注意点：**
- ESLint 10 只支持 Flat Config 格式
- 初始化会生成 `eslint.config.mjs` 或 `eslint.config.mts`（TypeScript 格式）
- 你的项目生成的是 `.mts` 格式，需要 `jiti` 运行时支持

---

### 步骤 3：理解初始生成的配置文件

**做了什么：** 查看 ESLint 初始化后生成的 `eslint.config.mts` 内容。

**初始生成的代码：**

```typescript
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { 
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"], 
    plugins: { js }, 
    extends: ["js/recommended"], 
    languageOptions: { 
      globals: globals.browser 
    } 
  },
  tseslint.configs.recommended,
]);
```

**关键概念：Flat Config 是数组格式**

| 旧格式 `.eslintrc.json` | 新格式 Flat Config |
|------------------------|-------------------|
| 单个对象配置 | **数组**，每个元素是一个配置对象 |
| `extends: ["eslint:recommended"]` | `js.configs.recommended` |
| `plugins: ["@typescript-eslint"]` | `tseslint.configs.recommended` |
| `env: { browser: true }` | `languageOptions: { globals: globals.browser }` |

---

### 步骤 4：安装 Prettier 及集成插件

**做了什么：** 安装 Prettier 和与 ESLint 的集成插件。

**完整代码：**

```bash
# 安装 Prettier
pnpm add -D prettier

# 安装 ESLint 和 Prettier 集成插件
pnpm add -D eslint-config-prettier eslint-plugin-prettier
```

**安装结果（package.json）：**

```json
{
  "devDependencies": {
    "prettier": "^3.8.3",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-prettier": "^5.5.5"
  }
}
```

**插件说明：**

| 包名 | 作用 |
|------|------|
| `prettier` | 代码格式化工具核心 |
| `eslint-config-prettier` | 关闭 ESLint 中与 Prettier 冲突的格式化规则 |
| `eslint-plugin-prettier` | 将 Prettier 作为 ESLint 规则运行，格式问题会显示为 ESLint 错误 |

---

### 步骤 5：创建 Prettier 配置文件

**做了什么：** 创建 `.prettierrc.json` 配置 Prettier 格式化规则。

**完整代码 `.prettierrc.json`：**

```json
{
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "singleQuote": true,
  "semi": true,
  "trailingComma": "none",
  "bracketSpacing": true
}
```

**配置说明：**

| 配置项 | 作用 | 值 |
|--------|------|-----|
| `printWidth` | 单行最大字符数 | 80 |
| `tabWidth` | 缩进空格数 | 2 |
| `useTabs` | 使用 tab 还是空格 | false（用空格） |
| `singleQuote` | 使用单引号 | true |
| `semi` | 语句末尾加分号 | true |
| `trailingComma` | 尾随逗号 | none（不加） |
| `bracketSpacing` | 对象花括号内加空格 | true（`{ a: 1 }` 而不是 `{a: 1}`） |

---

### 步骤 6：升级 ESLint 配置（集成 Prettier）

**做了什么：** 将 Prettier 集成到 ESLint 配置中，并添加自定义规则。

**完整代码 `eslint.config.mts`（最终版本）：**

```typescript
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
// @ts-ignore
import prettier from "eslint-plugin-prettier/recommended";

export default [
  // 基础推荐配置
  js.configs.recommended,
  
  // TypeScript 推荐配置
  ...tseslint.configs.recommended,
  
  // Prettier 配置（自动包含 eslint-config-prettier）
  prettier,
  
  // 自定义配置
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    
    rules: {
      "prettier/prettier": "error",
      "no-case-declarations": "off",
      "no-constant-condition": "off",
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
];
```

---

### 步骤 7：详解配置文件每一部分

#### 7.1 导入依赖

```typescript
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
// @ts-ignore
import prettier from "eslint-plugin-prettier/recommended";
```

| 导入 | 作用 |
|------|------|
| `@eslint/js` | ESLint 推荐配置 |
| `globals` | 预定义的全局变量（browser、node 等） |
| `typescript-eslint` | TypeScript ESLint 插件和配置 |
| `eslint-plugin-prettier/recommended` | Prettier 推荐配置（包含插件和冲突规则关闭） |

#### 7.2 配置数组结构

```typescript
export default [
  // 配置1：ESLint 基础推荐
  js.configs.recommended,
  
  // 配置2：TypeScript 推荐
  ...tseslint.configs.recommended,
  
  // 配置3：Prettier 集成
  prettier,
  
  // 配置4：自定义配置
  { ... }
];
```

**Flat Config 的核心概念：**
- 配置是一个**数组**，后面的配置会覆盖前面的
- 每个配置项可以是对象、也可以是配置数组（用 `...` 展开）
- 越靠后的规则优先级越高

#### 7.3 自定义配置对象详解

```typescript
{
  // 指定哪些文件应用这个配置
  files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
  
  // 语言选项
  languageOptions: {
    ecmaVersion: "latest",           // 使用最新 ES 语法
    sourceType: "module",            // 使用 ES 模块
    parser: tseslint.parser,         // 使用 TypeScript 解析器
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    // 全局变量（合并 browser、node、es2021）
    globals: {
      ...globals.browser,  // window, document 等
      ...globals.node,     // process, __dirname 等
      ...globals.es2021,   // Promise, Map 等
    },
  },
  
  // 自定义规则
  rules: {
    "prettier/prettier": "error",                    // Prettier 格式问题显示为错误
    "no-case-declarations": "off",                   // 允许 case 中声明变量
    "no-constant-condition": "off",                  // 允许常量条件（如 while(true)）
    "@typescript-eslint/ban-ts-comment": "off",      // 允许 @ts-ignore 等注释
  },
}
```

---

### 步骤 8：新旧格式对照表

**你的配置等价于这个旧格式：**

<table>
<tr>
<th>旧格式 .eslintrc.json</th>
<th>新格式 eslint.config.mts（你的项目）</th>
</tr>
<tr>
<td>

```json
{
  "env": {
    "browser": true,
    "node": true,
    "es2021": true
  }
}
```

</td>
<td>

```typescript
languageOptions: {
  globals: {
    ...globals.browser,
    ...globals.node,
    ...globals.es2021,
  }
}
```

</td>
</tr>
<tr>
<td>

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ]
}
```

</td>
<td>

```typescript
export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
]
```

</td>
</tr>
<tr>
<td>

```json
{
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  }
}
```

</td>
<td>

```typescript
languageOptions: {
  parser: tseslint.parser,
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  }
}
```

</td>
</tr>
<tr>
<td>

```json
{
  "plugins": [
    "@typescript-eslint",
    "prettier"
  ]
}
```

</td>
<td>

```typescript
// 自动包含在配置中：
...tseslint.configs.recommended
prettier
```

</td>
</tr>
<tr>
<td>

```json
{
  "rules": {
    "prettier/prettier": "error"
  }
}
```

</td>
<td>

```typescript
rules: {
  "prettier/prettier": "error"
}
```

</td>
</tr>
</table>

---

### 步骤 9：添加 lint 脚本

**做了什么：** 在 package.json 中添加 lint 命令（方便运行）。

**手动添加到 package.json：**

```json
{
  "scripts": {
    "lint": "eslint --ext .ts,.js,.jsx,.tsx --fix --quiet ./packages"
  }
}
```

**参数说明：**

| 参数 | 作用 |
|------|------|
| `--ext .ts,.js,.jsx,.tsx` | 指定检查的文件扩展名 |
| `--fix` | 自动修复可修复的问题 |
| `--quiet` | 只显示错误，不显示警告 |
| `./packages` | 检查 packages 目录 |

**验证：**

```bash
# 运行 lint
pnpm lint

# 或者直接运行 ESLint
npx eslint packages/
```

---

### 步骤 10：创建测试文件验证配置

**做了什么：** 创建一个测试文件验证 ESLint 和 Prettier 是否生效。

**创建文件 `packages/test.ts`：**

```typescript
// 故意写一些不符合规范的代码
const a = 123
console.log(a)

// 没有分号，会被 Prettier 提示错误
```

**运行检查：**

```bash
npx eslint packages/test.ts
```

**预期结果：**
- 会提示缺少分号的错误（Prettier 规则）
- 运行 `npx eslint packages/test.ts --fix` 会自动修复

---

## 第三部分：个人 Q&A

### Q1: 为什么用 .mts 而不是 .js？

**A:** `.mts` = TypeScript 模块文件。

**好处：**
- 编辑器有类型提示和自动补全
- 配置错误会有红色波浪线提示
- 更安全，不容易写错

**代价：**
- 需要安装 `jiti` 包来运行（ESLint 通过 jiti 运行 .mts 文件）

**如何改成 .js：**
```bash
# 只需改文件名
mv eslint.config.mts eslint.config.mjs
# 卸载 jiti（可选）
pnpm remove jiti
```

---

### Q2: Flat Config 和旧格式有什么本质区别？

**A:** 

| 维度 | 旧格式 | Flat Config |
|------|--------|-------------|
| **结构** | 单个对象 | **数组**，可以有多个配置对象 |
| **优先级** | extends 链式继承 | 数组顺序，后面的覆盖前面的 |
| **灵活性** | 只能一个配置 | 可以针对不同文件应用不同配置 |
| **复杂度** | 简单 | 更灵活但学习曲线高 |

**举例：**

旧格式只能一个配置：
```json
{
  "rules": { "semi": "error" }
}
```

Flat Config 可以分文件配置：
```javascript
export default [
  {
    files: ["**/*.js"],
    rules: { "semi": "error" }
  },
  {
    files: ["**/*.ts"],
    rules: { "semi": "off" }
  }
];
```

---

### Q3: `...tseslint.configs.recommended` 中的 `...` 是什么意思？

**A:** 这是 JavaScript 的**展开运算符**（Spread Operator）。

**原因：** `tseslint.configs.recommended` 返回的是一个**数组**，需要展开放入配置数组中。

```typescript
// tseslint.configs.recommended 实际是：
[
  { rules: { ... } },
  { rules: { ... } },
  // 多个配置对象
]

// 所以要用 ... 展开
export default [
  ...tseslint.configs.recommended,  // 展开成多个配置对象
];

// 等价于：
export default [
  { rules: { ... } },
  { rules: { ... } },
];
```

---

### Q4: `globals.browser` 和 `env.browser` 有什么区别？

**A:**

| 旧格式 `env.browser` | 新格式 `globals.browser` |
|---------------------|-------------------------|
| 简化的写法 | 明确的写法 |
| ESLint 自动处理 | 使用 `globals` 包提供的预定义变量 |

**本质一样：** 都是告诉 ESLint："这些全局变量（如 `window`、`document`）是合法的，不要报未定义错误"。

```typescript
globals: {
  ...globals.browser  // 包含：window, document, navigator, etc.
}
```

---

### Q5: 为什么要安装 `eslint-config-prettier` 和 `eslint-plugin-prettier`？

**A:**

| 包 | 作用 | 为什么需要 |
|-----|------|-----------|
| `eslint-config-prettier` | 关闭 ESLint 中与 Prettier 冲突的规则 | 避免 ESLint 和 Prettier 规则冲突（如缩进、引号等） |
| `eslint-plugin-prettier` | 将 Prettier 作为 ESLint 规则运行 | 让格式问题在 ESLint 中显示，方便统一查看 |

**工作流程：**
1. 你写代码
2. ESLint 检查 → 发现格式问题 → 调用 Prettier 检查
3. Prettier 发现格式不对 → 返回给 ESLint 显示为错误
4. 运行 `eslint --fix` → 同时修复 ESLint 和 Prettier 问题

---

### Q6: `"prettier/prettier": "error"` 是什么意思？

**A:** 

- `prettier/prettier` = Prettier 插件提供的规则
- `"error"` = 违反这个规则显示为**错误**（而不是警告）

**效果：** 代码格式不符合 Prettier 规范时，会显示红色错误，必须修复才能通过检查。

**其他选项：**
```typescript
"prettier/prettier": "off"     // 关闭（不检查）
"prettier/prettier": "warn"    // 警告（黄色）
"prettier/prettier": "error"   // 错误（红色）
```

---

### Q7: 如何禁用某个 ESLint 规则？

**A:**

**在配置文件中全局禁用：**
```typescript
rules: {
  "@typescript-eslint/ban-ts-comment": "off"  // 关闭这个规则
}
```

**在代码中局部禁用：**
```typescript
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const a: any = 123;

// 或者禁用整个文件
/* eslint-disable @typescript-eslint/ban-ts-comment */
```

---

### Q8: 我能把 .mts 改成 .json 格式吗？

**A:** **不能！** ESLint 10 完全移除了对 `.eslintrc.json` 的支持。

**你的选择：**
1. **保持 `.mts`** - 有类型提示（推荐）
2. **改成 `.mjs`** - 纯 JavaScript，不需要 jiti
3. **降级到 ESLint 8** - 可以用 `.eslintrc.json`，但不推荐

---

### Q9: 面试时如何回答"你项目的 ESLint 配置"？

**回答思路：**

**第一层（基础）：**
> "我们项目使用 ESLint 10 的 Flat Config 格式进行代码检查，集成了 TypeScript 和 Prettier。"

**第二层（原理）：**
> "Flat Config 是 ESLint 9+ 的新配置格式，使用数组而不是对象，配置更灵活。我们通过 `...tseslint.configs.recommended` 应用 TypeScript 推荐规则，用 `eslint-plugin-prettier` 将 Prettier 格式化集成到 ESLint 检查中。"

**第三层（细节）：**
> "我们自定义了一些规则，比如关闭了 `ban-ts-comment`（允许使用 @ts-ignore），关闭了 `no-constant-condition`（允许 while(true) 等常量条件）。通过 `languageOptions.globals` 配置了 browser 和 node 环境的全局变量。"

**第四层（对比）：**
> "相比旧的 .eslintrc.json 格式，Flat Config 的优势是可以针对不同文件应用不同配置，优先级更清晰（数组后面的覆盖前面的），且更符合 ES Module 规范。"

---

### Q10: 下一步应该做什么？

**按优先级排序：**

1. **创建测试文件验证配置** ✅ 必须
   ```bash
   # 创建测试文件
   echo 'const a = 123' > packages/test.ts
   # 运行检查
   npx eslint packages/test.ts
   ```

2. **添加 lint 脚本到 package.json** ✅ 推荐
   ```json
   "scripts": {
     "lint": "eslint packages/"
   }
   ```

3. **配置 Git Hooks（Husky + lint-staged）** 可选
   - 在 commit 前自动运行 lint
   - 确保提交的代码都符合规范

4. **配置 CommitLint** 可选
   - 规范 commit 信息格式
   - 强制使用 `feat:` `fix:` 等前缀

5. **配置 TypeScript** 必须（如果写 TS）
   - 创建 `tsconfig.json`
   - 配置编译选项

---

## 易错点汇总

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| ⚠️ `Cannot find module 'eslint/config'` | .mts 文件需要 jiti 运行时 | 确保安装了 `jiti` 包 |
| ⚠️ `Invalid configuration` | Flat Config 格式错误 | 确保 export default 返回的是**数组** |
| ⚠️ `Parsing error: cannot read file` | TypeScript 解析器找不到 tsconfig | 创建 `tsconfig.json` 文件 |
| ⚠️ Prettier 不生效 | eslint-plugin-prettier 未正确配置 | 确保导入了 `eslint-plugin-prettier/recommended` |
| ⚠️ 规则冲突（indent、quotes 等） | ESLint 和 Prettier 规则冲突 | 确保使用了 `eslint-config-prettier` |

---

## 当前项目状态总结

### ✅ 已完成

1. ✅ pnpm workspace 配置
2. ✅ ESLint 10 安装和配置（Flat Config）
3. ✅ TypeScript ESLint 集成
4. ✅ Prettier 安装和配置
5. ✅ ESLint-Prettier 集成
6. ✅ 自定义规则配置

### ❌ 未完成（可选）

1. ❌ 创建测试文件
2. ❌ 添加 lint 脚本
3. ❌ Git Hooks（Husky）
4. ❌ CommitLint
5. ❌ TypeScript 配置（tsconfig.json）

---

## 快速验证配置

```bash
# 1. 创建测试文件
mkdir -p packages
echo "const a = 123" > packages/test.ts

# 2. 运行 ESLint
npx eslint packages/test.ts

# 3. 自动修复
npx eslint packages/test.ts --fix

# 4. 运行 Prettier
npx prettier packages/test.ts --write
```

---

**文档完成！** 这份文档完全基于你的 React-P1 项目当前状态编写，解释了 ESLint 10 Flat Config 的每一个细节。
