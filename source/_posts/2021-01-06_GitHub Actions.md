---
title: 前端的 GitHub Actions 简单实践
date: 2021-01-06 00:00:00
tags:
  - GitHub
  - GitHub Actions
---

在 GitHub Actions 公测一年之后，我已经把它当作首选的 CI/CD 工具了，也迁移了一部分在 [Travis CI](https://travis-ci.org/) 上的项目。借助 action 的扩展性和社区的力量，使用感受相当满意，不过也有不少坑和需要吐槽的地方。

<!--more-->

这篇文档不会介绍 [GitHub Actions](https://github.com/features/actions) 的基本概念和使用方法，因此并不适合没有使用过它的访客，如果你属于这类人，那么建议你先阅读 [GitHub Actions 官方文档](https://docs.github.com/en/free-pro-team@latest/actions) 并尝试使用。

首先最需要吐槽的一点是配置文件暂时[不支持](https://github.community/t/support-for-yaml-anchors/16128) [yaml 的锚点引用](https://yaml.org/spec/1.2/spec.html#id2785586)。如果你没有精力将配置改为 action ，可能需要频繁复制配置片段。因此我将我常用的配置分为不同部分分别说明。

## The Start

这个部分会展示一个 GitHub 配置文件的基本部分。

```yml
# 这里的名称会显示在对应 badge 上
name: Build

on:
  # 注意：新创建的仓库主分支已经变为 `main`，需要根据情况修改
  push:
    branches: [master]
  pull_request:
    branches: [master]
  # 通常用在使用 action 发包的场合
  tags:
    - "v*"
  # 定时触发器 注意时区是 UTC
  schedule:
    - cron: "0 0 * * *" # At every day 00:00(UTC).
  # 如果需要手动触发
  # 进阶用法参考 https://docs.github.com/en/free-pro-team@latest/actions/reference/events-that-trigger-workflows#example-workflow-configuration
  workflow_dispatch:

jobs:
  # 这里的 `build` 仅作为 job 名称，可以根据情况修改
  build:
    # 大部分情况下，不使用 strategy 也毫无问题
    strategy:
      matrix:
        node-version: [14.x]
        os: [ubuntu-latest]

    # 提供一个可以跳过 CI 的方式
    if: "!contains(github.event.head_commit.message, '[skip ci]')"
    runs-on: ${{ matrix.os }}

    steps:
      - name: ...
      - name: ...
```

## Checkout

```yml
# 注意：默认签出时只会签出一个提交
# 此时没有任何 tag，commit hash 也和线下不同
# 因此在需要完整 commit 或 tag 时需要使用 fetch-depth 参数
- uses: actions/checkout@v2
  # with:
  #   fetch-depth: 0

# 如果没有设置 `strategy.matrix` 需要替换一下
- name: Use Node.js ${{ matrix.node-version }}
  uses: actions/setup-node@v1
  with:
    node-version: ${{ matrix.node-version }}
    # 注意：在需要发布 npm 包时要明确指定 `registry-url`
    # registry-url: https://registry.npmjs.org
```

## Install Dependencies

npm

<details>
<summary>点击查看</summary>

```yml
- name: Get npm cache directory path
  id: npm-cache-dir-path
  run: echo "::set-output name=dir::$(npm config get cache)"

- name: Cache npm modules
  uses: actions/cache@v1
  with:
    path: ${{ steps.npm-cache-dir-path.outputs.dir }}
    key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
    restore-keys: ${{ runner.os }}-npm
```

</details>

yarn

<details>
<summary>点击查看</summary>

```yml
- name: Get yarn cache directory path
  id: yarn-cache-dir-path
  run: echo "::set-output name=dir::$(yarn cache dir)"

- name: Cache node modules
  uses: actions/cache@v1
  with:
    path: ${{ steps.yarn-cache-dir-path.outputs.dir }}
    key: ${{ runner.os }}-yarn-${{ hashFiles('**/yarn.lock') }}
    restore-keys: |
      ${{ runner.os }}-yarn-

- name: Install node modules
  run: yarn install --frozen-lockfile
```

</details>

由于安装的篇幅实在是有些长，而且并不直观，我已经开始使用现成的第三方的 [bahmutov/npm-install](https://github.com/bahmutov/npm-install)

```yml
- name: Install
  uses: bahmutov/npm-install@v1
```

更新：我已切换到 pnpm

```yml
- uses: pnpm/action-setup@v2
  with:
    version: "latest"

- name: Use Node.js ${{ matrix.node-version }}
  uses: actions/setup-node@v2
  with:
    node-version: ${{ matrix.node-version }}
    cache: "pnpm"
```

## Check

大部分前端项目都会做一些相同的工作

```yml
# `reportUnusedDisableDirectives` 也可以配置在配置文件中
- name: Lint
  run: yarn lint --report-unused-disable-directives --max-warnings=0

- name: Type check
  run: yarn typecheck # tsc --noEmit

# 如果对接了其他应用，还需要上传测试覆盖
- name: Test
  run: yarn test --coverage # jest --coverage

- name: Test E2E
  run: yarn test:e2e-ci

# 如果你的项目内部有相互依赖（如 monorepo），那么大概率需要在做其他检查之前 build
- name: Build
  run: yarn build

# 如果使用了 cypress
# 在失败时尝试上传视频/截图信息
- name: Upload artifacts
  if: ${{ failure() }}
  uses: actions/upload-artifact@v2
  with:
    name: cypress-artifacts
    path: |
      cypress/images
      cypress/videos
    if-no-files-found: ignore
```

## Deploy

Github Actions 没有官方的 gh-page action，不过随着社区的完善，第三方的 [actions-gh-pages](https://github.com/peaceiris/actions-gh-pages) 已经开发得足够齐全，完全可以满足日常使用了

```yml
- name: Deploy GitHub Pages
  # 注意：如果你的 workflow 还带 PR 触发，没有这个限制会把其他人的 PR 部署上去，存在安全和爆炸风险
  if: github.ref == 'refs/heads/master'
  uses: peaceiris/actions-gh-pages@v3
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: dist/public
    # 只保留一个提交
    force_orphan: true
```

除次之外你还可以使用简单的提交脚本

```sh
pushd build
git init
git config user.email "github-actions[bot]@users.noreply.github.com"
git config user.name "github-actions[bot]"
git add .
git commit -m "Deployed at $(date --iso-8601)"
git remote add origin git@github.com:UserName/RepoName.git
git push -f origin master:gh-pages
rm -rf .git
popd
```

## Release

发布 npm 包和 GitHub Release

<details>
<summary>点击查看</summary>

```yml
# on:
#   push:
#     tags:
#       - 'v*'

# 发布 npm 包
# 注意需要配合 `actions/setup-node` 的 `registry-url` 参数
- name: Publish
  run: yarn publish
  env:
    # 需要在仓库 secrets 里设置 token
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

# https://github.com/actions/create-release
- name: Create Release
  id: create_release
  uses: actions/create-release@v1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    tag_name: ${{ github.ref }}
    release_name: Release ${{ github.ref }}
    draft: false
    prerelease: false

# 打包 npm 包，同时获取打包后的文件名
- name: Pack
  id: pack-npm
  run: echo "::set-output name=filename::$(yarn pack | tail -1)"

# 如果是网站，可以手动打包文件
- name: Package
  # 注意：生产环境不应该保留 map 文件
  run: tar czfv dist.tar.gz --directory=dist --exclude='*.map' .

# https://github.com/actions/upload-release-asset
- name: Upload Release Asset
  uses: actions/upload-release-asset@v1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    upload_url: ${{ steps.create_release.outputs.upload_url }}
    asset_path: ${{ steps.pack-npm.outputs.filename }}
    asset_name: ${{ steps.pack-npm.outputs.filename }}
    asset_content_type: application/gzip
```

</details>

## The End

最后，一个完整的 workflow 的结构应该是这样的

<details>
<summary>点击查看</summary>

```yml
name: Build

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  build:
    if: "!contains(github.event.head_commit.message, '[skip ci]')"
    runs-on: ubuntu-latest

    steps:
      - name: Install
        run: ...
      - name: Lint
      - name: Type Check
      - name: Test
      - name: Build
      # - name: Deploy
      # - name: Release
```

</details>

## Others

- [配合 shipjs 发版](https://github.com/egoist/vue-head/blob/master/.github/workflows/shipjs-manual-prepare.yml)
- [配合 dangerjs](https://github.com/danger/danger-js)

## Reference

- [GitHub Actions](https://github.com/actions)
- [github-script](https://github.com/actions/github-script)
