
# 技术简介

本项目是一个纯 Web 前端项目，主要使用 [TypeScript](https://www.typescriptlang.org/) 编写而成，使用 [React](https://reactjs.org/) 生成页面、[MobX-State-Tree](https://mobx-state-tree.js.org/) 管理状态、[webpack](https://webpack.js.org/) 打包，视觉风格主要参考了 [Material Design](https://material.io/design) 并使用了一些 [RMWC](https://rmwc.io/) UI 组件。


## 开发环境

下载并安装 [Node.js](https://nodejs.org/) 和 [Yarn](https://classic.yarnpkg.com/)。

```bash
# 安装依赖
yarn

# 运行开发用服务端
yarn start

# 构建并发布到 gh-pages 分支
yarn run publish

# 下载需要的游戏数据（也可以自己解包了复制进去）
yarn run data-fetch

# 转换游戏数据
yarn run data-convert

# 检查打包后的资源大小
yarn run analyze
```


## 特别的技术点

这一部分解释一些直接看代码可能会比较费解的技术点。


### 分享链接

分享链接的数据部分是一个62进制的大整数，通过乘每一项的取值范围再加这一项值计算得出。

例如，要放入三个值 `a`、`b`、`c`，它们的取值范围分别是 `[0,A)`、`[0,B)`、`[0,C)`，那么得到的大整数就是：`((0*A+a)*B+b)*C+c`。

这种编码方式可以在不引入复杂的正式压缩算法的情况下，减少冗余让编码后的链接尽量短。


### Service Worker

因为 GitHub Pages 的缓存机制不可调整，我用了 Service Worker 来启用更激进的缓存资源策略，但与常规用法不同，它被设置为了只对文件名带 contenthash 的资源生效，入口页面仍然是本来的缓存机制，发布新版之后 contenthash 会变旧版自动失效所以 Service Worker 本身不需要更新。

总之并未按照 Service Worker 本来的设计用途使用它，也没引入相关的业务功能，只是用作 Pages 服务器不在自己手里调不了缓存机制的妥协方案。


### 装备获取途径

装备获取途径是手动整理的，在 `data/in/sources.txt` 里，转换游戏数据时如果存在没查找到获取途径的装备，会生成一个 `data/out/sourcesMissing.txt` 文件，可以参考它来整理获取途径。


### 图标

职业图标来自 [xivapi/classjob-icons](https://github.com/xivapi/classjob-icons)，感谢他们。


### 发布新版本

除了实际业务改动，发新版的时候还有这些地方需要手动修改：

`src/views/About.tsx`：版本号。

`CHANGELOG.md`：更新记录。
