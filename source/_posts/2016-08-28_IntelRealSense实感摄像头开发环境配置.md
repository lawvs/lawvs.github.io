---
title: Intel RealSense 实感摄像头开发环境配置
date: 2016-08-28 22:00:00
tags:
  - RealSense
---

[Intel® RealSense™ SDK Documentation](https://software.intel.com/sites/landingpage/realsense/camera-sdk/v1.1/documentation/html/index.html)

<!--more-->

# 配置 C++开发环境

## 导入属性表

必须安装 Microsoft Visual Studio（2010 以上版本）

1. **导入 SDK 属性表** 找到 RSSDK 安装路径下 props 目录的属性表 _VS2010-15.Integration.MD.props_（用于动态运行库编译的应用）或 _VS2010-15.Integration.MT.props_（用于静态运行库编译的应用）。
2. 创建一个新项目或打开已有项目。
3. 从 View → Other Windows → Property Manager 打开属性管理器。
4. 右键点击项目名称选择添加现有属性表，分别为需要动态或静态运行库的应用选择* VS2010-15.Integration.MD.props *或* VS2010-15.Integration.MT.props *

## 项目设置

修改下面的开发设置

1. **Include Paths** 从*\$(RSSDK_DIR)/include*（需要访问的 I/ O 模块和算法模块功能）或*\$(RSSDK_DIR)/sample/common/include*（需要访问的工具类函数）添加需要的 Include 路径到各自的项目设置。
2. **Library Files and Library Paths** SDK 提供了预建库，用于添加任何需要的库路径和库文件到相应的项目设置。
