---
title: 【稀土掘金 2022 编程挑战赛】快速开发一个 VSCode 主题插件
published: 2022-05-01 00:00:00
tags:
  - 比赛
  - VSCode
  - Frontend
---

偶然看到[稀土掘金 2022 编程挑战赛](https://hackathon2022.juejin.cn/#/)，题目形式比较开放而且我近期刚好有空，因此决定和朋友一起开发一个 VSCode 主题插件。

本文涉及的[项目源码已在 GitHub 开源](https://github.com/lawvs/a-soul-theme)，这篇文章也是在这个配色主题下完成的，插件配色效果如下：

![image](https://user-images.githubusercontent.com/18554747/165396514-cca8483e-fcd2-43d8-8c06-4e922ec4623c.png)

## 新建项目

通过简单的搜索，可以发现 VSCode 很贴心地给开发者提供了[创建新主题的教程](https://code.visualstudio.com/api/extension-guides/color-theme#create-a-new-color-theme)。

跟着教程创建一个新的项目

```sh
npm install -g yo generator-code
yo code

# What type of extension do you want to create?
# 选择创建颜色主题 `New Color Theme`

# Do you want to import or convert an existing TextMate color theme?
# 选择从头开始 `Start fresh`

# 后续的配置选项可以根据自己的需要填写
```

这两行命令可以帮助我们快速创建一个新的插件项目，并且配置好开发所需的配置。其中比较重要的配置如下：

- `themes/xxxxx-color-theme.json` 这个文件就是我们的颜色主题的配置文件，在文件中可以调整 VSCode 不同区域的颜色配置和代码高亮。
  ```json
  // 一个典型的主题配置文件
  {
    // 主题名
    "name": "theme name",
    // 颜色配置
    "colors": {
      // VSCode 背景颜色
      "editor.background": "#263238",
      // VSCode 默认前景色（文字颜色）
      "editor.foreground": "#eeffff",
      "activityBarBadge.background": "#007acc",
      "sideBarTitle.foreground": "#bbbbbb"
      // ...
    },
    // 代码高亮配置
    "tokenColors": [
      {
        "name": "Variables",
        "scope": ["variable", "string constant.other.placeholder"],
        "settings": {
          "foreground": "#EEFFFF"
        }
      },
      {
        "name": "Colors",
        "scope": ["constant.other.color"],
        "settings": {
          "foreground": "#ffffff"
        }
      }
      // ...
    ]
  }
  ```
- `.vscode/launch.json` 这个文件配置了 VSCode 插件的运行方式，用于开发时 Debug。
- `package.json` 中的 `contributes` 字段。这个字段声明了 VSCode 插件包含的内容。

项目创建完成后，我们可以尝试用 VSCode 打开项目，然后按下 F5（Start Debugging），VSCode 就会打开一个加载了当前开发主题插件的新窗口。进入 Debug 模式之后，尝试修改 `themes/xxxxx-color-theme.json` 的 `colors` 配置，保存后可以发现 Debug 窗口的对应区域颜色会发生变化。

至此，我们就完成了一个项目环境的基本搭建。

## 配色开发

通过修改 `themes/xxxxx-color-theme.json` 的 `colors` 配置我们就可以根据自己的喜好调整 VSCode 不同区域的颜色了，主题具体的配置选项非常多，哪项配置对应哪个区域可以直接通过把鼠标悬浮在配置项上得到提示或者在 [VSCode 的主题色文档](https://code.visualstudio.com/api/references/theme-color)中查找。

如果你还希望调整不同语言的高亮，还需要调整 `tokenColors` 的配置了，在 VSCode 的命令面板中运行 `Developer: Inspect Editor Tokens and Scopes`，可以得到对应语言的详细语法信息，这些信息在调整配置时很有帮助。VSCode 也给了详尽的[语法高亮指南](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide#theming)

![inspect token](https://user-images.githubusercontent.com/18554747/166101716-538d8e05-f06c-4a05-8524-6c468d6a5359.png)

以上就是开发一个 VSCode 主题所需的全部知识了。

## 优化

但是真正开始设计时，会发现单纯操作 json 文件需要关注很多琐碎的细节并且很难复用各种颜色，因此可能还需要借助一系列工具帮助我们降低配置的复杂度。

比如我还使用了 [vscode-theme-generator](https://github.com/Tyriar/vscode-theme-generator) 帮助简化配置，同时把设计主题色抽取出来编写成配置文件，方便调整配色。

## 打包发布

在 [vsce (Visual Studio Code Extensions)](https://github.com/microsoft/vscode-vsce) 的帮助下打包只需要一条命令就够了

```sh
vsce package
```

如果你还希望将插件发布到官方市场，还需要一个 Azure 账号配置并配置好 token

```sh
# 手动登录
vsce login <publisher name>

# 或者配置 token 环境变量
VSCE_PAT=<token>

vsce publish
```

更详细的步骤可以查看 VSCode 的[发布文档](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)。

<!--

## 彩蛋

以下是在开发过程中遇上的问题，前端开源生态真是糟透了.jpg

- [polished - [Feature request] Add function to convert between rgb and hex notation](https://github.com/styled-components/polished/issues/614)
- [vscode-theme-generator - Possible to add token color overrides?](https://github.com/Tyriar/vscode-theme-generator/issues/63)
- [vscode-vsce - Support pnpm](https://github.com/microsoft/vscode-vsce/issues/421)

-->
