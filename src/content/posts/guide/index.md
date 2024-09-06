---
title: 我的博客构建历程：从 Hexo 到 Astro
published: 2024-09-06
description: "Simple Guides for Fuwari"
image: "./cover.jpeg"
tags:
  - Blogging
# category: Guides
draft: false
---

2016 年四月，那时我还在念书，偶然发现 GitHub Pages 这个功能，可以免费托管静态网站。我拉着同学一起搭建了自己的博客。那时我对前端一窍不通，只能选择一些现成的主题。当时我选择了 Hexo，因为它是一个简单的静态博客框架，而且有很多好看的主题可以选择。对着文档各种折腾，我居然成功地把博客搭建起来并且部署到了 GitHub Pages 上。那个时候选用的主题甚至是 Hexo 自带的默认主题。而且那时候的部署方式是在本地构建完成之后，直接推送到 GitHub 仓库的 gh-pages 分支上。一旦本地的 markdown 文件丢失，那么博客的内容也就很难找回了。

到了2018年5月，我对前端和版本控制有了更深的理解，便重构了整个博客项目，选择了 [hexo-theme-yilia](https://github.com/litten/hexo-theme-yilia) 这个简约优雅的主题，并为博客添加了 Travis CI 自动部署功能。这样一来，只要在 GitHub 上提交新的文章，Travis CI 就会自动构建并部署到 GitHub Pages。这种方式不仅免除了本地文件丢失的担忧，还大大提高了部署的便捷性。

随着时间的推移，GitHub Actions 逐渐取代了 Travis CI，我也在 2021 年的六月将博客的自动部署迁移到了 GitHub Actions 上，那个时候我还在用 Node.js v13。

前端的技术更新换代速度非常快，在我使用 Hexo 的这几年里，出现了很多新的静态网站生成器，比如 Gatsby、VuePress、Astro 等等。Hexo 也做了很多更新，我也终于在 2024 年年初找到时间把博客的各种依赖升级到最新，把 Hexo 升级到了 7.0 版本，然后顺便 又换了一个主题 [hexo-theme-butterfly](https://github.com/jerryc127/hexo-theme-butterfly)。得益于 Hexo 的更新，现在可以在 package.json 中直接安装主题，而不用再去 clone 主题的仓库，然后再配置主题。在这次更新之后，整个项目十分干净，几乎只包含了 markdown 文件和配置文件，极其优雅。

但是在写博客过程中，静态资源（图片）的管理一直是一个问题，我要么选择将图片放在不知道能够存活多久的图床上，要么将图片全部塞进统一的资源文件夹中。即使 Hexo 提供了 [post_asset_folder](https://hexo.io/docs/asset-folders#Post-Asset-Folder) 功能，也只是将图片放在和 markdown 文件同名的文件夹中，和我理想的 [TextBundle](http://textbundle.org/) 模式还是有一点区别，没法将所有内容装在一个文件夹中，一个拷贝直接带走。

这朵乌云一直笼罩在我的心头，导致我在写博客的时候一直不愿意添加图片。我甚至用出了将图片转为 base64 内联在 markdown 文件中的邪道。但是这样一来，markdown 文件会变得非常巨大，难以维护。

在 2024 年年中的时候，我因为需要写文档站点，尝试了 [Astro](https://astro.build/) 这个新的网站框架，它的特点是内容驱动，框架无关，并且能自动优化网站的资源图片，能够大大减小网站的体积。最重要的是，我发现它的内容管理方式非常符合我的需求，可以将图片和 markdown 文件放在一起。这样一来，我就可以放心地添加图片了。

项目的迁移计划被安排在 9 月，我在两个都很好看的主题 [Typography](https://github.com/moeyua/astro-theme-typography) 和 [🍥Fuwari](https://github.com/saicaca/fuwari) 中选择了更有特点（花里胡哨）的 🍥Fuwari 主题，也就是你现在看到这个。

## 附录

使用 base64 内联图片的方法：

```md
![image name][image_label]

[image_label]: data:image/png;base64,iVBORw0KXXXXXXXX
```

至于如何将图片转为 base64，我使用了 CyberChef 这个工具，只要调整好参数将图片拖进去，就可以得到 base64 字符串

- [Base64ToImage - CyberChef](<https://gchq.github.io/CyberChef/#recipe=To_Base64('A-Za-z0-9%2B/%3D')Pad_lines('Start',22,'data:image/png;base64,')>)

---

以下内容是 Fuwari 主题自带的简单指南，我选择将其保留用于备忘和参考：

# Guide

This blog template is built with [Astro](https://astro.build/). For the things that are not mentioned in this guide, you may find the answers in the [Astro Docs](https://docs.astro.build/).

## Front-matter of Posts

```yaml
---
title: My First Blog Post
published: 2023-09-09
description: This is the first post of my new Astro blog.
image: ./cover.jpg
tags: [Foo, Bar]
category: Front-end
draft: false
---
```

| Attribute     | Description                                                                                                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`       | The title of the post.                                                                                                                                                                                      |
| `published`   | The date the post was published.                                                                                                                                                                            |
| `description` | A short description of the post. Displayed on index page.                                                                                                                                                   |
| `image`       | The cover image path of the post.<br/>1. Start with `http://` or `https://`: Use web image<br/>2. Start with `/`: For image in `public` dir<br/>3. With none of the prefixes: Relative to the markdown file |
| `tags`        | The tags of the post.                                                                                                                                                                                       |
| `category`    | The category of the post.                                                                                                                                                                                   |
| `draft`       | If this post is still a draft, which won't be displayed.                                                                                                                                                    |

## Where to Place the Post Files

Your post files should be placed in `src/content/posts/` directory. You can also create sub-directories to better organize your posts and assets.

```
src/content/posts/
├── post-1.md
└── post-2/
    ├── cover.png
    └── index.md
```
