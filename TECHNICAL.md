
# 技术简介

本项目是一个纯 Web 前端项目，主要使用 [TypeScript](https://www.typescriptlang.org/) 编写而成，使用 [React](https://reactjs.org/) 生成页面、[MobX-State-Tree](https://mobx-state-tree.js.org/) 管理状态、[rspack](https://rspack.dev/) 打包，视觉风格主要参考了 [Material Design](https://material.io/design) 并使用了一些 [RMWC](https://rmwc.io/) UI 组件。


## 开发环境

下载并安装 [Node.js](https://nodejs.org/)。

```bash
# 安装依赖
npm install

# 运行开发用服务端
npm start

# 构建并发布到 gh-pages 分支
npm run publish

# 下载需要的游戏数据（也可以自己解包了复制进去）
npm run data-fetch

# 转换游戏数据
npm run data-convert

# 检查打包后的资源大小
npm run analyze
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

`CHANGELOG.md`：更新记录，界面上展示的版本号也会从中提取。


## 只更新数据的详细流程

* 安装 [Node.js](https://nodejs.org/)。
* 在 GitHub 上 fork 此项目并克隆至本地。
* 安装项目依赖：`npm install`（在项目目录下执行，下同）。
* 获取源游戏数据：`npm run data-fetch`。
  * 此步骤从他人提交至 GitHub 的仓库中下载数据，其中一部分数据也可使用 [SaintCoinach](https://github.com/xivapi/SaintCoinach) 自行解包得到。
  * 观察`data\fetch.js`文件中的 URL，来自`ffxiv-datamining`仓库的数据可通过解包国际服客户端获得，`ffxiv-datamining-cn`则是国服（注意改文件名）。
  * 如果因为网络原因难以通过程序下载这些文件，也可手动下载它们并置入`data\in`目录下。
* 修改`data\convert.js`文件中的游戏版本号信息。
  * `const patches = {`部分，按照游戏版本修改。
* 转换数据：`npm run data-convert`。
  * 如果这次数据更新有新追加的装备或食物，会生成一个`data\out\sourcesMissing.txt`文件，参考这个文件编辑`data\in\sources.txt`中的装备来源。
    * `sources.txt`的格式为，每一部分第一行是装备来源，之后几行是这个来源的装备的 ID 范围，最后以一个空行结束。
      * 装备来源后跟`@xx`可以指定这组装备的实装版本，一般来说将新出现的装备指定为最新版本即可。
    * `sourcesMissing.txt`中不连续的 ID 会被隔开，这通常意味着他们不同类的装备，但也要注意不同类装备的 ID 也有连在一起的时候。
    * 建议避免`sources.txt`中追加的 ID 范围包含未在`sourcesMissing.txt`中出现在的 ID，当前版本空着的 ID 可能会在之后版本中填入其他来源装备的数据。
  * 如果修改了`sources.txt`，需要再次执行转换数据命令，顺利的话`sourcesMissing.txt`文件会被自动删除。
* 视更新程度考虑修改`src\game.ts`文件中`const defaultItemLevelCombat = `部分，这是开始新的配装时默认的品级范围。
* 追加更新记录至`CHANGELOG.md`文件，界面上展示的版本号会从中提取，我用的版本号规则是【两位年+两位月+本月第几次更新】，你也可以自拟。
* 构建并发布：`npm run publish`。
  * 此命令会发布至你的 GitHub 仓库的 gh-pages 分支，发布后可以通过`https://<你的GitHub用户名>.github.io/ffxiv-gearing/`来访问。
* 提交并推送所做的修改至 GitHub（推荐）。
